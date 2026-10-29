"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import type { AssumptionCategory, Diagram } from "@/lib/uml/types";
import type { AiDiagram, DetailLevel } from "@/lib/uml/ai-schema";
import { aiToDiagram, diagramToAiInput, type ConversionReport } from "@/lib/uml/ai-convert";
import { autoLayout } from "@/lib/uml/layout";
import { validateDiagram, summarize } from "@/lib/uml/validate";
import { Button, Field, inputCls } from "@/components/ui/fields";

const PLACEHOLDER: Record<Diagram["type"], string> = {
  class: "Design an online shopping system with customers, products, carts, orders, and payments. Include attributes, operations, relationships, multiplicities and visibility.",
  useCase: "A library system where members search, borrow, reserve and return books; librarians manage inventory; overdue returns incur fines paid via an external payment provider.",
  sequence: "Show how a customer checks out a cart: the web UI calls OrderService, which validates stock and calls PaymentService, which charges a PaymentGateway.",
  activity: "Order fulfillment: receive and validate the order; if invalid notify the customer; otherwise process payment and reserve inventory in parallel, then ship.",
};

const CATEGORY_STYLE: Record<AssumptionCategory, string> = {
  explicit: "bg-emerald-100 text-emerald-800",
  inferred: "bg-violet-100 text-violet-800",
  question: "bg-amber-100 text-amber-800",
  recommendation: "bg-sky-100 text-sky-800",
};

interface Props {
  diagram: Diagram;
  requirements: string;
  onCommit: (d: Diagram) => void;
}

export function AiPanel({ diagram, requirements, onCommit }: Props) {
  const [prompt, setPrompt] = useState("");
  const [detail, setDetail] = useState<DetailLevel>("intermediate");
  const [mode, setMode] = useState<"generate" | "refine">(diagram.elements.length ? "refine" : "generate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary: string; report: ConversionReport; counts: ReturnType<typeof summarize> } | null>(null);
  const [status, setStatus] = useState<{ configured: boolean; provider: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/generate").then((r) => r.json()).then(setStatus).catch(() => setStatus({ configured: false, provider: null }));
  }, []);

  useEffect(() => {
    setMode(diagram.elements.length ? "refine" : "generate");
    setResult(null);
    setError(null);
  }, [diagram.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const refine = mode === "refine" && diagram.elements.length > 0;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagramType: diagram.type,
          prompt: prompt || PLACEHOLDER[diagram.type],
          requirements,
          detailLevel: detail,
          current: refine ? diagramToAiInput(diagram) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const ai = data.result as AiDiagram;
      const base = refine ? diagram : { ...diagram, elements: [], relationships: [] };
      const { diagram: next, report } = aiToDiagram(ai, diagram.type, base);
      if (!refine) report.removed = diagram.elements.map((e) => e.name || e.kind);
      const laidOut = autoLayout(next, { onlyMissing: refine });
      onCommit(laidOut);
      setResult({ summary: ai.summary, report, counts: summarize(validateDiagram(laidOut)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const setAssumption = (id: string, status: "accepted" | "rejected" | "pending") =>
    onCommit({ ...diagram, assumptions: diagram.assumptions.map((a) => (a.id === id ? { ...a, status } : a)) });

  return (
    <div className="space-y-3 p-3">
      {status && !status.configured && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-900">
          AI is not configured on the server. Set <code>OPENAI_API_KEY</code> or <code>ANTHROPIC_API_KEY</code> and restart. Manual editing and examples still work.
        </div>
      )}
      <div className="flex rounded border border-slate-300 p-0.5 text-[12px]">
        {(["generate", "refine"] as const).map((m) => (
          <button
            key={m}
            disabled={m === "refine" && diagram.elements.length === 0}
            onClick={() => setMode(m)}
            className={clsx("flex-1 rounded px-2 py-1 disabled:opacity-40", mode === m ? "bg-blue-600 text-white" : "text-slate-700")}
          >
            {m === "generate" ? "Generate new" : "Refine current"}
          </button>
        ))}
      </div>
      <Field label={mode === "refine" ? "Instruction" : "Requirements prompt"}>
        <textarea
          aria-label="AI prompt"
          className={inputCls}
          rows={6}
          value={prompt}
          placeholder={mode === "refine" ? "e.g. Add a Coupon class that can be applied to an Order. Make Payment an interface." : PLACEHOLDER[diagram.type]}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </Field>
      <Field label="Detail level">
        <select className={inputCls} value={detail} onChange={(e) => setDetail(e.target.value as DetailLevel)}>
          <option value="beginner">Beginner – essentials only</option>
          <option value="intermediate">Intermediate – attributes, operations, multiplicities</option>
          <option value="professional">Professional – full signatures, constraints, stereotypes</option>
        </select>
      </Field>
      {requirements.trim() && <p className="text-[11px] text-slate-500">Project requirements are included as context.</p>}
      <Button variant="primary" className="w-full" onClick={run} disabled={busy || (mode === "refine" && !prompt.trim())}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {busy ? "Generating…" : mode === "refine" ? "Apply to diagram" : "Generate diagram"}
      </Button>
      {mode === "generate" && diagram.elements.length > 0 && (
        <p className="text-[11px] text-slate-500">Generating replaces the current content. You can undo with Ctrl+Z.</p>
      )}
      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-[12px] text-red-800">{error}</div>}
      {result && (
        <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2 text-[12px] text-slate-700" data-testid="ai-result">
          <p>{result.summary}</p>
          <p>
            Added {result.report.added.length}, modified {result.report.modified.length}, removed {result.report.removed.length}.
            Validation: {result.counts.errors} errors, {result.counts.warnings} warnings.
          </p>
          {result.report.dropped.length > 0 && <p className="text-amber-700">Ignored unsupported output: {result.report.dropped.join("; ")}</p>}
        </div>
      )}

      <section className="pt-2">
        <h4 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-600">Assumptions &amp; questions</h4>
        {diagram.assumptions.length === 0 ? (
          <p className="text-[12px] text-slate-500">AI-generated assumptions will appear here for you to accept or reject.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="assumptions">
            {diagram.assumptions.map((a) => (
              <li key={a.id} className={clsx("rounded border border-slate-200 p-2 text-[12px]", a.status === "rejected" && "opacity-50 line-through")}>
                <div className="mb-1 flex items-center justify-between">
                  <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", CATEGORY_STYLE[a.category])}>{a.category}</span>
                  <div className="flex gap-1">
                    <button aria-label="Accept assumption" title="Accept" onClick={() => setAssumption(a.id, a.status === "accepted" ? "pending" : "accepted")} className={clsx("rounded p-0.5", a.status === "accepted" ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-50")}>
                      <Check size={13} />
                    </button>
                    <button aria-label="Reject assumption" title="Reject" onClick={() => setAssumption(a.id, a.status === "rejected" ? "pending" : "rejected")} className={clsx("rounded p-0.5", a.status === "rejected" ? "bg-red-600 text-white" : "text-red-700 hover:bg-red-50")}>
                      <X size={13} />
                    </button>
                  </div>
                </div>
                <p className="text-slate-700">{a.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
