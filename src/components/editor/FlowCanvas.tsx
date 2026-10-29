"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  useNodesInitialized,
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  getNodesBounds,
  getViewportForBounds,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { Diagram, ElementKind, RelationshipKind, ValidationIssue } from "@/lib/uml/types";
import { createElement, createRelationship } from "@/lib/uml/factory";
import { estimateSize } from "@/lib/uml/layout";
import { exportElementImage } from "@/lib/export";
import { UmlNode, SystemBoundaryNode, shapeOf, type UmlNodeType } from "./nodes";
import { UmlEdge, type UmlEdgeType } from "./UmlEdge";
import type { Selection } from "./types";

const nodeTypes = { uml: UmlNode, boundary: SystemBoundaryNode };
const edgeTypes = { uml: UmlEdge };
const BOUNDARY_ID = "__system_boundary__";

export interface CanvasHandle {
  addElement: (kind: ElementKind) => void;
  exportImage: (format: "png" | "svg") => Promise<string | null>;
  fit: () => void;
}

interface Props {
  diagram: Diagram;
  issues: ValidationIssue[];
  selection: Selection;
  relationshipTool: RelationshipKind;
  showMembers: boolean;
  onSelect: (s: Selection) => void;
  onCommit: (d: Diagram) => void;
}

function issueLevel(issues: ValidationIssue[], key: "elementIds" | "relationshipIds", id: string) {
  let level: "error" | "warning" | undefined;
  for (const i of issues) {
    if (!i[key]?.includes(id)) continue;
    if (i.severity === "error") return "error";
    if (i.severity === "warning") level = "warning";
  }
  return level;
}

export const FlowCanvas = forwardRef<CanvasHandle, Props>(function FlowCanvas(
  { diagram, issues, selection, relationshipTool, showMembers, onSelect, onCommit },
  ref,
) {
  const rf = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);

  const derivedNodes = useMemo(() => {
    const nodes: Node[] = diagram.elements.map(
      (el, i): UmlNodeType => ({
        id: el.id,
        type: "uml",
        position: el.position ?? { x: 60 + (i % 5) * 220, y: 60 + Math.floor(i / 5) * 180 },
        data: { element: el, shape: shapeOf(el), issue: issueLevel(issues, "elementIds", el.id), showMembers },
        selected: selection?.type === "element" && selection.id === el.id,
      }),
    );
    if (diagram.type === "useCase") {
      const ucs = diagram.elements.filter((e) => e.kind === "useCase");
      if (ucs.length) {
        const boxes = ucs.map((u, i) => {
          const p = u.position ?? nodes[diagram.elements.indexOf(u)]?.position ?? { x: i * 10, y: 0 };
          const s = estimateSize(u);
          return { x1: p.x, y1: p.y, x2: p.x + s.width, y2: p.y + s.height };
        });
        const x = Math.min(...boxes.map((b) => b.x1)) - 30;
        const y = Math.min(...boxes.map((b) => b.y1)) - 50;
        const width = Math.max(...boxes.map((b) => b.x2)) - x + 30;
        const height = Math.max(...boxes.map((b) => b.y2)) - y + 30;
        nodes.unshift({
          id: BOUNDARY_ID,
          type: "boundary",
          position: { x, y },
          data: { label: diagram.systemName || "System", width, height },
          selectable: false,
          draggable: false,
          connectable: false,
          zIndex: -1,
        });
      }
    }
    return nodes;
  }, [diagram, issues, selection, showMembers]);

  const derivedEdges = useMemo(
    () =>
      diagram.relationships.map(
        (rel): UmlEdgeType => ({
          id: rel.id,
          type: "uml",
          source: rel.sourceId,
          target: rel.targetId,
          data: { rel, issue: issueLevel(issues, "relationshipIds", rel.id) },
          selected: selection?.type === "relationship" && selection.id === rel.id,
        }),
      ),
    [diagram.relationships, issues, selection],
  );

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(derivedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(derivedEdges);
  useEffect(() => setNodes(derivedNodes), [derivedNodes, setNodes]);
  useEffect(() => setEdges(derivedEdges), [derivedEdges, setEdges]);

  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;

  const fittedFor = useRef<string | null>(null);
  const nodesInitialized = useNodesInitialized();
  useEffect(() => {
    if (!nodesInitialized || fittedFor.current === diagram.id) return;
    fittedFor.current = diagram.id;
    rf.fitView({ padding: 0.15 });
  }, [nodesInitialized, diagram.id, rf]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => onNodesChangeBase(changes.filter((c) => c.type !== "remove")),
    [onNodesChangeBase],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, _node: Node, dragged: Node[]) => {
      const moved = new Map(dragged.map((n) => [n.id, n.position]));
      const d = diagramRef.current;
      onCommit({
        ...d,
        elements: d.elements.map((el) => {
          const p = moved.get(el.id);
          return p ? { ...el, position: { x: Math.round(p.x), y: Math.round(p.y) } } : el;
        }),
      });
    },
    [onCommit],
  );

  const onDelete = useCallback(
    ({ nodes: dn, edges: de }: { nodes: Node[]; edges: Edge[] }) => {
      const nodeIds = new Set(dn.map((n) => n.id));
      const edgeIds = new Set(de.map((e) => e.id));
      if (!nodeIds.size && !edgeIds.size) return;
      const d = diagramRef.current;
      onCommit({
        ...d,
        elements: d.elements.filter((e) => !nodeIds.has(e.id)),
        relationships: d.relationships.filter(
          (r) => !edgeIds.has(r.id) && !nodeIds.has(r.sourceId) && !nodeIds.has(r.targetId),
        ),
      });
      onSelect(null);
    },
    [onCommit, onSelect],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === BOUNDARY_ID || c.target === BOUNDARY_ID) return;
      const d = diagramRef.current;
      const src = d.elements.find((e) => e.id === c.source);
      const kind: RelationshipKind = src?.kind === "note" ? "anchor" : relationshipTool;
      const rel = createRelationship(kind, c.source, c.target);
      onCommit({ ...d, relationships: [...d.relationships, rel] });
      onSelect({ type: "relationship", id: rel.id });
    },
    [onCommit, onSelect, relationshipTool],
  );

  const addElementAt = useCallback(
    (kind: ElementKind, pos: { x: number; y: number }) => {
      const d = diagramRef.current;
      const el = createElement(kind);
      const size = estimateSize(el);
      el.position = { x: Math.round(pos.x - size.width / 2), y: Math.round(pos.y - size.height / 2) };
      onCommit({ ...d, elements: [...d.elements, el] });
      onSelect({ type: "element", id: el.id });
    },
    [onCommit, onSelect],
  );

  useImperativeHandle(
    ref,
    () => ({
      addElement: (kind) => {
        const rect = wrapper.current?.getBoundingClientRect();
        const center = rect
          ? rf.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
          : { x: 200, y: 200 };
        const jitter = () => Math.round((Math.random() - 0.5) * 80);
        addElementAt(kind, { x: center.x + jitter(), y: center.y + jitter() });
      },
      exportImage: async (format) => {
        const viewport = wrapper.current?.querySelector<HTMLElement>(".react-flow__viewport");
        const all = rf.getNodes();
        if (!viewport || all.length === 0) return null;
        const bounds = getNodesBounds(all);
        const pad = 40;
        const width = Math.ceil(bounds.width + pad * 2);
        const height = Math.ceil(bounds.height + pad * 2);
        const vp = getViewportForBounds(bounds, width, height, 0.1, 2, pad);
        return exportElementImage(viewport, format, {
          width,
          height,
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
        });
      },
      fit: () => rf.fitView({ padding: 0.15, duration: 200 }),
    }),
    [rf, addElementAt],
  );

  return (
    <div
      ref={wrapper}
      className="h-full w-full"
      data-testid="flow-canvas"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        const kind = e.dataTransfer.getData("application/uml-kind") as ElementKind;
        if (!kind) return;
        e.preventDefault();
        addElementAt(kind, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onDelete={onDelete}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        onNodeClick={(_, n) => n.id !== BOUNDARY_ID && onSelect({ type: "element", id: n.id })}
        onEdgeClick={(_, e) => onSelect({ type: "relationship", id: e.id })}
        onPaneClick={() => onSelect(null)}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.1}
        maxZoom={2.5}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-slate-50" nodeColor="#cbd5e1" />
      </ReactFlow>
    </div>
  );
});
