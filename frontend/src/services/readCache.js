// A short-lived, account-scoped memory cache. Failed reads are never retained.
export function createReadCache({ getScope, ttl = 30_000, maxEntries = 60, now = Date.now }) {
  const entries = new Map();
  const pending = new Map();
  let scope;
  let revision = 0;
  const clear = () => { revision += 1; entries.clear(); pending.clear(); };
  const syncScope = () => {
    const next = getScope();
    if (next !== scope) { clear(); scope = next; }
    return next;
  };
  const peek = key => {
    syncScope();
    const entry = entries.get(key);
    if (!entry || now() - entry.at >= ttl) { entries.delete(key); return undefined; }
    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  };
  return {
    clear,
    peek,
    invalidate: (matches = () => true) => {
      revision += 1;
      for (const key of entries.keys()) if (matches(key)) entries.delete(key);
      for (const key of pending.keys()) if (matches(key)) pending.delete(key);
    },
    read: (key, load, { force = false } = {}) => {
      const owner = syncScope();
      const cached = peek(key);
      if (!force && cached !== undefined) return Promise.resolve(cached);
      if (!force && pending.has(key)) return pending.get(key).promise;
      const requestRevision = revision;
      const request = {};
      request.promise = Promise.resolve().then(load).then(value => {
        if (syncScope() !== owner) {
          const error = new Error('The account changed while loading.');
          error.name = 'AbortError';
          throw error;
        }
        if (revision === requestRevision && pending.get(key) === request) {
          entries.set(key, { value, at: now() });
          while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
        }
        return value;
      }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
      pending.set(key, request);
      return request.promise;
    },
  };
}

export const readResource = url => typeof url === 'string'
  ? url.match(/^\/(experience|portfolio|coverletter|company-folders)(?:\/|$)/)?.[1]
  : undefined;

export function isCacheableRead(url, config = {}) {
  if (config.signal || config.cancelToken || config.params || config.cache === false || config.responseType) return false;
  return /^\/(?:experience|portfolio|coverletter)\/[^/?]+$/.test(url)
    || url === '/company-folders';
}
