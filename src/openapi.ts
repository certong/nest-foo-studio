import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { z } from 'zod';
import { errorSchemaName } from './common/api-errors.decorator';
import { ERROR_CODES, errorEnvelope } from './contract/errors';

/**
 * The OpenAPI document FE codegens types and mocks from. Built the same way
 * for /docs and for the committed openapi.json (npm run openapi).
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('foo-studio API')
    .setDescription(
      [
        'Client portal contract (FS-85). JSON in and out, camelCase, UTC ISO times.',
        '',
        '- Auth: `Authorization: Bearer <access token>` from the auth service. The workspace always comes from the token’s client_id, never from the URL or body.',
        '- Errors: `{ code, message, details? }`; see the `Error_*` schemas.',
        '- Lists: `?cursor=…&limit=20`, reply has `nextCursor`.',
        '- Any POST that spends credits, publishes or grants needs an `Idempotency-Key` header.',
      ].join('\n'),
    )
    .setOpenAPIVersion('3.1.0')
    .setVersion('0.1.0')
    .addServer('https://api.studio.foocertong.com')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  // 3.1: zod emits JSON Schema 2020-12 (type: [..., 'null'], numeric
  // exclusiveMinimum), which is only valid OpenAPI from 3.1 on.
  const doc = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config), { version: '3.1' });

  // Error envelopes are referenced by ApiErrors(); they are not DTO classes,
  // so they are added here straight from the contract. NOT_IMPLEMENTED is a
  // stub's reply, not part of the contract FE builds against.
  const schemas = (doc.components ??= {}).schemas ?? {};
  for (const code of ERROR_CODES.filter((c) => c !== 'NOT_IMPLEMENTED')) {
    const { $schema: _drop, ...schema } = z.toJSONSchema(errorEnvelope(code), { target: 'draft-2020-12' });
    schemas[errorSchemaName(code)] = schema as never;
  }
  doc.components.schemas = Object.fromEntries(Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b)));
  return dropOutputSuffix(doc);
}

/**
 * nestjs-zod names every response schema `X_Output`, which would leak into
 * FE's generated types. Rename to `X` wherever that is unambiguous: no `X`
 * exists, or the existing `X` (a request-side copy) is identical.
 */
function dropOutputSuffix(doc: OpenAPIObject): OpenAPIObject {
  const schemas = doc.components?.schemas ?? {};
  const renames = new Map<string, string>();
  for (const name of Object.keys(schemas)) {
    if (!name.endsWith('_Output')) continue;
    const base = name.slice(0, -'_Output'.length);
    if (!(base in schemas) || JSON.stringify(schemas[base]) === JSON.stringify(schemas[name])) {
      renames.set(name, base);
    }
  }
  let json = JSON.stringify(doc);
  for (const [from, to] of renames) {
    json = json.split(`"#/components/schemas/${from}"`).join(`"#/components/schemas/${to}"`);
  }
  const out = JSON.parse(json) as OpenAPIObject;
  const renamed = Object.entries(out.components?.schemas ?? {}).map(([name, schema]) => [renames.get(name) ?? name, schema]);
  out.components!.schemas = Object.fromEntries(renamed.sort(([a], [b]) => String(a).localeCompare(String(b))));
  return out;
}
