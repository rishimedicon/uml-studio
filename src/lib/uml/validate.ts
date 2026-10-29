import type { Diagram, Relationship, Severity, UmlElement, ValidationIssue } from "./types";
import {
  ELEMENT_KINDS_BY_DIAGRAM,
  ELEMENT_KIND_LABELS,
  MULTIPLICITY_PATTERN,
  PRIMITIVE_TYPES,
  RELATIONSHIP_KINDS_BY_DIAGRAM,
  RELATIONSHIP_KIND_LABELS,
  isEndpointAllowed,
} from "./rules";
import { typeReferences } from "./format";

const CONTAINER_TYPES = new Set(["list", "set", "map", "array", "collection", "optional", "dictionary", "sequence", "iterable", "promise", "future"]);

type Ctx = {
  diagram: Diagram;
  byId: Map<string, UmlElement>;
  issues: ValidationIssue[];
  add: (severity: Severity, rule: string, message: string, ids?: { el?: string[]; rel?: string[] }) => void;
};

const label = (el: UmlElement) => el.name || ELEMENT_KIND_LABELS[el.kind];

export function validateDiagram(diagram: Diagram): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, UmlElement>();
  const ctx: Ctx = {
    diagram,
    byId,
    issues,
    add: (severity, rule, message, ids) =>
      issues.push({ severity, rule, message, elementIds: ids?.el, relationshipIds: ids?.rel }),
  };

  validateStructure(ctx);
  switch (diagram.type) {
    case "class":
      validateClass(ctx);
      break;
    case "useCase":
      validateUseCase(ctx);
      break;
    case "sequence":
      validateSequence(ctx);
      break;
    case "activity":
      validateActivity(ctx);
      break;
  }
  return issues;
}

function validateStructure(ctx: Ctx) {
  const { diagram, byId, add } = ctx;
  const allowedEls = ELEMENT_KINDS_BY_DIAGRAM[diagram.type];
  const allowedRels = RELATIONSHIP_KINDS_BY_DIAGRAM[diagram.type];

  for (const el of diagram.elements) {
    if (byId.has(el.id)) add("error", "unique-id", `Duplicate element identifier "${el.id}".`, { el: [el.id] });
    byId.set(el.id, el);
    if (!allowedEls.includes(el.kind)) {
      add("error", "element-kind", `${ELEMENT_KIND_LABELS[el.kind]} "${label(el)}" is not allowed in this diagram type.`, { el: [el.id] });
    }
  }

  const relIds = new Set<string>();
  for (const rel of diagram.relationships) {
    if (relIds.has(rel.id)) add("error", "unique-id", `Duplicate relationship identifier "${rel.id}".`, { rel: [rel.id] });
    relIds.add(rel.id);
    const s = byId.get(rel.sourceId);
    const t = byId.get(rel.targetId);
    if (!s || !t) {
      add("error", "dangling-relationship", `${RELATIONSHIP_KIND_LABELS[rel.kind]} references a missing element.`, { rel: [rel.id] });
      continue;
    }
    if (!allowedRels.includes(rel.kind)) {
      add("error", "relationship-kind", `${RELATIONSHIP_KIND_LABELS[rel.kind]} is not allowed in this diagram type.`, { rel: [rel.id] });
      continue;
    }
    if (!isEndpointAllowed(rel.kind, s.kind, t.kind)) {
      add(
        "error",
        "relationship-endpoints",
        `${RELATIONSHIP_KIND_LABELS[rel.kind]} cannot connect ${ELEMENT_KIND_LABELS[s.kind]} "${label(s)}" to ${ELEMENT_KIND_LABELS[t.kind]} "${label(t)}".`,
        { rel: [rel.id], el: [s.id, t.id] },
      );
    }
    if (rel.kind === "generalization" && s.kind !== t.kind) {
      add("error", "generalization-kind", `Generalization should connect elements of the same kind ("${label(s)}" → "${label(t)}"). Use realization for class → interface.`, { rel: [rel.id] });
    }
    if (rel.sourceId === rel.targetId && rel.kind !== "message" && rel.kind !== "association") {
      add("error", "self-relationship", `${RELATIONSHIP_KIND_LABELS[rel.kind]} on "${label(s)}" cannot target itself.`, { rel: [rel.id] });
    }
  }

  const namedKinds = new Set(["class", "interface", "enumeration", "actor", "useCase", "lifeline", "action"]);
  const seen = new Map<string, string>();
  for (const el of diagram.elements) {
    if (!namedKinds.has(el.kind)) continue;
    if (!el.name.trim()) {
      add("error", "empty-name", `A ${ELEMENT_KIND_LABELS[el.kind]} has no name.`, { el: [el.id] });
      continue;
    }
    const key = `${el.kind === "interface" || el.kind === "enumeration" ? "class" : el.kind}:${el.name.trim().toLowerCase()}`;
    if (seen.has(key) && el.kind !== "action") {
      add("error", "duplicate-name", `Duplicate ${ELEMENT_KIND_LABELS[el.kind]} name "${el.name}".`, { el: [seen.get(key)!, el.id] });
    }
    seen.set(key, el.id);
  }
}

function validateClass(ctx: Ctx) {
  const { diagram, byId, add } = ctx;
  const classifierNames = new Set(
    diagram.elements
      .filter((e) => e.kind === "class" || e.kind === "interface" || e.kind === "enumeration")
      .map((e) => e.name),
  );
  const connected = new Set<string>();

  for (const rel of diagram.relationships) {
    connected.add(rel.sourceId);
    connected.add(rel.targetId);
    for (const [m, end] of [
      [rel.sourceMultiplicity, "source"],
      [rel.targetMultiplicity, "target"],
    ] as const) {
      if (m && !MULTIPLICITY_PATTERN.test(m.trim())) {
        add("error", "multiplicity", `Invalid ${end} multiplicity "${m}". Use forms like 1, 0..1, *, 1..*.`, { rel: [rel.id] });
      } else if (m && /^(\d+)\.\.(\d+)$/.test(m.trim())) {
        const [lo, hi] = m.trim().split("..").map(Number);
        if (lo > hi) add("error", "multiplicity", `Multiplicity "${m}" has a lower bound greater than its upper bound.`, { rel: [rel.id] });
      }
    }
    if (rel.kind === "composition" && rel.sourceMultiplicity && !["1", "0..1"].includes(rel.sourceMultiplicity.trim())) {
      add("error", "composition-owner", `A composite part can belong to at most one whole; whole-end multiplicity "${rel.sourceMultiplicity}" should be 1 or 0..1.`, { rel: [rel.id] });
    }
    if ((rel.kind === "association" || rel.kind === "aggregation" || rel.kind === "composition") && !rel.label && !rel.sourceRole && !rel.targetRole) {
      const s = byId.get(rel.sourceId);
      const t = byId.get(rel.targetId);
      if (s && t) add("warning", "association-name", `The ${RELATIONSHIP_KIND_LABELS[rel.kind].toLowerCase()} between "${s.name}" and "${t.name}" has no name or role names.`, { rel: [rel.id] });
    }
    if ((rel.kind === "association" || rel.kind === "aggregation" || rel.kind === "composition") && !rel.sourceMultiplicity && !rel.targetMultiplicity) {
      add("suggestion", "association-multiplicity", `Consider specifying multiplicities on the ${RELATIONSHIP_KIND_LABELS[rel.kind].toLowerCase()} "${relName(ctx, rel)}".`, { rel: [rel.id] });
    }
  }

  // Inheritance cycles.
  const parents = new Map<string, string[]>();
  for (const rel of diagram.relationships) {
    if (rel.kind !== "generalization") continue;
    parents.set(rel.sourceId, [...(parents.get(rel.sourceId) ?? []), rel.targetId]);
  }
  const reported = new Set<string>();
  for (const start of parents.keys()) {
    const stack = [...(parents.get(start) ?? [])];
    const visited = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === start && !reported.has(start)) {
        reported.add(start);
        add("error", "inheritance-cycle", `Inheritance cycle detected involving "${byId.get(start)?.name}".`, { el: [start] });
        break;
      }
      if (visited.has(cur)) continue;
      visited.add(cur);
      stack.push(...(parents.get(cur) ?? []));
    }
  }

  for (const el of diagram.elements) {
    if (el.kind === "class" || el.kind === "interface") {
      const memberNames = new Set<string>();
      for (const a of el.attributes) {
        if (!a.name.trim()) add("error", "empty-member", `"${el.name}" has an attribute without a name.`, { el: [el.id] });
        if (memberNames.has(a.name)) add("error", "duplicate-member", `"${el.name}" declares attribute "${a.name}" more than once.`, { el: [el.id] });
        memberNames.add(a.name);
        if (!a.type.trim()) add("warning", "untyped-attribute", `Attribute "${el.name}.${a.name}" has no type.`, { el: [el.id] });
        checkTypes(ctx, el, a.type, classifierNames, `attribute "${a.name}"`);
        if (a.visibility === "+" && el.kind === "class" && !a.isStatic) {
          add("suggestion", "encapsulation", `"${el.name}.${a.name}" is public. Consider making it private and exposing behavior through operations.`, { el: [el.id] });
        }
      }
      for (const o of el.operations) {
        if (!o.name.trim()) add("error", "empty-member", `"${el.name}" has an operation without a name.`, { el: [el.id] });
        checkTypes(ctx, el, o.returnType, classifierNames, `return type of "${o.name}()"`);
        for (const p of o.parameters) checkTypes(ctx, el, p.type, classifierNames, `parameter "${p.name}" of "${o.name}()"`);
        if (o.isAbstract && el.kind === "class" && !el.isAbstract) {
          add("error", "abstract-operation", `"${el.name}" declares abstract operation "${o.name}()" but is not abstract.`, { el: [el.id] });
        }
      }
      if (el.kind === "interface" && el.attributes.some((a) => !a.isStatic)) {
        add("warning", "interface-state", `Interface "${el.name}" declares instance attributes; interfaces usually specify behavior only.`, { el: [el.id] });
      }
      if (el.kind === "class" && el.attributes.length === 0 && el.operations.length === 0) {
        add("suggestion", "empty-class", `"${el.name}" has no attributes or operations. Consider defining its responsibilities.`, { el: [el.id] });
      }
    }
    if (el.kind === "enumeration" && el.literals.length === 0) {
      add("warning", "empty-enum", `Enumeration "${el.name}" has no literals.`, { el: [el.id] });
    }
    if (el.kind !== "note" && !connected.has(el.id) && diagram.elements.length > 1) {
      add("warning", "isolated-element", `"${label(el)}" is not connected to any other element.`, { el: [el.id] });
    }
  }

  const classCount = diagram.elements.filter((e) => e.kind === "class").length;
  if (classCount > 12) {
    add("suggestion", "modularity", `This diagram has ${classCount} classes. Consider splitting it into packages or focused views.`);
  }
}

function checkTypes(ctx: Ctx, el: UmlElement, type: string, classifierNames: Set<string>, where: string) {
  if (!type?.trim()) return;
  for (const ref of typeReferences(type)) {
    const lower = ref.toLowerCase();
    if (PRIMITIVE_TYPES.has(lower) || CONTAINER_TYPES.has(lower) || classifierNames.has(ref)) continue;
    ctx.add("warning", "unresolved-type", `Type "${ref}" used in ${where} of "${el.name}" is not defined in this diagram.`, { el: [el.id] });
  }
}

function relName(ctx: Ctx, rel: Relationship) {
  const s = ctx.byId.get(rel.sourceId)?.name ?? "?";
  const t = ctx.byId.get(rel.targetId)?.name ?? "?";
  return `${s} – ${t}`;
}

function validateUseCase(ctx: Ctx) {
  const { diagram, byId, add } = ctx;
  const linkedToActor = new Set<string>();
  const connected = new Set<string>();
  for (const rel of diagram.relationships) {
    const s = byId.get(rel.sourceId);
    const t = byId.get(rel.targetId);
    if (!s || !t) continue;
    connected.add(s.id);
    connected.add(t.id);
    if (rel.kind === "association") {
      if (s.kind === "actor" && t.kind === "actor") {
        add("error", "actor-association", `Actors "${s.name}" and "${t.name}" cannot be associated directly; use generalization or a use case.`, { rel: [rel.id] });
      }
      if (s.kind === "useCase" && t.kind === "useCase") {
        add("error", "usecase-association", `Use cases "${s.name}" and "${t.name}" should be related with include, extend, or generalization.`, { rel: [rel.id] });
      }
      if (s.kind === "actor" && t.kind === "useCase") linkedToActor.add(t.id);
      if (t.kind === "actor" && s.kind === "useCase") linkedToActor.add(s.id);
    }
    if (rel.kind === "extend" && !rel.label) {
      add("suggestion", "extend-condition", `Consider documenting the condition or extension point for "${s.name}" extending "${t.name}".`, { rel: [rel.id] });
    }
  }
  // A use case reachable via include/extend/generalization from an actor-linked one counts as covered.
  let changed = true;
  while (changed) {
    changed = false;
    for (const rel of diagram.relationships) {
      if (rel.kind === "include" && linkedToActor.has(rel.sourceId) && !linkedToActor.has(rel.targetId)) {
        linkedToActor.add(rel.targetId);
        changed = true;
      }
      if ((rel.kind === "extend" || rel.kind === "generalization") && linkedToActor.has(rel.targetId) && !linkedToActor.has(rel.sourceId)) {
        linkedToActor.add(rel.sourceId);
        changed = true;
      }
    }
  }
  for (const el of diagram.elements) {
    if (el.kind === "useCase" && !linkedToActor.has(el.id)) {
      add("warning", "unreached-usecase", `Use case "${el.name}" is not associated with any actor.`, { el: [el.id] });
    }
    if (el.kind === "actor" && !connected.has(el.id)) {
      add("warning", "isolated-actor", `Actor "${el.name}" does not participate in any use case.`, { el: [el.id] });
    }
    if (el.kind === "useCase" && el.name && !/^[A-Z][a-z]*\s|^[A-Z][a-z]+$/.test(el.name)) {
      add("suggestion", "usecase-naming", `Use case names usually start with a verb phrase (e.g. "Place Order"): "${el.name}".`, { el: [el.id] });
    }
  }
  if (!diagram.elements.some((e) => e.kind === "actor")) add("warning", "no-actor", "The diagram has no actors.");
}

function validateSequence(ctx: Ctx) {
  const { diagram, byId, add } = ctx;
  const messages = diagram.relationships.filter((r) => r.kind === "message");
  const used = new Set<string>();
  const openCalls: Relationship[] = [];
  for (const m of messages) {
    used.add(m.sourceId);
    used.add(m.targetId);
    if (!m.label?.trim()) add("warning", "unlabeled-message", `A message from "${byId.get(m.sourceId)?.name}" to "${byId.get(m.targetId)?.name}" has no label.`, { rel: [m.id] });
    if (m.messageType === "sync" && m.sourceId !== m.targetId) openCalls.push(m);
    if (m.messageType === "reply") {
      const idx = openCalls.findLastIndex((c) => c.sourceId === m.targetId && c.targetId === m.sourceId);
      if (idx === -1) {
        add("warning", "orphan-reply", `Reply "${m.label ?? ""}" from "${byId.get(m.sourceId)?.name}" has no preceding synchronous call.`, { rel: [m.id] });
      } else {
        openCalls.splice(idx, 1);
      }
    }
    if (m.messageType === "create") {
      const firstUse = messages.find((x) => x.sourceId === m.targetId || x.targetId === m.targetId);
      if (firstUse && firstUse.id !== m.id) {
        add("warning", "create-order", `"${byId.get(m.targetId)?.name}" is used before its create message.`, { rel: [m.id] });
      }
    }
  }
  for (const el of diagram.elements) {
    if (el.kind === "lifeline" && !used.has(el.id)) {
      add("warning", "idle-lifeline", `Lifeline "${el.name}" sends or receives no messages.`, { el: [el.id] });
    }
  }
  if (messages.length === 0 && diagram.elements.length > 0) add("warning", "no-messages", "The interaction has no messages.");
}

function validateActivity(ctx: Ctx) {
  const { diagram, byId, add } = ctx;
  const flows = diagram.relationships.filter((r) => r.kind === "controlFlow");
  const incoming = new Map<string, Relationship[]>();
  const outgoing = new Map<string, Relationship[]>();
  for (const f of flows) {
    incoming.set(f.targetId, [...(incoming.get(f.targetId) ?? []), f]);
    outgoing.set(f.sourceId, [...(outgoing.get(f.sourceId) ?? []), f]);
  }
  const initials = diagram.elements.filter((e) => e.kind === "initial");
  const finals = diagram.elements.filter((e) => e.kind === "final");
  if (initials.length === 0 && diagram.elements.length > 0) add("error", "no-initial", "The activity has no initial node.");
  if (initials.length > 1) add("warning", "multiple-initial", `The activity has ${initials.length} initial nodes.`, { el: initials.map((e) => e.id) });
  if (finals.length === 0 && diagram.elements.length > 0) add("warning", "no-final", "The activity has no final node.");

  for (const el of diagram.elements) {
    const inc = incoming.get(el.id) ?? [];
    const out = outgoing.get(el.id) ?? [];
    switch (el.kind) {
      case "initial":
        if (out.length === 0) add("error", "initial-outgoing", "The initial node has no outgoing flow.", { el: [el.id] });
        break;
      case "action":
        if (inc.length === 0) add("warning", "action-incoming", `Action "${el.name}" has no incoming flow.`, { el: [el.id] });
        if (out.length === 0) add("warning", "action-outgoing", `Action "${el.name}" has no outgoing flow.`, { el: [el.id] });
        if (out.length > 1) add("warning", "implicit-fork", `Action "${el.name}" has multiple outgoing flows; use a decision or fork node to make intent explicit.`, { el: [el.id] });
        break;
      case "decision": {
        if (out.length < 2) add("error", "decision-branches", "A decision node needs at least two outgoing flows.", { el: [el.id] });
        const unguarded = out.filter((f) => !f.guard?.trim());
        if (unguarded.length > 0) add("warning", "decision-guards", "Every flow leaving a decision node should have a guard, e.g. [approved] or [else].", { el: [el.id], rel: unguarded.map((f) => f.id) });
        const guards = out.map((f) => f.guard?.trim()).filter(Boolean);
        if (new Set(guards).size !== guards.length) add("error", "duplicate-guards", "A decision node has duplicate guards.", { el: [el.id] });
        break;
      }
      case "merge":
        if (inc.length < 2) add("warning", "merge-inputs", "A merge node should have at least two incoming flows.", { el: [el.id] });
        if (out.length !== 1) add("error", "merge-output", "A merge node should have exactly one outgoing flow.", { el: [el.id] });
        break;
      case "fork":
        if (out.length < 2) add("error", "fork-branches", "A fork node needs at least two outgoing flows.", { el: [el.id] });
        if (inc.length !== 1) add("warning", "fork-input", "A fork node should have exactly one incoming flow.", { el: [el.id] });
        break;
      case "join":
        if (inc.length < 2) add("error", "join-inputs", "A join node needs at least two incoming flows.", { el: [el.id] });
        if (out.length !== 1) add("error", "join-output", "A join node should have exactly one outgoing flow.", { el: [el.id] });
        break;
      case "final":
        if (inc.length === 0) add("warning", "final-incoming", "A final node has no incoming flow.", { el: [el.id] });
        break;
    }
  }

  if (initials.length > 0) {
    const reachable = new Set<string>();
    const stack = initials.map((i) => i.id);
    while (stack.length) {
      const cur = stack.pop()!;
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      for (const f of outgoing.get(cur) ?? []) stack.push(f.targetId);
    }
    for (const el of diagram.elements) {
      if (el.kind !== "note" && !reachable.has(el.id)) {
        add("warning", "unreachable", `"${label(el)}" is unreachable from the initial node.`, { el: [el.id] });
      }
    }
  }
  void byId;
}

export function summarize(issues: ValidationIssue[]) {
  return {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    suggestions: issues.filter((i) => i.severity === "suggestion").length,
  };
}
