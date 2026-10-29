"use client";

import { BaseEdge, EdgeLabelRenderer, useInternalNode, type Edge, type EdgeProps } from "@xyflow/react";
import type { Relationship } from "@/lib/uml/types";
import { edgeEndpoints, nodeCenter } from "./geometry";

export type UmlEdgeData = { rel: Relationship; issue?: "error" | "warning" };
export type UmlEdgeType = Edge<UmlEdgeData, "uml">;

type Pt = { x: number; y: number };

/** Builds a marker polygon at `tip`, pointing away from `from`. */
function marker(kind: "triangle" | "diamond" | "open", tip: Pt, from: Pt, size = 14) {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
  const rot = (p: Pt) => ({
    x: tip.x + p.x * Math.cos(ang) - p.y * Math.sin(ang),
    y: tip.y + p.x * Math.sin(ang) + p.y * Math.cos(ang),
  });
  const pts =
    kind === "triangle"
      ? [{ x: 0, y: 0 }, { x: -size, y: -size * 0.55 }, { x: -size, y: size * 0.55 }]
      : kind === "diamond"
        ? [{ x: 0, y: 0 }, { x: -size * 0.8, y: -size * 0.45 }, { x: -size * 1.6, y: 0 }, { x: -size * 0.8, y: size * 0.45 }]
        : [{ x: -size * 0.9, y: -size * 0.5 }, { x: 0, y: 0 }, { x: -size * 0.9, y: size * 0.5 }];
  const back = kind === "triangle" ? rot({ x: -size, y: 0 }) : kind === "diamond" ? rot({ x: -size * 1.6, y: 0 }) : tip;
  return { points: pts.map(rot).map((p) => `${p.x},${p.y}`).join(" "), back };
}

function offsetAlong(a: Pt, b: Pt, dist: number, perp: number): Pt {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return { x: a.x + ux * dist - uy * perp, y: a.y + uy * dist + ux * perp };
}

export function UmlEdge({ id, source, target, data, selected }: EdgeProps<UmlEdgeType>) {
  const sNode = useInternalNode(source);
  const tNode = useInternalNode(target);
  if (!sNode || !tNode || !data) return null;
  const rel = data.rel;
  const color = data.issue === "error" ? "#dc2626" : selected ? "#2563eb" : "#334155";

  let s: Pt;
  let t: Pt;
  let path: string;
  if (source === target) {
    const c = nodeCenter(sNode);
    const w = sNode.measured.width ?? 0;
    const h = sNode.measured.height ?? 0;
    s = { x: c.x + w / 2, y: c.y - h / 4 };
    t = { x: c.x + w / 4, y: c.y - h / 2 };
    path = `M ${s.x} ${s.y} C ${s.x + 60} ${s.y} ${t.x} ${t.y - 60} ${t.x} ${t.y}`;
  } else {
    ({ s, t } = edgeEndpoints(sNode, tNode));
    path = "";
  }

  const dashed = ["realization", "dependency", "include", "extend", "anchor"].includes(rel.kind);
  let sourceMarker: ReturnType<typeof marker> | null = null;
  let targetMarker: ReturnType<typeof marker> | null = null;
  let filled = false;
  const ctrlS = source === target ? { x: s.x + 60, y: s.y } : t;
  const ctrlT = source === target ? { x: t.x, y: t.y - 60 } : s;
  switch (rel.kind) {
    case "generalization":
    case "realization":
      targetMarker = marker("triangle", t, ctrlT);
      break;
    case "aggregation":
      sourceMarker = marker("diamond", s, ctrlS);
      break;
    case "composition":
      sourceMarker = marker("diamond", s, ctrlS);
      filled = true;
      break;
    case "dependency":
    case "include":
    case "extend":
    case "controlFlow":
      targetMarker = marker("open", t, ctrlT);
      break;
    case "association":
      if (rel.navigable) targetMarker = marker("open", t, ctrlT);
      break;
  }
  if (!path) {
    const start = sourceMarker && sourceMarker.back !== s ? sourceMarker.back : s;
    const end = targetMarker && rel.kind !== "controlFlow" && targetMarker.back !== t && (rel.kind === "generalization" || rel.kind === "realization") ? targetMarker.back : t;
    path = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
  let centerLabel = rel.label ?? "";
  if (rel.kind === "include") centerLabel = "«include»";
  if (rel.kind === "extend") centerLabel = `«extend»${rel.label ? `\n[${rel.label}]` : ""}`;
  if (rel.kind === "controlFlow") centerLabel = rel.guard ? `[${rel.guard.replace(/^\[|\]$/g, "")}]` : rel.label ?? "";

  const ends: { text: string; at: Pt }[] = [];
  if (source !== target) {
    if (rel.sourceMultiplicity) ends.push({ text: rel.sourceMultiplicity, at: offsetAlong(s, t, 22, -12) });
    if (rel.targetMultiplicity) ends.push({ text: rel.targetMultiplicity, at: offsetAlong(t, s, 22, 12) });
    if (rel.sourceRole) ends.push({ text: rel.sourceRole, at: offsetAlong(s, t, 26, 14) });
    if (rel.targetRole) ends.push({ text: rel.targetRole, at: offsetAlong(t, s, 26, -14) });
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: color, strokeWidth: selected ? 2 : 1.4, strokeDasharray: dashed ? "6 4" : undefined }}
        interactionWidth={16}
      />
      {sourceMarker && <polygon points={sourceMarker.points} fill={filled ? color : "#fff"} stroke={color} strokeWidth={1.4} />}
      {targetMarker &&
        (rel.kind === "generalization" || rel.kind === "realization" ? (
          <polygon points={targetMarker.points} fill="#fff" stroke={color} strokeWidth={1.4} />
        ) : (
          <polyline points={targetMarker.points} fill="none" stroke={color} strokeWidth={1.4} />
        ))}
      <EdgeLabelRenderer>
        {centerLabel && (
          <div
            className="nodrag nopan absolute whitespace-pre rounded bg-white/90 px-1 text-center text-[11px] leading-tight text-slate-700"
            style={{ transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`, pointerEvents: "all" }}
          >
            {centerLabel}
          </div>
        )}
        {ends.map((e, i) => (
          <div
            key={i}
            className="absolute text-[11px] text-slate-600"
            style={{ transform: `translate(-50%, -50%) translate(${e.at.x}px, ${e.at.y}px)` }}
          >
            {e.text}
          </div>
        ))}
      </EdgeLabelRenderer>
    </>
  );
}
