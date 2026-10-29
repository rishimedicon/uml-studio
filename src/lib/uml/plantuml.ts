import type { Diagram, Relationship, UmlElement } from "./types";
import { formatAttribute, formatOperation } from "./format";

const q = (s: string) => `"${s.replace(/"/g, "'")}"`;

export interface ExportResult {
  text: string;
  /** Constructs that could not be represented faithfully in the target format. */
  losses: string[];
}

export function toPlantUml(diagram: Diagram): ExportResult {
  const losses: string[] = [];
  const alias = new Map<string, string>();
  diagram.elements.forEach((el, i) => alias.set(el.id, `E${i}`));
  const a = (id: string) => alias.get(id) ?? id;
  const lines: string[] = ["@startuml", `title ${diagram.name}`];
  if (diagram.layout.direction === "LR" && diagram.type !== "sequence") lines.push("left to right direction");

  switch (diagram.type) {
    case "class":
      for (const el of diagram.elements) lines.push(...classifier(el, a(el.id)));
      for (const r of diagram.relationships) lines.push(classRel(r, a));
      break;
    case "useCase": {
      for (const el of diagram.elements.filter((e) => e.kind === "actor")) lines.push(`actor ${q(el.name)} as ${a(el.id)}`);
      lines.push(`rectangle ${q(diagram.systemName || "System")} {`);
      for (const el of diagram.elements.filter((e) => e.kind === "useCase")) lines.push(`  usecase ${q(el.name)} as ${a(el.id)}`);
      lines.push("}");
      for (const el of diagram.elements.filter((e) => e.kind === "note")) lines.push(`note ${q(el.name)} as ${a(el.id)}`);
      for (const r of diagram.relationships) {
        const lbl = r.label ? ` : ${r.label}` : "";
        if (r.kind === "association") lines.push(`${a(r.sourceId)} -- ${a(r.targetId)}${lbl}`);
        else if (r.kind === "include") lines.push(`${a(r.sourceId)} ..> ${a(r.targetId)} : <<include>>`);
        else if (r.kind === "extend") lines.push(`${a(r.sourceId)} ..> ${a(r.targetId)} : <<extend>>${r.label ? ` ${r.label}` : ""}`);
        else if (r.kind === "generalization") lines.push(`${a(r.sourceId)} --|> ${a(r.targetId)}`);
        else if (r.kind === "anchor") lines.push(`${a(r.sourceId)} .. ${a(r.targetId)}`);
      }
      break;
    }
    case "sequence":
      for (const el of diagram.elements) {
        if (el.kind !== "lifeline") continue;
        const name = el.classifier ? `${el.name} : ${el.classifier}` : el.name;
        lines.push(`${el.participantType === "actor" ? "actor" : "participant"} ${q(name)} as ${a(el.id)}`);
      }
      for (const r of diagram.relationships) {
        if (r.kind !== "message") continue;
        const arrow = r.messageType === "reply" ? "-->" : r.messageType === "async" ? "->>" : "->";
        if (r.messageType === "create") lines.push(`create ${a(r.targetId)}`);
        lines.push(`${a(r.sourceId)} ${arrow} ${a(r.targetId)} : ${r.label ?? ""}`);
      }
      break;
    case "activity":
      lines.push(...activityAsStates(diagram, a, losses));
      break;
  }
  lines.push("@enduml");
  return { text: lines.join("\n"), losses };
}

function classifier(el: UmlElement, id: string): string[] {
  if (el.kind === "note") return [`note ${q(el.name)} as ${id}`];
  if (el.kind === "enumeration") return [`enum ${q(el.name)} as ${id} {`, ...el.literals.map((l) => `  ${l}`), "}"];
  if (el.kind !== "class" && el.kind !== "interface") return [];
  const head = el.kind === "interface" ? "interface" : el.isAbstract ? "abstract class" : "class";
  const st = el.stereotype ? ` <<${el.stereotype}>>` : "";
  return [
    `${head} ${q(el.name)} as ${id}${st} {`,
    ...el.attributes.map((x) => `  ${x.isStatic ? "{static} " : ""}${formatAttribute(x).replace(/^(.) /, "$1")}`),
    ...el.operations.map((o) => `  ${o.isStatic ? "{static} " : ""}${o.isAbstract ? "{abstract} " : ""}${formatOperation(o).replace(/^(.) /, "$1")}`),
    "}",
  ];
}

function classRel(r: Relationship, a: (id: string) => string): string {
  const sm = r.sourceMultiplicity ? ` "${r.sourceMultiplicity}"` : "";
  const tm = r.targetMultiplicity ? `"${r.targetMultiplicity}" ` : "";
  const lbl = r.label || r.targetRole ? ` : ${r.label || r.targetRole}` : "";
  const arrow: Record<string, string> = {
    association: r.navigable ? "-->" : "--",
    aggregation: "o--",
    composition: "*--",
    generalization: "--|>",
    realization: "..|>",
    dependency: "..>",
    anchor: "..",
  };
  return `${a(r.sourceId)}${sm} ${arrow[r.kind] ?? "--"} ${tm}${a(r.targetId)}${lbl}`;
}

/** Activity graphs may be unstructured, so they are exported as PlantUML state-style nodes. */
function activityAsStates(diagram: Diagram, a: (id: string) => string, losses: string[]): string[] {
  const out: string[] = [];
  const byId = new Map(diagram.elements.map((e) => [e.id, e]));
  const ref = (id: string) => {
    const el = byId.get(id);
    if (!el) return id;
    if (el.kind === "initial" || el.kind === "final") return "[*]";
    return a(id);
  };
  for (const el of diagram.elements) {
    if (el.kind === "action") out.push(`state ${q(el.name)} as ${a(el.id)}`);
    if (el.kind === "decision" || el.kind === "merge") out.push(`state ${a(el.id)} <<choice>>`);
    if (el.kind === "fork") out.push(`state ${a(el.id)} <<fork>>`);
    if (el.kind === "join") out.push(`state ${a(el.id)} <<join>>`);
    if (el.kind === "note") out.push(`note ${q(el.name)} as ${a(el.id)}`);
  }
  for (const r of diagram.relationships) {
    if (r.kind !== "controlFlow") continue;
    out.push(`${ref(r.sourceId)} --> ${ref(r.targetId)}${r.guard ? ` : [${r.guard.replace(/^\[|\]$/g, "")}]` : ""}`);
  }
  losses.push("Activity diagram exported using PlantUML state notation; action/decision semantics are approximated.");
  return out;
}
