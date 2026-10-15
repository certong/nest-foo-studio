-- Creates Studio's two roles and its schema. Once per environment, as the
-- database owner, over SQL (never in the Neon console: see README):
--
--   psql "$OWNER_URL" -X -v ON_ERROR_STOP=1 \
--     -v migrator_password="$STUDIO_MIGRATOR_PASSWORD" \
--     -v app_password="$STUDIO_APP_PASSWORD" \
--     -f scripts/roles/10-create-roles.sql
--
-- studio_migrator owns schema studio and runs `prisma migrate deploy` (DIRECT_URL).
-- studio_app runs the API through the pooler (DATABASE_URL); its grants come
-- from the migrations and from 20-grants.sql.
--
-- Safe to re-run: it creates what is missing and sets both roles' LOGIN and
-- passwords to the ones passed (so a re-run is also how to rotate them).

\set ON_ERROR_STOP 1

SELECT format('CREATE ROLE studio_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studio_migrator')
\gexec

SELECT format('CREATE ROLE studio_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'studio_app')
\gexec

ALTER ROLE studio_migrator LOGIN PASSWORD :'migrator_password';
ALTER ROLE studio_app LOGIN PASSWORD :'app_password';

-- The owner needs to act as studio_migrator to hand it the schema and set its
-- default privileges. SET without INHERIT: the owner gains nothing by default.
GRANT studio_migrator TO CURRENT_USER WITH INHERIT FALSE, SET TRUE;

SELECT format('GRANT CONNECT ON DATABASE %I TO studio_migrator, studio_app', current_database())
\gexec

CREATE SCHEMA IF NOT EXISTS studio AUTHORIZATION studio_migrator;
ALTER SCHEMA studio OWNER TO studio_migrator;

-- The rest is studio_migrator's to give: as the owner it grants the schema,
-- and default privileges can only be set by the role itself (a SET-only
-- membership is not enough on Neon, where the owner is not a superuser).
SET ROLE studio_migrator;

GRANT USAGE ON SCHEMA studio TO studio_app;

-- Tables that later migrations create are readable and writable by the API.
-- A migration that adds an append-only table must REVOKE UPDATE, DELETE itself.
ALTER DEFAULT PRIVILEGES IN SCHEMA studio
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO studio_app;

RESET ROLE;
