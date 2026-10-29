import { z } from "zod";
import { DIAGRAM_TYPES } from "./types";

const visibility = z.enum(["+", "-", "#", "~"]);

export const aiElementSchema = z.object({
  key: z.string().describe("Stable unique key. Reuse the key of an existing element when modifying it; otherwise a short new key."),
  kind: z.enum([
    "class", "interface", "enumeration", "note",
    "actor", "useCase",
    "lifeline",
    "initial", "final", "action", "decision", "merge", "fork", "join",
  ]),
  name: z.string().describe("Element name. Empty string for initial/final/fork/join/merge/decision nodes."),
  stereotype: z.string().nullable(),
  isAbstract: z.boolean(),
  attributes: z.array(
    z.object({ visibility, name: z.string(), type: z.string(), isStatic: z.boolean() }),
  ),
  operations: z.array(
    z.object({
      visibility,
      name: z.string(),
      parameters: z.array(z.object({ name: z.string(), type: z.string() })),
      returnType: z.string(),
      isStatic: z.boolean(),
      isAbstract: z.boolean(),
    }),
  ),
  literals: z.array(z.string()).describe("Enumeration literals (enumeration only)."),
  participantType: z.enum(["actor", "object"]).nullable().describe("Lifelines only."),
  classifier: z.string().nullable().describe("Lifelines only: the class the participant instantiates."),
  documentation: z.string().nullable().describe("One-sentence responsibility or description."),
});

export const aiRelationshipSchema = z.object({
  kind: z.enum([
    "association", "aggregation", "composition", "generalization", "realization", "dependency",
    "include", "extend", "message", "controlFlow", "anchor",
  ]),
  source: z.string().describe("Key of the source element. For aggregation/composition the source is the whole. For generalization/realization the source is the child/implementer."),
  target: z.string().describe("Key of the target element."),
  label: z.string().nullable().describe("Association name, message signature e.g. processPayment(amount), or extend condition."),
  sourceMultiplicity: z.string().nullable(),
  targetMultiplicity: z.string().nullable(),
  sourceRole: z.string().nullable(),
  targetRole: z.string().nullable(),
  navigable: z.boolean().nullable(),
  guard: z.string().nullable().describe("Activity control-flow guard without brackets, e.g. 'payment approved' or 'else'."),
  messageType: z.enum(["sync", "async", "reply", "create"]).nullable(),
});

export const aiDiagramSchema = z.object({
  diagramName: z.string(),
  summary: z.string().describe("Two or three sentences explaining the key modeling decisions."),
  systemName: z.string().nullable().describe("Use case diagrams: the system boundary name."),
  elements: z.array(aiElementSchema),
  relationships: z.array(aiRelationshipSchema).describe("For sequence diagrams, messages MUST be listed in chronological order."),
  assumptions: z.array(
    z.object({
      category: z.enum(["explicit", "inferred", "question", "recommendation"]),
      text: z.string(),
    }),
  ),
});

export type AiDiagram = z.infer<typeof aiDiagramSchema>;

export const detailLevelSchema = z.enum(["beginner", "intermediate", "professional"]);
export type DetailLevel = z.infer<typeof detailLevelSchema>;

export const generateRequestSchema = z.object({
  diagramType: z.enum(DIAGRAM_TYPES),
  prompt: z.string().min(3).max(8000),
  requirements: z.string().max(20000).optional().default(""),
  detailLevel: detailLevelSchema.default("intermediate"),
  /** Present for conversational refinement of an existing diagram. */
  current: z.unknown().optional(),
});
