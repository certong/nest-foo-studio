# nest-foo-studio

Studio's backend: the client portal API (`/portal`), plus admin, internal and live-update routes as they land. Source of truth for the endpoints: the **foo-studio — Backend API List** doc. Sign-in and PINs stay in `nest-foo-auth`; Studio only checks its tokens.

## Status: contract only (FS-85)

All 35 `/portal` routes exist, with their real paths, request/response schemas and error replies. Each handler answers `501 NOT_IMPLEMENTED` with `details.ticket` naming the ticket that builds it (FS-86…FS-103).

## For the frontend

`openapi.json` at the repo root is the contract (OpenAPI 3.1). Use it directly; you don't need to run this server.

```sh
# Types
npx openapi-typescript ../nest-foo-studio/openapi.json -o src/api/schema.d.ts

# A mock server on :4010 (add `Prefer: code=402` to get an error reply)
npx @stoplight/prism-cli mock ../nest-foo-studio/openapi.json
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

## Commands

```sh
npm run start:dev   # :3002, Swagger UI at /docs
npm test            # vitest
npm run openapi     # regenerate openapi.json after changing a schema or route
```

A test fails when the committed `openapi.json` no longer matches the code, so run `npm run openapi` and commit the result with any contract change.

## Branches

Feature branch → PR into `development` → `uat` → `main` (production). Never PR a feature branch straight into `uat` or `main`.
