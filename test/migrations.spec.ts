import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '..', 'prisma', 'migrations');
const migrations = readdirSync(DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => ({ name: d.name, sql: readFileSync(join(DIR, d.name, 'migration.sql'), 'utf8') }));

/**
 * Migrations run as studio_migrator, which owns schema studio and nothing
 * else (scripts/roles). The DB suite migrates as a superuser, so it cannot
 * catch a statement that needs more; these checks do.
 */
describe('prisma/migrations', () => {
  it('has migrations to check', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it.each(migrations)('$name needs no rights beyond schema studio', ({ sql }) => {
    // `prisma migrate diff --from-empty` adds CREATE SCHEMA "public"; studio_migrator may not.
    expect(sql).not.toMatch(/CREATE\s+SCHEMA/i);
    expect(sql).not.toMatch(/\b(CREATE|ALTER|DROP)\s+(ROLE|USER|DATABASE|EXTENSION)\b/i);
    expect(sql).not.toMatch(/"public"\./);
  });
});
