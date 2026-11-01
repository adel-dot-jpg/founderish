// LLM wrapper (Gemini). Everything LLM-shaped goes through callJSON so outputs are always zod-validated.
// To change provider, rewrite this file only; callers depend on callJSON's signature, not the SDK.
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";

// "smart" for writing (facts, audiences, drafts), "fast" for judging (rank, receipt check).
// Each model has its own free-tier quota, so splitting work across two doubles throughput.
export const MODELS = {
  smart: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  fast: process.env.GEMINI_FAST_MODEL ?? "gemini-3.5-flash-lite",
};
export const MODEL = MODELS.smart;

// Free tier is 5 requests/minute per model. Raise GEMINI_RPM once billing is on.
const RPM = Number(process.env.GEMINI_RPM ?? 5);
const nextSlot = new Map<string, number>();

async function waitForSlot(model: string) {
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(model) ?? 0);
  nextSlot.set(model, slot + 60_000 / RPM);
  if (slot > now) await sleep(slot - now);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  model?: keyof typeof MODELS;
}): Promise<z.infer<S>> {
  const model = MODELS[opts.model ?? "smart"];
  let lastError = "";
  let invalid = 0;

  for (let attempt = 0; attempt < 6 && invalid < 2; attempt++) {
    await waitForSlot(model);
    let response;
    try {
      response = await gemini().models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          maxOutputTokens: opts.maxTokens ?? 16000,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(opts.schema),
        },
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 429 || err.status >= 500)) {
        const wait = err.status === 429 ? retryDelayMs(err) : 3000;
        console.warn(`[llm] ${model} ${err.status}, retrying in ${Math.round(wait / 1000)}s`);
        nextSlot.set(model, Date.now() + wait);
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
      lastError = `empty response (finishReason ${response.candidates?.[0]?.finishReason})`;
      continue;
    }
    try {
      const parsed = opts.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastError = `output did not match the schema: ${parsed.error.message}`;
    } catch {
      lastError = "output was not valid JSON";
    }
  }
  throw new LLMError(lastError);
}
