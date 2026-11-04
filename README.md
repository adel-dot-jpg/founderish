# founder(ish)

**An AI cofounder for the business side.** For engineers who built something real and don't know how to sell it: founder(ish) reads your repo, finds people who can open doors and people who might use what you built, and drafts founder-style outreach for your approval. It never claims anything it can't back with a receipt.

Built solo at LarpHacks 2026 in Toronto, where the theme was "help engineers LARP as someone they're not". The confidence is borrowed. The facts never are.

## What it does

- **Upward (network).** Picks five kinds of people who can open doors (founders in your space, angels and VC scouts, accelerator staff, engineering leaders, community leads), finds them on Apollo, ranks each with a one-line reason, and drafts a short ask for advice or an intro.
- **Downward (users).** Infers two or three candidate user niches from what you've built, finds people in each, and drafts feedback or early-access emails with tracked links to a landing page and waitlist.
- **Niche finder.** Scores each user audience by `(positive replies × 3 + waitlist signups × 2 + link clicks) ÷ emails sent`, so you can see which niche is actually responding.
- **Flywheel.** Real signal becomes new receipts: waitlist signups, positive replies, and live visitor and signup counts from your own site through a one-line tracking snippet. Upward pitches and LinkedIn posts can cite them as soon as they exist.
- **A coach, not a chatbot.** A worker reacts to triggers: a new project, a daily schedule, a reply, a click, a signup, a GitHub push. It fills an approval queue and emails you a daily brief you can approve by replying `send 1 3`.
- **More knowledge sources.** Besides the repo, it can learn from your product site, your resume PDF or pasted text.

## Facts only: how "receipts" are enforced

The product's one non-negotiable rule is that outputs sound confident but never invent users, revenue, funding or credentials. The rule is enforced in code, not left to the prompt:

1. **Every claim lives in a `facts` row** with its source: repo, README, commit, website, resume, waitlist, reply, live traffic, or one you typed yourself.
2. **Prompts see facts as labels** (`F1`, `F2`, …) and return the labels they used. Code maps labels back to row ids, so a hallucinated id can never reach the database ([lib/prompts/voice.ts](lib/prompts/voice.ts)).
3. **A second model pass checks every draft** ([lib/prompts/receiptCheck.ts](lib/prompts/receiptCheck.ts)). It lists each claim and tags it as a fact, problem framing or the ask, then matches facts to receipts. Unsupported claims are rewritten out and the draft is checked again. If it still fails, it's flagged for a human. Editing a draft sends it back through the check.
4. **Traction numbers are updated in place** from real counts ("37 unique visitors in the last 7 days"). Drafts that cite them stay valid, and a zero is never stated.

The dashboard shows the receipts behind each draft as hoverable chips.

## Nothing goes out without you

- Every email, reply, follow-up and post waits in an approval queue. You approve from the dashboard or by replying to the brief. Owner commands are only accepted from `OWNER_EMAIL` with SPF/DMARC passing.
- **`DEMO_MODE` is on unless set to exactly `false`.** The guard lives inside `mail.send()` itself, before any API call, and blocks every address not on `SEND_ALLOWLIST`. Found contacts are given allowlisted addresses instead of being enriched, so no Apollo credits are spent and nobody real is emailed. The smoke test `agentboxd-guard` proves the guard fires before the network is touched.
- **Inbound email is untrusted data.** Prompts fence it off and say never to follow instructions inside it. Agentboxd's injection, phishing and SPF/DKIM/DMARC-failure labels route a reply to a human instead of an auto-draft.
- LinkedIn is never automated. Approved posts get "Copy & open LinkedIn", then you mark them as posted.

## Architecture

```
 browser / webhooks / tracking beacons
          │
          ▼
 Next.js route ──► INSERT events ──► pg-boss job ──► worker handler ──► Gemini · Apollo · Agentboxd · GitHub
 (never calls an                                          │
  LLM or external API)                                    ▼
                                       facts · audiences · contacts · drafts · messages
                                                          │
                                  owner approves (dashboard or "send 1 3" by email)
                                                          ▼
                                                 outreach.send ──► Agentboxd
```

- **Routes and webhooks only record an event and enqueue a job**, so the UI stays fast and every action is replayable from the `events` table, which also feeds the activity log.
- **The coach is deterministic routing plus focused LLM calls**, one job type per handler in [worker/handlers](worker/handlers), rather than a free-roaming agent. That keeps it predictable and debuggable.
- **Every LLM call goes through `callJSON()`** ([lib/llm.ts](lib/llm.ts)): zod schema in, validated object out. It handles per-model request pacing, quota-aware fallback across a chain of Gemini models, and one retry for off-schema output.
- **Postgres is the only infrastructure.** It holds the data (Drizzle ORM), the queue and the cron schedules (pg-boss). No Redis and no vector store: the model ranks a few dozen contacts directly.

| Job | Triggered by | Does |
|---|---|---|
| `project.ingest` | new project, "Re-read repo" | README, languages, file tree, last 50 commits → facts + a one-line pitch |
| `source.ingest` | website / resume PDF / pasted text | → more facts (LinkedIn URLs are refused; use its "Save to PDF") |
| `audiences.generate` | after ingest, "Find people now" | 2–3 user niches + the 5 upward profiles, each as Apollo filters |
| `people.find` | audiences, daily 9:00, "Find more" | Apollo people search (free), deduped per project |
| `people.rank` | new contacts | 0–100 score + reason; enrich and draft the top pick |
| `outreach.draft` → `receipt.check` | ranked contact | founder-voice email → claim-by-claim fact check |
| `outreach.send` | approval | send via the Agentboxd coach inbox, schedule a follow-up check |
| `followup.schedule` | 4 days after a send | one follow-up draft if there's still no reply |
| `mail.poll` / `mail.inbound` | every 30s or webhook | thread match → classify → status, new fact, reply draft; owner commands |
| `post.draft` | GitHub push, "Draft a post" | LinkedIn post from the newest facts |
| `brief.send` | daily 10:00, "Send brief now" | numbered brief across every project, emailed to the owner |
| `facts.refresh` | hourly, tracking beacons, signups | live visitor, signup and waitlist counts → facts |

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind 4 · Postgres + Drizzle ORM · pg-boss · Gemini (`@google/genai`) · Apollo REST API · Agentboxd (email inboxes for agents) · Octokit · zod · deployed on Render (web service + background worker + Postgres).

## Running it locally

You need Node 20.19+, a Postgres database, and keys for Gemini, Apollo, Agentboxd and GitHub. The Gemini free tier works; it's slow because requests are paced at 5 per minute per model.

```bash
npm install
cp .env.example .env         # fill in keys; see the comments in the file
npm run smoke:env            # checks what's missing
npm run db:push              # create the tables
npm run dev                  # web on http://localhost:3000
npm run worker               # second terminal: the coach
```

Open the app, click **+ New project**, and link a repo. The overview fills in as the worker reads it. People, drafts and the niche chart follow over the next few minutes.

### Smoke tests

Run these in order. Each prints `PASS` or `FAIL` with the likely cause.

| # | Command | Notes |
|---|---|---|
| 1 | `npm run smoke:env` | required and optional variables |
| 2 | `npm run smoke:db` | pushes the schema, then insert, read and delete |
| 3 | `npm run smoke:queue` | the worker must be running |
| 4 | `npm run smoke:llm` | one validated Gemini call |
| 5 | `npm run smoke:apollo-search` | free, real API even in DEMO_MODE |
| 6 | `npm run smoke:apollo-enrich -- --spend` | **spends one Apollo credit** |
| 7 | `npm run smoke:agentboxd-send` | emails the first SEND_ALLOWLIST address |
| 8 | `npm run smoke:agentboxd-guard` | DEMO_MODE blocks a send before any API call |
| 9 | `npm run smoke:agentboxd-receive` | reply to test 7's email (`-- --webhook` registers the webhook) |
| 10 | `npm run smoke:github` | `-- --push`, then push a commit to TEST_REPO |
| 11 | `npm run smoke:e2e` | web and worker running: repo → facts → people → a pending draft with valid receipts |

Two more dev tools:
- `npm run try:pipeline -- owner/repo` runs the whole AI pipeline without a database or worker and prints every step.
- `npm run fake:inbound -- "Love this, free Thursday?"` injects a reply into the newest sent thread.

### Tracking your own site

The overview shows a snippet to add to your site's layout:

```html
<script defer src="https://<your founder(ish) URL>/t.js" data-project="<project slug>"></script>
```

Call `window.founderish?.track("signup")` after your own signup succeeds. Beacons are `text/plain`, so there's no CORS preflight, and they carry only the path, the referrer host and an anonymous per-browser id.

## Deploying

[render.yaml](render.yaml) is a Render Blueprint for the web service and the worker. Create a Postgres database in the same region and set `DATABASE_URL` on both services. The schema is pushed before each web deploy. With `MAIL_INBOUND_MODE=poll` the worker reads the coach inbox every 30 seconds, so no webhook setup is needed.

## Layout

```
app/(dashboard)/   overview, approvals, people, posts, niche, new project
app/p/[slug]/      public landing page + waitlist
app/r/[token]/     tracked link → log the click → landing page
app/api/           JSON routes and webhooks: record an event, enqueue a job
app/t.js/          the tracking snippet
lib/               db schema + client, queue, adapters (llm, apollo, mail, github), prompts/
worker/            pg-boss worker: boot, schedules, one handler per job
scripts/           smoke tests and dev tools
claude/            the original hackathon brief and build plan
```

## Limits

- Single owner with no auth, by design for the hackathon. `OWNER_EMAIL` is the user.
- Apollo's free people search obfuscates last names, and real emails need enrichment credits (off in DEMO_MODE).
- Gemini's free tier allows about 20 requests a day per model. A new project's first run (repo → audiences → people → drafts) takes a few dozen calls, spread over the fallback chain.
