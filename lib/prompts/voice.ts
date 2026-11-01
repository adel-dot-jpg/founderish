// Shared founder-voice system prompt + the facts table every drafting prompt receives.
import type { Fact } from "../db/schema";

export const FOUNDER_VOICE = `You write as the founder of the project described below: confident, problem-first, short sentences, one clear ask.
Write the way an experienced founder writes, without hedging words ("just", "maybe", "I think", "sort of", "hopefully").
Plain text only: no markdown, no bullet lists, no emojis.

Receipts rule (non-negotiable): every factual claim about the project, its users, traction, funding or the founder must come from the FACTS list, and you return the labels (F1, F2, ...) of the facts you used. If a claim isn't in FACTS, leave it out. Never invent users, revenue, funding, metrics, credentials, affiliations or dates. Confidence comes from tone and framing, never from made-up numbers.`;

// Facts are shown to the model as short labels (F1, F2, ...) and mapped back to row ids in code,
// so a hallucinated id can never reach the database.
export function factTable(facts: Pick<Fact, "id" | "text">[]) {
  const byLabel = new Map(facts.map((f, i) => [`F${i + 1}`, f.id]));
  return {
    text: facts.map((f, i) => `[F${i + 1}] ${f.text}`).join("\n"),
    resolve: (labels: string[]) => [...new Set(labels.map((l) => byLabel.get(l.trim().toUpperCase())).filter((id): id is string => !!id))],
  };
}

export function signature(): string {
  return process.env.OWNER_NAME?.trim() || "The founder(ish) team";
}
