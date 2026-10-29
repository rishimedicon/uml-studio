import type { DiagramType } from "@/lib/uml/types";
import type { DetailLevel } from "@/lib/uml/ai-schema";

const BOOCH = `You are an expert software architect applying Grady Booch's object-oriented analysis and design
(abstraction, encapsulation, modularity, hierarchy, typing, concurrency, persistence) and OMG UML 2.5.1 notation.
Rules:
- Do not create a class for every noun; keep only abstractions with clear responsibilities.
- Put operations on the class responsible for them. Prefer private attributes with public operations.
- Use generalization only for true "is-a" relationships, realization for class -> interface.
- Use composition only for exclusive whole-part lifetime ownership; aggregation for shared parts.
- Every element key must be unique; relationships reference element keys.
- Fill all fields; use null, false, or [] when a field does not apply to the element kind.
- Record assumptions honestly: "explicit" = stated in the requirements, "inferred" = your design choice,
  "question" = ambiguity the user should resolve, "recommendation" = optional improvement.`;

const PER_TYPE: Record<DiagramType, string> = {
  class: `Produce a CLASS diagram. Allowed element kinds: class, interface, enumeration, note.
Allowed relationships: association, aggregation, composition, generalization, realization, dependency, anchor (note -> element).
Give attributes types, operations parameters and return types, and multiplicities like 1, 0..1, *, 1..* on associations.
For aggregation/composition the source is the whole and the target is the part. Use defined class/enum names or common primitive types (String, Integer, Decimal, Boolean, DateTime, UUID) for types.`,
  useCase: `Produce a USE CASE diagram. Allowed element kinds: actor, useCase, note.
Allowed relationships: association (actor <-> use case only), include (base -> included), extend (extension -> base, label = condition), generalization (same kinds), anchor.
Name use cases as verb phrases ("Place Order"). Set systemName to the system boundary name. Use the "system" stereotype for external system actors.`,
  sequence: `Produce a SEQUENCE diagram. Allowed element kinds: lifeline only (participantType "actor" for humans, "object" otherwise; classifier = class name).
Only relationship kind: message. List messages in chronological order. Use messageType sync for calls, reply for returns
(each reply must answer a prior sync call in the opposite direction), async for fire-and-forget, create for object creation.
Labels should be operation signatures such as processPayment(amount: Decimal).`,
  activity: `Produce an ACTIVITY diagram. Allowed element kinds: initial (exactly one), action, decision, merge, fork, join, final, note.
Only relationship kinds: controlFlow, anchor. Every flow leaving a decision needs a guard (e.g. "approved", "else").
Use fork/join for concurrent work; every fork should be matched by a join. Use a merge to re-join alternative branches.
Leave names empty for initial, final, decision, merge, fork and join nodes.`,
};

const DETAIL: Record<DetailLevel, string> = {
  beginner: "Detail level BEGINNER: essential elements only, simple relationships, minimal clutter (few members per class).",
  intermediate: "Detail level INTERMEDIATE: include key attributes, operations, multiplicities, guards, alternative flows.",
  professional: "Detail level PROFESSIONAL: detailed interfaces, constraints, stereotypes, complete signatures and edge cases.",
};

export function buildSystemPrompt(type: DiagramType, detail: DetailLevel) {
  return [BOOCH, PER_TYPE[type], DETAIL[detail]].join("\n\n");
}

export function buildUserPrompt(opts: { prompt: string; requirements: string; current?: unknown }) {
  const parts: string[] = [];
  if (opts.requirements.trim()) parts.push(`Project requirements:\n${opts.requirements.trim()}`);
  if (opts.current) {
    parts.push(
      `Current diagram model (JSON). Apply the user's instruction to it and return the COMPLETE updated model.
Keep the "key" of every element you keep or modify. Preserve unrelated elements and relationships exactly.
${JSON.stringify(opts.current)}`,
    );
    parts.push(`Instruction: ${opts.prompt}`);
  } else {
    parts.push(`Request: ${opts.prompt}`);
  }
  return parts.join("\n\n");
}
