// LLM wrapper (Gemini). Everything LLM-shaped goes through callJSON so outputs are always zod-validated.
// To change provider, rewrite this file only; callers depend on callJSON's signature, not the SDK.
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

// Free tier: 5 requests/minute and 20/day *per model*. Each chain falls through to the next model when one
// is out of quota. "smart" writes (facts, audiences, drafts); "fast" judges (rank, receipt check, classify).
const chain = (...models: (string | undefined)[]) => [...new Set(models.filter((m): m is string => !!m))];
const CHAINS = {
  smart: chain(process.env.GEMINI_MODEL, "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-3.7-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"),
  fast: chain(process.env.GEMINI_FAST_MODEL, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.6-flash"),
};
export const MODEL = CHAINS.smart[0];

// Raise GEMINI_RPM once billing is on.
const RPM = Number(process.env.GEMINI_RPM ?? 5);
const nextSlot = new Map<string, number>();
const exhaustedUntil = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForSlot(model: string) {
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(model) ?? 0);
  nextSlot.set(model, slot + 60_000 / RPM);
  if (slot > now) await sleep(slot - now);
}

function pickModel(models: string[]): string | null {
  return models.find((m) => (exhaustedUntil.get(m) ?? 0) <= Date.now()) ?? null;
}

function retryDelayMs(err: ApiError): number {
  const m = err.message.match(/retry in ([\d.]+)s/i) ?? err.message.match(/"retryDelay":"(\d+)s"/);
  return (m ? Number(m[1]) : 15) * 1000 + 500;
}

let client: GoogleGenAI | null = null;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

export class LLMError extends Error {}

export async function callJSON<S extends z.ZodType>(opts: {
  prompt: string;
  schema: S;
  system?: string;
  maxTokens?: number;
  model?: keyof typeof CHAINS;
}): Promise<z.infer<S>> {
  const models = CHAINS[opts.model ?? "smart"];
  let lastError = "";
  let invalid = 0;

  for (let attempt = 0; attempt < 10 && invalid < 2; attempt++) {
    const model = pickModel(models);
    if (!model) throw new LLMError(`Every Gemini model is out of quota (${models.join(", ")}). Enable billing or wait for the daily reset.`);
    await waitForSlot(model);

    let response;
    try {
      response = await gemini().models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          httpOptions: { timeout: 60_000 }, // a hung request must not stall the job
          systemInstruction: opts.system,
          maxOutputTokens: opts.maxTokens ?? 16000,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(opts.schema),
        },
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 429 || err.status >= 500)) {
        const wait = err.status === 429 ? retryDelayMs(err) : 3000;
        if (wait > 90_000) {
          // Daily quota gone: skip this model until it resets.
          exhaustedUntil.set(model, Date.now() + wait);
          console.warn(`[llm] ${model} out of quota for ${Math.round(wait / 3_600_000)}h, falling back`);
        } else {
          nextSlot.set(model, Date.now() + wait);
          console.warn(`[llm] ${model} ${err.status}, retrying in ${Math.round(wait / 1000)}s`);
        }
        lastError = `${err.status} from ${model}`;
        continue;
      }
      throw err;
    }

    const blocked = response.promptFeedback?.blockReason;
    if (blocked) throw new LLMError(`Prompt blocked: ${blocked}`);
    // Off-schema or truncated output gets one more try.
    invalid++;
    const text = response.text;
    if (!text) {
      lastError = `empty response from ${model} (finishReason ${response.candidates?.[0]?.finishReason})`;
      continue;
    }
    try {
      const parsed = opts.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastError = `output from ${model} did not match the schema: ${parsed.error.message}`;
    } catch {
      lastError = `output from ${model} was not valid JSON`;
    }
  }
  throw new LLMError(lastError);
}
