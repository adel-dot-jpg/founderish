import { z } from "zod";
import { run } from "./_util";
import { callJSON, MODEL } from "@/lib/llm";

run("llm", async () => {
  const out = await callJSON({
    prompt: "Name a fictional developer-tools startup and give a one-sentence pitch.",
    schema: z.object({ name: z.string(), pitch: z.string() }),
    maxTokens: 2000,
  });
  return `${MODEL} -> ${JSON.stringify(out)}`;
});
