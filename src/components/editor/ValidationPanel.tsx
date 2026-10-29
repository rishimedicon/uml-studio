"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import type { Severity, ValidationIssue } from "@/lib/uml/types";
import type { Selection } from "./types";

const GROUPS: { severity: Severity; title: string; icon: React.ReactNode; cls: string }[] = [
  { severity: "error", title: "Errors", icon: <AlertCircle size={14} />, cls: "text-red-700 bg-red-50 border-red-200" },
  { severity: "warning", title: "Warnings", icon: <AlertTriangle size={14} />, cls: "text-amber-800 bg-amber-50 border-amber-200" },
  { severity: "suggestion", title: "Suggestions", icon: <Lightbulb size={14} />, cls: "text-sky-800 bg-sky-50 border-sky-200" },
];

export function ValidationPanel({ issues, onSelect }: { issues: ValidationIssue[]; onSelect: (s: Selection) => void }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-emerald-700">
        <CheckCircle2 size={16} /> No problems found.
      </div>
    );
  }
  return (
    <div className="space-y-4 p-3" data-testid="validation-report">
      <p className="text-[12px] text-slate-500">
        Errors are UML rule violations. Warnings indicate likely modeling gaps. Suggestions are optional design recommendations.
      </p>
      {GROUPS.map((g) => {
        const items = issues.filter((i) => i.severity === g.severity);
        if (!items.length) return null;
        return (
          <section key={g.severity}>
            <h4 className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-600">
              {g.icon} {g.title} ({items.length})
            </h4>
            <ul className="space-y-1.5">
              {items.map((i, idx) => {
                const target: Selection = i.elementIds?.[0]
                  ? { type: "element", id: i.elementIds[0] }
                  : i.relationshipIds?.[0]
                    ? { type: "relationship", id: i.relationshipIds[0] }
                    : null;
                return (
                  <li key={idx}>
                    <button
                      className={`w-full rounded border px-2 py-1.5 text-left text-[12.5px] leading-snug ${g.cls} ${target ? "hover:brightness-95" : "cursor-default"}`}
                      onClick={() => target && onSelect(target)}
                    >
                      {i.message}
                      <span className="ml-1 text-[10px] opacity-60">[{i.rule}]</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
