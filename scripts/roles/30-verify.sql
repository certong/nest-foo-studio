-- Read-only. Proves the roles do what FS-33 says; every row should read ok = t.
--
--   psql "$OWNER_URL" -X -f scripts/roles/30-verify.sql

\pset footer off

WITH checks(rule, ok) AS (
  VALUES
    ('studio_migrator owns schema studio',
      (SELECT pg_get_userbyid(nspowner) = 'studio_migrator' FROM pg_namespace WHERE nspname = 'studio')),
    ('studio_migrator is not in neon_superuser',
      NOT (EXISTS (SELECT FROM pg_roles WHERE rolname = 'neon_superuser')
           AND pg_has_role('studio_migrator', 'neon_superuser', 'MEMBER'))),
    ('studio_app is not in neon_superuser',
      NOT (EXISTS (SELECT FROM pg_roles WHERE rolname = 'neon_superuser')
           AND pg_has_role('studio_app', 'neon_superuser', 'MEMBER'))),
    ('neither role is a superuser',
      NOT EXISTS (SELECT FROM pg_roles WHERE rolname IN ('studio_migrator', 'studio_app') AND rolsuper)),
    ('studio_app can read and write request',
      has_table_privilege('studio_app', 'studio.request', 'SELECT, INSERT, UPDATE, DELETE')),
    ('studio_app can insert into credit_ledger',
      has_table_privilege('studio_app', 'studio.credit_ledger', 'INSERT')),
    ('studio_app cannot UPDATE or DELETE credit_ledger',
      NOT has_table_privilege('studio_app', 'studio.credit_ledger', 'UPDATE')
      AND NOT has_table_privilege('studio_app', 'studio.credit_ledger', 'DELETE')),
    ('studio_app cannot UPDATE or DELETE request_event',
      NOT has_table_privilege('studio_app', 'studio.request_event', 'UPDATE')
      AND NOT has_table_privilege('studio_app', 'studio.request_event', 'DELETE')),
    ('studio_app cannot UPDATE or DELETE ai_usage',
      NOT has_table_privilege('studio_app', 'studio.ai_usage', 'UPDATE')
      AND NOT has_table_privilege('studio_app', 'studio.ai_usage', 'DELETE')),
    ('studio_app cannot UPDATE or DELETE audit_log',
      NOT has_table_privilege('studio_app', 'studio.audit_log', 'UPDATE')
      AND NOT has_table_privilege('studio_app', 'studio.audit_log', 'DELETE')),
    ('studio_app cannot touch _prisma_migrations',
      NOT has_table_privilege('studio_app', 'studio._prisma_migrations', 'SELECT')),
    ('studio_app can read billing.client_directory (once CP-101 ships)',
      to_regclass('billing.client_directory') IS NULL
      OR has_table_privilege('studio_app', 'billing.client_directory', 'SELECT'))
)
SELECT rule, coalesce(ok, false) AS ok FROM checks;
