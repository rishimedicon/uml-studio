"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { Diagram, LifelineElement, Relationship, ValidationIssue } from "@/lib/uml/types";
import { exportElementImage } from "@/lib/export";
import type { Selection } from "./types";

export interface SequenceHandle {
  exportImage: (format: "png" | "svg") => Promise<string | null>;
}

const COL = 190;
const LEFT = 40;
const HEAD_Y = 20;
const HEAD_H = 40;
const BOX_W = 150;
const FIRST_ROW = 110;
const ROW = 46;
const ACT_W = 12;

interface Props {
  diagram: Diagram;
  issues: ValidationIssue[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}

export function computeSequenceLayout(diagram: Diagram) {
  const lifelines = diagram.elements.filter((e): e is LifelineElement => e.kind === "lifeline");
  const idx = new Map(lifelines.map((l, i) => [l.id, i]));
  const messages = diagram.relationships.filter((r) => r.kind === "message" && idx.has(r.sourceId) && idx.has(r.targetId));
  const boxW = new Map(lifelines.map((l) => [l.id, Math.min(260, Math.max(BOX_W, headLabel(l).length * 7 + 24))]));
  // Widen gaps so adjacent-lifeline message labels fit between the lines.
  const gaps = lifelines.slice(1).map((l, i) => {
    const prev = lifelines[i];
    let need = Math.max(COL, (boxW.get(prev.id)! + boxW.get(l.id)!) / 2 + 40);
    for (const [k, m] of messages.entries()) {
      const a = idx.get(m.sourceId)!;
      const b = idx.get(m.targetId)!;
      if (Math.min(a, b) === i && Math.max(a, b) === i + 1) need = Math.max(need, `${k + 1}: ${m.label ?? ""}`.length * 6.6 + 40);
    }
    return need;
  });
  const col = new Map<string, number>();
  let x = LEFT + (lifelines[0] ? boxW.get(lifelines[0].id)! / 2 : BOX_W / 2);
  lifelines.forEach((l, i) => {
    if (i > 0) x += gaps[i - 1];
    col.set(l.id, x);
  });
  const rowY = (i: number) => FIRST_ROW + i * ROW;
  const createdAt = new Map<string, number>();
  messages.forEach((m, i) => {
    if (m.messageType === "create" && !createdAt.has(m.targetId)) createdAt.set(m.targetId, i);
  });

  const activations: { lifeline: string; from: number; to: number; depth: number }[] = [];
  const stacks = new Map<string, { from: number; caller: string }[]>();
  messages.forEach((m, i) => {
    if (m.messageType === "sync" && m.sourceId !== m.targetId) {
      const st = stacks.get(m.targetId) ?? [];
      st.push({ from: rowY(i), caller: m.sourceId });
      stacks.set(m.targetId, st);
    } else if (m.messageType === "reply") {
      const st = stacks.get(m.sourceId) ?? [];
      const idx = st.findLastIndex((a) => a.caller === m.targetId);
      if (idx >= 0) {
        const [a] = st.splice(idx, 1);
        activations.push({ lifeline: m.sourceId, from: a.from, to: rowY(i), depth: idx });
      }
    }
  });
  const end = rowY(Math.max(messages.length, 1)) + 10;
  for (const [id, st] of stacks) st.forEach((a, depth) => activations.push({ lifeline: id, from: a.from, to: end - 10, depth }));

  const last = lifelines[lifelines.length - 1];
  const width = last ? col.get(last.id)! + boxW.get(last.id)! / 2 + LEFT + 160 : LEFT * 2 + COL;
  const height = end + 40;
  return { lifelines, col, boxW, messages, rowY, createdAt, activations, width, height, end };
}

function headLabel(l: LifelineElement) {
  return l.classifier ? `${l.name}: ${l.classifier}` : l.name;
}

export const SequenceView = forwardRef<SequenceHandle, Props>(function SequenceView({ diagram, issues, selection, onSelect }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const L = useMemo(() => computeSequenceLayout(diagram), [diagram]);
  const flagged = useMemo(() => {
    const m = new Map<string, "error" | "warning">();
    for (const i of issues) for (const id of [...(i.elementIds ?? []), ...(i.relationshipIds ?? [])]) {
      if (i.severity === "error") m.set(id, "error");
      else if (i.severity === "warning" && !m.has(id)) m.set(id, "warning");
    }
    return m;
  }, [issues]);

  useImperativeHandle(ref, () => ({
    exportImage: async (format) => {
      if (!svgRef.current) return null;
      if (format === "svg") {
        const xml = new XMLSerializer().serializeToString(svgRef.current);
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      }
      return exportElementImage(svgRef.current as unknown as HTMLElement, "png", { width: L.width, height: L.height });
    },
  }));

  const isSel = (type: "element" | "relationship", id: string) => selection?.type === type && selection.id === id;
  const color = (id: string, type: "element" | "relationship") =>
    isSel(type, id) ? "#2563eb" : flagged.get(id) === "error" ? "#dc2626" : "#1e293b";

  const xOf = (id: string) => L.col.get(id)!;

  const activationEdge = (lifeline: string, y: number, side: 1 | -1) => {
    const acts = L.activations.filter((a) => a.lifeline === lifeline && y >= a.from - 1 && y <= a.to + 1);
    if (!acts.length) return xOf(lifeline);
    const depth = Math.max(...acts.map((a) => a.depth));
    return xOf(lifeline) + side * (ACT_W / 2) + depth * 4;
  };

  return (
    <div ref={container} className="h-full w-full overflow-auto bg-white" data-testid="sequence-canvas" onClick={() => onSelect(null)}>
      {L.lifelines.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          Add a lifeline from the toolbar, use an example, or generate with AI.
        </div>
      ) : (
        <svg ref={svgRef} width={L.width} height={L.height} xmlns="http://www.w3.org/2000/svg" style={{ background: "#fff", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
          <rect width={L.width} height={L.height} fill="#fff" />
          {L.lifelines.map((l) => {
            const x = xOf(l.id);
            const created = L.createdAt.get(l.id);
            const headY = created !== undefined ? L.rowY(created) - HEAD_H / 2 : HEAD_Y;
            const label = headLabel(l);
            const bw = L.boxW.get(l.id)!;
            const c = color(l.id, "element");
            return (
              <g key={l.id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onSelect({ type: "element", id: l.id }); }}>
                <line x1={x} y1={l.participantType === "actor" ? headY + 54 : headY + HEAD_H} x2={x} y2={L.end} stroke="#64748b" strokeDasharray="6 5" />
                {l.participantType === "actor" ? (
                  <g transform={`translate(${x - 12}, ${headY - 14})`} stroke={c} strokeWidth="1.5" fill="#fff">
                    <circle cx="12" cy="8" r="7" />
                    <line x1="12" y1="15" x2="12" y2="34" />
                    <line x1="0" y1="22" x2="24" y2="22" />
                    <line x1="12" y1="34" x2="2" y2="48" />
                    <line x1="12" y1="34" x2="22" y2="48" />
                  </g>
                ) : (
                  <rect x={x - bw / 2} y={headY} width={bw} height={HEAD_H} fill="#fef3c7" stroke={c} strokeWidth={isSel("element", l.id) ? 2 : 1.3} />
                )}
                <text x={x} y={l.participantType === "actor" ? headY + 48 : headY + HEAD_H / 2 + 4} textAnchor="middle" fontSize="12" fill="#0f172a" textDecoration={l.participantType === "actor" ? undefined : "underline"}>
                  {label.length > 34 ? `${label.slice(0, 33)}…` : label}
                </text>
              </g>
            );
          })}
          {L.activations.map((a, i) => (
            <rect key={i} x={xOf(a.lifeline) - ACT_W / 2 + a.depth * 4} y={a.from} width={ACT_W} height={Math.max(8, a.to - a.from)} fill="#e2e8f0" stroke="#334155" />
          ))}
          {L.messages.map((m, i) => (
            <MessageArrow
              key={m.id}
              m={m}
              y={L.rowY(i)}
              index={i + 1}
              x1={m.sourceId === m.targetId ? activationEdge(m.sourceId, L.rowY(i), 1) : activationEdge(m.sourceId, L.rowY(i), xOf(m.targetId) > xOf(m.sourceId) ? 1 : -1)}
              x2={
                m.messageType === "create"
                  ? xOf(m.targetId) + ((xOf(m.targetId) > xOf(m.sourceId) ? -1 : 1) * L.boxW.get(m.targetId)!) / 2
                  : activationEdge(m.targetId, L.rowY(i) + (m.messageType === "sync" ? 1 : 0), xOf(m.targetId) > xOf(m.sourceId) ? -1 : 1)
              }
              color={color(m.id, "relationship")}
              selected={isSel("relationship", m.id)}
              onClick={() => onSelect({ type: "relationship", id: m.id })}
            />
          ))}
        </svg>
      )}
    </div>
  );
});

function MessageArrow({ m, y, x1, x2, index, color, selected, onClick }: { m: Relationship; y: number; x1: number; x2: number; index: number; color: string; selected: boolean; onClick: () => void }) {
  const dashed = m.messageType === "reply";
  const label = `${index}: ${m.label ?? ""}`;
  const sw = selected ? 2.2 : 1.3;
  if (m.sourceId === m.targetId) {
    const w = 36;
    return (
      <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <path d={`M ${x1} ${y - 8} H ${x1 + w} V ${y + 14} H ${x1 + 2}`} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={dashed ? "5 4" : undefined} />
        <polygon points={`${x1 + 2},${y + 14} ${x1 + 12},${y + 9} ${x1 + 12},${y + 19}`} fill={color} />
        <rect x={x1 + w + 4} y={y - 12} width={label.length * 6.6 + 8} height={18} fill="transparent" />
        <text x={x1 + w + 8} y={y + 2} fontSize="11.5" fill="#0f172a">{label}</text>
      </g>
    );
  }
  const dir = x2 > x1 ? 1 : -1;
  const head = m.messageType === "sync" || m.messageType === "create"
    ? <polygon points={`${x2},${y} ${x2 - dir * 11},${y - 5} ${x2 - dir * 11},${y + 5}`} fill={color} />
    : <polyline points={`${x2 - dir * 11},${y - 6} ${x2},${y} ${x2 - dir * 11},${y + 6}`} fill="none" stroke={color} strokeWidth={sw} />;
  return (
    <g className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={14} />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={sw} strokeDasharray={dashed ? "5 4" : undefined} />
      {head}
      <text x={(x1 + x2) / 2} y={y - 6} fontSize="11.5" textAnchor="middle" fill="#0f172a">
        {m.messageType === "create" ? `«create» ${label}` : label}
      </text>
    </g>
  );
}
