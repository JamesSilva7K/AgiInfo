import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { checkRateLimit, extractClientIp } from "./lib/security";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function applySecurityHeaders(headers: Headers): void {
  // Prevent clickjacking & framing attacks (anti-copy and anti-phishing)
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // Mask server fingerprinting to prevent enumeration of backend stack
  headers.delete("X-Powered-By");
  headers.delete("Server");
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const clientIp = extractClientIp(request);
      const url = new URL(request.url);

      // Webhook do Telegram para receber comandos do Admin Supremo (/whatsapp, /nome, /add_token, etc)
      if (url.pathname === "/api/telegram-webhook" && request.method === "POST") {
        try {
          const body = await request.json();
          const { handleTelegramUpdate } = await import("./lib/telegram-webhook");
          await handleTelegramUpdate(body);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false }), { status: 200 });
        }
      }

      // Protect against endpoint flooding and automated scanners
      const isApiOrPost = request.method !== "GET" || url.pathname.includes("/_serverFn");
      const limitRule = isApiOrPost
        ? { windowMs: 60_000, maxRequests: 60 } // stricter for state/actions
        : { windowMs: 60_000, maxRequests: 180 }; // reasonable threshold for asset/page navigation

      const rateCheck = checkRateLimit(`${clientIp}:${isApiOrPost ? "action" : "view"}`, limitRule);

      if (!rateCheck.allowed) {
        return new Response("Too Many Requests. Anti-abuse rate limit exceeded.", {
          status: 429,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Retry-After": Math.ceil((rateCheck.resetAt - Date.now()) / 1000).toString(),
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      const handler = await getServerEntry();
      const rawResponse = await handler.fetch(request, env, ctx);
      const response = await normalizeCatastrophicSsrResponse(rawResponse);

      const secureHeaders = new Headers(response.headers);
      applySecurityHeaders(secureHeaders);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: secureHeaders,
      });
    } catch (error) {
      console.error(error);
      const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
      applySecurityHeaders(headers);
      return new Response(renderErrorPage(), {
        status: 500,
        headers,
      });
    }
  },
};

