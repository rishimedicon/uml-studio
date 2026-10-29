import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

export function getModel() {
  const configured = process.env.AI_PROVIDER?.toLowerCase();
  const provider = configured ?? (process.env.OPENAI_API_KEY ? "openai" : process.env.ANTHROPIC_API_KEY ? "anthropic" : null);
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return { name: "openai", model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(process.env.AI_MODEL || "gpt-5.5") };
  }
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return { name: "anthropic", model: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(process.env.AI_MODEL || "claude-sonnet-5-5") };
  }
  return null;
}
