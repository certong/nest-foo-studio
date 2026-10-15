import type { z } from 'zod';
import { PostMessageResponse } from './chat';
import { MeResponse } from './requests';

/** FE mocks from these examples, so they must stay valid against their schemas. */
describe.each([
  ['MeResponse', MeResponse],
  ['PostMessageResponse', PostMessageResponse],
] as Array<[string, z.ZodType]>)('%s examples', (_name, schema) => {
  it('parse against the schema', () => {
    const examples = (schema.meta()?.examples ?? []) as unknown[];
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) expect(() => schema.parse(example)).not.toThrow();
  });
});
