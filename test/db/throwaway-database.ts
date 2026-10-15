import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** False when there is no database to test against; suites skip themselves. */
export const HAS_DATABASE = Boolean(TEST_DATABASE_URL);

export interface ThrowawayDatabase {
  prisma: PrismaClient;
  drop(): Promise<void>;
}

/**
 * Creates foo_studio_test_<random> on the TEST_DATABASE_URL server, sets it up
 * the way scripts/roles does an environment (the two roles, schema studio owned
 * by studio_migrator), runs `prisma migrate deploy` with ?schema=studio, and
 * returns a client on it. The admin connection must be a superuser (the local
 * Docker Postgres's `foo` is): it creates the database and, once per server,
 * the roles. Test roles are NOLOGIN; tests act as them with SET ROLE.
 */
export async function createThrowawayDatabase(): Promise<ThrowawayDatabase> {
  const adminUrl = new URL(TEST_DATABASE_URL!);
  const name = `foo_studio_test_${randomBytes(4).toString('hex')}`;

  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  // Roles are server-wide: made once, kept between runs.
  for (const role of ['studio_migrator', 'studio_app']) {
    await admin.$executeRawUnsafe(
      `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
    );
  }
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  url.searchParams.set('schema', 'studio');

  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await prisma.$executeRawUnsafe('CREATE SCHEMA studio AUTHORIZATION studio_migrator');
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() },
      stdio: 'pipe',
      shell: process.platform === 'win32',
    });
  } catch (error) {
    await prisma.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.$disconnect();
    throw error;
  }

  return {
    prisma,
    async drop() {
      await prisma.$disconnect();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.$disconnect();
    },
  };
}
