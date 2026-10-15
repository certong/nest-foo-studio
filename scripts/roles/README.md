# Studio's database roles (FS-33)

Two roles, one schema:

| Role | Connects through | Can |
|---|---|---|
| `studio_migrator` | `DIRECT_URL` (Neon direct host) | own schema `studio`; run `prisma migrate deploy` |
| `studio_app` | `DATABASE_URL` (Neon pooler) | read and write `studio`, except no `UPDATE`/`DELETE` on `credit_ledger`, `request_event`, `ai_usage`, `audit_log`; `SELECT` on `billing.client_directory` only |

## Create them over SQL, never in the Neon console

Roles made in the Neon console become members of `neon_superuser`, which reads and writes every table whatever the grants say. foo-auth found this in FA-22: its role split was applied nowhere for that reason. With a console role, the append-only rule would hold nowhere. `00-precheck.sql` and `30-verify.sql` both show `in_neon_superuser`, which must be `f`.

## Setting up an environment

Run as the database owner (`foo_development_app` on Neon development, `foo` on the local Docker Postgres):

```sh
psql "$OWNER_URL" -X -f scripts/roles/00-precheck.sql                 # read-only: what is there now
psql "$OWNER_URL" -X -v ON_ERROR_STOP=1 \
  -v migrator_password="$STUDIO_MIGRATOR_PASSWORD" \
  -v app_password="$STUDIO_APP_PASSWORD" \
  -f scripts/roles/10-create-roles.sql                                # roles + schema studio
DIRECT_URL="<studio_migrator, direct host, ?schema=studio>" npx prisma migrate deploy
psql "$OWNER_URL" -X -v ON_ERROR_STOP=1 -f scripts/roles/20-grants.sql # studio_app's grants
psql "$OWNER_URL" -X -f scripts/roles/30-verify.sql                   # every row ok = t
```

Then point the service at the roles:

```sh
DATABASE_URL="postgresql://studio_app:…@<host>-pooler…/foo_platform?sslmode=require&schema=studio&pgbouncer=true"
DIRECT_URL="postgresql://studio_migrator:…@<host>…/foo_platform?sslmode=require&schema=studio"
```

Generate the two passwords fresh for each environment, and keep them in that environment's secrets only.

## When a migration adds a table

`studio_app` gets read and write on it automatically (default privileges from `10-create-roles.sql`). If the new table is append-only, the migration that creates it must `REVOKE UPDATE, DELETE … FROM studio_app`, and `20-grants.sql` and `30-verify.sql` must list it too.

## Where it has been applied

| Environment | Date | Roles in `neon_superuser` | `30-verify.sql` | Seed |
|---|---|---|---|---|
| Local Docker Postgres 18.6 (`foo_platform`) | 2026-10-16 | n/a (no Neon) | 12/12 ok | Kopi Lane, workspace 9001 |
| Neon development (`ep-divine-hat`, Postgres 18.6) | 2026-10-16 | no | 12/12 ok | Kopi Lane, workspace 9001, seeded as `studio_app` |
| Neon UAT, production | not yet | | | |

On Neon the database owner (`foo_development_app`) is not a superuser, so `10-create-roles.sql` and `20-grants.sql` switch to `studio_migrator` (`SET ROLE`) for what only the schema owner can grant. Run as the owner, they print no warnings; a stream of "no privileges were granted" warnings means they ran as the wrong role.
