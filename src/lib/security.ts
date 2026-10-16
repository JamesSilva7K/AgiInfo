/**
 * In-memory sliding window rate limiter for protecting endpoints against brute-force and request flooding.
 */

type ClientRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, ClientRecord>();

// Clean up stale entries every 5 minutes to avoid memory accumulation
const timer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (record.resetAt <= now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof timer === "object" && timer && "unref" in timer && typeof timer.unref === "function") {
  timer.unref();
}

export type RateLimitOptions = {
  windowMs: number; // e.g. 60_000 (1 minute)
  maxRequests: number; // e.g. 100 requests per minute
};

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60_000, maxRequests: 120 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record || record.resetAt <= now) {
    const newRecord: ClientRecord = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    store.set(identifier, newRecord);
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt: newRecord.resetAt,
    };
  }

  if (record.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: options.maxRequests - record.count,
    resetAt: record.resetAt,
  };
}

export function extractClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const parts = xForwardedFor.split(",");
    const client = parts[0]?.trim();
    if (client) return client;
  }

  return "anonymous-client";
}
