import { NextResponse } from "next/server";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { aiDiagramSchema, generateRequestSchema } from "@/lib/uml/ai-schema";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { getModel } from "@/lib/ai/provider";

export const maxDuration = 120;

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_REQUESTS;
}

export async function GET() {
  const m = getModel();
  return NextResponse.json({ configured: !!m, provider: m?.name ?? null });
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many generation requests. Please wait a minute." }, { status: 429 });
  }

  const parsed = generateRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }
  const { diagramType, prompt, requirements, detailLevel, current } = parsed.data;

  const m = getModel();
  if (!m) {
    return NextResponse.json(
      { error: "AI generation is not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY on the server." },
      { status: 503 },
    );
  }

  try {
    const { output } = await generateText({
      model: m.model,
      instructions: buildSystemPrompt(diagramType, detailLevel),
      prompt: buildUserPrompt({ prompt, requirements, current }),
      output: Output.object({ schema: aiDiagramSchema }),
      maxRetries: 1,
    });
    return NextResponse.json({ result: output });
  } catch (err) {
    console.error("AI generation failed", err);
    const message = NoObjectGeneratedError.isInstance(err)
      ? "The model did not return a valid diagram. Try rephrasing or simplifying the request."
      : "AI generation failed. Your existing diagram was not changed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
