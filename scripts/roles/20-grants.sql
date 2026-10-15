-- (Re)applies studio_app's grants. Idempotent. Run as studio_migrator or the
-- database owner, after 10-create-roles.sql and after the migrations:
--
--   psql "$OWNER_URL" -X -v ON_ERROR_STOP=1 -f scripts/roles/20-grants.sql
--
-- The first migration applies the same grants itself when studio_app already
-- exists; this script covers an environment where the role came later, and
-- billing.client_directory once billing's CP-101 has shipped.

\set ON_ERROR_STOP 1

GRANT USAGE ON SCHEMA studio TO studio_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA studio TO studio_app;

-- Append-only: insert and read, never change or remove.
REVOKE UPDATE, DELETE ON studio.credit_ledger, studio.request_event, studio.ai_usage, studio.audit_log FROM studio_app;
REVOKE ALL ON studio._prisma_migrations FROM studio_app;

-- Billing's read-only client list (CP-101). Nothing else in billing.
SELECT 'GRANT USAGE ON SCHEMA billing TO studio_app'
WHERE to_regclass('billing.client_directory') IS NOT NULL
\gexec
SELECT 'GRANT SELECT ON billing.client_directory TO studio_app'
WHERE to_regclass('billing.client_directory') IS NOT NULL
\gexec
