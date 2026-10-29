"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import clsx from "clsx";
import {
  ArrowLeft, Download, Eye, EyeOff, LayoutGrid, Maximize, MessageSquarePlus, Plus, Redo2, Trash2, Undo2,
} from "lucide-react";
import { useProjects } from "@/lib/store/projects";
import { useHydrated } from "@/hooks/useHydrated";
import type { Diagram, DiagramType, ElementKind, RelationshipKind } from "@/lib/uml/types";
import { DIAGRAM_TYPES, DIAGRAM_TYPE_LABELS } from "@/lib/uml/types";
import {
  DEFAULT_RELATIONSHIP, ELEMENT_KINDS_BY_DIAGRAM, ELEMENT_KIND_LABELS, RELATIONSHIP_KINDS_BY_DIAGRAM, RELATIONSHIP_KIND_LABELS,
} from "@/lib/uml/rules";
import { validateDiagram, summarize } from "@/lib/uml/validate";
import { autoLayout } from "@/lib/uml/layout";
import { createElement, createRelationship } from "@/lib/uml/factory";
import { toPlantUml } from "@/lib/uml/plantuml";
import { downloadDataUrl, downloadText, serializeProject, slug } from "@/lib/export";
import { Button, TextField, inputCls } from "@/components/ui/fields";
import { FlowCanvas, type CanvasHandle } from "./FlowCanvas";
import { SequenceView, type SequenceHandle } from "./SequenceView";
import { PropertiesPanel } from "./PropertiesPanel";
import { ValidationPanel } from "./ValidationPanel";
import { AiPanel } from "./AiPanel";
import type { Selection } from "./types";

type Tab = "properties" | "validation" | "ai";

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const hydrated = useHydrated();
  const project = useProjects((s) => s.projects.find((p) => p.id === projectId));
  const store = useProjects();
  const history = useProjects((s) => s.history);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("properties");
  const [showMembers, setShowMembers] = useState(true);
  const [relTool, setRelTool] = useState<RelationshipKind>("association");
  const [newType, setNewType] = useState<DiagramType>("class");
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canvasRef = useRef<CanvasHandle>(null);
  const seqRef = useRef<SequenceHandle>(null);

  const diagram = project?.diagrams.find((d) => d.id === activeId) ?? project?.diagrams[0];

  useEffect(() => {
    if (diagram && diagram.id !== activeId) setActiveId(diagram.id);
  }, [diagram, activeId]);
  useEffect(() => {
    setSelection(null);
    if (diagram) setRelTool(DEFAULT_RELATIONSHIP[diagram.type]);
  }, [diagram?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const issues = useMemo(() => (diagram ? validateDiagram(diagram) : []), [diagram]);
  const counts = summarize(issues);

  const commit = useCallback((d: Diagram) => store.commitDiagram(projectId, d), [store, projectId]);
  const undo = useCallback(() => diagram && store.undo(projectId, diagram.id), [store, projectId, diagram]);
  const redo = useCallback(() => diagram && store.redo(projectId, diagram.id), [store, projectId, diagram]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!hydrated) return <div className="p-8 text-sm text-slate-500">Loading…</div>;
  if (!project) {
    return (
      <div className="p-8 text-sm">
        Project not found. <Link className="text-blue-700 underline" href="/">Back to projects</Link>
      </div>
    );
  }

  const h = diagram ? history[diagram.id] : undefined;

  const addElement = (kind: ElementKind) => {
    if (!diagram) return;
    if (diagram.type === "sequence") {
      const el = createElement(kind, kind === "lifeline" ? `object${diagram.elements.length + 1}` : undefined);
      commit({ ...diagram, elements: [...diagram.elements, el] });
      setSelection({ type: "element", id: el.id });
      setTab("properties");
      return;
    }
    canvasRef.current?.addElement(kind);
    setTab("properties");
  };

  const addMessage = () => {
    if (!diagram) return;
    const lifelines = diagram.elements.filter((e) => e.kind === "lifeline");
    if (lifelines.length === 0) return setNotice("Add at least one lifeline first.");
    const fromIdx = selection?.type === "element" ? Math.max(0, lifelines.findIndex((l) => l.id === selection.id)) : 0;
    const from = lifelines[fromIdx];
    const to = lifelines[fromIdx + 1] ?? lifelines[fromIdx];
    const rel = { ...createRelationship("message", from.id, to.id), label: "message()" };
    commit({ ...diagram, relationships: [...diagram.relationships, rel] });
    setSelection({ type: "relationship", id: rel.id });
    setTab("properties");
  };

  const exportImage = async (format: "png" | "svg") => {
    if (!diagram) return;
    setExportOpen(false);
    const url = diagram.type === "sequence" ? await seqRef.current?.exportImage(format) : await canvasRef.current?.exportImage(format);
    if (url) downloadDataUrl(url, `${slug(diagram.name)}.${format}`);
    else setNotice("Nothing to export yet.");
  };

  const exportPlantUml = () => {
    if (!diagram) return;
    setExportOpen(false);
    const { text, losses } = toPlantUml(diagram);
    downloadText(text, `${slug(diagram.name)}.puml`);
    if (losses.length) setNotice(`PlantUML export note: ${losses.join(" ")}`);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
        <Link href="/" className="rounded p-1 text-slate-600 hover:bg-slate-100" aria-label="Back to projects"><ArrowLeft size={18} /></Link>
        <TextField ariaLabel="Project name" className="!w-64 border-transparent font-semibold hover:border-slate-300" value={project.name} onCommit={(name) => name.trim() && store.updateProject(project.id, { name: name.trim() })} />
        <span className="text-[12px] text-slate-400">Autosaved locally</span>
        <div className="ml-auto flex items-center gap-2">
          <Button title="Export project JSON" onClick={() => downloadText(serializeProject(project), `${slug(project.name)}.uml.json`, "application/json")}>
            <Download size={14} /> Project JSON
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-3">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Diagrams</h2>
            <ul className="space-y-0.5" data-testid="diagram-list">
              {project.diagrams.map((d) => (
                <li key={d.id} className="group flex items-center">
                  <button
                    onClick={() => setActiveId(d.id)}
                    className={clsx("flex-1 truncate rounded px-2 py-1.5 text-left text-[13px]", d.id === diagram?.id ? "bg-blue-50 font-medium text-blue-800" : "text-slate-700 hover:bg-slate-50")}
                  >
                    {d.name}
                    <span className="block text-[10px] text-slate-400">{DIAGRAM_TYPE_LABELS[d.type]}</span>
                  </button>
                  <button
                    aria-label={`Delete ${d.name}`}
                    className="hidden p-1 text-slate-400 hover:text-red-600 group-hover:block"
                    onClick={() => confirm(`Delete diagram "${d.name}"?`) && store.deleteDiagram(project.id, d.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1.5">
              <select aria-label="New diagram type" className={inputCls} value={newType} onChange={(e) => setNewType(e.target.value as DiagramType)}>
                {DIAGRAM_TYPES.map((t) => <option key={t} value={t}>{DIAGRAM_TYPE_LABELS[t]}</option>)}
              </select>
              <div className="flex gap-1">
                <Button className="flex-1" onClick={() => setActiveId(store.addDiagram(project.id, newType))}><Plus size={14} /> Blank</Button>
                <Button className="flex-1" onClick={() => setActiveId(store.addDiagram(project.id, newType, undefined, true))}>Example</Button>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Requirements</h2>
            <p className="mb-1.5 text-[11px] text-slate-400">Shared context for AI generation. Use IDs like REQ-001.</p>
            <TextField
              ariaLabel="Project requirements"
              multiline
              className="min-h-0 flex-1 resize-none font-mono text-[12px]"
              value={project.requirements}
              placeholder="REQ-001: A customer must authenticate before placing an order."
              onCommit={(requirements) => store.updateProject(project.id, { requirements })}
            />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {diagram ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white px-2 py-1.5" data-testid="toolbar">
                {ELEMENT_KINDS_BY_DIAGRAM[diagram.type].map((k) => (
                  <button
                    key={k}
                    draggable={diagram.type !== "sequence"}
                    onDragStart={(e) => e.dataTransfer.setData("application/uml-kind", k)}
                    onClick={() => addElement(k)}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                    title={`Add ${ELEMENT_KIND_LABELS[k]} (click or drag onto canvas)`}
                  >
                    + {ELEMENT_KIND_LABELS[k]}
                  </button>
                ))}
                {diagram.type === "sequence" ? (
                  <Button onClick={addMessage} title="Add message"><MessageSquarePlus size={14} /> Message</Button>
                ) : (
                  <label className="ml-1 flex items-center gap-1 text-[12px] text-slate-600">
                    Connect as
                    <select aria-label="Relationship tool" className={`${inputCls} !w-auto py-0.5`} value={relTool} onChange={(e) => setRelTool(e.target.value as RelationshipKind)}>
                      {RELATIONSHIP_KINDS_BY_DIAGRAM[diagram.type].filter((k) => k !== "anchor").map((k) => <option key={k} value={k}>{RELATIONSHIP_KIND_LABELS[k]}</option>)}
                    </select>
                  </label>
                )}
                <div className="mx-1 h-5 w-px bg-slate-200" />
                <Button variant="ghost" title="Undo (Ctrl+Z)" onClick={undo} disabled={!h?.past.length}><Undo2 size={15} /></Button>
                <Button variant="ghost" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!h?.future.length}><Redo2 size={15} /></Button>
                {diagram.type !== "sequence" && (
                  <>
                    <Button variant="ghost" title="Auto layout top-to-bottom" onClick={() => commit(autoLayout({ ...diagram, layout: { direction: "TB" } }))}><LayoutGrid size={15} /> TB</Button>
                    <Button variant="ghost" title="Auto layout left-to-right" onClick={() => commit(autoLayout({ ...diagram, layout: { direction: "LR" } }))}><LayoutGrid size={15} className="rotate-90" /> LR</Button>
                    <Button variant="ghost" title="Fit to screen" onClick={() => canvasRef.current?.fit()}><Maximize size={15} /></Button>
                  </>
                )}
                {diagram.type === "class" && (
                  <Button variant="ghost" title={showMembers ? "Simplified view (hide members)" : "Detailed view (show members)"} onClick={() => setShowMembers((v) => !v)}>
                    {showMembers ? <EyeOff size={15} /> : <Eye size={15} />}
                  </Button>
                )}
                <div className="relative ml-auto">
                  <Button onClick={() => setExportOpen((v) => !v)} title="Export diagram"><Download size={14} /> Export</Button>
                  {exportOpen && (
                    <div className="absolute right-0 z-20 mt-1 w-44 rounded border border-slate-200 bg-white py-1 text-[13px] shadow-lg">
                      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => exportImage("png")}>PNG image</button>
                      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={() => exportImage("svg")}>SVG image</button>
                      <button className="block w-full px-3 py-1.5 text-left hover:bg-slate-50" onClick={exportPlantUml}>PlantUML (.puml)</button>
                      <button
                        className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                        onClick={() => {
                          setExportOpen(false);
                          downloadText(JSON.stringify(diagram, null, 2), `${slug(diagram.name)}.json`, "application/json");
                        }}
                      >
                        Diagram model (JSON)
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                {diagram.type === "sequence" ? (
                  <SequenceView ref={seqRef} diagram={diagram} issues={issues} selection={selection} onSelect={(s) => { setSelection(s); if (s) setTab("properties"); }} />
                ) : (
                  <ReactFlowProvider key={diagram.id}>
                    <FlowCanvas
                      ref={canvasRef}
                      diagram={diagram}
                      issues={issues}
                      selection={selection}
                      relationshipTool={relTool}
                      showMembers={showMembers}
                      onSelect={(s) => { setSelection(s); if (s) setTab("properties"); }}
                      onCommit={commit}
                    />
                  </ReactFlowProvider>
                )}
                {notice && (
                  <div className="absolute bottom-3 left-1/2 z-10 max-w-lg -translate-x-1/2 rounded bg-slate-800 px-3 py-2 text-[12px] text-white shadow">{notice}</div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Create a diagram from the left panel to get started.</div>
          )}
        </main>

        {diagram && (
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white">
            <div className="flex border-b border-slate-200 text-[13px]">
              {([
                ["properties", "Properties"],
                ["validation", `Validation${counts.errors + counts.warnings ? ` (${counts.errors}/${counts.warnings})` : ""}`],
                ["ai", "AI Assistant"],
              ] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    "flex-1 border-b-2 px-2 py-2",
                    tab === t ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900",
                    t === "validation" && counts.errors > 0 && tab !== t && "text-red-600",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "properties" && <PropertiesPanel diagram={diagram} selection={selection} onCommit={commit} onSelect={setSelection} />}
              {tab === "validation" && <ValidationPanel issues={issues} onSelect={(s) => { setSelection(s); setTab("properties"); }} />}
              {tab === "ai" && <AiPanel diagram={diagram} requirements={project.requirements} onCommit={commit} />}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
