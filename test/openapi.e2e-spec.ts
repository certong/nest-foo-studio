import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApiDocument } from '../src/openapi';
import { createTestApp } from './create-test-app';

/** The 35 client-portal routes in the Backend API List (screens 1–15). */
const PORTAL_ROUTES = [
  'GET /portal/me',
  'GET /portal/home',
  'GET /portal/requests',
  'GET /portal/requests/summary',
  'GET /portal/requests/{id}',
  'POST /portal/requests',
  'GET /portal/requests/{id}/messages',
  'POST /portal/requests/{id}/messages',
  'POST /portal/requests/{id}/pause',
  'POST /portal/requests/{id}/resume',
  'POST /portal/requests/{id}/drop',
  'POST /portal/attachments',
  'GET /portal/attachments/{id}/url',
  'POST /portal/quotes',
  'GET /portal/requests/{id}/changes',
  'GET /portal/requests/{id}/review',
  'PATCH /portal/requests/{id}/review',
  'POST /portal/requests/{id}/approve',
  'POST /portal/requests/{id}/fix',
  'GET /portal/layouts',
  'POST /portal/requests/{id}/layout-options',
  'POST /portal/requests/{id}/layout-options/{optionId}/pick',
  'GET /portal/requests/{id}/plan',
  'POST /portal/requests/{id}/previews',
  'GET /portal/requests/{id}/previews/{n}',
  'GET /portal/requests/{id}/sign-off',
  'POST /portal/requests/{id}/sign-off',
  'GET /portal/requests/{id}/uat',
  'POST /portal/requests/{id}/uat/approve',
  'POST /portal/requests/{id}/uat/feedback',
  'GET /portal/credits',
  'GET /portal/credits/ledger',
  'POST /portal/topups',
  'GET /portal/topups',
  'POST /portal/topups/{id}/cancel',
];

/** Every POST that spends credits, publishes or grants. */
const IDEMPOTENT_ROUTES = [
  'POST /portal/requests/{id}/drop',
  'POST /portal/requests/{id}/approve',
  'POST /portal/requests/{id}/previews',
  'POST /portal/requests/{id}/sign-off',
  'POST /portal/requests/{id}/uat/approve',
  'POST /portal/topups',
];

interface Operation {
  parameters?: Array<{ name: string; in: string; required?: boolean }>;
  security?: unknown[];
}

function operations(doc: OpenAPIObject): Map<string, Operation> {
  const ops = new Map<string, Operation>();
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const [method, op] of Object.entries(item)) {
      ops.set(`${method.toUpperCase()} ${path}`, op as Operation);
    }
  }
  return ops;
}

describe('openapi.json', () => {
  let app: INestApplication;
  let doc: OpenAPIObject;

  beforeAll(async () => {
    app = await createTestApp();
    doc = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('the committed file is up to date (run `npm run openapi`)', () => {
    const committed: unknown = JSON.parse(readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8'));
    expect(JSON.parse(JSON.stringify(doc))).toEqual(committed);
  });

  it('has exactly the 35 portal routes', () => {
    expect([...operations(doc).keys()].sort()).toEqual([...PORTAL_ROUTES].sort());
  });

  it('every portal route takes a Bearer token', () => {
    for (const [route, op] of operations(doc)) {
      expect(op.security, route).toEqual([{ bearer: [] }]);
    }
  });

  it('exactly the money and publish POSTs require Idempotency-Key', () => {
    const requiring = [...operations(doc)]
      .filter(([, op]) => op.parameters?.some((p) => p.in === 'header' && p.name === 'Idempotency-Key' && p.required))
      .map(([route]) => route);
    expect(requiring.sort()).toEqual([...IDEMPOTENT_ROUTES].sort());
  });

  it('no route takes a workspace or client id from the URL, query or body', () => {
    const json = JSON.stringify(doc.paths) + JSON.stringify(doc.components?.schemas);
    expect(json).not.toMatch(/"(workspace_?id|client_?id)"/i);
  });

  it('every error response points at an Error_* envelope', () => {
    const json = JSON.stringify(doc.paths);
    const refs = [...json.matchAll(/#\/components\/schemas\/(Error_\w+)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of new Set(refs)) {
      expect(doc.components?.schemas, ref).toHaveProperty(ref!);
    }
  });
});
