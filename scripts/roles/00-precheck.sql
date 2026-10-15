-- Read-only. Run first, as the database owner, in the environment you are about
-- to set up:
--
--   psql "$OWNER_URL" -X -f scripts/roles/00-precheck.sql
--
-- What to look for:
--   server_version          18 or later (the migration uses uuidv7())
--   can_create_roles        t
--   studio_* roles          absent before setup; after it, present and
--                           in_neon_superuser = f (see README: console roles
--                           join neon_superuser and bypass every grant)
--   studio_schema           absent before setup; after it, owned by studio_migrator
--   client_directory        present once billing's CP-101 has shipped

\pset footer off

SELECT current_setting('server_version') AS server_version,
       current_user AS connected_as,
       (SELECT rolcreaterole OR rolsuper FROM pg_roles WHERE rolname = current_user) AS can_create_roles;

SELECT r.rolname AS role,
       r.rolcanlogin AS can_login,
       EXISTS (SELECT FROM pg_roles s WHERE s.rolname = 'neon_superuser')
         AND pg_has_role(r.rolname, 'neon_superuser', 'MEMBER') AS in_neon_superuser,
       r.rolsuper AS is_superuser
FROM pg_roles r
WHERE r.rolname IN ('studio_migrator', 'studio_app')
ORDER BY 1;

SELECT n.nspname AS studio_schema, pg_get_userbyid(n.nspowner) AS owner
FROM pg_namespace n
WHERE n.nspname = 'studio';

SELECT coalesce(to_regclass('billing.client_directory')::text, 'missing') AS client_directory;
