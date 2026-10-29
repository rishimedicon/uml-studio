import { describe, expect, it } from "vitest";
import { aiToDiagram, diagramToAiInput } from "../ai-convert";
import { aiDiagramSchema } from "../ai-schema";
import { EXAMPLES, buildExample } from "../examples";
import { autoLayout } from "../layout";
import { toPlantUml } from "../plantuml";
import { DIAGRAM_TYPES } from "../types";

describe("AI conversion", () => {
  it("example specs satisfy the AI output schema", () => {
    for (const t of DIAGRAM_TYPES) expect(aiDiagramSchema.safeParse(EXAMPLES[t]).success).toBe(true);
  });

  it("drops unsupported element kinds and dangling relationships", () => {
    const spec = structuredClone(EXAMPLES.useCase);
    spec.elements.push({ ...spec.elements[0], key: "cls", kind: "class", name: "Bogus" });
    spec.relationships.push({ ...spec.relationships[0], source: "nope" });
    const { diagram, report } = aiToDiagram(spec, "useCase");
    expect(diagram.elements.some((e) => e.name === "Bogus")).toBe(false);
    expect(report.dropped.length).toBe(2);
  });

  it("preserves identity and positions of kept elements on refinement", () => {
    const existing = buildExample("class");
    const input = diagramToAiInput(existing);
    const kept = existing.elements[0];
    const spec = structuredClone(EXAMPLES.class);
    spec.elements = spec.elements.map((e, i) => ({ ...e, key: input.elements[i].key }));
    spec.relationships = spec.relationships.map((r) => ({
      ...r,
      source: input.elements[EXAMPLES.class.elements.findIndex((e) => e.key === r.source)].key,
      target: input.elements[EXAMPLES.class.elements.findIndex((e) => e.key === r.target)].key,
    }));
    spec.elements.push({ ...spec.elements[0], key: "Coupon", name: "Coupon", attributes: [], operations: [] });
    const { diagram, report } = aiToDiagram(spec, "class", existing);
    const same = diagram.elements.find((e) => e.id === kept.id);
    expect(same?.position).toEqual(kept.position);
    expect(report.added).toEqual(["Coupon"]);
    expect(report.removed).toEqual([]);
    expect(diagram.modelVersion).toBe(existing.modelVersion + 1);
    const laid = autoLayout(diagram, { onlyMissing: true });
    expect(laid.elements.find((e) => e.id === kept.id)?.position).toEqual(kept.position);
    expect(laid.elements.every((e) => e.position)).toBe(true);
  });
});

describe("PlantUML export", () => {
  it.each(DIAGRAM_TYPES)("exports %s", (t) => {
    const { text } = toPlantUml(buildExample(t));
    expect(text.startsWith("@startuml")).toBe(true);
    expect(text.trim().endsWith("@enduml")).toBe(true);
  });

  it("uses correct class relationship arrows", () => {
    const { text } = toPlantUml(buildExample("class"));
    expect(text).toMatch(/\*--/);
    expect(text).toMatch(/--\|>/);
    expect(text).toMatch(/abstract class "Payment"/);
  });
});
