import type { AiDiagram } from "./ai-schema";
import type { Assumption, Diagram, DiagramType, Relationship, UmlElement } from "./types";
import { ELEMENT_KINDS_BY_DIAGRAM, RELATIONSHIP_KINDS_BY_DIAGRAM } from "./rules";
import { createDiagram, newId } from "./factory";

export interface ConversionReport {
  added: string[];
  removed: string[];
  modified: string[];
  dropped: string[];
}

/**
 * Converts an AI response into a typed diagram. Element keys that match existing element IDs
 * keep their identity and position so that user layout edits survive refinement.
 * Elements/relationships the diagram type does not support are dropped and reported.
 */
export function aiToDiagram(ai: AiDiagram, type: DiagramType, existing?: Diagram): { diagram: Diagram; report: ConversionReport } {
  const report: ConversionReport = { added: [], removed: [], modified: [], dropped: [] };
  const base = existing ?? createDiagram(type, ai.diagramName || "Generated diagram");
  const existingById = new Map(base.elements.map((e) => [e.id, e]));
  const allowedEls = ELEMENT_KINDS_BY_DIAGRAM[type];
  const allowedRels = RELATIONSHIP_KINDS_BY_DIAGRAM[type];
  const keyToId = new Map<string, string>();
  const elements: UmlElement[] = [];

  for (const e of ai.elements) {
    if (!allowedEls.includes(e.kind)) {
      report.dropped.push(`${e.kind} "${e.name}"`);
      continue;
    }
    if (keyToId.has(e.key)) {
      report.dropped.push(`duplicate key "${e.key}"`);
      continue;
    }
    const prev = existingById.get(e.key);
    const id = prev && prev.kind === e.kind ? prev.id : newId();
    keyToId.set(e.key, id);
    const common = {
      id,
      name: e.name,
      documentation: e.documentation ?? undefined,
      stereotype: e.stereotype ?? undefined,
      position: prev && prev.kind === e.kind ? prev.position : undefined,
    };
    let el: UmlElement;
    switch (e.kind) {
      case "class":
      case "interface":
        el = {
          ...common,
          kind: e.kind,
          ...(e.kind === "class" ? { isAbstract: e.isAbstract } : {}),
          attributes: e.attributes.map((a) => ({ id: newId("at"), visibility: a.visibility, name: a.name, type: a.type, isStatic: a.isStatic || undefined })),
          operations: e.operations.map((o) => ({
            id: newId("op"),
            visibility: o.visibility,
            name: o.name,
            parameters: o.parameters,
            returnType: o.returnType,
            isStatic: o.isStatic || undefined,
            isAbstract: o.isAbstract || undefined,
          })),
        } as UmlElement;
        break;
      case "enumeration":
        el = { ...common, kind: "enumeration", literals: e.literals };
        break;
      case "lifeline":
        el = { ...common, kind: "lifeline", participantType: e.participantType ?? "object", classifier: e.classifier ?? undefined };
        break;
      default:
        el = { ...common, kind: e.kind } as UmlElement;
    }
    if (prev) {
      if (JSON.stringify(stripVolatile(prev)) !== JSON.stringify(stripVolatile(el))) report.modified.push(el.name || el.kind);
    } else {
      report.added.push(el.name || el.kind);
    }
    elements.push(el);
  }

  const kept = new Set(elements.map((e) => e.id));
  for (const prev of base.elements) if (!kept.has(prev.id)) report.removed.push(prev.name || prev.kind);

  const relationships: Relationship[] = [];
  for (const r of ai.relationships) {
    const sourceId = keyToId.get(r.source);
    const targetId = keyToId.get(r.target);
    if (!allowedRels.includes(r.kind) || !sourceId || !targetId) {
      report.dropped.push(`${r.kind} ${r.source} → ${r.target}`);
      continue;
    }
    const rel: Relationship = { id: newId("rel"), kind: r.kind, sourceId, targetId };
    if (r.label) rel.label = r.label;
    if (r.sourceMultiplicity) rel.sourceMultiplicity = r.sourceMultiplicity;
    if (r.targetMultiplicity) rel.targetMultiplicity = r.targetMultiplicity;
    if (r.sourceRole) rel.sourceRole = r.sourceRole;
    if (r.targetRole) rel.targetRole = r.targetRole;
    if (r.navigable) rel.navigable = true;
    if (r.guard) rel.guard = r.guard.replace(/^\[|\]$/g, "");
    if (r.kind === "message") rel.messageType = r.messageType ?? "sync";
    relationships.push(rel);
  }

  const assumptions: Assumption[] = [
    ...base.assumptions.filter((a) => a.status !== "pending"),
    ...ai.assumptions.map((a) => ({ id: newId("as"), category: a.category, text: a.text, status: "pending" as const })),
  ];

  return {
    diagram: {
      ...base,
      name: existing ? base.name : ai.diagramName || base.name,
      systemName: type === "useCase" ? ai.systemName ?? base.systemName : base.systemName,
      elements,
      relationships,
      assumptions,
      modelVersion: base.modelVersion + (existing ? 1 : 0),
      updatedAt: new Date().toISOString(),
    },
    report,
  };
}

function stripVolatile(el: UmlElement) {
  // Member IDs are regenerated on every AI round-trip, so compare by content only.
  const { position: _p, ...rest } = el as UmlElement & { attributes?: { id: string }[]; operations?: { id: string }[] };
  void _p;
  const clone = JSON.parse(JSON.stringify(rest));
  for (const k of ["attributes", "operations"]) if (Array.isArray(clone[k])) clone[k] = clone[k].map(({ id: _id, ...m }: { id: string }) => (void _id, m));
  for (const k of Object.keys(clone)) if (clone[k] === undefined || clone[k] === false) delete clone[k];
  return clone;
}

/** Serializes a diagram in the AI's name-keyed shape so it can be refined conversationally. */
export function diagramToAiInput(d: Diagram) {
  return {
    diagramName: d.name,
    systemName: d.systemName ?? null,
    elements: d.elements.map((e) => ({ key: e.id, ...stripVolatile(e), id: undefined })),
    relationships: d.relationships.map((r) => ({ ...r, id: undefined, source: r.sourceId, target: r.targetId, sourceId: undefined, targetId: undefined })),
  };
}
