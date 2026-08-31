# Issue Automation Pipeline

Kanban automation board that ingests GitHub issues from a copy of [Apache Superset](https://github.com/apache/superset),
dispatches them to Devin (one session per issue), and tracks each session through to a pull request
and its GitHub Actions checks.

It runs on your machine — one Docker container serving a React UI, an Express API and a SQLite file
on port 8787 — and it drives the real thing: real issues, real Devin sessions, real PRs. There is no
demo or simulation mode, so the setup below is all required.

## What you need

- Docker (with Compose v2) and a terminal.
- **Your own fork of [`john-vh/superset`](https://github.com/john-vh/superset)**, with issues in it (see step 1).
- A **GitHub token** for that copy, and admin rights on it to add a webhook.
- A **Devin account**: API key + organization id.
- A **tunnel** (e.g. `cloudflared`), because GitHub webhooks and Devin callbacks have to reach your
  laptop. The compose file can run one for you.

## Setup

### 1. Get a repository with issues in it

Fork [`john-vh/superset`](https://github.com/john-vh/superset) (a copy of Apache Superset) into your
own account. **Forks do not copy issues**, so your fork starts empty — open a few issues in your copy by hand before continuing;
dependency advisories work well ("Bump Flask to fix CVE-…", "DoS in `brace-expansion`"). Whatever
you open here is what shows up in the board's Backlog column.

Devin's GitHub integration needs write access to this repository so it can push branches and open
pull requests — connect it at app.devin.ai → Settings → GitHub.

### 2. Copy the playbook into your Devin org

Playbooks are org-scoped, so there is no id to hand out. Paste the body of
[`docs/playbook.md`](docs/playbook.md) into app.devin.ai → Settings → Playbooks, and keep the
`playbook-…` id it gives you.

### 3. Fill in `.env`

```bash
git clone https://github.com/john-vh/superset-automation && cd superset-automation
cp .env.example .env
```

The values that matter:

```env
GITHUB_REPO=<your-account>/superset
GITHUB_TOKEN=<fine-grained PAT on that repo — read Issues, Pull requests, Contents, Checks, Metadata>
GITHUB_WEBHOOK_SECRET=<any random string; you reuse it in step 5>
DEVIN_API_KEY=<from app.devin.ai settings>
DEVIN_ORG_ID=<your Devin org id>
DEVIN_PLAYBOOK_ID=playbook-<from step 2>
CALLBACK_TOKEN=<any random string>
APP_BASE_URL=<filled in during step 4>
```

The GitHub token is only ever read from — Devin opens the PRs through its own integration.

### 4. Start it, with a tunnel

```bash
docker compose --profile tunnel up -d --build
docker compose logs tunnel | grep trycloudflare      # e.g. https://foo-bar-baz.trycloudflare.com
```

Put that hostname in `.env` as `APP_BASE_URL`, then recreate the app so it picks it up:

```bash
docker compose up -d app
```

The board is now on <http://localhost:8787> (UI, API, webhook and callbacks all share that port), and
`curl localhost:8787/healthz` returns `{"status":"ok"}`.

Already running your own `cloudflared` on the host? Skip `--profile tunnel`, run
`docker compose up -d --build`, and point it at `http://localhost:8787` as usual.

### 5. Point a webhook at the tunnel

In your Superset fork → Settings → Webhooks → Add webhook:

- **Payload URL**: `https://<tunnel-host>/api/webhooks/github`
- **Content type**: `application/json`
- **Secret**: the `GITHUB_WEBHOOK_SECRET` from step 3
- **Events**: *Let me select individual events* → **Issues**, **Pull requests**, **Check runs** only

Deliveries are HMAC-verified and de-duplicated by `X-GitHub-Delivery`. Your issues should now appear
in Backlog; "Sync issues" in the header forces a reconciliation pass if you want them immediately.

### 6. Dispatch a real issue

Click **Send to Devin** on a backlog card (or **Start backlog** for all of them). That creates one
Devin session per issue — an issue can only have one active run — and the card walks the board:

`Backlog → Queued → Investigating → Implementing → Validating → Awaiting your review → Merged`

with `Needs attention` for blocked, failed or stopped runs and for failing CI. Phase changes arrive
both from the session's own callbacks (`POST /api/devin/callback`, which the playbook instructs it to
send) and from polling, so the board stays correct even if the tunnel drops. Updates stream to the
browser over SSE.

When the session opens a PR the card turns amber and reads **Awaiting review** — that is your cue.
Review it in GitHub as you normally would; the board keeps watching the PR after the session ends,
so it turns green and lands in **Merged** only when the PR is actually merged. An issue closed
without a merged PR lands in the separate **Closed** column instead.

**Reset** clears an issue's local run history and detaches its tracked PR (the PR itself is left on
GitHub), returning the card to Backlog from any column so it can be dispatched again.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Board is empty | `GITHUB_TOKEN`/`GITHUB_REPO` wrong, or your copy genuinely has no issues. Check `docker compose logs app`. |
| Cards never leave Queued | Callbacks can't reach you: `APP_BASE_URL` isn't the tunnel hostname, or the tunnel restarted with a new one. |
| Webhook deliveries show 401 | `GITHUB_WEBHOOK_SECRET` differs from the secret on the webhook. |
| Dispatch button is disabled | `DEVIN_API_KEY`/`DEVIN_ORG_ID` missing — the header shows which integrations are inactive. |
| A card is stuck after you stopped a session | **Reset** on the card clears its local run state (the GitHub PR is untouched). |
| Want a clean slate | `docker compose down -v` drops the SQLite volume. |

## Configuration

Everything lives in `.env` (never commit it); see `.env.example` for the full list.

| Variable | Purpose |
| --- | --- |
| `GITHUB_REPO` | Repository to watch, `owner/name`. |
| `GITHUB_TOKEN` | Read-only PAT for issue sync, PR and check-run lookups. |
| `GITHUB_WEBHOOK_SECRET` | Shared secret used to verify webhook signatures. |
| `DEVIN_API_KEY`, `DEVIN_ORG_ID` | Required to dispatch and poll Devin sessions. |
| `DEVIN_PLAYBOOK_ID` | Playbook applied to every dispatched session. Optional — `server/src/devin/prompt.ts` inlines the same contract. |
| `DEVIN_MAX_ACU` | Per-session ACU ceiling. |
| `APP_BASE_URL` | Public URL sessions post phase callbacks to (your tunnel). |
| `CALLBACK_TOKEN` | Shared secret sessions send as `X-Callback-Token`. |
| `ACU_RATE_USD` | Price of one ACU (default `2.25`), used for the estimated spend metric. |
| `DATABASE_PATH` | SQLite file, resolved against the repo root. Compose pins it to `/data/board.sqlite`. |
| `SERVE_WEB`, `WEB_DIST` | Serve the built UI from the API. Set by the image; leave alone outside Docker. |
| `ISSUE_SYNC_INTERVAL_MS`, `SESSION_POLL_INTERVAL_MS` | Reconciliation and session poll intervals. |

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

## Developing without Docker

```
shared/   DTOs and board column definitions shared by both sides
server/   Express API, SQLite store, GitHub + Devin integrations, background workers
web/      React UI (kanban board, metrics, activity feed, run drawer)
```

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
npm run dev        # API on :8787, UI on http://localhost:5173 (proxies /api)
npm run lint && npm run typecheck && npm run test && npm run build
```

Same `.env`; the split ports mean you browse 5173 but still tunnel 8787.
