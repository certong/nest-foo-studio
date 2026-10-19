import { Injectable } from '@nestjs/common';

/** How long a workspace's /portal/me data is reused before Neon is asked again. */
export const WORKSPACE_CACHE_TTL_MS = 60_000;

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A short in-memory cache per workspace, so /portal/me (called on every page)
 * rarely wakes Neon. One Railway container serves all clients, so in-memory
 * is enough. Anything that writes credits (FS-92) must call invalidate().
 */
@Injectable()
export class WorkspaceCache<T = unknown> {
  private readonly entries = new Map<number, Entry<T>>();
  /** Bumped by invalidate(): a load that began under an older generation is not kept. */
  private readonly generations = new Map<number, number>();

  /** Replaceable in tests. */
  now: () => number = Date.now;

  async get(workspaceId: number, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(workspaceId);
    if (hit && hit.expiresAt > this.now()) return hit.value;
    const generation = this.generations.get(workspaceId) ?? 0;
    const value = await load();
    // A credit write may have committed and invalidated while the load was in
    // flight; its SELECT then saw the old balances, which must not be cached.
    if ((this.generations.get(workspaceId) ?? 0) === generation) {
      this.entries.set(workspaceId, { value, expiresAt: this.now() + WORKSPACE_CACHE_TTL_MS });
    }
    return value;
  }

  invalidate(workspaceId: number): void {
    this.entries.delete(workspaceId);
    this.generations.set(workspaceId, (this.generations.get(workspaceId) ?? 0) + 1);
  }
}
