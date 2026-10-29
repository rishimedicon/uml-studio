"use client";

import { toPng, toSvg } from "html-to-image";
import { z } from "zod";
import type { Project } from "@/lib/uml/types";
import { DIAGRAM_TYPES } from "@/lib/uml/types";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function downloadText(text: string, filename: string, mime = "text/plain") {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram";

const filter = (node: HTMLElement) =>
  !(node.classList?.contains("react-flow__handle") || node.classList?.contains("react-flow__minimap") || node.classList?.contains("react-flow__controls"));

/** Renders a region of an element (e.g. the React Flow viewport) to PNG or SVG, framing the given bounds. */
export async function exportElementImage(
  el: HTMLElement,
  format: "png" | "svg",
  frame: { width: number; height: number; transform?: string },
) {
  const opts = {
    backgroundColor: "#ffffff",
    width: frame.width,
    height: frame.height,
    pixelRatio: 2,
    filter,
    style: frame.transform
      ? { width: `${frame.width}px`, height: `${frame.height}px`, transform: frame.transform }
      : undefined,
  };
  return format === "png" ? toPng(el, opts) : toSvg(el, opts);
}

const elementSchema = z.looseObject({ id: z.string(), kind: z.string(), name: z.string() });
const relationshipSchema = z.looseObject({ id: z.string(), kind: z.string(), sourceId: z.string(), targetId: z.string() });
const diagramSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.enum(DIAGRAM_TYPES),
  elements: z.array(elementSchema),
  relationships: z.array(relationshipSchema),
  layout: z.object({ direction: z.enum(["TB", "LR"]) }).catch({ direction: "TB" }),
  assumptions: z.array(z.any()).catch([]),
  modelVersion: z.number().catch(1),
});
export const projectFileSchema = z.object({
  format: z.literal("uml-studio-ai/project"),
  version: z.literal(1),
  project: z.looseObject({
    id: z.string(),
    name: z.string(),
    description: z.string().catch(""),
    requirements: z.string().catch(""),
    diagrams: z.array(diagramSchema),
  }),
});

export function serializeProject(project: Project) {
  return JSON.stringify({ format: "uml-studio-ai/project", version: 1, project }, null, 2);
}

export function parseProjectFile(text: string): Project {
  const data = projectFileSchema.parse(JSON.parse(text));
  const ts = new Date().toISOString();
  return { createdAt: ts, updatedAt: ts, ...data.project } as unknown as Project;
}
