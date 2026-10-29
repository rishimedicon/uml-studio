import type { DiagramType, ElementKind, RelationshipKind } from "./types";

export const ELEMENT_KINDS_BY_DIAGRAM: Record<DiagramType, ElementKind[]> = {
  class: ["class", "interface", "enumeration", "note"],
  useCase: ["actor", "useCase", "note"],
  sequence: ["lifeline"],
  activity: ["initial", "action", "decision", "merge", "fork", "join", "final", "note"],
};

export const RELATIONSHIP_KINDS_BY_DIAGRAM: Record<DiagramType, RelationshipKind[]> = {
  class: ["association", "aggregation", "composition", "generalization", "realization", "dependency", "anchor"],
  useCase: ["association", "include", "extend", "generalization", "anchor"],
  sequence: ["message"],
  activity: ["controlFlow", "anchor"],
};

export const DEFAULT_RELATIONSHIP: Record<DiagramType, RelationshipKind> = {
  class: "association",
  useCase: "association",
  sequence: "message",
  activity: "controlFlow",
};

export const ELEMENT_KIND_LABELS: Record<ElementKind, string> = {
  class: "Class",
  interface: "Interface",
  enumeration: "Enumeration",
  note: "Note",
  actor: "Actor",
  useCase: "Use Case",
  lifeline: "Lifeline",
  initial: "Initial Node",
  final: "Final Node",
  action: "Action",
  decision: "Decision",
  merge: "Merge",
  fork: "Fork",
  join: "Join",
};

export const RELATIONSHIP_KIND_LABELS: Record<RelationshipKind, string> = {
  association: "Association",
  aggregation: "Aggregation",
  composition: "Composition",
  generalization: "Generalization",
  realization: "Realization",
  dependency: "Dependency",
  include: "Include",
  extend: "Extend",
  message: "Message",
  controlFlow: "Control Flow",
  anchor: "Note Anchor",
};

type Endpoint = ElementKind[] | "any";

/** Allowed (source, target) element kinds for each relationship kind. */
export const RELATIONSHIP_ENDPOINTS: Record<RelationshipKind, [Endpoint, Endpoint]> = {
  association: [
    ["class", "interface", "enumeration", "actor", "useCase"],
    ["class", "interface", "enumeration", "actor", "useCase"],
  ],
  aggregation: [["class"], ["class", "interface"]],
  composition: [["class"], ["class", "interface", "enumeration"]],
  generalization: [
    ["class", "interface", "actor", "useCase"],
    ["class", "interface", "actor", "useCase"],
  ],
  realization: [["class"], ["interface"]],
  dependency: [
    ["class", "interface", "enumeration"],
    ["class", "interface", "enumeration"],
  ],
  include: [["useCase"], ["useCase"]],
  extend: [["useCase"], ["useCase"]],
  message: [["lifeline"], ["lifeline"]],
  controlFlow: [
    ["initial", "action", "decision", "merge", "fork", "join"],
    ["action", "decision", "merge", "fork", "join", "final"],
  ],
  anchor: [["note"], "any"],
};

export function isEndpointAllowed(kind: RelationshipKind, source: ElementKind, target: ElementKind): boolean {
  const [s, t] = RELATIONSHIP_ENDPOINTS[kind];
  return (s === "any" || s.includes(source)) && (t === "any" || t.includes(target));
}

export const PRIMITIVE_TYPES = new Set(
  [
    "string", "int", "integer", "long", "short", "byte", "float", "double", "decimal", "number",
    "boolean", "bool", "char", "void", "date", "datetime", "time", "uuid", "object", "any",
    "bigint", "money", "currency", "url", "email", "timestamp", "duration", "localdate",
  ].map((t) => t.toLowerCase()),
);

export const MULTIPLICITY_PATTERN = /^(\*|\d+|\d+\.\.(\d+|\*))$/;
