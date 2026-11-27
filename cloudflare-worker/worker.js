/**
 * SCORE MATCH LIGA POLSKA (SMPL) — CLOUDFLARE EDGE ANTI-DDOS & WAF SHIELD (v79)
 * Warstwa brzegowa chroniąca serwer origin (https://host976694.xce.pl):
 * - Edge WAF (blokada skanerów, exploitów, SQLi, XSS, path traversal i wycieków config/db)
 * - Tłumienie L7 burst floodów na brzegu Cloudflare (429 Retry-After)
 * - Walidacja limitu payloadu przed przekazaniem do PHP/Apache (413 Payload Too Large)
 * - Buforowanie statycznych zasobów w Cloudflare Edge Cache (caches.default)
 * - Dodawanie kryptograficznego nagłówka X-SMPL-CF-Shield dla weryfikacji ruchu na originie
 */

const DEFAULT_ORIGIN_URL = 'https://host976694.xce.pl';
const MAX_TRACKED_IPS = 2000;
const EDGE_BURST_WINDOW_MS = 60000;
const EDGE_DYNAMIC_LIMIT = 240;
const EDGE_POST_LIMIT = 30;
const GLOBAL_MAX_BODY_BYTES = 33554432;
const COMPACT_ACTION_MAX_BODY_BYTES = 131072;

const STATIC_ASSET_RE = /\.(svg|png|jpe?g|webp|gif|ico|woff2?|css|js)$/i;
const WAF_BLOCK_PATH_RE = /^\/(\.env|\.git|wp-admin|wp-login\.php|xmlrpc\.php|phpmyadmin|pma|vendor\/phpunit|cgi-bin|data\/|cloudflare-worker\/)/i;
const WAF_BLOCK_EXT_RE = /\.(sql|bak|old|ini|log|sh|bat|ps1|phar)$/i;
const WAF_QUERY_RE = /(\.\.\/|%2e%2e|union[\s+]+select|<script\b|base64_decode\s*\(|(?:\b|\W)eval\s*\()/i;
const WAF_BOT_UA_RE = /(sqlmap|nikto|acunetix|masscan|nmap|nuclei|dirbuster|gobuster|wpscan|zgrab)/i;
const COMPACT_ACTIONS = new Set(['admin_auth', 'player_auth', 'ai_chat']);

function safeOriginBase(env) {
  const raw = env && env.ORIGIN_URL ? String(env.ORIGIN_URL).trim() : DEFAULT_ORIGIN_URL;
  return (raw || DEFAULT_ORIGIN_URL).replace(/\/+$/, '');
}

function getClientIp(request) {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp && cfIp.trim()) return cfIp.trim();
  const xff = request.headers.get('X-Forwarded-For');
  if (xff && xff.trim()) return xff.split(',')[0].trim();
  return 'unknown';
}

function applySecurityHeaders(headers, cacheStatus) {
  headers.set('X-SMPL-Protected-By', 'Cloudflare-Edge-Shield');
  headers.set('X-SMPL-Edge-Cache', cacheStatus || 'BYPASS');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
}

function blockedWafResponse(reason, statusCode) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'X-SMPL-Edge-Shield': 'BLOCKED_WAF',
    'Cache-Control': 'no-store'
  });
  applySecurityHeaders(headers, 'BYPASS');
  return new Response(
    JSON.stringify({ ok: false, error: 'Zablokowano przez Cloudflare Edge WAF SMPL.', reason: reason }),
    { status: statusCode || 403, headers: headers }
  );
}

function rateLimitResponse(bucket, retryAfterSec) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Retry-After': String(retryAfterSec || 30),
    'X-SMPL-Edge-Shield': 'RATE_LIMITED',
    'Cache-Control': 'no-store'
  });
  applySecurityHeaders(headers, 'BYPASS');
  return new Response(
    JSON.stringify({
      ok: false,
      error: 'Zbyt wiele zapytań (Cloudflare Edge Anti-DDoS). Odczekaj chwilę i spróbuj ponownie.',
      bucket: bucket,
      retryAfter: retryAfterSec || 30
    }),
    { status: 429, headers: headers }
  );
}

// Lekki per-isolate limiter L7 z twardym limitem rozmiaru mapy (MAX_TRACKED_IPS = 2000)
const burstStore = new Map();

function checkEdgeBurstLimit(ip, isApiPost) {
  const now = Date.now();
  if (burstStore.size >= MAX_TRACKED_IPS && !burstStore.has(ip)) {
    const oldestKey = burstStore.keys().next().value;
    if (oldestKey !== undefined) burstStore.delete(oldestKey);
  }
  let entry = burstStore.get(ip);
  if (!entry || now - entry.windowStart >= EDGE_BURST_WINDOW_MS) {
    entry = { windowStart: now, dynamicCount: 0, postCount: 0 };
  }
  entry.dynamicCount += 1;
  if (isApiPost) entry.postCount += 1;
  burstStore.set(ip, entry);

  if (isApiPost && entry.postCount > EDGE_POST_LIMIT) {
    return { allowed: false, bucket: 'EDGE_POST_FLOOD' };
  }
  if (entry.dynamicCount > EDGE_DYNAMIC_LIMIT) {
    return { allowed: false, bucket: 'EDGE_BURST_FLOOD' };
  }
  return { allowed: true };
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const method = String(request.method || 'GET').toUpperCase();
      const pathname = url.pathname || '/';

      // 1. Weryfikacja metody HTTP
      if (method !== 'GET' && method !== 'POST' && method !== 'HEAD' && method !== 'OPTIONS') {
        return blockedWafResponse('METHOD_NOT_ALLOWED', 405);
      }

      // 2. Endpoint diagnostyczny zdrowia Edge Shield
      if (method === 'GET' && pathname === '/__smpl_cf_health') {
        const cfMeta = request.cf || {};
        const headers = new Headers({
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        applySecurityHeaders(headers, 'BYPASS');
        return new Response(
          JSON.stringify({
            ok: true,
            shield: 'SMPL_CLOUDFLARE_EDGE_WORKER',
            version: 'v79',
            origin: safeOriginBase(env),
            colo: cfMeta.colo || 'EDGE',
            tlsVersion: cfMeta.tlsVersion || 'TLSv1.3'
          }),
          { status: 200, headers: headers }
        );
      }

      // 3. Edge WAF — blokada skanerów, exploitów i ścieżek wrażliwych zanim trafią do PHP
      const ua = String(request.headers.get('User-Agent') || '');
      if (ua && WAF_BOT_UA_RE.test(ua)) {
        return blockedWafResponse('SCANNER_UA', 403);
      }

      const isWellKnown = pathname.indexOf('/.well-known/') === 0;
      if (!isWellKnown && (WAF_BLOCK_PATH_RE.test(pathname) || WAF_BLOCK_EXT_RE.test(pathname))) {
        return blockedWafResponse('SENSITIVE_OR_EXPLOIT_PATH', 403);
      }

      const searchRaw = url.search || '';
      if (searchRaw && WAF_QUERY_RE.test(searchRaw)) {
        return blockedWafResponse('SUSPICIOUS_QUERY_SIGNATURE', 403);
      }

      // 4. Limit Content-Length przed przekazaniem żądania
      const clHeader = request.headers.get('Content-Length');
      const contentLen = clHeader ? parseInt(clHeader, 10) : 0;
      const action = url.searchParams.get('action') || '';
      if (Number.isFinite(contentLen) && contentLen > 0) {
        if (contentLen > GLOBAL_MAX_BODY_BYTES) {
          return blockedWafResponse('PAYLOAD_TOO_LARGE', 413);
        }
        if (COMPACT_ACTIONS.has(action) && contentLen > COMPACT_ACTION_MAX_BODY_BYTES) {
          return blockedWafResponse('COMPACT_ACTION_PAYLOAD_TOO_LARGE', 413);
        }
      }

      // 5. Statyczne zasoby: Edge Cache (bez sw.js, bez nagłówka Range)
      const isStaticAsset = STATIC_ASSET_RE.test(pathname) && pathname !== '/sw.js';
      const hasRange = Boolean(request.headers.get('Range'));
      const isApiPath = pathname === '/api.php' || pathname === '/api/state';
      const isApiPost = method === 'POST' && isApiPath;

      if (!isStaticAsset || isApiPath) {
        const ip = getClientIp(request);
        const burstCheck = checkEdgeBurstLimit(ip, isApiPost);
        if (!burstCheck.allowed) {
          return rateLimitResponse(burstCheck.bucket, 30);
        }
      }

      const originBase = safeOriginBase(env);
      const targetUrl = new URL(pathname + url.search, originBase);

      if (method === 'GET' && isStaticAsset && !hasRange && typeof caches !== 'undefined' && caches.default) {
        const cache = caches.default;
        const cacheKey = new Request(url.toString(), { method: 'GET' });
        const cached = await cache.match(cacheKey);
        if (cached) {
          const hitHeaders = new Headers(cached.headers);
          applySecurityHeaders(hitHeaders, 'HIT');
          return new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: hitHeaders
          });
        }

        const originHeaders = new Headers(request.headers);
        if (env && env.SMPL_CF_SHIELD_SECRET) {
          originHeaders.set('X-SMPL-CF-Shield', String(env.SMPL_CF_SHIELD_SECRET));
        }
        originHeaders.set('X-SMPL-Forwarded-Host', url.host);

        const originResp = await fetch(targetUrl.toString(), {
          method: 'GET',
          headers: originHeaders,
          redirect: 'manual'
        });

        const respHeaders = new Headers(originResp.headers);
        applySecurityHeaders(respHeaders, originResp.ok ? 'MISS' : 'BYPASS');
        const outResp = new Response(originResp.body, {
          status: originResp.status,
          statusText: originResp.statusText,
          headers: respHeaders
        });

        if (originResp.ok && ctx && typeof ctx.waitUntil === 'function') {
          const cacheCopy = outResp.clone();
          const cachePutHeaders = new Headers(cacheCopy.headers);
          if (!cachePutHeaders.has('Cache-Control')) {
            cachePutHeaders.set('Cache-Control', 'public, max-age=3600');
          }
          const cacheable = new Response(cacheCopy.body, {
            status: cacheCopy.status,
            statusText: cacheCopy.statusText,
            headers: cachePutHeaders
          });
          ctx.waitUntil(cache.put(cacheKey, cacheable));
        }
        return outResp;
      }

      // 6. Strumieniowe proxy dla HTML / api.php / POST (zero buforowania całego body w RAM)
      const fwdHeaders = new Headers(request.headers);
      if (env && env.SMPL_CF_SHIELD_SECRET) {
        fwdHeaders.set('X-SMPL-CF-Shield', String(env.SMPL_CF_SHIELD_SECRET));
      }
      fwdHeaders.set('X-SMPL-Forwarded-Host', url.host);

      const hasBody = method !== 'GET' && method !== 'HEAD' && request.body !== null;
      const upstreamResp = await fetch(targetUrl.toString(), {
        method: method,
        headers: fwdHeaders,
        body: hasBody ? request.body : undefined,
        redirect: 'manual'
      });

      const outHeaders = new Headers(upstreamResp.headers);
      applySecurityHeaders(outHeaders, 'BYPASS');
      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        statusText: upstreamResp.statusText,
        headers: outHeaders
      });
    } catch (err) {
      const msg = err && err.message ? String(err.message) : 'Unknown Edge Shield error';
      console.error(JSON.stringify({ message: 'smpl_edge_shield_error', error: msg }));
      const errHeaders = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      applySecurityHeaders(errHeaders, 'BYPASS');
      return new Response(
        JSON.stringify({ ok: false, error: 'Błąd komunikacji Edge Shield z serwerem ligi.' }),
        { status: 502, headers: errHeaders }
      );
    }
  }
};
