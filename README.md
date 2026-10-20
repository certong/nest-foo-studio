# nest-foo-studio

Studio's backend: the client portal API (`/portal`), plus admin, internal and live-update routes as they land. Source of truth for the endpoints: the **foo-studio — Backend API List** doc. Sign-in and PINs stay in `nest-foo-auth`; Studio only checks its tokens.

## Status

- **Contract (FS-85):** all 35 `/portal` routes exist, with their real paths, request/response schemas and error replies. Each handler answers `501 NOT_IMPLEMENTED` with `details.ticket` naming the ticket that builds it (FS-86…FS-103).
- **Database (FS-33):** schema `studio`, 18 tables, roles and the Kopi Lane seed.
- **Live routes:** `GET /portal/me` (FS-86). Every `/portal` route checks nest-foo-auth's access token: ES256, `aud=studio`, a client account with its `client_id`. Anything else gets 401 `TOKEN_EXPIRED`.

## For the frontend

`openapi.json` at the repo root is the contract (OpenAPI 3.1). Use it directly; you don't need to run this server.

react-foo-studio has scripts for generating types and running a mock (FS-104). They read `../../Nest/nest-foo-studio/openapi.json` (the two repos live in `~/Workspace/React` and `~/Workspace/Nest`); set `OPENAPI_FILE` to use another path.

```sh
# in react-foo-studio
npm run api:types   # openapi-typescript → src/api/schema.d.ts (committed there)
npm run mock:api    # Prism mock on :4010; add `Prefer: code=402` for an error reply
```

Conventions, also in the spec's description:

- `Authorization: Bearer <access token>` on every `/portal` call. The workspace comes from the token's `client_id`, never from the URL or body.
- Errors are `{ code, message, details? }`. The `Error_*` schemas list every code and its `details`.
- Request status: use `statusKey`, `badge`, `owner` and `steps[]` from the API, not your own mapping.
- POSTs that spend credits, publish or grant need an `Idempotency-Key` header (a fresh UUID per user action).

## Layout

```
src/contract/   zod schemas: the contract itself, no Nest imports
  status.ts     DB status → statusKey, badge, owner, steps (mapStatus)
  errors.ts     error codes, HTTP statuses, details shapes
src/common/     StudioException, the error filter, @ApiErrors, @RequireIdempotencyKey, @CurrentWorkspace
src/portal/     controllers and DTOs over the contract
src/openapi.ts  builds the document for /docs and openapi.json
```

## Database

Schema `studio` in `foo_platform`, beside `auth` and `billing`. The source of truth is the **foo-studio — Database Design** doc.

- `prisma/schema.prisma` has the tables. Its migrations add what Prisma can't express: CHECKs, partial indexes, and `studio_app`'s grants. A later `prisma migrate dev` will offer to drop those partial indexes; keep them.
- Ids are UUIDv7 from Postgres 18's `uuidv7()`. `workspace.id` is the billing client id.
- `scripts/roles/` sets up an environment's two roles (`studio_migrator`, `studio_app`). Create them over SQL, never in the Neon console; [scripts/roles/README.md](scripts/roles/README.md) explains why. On Neon the service connects as the environment app role (`foo_development_app`, `foo_uat_app`, `foo_production_app`) rather than as those two, which means the append-only grants constrain it only locally — same file, [How the service actually connects on Neon](scripts/roles/README.md#how-the-service-actually-connects-on-neon).

Locally, against the Docker Postgres 18 container:

```sh
npm run prisma:deploy   # apply migrations to DATABASE_URL
npm run seed            # Kopi Lane, "State B": #37–#43, 220 free credits
npm run test:db         # throwaway databases on TEST_DATABASE_URL
```

## Commands

```sh
npm run start:dev   # :3002, Swagger UI at /docs
npm test            # vitest (no database)
npm run test:db     # database rules, on TEST_DATABASE_URL
npm run openapi     # regenerate openapi.json after changing a schema or route
```

A test fails when the committed `openapi.json` no longer matches the code, so run `npm run openapi` and commit the result with any contract change.

## Branches

Feature branch → PR into `development` → `uat` → `main` (production). Never PR a feature branch straight into `uat` or `main`.
