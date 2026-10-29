import { nanoid } from "nanoid";
import type {
  ActivityNodeKind,
  Diagram,
  DiagramType,
  ElementKind,
  Project,
  Relationship,
  RelationshipKind,
  UmlElement,
} from "./types";
import { ELEMENT_KIND_LABELS } from "./rules";

export const newId = (prefix = "el") => `${prefix}_${nanoid(10)}`;

const now = () => new Date().toISOString();

export function createProject(name: string, description = ""): Project {
  const ts = now();
  return { id: newId("prj"), name, description, requirements: "", diagrams: [], createdAt: ts, updatedAt: ts };
}

export function createDiagram(type: DiagramType, name: string): Diagram {
  const ts = now();
  return {
    id: newId("dgm"),
    name,
    type,
    modelVersion: 1,
    systemName: type === "useCase" ? "System" : undefined,
    elements: [],
    relationships: [],
    layout: { direction: type === "useCase" ? "LR" : "TB" },
    assumptions: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

const ACTIVITY_KINDS: ActivityNodeKind[] = ["initial", "final", "action", "decision", "merge", "fork", "join"];

export function createElement(kind: ElementKind, name?: string): UmlElement {
  const id = newId();
  const label = name ?? (kind === "note" ? "Note" : ELEMENT_KIND_LABELS[kind]);
  switch (kind) {
    case "class":
      return { id, kind, name: name ?? "NewClass", attributes: [], operations: [] };
    case "interface":
      return { id, kind, name: name ?? "NewInterface", attributes: [], operations: [] };
    case "enumeration":
      return { id, kind, name: name ?? "NewEnum", literals: ["VALUE_A", "VALUE_B"] };
    case "actor":
      return { id, kind, name: name ?? "Actor" };
    case "useCase":
      return { id, kind, name: name ?? "New Use Case" };
    case "lifeline":
      return { id, kind, name: name ?? "object", participantType: "object" };
    case "note":
      return { id, kind, name: label };
    default: {
      if (!ACTIVITY_KINDS.includes(kind)) throw new Error(`Unknown element kind: ${kind}`);
      return { id, kind, name: name ?? (kind === "action" ? "New Action" : "") };
    }
  }
}

export function createRelationship(kind: RelationshipKind, sourceId: string, targetId: string): Relationship {
  const rel: Relationship = { id: newId("rel"), kind, sourceId, targetId };
  if (kind === "message") rel.messageType = "sync";
  if (kind === "extend") rel.label = "";
  return rel;
}

export function touch<T extends { updatedAt: string }>(obj: T): T {
  return { ...obj, updatedAt: now() };
}
