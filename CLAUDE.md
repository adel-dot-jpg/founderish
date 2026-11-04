@AGENTS.md

Read `claude/CONTEXT.md`, then `claude/plan.md`, before changing anything. They're the original hackathon brief: the product rules (facts only, owner approval, DEMO_MODE guard, no LinkedIn automation) still hold, and README.md describes where the build differs (Gemini instead of Anthropic, built solo). The data model is `lib/db/schema.ts` and the job contract is the job names in `lib/queue.ts`.

- Routes and webhooks never call LLMs, Apollo or Agentboxd directly: `recordEvent()` then `enqueue()`.
- All LLM calls go through `callJSON()` in `lib/llm.ts`. Drafting prompts use `FOUNDER_VOICE` + `factTable()` from `lib/prompts/voice.ts`.
- Pages read the DB inside an async component wrapped in `<Suspense>` (Cache Components is on).
- Imports use the `@/` alias everywhere, including the worker and scripts.
