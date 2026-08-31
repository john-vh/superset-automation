# Devin playbook: fix an issue and report phases to the board

Playbooks are scoped to a Devin organization, so there is no ID to share. Paste everything below
the line into **app.devin.ai → Settings → Playbooks → New playbook** (title and macro of your
choosing, e.g. macro `!issue_fix`), then put the resulting `playbook-…` id in `DEVIN_PLAYBOOK_ID`.

Replace `<your-copy-of-superset>` with the repository in your `GITHUB_REPO`.

The playbook is optional — the dispatch prompt inlines the same callback and PR conventions — but
with it the instructions stay editable outside the codebase.

---

## Overview

Fix a single GitHub issue in `<your-copy-of-superset>` and deliver it as a pull request, while
reporting each lifecycle phase back to the Issue Automation Pipeline board so the issue card moves
in real time. This playbook is invoked by the board's dispatch endpoint (one session per issue) and
assumes the session prompt supplies the issue and callback details.

## What's Needed From User

The dispatch prompt provides all of it; no interactive input is expected.

- Issue number, title, body, labels and URL in `<your-copy-of-superset>`.
- `run_id` — the board's run identifier for this session.
- Callback URL (`<APP_BASE_URL>/api/devin/callback`) and the `X-Callback-Token` value.

If the prompt is missing the `run_id` or callback token, do the engineering work anyway and note in
the PR that phase reporting was skipped.

## Procedure

1. POST phase `investigating` to the callback, then read the issue and reproduce or locate the
   problem in the repository.
2. Identify the smallest correct fix; if the issue is a dependency advisory, bump only the affected
   package(s) and their lockfile entries.
3. POST phase `implementing`, then make the change on a new branch `devin/$(date +%s)-issue-<number>`.
4. Follow the repository's own standards in `AGENTS.md`: TypeScript over JavaScript, no `any`, type
   hints on new Python, ASF license headers on new files, no unrelated refactors.
5. POST phase `validating`, then run the checks that cover the change — `pre-commit run` on the
   staged files, plus the relevant `pytest` or `npm run test`/`lint` commands.
6. Open a pull request whose body contains `Fixes #<number>` and describes the change and how it was
   verified.
7. POST phase `review` with `"pr_number": <pr>` in the same payload, immediately after the PR exists.
8. Watch the PR's GitHub Actions checks; fix failures caused by this change and push follow-up
   commits. Do not claim an unrelated failure is pre-existing without confirming it on the base
   branch.
9. POST phase `done` once checks pass, or phase `attention` with an explanation in `message` at any
   point you are blocked or the fix is not viable.

## Callback contract

```bash
curl -sS -X POST "$CALLBACK_URL" \
  -H 'Content-Type: application/json' \
  -H "X-Callback-Token: $CALLBACK_TOKEN" \
  -d '{"run_id":"<run_id>","phase":"implementing","message":"short status"}'
```

Valid phases, in order: `investigating`, `implementing`, `validating`, `review`, `done`, plus
`attention` for a blocked or failed run. `pr_number` is optional and only meaningful with `review`.
A failed callback is not fatal — log it and continue; the board also polls session state.

## Specifications

- Exactly one pull request per session, scoped to the one issue, with `Fixes #<number>` in the body.
- Repository checks relevant to the change pass locally before the PR is opened.
- Every phase transition is reported, ending in either `done` or `attention` — a session that ends
  without one of those leaves its card stuck.
- The PR description states what was verified and how.

## Advice and Pointers

- Superset runs GitHub Actions, not CircleCI; check-run results are what the board tracks.
- Dependency/advisory issues usually need only a version bump plus lockfile regeneration — resist
  widening scope.
- Phase messages are shown verbatim on the card: one short sentence, e.g. "Bumping Flask to 2.3.8
  and regenerating requirements".

## Forbidden Actions

- Do not open more than one PR, or bundle fixes for other issues.
- Do not push to `master`, force-push shared branches, amend existing commits, or skip pre-commit
  hooks.
- Do not modify or delete tests to make CI pass.
- Do not include the callback token in commits, the PR body, or logs.
