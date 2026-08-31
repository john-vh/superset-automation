# Issue Automation Pipeline

Kanban automation board that ingests issues from [`john-vh/superset`](https://github.com/john-vh/superset),
dispatches them to Devin, and tracks each session through to a pull request and its GitHub Actions checks.

Runs entirely on your machine: a Vite + React frontend, an Express API, and a SQLite file.

## Layout

```
shared/   DTOs and board column definitions shared by both sides
server/   Express API, SQLite store, GitHub + Devin integrations, background workers
web/      React UI (kanban board, metrics, activity feed, run drawer)
```

## Setup

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
cp .env.example .env
npm run dev        # API on :8787, UI on http://localhost:5173
```

The UI proxies `/api` to the server, so only the Vite URL needs to be open in a browser.
Without credentials the app still boots — the board renders and warns which integrations are inactive.

## Configuration

All settings live in `.env` (never commit it). See `.env.example` for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite file, resolved against the repo root. Defaults to `data/board.sqlite`. |
| `GITHUB_REPO` | Repository to watch, `owner/name`. Defaults to `john-vh/superset`. |
| `GITHUB_TOKEN` | PAT with `repo` scope. Required for issue sync and check-run lookups. |
| `GITHUB_WEBHOOK_SECRET` | Shared secret used to verify webhook signatures. |
| `DEVIN_API_KEY`, `DEVIN_ORG_ID` | Required to dispatch and poll Devin sessions. |
| `DEVIN_PLAYBOOK_ID` | Playbook applied to every dispatched session. |
| `DEVIN_MAX_ACU` | Per-session ACU ceiling. |
| `APP_BASE_URL` | Public URL sessions post phase callbacks to (a tunnel when running locally). |
| `CALLBACK_TOKEN` | Shared secret sessions send as `X-Callback-Token`. |
| `ACU_RATE_USD` | Price of one ACU (default `2.25`), used for the estimated spend metric. |

## Ingestion

Issues arrive two ways, so the board is correct even if the app was offline:

1. **Webhook** — point a GitHub webhook at `POST /api/webhooks/github` (content type `application/json`,
   secret = `GITHUB_WEBHOOK_SECRET`, events: *Issues*, *Pull requests*, *Check runs*). Signatures are verified
   with a timing-safe HMAC compare and deliveries are de-duplicated by `X-GitHub-Delivery`.
2. **Reconciliation poll** — every `ISSUE_SYNC_INTERVAL_MS` the server pulls issues updated since the last sync.
   "Sync issues" in the UI runs the same pass on demand.

Locally, expose the server with a tunnel (e.g. `cloudflared tunnel --url http://localhost:8787`) and use that
hostname for both the webhook and `APP_BASE_URL`.

## Lifecycle

Clicking **Send to Devin** on a backlog card (or **Start backlog** for all of them) creates one independent
Devin session per issue; an issue can only have one active run at a time. Each card then moves through:

`Backlog → Queued → Investigating → Implementing → Validating → Awaiting your review → Merged`

with `Needs attention` for failed or blocked sessions and failing CI. An open pull request always reads as
awaiting review — only an actually merged PR reaches `Merged`, and an issue closed without one shows as
`Closed without a PR`. Phase changes come from two sources:

- **Callbacks** — the session posts `{ run_id, phase, message, pr_number? }` to `POST /api/devin/callback`
  with the `X-Callback-Token` header. This is what the playbook instructs it to do.
- **Polling** — every `SESSION_POLL_INTERVAL_MS` the server reads session status, new messages, ACU usage and
  any pull requests, inferring a phase from message text when no callback arrived.

The board streams to the browser over SSE (`GET /api/stream`), so cards move without a refresh.

## Devin playbook

Create a playbook in your Devin org containing the issue-fix procedure (implement a focused fix, open a PR whose
body says `Fixes #<issue>`, run tests/lint/typecheck, and POST each phase change to the callback URL), then set
`DEVIN_PLAYBOOK_ID`. The dispatch prompt in `server/src/devin/prompt.ts` repeats the callback contract, so
dispatch still works without a playbook.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/board` | Cards, metrics, notifications, integration status |
| `GET` | `/api/stream` | SSE board updates |
| `GET` | `/api/runs/:id` | Run detail with full event timeline |
| `POST` | `/api/issues/:number/dispatch` | Start a Devin session for an issue |
| `POST` | `/api/sync` | Run issue reconciliation now |
| `DELETE` | `/api/notifications` | Clear the activity feed |
| `DELETE` | `/api/notifications/:id` | Dismiss one activity |
| `POST` | `/api/issues/:number/stop` | Stop the active Devin session |
| `POST` | `/api/issues/:number/reset` | Clear an issue's local run state |
| `POST` | `/api/webhooks/github` | GitHub webhook receiver |
| `POST` | `/api/devin/callback` | Session phase callback |

## Commands

```bash
npm run dev         # server + UI
npm run lint
npm run typecheck
npm run test        # server + web unit tests (vitest)
npm run build
npm start           # serve the built API
```
