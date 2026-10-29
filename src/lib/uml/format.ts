import type { Attribute, Operation } from "./types";

export function formatAttribute(a: Attribute): string {
  const type = a.type ? `: ${a.type}` : "";
  const def = a.defaultValue ? ` = ${a.defaultValue}` : "";
  return `${a.visibility} ${a.name}${type}${def}`;
}

export function formatOperation(o: Operation): string {
  const params = o.parameters.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(", ");
  const ret = o.returnType ? `: ${o.returnType}` : "";
  return `${o.visibility} ${o.name}(${params})${ret}`;
}

/** Extracts referenced type names from a type expression such as `List<Order>` or `Product[]`. */
export function typeReferences(type: string): string[] {
  return type
    .split(/[^A-Za-z0-9_]+/)
    .filter((t) => t.length > 0 && !/^\d/.test(t));
}
