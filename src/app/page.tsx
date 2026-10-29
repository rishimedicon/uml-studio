"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, FolderOpen, Plus, Search, Trash2, Upload, Workflow } from "lucide-react";
import { useProjects } from "@/lib/store/projects";
import { useHydrated } from "@/hooks/useHydrated";
import { downloadText, parseProjectFile, serializeProject, slug } from "@/lib/export";
import { DIAGRAM_TYPE_LABELS } from "@/lib/uml/types";
import { Button, Field, inputCls } from "@/components/ui/fields";

export default function Dashboard() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { projects, createProject, deleteProject, duplicateProject, importProject } = useProjects();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [withExamples, setWithExamples] = useState(false);
  const [query, setQuery] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = projects.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase()));

  const onImport = async (file: File) => {
    setImportError(null);
    try {
      const id = importProject(parseProjectFile(await file.text()));
      router.push(`/projects/${id}`);
    } catch (e) {
      setImportError(`Could not import file: ${e instanceof Error ? e.message.slice(0, 200) : "invalid format"}`);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center gap-3">
        <div className="rounded-lg bg-blue-600 p-2 text-white"><Workflow size={22} /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">UML Studio AI</h1>
          <p className="text-sm text-slate-500">From natural-language requirements to validated, editable UML models.</p>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <section className="h-fit space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">New project</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const id = createProject(name.trim(), description.trim(), withExamples);
              router.push(`/projects/${id}`);
            }}
          >
            <Field label="Name">
              <input aria-label="Project name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Online Shop" />
            </Field>
            <Field label="Description">
              <textarea aria-label="Project description" className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-slate-700">
              <input type="checkbox" checked={withExamples} onChange={(e) => setWithExamples(e.target.checked)} />
              Start with example diagrams
            </label>
            <Button type="submit" variant="primary" className="w-full" disabled={!name.trim()}><Plus size={14} /> Create project</Button>
          </form>
          <div className="border-t border-slate-100 pt-3">
            <Button className="w-full" onClick={() => fileRef.current?.click()}><Upload size={14} /> Import project (.json)</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            {importError && <p className="mt-2 text-[12px] text-red-700">{importError}</p>}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Projects</h2>
            <div className="relative w-64">
              <Search size={14} className="absolute left-2 top-2 text-slate-400" />
              <input aria-label="Search projects" className={`${inputCls} pl-7`} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {!hydrated ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              {projects.length === 0 ? "No projects yet. Create one to start modeling." : "No projects match your search."}
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((p) => (
                <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <Link href={`/projects/${p.id}`} className="block">
                    <h3 className="font-semibold text-slate-900 hover:text-blue-700">{p.name}</h3>
                    {p.description && <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-500">{p.description}</p>}
                    <p className="mt-2 text-[12px] text-slate-500">
                      {p.diagrams.length} diagram{p.diagrams.length === 1 ? "" : "s"}
                      {p.diagrams.length > 0 && ` · ${[...new Set(p.diagrams.map((d) => DIAGRAM_TYPE_LABELS[d.type].replace(" Diagram", "")))].join(", ")}`}
                    </p>
                    <p className="text-[11px] text-slate-400">Updated {new Date(p.updatedAt).toLocaleString()}</p>
                  </Link>
                  <div className="mt-3 flex gap-1">
                    <Link href={`/projects/${p.id}`} className="inline-flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700"><FolderOpen size={14} /> Open</Link>
                    <Button variant="ghost" title="Duplicate" onClick={() => duplicateProject(p.id)}><Copy size={14} /></Button>
                    <Button variant="ghost" title="Export JSON" onClick={() => downloadText(serializeProject(p), `${slug(p.name)}.uml.json`, "application/json")}><Download size={14} /></Button>
                    <Button variant="ghost" title="Delete" className="ml-auto text-red-600" onClick={() => confirm(`Delete project "${p.name}"? This cannot be undone.`) && deleteProject(p.id)}><Trash2 size={14} /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-[12px] text-slate-400">Projects are stored privately in this browser and autosaved. Export to JSON to back up or share.</p>
        </section>
      </div>
    </main>
  );
}
