// LLM wrapper (Gemini). Everything LLM-shaped goes through callJSON so outputs are always zod-validated.
// To change provider, rewrite this file only; callers depend on callJSON's signature, not the SDK.
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";

let client: GoogleGenAI | null = null;
const gemini = () => (client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));

export class LLMError extends Error {}

export async function callJSON<S extends z.ZodType>(opts: {
  prompt: string;
  schema: S;
  system?: string;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  let lastError = "";
  // One retry: structured output occasionally comes back truncated or off-schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await gemini().models.generateContent({
      model: MODEL,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        maxOutputTokens: opts.maxTokens ?? 16000,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(opts.schema),
      },
    });

    const blocked = response.promptFeedback?.blockReason;
    if (blocked) throw new LLMError(`Prompt blocked: ${blocked}`);
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
