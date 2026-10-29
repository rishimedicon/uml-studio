export const DIAGRAM_TYPES = ["class", "useCase", "sequence", "activity"] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  class: "Class Diagram",
  useCase: "Use Case Diagram",
  sequence: "Sequence Diagram",
  activity: "Activity Diagram",
};

export type Visibility = "+" | "-" | "#" | "~";

export interface Parameter {
  name: string;
  type: string;
}

export interface Attribute {
  id: string;
  visibility: Visibility;
  name: string;
  type: string;
  isStatic?: boolean;
  defaultValue?: string;
}

export interface Operation {
  id: string;
  visibility: Visibility;
  name: string;
  parameters: Parameter[];
  returnType: string;
  isStatic?: boolean;
  isAbstract?: boolean;
}

export interface Position {
  x: number;
  y: number;
}

interface ElementBase {
  id: string;
  name: string;
  documentation?: string;
  stereotype?: string;
  position?: Position;
}

export interface ClassElement extends ElementBase {
  kind: "class";
  isAbstract?: boolean;
  attributes: Attribute[];
  operations: Operation[];
}

export interface InterfaceElement extends ElementBase {
  kind: "interface";
  attributes: Attribute[];
  operations: Operation[];
}

export interface EnumerationElement extends ElementBase {
  kind: "enumeration";
  literals: string[];
}

export interface ActorElement extends ElementBase {
  kind: "actor";
}

export interface UseCaseElement extends ElementBase {
  kind: "useCase";
}

export interface LifelineElement extends ElementBase {
  kind: "lifeline";
  participantType: "actor" | "object";
  classifier?: string;
}

export type ActivityNodeKind =
  | "initial"
  | "final"
  | "action"
  | "decision"
  | "merge"
  | "fork"
  | "join";

export interface ActivityNodeElement extends ElementBase {
  kind: ActivityNodeKind;
}

export interface NoteElement extends ElementBase {
  kind: "note";
}

export type UmlElement =
  | ClassElement
  | InterfaceElement
  | EnumerationElement
  | ActorElement
  | UseCaseElement
  | LifelineElement
  | ActivityNodeElement
  | NoteElement;

export type ElementKind = UmlElement["kind"];

export type RelationshipKind =
  | "association"
  | "aggregation"
  | "composition"
  | "generalization"
  | "realization"
  | "dependency"
  | "include"
  | "extend"
  | "message"
  | "controlFlow"
  | "anchor";

export type MessageType = "sync" | "async" | "reply" | "create";

export interface Relationship {
  id: string;
  kind: RelationshipKind;
  sourceId: string;
  targetId: string;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  sourceRole?: string;
  targetRole?: string;
  navigable?: boolean;
  guard?: string;
  messageType?: MessageType;
}

export type AssumptionCategory = "explicit" | "inferred" | "question" | "recommendation";
export type AssumptionStatus = "pending" | "accepted" | "rejected";

export interface Assumption {
  id: string;
  category: AssumptionCategory;
  text: string;
  status: AssumptionStatus;
}

export type LayoutDirection = "TB" | "LR";

export interface Diagram {
  id: string;
  name: string;
  type: DiagramType;
  modelVersion: number;
  systemName?: string;
  elements: UmlElement[];
  relationships: Relationship[];
  layout: { direction: LayoutDirection };
  assumptions: Assumption[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  requirements: string;
  diagrams: Diagram[];
  createdAt: string;
  updatedAt: string;
}

export type Severity = "error" | "warning" | "suggestion";

export interface ValidationIssue {
  severity: Severity;
  message: string;
  elementIds?: string[];
  relationshipIds?: string[];
  rule: string;
}
