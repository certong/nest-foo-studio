# FS-92 Credits Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `CreditsService` (`run`, `hold`, `charge`, `release`) that every credit movement goes through, shipped with its first caller, `POST /portal/requests/:id/drop`.

**Architecture:** A new `src/credits/` Nest module owns the service and the `/portal/me` workspace cache. Every write runs inside `credits.run(workspaceId, fn)`: a Prisma interactive transaction that locks the workspace row `FOR UPDATE`, lets the caller add its own writes, and invalidates the cache after the commit. Bucket math is a pure function; the ledger's unique `(workspace_id, idem_key)` is the backstop.

**Tech Stack:** NestJS 11, Prisma 6.19 (`Prisma.TransactionClient`), zod 4, vitest 4 (`npm test` for pure code, `npm run test:db` for throwaway Postgres databases), supertest.

**Spec:** `docs/superpowers/specs/2026-10-19-fs-92-credits-service-design.md`

## Global Constraints

- Prices come only from the `setting` row `credit_prices` (`{ change: 20, drop: 15, extra_preview: 10 }` in the seed). No defaults in code.
- Ledger idempotency key for a charge: `usage:<requestId>:<action>`; a second (top-up) row of a split charge: `usage:<requestId>:<action>:topup`.
- Monthly (`grant_balance`) is spent before top-up (`topup_balance`).
- Errors are thrown as `StudioException` with the contract's codes: 402 `NOT_ENOUGH_CREDITS` `{ needed, have, short, resetOn, draftId }`, 403 `WORKSPACE_READ_ONLY`, 404 `NOT_FOUND`, 409 `INVALID_STATE`, 500 `INTERNAL`.
- Raw SQL names tables as `studio.<table>` (as `test/db/schema.int-spec.ts` does). `credit_ledger` is never updated or deleted.
- The `/portal/me` cache is invalidated after every `run`, success or failure.
- Commit subjects start with `FS-92 `; end commit messages with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run unit tests with `npx vitest run <file>`; database specs with `npx vitest run --config vitest.db.config.mts <file>` (TEST_DATABASE_URL is in `.env`; the Docker container `postgres` must be up).

## Review Focus

1. Dropping a `paused` draft must behave exactly like dropping a `draft` (spec allows both; the happy-path tests use `draft`). Test added to Task 7.
2. A charge paid entirely from top-up (monthly at 0) must write one row under the plain key, not a `:topup` row. Tests added to Tasks 2 and 5.
3. `hold` called twice on the same request must not count the hold twice in `workspace.credits_held`. Test added to Task 4.
4. Two concurrent confirmed drops of the same request: one 200, one 409, exactly one ledger row. Test added to Task 7.
5. A workspace with `deleted_at` set must be 404 on every operation, not silently charged. Test added to Task 4.

---

### Task 1: Move the workspace cache into a new credits module

**Files:**
- Create: `src/credits/credits.module.ts`
- Move: `src/portal/me/workspace-cache.ts` → `src/credits/workspace-cache.ts`; `src/portal/me/workspace-cache.spec.ts` → `src/credits/workspace-cache.spec.ts`
- Modify: `src/portal/me/me.service.ts` (import path), `src/portal/portal.module.ts` (import `CreditsModule`, drop `WorkspaceCache` from providers)

**Interfaces:**
- Produces: `CreditsModule` exporting `WorkspaceCache` (unchanged class: `get(workspaceId, load)`, `invalidate(workspaceId)`, `now`). Task 4 adds `CreditsService` to the same module.

- [ ] **Step 1: `git mv` the two files and fix the import in `workspace-cache.spec.ts` (`./workspace-cache`) and `me.service.ts` (`../../credits/workspace-cache`).**
- [ ] **Step 2: Create `CreditsModule`** with `providers: [WorkspaceCache]`, `exports: [WorkspaceCache]`. Doc comment: the module that writes credits owns the cache it invalidates.
- [ ] **Step 3: In `PortalModule`, add `CreditsModule` to `imports` and remove `WorkspaceCache` from `providers`.**
- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all suites pass, including `src/credits/workspace-cache.spec.ts` and `test/portal-auth.e2e-spec.ts` (Nest still resolves `MeService`).

- [ ] **Step 5: Commit** — `FS-92 Credits module owns the workspace cache`

---

### Task 2: Bucket math

**Files:**
- Create: `src/credits/split.ts`, `src/credits/split.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Balances { grantBalance: number; topupBalance: number; creditsHeld: number }
  /** grant + topup − the holds of other requests (ownHold is this request's current hold). */
  export function availableCredits(b: Balances, ownHold?: number): number
  /** Monthly first; price must be ≤ grant + topup (the caller checked). */
  export function splitCharge(grantBalance: number, price: number): { fromGrant: number; fromTopup: number }
  ```

- [ ] **Step 1: Write `split.spec.ts`**

```ts
describe('availableCredits', () => {
  it('Kopi Lane State B: 145 + 95 − 20 = 220', () => expect(availableCredits({ grantBalance: 145, topupBalance: 95, creditsHeld: 20 })).toBe(220));
  it("sets a request's own hold aside", () => expect(availableCredits({ grantBalance: 145, topupBalance: 95, creditsHeld: 20 }, 20)).toBe(240));
});
describe('splitCharge (monthly first)', () => {
  it('15 monthly left, charge 20 → 15 grant + 5 top-up', () => expect(splitCharge(15, 20)).toEqual({ fromGrant: 15, fromTopup: 5 }));
  it('all from monthly', () => expect(splitCharge(145, 20)).toEqual({ fromGrant: 20, fromTopup: 0 }));
  it('all from top-up when monthly is 0', () => expect(splitCharge(0, 20)).toEqual({ fromGrant: 0, fromTopup: 20 }));
});
```

- [ ] **Step 2: Run** `npx vitest run src/credits/split.spec.ts` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement both functions in `split.ts`.**
- [ ] **Step 4: Run the same command** — Expected: PASS (5 tests).
- [ ] **Step 5: Commit** — `FS-92 Bucket math: available credits and the monthly-first split`

---

### Task 3: Prices from the `credit_prices` setting

**Files:**
- Create: `src/credits/prices.ts`, `src/credits/prices.spec.ts`

**Interfaces:**
- Consumes: `CreditAction` from `src/contract/credits.ts` (`'change' | 'drop' | 'extra_preview'`), `StudioException`.
- Produces:
  ```ts
  export const CREDIT_PRICES_KEY = 'credit_prices';
  export const CreditPrices = z.record(CreditAction, z.number().int().positive()); // exhaustive: every action priced
  export type CreditPrices = z.infer<typeof CreditPrices>;
  /** Parses the setting's JSON value; a missing or malformed row is a 500 INTERNAL, never a default. */
  export function parsePrices(value: unknown): CreditPrices
  export async function readPrices(tx: Prisma.TransactionClient): Promise<CreditPrices> // tx.setting.findUnique({ where: { key } }) → parsePrices(row?.value)
  ```

- [ ] **Step 1: Write `prices.spec.ts`**

```ts
it('accepts the seed row', () => expect(parsePrices({ change: 20, drop: 15, extra_preview: 10 })).toEqual({ change: 20, drop: 15, extra_preview: 10 }));
it.each([[undefined], [null], [{ change: 20, drop: 15 }], [{ change: 20, drop: 15, extra_preview: 2.5 }], [{ change: 20, drop: 15, extra_preview: 0 }]])(
  'rejects %j with 500 INTERNAL', (value) => {
    expect(() => parsePrices(value)).toThrow(StudioException);
    try { parsePrices(value); } catch (e) { expect((e as StudioException).code).toBe('INTERNAL'); }
  });
```

- [ ] **Step 2: Run** `npx vitest run src/credits/prices.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement `prices.ts`.** The exception message names the setting key so the log says what to fix.
- [ ] **Step 4: Run again** — Expected: PASS.
- [ ] **Step 5: Commit** — `FS-92 Prices come from the credit_prices setting`

---

### Task 4: `CreditsService`: `run` and `hold`

**Files:**
- Create: `src/credits/credits.service.ts`, `test/db/credits-fixtures.ts`, `test/db/credits.int-spec.ts`
- Modify: `src/credits/credits.module.ts` (provide and export `CreditsService`)

**Interfaces:**
- Consumes: Task 2 and 3 functions; `nextResetOn(now)` from `src/portal/me/credit-meter.ts`; `PrismaService`; `WorkspaceCache`.
- Produces:
  ```ts
  export type Tx = Prisma.TransactionClient;
  export interface CreditScope { workspaceId: number; requestId: string; /** auth account id or agent name → credit_ledger.created_by */ actor: string }
  export type CreditAction = z.infer<typeof CreditAction>;
  export interface HoldResult { price: number; held: number }
  export interface ChargeResult { price: number; fromGrant: number; fromTopup: number; alreadyCharged: boolean }
  export interface ReleaseResult { released: number }
  export function usageKey(requestId: string, action: CreditAction): string; // `usage:${requestId}:${action}`

  @Injectable()
  export class CreditsService {
    /** Replaceable in tests: resetOn in a 402 depends on the date. */
    clock: () => Date;
    constructor(prisma: PrismaService, cache: WorkspaceCache);
    /** The only way to write credits: one interactive transaction, cache invalidated afterwards (success or failure). */
    run<T>(workspaceId: number, fn: (tx: Tx) => Promise<T>): Promise<T>;
    hold(tx: Tx, scope: CreditScope, action: CreditAction): Promise<HoldResult>;
    charge(tx: Tx, scope: CreditScope, action: CreditAction): Promise<ChargeResult>;   // Task 5
    release(tx: Tx, scope: CreditScope): Promise<ReleaseResult>;                       // Task 5
    price(tx: Tx, action: CreditAction): Promise<number>;
  }
  ```
  Private preamble `lock(tx, scope)`:
  `SELECT id, status, grant_balance, topup_balance, credits_held FROM studio.workspace WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`
  (no row → 404; `status !== 'active'` → 403), then `tx.request.findFirst({ where: { id, workspaceId }, select: { id, status, creditsHeld } })` (null → 404; `closed` → 409). Returns `{ workspace, request }` with camelCase numbers.
- Test fixtures (`test/db/credits-fixtures.ts`), reused by Task 7:
  ```ts
  export async function createWorkspace(prisma: PrismaClient, id: number, balances: { grantBalance: number; topupBalance: number; creditsHeld?: number }, status?: WorkspaceStatus): Promise<{ workspaceId: number; siteId: string }>  // also a Site like schema.int-spec's OTHER
  export async function createDraft(prisma: PrismaClient, workspaceId: number, number: number, data?: Partial<Prisma.RequestUncheckedCreateInput>): Promise<string>  // a change draft with its first request_event; returns the id
  export function error(e: unknown): { code: string; details?: unknown }  // StudioException → { code, details }
  ```

- [ ] **Step 1: Write the fixtures and the first half of `credits.int-spec.ts`.** Suite setup like `test/db/portal-me.int-spec.ts`: `createThrowawayDatabase()`, `seed(db.prisma, 9001)`, `createTestApp({ prisma })`, `credits = app.get(CreditsService)`, `credits.clock = () => new Date('2026-10-31T10:00:00Z')`. A fresh workspace id per `describe` (9101, 9102, …) so cases do not share balances.

```ts
describe('hold', () => {
  it('sets the hold on the request and the workspace, and records the price', async () => {
    // workspace 9101: 100 grant, 0 top-up; draft #1
    const r = await credits.run(9101, (tx) => credits.hold(tx, scope, 'change'));
    expect(r).toEqual({ price: 20, held: 20 });
    // request.creditsHeld 20, creditsPrice 20; workspace.creditsHeld 20; grantBalance still 100
  });
  it('holding again on the same request changes nothing', async () => { /* hold twice → workspace.creditsHeld still 20 */ });
  it('refuses with 402 and the details the screen needs', async () => {
    // workspace 9102: 10 grant, 0 top-up
    await expect(credits.run(9102, (tx) => credits.hold(tx, scopeFor(draft), 'change'))).rejects.toMatchObject({ code: 'NOT_ENOUGH_CREDITS' });
    // details: { needed: 20, have: 10, short: 10, resetOn: '2026-11-01', draftId: draft }
  });
  it('two tabs holding at once cannot both pass', async () => {
    // workspace 9103: 25 grant; drafts #1 and #2; Promise.allSettled of two credits.run(...hold...)
    // exactly one fulfilled, one rejected with NOT_ENOUGH_CREDITS; workspace.creditsHeld 20
  });
  it('a read-only workspace gets 403', ...);       // createWorkspace(..., 'read_only')
  it('a request of another workspace gets 404', ...);
  it('a soft-deleted workspace gets 404', ...);    // update deletedAt, then hold
  it('a closed request gets 409', ...);           // createDraft with status closed + closeReason client_cancelled
  it('invalidates /portal/me after the commit', async () => {
    // GET /portal/me for 9001 (cached), hold 20 on a new Kopi Lane draft, GET again → credits.held 40, heldFor has the new draft
  });
});
```

- [ ] **Step 2: Run** `npx vitest run --config vitest.db.config.mts test/db/credits.int-spec.ts` — Expected: FAIL (no `CreditsService`).
- [ ] **Step 3: Implement `usageKey`, `CreditsService` with `run`, `price`, `lock` and `hold`** (leave `charge`/`release` throwing `new Error('Task 5')` for now); register it in `CreditsModule` providers and exports. `run`: `try { return await this.prisma.$transaction(fn); } finally { this.cache.invalidate(workspaceId); }`. `hold`: `available = availableCredits(ws, req.creditsHeld)`; short → `new StudioException('NOT_ENOUGH_CREDITS', { needed: price, have: available, short: price − available, resetOn: nextResetOn(this.clock()), draftId: scope.requestId })`; else update request (`creditsHeld: price, creditsPrice: price`) and workspace (`creditsHeld: { increment: price − req.creditsHeld }`).
- [ ] **Step 4: Run the suite again** — Expected: the `hold` cases PASS; `npm test` still green.
- [ ] **Step 5: Commit** — `FS-92 CreditsService: run() and hold()`

---

### Task 5: `charge` and `release`

**Files:**
- Modify: `src/credits/credits.service.ts`, `test/db/credits.int-spec.ts`

**Interfaces:** as declared in Task 4.

- [ ] **Step 1: Add the second half of `credits.int-spec.ts`**

```ts
describe('charge', () => {
  it('split-bucket: 15 monthly + 100 top-up, charge 20 → monthly 0, top-up 95, two rows', async () => {
    // workspace 9111 { grant 15, topup 100 }; hold then charge 'change'
    expect(r).toEqual({ price: 20, fromGrant: 15, fromTopup: 5, alreadyCharged: false });
    // ledger rows for the request: [{ bucket:'grant', credits:-15, idemKey:`usage:${id}:change` }, { bucket:'topup', credits:-5, idemKey:`usage:${id}:change:topup` }], createdBy 'test:actor'
    // workspace { grantBalance 0, topupBalance 95, creditsHeld 0 }; request { creditsHeld 0, creditsPrice 20 }
  });
  it('paid entirely from top-up: one row under the plain key', ...);   // { grant 0, topup 50 }
  it('a retried charge never double-charges', async () => {
    // charge twice → second { ...same split, alreadyCharged: true }; ledger count unchanged; balances moved once
  });
  it('charges without a prior hold (drop of a started page draft)', ...); // { grant 100 } charge 'drop' → -15 grant
  it('refuses with 402 when even after releasing its own hold the price is not covered', ...); // { grant 10 }, request.creditsHeld 10 (set directly), charge 'change'
  it('reset keeps the hold: held on 31 Oct, reset, charged from November', async () => {
    // workspace 9115 { grant 20, topup 0 }; hold 20 (held 20).
    // The reset the way FS-94 will do it, in one prisma.$transaction: ledger adjust -20 (bucket grant, period '2026-11', idemKey 'adjust:2026-11'),
    // ledger grant +200 (period '2026-11', idemKey 'grant:2026-11'), workspace { grantBalance: 200 } — creditsHeld untouched (still 20 ≤ 200).
    // credits.clock = 2026-11-02; charge 'change' → { fromGrant: 20, fromTopup: 0 }; workspace { grantBalance 180, creditsHeld 0 }
  });
});
describe('release', () => {
  it('drops the hold and writes nothing to the ledger', ...);  // hold 20 → release → { released: 20 }, both creditsHeld 0, ledger count unchanged
  it('is a no-op without a hold', ...);                          // { released: 0 }
});
```

- [ ] **Step 2: Run the suite** — Expected: the new cases FAIL with `Task 5`.
- [ ] **Step 3: Implement `charge` and `release`.** `charge`: after `lock`, `existing = tx.creditLedger.findMany({ where: { workspaceId, idemKey: { in: [key, key + ':topup'] } } })`; if any → return `{ price: −sum, fromGrant: −grant row, fromTopup: −topup row, alreadyCharged: true }`. Else release own hold (both columns), `available = availableCredits(wsAfterRelease)`; short → 402 as in `hold`; `splitCharge(grantBalance, price)`; `createMany` the rows (`kind: 'usage'`, `requestId`, `createdBy: scope.actor`, plain key on the first non-zero bucket row, `:topup` only when both are non-zero); decrement balances; set `creditsPrice`. `release`: `held = req.creditsHeld`; if 0 return; update both rows.
- [ ] **Step 4: Run the suite and `npm test`** — Expected: all PASS.
- [ ] **Step 5: Commit** — `FS-92 CreditsService: charge() splits monthly first; release()`

---

### Task 6: `requestCard()` helper

**Files:**
- Create: `src/portal/requests/request-card.ts`, `src/portal/requests/request-card.spec.ts`

**Interfaces:**
- Consumes: `mapStatus`, `ActiveStatus` from `src/contract/status.ts`; `RequestCard` from `src/contract/requests.ts`.
- Produces:
  ```ts
  export interface RequestRow { id: string; number: number; type: RequestType; title: string; status: RequestStatus; closeReason: CloseReason | null; creditsHeld: number; updatedAt: Date }
  /** stoppedAt: the last active status before pending_chi/closed (from request_event). replyBy is FS-102's; null until then. */
  export function requestCard(row: RequestRow, stoppedAt?: ActiveStatus | null, replyBy?: string | null): z.infer<typeof RequestCard>
  ```

- [ ] **Step 1: Write the spec**: a `draft` change → `statusKey 'Draft-You'`, `owner 'client'`, `replyBy null`, `creditsHeld 20`, `updatedAt` as ISO string, and `RequestCard.parse` does not throw; a `closed`/`client_cancelled` change with `stoppedAt 'draft'` → `badge 'Cancelled (You)'`, every step `todo`.
- [ ] **Step 2: Run** `npx vitest run src/portal/requests/request-card.spec.ts` — FAIL.
- [ ] **Step 3: Implement.** `updatedAt: row.updatedAt.toISOString()`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `FS-92 requestCard(): the card every request route returns`

---

### Task 7: `POST /portal/requests/:id/drop`

**Files:**
- Create: `src/portal/drafts/drop.service.ts`, `src/portal/drafts/drop.service.spec.ts`, `test/db/portal-drop.int-spec.ts`
- Modify: `src/portal/chat.controller.ts` (inject `DropService`, call it, add `'NOT_ENOUGH_CREDITS'` to the route's `@ApiErrors`), `src/portal/portal.module.ts` (provide `DropService`), `openapi.json` (regenerated)

**Interfaces:**
- Consumes: `CreditsService` (Tasks 4–5), `requestCard` (Task 6), `WorkspaceScope`, `DropBody`/`DropResponse` from the contract, fixtures from Task 4.
- Produces:
  ```ts
  export interface DraftFacts { creditsHeld: number; pagePlan: unknown; layoutOptions: unknown; baMessagesAfterGreeting: number }
  /** AI already used: a hold, a plan or layout options, or agent-ba said anything after the greeting. */
  export function hasStarted(facts: DraftFacts): boolean
  @Injectable() export class DropService {
    constructor(prisma: PrismaService, credits: CreditsService);
    drop(scope: WorkspaceScope, requestId: string, body: z.infer<typeof DropBody>): Promise<z.infer<typeof DropResponse>>;
  }
  ```

- [ ] **Step 1: Write `drop.service.spec.ts` for `hasStarted`**: false for `{ 0, null, null, 0 }`; true when any one of `creditsHeld 20`, `pagePlan {}`, `layoutOptions []`, `baMessagesAfterGreeting 1` is set.
- [ ] **Step 2: Run** `npx vitest run src/portal/drafts/drop.service.spec.ts` — FAIL.
- [ ] **Step 3: Implement `hasStarted` and `DropService.drop`.** Load `tx`-free: `prisma.request.findFirst({ where: { id, workspaceId }, include: { workspace: { select: { status: true } }, _count: { select: { messages: { where: { role: 'ba', seq: { gt: 1 } } } } } } })`. Null → 404. `workspace.status !== 'active'` → 403. Status not `draft`/`paused` → 409. `cost = started ? await credits.price(prisma, 'drop') : 0`. No `confirm` → `{ dropped: false, cost, request: null }`. Else `credits.run(workspaceId, async (tx) => { cost > 0 ? charge(tx, scope, 'drop') : release(tx, scope); updated = tx.request.update({ status: 'closed', closeReason: 'client_cancelled' }); tx.requestEvent.create({ fromStatus: previous, toStatus: 'closed', actorAccountId: scope.accountId }); return requestCard(updated, previous) })` where `scope = { workspaceId, requestId, actor: ws.accountId }` and `previous` is the status read before the transaction (`draft` or `paused`, both `ActiveStatus`).
- [ ] **Step 4: Wire the controller**: constructor `(private readonly dropService: DropService)`, `drop()` returns `this.dropService.drop(ws, params.id, body)`; `@ApiErrors('NOT_FOUND', 'INVALID_STATE', 'NOT_ENOUGH_CREDITS', 'WORKSPACE_READ_ONLY')`. Add `DropService` to `PortalModule` providers.
- [ ] **Step 5: Regenerate the contract**: `npm run openapi`; `git diff --stat openapi.json` shows only the drop route's 402 block.
- [ ] **Step 6: Write `test/db/portal-drop.int-spec.ts`** (setup as in Task 4; calls via supertest with `bearer({ claims: { client_id } })` and header `Idempotency-Key: <uuid>`):

```ts
it('previews the cost of a started draft without touching anything', ...); // draft with creditsHeld 20 (and workspace creditsHeld 20): body {} → 200 { dropped:false, cost:15, request:null }; balances unchanged
it('drops a started draft: 15 charged, hold released, closed card', ...);  // { confirm:true } → { dropped:true, cost:15, request:{ status:'closed', closeReason:'client_cancelled', badge:'Cancelled (You)', creditsHeld:0 } }; one ledger row usage:<id>:drop −15 grant; workspace creditsHeld 0; request_event draft→closed with actorAccountId = token sub
it('drops a paused draft the same way', ...);
it('an unstarted draft drops for free: no ledger row', ...);               // { dropped:true, cost:0 }
it('a started draft that cannot pay gets 402 with draftId', ...);          // workspace grant 10, no hold, pagePlan set
it('#43 (uat) gets 409 INVALID_STATE', ...);
it("another client's draft gets 404", ...);
it('without Idempotency-Key gets 400 VALIDATION_FAILED', ...);
it('two confirmed drops at once: one 200, one 409, one ledger row', ...); // Promise.all of two supertest calls
it('/portal/me shows the hold gone right after the drop', ...);
```

- [ ] **Step 7: Run** `npx vitest run --config vitest.db.config.mts test/db/portal-drop.int-spec.ts` — Expected: PASS. Then `npm test` (includes `test/openapi.e2e-spec.ts`) — PASS.
- [ ] **Step 8: Commit** — `FS-92 POST /portal/requests/:id/drop: 15 credits once a draft has started`

---

### Task 8: README, full verification, PR

**Files:**
- Modify: `README.md` (layout block + a "Credits" paragraph under Database)

- [ ] **Step 1: README.** Add `src/credits/    CreditsService: run/hold/charge/release, prices, the /portal/me cache` to the layout block. Under Database add a short paragraph: every credit write goes through `credits.run()`, which locks the workspace row and invalidates the `/portal/me` cache after the commit; monthly before top-up; ledger key `usage:<requestId>:<action>`; `credit_ledger` is append-only.
- [ ] **Step 2: Full verification**

Run: `npm run typecheck && npm test && npm run test:db && npm run openapi && git status --short`
Expected: all green; `git status` shows only `README.md` (openapi.json unchanged after regeneration).

- [ ] **Step 3: Commit** — `FS-92 Document the credits service`
- [ ] **Step 4: Push and open the PR** into `development`: title `FS-92: [BE] Credits: hold, charge and release service`, body listing the four "done when" tests and the drop route, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Then move FS-92 to In Progress in Jira (transition 21) if it is not already.
