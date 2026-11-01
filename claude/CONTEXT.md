# Context for Claude Code: read this first, then plan.md

## Situation
We're a student team at **LarpHacks** (Toronto, Nov 1, 2026). Theme: **build something that helps engineers LARP as someone they're not.** Hard submission cutoff **6:00 PM Toronto time**; feature freeze at **4:00 PM**. Each team gets a 2-minute demo + 2-minute Q&A.

Judging (5 pts each): Working Product, Usefulness, Theme Alignment, Creativity, Ease of Use, Demo. **A smooth, working demo of fewer features beats a broken demo of many.**

## The product: Receipts
An AI cofounder for the business side, for students and junior engineers who went all in on a big project and don't know how to market it. It helps them LARP as a confident, experienced startup founder:

- **Upward (network):** finds founders in their space, angels/VC scouts, accelerator staff, eng leaders, and community leads via Apollo, ranks them with a one-line reason, and drafts founder-style intro emails, connection notes and LinkedIn posts.
- **Downward (users):** infers 2–3 candidate user audiences from the repo, finds people in each via Apollo, sends short feedback/early-access emails with tracked links to a landing page + waitlist, and reports which audience (niche) responds best.
- **Flywheel:** real user signal (signups, positive replies) becomes new true facts that strengthen upward pitches and posts.
- **Proactive:** a coach worker reacts to triggers (GitHub push, daily schedule, email reply, link click, signup) and fills an approval queue. A daily brief email lets the owner approve by replying ("send 1 3").

## Non-negotiable rules
1. **Facts only.** Outputs have founder swagger (confident, problem-first, no hedging) but never invent users, revenue, funding or credentials. Every claim must map to a row in `facts`; a receipt-check pass enforces it.
2. **Nothing is sent without owner approval.**
3. **One sponsor integration only: Agentboxd.** It's the coach's inbox for all outreach, replies and the daily brief. **No ElevenLabs** or other sponsor tech. Apollo, GitHub and Anthropic are fine (not sponsors).
4. **No LinkedIn automation or scraping.** Posts/connection notes are drafts with Copy + Open LinkedIn.
5. **`DEMO_MODE=true` blocks sending to any address not on the team allowlist.** Never weaken this.

## Decisions already made (don't revisit)
- Next.js App Router + TypeScript + Tailwind; Node worker in the same repo; Postgres + Drizzle; pg-boss for queue and schedules; Anthropic SDK with zod-validated JSON outputs.
- Routes/webhooks never call LLMs or external APIs directly: they write an `events` row and enqueue a job.
- Coach = deterministic event→handler routing + focused LLM calls, not a free-roaming agent.
- No embeddings/pgvector; the LLM ranks contacts directly.
- No auth: single demo owner via `OWNER_EMAIL`.
- Cut: ElevenLabs, n8n, LinkedIn API, embeddings. Cut order if behind is in plan.md §9.

## Integration facts we've already confirmed
- **Apollo:** API works on the free tier. People search is free (0 credits) but returns **no emails**; emails come from the enrichment endpoints, which cost credits. Use `POST https://api.apollo.io/api/v1/mixed_people/api_search` with the `x-api-key` header (Apollo's in-app assistant gave an older `/v1/mixed_people/search` + `api_key` param form, which is outdated). Free accounts need a work-email registration for some endpoints. Credits aren't a concern: real enrichment runs once at demo time; use seeded data in `DEMO_MODE` until then.
- **Agentboxd:** real email inboxes for AI agents. Official TS SDK `agentboxd` on npm, API key from their dashboard (starts with `mr_`, Free plan, no card). Supports creating inboxes, send/reply in threads, webhooks or polling, and labels for injection risk/phishing. Docs: https://agentboxd.com/docs/api.
- **Hosting:** Render, with $50 of hackathon credits. Web service, background worker, Postgres and Cron Jobs are all fair game. The team handles deployment.

## How to work
- Follow plan.md for structure, schema, job names and the adapter interfaces in `lib/`. The schema and job names are the shared contract between four teammates; don't rename them without saying so.
- Build external integrations (`apollo.ts`, `mail.ts`) behind the typed interfaces in plan.md, with a fallback that returns seeded data when `DEMO_MODE` is on, so the rest of the app never blocks on them.
- Prefer simple, working code over abstraction. Small commits. Ask before adding a new dependency or service.

## First tasks
1. Scaffold the repo exactly as plan.md describes: Next.js app, Drizzle schema from §3, pg-boss worker with stub handlers for every job in §5, `lib/llm.ts`, `lib/apollo.ts`, `lib/mail.ts`, `lib/github.ts` with the interfaces from §6, `.env.example` from §7.
2. Implement the four adapters for real (they're small), then write and run the smoke tests in plan.md §8b in order. Report a pass/fail table. Do **not** run `apollo-enrich` without being told to (it spends a credit). Tests 9 and 10 need a teammate to reply to an email / push a commit, so pause and ask when you reach them.
3. Stop and summarize what works, what's stubbed, and anything that failed, so each teammate can take their section.
