import { describe, expect, it } from "vitest";
import { validateDiagram } from "../validate";
import { buildExample } from "../examples";
import { createDiagram, createElement, createRelationship } from "../factory";
import type { Diagram, UmlElement } from "../types";
import { DIAGRAM_TYPES } from "../types";

const rules = (d: Diagram) => validateDiagram(d).map((i) => `${i.severity}:${i.rule}`);
const withEls = (d: Diagram, ...els: UmlElement[]) => ({ ...d, elements: [...d.elements, ...els] });

describe("examples", () => {
  it.each(DIAGRAM_TYPES)("%s example has no validation errors", (type) => {
    const errors = validateDiagram(buildExample(type)).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });
});

describe("structural rules", () => {
  it("flags dangling relationships and wrong endpoints", () => {
    const d = createDiagram("class", "t");
    const a = createElement("class", "A");
    const i = createElement("interface", "I");
    const out = {
      ...withEls(d, a, i),
      relationships: [createRelationship("realization", i.id, a.id), createRelationship("association", a.id, "missing")],
    };
    const r = rules(out);
    expect(r).toContain("error:relationship-endpoints");
    expect(r).toContain("error:dangling-relationship");
  });

  it("flags duplicate classifier names and invalid multiplicities", () => {
    const d = createDiagram("class", "t");
    const a = createElement("class", "Order");
    const b = createElement("class", "Order");
    const rel = { ...createRelationship("association", a.id, b.id), sourceMultiplicity: "many", targetMultiplicity: "3..1" };
    const r = rules({ ...withEls(d, a, b), relationships: [rel] });
    expect(r).toContain("error:duplicate-name");
    expect(r.filter((x) => x === "error:multiplicity")).toHaveLength(2);
  });

  it("detects inheritance cycles and class→interface generalization", () => {
    const d = createDiagram("class", "t");
    const a = createElement("class", "A");
    const b = createElement("class", "B");
    const i = createElement("interface", "I");
    const r = rules({
      ...withEls(d, a, b, i),
      relationships: [createRelationship("generalization", a.id, b.id), createRelationship("generalization", b.id, a.id), createRelationship("generalization", a.id, i.id)],
    });
    expect(r).toContain("error:inheritance-cycle");
    expect(r).toContain("error:generalization-kind");
  });

  it("warns on unresolved types but accepts primitives, containers and defined classes", () => {
    const d = createDiagram("class", "t");
    const order = createElement("class", "Order");
    const cust = createElement("class", "Customer");
    if (cust.kind !== "class") throw new Error();
    cust.attributes = [
      { id: "1", visibility: "-", name: "orders", type: "List<Order>" },
      { id: "2", visibility: "-", name: "email", type: "String" },
      { id: "3", visibility: "-", name: "addr", type: "Address" },
    ];
    const issues = validateDiagram({ ...withEls(d, order, cust), relationships: [createRelationship("association", cust.id, order.id)] });
    const unresolved = issues.filter((i) => i.rule === "unresolved-type");
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].message).toContain("Address");
  });

  it("rejects elements of the wrong diagram type", () => {
    const d = withEls(createDiagram("activity", "t"), createElement("class", "X"));
    expect(rules(d)).toContain("error:element-kind");
  });
});

describe("activity rules", () => {
  it("requires guards on decision branches and an initial node", () => {
    const d = createDiagram("activity", "t");
    const dec = createElement("decision");
    const a1 = createElement("action", "A");
    const a2 = createElement("action", "B");
    const r = rules({ ...withEls(d, dec, a1, a2), relationships: [createRelationship("controlFlow", dec.id, a1.id), createRelationship("controlFlow", dec.id, a2.id)] });
    expect(r).toContain("error:no-initial");
    expect(r).toContain("warning:decision-guards");
  });

  it("flags fork with one branch and unreachable nodes", () => {
    const d = createDiagram("activity", "t");
    const s = createElement("initial");
    const f = createElement("fork");
    const a = createElement("action", "A");
    const orphan = createElement("action", "Orphan");
    const r = rules({ ...withEls(d, s, f, a, orphan), relationships: [createRelationship("controlFlow", s.id, f.id), createRelationship("controlFlow", f.id, a.id)] });
    expect(r).toContain("error:fork-branches");
    expect(r).toContain("warning:unreachable");
  });
});

describe("use case and sequence rules", () => {
  it("forbids actor–actor associations", () => {
    const d = createDiagram("useCase", "t");
    const a = createElement("actor", "A");
    const b = createElement("actor", "B");
    expect(rules({ ...withEls(d, a, b), relationships: [createRelationship("association", a.id, b.id)] })).toContain("error:actor-association");
  });

  it("warns about replies without a matching call", () => {
    const d = createDiagram("sequence", "t");
    const a = createElement("lifeline", "a");
    const b = createElement("lifeline", "b");
    const reply = { ...createRelationship("message", b.id, a.id), messageType: "reply" as const, label: "ok" };
    expect(rules({ ...withEls(d, a, b), relationships: [reply] })).toContain("warning:orphan-reply");
  });
});
