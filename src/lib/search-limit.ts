/** Temporary per-worker protection; resets on restart and is not globally enforced. */
export function createSearchLimiter(limit = 10, windowMs = 60_000) {
  const callers = new Map<string, { count: number; resetAt: number }>();
  return (caller: string, now = Date.now()) => {
    for (const [key, entry] of callers) if (entry.resetAt <= now) callers.delete(key);
    const existing = callers.get(caller);
    if (existing && existing.count >= limit) return false;
    if (!existing && callers.size >= 2000) return false;
    callers.set(caller, { count: (existing?.count ?? 0) + 1, resetAt: existing?.resetAt ?? now + windowMs });
    return true;
  };
}