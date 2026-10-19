import { WORKSPACE_CACHE_TTL_MS, WorkspaceCache } from './workspace-cache';

describe('WorkspaceCache', () => {
  let now: number;
  let cache: WorkspaceCache<string>;
  let loads: number;
  const load = async () => `v${++loads}`;

  beforeEach(() => {
    now = 0;
    loads = 0;
    cache = new WorkspaceCache<string>();
    cache.now = () => now;
  });

  it('loads once and reuses the value within the TTL', async () => {
    expect(await cache.get(9001, load)).toBe('v1');
    now = WORKSPACE_CACHE_TTL_MS - 1;
    expect(await cache.get(9001, load)).toBe('v1');
    expect(loads).toBe(1);
  });

  it('loads again once the TTL has passed', async () => {
    await cache.get(9001, load);
    now = WORKSPACE_CACHE_TTL_MS;
    expect(await cache.get(9001, load)).toBe('v2');
  });

  it('invalidate() makes the next call load fresh, for that workspace only', async () => {
    await cache.get(9001, load);
    await cache.get(9002, load);
    cache.invalidate(9001);
    expect(await cache.get(9001, load)).toBe('v3');
    expect(await cache.get(9002, load)).toBe('v2');
  });

  it('does not cache a failed load', async () => {
    await expect(cache.get(9001, () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await cache.get(9001, load)).toBe('v1');
  });

  it('a load that began before invalidate() is not kept: the next call reads fresh', async () => {
    let finish!: (value: string) => void;
    const slow = new Promise<string>((resolve) => (finish = resolve));
    const inFlight = cache.get(9001, () => slow); // SELECT ran before a credit write committed…
    cache.invalidate(9001); // …which invalidated after its commit…
    finish('stale');
    expect(await inFlight).toBe('stale'); // …so this caller sees the old balances once, fine,
    expect(await cache.get(9001, load)).toBe('v1'); // but nobody else does for the next 60 s.
  });
});
