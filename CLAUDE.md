@AGENTS.md

Read `claude/CONTEXT.md`, then `claude/plan.md`, before changing anything. They hold the product rules (facts only, owner approval, DEMO_MODE guard, Agentboxd as the only sponsor integration) and the shared contract: `lib/db/schema.ts` and the job names in `lib/queue.ts`.

- Routes and webhooks never call LLMs, Apollo or Agentboxd directly: `recordEvent()` then `enqueue()`.
- All LLM calls go through `callJSON()` in `lib/llm.ts`. Drafting prompts use `FOUNDER_VOICE` + `formatFacts()` from `lib/prompts/voice.ts`.
- Pages read the DB inside an async component wrapped in `<Suspense>` (Cache Components is on).
- Imports use the `@/` alias everywhere, including the worker and scripts.
