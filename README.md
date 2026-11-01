# founder(ish)

Your AI cofounder for the business side. Plan: [claude/plan.md](claude/plan.md) · context: [claude/CONTEXT.md](claude/CONTEXT.md).

## Setup

```bash
npm install
cp .env.example .env        # fill in keys
npm run db:push             # create tables
npm run dev                 # web on :3000
npm run worker              # in a second terminal
```

## Smoke tests (run in order)

| # | Command | Notes |
|---|---|---|
| 1 | `npm run smoke:env` | |
| 2 | `npm run smoke:db` | pushes the schema first |
| 3 | `npm run smoke:queue` | worker must be running |
| 4 | `npm run smoke:llm` | |
| 5 | `npm run smoke:apollo-search` | free, real API even in DEMO_MODE |
| 6 | `npm run smoke:apollo-enrich -- --spend` | **spends 1 Apollo credit** |
| 7 | `npm run smoke:agentboxd-send` | emails the first SEND_ALLOWLIST address |
| 8 | `npm run smoke:agentboxd-guard` | |
| 9 | `npm run smoke:agentboxd-receive` | someone replies to test 7's email; `-- --webhook` to register the webhook |
| 10 | `npm run smoke:github` | `-- --push` then push a commit to TEST_REPO |
| 11 | `npm run smoke:e2e` | web + worker running; passes once the handlers are built |

## Layout

`app/` Next.js pages, routes, webhooks · `lib/` shared db/queue/adapters · `worker/` pg-boss worker, one handler per job · `scripts/` seed + smoke tests.
