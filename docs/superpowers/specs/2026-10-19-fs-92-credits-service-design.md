# FS-92 — Credits: hold, charge and release service

Jira: [FS-92](https://tongtong0507.atlassian.net/browse/FS-92). Source of truth for the
rules: the ticket and the "Credit buckets" section of the Backend API List doc.
Branch `feat/fs-92-credit-service`, PR into `development`.

## Goal

One service that every credit movement goes through, so the ledger, the cached
balances on `workspace` and the `/portal/me` cache can never disagree. It ships
with its first real caller, `POST /portal/requests/:id/drop`.

Out of scope, decided 16 Oct 2026: replaying a POST's first reply for a repeated
`Idempotency-Key` (the decorator keeps only requiring the header), and the
low-credit alerts (no email or SSE channel exists yet).

## Rules carried over

- Two buckets: monthly (`grant_balance`) and top-up (`topup_balance`). Monthly is
  always spent first. A charge that spans both writes two ledger rows.
- Holds don't own a bucket. `workspace.credits_held` is one total; each request's
  share is `request.credits_held`. The bucket is chosen when the hold is charged.
- Prices come from the `credit_prices` setting: `{ change: 20, drop: 15,
  extra_preview: 10 }`, keyed by the contract's `CreditAction`.
- Not enough credits → 402 `NOT_ENOUGH_CREDITS` with `needed`, `have`, `short`,
  `resetOn`, `draftId`.
- Every write that changes credits invalidates that workspace's `/portal/me`
  cache, after the commit.
- `credit_ledger` is append-only (the API role may not update or delete it); the
  unique `(workspace_id, idem_key)` is the backstop against double charges.

## Module: `src/credits/`

| File | Purpose |
| --- | --- |
| `credits.module.ts` | Provides and exports `CreditsService` and `WorkspaceCache`. `PortalModule` imports it. |
| `credits.service.ts` | `run`, `hold`, `charge`, `release`, `price`. |
| `split.ts` | Pure math: bucket split of a price, free credits once a request's own hold is set aside. |
| `prices.ts` | Reads and validates the `credit_prices` setting (zod, keyed by `CreditAction`). Missing or malformed → 500. |
| `workspace-cache.ts` (+ spec) | Moved from `src/portal/me/`. The owner of invalidation owns the cache. `MeService` keeps injecting it. |

### Transaction ownership

```ts
await credits.run(workspaceId, async (tx) => {
  // caller's own writes and any of: credits.hold / charge / release (tx, …)
});
```

`run` opens the Prisma interactive transaction, runs the callback and, only
after the commit, calls `WorkspaceCache.invalidate(workspaceId)`. The three
operations take `tx` as their first argument and never open their own, so a
route's status change and its credit movement are one transaction and a stale
read cannot re-cache pre-commit balances.

### Scope argument

`{ workspaceId, requestId, actor }`: `actor` is the caller's auth account id or an
agent name, written to `credit_ledger.created_by` and reused by the route for
`request_event`.

### Shared preamble (inside `tx`)

1. `SELECT … FROM studio.workspace WHERE id = $1 FOR UPDATE` — serialises every
   credit movement of a workspace.
2. `workspace.status !== 'active'` → 403 `WORKSPACE_READ_ONLY`.
3. Load the request by `(id, workspace_id)`; missing → 404 `NOT_FOUND`.
4. `request.status === 'closed'` → 409 `INVALID_STATE`. Any other status rule
   belongs to the caller (drop, resume, approve each differ).

### `hold(tx, { workspaceId, requestId }, action)`

- `price = price(tx, action)`.
- `available = grant_balance + topup_balance − (credits_held − request.credits_held)`:
  the other requests' holds count, this request's own hold does not.
- `available < price` → 402 with `needed: price`, `have: available`,
  `short: price − available`, `resetOn: nextResetOn(now)`, `draftId: requestId`.
- Else `request.credits_held = price`, `request.credits_price = price`,
  `workspace.credits_held += price − previousHold`. A second call on a request that
  already holds the price changes nothing.
- Returns `{ price, held: price }`.

### `charge(tx, { workspaceId, requestId }, action)`

- `key = usage:<requestId>:<action>`. If a ledger row with that key exists for the
  workspace, return what it (and its `:topup` sibling) recorded and write nothing.
- Otherwise release this request's hold (both columns), then
  `available = grant_balance + topup_balance − credits_held`; `available < price` → 402
  as above.
- Split monthly first: `fromGrant = min(grant_balance, price)`,
  `fromTopup = price − fromGrant`.
- Ledger rows (`kind = usage`, `credits` negative, `request_id`, `created_by` = `scope.actor`): the first row carries `key`; when
  `fromTopup > 0` and `fromGrant > 0` the top-up row carries `key + ':topup'`.
  A charge paid entirely from top-up is one row under the plain `key`.
- `grant_balance −= fromGrant`, `topup_balance −= fromTopup`,
  `request.credits_price = price`.
- Returns `{ price, fromGrant, fromTopup, alreadyCharged: boolean }`.

### `release(tx, { workspaceId, requestId })`

- `workspace.credits_held −= request.credits_held`, `request.credits_held = 0`.
- Nothing goes to the ledger. No hold → returns `{ released: 0 }` and writes nothing.

### `price(tx, action)`

Reads `setting` row `credit_prices` and returns the action's price. No cache:
one indexed row per credit movement.

## Route: `POST /portal/requests/:id/drop` (`src/portal/drafts/`)

`DropService.drop(scope, requestId, body)`:

1. Load the request by `(id, workspace_id)`; missing → 404.
2. Status not `draft` or `paused` → 409 `INVALID_STATE`. Workspace not active → 403.
3. Started (AI already used) when any holds: `credits_held > 0`, `page_plan` or
   `layout_options` is set, or a `chat_message` with `role = ba` and `seq > 1`
   exists. `cost = started ? price('drop') : 0`.
4. No `confirm` → `{ dropped: false, cost, request: null }`, nothing written.
5. `confirm: true` → in one `credits.run`: `charge(tx, …, 'drop')` when `cost > 0`,
   else `release(tx, …)`; `request.status = closed`, `close_reason =
   client_cancelled`; `request_event` row `from → closed` with
   `actor_account_id = scope.accountId`. Reply
   `{ dropped: true, cost, request: requestCard(row) }`.

`requestCard(row)` is a new helper in `src/portal/requests/request-card.ts` over
`mapStatus` (closed from `draft` → `stoppedAt: 'draft'`); FS-89 and FS-91 reuse it.

The route's `@ApiErrors` gains `NOT_ENOUGH_CREDITS` (a started draft with no hold
and under 15 free credits cannot pay), so `openapi.json` is regenerated.

A retry with the same `Idempotency-Key` after a successful drop gets 409: the
request is already closed, the ledger is unchanged.

## Tests

Unit (`npm test`, no database):

- `split.spec.ts`: 15 + 100 charge 20 → 15 grant + 5 top-up; all-monthly;
  all-top-up; available with and without the request's own hold.
- `prices.spec.ts`: valid row, missing action, non-integer → rejected.
- `drop.service.spec.ts`: the started rule; cost preview without confirm.
- `request-card.spec.ts`: a closed card.

Database (`npm run test:db`, `test/db/credits.int-spec.ts`), seeded Kopi Lane plus
fixtures the test creates:

- Concurrency: free credits for one hold only; two `hold`s on two drafts at once
  (`Promise.allSettled`) → exactly one succeeds, the other is 402.
- Retried charge: `charge` twice → one set of ledger rows, balances moved once,
  second call reports `alreadyCharged`.
- Split bucket: workspace at 15 monthly + 100 top-up, charge 20 → 0 / 95, rows
  −15 `grant` and −5 `topup`.
- Reset keeps the hold: hold 20 on 31 Oct, then the reset the way FS-94 will do it
  (one transaction: `adjust` row removing the old monthly balance, `grant` row +200,
  balances set), then charge → paid from the new month's grant, holds back to 0.
- 402 details shape; `release` no-op; read-only workspace → 403; `/portal/me`
  reads fresh after the commit; another workspace's request → 404.

Route (`test/db/portal-drop.int-spec.ts`): preview cost; drop a started draft →
15 charged, closed card, ledger row `usage:<id>:drop`; unstarted draft → cost 0,
closed, no ledger row; `#43` (uat) → 409; another client's id → 404.

## Docs and bookkeeping

- README: `src/credits/` in the layout block; a short "Credits" paragraph naming
  `run`/`hold`/`charge`/`release` and the cache rule.
- Commits `FS-92 …`, one per coherent step; PR into `development`; the ticket moves
  to DEV after the merge.
