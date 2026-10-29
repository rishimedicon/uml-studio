import type { InternalNode, Node } from "@xyflow/react";

/** Point where the line from the node center toward `target` exits the node's rectangle (or ellipse/diamond). */
export function boundaryPoint(node: InternalNode<Node>, target: { x: number; y: number }) {
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  const cx = node.internals.positionAbsolute.x + w / 2;
  const cy = node.internals.positionAbsolute.y + h / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const shape = (node.data as { shape?: string })?.shape ?? "rect";
  if (shape === "ellipse" || shape === "circle") {
    const a = w / 2;
    const b = h / 2;
    const t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
    return { x: cx + dx * t, y: cy + dy * t };
  }
  if (shape === "diamond") {
    const t = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2));
    return { x: cx + dx * t, y: cy + dy * t };
  }
  const sx = Math.abs(dx) > 0 ? w / 2 / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0 ? h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function nodeCenter(node: InternalNode<Node>) {
  return {
    x: node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
    y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2,
  };
}

export function edgeEndpoints(source: InternalNode<Node>, target: InternalNode<Node>) {
  const sc = nodeCenter(source);
  const tc = nodeCenter(target);
  return { s: boundaryPoint(source, tc), t: boundaryPoint(target, sc) };
}
