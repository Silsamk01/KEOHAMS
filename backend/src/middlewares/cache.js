// Simple in-memory TTL cache middleware for idempotent GET endpoints.
// Not for user-specific or sensitive data. For production, swap to Redis.

const DEFAULT_TTL_MS = 60 * 1000; // 1 minute
const MAX_ENTRIES = 500; // basic LRU cap

const store = new Map(); // key -> { expires, value }

function prune() {
  if (store.size <= MAX_ENTRIES) return;
  // naive prune: remove oldest by insertion order
  const removeCount = Math.ceil(store.size * 0.1);
  let i = 0;
  for (const key of store.keys()) {
    store.delete(key);
    if (++i >= removeCount) break;
  }
}

function getKey(req) {
  return req.originalUrl; // includes query string
}

function cache(ttlMs = DEFAULT_TTL_MS) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = getKey(req);
    const now = Date.now();
    const hit = store.get(key);
    if (hit && hit.expires > now) {
      res.set('X-Cache', 'HIT');
      return res.status(200).send(hit.value);
    }
    // Wrap res.send
    const origSend = res.send.bind(res);
    res.send = (body) => {
      try {
        if (res.statusCode === 200) {
          store.set(key, { value: body, expires: now + ttlMs });
          prune();
          res.set('X-Cache', 'MISS');
        }
      } catch(_) {}
      return origSend(body);
    };
    next();
  };
}

module.exports = { cache };
