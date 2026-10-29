"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Repeat, Trash2 } from "lucide-react";
import type { Attribute, Diagram, MessageType, Operation, Relationship, RelationshipKind, UmlElement, Visibility } from "@/lib/uml/types";
import { ELEMENT_KIND_LABELS, RELATIONSHIP_KINDS_BY_DIAGRAM, RELATIONSHIP_KIND_LABELS } from "@/lib/uml/rules";
import { newId } from "@/lib/uml/factory";
import { Button, Field, TextField, inputCls } from "@/components/ui/fields";
import type { Selection } from "./types";

interface Props {
  diagram: Diagram;
  selection: Selection;
  onCommit: (d: Diagram) => void;
  onSelect: (s: Selection) => void;
}

const VIS: Visibility[] = ["+", "-", "#", "~"];
const VIS_LABEL: Record<Visibility, string> = { "+": "+ public", "-": "- private", "#": "# protected", "~": "~ package" };

export function parseParams(text: string) {
  return text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [name, ...rest] = p.split(":");
      return { name: name.trim(), type: rest.join(":").trim() };
    });
}

export function PropertiesPanel({ diagram, selection, onCommit, onSelect }: Props) {
  const el = selection?.type === "element" ? diagram.elements.find((e) => e.id === selection.id) : undefined;
  const rel = selection?.type === "relationship" ? diagram.relationships.find((r) => r.id === selection.id) : undefined;

  const updateEl = (patch: Partial<UmlElement>) =>
    el && onCommit({ ...diagram, elements: diagram.elements.map((e) => (e.id === el.id ? ({ ...e, ...patch } as UmlElement) : e)) });
  const updateRel = (patch: Partial<Relationship>) =>
    rel && onCommit({ ...diagram, relationships: diagram.relationships.map((r) => (r.id === rel.id ? { ...r, ...patch } : r)) });

  if (el) return <ElementProps el={el} diagram={diagram} update={updateEl} onCommit={onCommit} onSelect={onSelect} />;
  if (rel) return <RelationshipProps rel={rel} diagram={diagram} update={updateRel} onCommit={onCommit} onSelect={onSelect} />;

  return (
    <div className="space-y-3 p-3">
      <h3 className="text-sm font-semibold text-slate-800">Diagram</h3>
      <Field label="Name">
        <TextField value={diagram.name} onCommit={(name) => onCommit({ ...diagram, name })} />
      </Field>
      {diagram.type === "useCase" && (
        <Field label="System boundary">
          <TextField value={diagram.systemName ?? ""} onCommit={(systemName) => onCommit({ ...diagram, systemName })} />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-600">
        <div className="rounded bg-slate-50 p-2">Elements: <b>{diagram.elements.length}</b></div>
        <div className="rounded bg-slate-50 p-2">Relationships: <b>{diagram.relationships.length}</b></div>
        <div className="rounded bg-slate-50 p-2">Model version: <b>{diagram.modelVersion}</b></div>
        <div className="rounded bg-slate-50 p-2">Updated: <b>{new Date(diagram.updatedAt).toLocaleTimeString()}</b></div>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-500">
        Select an element or relationship to edit its properties. Drag from a node&apos;s edge handle to another node to connect them
        using the relationship type chosen in the toolbar.
      </p>
    </div>
  );
}

function ElementProps({ el, diagram, update, onCommit, onSelect }: { el: UmlElement; diagram: Diagram; update: (p: Partial<UmlElement>) => void; onCommit: (d: Diagram) => void; onSelect: (s: Selection) => void }) {
  const remove = () => {
    onCommit({
      ...diagram,
      elements: diagram.elements.filter((e) => e.id !== el.id),
      relationships: diagram.relationships.filter((r) => r.sourceId !== el.id && r.targetId !== el.id),
    });
    onSelect(null);
  };
  const duplicate = () => {
    const copy = JSON.parse(JSON.stringify(el)) as UmlElement;
    copy.id = newId();
    copy.name = el.name ? `${el.name}Copy` : el.name;
    if (copy.position) copy.position = { x: copy.position.x + 40, y: copy.position.y + 40 };
    onCommit({ ...diagram, elements: [...diagram.elements, copy] });
    onSelect({ type: "element", id: copy.id });
  };
  const moveLifeline = (dir: -1 | 1) => {
    const els = [...diagram.elements];
    const i = els.findIndex((e) => e.id === el.id);
    const j = i + dir;
    if (j < 0 || j >= els.length) return;
    [els[i], els[j]] = [els[j], els[i]];
    onCommit({ ...diagram, elements: els });
  };
  const hasName = !["initial", "final", "fork", "join"].includes(el.kind);

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{ELEMENT_KIND_LABELS[el.kind]}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" onClick={duplicate} title="Duplicate">Duplicate</Button>
          <Button variant="danger" onClick={remove} title="Delete element"><Trash2 size={14} /></Button>
        </div>
      </div>
      {hasName && (
        <Field label={el.kind === "note" ? "Text" : el.kind === "decision" || el.kind === "merge" ? "Label (optional)" : "Name"}>
          <TextField ariaLabel="Element name" value={el.name} multiline={el.kind === "note"} onCommit={(name) => update({ name })} />
        </Field>
      )}
      {(el.kind === "class" || el.kind === "actor" || el.kind === "useCase") && (
        <Field label="Stereotype">
          <TextField value={el.stereotype ?? ""} placeholder="e.g. entity, service, system" onCommit={(s) => update({ stereotype: s || undefined })} />
        </Field>
      )}
      {el.kind === "class" && (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={!!el.isAbstract} onChange={(e) => update({ isAbstract: e.target.checked })} /> Abstract class
        </label>
      )}
      {(el.kind === "class" || el.kind === "interface") && (
        <>
          <AttributesEditor attrs={el.attributes} onChange={(attributes) => update({ attributes })} />
          <OperationsEditor ops={el.operations} onChange={(operations) => update({ operations })} />
        </>
      )}
      {el.kind === "enumeration" && (
        <Field label="Literals (one per line)">
          <TextField multiline rows={5} value={el.literals.join("\n")} onCommit={(t) => update({ literals: t.split("\n").map((s) => s.trim()).filter(Boolean) })} />
        </Field>
      )}
      {el.kind === "lifeline" && (
        <>
          <Field label="Classifier (class)">
            <TextField value={el.classifier ?? ""} placeholder="e.g. OrderService" onCommit={(c) => update({ classifier: c || undefined })} />
          </Field>
          <Field label="Participant type">
            <select className={inputCls} value={el.participantType} onChange={(e) => update({ participantType: e.target.value as "actor" | "object" })}>
              <option value="object">Object</option>
              <option value="actor">Actor</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => moveLifeline(-1)} title="Move left"><ArrowLeft size={14} /> Left</Button>
            <Button onClick={() => moveLifeline(1)} title="Move right">Right <ArrowRight size={14} /></Button>
          </div>
        </>
      )}
      {el.kind !== "note" && (
        <Field label="Documentation">
          <TextField multiline value={el.documentation ?? ""} placeholder="Responsibility / description" onCommit={(d) => update({ documentation: d || undefined })} />
        </Field>
      )}
    </div>
  );
}

function AttributesEditor({ attrs, onChange }: { attrs: Attribute[]; onChange: (a: Attribute[]) => void }) {
  const set = (id: string, patch: Partial<Attribute>) => onChange(attrs.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Attributes</span>
        <Button variant="ghost" title="Add attribute" onClick={() => onChange([...attrs, { id: newId("at"), visibility: "-", name: "attribute", type: "String" }])}>
          <Plus size={14} /> Add
        </Button>
      </div>
      {attrs.map((a) => (
        <div key={a.id} className="flex items-center gap-1">
          <select aria-label="Visibility" className={`${inputCls} !w-12 px-1`} value={a.visibility} onChange={(e) => set(a.id, { visibility: e.target.value as Visibility })}>
            {VIS.map((v) => <option key={v} value={v} title={VIS_LABEL[v]}>{v}</option>)}
          </select>
          <TextField ariaLabel="Attribute name" className="flex-1" value={a.name} onCommit={(name) => set(a.id, { name })} />
          <TextField ariaLabel="Attribute type" className="w-24" value={a.type} placeholder="Type" onCommit={(type) => set(a.id, { type })} />
          <label title="Static" className="text-[11px] text-slate-500"><input type="checkbox" checked={!!a.isStatic} onChange={(e) => set(a.id, { isStatic: e.target.checked })} />S</label>
          <button aria-label="Remove attribute" className="text-slate-400 hover:text-red-600" onClick={() => onChange(attrs.filter((x) => x.id !== a.id))}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}

function OperationsEditor({ ops, onChange }: { ops: Operation[]; onChange: (o: Operation[]) => void }) {
  const set = (id: string, patch: Partial<Operation>) => onChange(ops.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Operations</span>
        <Button variant="ghost" title="Add operation" onClick={() => onChange([...ops, { id: newId("op"), visibility: "+", name: "operation", parameters: [], returnType: "void" }])}>
          <Plus size={14} /> Add
        </Button>
      </div>
      {ops.map((o) => (
        <div key={o.id} className="space-y-1 rounded border border-slate-200 p-1.5">
          <div className="flex items-center gap-1">
            <select aria-label="Visibility" className={`${inputCls} !w-12 px-1`} value={o.visibility} onChange={(e) => set(o.id, { visibility: e.target.value as Visibility })}>
              {VIS.map((v) => <option key={v} value={v} title={VIS_LABEL[v]}>{v}</option>)}
            </select>
            <TextField ariaLabel="Operation name" className="flex-1" value={o.name} onCommit={(name) => set(o.id, { name })} />
            <TextField ariaLabel="Return type" className="w-24" value={o.returnType} placeholder="Return" onCommit={(returnType) => set(o.id, { returnType })} />
            <button aria-label="Remove operation" className="text-slate-400 hover:text-red-600" onClick={() => onChange(ops.filter((x) => x.id !== o.id))}><Trash2 size={13} /></button>
          </div>
          <TextField
            ariaLabel="Parameters"
            value={o.parameters.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(", ")}
            placeholder="params, e.g. amount: Decimal, note: String"
            onCommit={(t) => set(o.id, { parameters: parseParams(t) })}
          />
          <div className="flex gap-3 text-[11px] text-slate-600">
            <label><input type="checkbox" checked={!!o.isStatic} onChange={(e) => set(o.id, { isStatic: e.target.checked })} /> static</label>
            <label><input type="checkbox" checked={!!o.isAbstract} onChange={(e) => set(o.id, { isAbstract: e.target.checked })} /> abstract</label>
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationshipProps({ rel, diagram, update, onCommit, onSelect }: { rel: Relationship; diagram: Diagram; update: (p: Partial<Relationship>) => void; onCommit: (d: Diagram) => void; onSelect: (s: Selection) => void }) {
  const remove = () => {
    onCommit({ ...diagram, relationships: diagram.relationships.filter((r) => r.id !== rel.id) });
    onSelect(null);
  };
  const move = (dir: -1 | 1) => {
    const rels = [...diagram.relationships];
    const i = rels.findIndex((r) => r.id === rel.id);
    let j = i + dir;
    while (j >= 0 && j < rels.length && rels[j].kind !== "message") j += dir;
    if (j < 0 || j >= rels.length) return;
    [rels[i], rels[j]] = [rels[j], rels[i]];
    onCommit({ ...diagram, relationships: rels });
  };
  const nameOf = (id: string) => {
    const e = diagram.elements.find((x) => x.id === id);
    return e ? e.name || ELEMENT_KIND_LABELS[e.kind] : "?";
  };
  const isStructural = rel.kind === "association" || rel.kind === "aggregation" || rel.kind === "composition";
  const endpointOptions = diagram.elements.map((e) => (
    <option key={e.id} value={e.id}>{e.name || ELEMENT_KIND_LABELS[e.kind]}</option>
  ));

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{RELATIONSHIP_KIND_LABELS[rel.kind]}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" title="Reverse direction" onClick={() => update({ sourceId: rel.targetId, targetId: rel.sourceId, sourceMultiplicity: rel.targetMultiplicity, targetMultiplicity: rel.sourceMultiplicity, sourceRole: rel.targetRole, targetRole: rel.sourceRole })}>
            <Repeat size={14} />
          </Button>
          <Button variant="danger" onClick={remove} title="Delete relationship"><Trash2 size={14} /></Button>
        </div>
      </div>
      <p className="text-[12px] text-slate-500">{nameOf(rel.sourceId)} → {nameOf(rel.targetId)}</p>
      <Field label="Type">
        <select aria-label="Relationship type" className={inputCls} value={rel.kind} onChange={(e) => update({ kind: e.target.value as RelationshipKind })}>
          {RELATIONSHIP_KINDS_BY_DIAGRAM[diagram.type].map((k) => <option key={k} value={k}>{RELATIONSHIP_KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      {rel.kind === "message" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <select className={inputCls} value={rel.sourceId} onChange={(e) => update({ sourceId: e.target.value })}>{endpointOptions}</select>
            </Field>
            <Field label="To">
              <select className={inputCls} value={rel.targetId} onChange={(e) => update({ targetId: e.target.value })}>{endpointOptions}</select>
            </Field>
          </div>
          <Field label="Message type">
            <select aria-label="Message type" className={inputCls} value={rel.messageType ?? "sync"} onChange={(e) => update({ messageType: e.target.value as MessageType })}>
              <option value="sync">Synchronous call</option>
              <option value="async">Asynchronous</option>
              <option value="reply">Reply</option>
              <option value="create">Create</option>
            </select>
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => move(-1)} title="Move earlier"><ArrowUp size={14} /> Earlier</Button>
            <Button onClick={() => move(1)} title="Move later"><ArrowDown size={14} /> Later</Button>
          </div>
        </>
      )}
      {rel.kind !== "include" && rel.kind !== "generalization" && rel.kind !== "realization" && rel.kind !== "anchor" && rel.kind !== "controlFlow" && (
        <Field label={rel.kind === "message" ? "Signature" : rel.kind === "extend" ? "Condition / extension point" : "Name"}>
          <TextField ariaLabel="Relationship label" value={rel.label ?? ""} placeholder={rel.kind === "message" ? "e.g. processPayment(amount: Decimal)" : ""} onCommit={(label) => update({ label: label || undefined })} />
        </Field>
      )}
      {rel.kind === "controlFlow" && (
        <Field label="Guard">
          <TextField ariaLabel="Guard" value={rel.guard ?? ""} placeholder="e.g. approved / else" onCommit={(guard) => update({ guard: guard.replace(/^\[|\]$/g, "") || undefined })} />
        </Field>
      )}
      {isStructural && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`${nameOf(rel.sourceId)} mult.`}>
              <TextField ariaLabel="Source multiplicity" value={rel.sourceMultiplicity ?? ""} placeholder="1" onCommit={(v) => update({ sourceMultiplicity: v || undefined })} />
            </Field>
            <Field label={`${nameOf(rel.targetId)} mult.`}>
              <TextField ariaLabel="Target multiplicity" value={rel.targetMultiplicity ?? ""} placeholder="0..*" onCommit={(v) => update({ targetMultiplicity: v || undefined })} />
            </Field>
            <Field label="Source role">
              <TextField value={rel.sourceRole ?? ""} onCommit={(v) => update({ sourceRole: v || undefined })} />
            </Field>
            <Field label="Target role">
              <TextField value={rel.targetRole ?? ""} onCommit={(v) => update({ targetRole: v || undefined })} />
            </Field>
          </div>
          {rel.kind === "association" && (
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={!!rel.navigable} onChange={(e) => update({ navigable: e.target.checked })} /> Navigable toward target
            </label>
          )}
        </>
      )}
    </div>
  );
}
