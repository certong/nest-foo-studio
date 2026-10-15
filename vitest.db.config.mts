import { config as loadEnvFile } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * The database suite: rules only Postgres can prove (FS-33). The CHECKs,
 * composite foreign keys, partial unique indexes, the append-only grants and
 * the State B seed.
 *
 *   npm run test:db                                    # TEST_DATABASE_URL from .env
 *   TEST_DATABASE_URL=postgresql://… npm run test:db   # or passed in
 *
 * TEST_DATABASE_URL names a Postgres 18 server and an admin database, as a
 * superuser (locally: the Docker container, user foo, database postgres). Each
 * run creates its own throwaway database, migrates it and drops it afterwards;
 * foo_platform is never touched. Without the variable every case is skipped.
 */

// vitest does not read .env; without this a TEST_DATABASE_URL set there would
// be ignored and the suite would skip itself and pass.
loadEnvFile({ quiet: true });

const { TEST_DATABASE_URL } = process.env;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['test/db/**/*.int-spec.ts'],
    // Spread: an undefined value would arrive as the string "undefined".
    env: { TZ: 'UTC', ...(TEST_DATABASE_URL ? { TEST_DATABASE_URL } : {}) },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});
