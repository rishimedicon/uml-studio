import dagre from "@dagrejs/dagre";
import type { Diagram, UmlElement } from "./types";
import { formatAttribute, formatOperation } from "./format";

/** Approximate rendered size of an element, used for layout and edge geometry. */
export function estimateSize(el: UmlElement): { width: number; height: number } {
  const charW = 7.2;
  switch (el.kind) {
    case "class":
    case "interface": {
      const lines = [
        el.name,
        ...el.attributes.map(formatAttribute),
        ...el.operations.map(formatOperation),
      ];
      const width = Math.max(160, Math.min(380, Math.max(...lines.map((l) => l.length)) * charW + 28));
      const header = el.kind === "interface" || el.stereotype ? 46 : 32;
      const height = header + Math.max(1, el.attributes.length) * 20 + 10 + Math.max(1, el.operations.length) * 20 + 10;
      return { width, height };
    }
    case "enumeration":
      return {
        width: Math.max(150, Math.max(el.name.length, ...el.literals.map((l) => l.length)) * charW + 28),
        height: 50 + Math.max(1, el.literals.length) * 20 + 10,
      };
    case "actor":
      return { width: 90, height: 110 };
    case "useCase":
      return { width: Math.max(150, Math.min(240, el.name.length * 7.5 + 50)), height: 64 };
    case "lifeline":
      return { width: 140, height: 40 };
    case "initial":
    case "final":
      return { width: 30, height: 30 };
    case "decision":
    case "merge":
      return { width: 44, height: 44 };
    case "fork":
    case "join":
      return { width: 140, height: 10 };
    case "action":
      return { width: Math.max(130, Math.min(260, el.name.length * 7.5 + 36)), height: 48 };
    case "note":
      return { width: 180, height: Math.max(60, Math.ceil(el.name.length / 24) * 18 + 24) };
  }
}

/**
 * Computes positions with a layered layout. When `onlyMissing` is true, elements that
 * already have positions keep them (preserving manual edits) and only new ones are placed.
 */
export function autoLayout(diagram: Diagram, opts: { onlyMissing?: boolean } = {}): Diagram {
  if (diagram.type === "sequence") return diagram;
  const missing = diagram.elements.filter((e) => !e.position);
  if (opts.onlyMissing && missing.length === 0) return diagram;
  if (opts.onlyMissing && missing.length < diagram.elements.length) {
    return placeMissing(diagram);
  }

  if (diagram.type === "useCase") return layoutUseCase(diagram);

  const g = new dagre.graphlib.Graph({ multigraph: true });
  const dir = diagram.layout.direction;
  g.setGraph({ rankdir: dir, nodesep: diagram.type === "activity" ? 50 : 70, ranksep: diagram.type === "activity" ? 50 : 90, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const el of diagram.elements) {
    const { width, height } = estimateSize(el);
    g.setNode(el.id, { width, height });
  }
  for (const rel of diagram.relationships) {
    if (!g.hasNode(rel.sourceId) || !g.hasNode(rel.targetId)) continue;
    // Point hierarchy edges downward: parents above children.
    const reverse = rel.kind === "generalization" || rel.kind === "realization";
    const [from, to] = reverse ? [rel.targetId, rel.sourceId] : [rel.sourceId, rel.targetId];
    g.setEdge(from, to, { minlen: 1, weight: rel.kind === "anchor" ? 0 : 1 }, rel.id);
  }
  dagre.layout(g);
  return {
    ...diagram,
    elements: diagram.elements.map((el) => {
      const n = g.node(el.id);
      return { ...el, position: { x: Math.round(n.x - n.width / 2), y: Math.round(n.y - n.height / 2) } };
    }),
  };
}

function placeMissing(diagram: Diagram): Diagram {
  const placed = diagram.elements.filter((e) => e.position);
  const maxY = Math.max(...placed.map((e) => e.position!.y + estimateSize(e).height));
  let x = Math.min(...placed.map((e) => e.position!.x));
  const y = maxY + 80;
  return {
    ...diagram,
    elements: diagram.elements.map((el) => {
      if (el.position) return el;
      const pos = { x, y };
      x += estimateSize(el).width + 60;
      return { ...el, position: pos };
    }),
  };
}

/** Spreads `items` vertically around their preferred centre without overlap. */
function stack(items: { id: string; want: number; h: number }[], gap: number): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.want - b.want);
  const out = new Map<string, number>();
  let cursor = -Infinity;
  for (const it of sorted) {
    const top = Math.max(it.want - it.h / 2, cursor);
    out.set(it.id, top);
    cursor = top + it.h + gap;
  }
  return out;
}

/**
 * Conventional use case layout: use cases inside the system boundary (base use cases in the
 * first column, included/extending ones in the second), primary actors on the left and
 * secondary/system actors on the right.
 */
function layoutUseCase(diagram: Diagram): Diagram {
  const els = diagram.elements;
  const byId = new Map(els.map((e) => [e.id, e]));
  const useCases = els.filter((e) => e.kind === "useCase");
  const actors = els.filter((e) => e.kind === "actor");
  const others = els.filter((e) => e.kind !== "useCase" && e.kind !== "actor");
  const rels = diagram.relationships;

  const secondaryUc = new Set<string>();
  for (const r of rels) {
    if (r.kind === "include" && byId.get(r.targetId)?.kind === "useCase") secondaryUc.add(r.targetId);
    if (r.kind === "extend" && byId.get(r.sourceId)?.kind === "useCase") secondaryUc.add(r.sourceId);
  }
  const assoc = new Map<string, string[]>();
  for (const r of rels) {
    if (r.kind !== "association") continue;
    const [a, u] = byId.get(r.sourceId)?.kind === "actor" ? [r.sourceId, r.targetId] : [r.targetId, r.sourceId];
    if (byId.get(a)?.kind !== "actor" || byId.get(u)?.kind !== "useCase") continue;
    assoc.set(a, [...(assoc.get(a) ?? []), u]);
  }
  const isRight = (a: UmlElement) =>
    /system|external/i.test(a.stereotype ?? "") ||
    ((assoc.get(a.id) ?? []).length > 0 && (assoc.get(a.id) ?? []).every((u) => secondaryUc.has(u)));
  const leftActors = actors.filter((a) => !isRight(a));
  const rightActors = actors.filter(isRight);

  const rank = (u: UmlElement) => {
    const i = leftActors.findIndex((a) => (assoc.get(a.id) ?? []).includes(u.id));
    return i === -1 ? leftActors.length : i;
  };
  const col1 = useCases.filter((u) => !secondaryUc.has(u.id)).sort((a, b) => rank(a) - rank(b));
  const col2 = useCases.filter((u) => secondaryUc.has(u.id));
  const ucW = Math.max(150, ...useCases.map((u) => estimateSize(u).width));
  const rowH = 64 + 36;
  const top = 80;
  const leftX = 40;
  const col1X = leftX + 90 + 140;
  const col2X = col1X + ucW + 80;
  const pos = new Map<string, { x: number; y: number }>();
  col1.forEach((u, i) => pos.set(u.id, { x: col1X + (ucW - estimateSize(u).width) / 2, y: top + i * rowH }));

  const centre = (ids: string[], fallback: number) => {
    const ys = ids.map((id) => pos.get(id)).filter(Boolean).map((p) => p!.y + 32);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : fallback;
  };
  const neighbours = (id: string) =>
    rels.filter((r) => r.sourceId === id || r.targetId === id).map((r) => (r.sourceId === id ? r.targetId : r.sourceId));
  const col2Y = stack(col2.map((u, i) => ({ id: u.id, want: centre(neighbours(u.id), top + 32 + i * rowH), h: 64 })), 36);
  col2.forEach((u) => pos.set(u.id, { x: col2X + (ucW - estimateSize(u).width) / 2, y: Math.max(top, col2Y.get(u.id)!) }));

  const placeActors = (list: UmlElement[], x: number) => {
    const ys = stack(list.map((a, i) => ({ id: a.id, want: centre(assoc.get(a.id) ?? [], top + 55 + i * 150), h: 110 })), 40);
    list.forEach((a) => pos.set(a.id, { x, y: Math.max(top - 20, ys.get(a.id)!) }));
  };
  placeActors(leftActors, leftX);
  placeActors(rightActors, (col2.length ? col2X + ucW : col1X + ucW) + 140);

  const maxY = Math.max(top, ...[...pos.values()].map((p) => p.y + 110));
  others.forEach((o, i) => pos.set(o.id, o.position ?? { x: col1X + i * 220, y: maxY + 60 }));
  return { ...diagram, elements: els.map((el) => ({ ...el, position: pos.get(el.id) ?? el.position })) };
}
