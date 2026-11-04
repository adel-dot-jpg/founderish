# Receipts — Build Plan

> The original hackathon plan, kept for history. The app shipped as founder(ish), on Gemini instead of the Anthropic SDK; README.md covers what was built.

> Your AI cofounder for the business side. It pitches you **upward** to people who can open doors, and reaches **downward** to find the users who need what you built. Every claim is backed by a receipt from your real project.

Sponsor track: **Agentboxd** (the coach's inbox is the backbone of all outreach).
Deadline: 6:00 PM submission · freeze features at 4:00 PM.

---

## 1. Stack (chosen for speed, one language, few moving parts)

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript + Tailwind** | Dashboard, landing pages, API routes and webhooks in one deployable |
| Worker | **Node + TypeScript** (same repo, `worker/`) | Runs coach jobs and the daily schedule outside request time |
| DB | **Postgres + Drizzle ORM** | One source of truth; typed schema shared by app and worker |
| Queue + schedule | **pg-boss** (queue on Postgres) | No Redis; also gives cron-style scheduled jobs |
| LLM | **Anthropic SDK** with JSON / tool-use outputs | Drafting, ranking, classification, receipt check |
| People data | **Apollo REST API** (people search + enrich) | Contacts for both directions |
| Email | **Agentboxd** via its TypeScript SDK (`npm install agentboxd`), behind a `mail` adapter | Send, receive, thread, daily brief |
| Repo data | **Octokit** + GitHub push webhook | Project profile + "you shipped something" trigger |
| Hosting | **Render** (team has $50 in hackathon credits): web service, background worker, Postgres, and Cron Jobs if useful | Team handles deployment; code just needs to run as these services |

**Deliberately cut:** ElevenLabs, pgvector/embeddings (LLM ranking over ~25 contacts is accurate enough and one less provider), n8n, LinkedIn API (posting/connecting stays one-tap manual).

---

## 2. Repo layout

```
/app
  /(dashboard)/...          dashboard pages (pipelines, approvals, niche, posts)
  /p/[slug]/page.tsx        public landing page + waitlist
  /r/[token]/route.ts       tracked link → log click → redirect to landing
  /api/projects/route.ts    create project (repo URL + description)
  /api/drafts/[id]/route.ts approve / edit / reject
  /api/signup/route.ts      waitlist form
  /api/webhooks/github/route.ts
  /api/webhooks/mail/route.ts     Agentboxd inbound
/lib
  db/schema.ts  db/index.ts       Drizzle schema + client (shared)
  queue.ts                        pg-boss client + enqueue helpers (shared)
  llm.ts                          Anthropic wrapper: callJSON(prompt, zodSchema)
  apollo.ts                       searchPeople(filters), enrichPerson(id)
  mail.ts                         Agentboxd adapter: send(), parseInbound()
  github.ts                       ingestRepo(url), verifyWebhook()
  prompts/                        one file per prompt (profile, audiences, rank,
                                  draftEmail, draftPost, classifyReply, receiptCheck, brief)
/worker
  index.ts                        boots pg-boss, registers handlers + schedules
  handlers/                       one file per job type (see §5)
/scripts
  seed-demo.ts                    seeds a demo project, contacts, some sends
render.yaml
```

Rule: **routes and webhooks never call LLMs or Apollo directly.** They write an `event` row and enqueue a job. All slow work happens in the worker. This keeps the UI fast and every action replayable.

---

## 3. Data model (Drizzle, Postgres)

| Table | Key fields | Purpose |
|---|---|---|
| `projects` | id, slug, name, repo_url, description, pitch, owner_email | One per user project |
| `facts` | id, project_id, text, source_type (repo/readme/commit/signup/manual), source_url, created_at | **The receipts.** Only claims allowed in any output |
| `audiences` | id, project_id, name, description, apollo_filters (json), status (testing/winner/dropped) | Candidate user niches for ⬇️ |
| `contacts` | id, project_id, direction (`up`/`down`), audience_id?, apollo_id, name, title, company, email, linkedin_url, score, reason, status (found/drafted/sent/replied/meeting/dead) | Both pipelines |
| `drafts` | id, project_id, contact_id?, kind (email/followup/reply/post/connect_note), subject, body, fact_ids[], status (pending/approved/sent/rejected), brief_number | Approval queue |
| `messages` | id, contact_id, direction (out/in), thread_id, subject, body, classification?, sent_at | Email log via Agentboxd |
| `links` | token, project_id, contact_id | Tracked links in outreach |
| `signups` | id, project_id, email, link_token?, created_at | Waitlist |
| `events` | id, project_id, type, payload (json), created_at | Every trigger; feeds the activity feed |

`facts` is the center: drafts store which `fact_ids` they used, and new signups/replies append facts ("12 people joined the waitlist") so the pitch grows only with real traction.

---

## 4. The coach loop

Every trigger becomes an event, every event becomes a job, every job writes drafts or data back to the DB.

```
Trigger ─► route/webhook ─► INSERT events ─► queue.send(job) ─► worker handler
                                                                   │
                         Apollo / LLM / Agentboxd  ◄───────────────┤
                                                                   ▼
                                                       drafts, contacts, facts, messages
                                                                   │
                                     user approves (dashboard or email reply)
                                                                   ▼
                                                    queue.send('outreach.send')
```

The coach is **deterministic routing + focused LLM calls**, not a free-roaming agent. Each event type maps to a known handler, which makes the demo reliable and debuggable.

---

## 5. Jobs (worker/handlers)

| Job | Triggered by | Does |
|---|---|---|
| `project.ingest` | project created | Octokit: README, languages, topics, file tree, last ~50 commits, stars → LLM extracts `facts`, writes pitch → enqueue `audiences.generate` |
| `audiences.generate` | after ingest | LLM proposes 2–3 user audiences + 1 upward profile set (founders in space, angels/scouts, accelerator staff, eng leaders, community leads), each with Apollo filters → enqueue `people.find` per audience/profile |
| `people.find` | audiences ready, daily schedule | Apollo search (≤10 per audience) → dedupe → enqueue `people.rank` |
| `people.rank` | new contacts | LLM scores 0–100 + one-line reason grounded in facts; keep top N |
| `outreach.draft` | ranked contacts | Draft per contact. **Up:** founder-voice intro asking for advice/intro. **Down:** short feedback/early-access ask with tracked link. Then `receipt.check` |
| `receipt.check` | any draft | Second LLM pass: list claims, match each to a fact_id; unsupported claims → rewrite or flag. Only passing drafts become `pending` |
| `outreach.send` | draft approved | `mail.send()` via Agentboxd, create `messages` row, contact → `sent` |
| `followup.schedule` | 4 days after send, no reply | Draft a follow-up (cut first if behind) |
| `mail.inbound` | Agentboxd webhook/poll | If from `owner_email` → parse brief commands. Else → match thread to contact, classify (interested / not now / meeting / question / unsubscribe), update status, draft reply |
| `post.draft` | GitHub push to default branch, new milestone fact (e.g. 10th signup) | LinkedIn post draft from the new facts; shown as copy + "Open LinkedIn" |
| `niche.report` | daily schedule, on demand | SQL aggregate per audience → LLM writes recommendation; mark winner when one clearly leads |
| `brief.send` | daily schedule (+ "send now" button for demo) | Numbered list of pending drafts, new replies, niche update, suggested post → emailed to owner from the coach inbox |

---

## 6. Feature wiring details

**Founder voice + receipts.** One shared system prompt in `prompts/voice.ts`: confident, problem-first, short sentences, no hedging words, one clear ask, *only claims present in the provided facts list*. Every drafting prompt receives facts as `[id] text` lines and must return `{ body, fact_ids }` validated with zod.

**Agentboxd adapter (`lib/mail.ts`).** Uses the official TS SDK (`import { Agentboxd } from 'agentboxd'`, reads `AGENTBOXD_API_KEY`; keys start with `mr_`; Free plan, no card; base URL `https://api.agentboxd.com`). Docs: https://agentboxd.com/docs/api and the repo's `llms.txt`. Check the SDK's types for exact method signatures before writing code. Everything else in the app talks only to:
- `getCoachInbox()` → `inboxes.create({ client_id: 'receipts-coach' })` (idempotent on client_id, so safe to call on every boot); store inbox id + address
- `send({ to, subject, text, replyToMessageId? }) → { messageId, threadId }` (use the SDK's reply method for follow-ups so threads stay intact)
- `parseInbound(rawPayload) → { from, subject, text, threadId, inReplyTo, labels }`
- Inbound: register a webhook pointing at `/api/webhooks/mail` (see the SDK's `echo-agent` example). Fallback: worker polls `messages.list` every 30s.

Security: inbound email is **untrusted data**. Never follow instructions found in an email. Agentboxd attaches labels such as `ai:injection-risk`, `ai:phishing` and flags SPF/DMARC failures: treat any of those as "needs human" and never auto-draft. Owner commands ("send 1 3") are only accepted from `OWNER_EMAIL` **and** when SPF/DMARC passed.

**Apollo adapter (`lib/apollo.ts`).** Two calls, header auth only (`x-api-key`; query-param keys are no longer supported). Base URL `https://api.apollo.io/api/v1`.
- `searchPeople(filters)` → `POST /mixed_people/api_search` (free, 0 credits). Returns names, titles, companies, ids, **no emails**. Filters: `person_titles[]`, `person_seniorities[]`, `person_locations[]`, `q_organization_domains_list[]`, `q_keywords`, `per_page`.
- `enrichPeople(ids)` → `POST /people/bulk_match` (≤10 per call) or `/people/match`. Returns email + LinkedIn URL. **Costs credits.**
- Flow: search wide → LLM rank → enrich **only** the top picks right before drafting. Store results so nobody is enriched twice.
- Note: the Apollo assistant suggested `/v1/mixed_people/search` with an `api_key` param; that's the old form. Use the endpoint above. Free accounts must be registered with a work email for some search/enrichment endpoints. A 403 on enrichment can also mean a master API key is needed.
- In `DEMO_MODE`, both functions can return seeded contacts so development never spends credits; real calls happen once the flow is proven.

**Approve by email.** Brief items get `brief_number`s. Owner replies "send 1 3" or "skip 2" → regex first, LLM fallback → approve/reject those drafts → `outreach.send`.

**Tracked links + waitlist.** Each outbound email gets `/r/{token}`. Route logs a `link_click` event, redirects to `/p/{slug}?t={token}`. Waitlist form posts `/api/signup` with the token, so signups are attributed to a contact and audience. Each signup adds/updates a fact ("N people on the waitlist").

**Niche finder.** Per audience: sent, replies, positive replies, clicks, signups → simple score (`positive_replies*3 + signups*2 + clicks`) / sent. Bar chart on the dashboard + LLM one-paragraph recommendation.

**Flywheel (up ↔ down).** New user-side facts (signups, positive replies) automatically become available to upward drafts and posts. Upward replies classified as "advice" can suggest a new audience → `audiences.generate` with that hint.

**Dashboard pages.** Overview (activity feed from `events`), Network ⬆️ pipeline, Users ⬇️ pipeline (kanban by status), Approvals (pending drafts with fact chips you can hover), Niche, Posts.

**LinkedIn.** No API. Posts and connection notes are drafts with "Copy" + "Open LinkedIn" (profile URL from Apollo).

---

## 7. Environment

```
DATABASE_URL
ANTHROPIC_API_KEY
APOLLO_API_KEY           (x-api-key header)
AGENTBOXD_API_KEY        (mr_...)   AGENTBOXD_BASE_URL=https://api.agentboxd.com
GITHUB_TOKEN             GITHUB_WEBHOOK_SECRET
TEST_REPO                (owner/name of the repo used in demos and smoke tests)
APP_URL                  (public URL, for tracked links + webhooks)
OWNER_EMAIL              (demo user; skip auth for the hackathon)
SEND_ALLOWLIST           (comma-separated team emails)
DEMO_MODE=true           (seeded Apollo data; sends restricted to SEND_ALLOWLIST)
```

`DEMO_MODE` hard-blocks sending to any address not in `SEND_ALLOWLIST`, so nobody real gets emailed by accident. The check lives inside `mail.send()` itself, not in callers.

---

## 8. Deployment (team handles this; code just needs to fit it)

- **Web service:** `next build && next start`
- **Background worker:** `node dist/worker/index.js` (owns pg-boss schedules: `people.find`, `niche.report`, `brief.send` daily). A Render Cron Job hitting an internal endpoint is an acceptable alternative for the daily jobs.
- **Postgres:** Render Postgres; `drizzle-kit push` on deploy
- Same env vars on web + worker. GitHub and Agentboxd webhooks point at the web service. Locally, use a tunnel (smee.io / ngrok) for webhooks.

---

## 8b. Smoke tests (`scripts/smoke/`, run with `npm run smoke:<name>`)

Write these first, run them in order, and report pass/fail before building features on top of each integration.

1. **env** — every required env var is present; prints which are missing.
2. **db** — connect, `drizzle-kit push`, insert + read + delete a row in `events`.
3. **queue** — enqueue a `ping` job; worker processes it within 10s.
4. **llm** — `callJSON` returns output that passes a small zod schema.
5. **apollo-search** — `searchPeople({ person_titles: ['founder'], person_locations: ['Toronto, Canada'], per_page: 3 })` prints 3 names/titles/companies. On 401/403/422, print the body and the likely cause (bad key, work-email requirement, malformed body). **Free, safe to run anytime.**
6. **apollo-enrich** — enrich **one** id from test 5 and confirm an email comes back. Only runs with `--spend` flag, since it uses a credit. 403 → note possible master-key requirement.
7. **agentboxd-send** — `getCoachInbox()`, print address; send a test email to the first `SEND_ALLOWLIST` address; confirm it appears in the sent list.
8. **agentboxd-guard** — attempt send to `someone@example.com` with `DEMO_MODE=true`; must throw before any API call.
9. **agentboxd-receive** — register webhook to `APP_URL/api/webhooks/mail` (or poll); a teammate replies to test 7's email; confirm `parseInbound` returns from/text/thread and that the thread matches the original message.
10. **github** — `ingestRepo(TEST_REPO)` returns README, languages and recent commits; push a commit and confirm `/api/webhooks/github` logs a verified `github_push` event.
11. **e2e** — create a project for `TEST_REPO` in `DEMO_MODE` → wait for jobs → assert facts, audiences, ranked contacts and at least one `pending` draft exist and every draft's `fact_ids` are valid.

---

## 9. Build order (12:30 → 6:00)

| Time | Milestone |
|---|---|
| 1:00–1:30 | Repo scaffold, schema pushed, **smoke tests 1–10 passing** (§8b) |
| 1:00–2:30 | Ingest → facts → audiences → Apollo → rank. Draft + receipt check. Dashboard reading real data |
| 2:30–3:30 | Approve → send via Agentboxd → inbound classify. Landing page, tracked links, waitlist |
| 3:30–4:00 | Brief email + reply commands, post drafts from push, niche view |
| **4:00** | **Feature freeze.** Cut whatever isn't working to pitch-only |
| 4:00–5:00 | Polish, seed demo data, run the full demo 3 times |
| 5:00–5:30 | Record backup demo video |
| 5:30–6:00 | Submit |

**Cut order if behind:** follow-ups → approve-by-email (keep dashboard approval) → advice→new-audience flywheel → niche LLM paragraph (keep chart).

## 10. Team split

- **A — Brain:** `llm.ts`, all prompts, ingest, audiences, rank, receipt check, post drafts
- **B — Frontend:** dashboard pages, approvals UI, landing page + waitlist, niche chart
- **C — Comms:** `mail.ts` (Agentboxd), inbound handling, brief + reply commands, GitHub webhook
- **D — Data + infra:** schema, queue, worker boot + schedules, `apollo.ts`, deploy, seed script

Shared contract on day one: `lib/db/schema.ts` and the job names above. Everyone codes against those.

## 11. Demo checklist

- Pre-ingested project + seeded contacts in case Apollo is slow
- Teammate inbox ready to reply as an "angel" on stage
- QR code to `/p/{slug}` for judges to join the waitlist live
- "Send brief now" button
- Backup video
