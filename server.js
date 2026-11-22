/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Gotowy Serwer Node.js (Zero-Dependency — nie wymaga instalacji żadnych paczek!)
 * Obsługuje zarówno pliki statyczne jak i wspólną bazę danych w data/smpl-db.json
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'smpl-db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'smpl-db.backup.json');
const TOKEN_FILE = path.join(DATA_DIR, '.smpl-admin-tokens.json');
const AI_SECRETS_FILE = path.join(DATA_DIR, '.smpl-ai-secrets.json');
const AI_RATELIMIT_FILE = path.join(DATA_DIR, '.smpl-ai-ratelimit.json');
const WEBHOOKS_FILE = path.join(DATA_DIR, '.smpl-webhooks.json');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

function sendJson(res, statusCode, payload, extraHeaders) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-SMPL-Admin-Token, X-SMPL-Player-Token',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  }, extraHeaders || {});
  const reqRef = res && res._smplReq;
  const acceptEnc = reqRef && reqRef.headers ? String(reqRef.headers['accept-encoding'] || '') : '';
  if (body.length > 1024 && acceptEnc.indexOf('gzip') !== -1) {
    try {
      const gz = zlib.gzipSync(Buffer.from(body, 'utf8'));
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      res.writeHead(statusCode, headers);
      return res.end(gz);
    } catch (_gzErr) {}
  }
  res.writeHead(statusCode, headers);
  res.end(body);
}

function hashSecretLocal(plain) {
  const str = 'SMPL-S56-AUTH::' + String(plain == null ? '' : plain).trim();
  let h1 = 0x811c9dc5 | 0;
  let h2 = 0x9e3779b9 | 0;
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = (h1 ^ ch ^ round) | 0;
      h1 = (h1 + (h1 << 1) + (h1 << 4) + (h1 << 7) + (h1 << 8) + (h1 << 24)) | 0;
      h2 = (h2 ^ ((ch + i) * 31)) | 0;
      h2 = ((h2 << 7) | (h2 >>> 25)) ^ h1;
    }
  }
  const p1 = (h1 >>> 0).toString(16);
  const p2 = (h2 >>> 0).toString(16);
  return 'smplh1$' + ('00000000' + p1).slice(-8) + ('00000000' + p2).slice(-8);
}

function verifySecretLocal(record, plainInput) {
  const clean = String(plainInput || '').trim();
  if (!clean || !record) return false;
  if (record.passwordHash && String(record.passwordHash).startsWith('smplh1$')) {
    return record.passwordHash === hashSecretLocal(clean);
  }
  if (record.passwordHash) return String(record.passwordHash) === clean;
  if (record.password) return String(record.password) === clean;
  return false;
}

function readDbJson() {
  for (const cand of [DB_FILE, BACKUP_FILE]) {
    if (fs.existsSync(cand)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(cand, 'utf8'));
        if (parsed && Array.isArray(parsed.players) && Array.isArray(parsed.matches)) return parsed;
      } catch (e) {}
    }
  }
  return null;
}

function loadTokens() {
  if (!fs.existsSync(TOKEN_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) || {};
    const now = Math.floor(Date.now() / 1000);
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && Number(v.expiresAt) > now) out[k] = v;
    }
    return out;
  } catch (e) {
    return {};
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens), 'utf8');
}

function validateAdminTokenHeader(req, db, bodyObj) {
  let rawToken = String(req.headers['x-smpl-admin-token'] || '').trim();
  if (!rawToken && bodyObj && typeof bodyObj === 'object' && bodyObj._adminToken) {
    rawToken = String(bodyObj._adminToken).trim();
  }
  if (!rawToken) return null;
  const tokHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokens = loadTokens();
  const info = tokens[tokHash];
  if (!info || (info.tokenType && info.tokenType !== 'ADMIN')) return null;
  if (db && Array.isArray(db.admins)) {
    const adm = db.admins.find((a) => a && String(a.id) === String(info.adminId));
    if (!adm || (adm.status && adm.status !== 'APPROVED')) return null;
  }
  return info;
}

function validatePlayerTokenHeader(req, bodyObj) {
  let rawToken = String(req.headers['x-smpl-player-token'] || '').trim();
  if (!rawToken && bodyObj && typeof bodyObj === 'object' && bodyObj._playerToken) {
    rawToken = String(bodyObj._playerToken).trim();
  }
  if (!rawToken) return null;
  const tokHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokens = loadTokens();
  const info = tokens[tokHash];
  if (!info || info.tokenType !== 'PLAYER') return null;
  return { tokHash, info, tokens };
}

function foldPlCharsLocal(s) {
  return String(s || '').trim().toLowerCase()
    .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
    .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
    .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z');
}

function toCleanUsernameLocal(s) {
  const c = foldPlCharsLocal(s).replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').replace(/^\.+|\.+$/g, '').slice(0, 36);
  return c || ('gracz.' + String(Date.now()).slice(-4));
}

function validateImageUriLocal(raw, maxLen) {
  const s = String(raw || '').trim();
  if (!s) return { ok: true, value: '' };
  if (/^https?:\/\/[^\s"'<>]{4,1020}$/i.test(s)) return { ok: true, value: s };
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s) && s.length <= maxLen) return { ok: true, value: s };
  if (/^data:image\/svg\+xml(;charset=utf-8|;utf8)?,/i.test(s) && s.length <= 45000) {
    const svgBody = decodeURIComponent(s.replace(/^data:image\/svg\+xml[^,]*,/i, ''));
    if (/<\s*script|javascript:|on[a-z]+\s*=|<\s*foreignObject/i.test(svgBody)) return { ok: false, error: 'Niedozwolona zawartość SVG.' };
    return { ok: true, value: s };
  }
  if (/^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/i.test(s) && s.length <= 45000) {
    const b64 = s.slice(s.indexOf(',') + 1);
    let svgBody = '';
    try { svgBody = Buffer.from(b64, 'base64').toString('utf8'); } catch (e) {}
    if (!svgBody || /<\s*script|javascript:|on[a-z]+\s*=|<\s*foreignObject/i.test(svgBody)) return { ok: false, error: 'Niedozwolona zawartość SVG.' };
    return { ok: true, value: s };
  }
  return { ok: false, error: 'Nieprawidłowy format lub zbyt duży rozmiar obrazu (PNG/JPG/WebP/SVG lub HTTPS).' };
}

function isOnBlacklistLocal(db, nameFold, nickFold, fbLow) {
  const bl = db && Array.isArray(db.blacklist) ? db.blacklist : [];
  return bl.some((b) => b && (
    (nameFold && b.name && foldPlCharsLocal(b.name) === nameFold) ||
    (nickFold && b.nick && foldPlCharsLocal(b.nick) === nickFold) ||
    (fbLow && b.fbLink && String(b.fbLink).trim().toLowerCase() === fbLow)
  ));
}

function collectUsedLoginsLocal(db, includeAdmins) {
  const used = {};
  (db && Array.isArray(db.players) ? db.players : []).forEach((p) => {
    if (p && !p.isPlaceholder && p.username) used[String(p.username).trim().toLowerCase()] = true;
  });
  (db && Array.isArray(db.registrations) ? db.registrations : []).forEach((r) => {
    if (r && r.username && String(r.status || '') !== 'REJECTED') used[String(r.username).trim().toLowerCase()] = true;
  });
  if (includeAdmins) {
    (db && Array.isArray(db.admins) ? db.admins : []).forEach((a) => {
      if (a && a.username) used[String(a.username).trim().toLowerCase()] = true;
    });
  }
  return used;
}

function resolveClanPayloadLocal(db, payload, createdByName, tsMs, nowFmt) {
  if (!Array.isArray(db.clans)) db.clans = [];
  const inClanId = String(payload.clanId || '').trim();
  const newClanName = String(payload.newClanName || '').trim().slice(0, 60);
  const newClanTagRaw = String(payload.newClanTag || '').trim().slice(0, 12);
  const newClanColor = /^#[0-9A-Fa-f]{6}$/.test(String(payload.newClanColor || '')) ? String(payload.newClanColor) : '#10B981';

  let outClanId = null;
  let outClanName = '';
  let outClanTag = '';
  let outClanLogo = null;
  let createdClan = null;

  if (inClanId === '__NEW__' || (!inClanId && newClanName)) {
    if (newClanName.length < 2) return { ok: false, error: 'Podaj nazwę nowego klanu (minimum 2 znaki).' };
    const cFold = foldPlCharsLocal(newClanName);
    const existingClan = db.clans.find((c) => c && c.name && foldPlCharsLocal(c.name) === cFold);
    if (existingClan) {
      outClanId = String(existingClan.id);
      outClanName = String(existingClan.name);
      outClanTag = String(existingClan.tag || '');
      outClanLogo = existingClan.logo || null;
    } else {
      const logoRes = validateImageUriLocal(payload.newClanLogo || '', 180000);
      if (!logoRes.ok) return { ok: false, error: 'Logo klanu: ' + logoRes.error };
      let cTagClean = foldPlCharsLocal(newClanTagRaw).replace(/[^a-z0-9]/g, '').toUpperCase().slice(0, 6);
      if (cTagClean.length < 2) {
        const words = foldPlCharsLocal(newClanName).split(/\s+/).filter(Boolean);
        cTagClean = (words.length >= 2 ? words.map((w) => w.charAt(0)).join('') : foldPlCharsLocal(newClanName).replace(/[^a-z0-9]/g, '')).toUpperCase().slice(0, 6) || 'SMPL';
      }
      createdClan = {
        id: 'CLAN_' + tsMs + '_' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        name: newClanName,
        tag: cTagClean,
        primaryColor: newClanColor,
        secondaryColor: '#0F172A',
        logo: logoRes.value || null,
        status: 'ACTIVE',
        createdBy: String(createdByName || 'Gracz').slice(0, 60),
        createdAt: nowFmt
      };
      db.clans.push(createdClan);
      outClanId = createdClan.id;
      outClanName = createdClan.name;
      outClanTag = createdClan.tag;
      outClanLogo = createdClan.logo;
    }
  } else if (inClanId && inClanId !== 'NONE') {
    const matchedClan = db.clans.find((c) => c && String(c.id) === inClanId);
    if (matchedClan) {
      outClanId = String(matchedClan.id);
      outClanName = String(matchedClan.name || '');
      outClanTag = String(matchedClan.tag || '');
      outClanLogo = matchedClan.logo || null;
    } else if (inClanId.indexOf('CLAN_') === 0) {
      outClanId = inClanId.slice(0, 60);
      outClanName = String(payload.clanName || '').trim().slice(0, 60);
      outClanTag = String(payload.clanTag || '').trim().slice(0, 12);
      outClanLogo = null;
    }
  }
  return { ok: true, clanId: outClanId, clanName: outClanName, clanTag: outClanTag, clanLogo: outClanLogo, createdClan };
}

function deepJsonEqLocal(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepJsonEqLocal(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i] || !deepJsonEqLocal(a[ka[i]], b[kb[i]])) return false;
    }
    return true;
  }
  return false;
}

function validateCoAdminAdminsGuardLocal(prevDb, newDb, callerAdminId) {
  if (!prevDb || !Array.isArray(prevDb.admins)) return null;
  const newAdmins = newDb && Array.isArray(newDb.admins) ? newDb.admins : [];
  const prevById = {};
  const newById = {};
  prevDb.admins.forEach((a) => { if (a && a.id != null) prevById[String(a.id)] = a; });
  newAdmins.forEach((a) => { if (a && a.id != null) newById[String(a.id)] = a; });

  for (const aid of Object.keys(prevById)) {
    if (!Object.prototype.hasOwnProperty.call(newById, aid)) {
      return 'Odmowa zapisu: wyłącznie Master Admin może usuwać konta administratorów.';
    }
    const oldAdm = prevById[aid];
    const newAdm = newById[aid];
    if (deepJsonEqLocal(oldAdm, newAdm)) continue;
    if (String(aid) !== String(callerAdminId || '')) {
      return 'Odmowa zapisu: wyłącznie Master Admin (Szymon Komenda) może nadawać, zatwierdzać lub modyfikować konta innych administratorów.';
    }
    const oldRole = String(oldAdm.role || 'CO_ADMIN');
    const newRole = String(newAdm.role || 'CO_ADMIN');
    const oldStatus = String(oldAdm.status || 'APPROVED');
    const newStatus = String(newAdm.status || 'APPROVED');
    if (oldRole !== newRole || oldStatus !== newStatus) {
      return 'Odmowa zapisu: wyłącznie Master Admin może zmieniać rolę lub status administratora.';
    }
  }
  for (const aid of Object.keys(newById)) {
    if (!Object.prototype.hasOwnProperty.call(prevById, aid)) {
      const nAdm = newById[aid];
      const st = String(nAdm.status || '');
      const role = String(nAdm.role || '');
      if (st !== 'PENDING' || role === 'MASTER_ADMIN') {
        return 'Odmowa zapisu: wyłącznie Master Admin może nadawać nowym osobom uprawnienia administratora.';
      }
    }
  }
  const prevSup = prevDb && prevDb.portalSettings && Object.prototype.hasOwnProperty.call(prevDb.portalSettings, 'supportConfig')
    ? prevDb.portalSettings.supportConfig
    : null;
  const newSup = newDb && newDb.portalSettings && Object.prototype.hasOwnProperty.call(newDb.portalSettings, 'supportConfig')
    ? newDb.portalSettings.supportConfig
    : null;
  if (!deepJsonEqLocal(prevSup, newSup)) {
    return 'Odmowa zapisu: wyłącznie Master Admin (Szymon Komenda) może edytować linki i ustawienia zakładki Wsparcia (Donate).';
  }
  const prevBonusCoins = (prevDb && prevDb.competitions && prevDb.competitions.playerShop && prevDb.competitions.playerShop.bonusCoins && typeof prevDb.competitions.playerShop.bonusCoins === 'object')
    ? prevDb.competitions.playerShop.bonusCoins
    : {};
  const newBonusCoins = (newDb && newDb.competitions && newDb.competitions.playerShop && newDb.competitions.playerShop.bonusCoins && typeof newDb.competitions.playerShop.bonusCoins === 'object')
    ? newDb.competitions.playerShop.bonusCoins
    : {};
  if (!deepJsonEqLocal(prevBonusCoins, newBonusCoins)) {
    return 'Odmowa zapisu: wyłącznie Master Admin (Szymon Komenda) może przyznawać lub zmieniać bonusowe SMPL Coins.';
  }
  return null;
}

function validateGeminiModel(m) {
  const clean = String(m || '').trim();
  if (clean && /^[a-zA-Z0-9._-]{3,80}$/.test(clean)) return clean;
  return 'gemini-3.5-flash-lite';
}

function maskSecret(s) {
  const str = String(s || '').trim();
  if (!str) return '';
  if (str.length <= 10) return '*'.repeat(str.length);
  return str.slice(0, 5) + '...' + str.slice(-4);
}

function readAiSecrets() {
  const defaults = {
    apiKey: '',
    model: 'gemini-3.5-flash-lite',
    enabled: true,
    customPersona: '',
    temperature: 0.7,
    updatedAt: null,
    updatedBy: null,
    lastTestOk: null,
    lastTestAt: null,
    lastTestError: null
  };
  if (!fs.existsSync(AI_SECRETS_FILE)) return defaults;
  try {
    return Object.assign(defaults, JSON.parse(fs.readFileSync(AI_SECRETS_FILE, 'utf8')) || {});
  } catch (e) {
    return defaults;
  }
}

function saveAiSecrets(cfg) {
  fs.writeFileSync(AI_SECRETS_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

function resolveGeminiKey(cfg) {
  const envKey = String(process.env.SMPL_GEMINI_API_KEY || '').trim();
  if (envKey) return { key: envKey, fromEnv: true };
  return { key: String((cfg && cfg.apiKey) || '').trim(), fromEnv: false };
}

function extractGeminiError(statusCode, rawBody) {
  let msg = '';
  try {
    const parsed = JSON.parse(rawBody || '{}');
    if (parsed && parsed.error && parsed.error.message) msg = String(parsed.error.message).trim();
  } catch (e) {}
  if (statusCode === 400 && /API_KEY/i.test(msg)) return 'Klucz Google Gemini API jest nieprawidłowy (sprawdź w aistudio.google.com).';
  if (statusCode === 401 || statusCode === 403) return 'Brak autoryzacji Gemini API.' + (msg ? ' [' + msg + ']' : '');
  if (statusCode === 404) return 'Wybrany model Gemini niedostępny.' + (msg ? ' [' + msg + ']' : '');
  if (statusCode === 429) return 'Przekroczono limit zapytań lub kwotę Gemini API (429).';
  if (statusCode >= 500) return 'Serwery Google Gemini chwilowo przeciążone (' + statusCode + ').';
  return msg ? 'Błąd Gemini API (' + statusCode + '): ' + msg : 'Nieoczekiwana odpowiedź Gemini API (HTTP ' + statusCode + ').';
}

function callGeminiGenerate(apiKey, model, systemPrompt, contents, temperature = 0.7, maxTokens = 1200) {
  return new Promise((resolve) => {
    const safeModel = validateGeminiModel(model);
    const isGemini3 = /^gemini-3/i.test(safeModel);
    const genCfg = {
      maxOutputTokens: Math.max(128, Math.min(2048, Number(maxTokens) || 1200))
    };
    if (isGemini3) {
      genCfg.thinkingConfig = { thinkingLevel: 'low' };
    } else {
      genCfg.temperature = Math.max(0, Math.min(1.5, Number(temperature) || 0.7));
      genCfg.topP = 0.92;
    }
    const bodyStr = JSON.stringify({
      systemInstruction: { parts: [{ text: String(systemPrompt) }] },
      contents: contents,
      generationConfig: genCfg
    });
    const startMs = Date.now();
    const req = https.request(
      {
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/' + encodeURIComponent(safeModel) + ':generateContent',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          'x-goog-api-key': String(apiKey || ''),
          'Content-Length': Buffer.byteLength(bodyStr)
        },
        timeout: 10000
      },
      (resp) => {
        let raw = '';
        resp.on('data', (c) => { raw += c.toString('utf8'); });
        resp.on('end', () => {
          const latencyMs = Date.now() - startMs;
          const code = resp.statusCode || 0;
          if (code < 200 || code >= 300) {
            return resolve({ ok: false, status: code, latencyMs, error: extractGeminiError(code, raw) });
          }
          try {
            const parsed = JSON.parse(raw);
            const parts = parsed && parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts;
            const text = Array.isArray(parts) ? parts.filter((p) => p && !p.thought && p.text).map((p) => p.text).join('\n').trim() : '';
            if (!text) return resolve({ ok: false, status: code, latencyMs, error: 'Pusta odpowiedź Gemini.' });
            return resolve({ ok: true, status: code, model: safeModel, latencyMs, answer: text });
          } catch (e) {
            return resolve({ ok: false, status: code, latencyMs, error: 'Nieprawidłowy JSON z Gemini.' });
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error('Timeout połączenia z Gemini API'));
    });
    req.on('error', (err) => {
      resolve({ ok: false, status: 0, latencyMs: Date.now() - startMs, error: 'Błąd połączenia HTTPS z Gemini: ' + err.message });
    });
    req.write(bodyStr);
    req.end();
  });
}

async function callGeminiChatWithFallback(apiKey, primaryModel, systemPrompt, contents, temperature = 0.7, maxTokens = 1024) {
  const candidates = [validateGeminiModel(primaryModel), 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
  const tried = new Set();
  let lastRes = { ok: false, status: 0, latencyMs: 0, error: 'Brak odpowiedzi Gemini API.' };
  for (const cand of candidates) {
    if (!cand || tried.has(cand)) continue;
    tried.add(cand);
    const resG = await callGeminiGenerate(apiKey, cand, systemPrompt, contents, temperature, maxTokens);
    if (resG && resG.ok) return resG;
    lastRes = resG || lastRes;
    const st = Number((resG && resG.status) || 0);
    if (st === 400 || st === 401 || st === 403) break;
  }
  return lastRes;
}

function buildServerLeagueSnapshot(db) {
  if (!db) return '';
  const lines = [];
  const weekly = db.weeklyConfig || {};
  const seasonLbl = db.season ? `Sezon ${db.season}` : 'Sezon SMPL';
  lines.push(`AKTUALNY SEZON (serwer): ${seasonLbl} | Tydzień: ${weekly.currentWeek || '?'}`);
  const activeLeagues = {};
  if (db.leagues && typeof db.leagues === 'object') {
    for (const [lid, lObj] of Object.entries(db.leagues)) {
      if (!lObj) continue;
      const isEnabled = lObj.enabled !== undefined ? Boolean(lObj.enabled) : (lid !== 'L3');
      if (isEnabled) activeLeagues[lid] = lObj.name || lid;
    }
  }
  if (!Object.keys(activeLeagues).length) {
    activeLeagues.L1 = 'Ekstraklasa';
    activeLeagues.L2 = '2. Liga';
  }
  if (Array.isArray(db.players)) {
    const counts = {};
    for (const lid of Object.keys(activeLeagues)) counts[lid] = 0;
    db.players.forEach((p) => { if (p && counts[p.leagueId] !== undefined) counts[p.leagueId]++; });
    lines.push('Aktywne ligi i liczba graczy: ' + Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', '));
  }
  if (Array.isArray(db.clans) && db.clans.length > 0) {
    const clanParts = db.clans.slice(0, 24).map((c) => {
      if (!c || !c.name) return '';
      return (c.tag ? `[${c.tag}] ` : '') + String(c.name);
    }).filter(Boolean);
    if (clanParts.length) {
      lines.push(`Oficjalne klany Score! Match w bazie (${clanParts.length}): ${clanParts.join(', ')}`);
    }
  }
  if (Array.isArray(db.aiKnowledge) && db.aiKnowledge.length > 0) {
    lines.push('OFICJALNA WIEDZA NAUCZONA PRZEZ ADMINÓW SMPL:');
    db.aiKnowledge.slice(0, 20).forEach((kb) => {
      if (kb && kb.title && kb.answer) lines.push(`- ${kb.title}: ${kb.answer}`);
    });
  }
  const ps = db.portalSettings && typeof db.portalSettings === 'object' ? db.portalSettings : {};
  lines.push(`Okno przycisku Dołącz/Opuść ligę: ${ps.seasonJoinOpen ? 'OTWARTE' : 'ZAMKNIĘTE'}`);
  if (Array.isArray(db.admins)) {
    const admLabels = db.admins
      .filter((a) => a && a.name && (!a.status || a.status === 'APPROVED'))
      .map((a) => `${a.name}${a.role === 'MASTER_ADMIN' ? ' [MASTER]' : ' [ADMIN]'}`);
    if (admLabels.length) lines.push(`Zatwierdzeni Administratorzy SMPL: ${admLabels.join(', ')}`);
  }
  return lines.join('\n');
}

function checkAiRateLimit(req, isAdmin) {
  const ip = req && req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : 'LOCAL';
  const aTok = req && req.headers ? String(req.headers['x-smpl-admin-token'] || '').trim() : '';
  const pTok = req && req.headers ? String(req.headers['x-smpl-player-token'] || '').trim() : '';
  const subTag = aTok
    ? '_ADM_' + crypto.createHash('sha256').update(aTok).digest('hex').slice(0, 12)
    : (pTok ? '_PLR_' + crypto.createHash('sha256').update(pTok).digest('hex').slice(0, 12) : '_USR');
  const key = crypto.createHash('sha256').update(ip + subTag).digest('hex');
  const now = Math.floor(Date.now() / 1000);
  const maxReq = isAdmin ? 120 : 60;
  let store = {};
  if (fs.existsSync(AI_RATELIMIT_FILE)) {
    try { store = JSON.parse(fs.readFileSync(AI_RATELIMIT_FILE, 'utf8')) || {}; } catch (e) {}
  }
  const clean = {};
  for (const [k, list] of Object.entries(store)) {
    if (Array.isArray(list)) {
      const recent = list.filter((t) => Number(t) > now - 300);
      if (recent.length) clean[k] = recent;
    }
  }
  const mine = clean[key] || [];
  if (mine.length >= maxReq) return false;
  mine.push(now);
  clean[key] = mine;
  try { fs.writeFileSync(AI_RATELIMIT_FILE, JSON.stringify(clean), 'utf8'); } catch (e) {}
  return true;
}

function countRealPlayersLocal(dbObj) {
  if (!dbObj || !Array.isArray(dbObj.players)) return 0;
  return dbObj.players.filter((p) => p && !p.isPlaceholder && !p.gdprDeleted).length;
}

function saveDailySnapshotLocal(rawJson) {
  try {
    if (!rawJson || rawJson.length < 50) return;
    if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    const now = new Date();
    const dStr = now.toISOString().slice(0, 10);
    const fname = `smpl-db-${dStr}.json`;
    const fpath = path.join(SNAPSHOTS_DIR, fname);
    let shouldWriteDaily = true;
    if (fs.existsSync(fpath)) {
      try {
        const existingRaw = fs.readFileSync(fpath, 'utf8');
        const oldReal = countRealPlayersLocal(JSON.parse(existingRaw));
        const newReal = countRealPlayersLocal(JSON.parse(rawJson));
        if (oldReal > newReal) {
          const pad2 = (n) => String(n).padStart(2, '0');
          const safeTag = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
          const safePath = path.join(SNAPSHOTS_DIR, `smpl-db-${dStr}-safe-${safeTag}.json`);
          const existingSafe = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => f.startsWith(`smpl-db-${dStr}-safe-`));
          const sameSizeExists = existingSafe.some((sf) => fs.statSync(path.join(SNAPSHOTS_DIR, sf)).size === Buffer.byteLength(existingRaw, 'utf8'));
          if (!sameSizeExists) fs.writeFileSync(safePath, existingRaw, 'utf8');
          shouldWriteDaily = false;
        }
      } catch (e) {}
    }
    if (shouldWriteDaily) {
      fs.writeFileSync(fpath, rawJson, 'utf8');
    }
    const files = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => /^smpl-db-[A-Za-z0-9_-]+\.json$/.test(f) && !f.includes('before-full-repair')).sort();
    if (files.length > 24) {
      files.slice(0, files.length - 24).forEach((oldF) => {
        try { fs.unlinkSync(path.join(SNAPSHOTS_DIR, oldF)); } catch (e) {}
      });
    }
  } catch (e) {}
}

function readWebhooksConfigLocal() {
  const def = {
    enabled: false,
    discordPublicUrl: '',
    discordAdminUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
    events: {
      matchApproved: true,
      matchSubmitted: true,
      newRegistration: true,
      roundReleased: true,
      tribunalVerdict: true,
      puskasOrGb: true,
      disputeSubmitted: true
    },
    updatedAt: null,
    updatedBy: null
  };
  if (!fs.existsSync(WEBHOOKS_FILE)) return def;
  try {
    const p = JSON.parse(fs.readFileSync(WEBHOOKS_FILE, 'utf8'));
    if (p && typeof p === 'object') {
      return Object.assign({}, def, p, { events: Object.assign({}, def.events, p.events || {}) });
    }
  } catch (e) {}
  return def;
}

function saveWebhooksConfigLocal(cfg) {
  fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

function postJsonHttpsShort(urlStr, payloadObj, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const u = new URL(urlStr);
      if (u.protocol !== 'https:') return resolve({ ok: false, error: 'HTTPS required' });
      const dataStr = JSON.stringify(payloadObj);
      const req = https.request({
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(dataStr),
          'User-Agent': 'SMPL-Liga-Portal/56'
        },
        timeout: timeoutMs
      }, (resp) => {
        resp.on('data', () => {});
        resp.on('end', () => resolve({ ok: resp.statusCode >= 200 && resp.statusCode < 300, code: resp.statusCode || 0 }));
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
      req.on('error', (err) => resolve({ ok: false, error: err.message }));
      req.write(dataStr);
      req.end();
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

async function dispatchWebhooksLocal(eventKey, title, message, adminChannelOnly = false) {
  const cfg = readWebhooksConfigLocal();
  if (!cfg.enabled) return { ok: false, skipped: true };
  if (eventKey !== 'TEST' && eventKey !== 'BROADCAST' && cfg.events && cfg.events[eventKey] === false) {
    return { ok: false, skipped: true };
  }
  const embed = {
    embeds: [{
      title: String(title || '').slice(0, 180),
      description: String(message || '').slice(0, 1400),
      color: adminChannelOnly ? 15158332 : 16098851,
      footer: { text: 'Score! Match Liga Polska • SMPL Portal' }
    }]
  };
  let sent = 0;
  const errors = [];
  const dUrls = [];
  if (adminChannelOnly && cfg.discordAdminUrl) dUrls.push(cfg.discordAdminUrl);
  else if (!adminChannelOnly && cfg.discordPublicUrl) dUrls.push(cfg.discordPublicUrl);
  else if (eventKey === 'TEST' && cfg.discordAdminUrl) dUrls.push(cfg.discordAdminUrl);

  for (const u of dUrls) {
    const r = await postJsonHttpsShort(u, embed, 2500);
    if (r.ok) sent++; else errors.push('Discord: ' + (r.error || r.code));
  }
  if (!adminChannelOnly && cfg.telegramBotToken && cfg.telegramChatId) {
    const tgUrl = `https://api.telegram.org/bot${encodeURIComponent(cfg.telegramBotToken)}/sendMessage`;
    const rTg = await postJsonHttpsShort(tgUrl, {
      chat_id: String(cfg.telegramChatId),
      text: `${title}\n\n${message}`,
      disable_web_page_preview: true
    }, 2500);
    if (rTg.ok) sent++; else errors.push('Telegram: ' + (rTg.error || rTg.code));
  }
  return { ok: sent > 0, sent, errors };
}

const VAPID_FILE = path.join(DATA_DIR, '.smpl-vapid.json');
const PUSH_SUBS_FILE = path.join(DATA_DIR, '.smpl-push-subs.json');

function b64uEnc(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64uDec(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  return Buffer.from(pad ? s + '='.repeat(4 - pad) : s, 'base64');
}

function getOrCreateVapidKeysLocal() {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      if (parsed && parsed.publicKey && parsed.privatePem) return parsed;
    }
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwkPub = publicKey.export({ format: 'jwk' });
    const xBuf = b64uDec(jwkPub.x);
    const yBuf = b64uDec(jwkPub.y);
    const pad32 = (b) => (b.length >= 32 ? b.slice(-32) : Buffer.concat([Buffer.alloc(32 - b.length, 0), b]));
    const pubRaw = Buffer.concat([Buffer.from([0x04]), pad32(xBuf), pad32(yBuf)]);
    const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const out = {
      subject: 'mailto:kontakt@scorematchliga.pl',
      publicKey: b64uEnc(pubRaw),
      privatePem: String(privPem),
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(VAPID_FILE, JSON.stringify(out, null, 2), 'utf8');
    return out;
  } catch (e) {
    return null;
  }
}

function readPushSubsLocal() {
  try {
    if (!fs.existsSync(PUSH_SUBS_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function savePushSubsLocal(subs) {
  try {
    const obj = subs && typeof subs === 'object' ? subs : {};
    const keys = Object.keys(obj);
    if (keys.length > 400) {
      keys.slice(0, keys.length - 400).forEach((k) => { delete obj[k]; });
    }
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(obj), 'utf8');
  } catch (e) {}
}

function derSigToRs64Local(der) {
  if (!Buffer.isBuffer(der) || der.length < 8 || der[0] !== 0x30) return Buffer.alloc(0);
  let pos = (der[1] & 0x80) ? 2 + (der[1] & 0x7f) : 2;
  if (pos + 2 >= der.length || der[pos] !== 0x02) return Buffer.alloc(0);
  const rLen = der[pos + 1];
  let r = der.slice(pos + 2, pos + 2 + rLen);
  pos += 2 + rLen;
  if (pos + 2 >= der.length || der[pos] !== 0x02) return Buffer.alloc(0);
  const sLen = der[pos + 1];
  let s = der.slice(pos + 2, pos + 2 + sLen);
  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);
  const pad32 = (b) => (b.length >= 32 ? b.slice(-32) : Buffer.concat([Buffer.alloc(32 - b.length, 0), b]));
  return Buffer.concat([pad32(r), pad32(s)]);
}

function buildVapidAuthHeaderLocal(endpoint, vapid) {
  try {
    const u = new URL(endpoint);
    const aud = `${u.protocol}//${u.host}`;
    const hdr = b64uEnc(Buffer.from('{"typ":"JWT","alg":"ES256"}', 'utf8'));
    const claims = b64uEnc(Buffer.from(JSON.stringify({
      aud,
      exp: Math.floor(Date.now() / 1000) + 43200,
      sub: vapid.subject || 'mailto:kontakt@scorematchliga.pl'
    }), 'utf8'));
    const signingInput = `${hdr}.${claims}`;
    const signer = crypto.createSign('SHA256');
    signer.update(signingInput);
    const der = signer.sign(vapid.privatePem);
    const rs64 = derSigToRs64Local(der);
    if (rs64.length !== 64) return '';
    return `vapid t=${signingInput}.${b64uEnc(rs64)}, k=${vapid.publicKey}`;
  } catch (e) {
    return '';
  }
}

function encryptWebPushAes128GcmLocal(payloadJson, p256dhB64, authB64) {
  try {
    const uaPub = b64uDec(p256dhB64);
    const authSecret = b64uDec(authB64);
    if (uaPub.length !== 65 || uaPub[0] !== 0x04 || authSecret.length !== 16) return Buffer.alloc(0);
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const asPub = ecdh.getPublicKey(null, 'uncompressed');
    const shared = ecdh.computeSecret(uaPub);
    const salt = crypto.randomBytes(16);
    const prkKey = crypto.createHmac('sha256', authSecret).update(shared).digest();
    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\x00', 'utf8'), uaPub, asPub, Buffer.from([1])]);
    const ikm = crypto.createHmac('sha256', prkKey).update(keyInfo).digest();
    const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
    const cek = crypto.createHmac('sha256', prk).update(Buffer.from('Content-Encoding: aes128gcm\x00\x01', 'utf8')).digest().slice(0, 16);
    const nonce = crypto.createHmac('sha256', prk).update(Buffer.from('Content-Encoding: nonce\x00\x01', 'utf8')).digest().slice(0, 12);
    const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
    const ct = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payloadJson, 'utf8'), Buffer.from([2])])), cipher.final()]);
    const tag = cipher.getAuthTag();
    const rsBuf = Buffer.alloc(4);
    rsBuf.writeUInt32BE(4096, 0);
    return Buffer.concat([salt, rsBuf, Buffer.from([65]), asPub, ct, tag]);
  } catch (e) {
    return Buffer.alloc(0);
  }
}

function sendSingleWebPushRequestLocal(endpoint, bodyBuf, authHeader, timeoutMs = 4500) {
  return new Promise((resolve) => {
    try {
      const u = new URL(endpoint);
      const transport = u.protocol === 'http:' ? http : https;
      const req = transport.request({
        hostname: u.hostname,
        port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Authorization': authHeader,
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          'Content-Length': bodyBuf.length,
          'TTL': '86400',
          'Urgency': 'high'
        }
      }, (resp) => {
        let out = '';
        resp.on('data', (c) => { out += c; });
        resp.on('end', () => resolve({ ok: resp.statusCode >= 200 && resp.statusCode < 300, code: resp.statusCode || 0, body: out }));
      });
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, code: 0, error: 'timeout' }); });
      req.on('error', (err) => resolve({ ok: false, code: 0, error: err.message }));
      req.write(bodyBuf);
      req.end();
    } catch (e) {
      resolve({ ok: false, code: 0, error: e.message });
    }
  });
}

async function sendWebPushBatchLocal(items) {
  const vapid = getOrCreateVapidKeysLocal();
  if (!vapid || !Array.isArray(items) || items.length === 0) {
    return { ok: false, sent: 0, failed: 0, httpCodes: [], errors: ['VAPID unavailable'] };
  }
  const subsAll = readPushSubsLocal();
  let subsDirty = false;
  let sent = 0;
  let failed = 0;
  const httpCodes = [];
  const errors = [];

  await Promise.all(items.map(async (it) => {
    if (!it || !it.sub || !it.sub.endpoint || !it.sub.keys) return;
    let payloadStr = JSON.stringify(it.payload || {});
    if (payloadStr.length > 3200 && it.payload && it.payload.body) {
      payloadStr = JSON.stringify(Object.assign({}, it.payload, { body: String(it.payload.body).slice(0, 140) }));
    }
    const enc = encryptWebPushAes128GcmLocal(payloadStr, it.sub.keys.p256dh, it.sub.keys.auth);
    const authHdr = buildVapidAuthHeaderLocal(it.sub.endpoint, vapid);
    if (!enc.length || !authHdr) {
      failed++;
      errors.push('Encrypt/VAPID sign failed');
      return;
    }
    const r = await sendSingleWebPushRequestLocal(it.sub.endpoint, enc, authHdr);
    httpCodes.push(r.code || 0);
    if (r.ok) sent++;
    else {
      failed++;
      errors.push(`HTTP ${r.code || 0}${r.error ? ': ' + r.error : ''}`);
      if ((r.code === 404 || r.code === 410) && it.hash && subsAll[it.hash]) {
        delete subsAll[it.hash];
        subsDirty = true;
      }
    }
  }));
  if (subsDirty) savePushSubsLocal(subsAll);
  return { ok: sent > 0, sent, failed, httpCodes, errors };
}

function dispatchWebPushDiffLocal(prevDb, newDb, excludeActorPlayerId = '') {
  if (!newDb || typeof newDb !== 'object') return;
  const subs = readPushSubsLocal();
  const keys = Object.keys(subs);
  if (!keys.length) return;
  const activeSubs = {};
  const byPlayer = {};
  const adminSubs = {};
  keys.forEach((hKey) => {
    const s = subs[hKey];
    if (!s || !s.endpoint || s.muted) return;
    activeSubs[hKey] = s;
    if (s.playerId) {
      const pid = String(s.playerId);
      if (!byPlayer[pid]) byPlayer[pid] = {};
      byPlayer[pid][hKey] = s;
    }
    if (s.isAdmin) adminSubs[hKey] = s;
  });
  if (!Object.keys(activeSubs).length) return;

  const prevNotifs = {};
  const prevPending = {};
  const prevRounds = (prevDb && prevDb.publishedRoundByLeague) || {};
  if (prevDb && Array.isArray(prevDb.players)) {
    prevDb.players.forEach((p) => {
      if (!p || !p.id) return;
      const m = {};
      if (Array.isArray(p.notifications)) p.notifications.forEach((n) => { if (n && n.id) m[String(n.id)] = true; });
      prevNotifs[String(p.id)] = m;
    });
  }
  if (prevDb && Array.isArray(prevDb.matches)) {
    prevDb.matches.forEach((m) => { if (m && m.id && m.status === 'PENDING') prevPending[String(m.id)] = true; });
  }

  const batch = [];
  const seenKey = {};
  if (Array.isArray(newDb.players)) {
    newDb.players.forEach((np) => {
      if (!np || !np.id || !byPlayer[String(np.id)] || !Array.isArray(np.notifications)) return;
      const pid = String(np.id);
      const pMap = prevNotifs[pid] || {};
      np.notifications.filter((n) => n && n.id && !pMap[String(n.id)]).slice(0, 2).forEach((nn) => {
        const nt = String(nn.type || 'INFO').toUpperCase();
        const tab = (nt === 'SHOP_GIFT' || nt === 'SHOP_QUEST') ? 'competitions'
          : (nt === 'MATCH_REJECTED' ? 'submit'
          : (['MATCH_SUBMITTED', 'MATCH_APPROVED', 'MATCH_EDITED', 'WALKOVER', 'MATCH_PROPOSAL', 'DISPUTE'].includes(nt) ? 'schedule' : 'profile'));
        const ic = nn.icon && String(nn.title || '').indexOf(nn.icon) !== 0 ? (nn.icon + ' ') : '';
        const payload = { title: (ic + (nn.title || 'Powiadomienie SMPL')).slice(0, 120), body: String(nn.text || '').slice(0, 180), tag: 'smpl-n-' + nn.id, tab, url: './index.html#' + tab };
        Object.keys(byPlayer[pid]).forEach((hKey) => {
          const dk = hKey + '|' + payload.tag;
          if (!seenKey[dk]) {
            seenKey[dk] = true;
            batch.push({ hash: hKey, sub: byPlayer[pid][hKey], payload });
          }
        });
      });
    });
  }
  const newRounds = newDb.publishedRoundByLeague || {};
  Object.keys(newRounds).forEach((lgId) => {
    const nVal = Number(newRounds[lgId] || 0);
    const oVal = Number(prevRounds[lgId] || 0);
    if (nVal > oVal && nVal > 0) {
      const payload = { title: `⚽ ${lgId}: Kolejka #${nVal} wystartowała!`, body: 'Administrator puścił nową kolejkę! Umów dwumecz w Terminarzu.', tag: `smpl-round-${lgId}-${nVal}`, tab: 'schedule', url: './index.html#schedule' };
      Object.keys(activeSubs).forEach((hKey) => {
        const s = activeSubs[hKey];
        if (s.leagueId && String(s.leagueId).toUpperCase() !== lgId.toUpperCase() && !s.isAdmin) return;
        batch.push({ hash: hKey, sub: s, payload });
      });
    }
  });
  if (Object.keys(adminSubs).length && Array.isArray(newDb.matches)) {
    const newPend = newDb.matches.filter((m) => m && m.id && m.status === 'PENDING' && !prevPending[String(m.id)]);
    if (newPend.length) {
      const fm = newPend[0];
      const payload = { title: `🛡️ Nowy wynik do akceptacji (${fm.leagueId || 'LIGA'} Kol. ${fm.round || 1})`, body: `Wpłynęło ${newPend.length} zgłoszenie wyniku do moderacji.`, tag: 'smpl-adm-pend-' + Date.now(), tab: 'admin', url: './PANEL-ADMINA.html' };
      Object.keys(adminSubs).forEach((hKey) => batch.push({ hash: hKey, sub: adminSubs[hKey], payload }));
    }
  }
  if (batch.length) {
    sendWebPushBatchLocal(batch.slice(0, 60)).catch(() => {});
  }
}

function sanitizeVacationLocal(vac) {
  if (!vac || typeof vac !== 'object') return { isOnVacation: false, untilDate: '', reason: '' };
  const untilRaw = String(vac.untilDate || '').trim();
  const until = /^\d{4}-\d{2}-\d{2}$/.test(untilRaw) ? untilRaw : '';
  const reason = String(vac.reason || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
  return { isOnVacation: Boolean(vac.isOnVacation), untilDate: until, reason, updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ') };
}

const SHOP_CATALOG_LOCAL = {
  frame_ice_glacial: { category: 'frame', value: 'ice_glacial', price: 420 },
  frame_neon_emerald: { category: 'frame', value: 'neon_emerald', price: 350 },
  frame_violet_galaxy: { category: 'frame', value: 'violet_galaxy', price: 680 },
  frame_holo_diamond: { category: 'frame', value: 'holo_diamond', price: 1050 },
  frame_cyber_magenta: { category: 'frame', value: 'cyber_magenta', price: 1250 },
  frame_gold_crown: { category: 'frame', value: 'gold_crown', price: 1450 },
  frame_jade_dragon: { category: 'frame', value: 'jade_dragon', price: 1800 },
  frame_crimson_inferno: { category: 'frame', value: 'crimson_inferno', price: 2350 },
  frame_obsidian_noir: { category: 'frame', value: 'obsidian_noir', price: 2600 },
  frame_champion_eclipse: { category: 'frame', value: 'champion_eclipse', price: 5000 },
  bg_emerald_pitch: { category: 'bg', value: 'emerald_pitch', price: 280 },
  bg_stadium_aura: { category: 'bg', value: 'stadium_aura', price: 380 },
  bg_sunset_derby: { category: 'bg', value: 'sunset_derby', price: 520 },
  bg_cyber_grid: { category: 'bg', value: 'cyber_grid', price: 720 },
  bg_aurora_borealis: { category: 'bg', value: 'aurora_borealis', price: 1100 },
  bg_royal_gold: { category: 'bg', value: 'royal_gold', price: 1350 },
  bg_volcano_magma: { category: 'bg', value: 'volcano_magma', price: 1900 },
  bg_holo_carbon: { category: 'bg', value: 'holo_carbon', price: 2200 },
  bg_galaxies_end: { category: 'bg', value: 'galaxies_end', price: 3800 },
  badge_sniper: { category: 'badge', value: 'sniper', price: 250 },
  badge_wall: { category: 'badge', value: 'wall', price: 360 },
  badge_clutch: { category: 'badge', value: 'clutch', price: 540 },
  badge_rocket: { category: 'badge', value: 'rocket', price: 900 },
  badge_tactician: { category: 'badge', value: 'tactician', price: 1200 },
  badge_goat_horn: { category: 'badge', value: 'goat_horn', price: 2800 },
  nick_gold_shimmer: { category: 'nickfx', value: 'gold_shimmer', price: 600 },
  nick_emerald_glow: { category: 'nickfx', value: 'emerald_glow', price: 750 },
  nick_cyber_pulse: { category: 'nickfx', value: 'cyber_pulse', price: 980 },
  nick_fire_blaze: { category: 'nickfx', value: 'fire_blaze', price: 1650 },
  nick_prism_rainbow: { category: 'nickfx', value: 'prism_rainbow', price: 3200 },
  title_preset_king: { category: 'title', value: 'KRÓL STAŁYCH FRAGMENTÓW', price: 220 },
  title_preset_wall: { category: 'title', value: 'ŁOWCA CZYSTYCH KONT', price: 320 },
  title_preset_comeback: { category: 'title', value: 'MISTRZ POWROTÓW 90+', price: 440 },
  title_custom: { category: 'title', value: 'custom', price: 850 },
  title_preset_storm: { category: 'title', value: 'CISZA PRZED BURZĄ', price: 1150 },
  title_preset_veteran: { category: 'title', value: 'LEGENDA POLSKIEJ LIGI', price: 2500 },
  sound_arcade_levelup: { category: 'sound', value: 'arcade_levelup', price: 300 },
  sound_fanfare: { category: 'sound', value: 'fanfare', price: 460 },
  sound_goal_horn: { category: 'sound', value: 'goal_horn', price: 620 },
  sound_laser_strike: { category: 'sound', value: 'laser_strike', price: 880 },
  sound_champions_anthem: { category: 'sound', value: 'champions_anthem', price: 1400 },
  sound_samurai_gong: { category: 'sound', value: 'samurai_gong', price: 2100 },
  poster_cyber_arena: { category: 'poster', value: 'cyber_arena', price: 800 },
  poster_golden_gala: { category: 'poster', value: 'golden_gala', price: 1500 },
  poster_derby_inferno: { category: 'poster', value: 'derby_inferno', price: 920 },
  poster_arctic_ucl: { category: 'poster', value: 'arctic_ucl', price: 560 },
  poster_royal_eclipse: { category: 'poster', value: 'royal_eclipse', price: 2400 },
  drop_s56_frame_frostking: { category: 'frame', value: 'drop_s56_frostking', price: 900, seasonOnly: 56 },
  drop_s56_bg_starfall: { category: 'bg', value: 'drop_s56_starfall', price: 720, seasonOnly: 56 },
  drop_s56_badge_pioneer: { category: 'badge', value: 's56_pioneer', price: 550, seasonOnly: 56 },
  drop_s56_title_founder: { category: 'title', value: 'Legenda Startu S56', price: 480, seasonOnly: 56 }
};

function ensureShopUnlockLocal(db, pid) {
  if (!db.competitions.playerShop || typeof db.competitions.playerShop !== 'object') {
    db.competitions.playerShop = { unlocks: {}, bonusCoins: {}, giftHistory: [] };
  }
  if (!db.competitions.playerShop.unlocks) db.competitions.playerShop.unlocks = {};
  if (!Array.isArray(db.competitions.playerShop.giftHistory)) db.competitions.playerShop.giftHistory = [];
  if (!db.competitions.playerShop.unlocks[pid]) {
    db.competitions.playerShop.unlocks[pid] = {
      frame: 'default', bgStyle: 'default', profileBadge: 'default', nickEffect: 'default', posterTheme: 'default',
      customTitle: '', joinSound: 'default', unlockedItems: [], spentCoins: 0, claimedQuests: [], questCoins: 0, giftCoinsReceived: 0, carryoverCoins: 0
    };
  }
  const u = db.competitions.playerShop.unlocks[pid];
  if (!Array.isArray(u.unlockedItems)) u.unlockedItems = [];
  if (!Array.isArray(u.claimedQuests)) u.claimedQuests = [];
  if (u.carryoverCoins === undefined) u.carryoverCoins = 0;
  return u;
}

function computeWeeklyQuestsLocal(db, playerId) {
  const season = Number(db.season || 56);
  const week = Math.max(1, Number((db.weeklyConfig && db.weeklyConfig.currentWeek) || 1));
  const stepW = Math.max(0, week - 1);
  let played = 0; let wins = 0; let cs = 0; let woLost = 0;
  (db.matches || []).forEach((m) => {
    if (!m) return;
    const h = String(m.homeId || ''); const a = String(m.awayId || '');
    if (h !== playerId && a !== playerId) return;
    const hs = Number(m.homeScore || 0); const as = Number(m.awayScore || 0);
    const myG = h === playerId ? hs : as; const opG = h === playerId ? as : hs;
    if (m.status === 'APPROVED') { played++; if (myG > opG) wins++; if (opG === 0) cs++; }
    else if (m.status === 'WALKOVER') { if (myG < opG) woLost++; }
  });
  const comp = db.competitions || {};
  const typerCount = (comp.typerPredictions || []).filter((pr) => pr && String(pr.voterPlayerId || '') === playerId).length;
  let fanCount = 0;
  Object.keys(comp.fanPolls || {}).forEach((mid) => {
    const fp = comp.fanPolls[mid];
    if (!fp) return;
    if ((Array.isArray(fp.homeVotes) && fp.homeVotes.includes(playerId)) ||
        (Array.isArray(fp.awayVotes) && fp.awayVotes.includes(playerId)) ||
        (Array.isArray(fp.drawVotes) && fp.drawVotes.includes(playerId))) fanCount++;
  });
  const typerFan = typerCount + fanCount;
  return {
    q_match_opener: { title: 'Pierwszy Gwizdek', reward: 8, done: played >= (1 + stepW * 2), periodKey: `S${season}_W${week}:q_match_opener` },
    q_two_matches: { title: 'Aktywny Ligowiec', reward: 15, done: played >= (2 + stepW * 2) && woLost === 0, periodKey: `S${season}_W${week}:q_two_matches` },
    q_clean_sheet: { title: 'Mur Bramkarza', reward: 14, done: cs >= (1 + stepW), periodKey: `S${season}_W${week}:q_clean_sheet` },
    q_fan_typer: { title: 'Analityk Trybun', reward: 6, done: typerFan >= (1 + stepW * 2), periodKey: `S${season}_W${week}:q_fan_typer` },
    q_three_wins: { title: 'Seria Mistrza', reward: 22, done: wins >= (3 + stepW * 2), periodKey: `S${season}_W${week}:q_three_wins` }
  };
}

function computePlayerCoinsLocal(db, playerId) {
  if (!playerId || !db) return 0;
  let coins = 0; let played = 0; let cs = 0; let woLost = 0;
  const byId = {};
  (db.matches || []).forEach((m) => {
    if (!m) return;
    if (m.id) byId[String(m.id)] = m;
    const h = String(m.homeId || ''); const a = String(m.awayId || '');
    if (h !== playerId && a !== playerId) return;
    if (m.status === 'APPROVED') {
      played++;
      const hs = Number(m.homeScore || 0); const as = Number(m.awayScore || 0);
      if ((h === playerId && as === 0) || (a === playerId && hs === 0)) cs++;
    } else if (m.status === 'WALKOVER') {
      const hs = Number(m.homeScore || 0); const as = Number(m.awayScore || 0);
      if ((h === playerId && hs < as) || (a === playerId && as < hs)) woLost++;
    }
  });
  coins += played * 6 + cs * 5;
  if (played >= 10 && woLost === 0) coins += 35;
  const comp = db.competitions || {};
  (comp.typerPredictions || []).forEach((pr) => {
    if (!pr || String(pr.voterPlayerId || '') !== playerId) return;
    const m = byId[String(pr.matchId || '')];
    if (m && m.status === 'APPROVED') {
      const hs = Number(m.homeScore); const as = Number(m.awayScore);
      const ph = Number(pr.predHome); const pa = Number(pr.predAway);
      if (hs === ph && as === pa) coins += 12;
      else if ((hs > as && ph > pa) || (hs < as && ph < pa) || (hs === as && ph === pa)) coins += 4;
    }
  });
  if ((comp.puskasNominations || []).some((nm) => nm && String(nm.playerId || '') === playerId)) coins += 15;
  if (db.goldenBall && Array.isArray(db.goldenBall.votes)) {
    if (db.goldenBall.votes.some((vt) => vt && String(vt.voterPlayerId || '') === playerId)) coins += 10;
  }
  if (comp.playerShop && comp.playerShop.bonusCoins && comp.playerShop.bonusCoins[playerId]) {
    coins += Number(comp.playerShop.bonusCoins[playerId] || 0);
  }
  const uRec = (comp.playerShop && comp.playerShop.unlocks && comp.playerShop.unlocks[playerId]) || {};
  coins += Number(uRec.questCoins || 0) + Number(uRec.giftCoinsReceived || 0) + Number(uRec.carryoverCoins || 0);
  const spent = Number(uRec.spentCoins || 0);
  return Math.max(0, coins - spent);
}

const server = http.createServer((req, res) => {
  res._smplReq = req;
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const action = parsedUrl.searchParams.get('action') || '';

  // Obsługa API bazy danych i Gemini (zarówno pod /api/state jak i /api.php)
  if (pathname === '/api/state' || pathname === '/api.php') {
    if (req.method === 'GET') {
      if (action === 'health') {
        return sendJson(res, 200, {
          ok: true,
          server: 'NODE_ZERO_CONFIG_SECURED',
          hasDatabaseFile: fs.existsSync(DB_FILE)
        });
      }

      if (action === 'ai_status') {
        const cfg = readAiSecrets();
        const resolved = resolveGeminiKey(cfg);
        return sendJson(res, 200, {
          ok: true,
          geminiReady: Boolean(resolved.key && cfg.enabled),
          enabled: Boolean(cfg.enabled),
          model: validateGeminiModel(cfg.model)
        });
      }

      if (action === 'ai_config_get') {
        const db = readDbJson();
        if (!validateAdminTokenHeader(req, db)) {
          return sendJson(res, 403, { ok: false, error: 'Wymagana aktywna sesja Administratora z tokenem serwera.' });
        }
        const cfg = readAiSecrets();
        const resolved = resolveGeminiKey(cfg);
        return sendJson(res, 200, {
          ok: true,
          configured: Boolean(resolved.key),
          hasEnvKey: resolved.fromEnv,
          maskedKey: maskSecret(resolved.key),
          model: validateGeminiModel(cfg.model),
          enabled: Boolean(cfg.enabled),
          customPersona: cfg.customPersona || '',
          temperature: Number(cfg.temperature != null ? cfg.temperature : 0.7),
          updatedAt: cfg.updatedAt,
          updatedBy: cfg.updatedBy,
          lastTestOk: cfg.lastTestOk,
          lastTestAt: cfg.lastTestAt,
          lastTestError: cfg.lastTestError
        });
      }

      if (action === 'push_public_key') {
        const vapid = getOrCreateVapidKeysLocal();
        const sup = Boolean(vapid && vapid.publicKey);
        return sendJson(res, 200, { ok: true, supported: sup, publicKey: sup ? vapid.publicKey : '', reason: sup ? 'OK' : 'NODE_CRYPTO_UNAVAILABLE' });
      }

      if (action === 'webhooks_get') {
        const db = readDbJson();
        if (!validateAdminTokenHeader(req, db)) {
          return sendJson(res, 403, { ok: false, error: 'Wymagana aktywna sesja Administratora z tokenem serwera.' });
        }
        const wCfg = readWebhooksConfigLocal();
        return sendJson(res, 200, {
          ok: true,
          enabled: Boolean(wCfg.enabled),
          hasDiscordPublic: Boolean(wCfg.discordPublicUrl),
          hasDiscordAdmin: Boolean(wCfg.discordAdminUrl),
          hasTelegram: Boolean(wCfg.telegramBotToken && wCfg.telegramChatId),
          discordPublicMasked: maskSecret(wCfg.discordPublicUrl),
          discordAdminMasked: maskSecret(wCfg.discordAdminUrl),
          telegramTokenMasked: maskSecret(wCfg.telegramBotToken),
          telegramChatId: wCfg.telegramChatId || '',
          events: wCfg.events,
          updatedAt: wCfg.updatedAt,
          updatedBy: wCfg.updatedBy
        });
      }

      if (action === 'snapshots_list') {
        const db = readDbJson();
        if (!validateAdminTokenHeader(req, db)) {
          return sendJson(res, 403, { ok: false, error: 'Lista kopii zapasowych wymaga sesji Administratora.' });
        }
        const items = [];
        if (fs.existsSync(SNAPSHOTS_DIR)) {
          const files = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => /^smpl-db-([A-Za-z0-9_-]+)\.json$/.test(f)).sort().reverse();
          files.forEach((bn) => {
            const fp = path.join(SNAPSHOTS_DIR, bn);
            const st = fs.statSync(fp);
            const mD = bn.match(/^smpl-db-([A-Za-z0-9_-]+)\.json$/);
            items.push({ name: bn, date: mD ? mD[1] : '', bytes: st.size, mtime: st.mtime.toISOString().slice(0, 16).replace('T', ' ') });
          });
        }
        return sendJson(res, 200, { ok: true, snapshots: items });
      }

      if (fs.existsSync(DB_FILE)) {
        try {
          const st = fs.statSync(DB_FILE);
          const curEtag = Math.floor(st.mtimeMs / 1000) + '-' + st.size;
          const reqEtag = parsedUrl.searchParams.get('etag') || '';
          if (reqEtag && reqEtag === curEtag && st.size > 20) {
            return sendJson(res, 200, { ok: true, unchanged: true, etag: curEtag }, { ETag: `"${curEtag}"` });
          }
          const raw = fs.readFileSync(DB_FILE, 'utf8');
          if (raw && raw.length > 20) {
            return sendJson(res, 200, raw, { ETag: `"${curEtag}"` });
          }
        } catch (e) {}
      }
      return sendJson(res, 200, { empty: true, server: 'NODE_ZERO_CONFIG_SECURED' });
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString('utf8');
        if (body.length > 35 * 1024 * 1024) {
          req.destroy();
        }
      });
      req.on('end', async () => {
        if (action === 'admin_auth') {
          let creds = {};
          try { creds = JSON.parse(body || '{}'); } catch (e) {}
          const login = String(creds.login || creds.username || '').trim().toLowerCase();
          const pass = String(creds.password || '').trim();
          const db = readDbJson();
          if (!db || !Array.isArray(db.admins)) {
            return sendJson(res, 403, { ok: false, error: 'Baza nie została jeszcze zainicjalizowana.' });
          }
          const matched = db.admins.find((a) => {
            if (!a) return false;
            const u = String(a.username || '').trim().toLowerCase();
            const em = String(a.email || '').trim().toLowerCase();
            return (u && u === login) || (em && em === login);
          });
          if (!matched || !verifySecretLocal(matched, pass)) {
            return sendJson(res, 403, { ok: false, error: 'Nieprawidłowy login lub hasło administratora.' });
          }
          if (matched.status && matched.status !== 'APPROVED') {
            return sendJson(res, 403, { ok: false, error: 'Konto administratora nie jest zatwierdzone.' });
          }
          const rawToken = crypto.randomBytes(24).toString('hex');
          const tokHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const tokens = loadTokens();
          tokens[tokHash] = {
            adminId: String(matched.id),
            adminName: matched.name || 'Admin',
            role: matched.role || 'CO_ADMIN',
            issuedAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + 604800
          };
          saveTokens(tokens);
          return sendJson(res, 200, {
            ok: true,
            token: rawToken,
            adminId: String(matched.id),
            adminName: matched.name || 'Admin',
            role: matched.role || 'CO_ADMIN'
          });
        }

        if (action === 'admin_logout') {
          const tok = String(req.headers['x-smpl-admin-token'] || '').trim();
          if (tok) {
            const tokHash = crypto.createHash('sha256').update(tok).digest('hex');
            const tokens = loadTokens();
            if (tokens[tokHash]) {
              delete tokens[tokHash];
              saveTokens(tokens);
            }
          }
          return sendJson(res, 200, { ok: true });
        }

        if (action === 'player_auth') {
          let creds = {};
          try { creds = JSON.parse(body || '{}') || {}; } catch (e) {}
          const login = String(creds.identifier || creds.login || '').trim().toLowerCase();
          const pass = String(creds.password || '').trim();
          if (!login || !pass) {
            return sendJson(res, 400, { ok: false, error: 'Podaj login/nick oraz hasło zawodnika.' });
          }
          const db = readDbJson();
          if (!db || !Array.isArray(db.players)) {
            return sendJson(res, 403, { ok: false, error: 'Baza danych nie została jeszcze zainicjalizowana.' });
          }
          let subject = (db.players || []).find((p) => p && !p.isPlaceholder && (
            (p.username && String(p.username).trim().toLowerCase() === login) ||
            (p.nick && String(p.nick).trim().toLowerCase() === login) ||
            (p.name && String(p.name).trim().toLowerCase() === login)
          )) || null;
          let subjectKind = subject ? 'PLAYER' : '';
          if (!subject && Array.isArray(db.registrations)) {
            subject = db.registrations.find((r) => r && (r.status === 'APPROVED_POOL' || r.status === 'PENDING') && (
              (r.username && String(r.username).trim().toLowerCase() === login) ||
              (r.nick && String(r.nick).trim().toLowerCase() === login) ||
              (r.name && String(r.name).trim().toLowerCase() === login)
            )) || null;
            if (subject) subjectKind = 'REG';
          }
          if (!subject || !verifySecretLocal(subject, pass)) {
            return sendJson(res, 401, { ok: false, error: 'Nieprawidłowy login lub hasło zawodnika.' });
          }
          const sName = String(subject.name || '').trim().toLowerCase();
          const sNick = String(subject.nick || '').trim().toLowerCase();
          const isBl = Boolean(
            subject.isBlacklisted || subject.banned || subject.customRank === 'BLACKLISTED' ||
            (Array.isArray(db.blacklist) && db.blacklist.some((b) => b && (
              (b.name && String(b.name).trim().toLowerCase() === sName) ||
              (b.nick && String(b.nick).trim().toLowerCase() === sNick)
            )))
          );
          if (isBl) {
            return sendJson(res, 403, { ok: false, error: 'Konto znajduje się na Czarnej Liście SMPL.' });
          }
          const rawToken = crypto.randomBytes(24).toString('hex');
          const tokHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const tokens = loadTokens();
          const nowSec = Math.floor(Date.now() / 1000);
          tokens[tokHash] = {
            tokenType: 'PLAYER',
            subjectKind,
            subjectId: String(subject.id),
            username: String(subject.username || ''),
            name: String(subject.name || 'Zawodnik'),
            issuedAt: nowSec,
            expiresAt: nowSec + 1209600
          };
          saveTokens(tokens);
          return sendJson(res, 200, {
            ok: true,
            token: rawToken,
            subjectKind,
            subjectId: String(subject.id),
            name: String(subject.name || 'Zawodnik')
          });
        }

        if (action === 'player_league_membership') {
          let payload = {};
          try { payload = JSON.parse(body || '{}') || {}; } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format JSON.' });
          }
          const pAuth = validatePlayerTokenHeader(req, payload);
          if (!pAuth) {
            return sendJson(res, 401, { ok: false, error: 'Wymagane uwierzytelnienie gracza (X-SMPL-Player-Token).' });
          }
          const db = readDbJson();
          if (!db || !Array.isArray(db.players)) {
            return sendJson(res, 400, { ok: false, error: 'Brak prawidłowej bazy danych SMPL.' });
          }
          const ps = (db.portalSettings && typeof db.portalSettings === 'object') ? db.portalSettings : {};
          if (!ps.seasonJoinOpen) {
            return sendJson(res, 403, { ok: false, error: 'Odmowa: Okno zapisów do ligi jest ZAMKNIĘTE. Poczekaj aż Administracja zatwierdzi początek sezonu.' });
          }
          const op = String(payload.op || '').trim().toLowerCase();
          const leagueId = String(payload.leagueId || '').trim().toUpperCase();
          if (op !== 'join' && op !== 'leave') {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowa operacja (join/leave).' });
          }
          if (op === 'join') {
            if (!/^L\d{1,2}$/.test(leagueId)) {
              return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy identyfikator ligi.' });
            }
            const lgMap = db.leagues || {};
            if (lgMap[leagueId] && lgMap[leagueId].enabled === false) {
              return sendJson(res, 400, { ok: false, error: 'Wybrana liga jest obecnie wyłączona.' });
            }
            if (Array.isArray(ps.seasonJoinAllowedLeagues) && ps.seasonJoinAllowedLeagues.length > 0 && !ps.seasonJoinAllowedLeagues.includes(leagueId)) {
              return sendJson(res, 403, { ok: false, error: 'Administracja otworzyła zapisy tylko dla wybranych lig.' });
            }
          }

          const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
          const pIdx = db.players.findIndex((p) => p && String(p.id) === String(pAuth.info.subjectId));
          let affectedPlayerId = '';
          if (pIdx >= 0) {
            const pl = db.players[pIdx];
            if (pl.isBlacklisted || pl.banned || pl.customRank === 'BLACKLISTED') {
              return sendJson(res, 403, { ok: false, error: 'Konto jest zbanowane na Czarnej Liście.' });
            }
            if (op === 'join') {
              pl.leagueId = leagueId;
              pl.active = true;
              pl.leftLeagueAt = null;
              pl.joinedViaButtonAt = nowStr;
            } else {
              pl.active = false;
              pl.leagueId = 'POOL';
              pl.leftLeagueAt = nowStr;
            }
            affectedPlayerId = String(pl.id);
          } else if (pAuth.info.subjectKind === 'REG' && op === 'join') {
            const regs = Array.isArray(db.registrations) ? db.registrations : [];
            const regObj = regs.find((r) => r && String(r.id) === String(pAuth.info.subjectId));
            if (!regObj) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono konta rejestracji.' });
            if (regObj.status !== 'APPROVED_POOL') {
              return sendJson(res, 403, { ok: false, error: 'Konto oczekuje jeszcze na zatwierdzenie przez Administrację.' });
            }
            const nextExcelOrder = db.players
              .filter((p) => p && p.leagueId === leagueId)
              .reduce((mx, p) => Math.max(mx, Number(p.excelOrder || 0)), 0) + 1;
            const newId = 'PLR_' + Date.now() + '_' + Math.floor(Math.random() * 900 + 100);
            db.players.push({
              id: newId,
              name: String(regObj.name || 'Zawodnik'),
              nick: String(regObj.nick || 'Gracz'),
              username: String(regObj.username || ''),
              passwordHash: String(regObj.passwordHash || ''),
              fb: String(regObj.fbLink || ''),
              fbLink: String(regObj.fbLink || ''),
              leagueId,
              active: true,
              excelOrder: nextExcelOrder,
              joinedSeason: Number(db.season || 56),
              joinedViaButtonAt: nowStr,
              clanId: regObj.clanId || null,
              clanName: regObj.clanName || null,
              clanTag: regObj.clanTag || null,
              clanColor: regObj.clanColor || null,
              clanLogo: regObj.clanLogo || null,
              avatar: regObj.avatar || '',
              bio: String(regObj.bio || ''),
              playedBefore: Boolean(regObj.playedBefore),
              historicalArchiveName: regObj.linkedHistoricalName || null,
              penaltyPoints: 0,
              penaltyReason: '',
              yellowCards: 0,
              redCards: 0,
              isSuspended: false,
              customRank: null,
              trophies: [],
              notifications: [{ id: 'NOTIF_' + Date.now(), time: nowStr, text: `⚡ Dołączyłeś do ligi ${leagueId} przyciskiem startowym sezonu!` }]
            });
            regObj.status = 'ASSIGNED';
            regObj.assignedLeague = leagueId;
            regObj.assignedPlayerId = newId;
            pAuth.tokens[pAuth.tokHash].subjectKind = 'PLAYER';
            pAuth.tokens[pAuth.tokHash].subjectId = newId;
            saveTokens(pAuth.tokens);
            affectedPlayerId = newId;
          } else {
            return sendJson(res, 400, { ok: false, error: 'Brak uprawnionego profilu gracza dla tej akcji.' });
          }

          db.updatedAt = Date.now();
          const logItem = {
            id: 'LOG_' + Date.now(),
            time: nowStr,
            type: op === 'join' ? 'PLAYER_JOIN_LEAGUE' : 'PLAYER_LEAVE_LEAGUE',
            text: `${op === 'join' ? '⚡ Gracz' : '🚪 Gracz'} ${pAuth.info.name} ${op === 'join' ? `dołączył do ligi ${leagueId}` : 'opuścił ligę (okno sezonowe).'}`
          };
          if (!Array.isArray(db.activityLog)) db.activityLog = [];
          db.activityLog.unshift(logItem);
          if (db.activityLog.length > 120) db.activityLog = db.activityLog.slice(0, 120);
          if (!Array.isArray(db.logs)) db.logs = [];
          db.logs.unshift(logItem);
          if (db.logs.length > 300) db.logs = db.logs.slice(0, 300);
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf8');
          return sendJson(res, 200, { ok: true, op, leagueId, playerId: affectedPlayerId, state: db });
        }

        if (action === 'player_register') {
          const db = readDbJson();
          if (!db || !Array.isArray(db.players)) {
            return sendJson(res, 400, { ok: false, error: 'Baza danych SMPL na serwerze jest pusta lub uszkodzona.' });
          }
          let payload = {};
          try { payload = JSON.parse(body || '{}'); } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format JSON formularza rejestracji.' });
          }
          if (!payload.acceptedRules || !payload.acceptedLegalGDPR) {
            return sendJson(res, 400, { ok: false, error: 'Musisz zaakceptować Regulamin Rozgrywek, Klauzulę Prawną / RODO oraz potwierdzić wymóg wieku 16+.' });
          }

          const cleanName = String(payload.name || '').trim().slice(0, 80);
          const cleanNick = String(payload.nick || '').trim().slice(0, 50);
          const cleanFb = String(payload.fbLink || '').trim().slice(0, 255);
          const passHash = String(payload.passwordHash || '').trim();
          if (cleanName.length < 2) return sendJson(res, 400, { ok: false, error: 'Podaj imię i nazwisko lub pseudonim (minimum 2 znaki).' });
          if (cleanNick.length < 2) return sendJson(res, 400, { ok: false, error: 'Podaj swój nick w grze Score! Match (minimum 2 znaki).' });
          if (cleanFb.length < 3) return sendJson(res, 400, { ok: false, error: 'Podaj kontakt Facebook / Messenger.' });
          if (!/^smplh1\$[a-f0-9]{8,64}$/i.test(passHash)) return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format zabezpieczenia hasła.' });

          const avRes = validateImageUriLocal(payload.avatar || '', 480000);
          if (!avRes.ok) return sendJson(res, 400, { ok: false, error: 'Awatar: ' + avRes.error });

          if (!Array.isArray(db.registrations)) db.registrations = [];
          if (!Array.isArray(db.clans)) db.clans = [];
          if (!Array.isArray(db.blacklist)) db.blacklist = [];

          const tsMs = Date.now();
          const reqIdRaw = String(payload.id || '').trim();
          const hasClientId = /^REG_[A-Za-z0-9_-]{3,60}$/.test(reqIdRaw);
          const regId = hasClientId ? reqIdRaw : ('REG_S55_' + tsMs + '_' + crypto.randomBytes(3).toString('hex'));

          if (hasClientId) {
            const existingReg = db.registrations.find((r) => r && String(r.id) === regId);
            if (existingReg) {
              return sendJson(res, 200, { ok: true, idempotent: true, registration: existingReg, clan: null, updatedAt: db.updatedAt || tsMs, state: db });
            }
          }

          const nameFold = foldPlCharsLocal(cleanName);
          const nickFold = foldPlCharsLocal(cleanNick);
          const fbLow = cleanFb.toLowerCase();
          if (isOnBlacklistLocal(db, nameFold, nickFold, fbLow)) {
            return sendJson(res, 403, { ok: false, error: '⛔ ODRAZU ODRZUCONO: Twoje dane widnieją na Czarnej Liście Score Match Ligi z dożywotnim zakazem gry!' });
          }

          const dupPlayer = db.players.find((p) => p && !p.isPlaceholder && !p.gdprDeleted && p.nick && foldPlCharsLocal(p.nick) === nickFold);
          if (dupPlayer) {
            return sendJson(res, 400, { ok: false, error: `Nick @${cleanNick} jest już przypisany do aktywnego gracza SMPL.` });
          }
          const dupPending = db.registrations.find((r) => r && r.status === 'PENDING' && r.nick && foldPlCharsLocal(r.nick) === nickFold);
          if (dupPending) {
            return sendJson(res, 400, { ok: false, error: `Zgłoszenie z nickiem @${cleanNick} już oczekuje w Panelu Admina!` });
          }

          const usedLogins = collectUsedLoginsLocal(db, false);
          const baseUser = payload.username ? toCleanUsernameLocal(payload.username) : toCleanUsernameLocal(cleanName);
          let cleanUser = baseUser;
          if (usedLogins[cleanUser]) {
            let sfx = 2;
            while (usedLogins[baseUser + '.' + sfx] && sfx < 999) sfx++;
            cleanUser = baseUser + '.' + sfx;
          }

          const cleanBio = String(payload.bio || '').replace(/\r\n|\r/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 280);
          const cleanNotes = String(payload.notes || '').replace(/\r\n|\r/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 500)
            || 'Konto założone przez gracza — oczekuje na dopisanie do wybranej ligi przez Administrację.';
          const prefLgRaw = String(payload.preferredLeague || 'L2').trim().toUpperCase();
          const prefLeague = /^[A-Z0-9_-]{1,12}$/.test(prefLgRaw) ? prefLgRaw : 'L2';
          const preference = String(payload.preference || '').trim().slice(0, 120) || (`Zapis do Score Match Liga (${prefLeague})`);
          const playedBefore = Boolean(payload.playedBefore);
          const linkedHist = playedBefore ? String(payload.linkedHistoricalName || '').trim().slice(0, 80) : '';
          const rulesVer = String(payload.acceptedRulesVersion || 'SMPL-REG-2026.1').trim().slice(0, 32) || 'SMPL-REG-2026.1';

          const nowFmt = new Date().toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '.');
          const clanRes = resolveClanPayloadLocal(db, payload, cleanName, tsMs, nowFmt);
          if (!clanRes.ok) return sendJson(res, 400, { ok: false, error: clanRes.error });

          const newReg = {
            id: regId,
            name: cleanName,
            nick: cleanNick,
            username: cleanUser,
            fbLink: cleanFb,
            preference,
            preferredLeague: prefLeague,
            passwordHash: passHash,
            acceptedRules: true,
            acceptedLegalGDPR: true,
            acceptedRulesVersion: rulesVer,
            acceptedAt: nowFmt,
            status: 'PENDING',
            submittedAt: nowFmt,
            notes: cleanNotes,
            avatar: avRes.value,
            bio: cleanBio,
            playedBefore,
            linkedHistoricalName: linkedHist,
            clanId: clanRes.clanId,
            clanName: clanRes.clanName,
            clanTag: clanRes.clanTag,
            clanLogo: clanRes.clanLogo
          };

          db.registrations.unshift(newReg);
          if (!Array.isArray(db.activityLog)) db.activityLog = [];
          db.activityLog.unshift({
            id: 'LOG_REG_' + tsMs,
            time: nowFmt,
            type: 'REGISTRATION',
            text: `📝 Gracz ${cleanName} (@${cleanNick}, login: ${cleanUser}) założył konto i trafił na Listę do Dopisania do Ligi (${preference}).`
          });
          if (db.activityLog.length > 120) db.activityLog = db.activityLog.slice(0, 120);
          db.updatedAt = tsMs;
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf8');
          return sendJson(res, 200, { ok: true, registration: newReg, clan: clanRes.createdClan, updatedAt: tsMs, state: db });
        }

        if (action === 'master_grant_admin') {
          let payload = {};
          try { payload = JSON.parse(body || '{}') || {}; } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format JSON danych administratora.' });
          }
          const prevDb = readDbJson();
          const adminTokenInfo = validateAdminTokenHeader(req, prevDb, payload);
          const callerAdmObj = (adminTokenInfo && prevDb && Array.isArray(prevDb.admins))
            ? prevDb.admins.find((a) => a && String(a.id) === String(adminTokenInfo.adminId))
            : null;
          const callerRole = callerAdmObj && callerAdmObj.role ? String(callerAdmObj.role) : (adminTokenInfo ? String(adminTokenInfo.role || '') : '');
          if (!adminTokenInfo || callerRole !== 'MASTER_ADMIN') {
            return sendJson(res, 403, { ok: false, error: 'Odmowa dostępu: wyłącznie Master Admin (Szymon Komenda) może nadawać uprawnienia Administratora.' });
          }
          if (!prevDb || !Array.isArray(prevDb.players)) {
            return sendJson(res, 400, { ok: false, error: 'Baza danych SMPL na serwerze jest pusta lub uszkodzona.' });
          }
          if (!Array.isArray(prevDb.admins)) prevDb.admins = [];
          if (!Array.isArray(prevDb.registrations)) prevDb.registrations = [];

          const tsMs = Date.now();
          const reqIdRaw = String(payload.id || '').trim();
          const hasClientId = /^ADM_[A-Za-z0-9_-]{3,60}$/.test(reqIdRaw);
          const admId = hasClientId ? reqIdRaw : ('ADM_DIRECT_' + tsMs + '_' + crypto.randomBytes(3).toString('hex'));

          if (hasClientId) {
            const existingDirect = prevDb.admins.find((a) => a && String(a.id) === admId && String(a.status || '') === 'APPROVED');
            if (existingDirect) {
              return sendJson(res, 200, { ok: true, idempotent: true, admin: existingDirect, linkedPlayerId: null, updatedAt: prevDb.updatedAt || tsMs, state: prevDb });
            }
          }

          const sourcePlayerId = String(payload.sourcePlayerId || '').trim();
          const sourceRegId = String(payload.sourceRegId || '').trim();
          const linkPlayer = Object.prototype.hasOwnProperty.call(payload, 'linkPlayer') ? Boolean(payload.linkPlayer) : true;

          let srcPlayerIdx = -1;
          let srcPlayer = null;
          if (sourcePlayerId) {
            srcPlayerIdx = prevDb.players.findIndex((pl) => pl && !pl.isPlaceholder && String(pl.id) === sourcePlayerId);
            if (srcPlayerIdx < 0) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono wskazanego gracza do awansu na Admina.' });
            srcPlayer = prevDb.players[srcPlayerIdx];
          }
          let srcReg = null;
          if (sourceRegId) {
            srcReg = prevDb.registrations.find((rg) => rg && String(rg.id) === sourceRegId) || null;
            if (!srcReg) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono wskazanego zgłoszenia gracza.' });
          }

          const cleanName = String((payload.name && String(payload.name).trim()) || (srcPlayer && srcPlayer.name) || (srcReg && srcReg.name) || '').trim().slice(0, 80);
          if (cleanName.length < 2) return sendJson(res, 400, { ok: false, error: 'Podaj imię / nazwę nowego Administratora (minimum 2 znaki).' });

          const srcNick = (srcPlayer && srcPlayer.nick) ? String(srcPlayer.nick) : ((srcReg && srcReg.nick) ? String(srcReg.nick) : '');
          if (isOnBlacklistLocal(prevDb, foldPlCharsLocal(cleanName), foldPlCharsLocal(srcNick), '')) {
            return sendJson(res, 403, { ok: false, error: '⛔ Kandydat widnieje na Czarnej Liście SMPL i nie może otrzymać uprawnień Administratora.' });
          }

          const rawUsername = String((payload.username && String(payload.username).trim()) || (srcPlayer && srcPlayer.username) || (srcReg && srcReg.username) || toCleanUsernameLocal(cleanName)).trim().toLowerCase();
          if (!/^[a-z0-9._-]{3,40}$/.test(rawUsername)) {
            return sendJson(res, 400, { ok: false, error: 'Login administratora musi mieć 3–40 znaków (małe litery, cyfry, kropka, myślnik lub podkreślnik).' });
          }

          for (const admCheck of prevDb.admins) {
            if (!admCheck) continue;
            const chkId = String(admCheck.id || '');
            const chkUser = String(admCheck.username || '').trim().toLowerCase();
            if (chkUser === rawUsername && chkId !== admId) {
              const isMasterTarget = String(admCheck.role || '') === 'MASTER_ADMIN';
              const isSameLinkedPlayer = Boolean(srcPlayer && srcPlayer.adminId && String(srcPlayer.adminId) === chkId);
              const isReactivatable = !isMasterTarget && (String(admCheck.status || '') !== 'APPROVED' || isSameLinkedPlayer);
              if (!isReactivatable) {
                return sendJson(res, 400, { ok: false, error: `Login administratora "${rawUsername}" jest już zajęty przez aktywnego admina.` });
              }
            }
          }

          const inPassHash = String(payload.passwordHash || '').trim();
          const useExistingPass = Boolean(payload.useExistingPassword);
          let finalPassHash = '';
          if (inPassHash) {
            if (!/^smplh1\$[a-f0-9]{8,64}$/i.test(inPassHash)) {
              return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format zabezpieczenia hasła administratora.' });
            }
            finalPassHash = inPassHash;
          } else if (useExistingPass) {
            const candHash = String((srcPlayer && srcPlayer.passwordHash) || (srcReg && srcReg.passwordHash) || '').trim();
            if (/^smplh1\$[a-f0-9]{8,64}$/i.test(candHash)) finalPassHash = candHash;
          }
          if (!finalPassHash) {
            return sendJson(res, 400, { ok: false, error: 'Podaj hasło dla nowego Administratora (lub wskaż gracza posiadającego aktywne hasło).' });
          }

          const division = String(payload.division || 'Wszystkie Dywizje (Zarząd)').trim().slice(0, 80) || 'Wszystkie Dywizje (Zarząd)';
          const roleTitle = String(payload.roleTitle || ('Współadministrator — ' + division)).trim().slice(0, 100);
          const cleanFb = String((payload.fbLink && String(payload.fbLink).trim()) || (srcPlayer && srcPlayer.fbLink) || (srcReg && srcReg.fbLink) || 'https://m.me/smpl').trim().slice(0, 255);
          const cleanEmail = String((payload.email && String(payload.email).trim()) || (rawUsername + '@smpl.pl')).trim().toLowerCase().slice(0, 120);
          const rawAv = payload.avatar !== undefined ? String(payload.avatar || '') : String((srcPlayer && srcPlayer.avatar) || (srcReg && srcReg.avatar) || '');
          const avRes = validateImageUriLocal(rawAv, 480000);
          const cleanAvatar = avRes.ok ? avRes.value : '';

          const masterName = String((callerAdmObj && callerAdmObj.name) || adminTokenInfo.adminName || 'Szymon Komenda');
          const nowFmt = new Date().toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '.');

          const targetAdmIdx = prevDb.admins.findIndex((ad) => ad && (
            String(ad.id || '') === admId ||
            (String(ad.username || '').trim().toLowerCase() === rawUsername && String(ad.role || '') !== 'MASTER_ADMIN')
          ));

          let admRecord = {
            id: (targetAdmIdx >= 0 && prevDb.admins[targetAdmIdx].id) ? String(prevDb.admins[targetAdmIdx].id) : admId,
            name: cleanName,
            username: rawUsername,
            email: cleanEmail,
            fbLink: cleanFb,
            division,
            roleTitle,
            passwordHash: finalPassHash,
            role: 'CO_ADMIN',
            status: 'APPROVED',
            grantedDirectly: true,
            approvedBy: masterName,
            approvedAt: nowFmt,
            submittedAt: (targetAdmIdx >= 0 && prevDb.admins[targetAdmIdx].submittedAt) ? String(prevDb.admins[targetAdmIdx].submittedAt) : nowFmt,
            avatar: cleanAvatar
          };

          if (targetAdmIdx >= 0) {
            prevDb.admins[targetAdmIdx] = Object.assign({}, prevDb.admins[targetAdmIdx], admRecord);
            admRecord = prevDb.admins[targetAdmIdx];
          } else {
            prevDb.admins.push(admRecord);
          }

          let linkedPlayerId = null;
          if (linkPlayer && srcPlayerIdx >= 0) {
            prevDb.players[srcPlayerIdx].isAdminPlayer = true;
            prevDb.players[srcPlayerIdx].adminId = admRecord.id;
            prevDb.players[srcPlayerIdx].adminRole = 'CO_ADMIN';
            if (!Array.isArray(prevDb.players[srcPlayerIdx].notifications)) prevDb.players[srcPlayerIdx].notifications = [];
            prevDb.players[srcPlayerIdx].notifications.unshift({
              id: 'NOTIF_ADM_' + tsMs,
              time: nowFmt,
              text: `👑 Master Admin ${masterName} nadał Ci uprawnienia Administratora SMPL (login: ${rawUsername})!`
            });
            linkedPlayerId = String(prevDb.players[srcPlayerIdx].id);
          }

          if (!Array.isArray(prevDb.activityLog)) prevDb.activityLog = [];
          prevDb.activityLog.unshift({
            id: 'LOG_ADM_GRANT_' + tsMs + '_' + Math.floor(10 + Math.random() * 89),
            time: nowFmt,
            type: 'ADMIN_GRANT_DIRECT',
            text: `👑 Master Admin ${masterName} nadał uprawnienia Administratora ("TAK O") dla: ${cleanName} (@${rawUsername}, sekcja: ${division}).`
          });
          if (prevDb.activityLog.length > 120) prevDb.activityLog = prevDb.activityLog.slice(0, 120);

          prevDb.updatedAt = tsMs;
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(prevDb), 'utf8');
          return sendJson(res, 200, { ok: true, admin: admRecord, linkedPlayerId, updatedAt: tsMs, state: prevDb });
        }

        if (action === 'admin_manual_register') {
          let payload = {};
          try { payload = JSON.parse(body || '{}') || {}; } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format JSON formularza konta gracza.' });
          }
          const prevDb = readDbJson();
          const adminTokenInfo = validateAdminTokenHeader(req, prevDb, payload);
          if (!adminTokenInfo) {
            return sendJson(res, 403, { ok: false, error: 'Odmowa dostępu: ręczne tworzenie kont wymaga ważnej sesji Administratora.' });
          }
          if (!prevDb || !Array.isArray(prevDb.players)) {
            return sendJson(res, 400, { ok: false, error: 'Baza danych SMPL na serwerze jest pusta lub uszkodzona.' });
          }
          if (!Array.isArray(prevDb.registrations)) prevDb.registrations = [];
          if (!Array.isArray(prevDb.clans)) prevDb.clans = [];

          const cleanName = String(payload.name || '').trim().slice(0, 80);
          const cleanNick = String(payload.nick || '').trim().slice(0, 50);
          const cleanFb = String(payload.fbLink || '').trim().slice(0, 255) || 'https://m.me/smpl';
          const passHash = String(payload.passwordHash || '').trim();
          if (cleanName.length < 2) return sendJson(res, 400, { ok: false, error: 'Podaj imię i nazwisko lub pseudonim gracza (minimum 2 znaki).' });
          if (cleanNick.length < 2) return sendJson(res, 400, { ok: false, error: 'Podaj nick gracza w grze Score! Match (minimum 2 znaki).' });
          if (!/^smplh1\$[a-f0-9]{8,64}$/i.test(passHash)) return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format zabezpieczenia hasła startowego.' });

          let targetMode = String(payload.targetMode || 'LEAGUE').trim().toUpperCase();
          const leagueId = String(payload.leagueId || 'L2').trim().toUpperCase();
          if (leagueId === 'APPROVED_POOL' || leagueId === 'POOL') targetMode = 'POOL';
          if (targetMode !== 'POOL' && targetMode !== 'LEAGUE') {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy tryb docelowy konta (LEAGUE lub POOL).' });
          }
          if (targetMode === 'LEAGUE' && !/^L\d{1,2}$/.test(leagueId)) {
            return sendJson(res, 400, { ok: false, error: 'Wybierz prawidłową ligę docelową lub Pulę Graczy.' });
          }

          const avRes = validateImageUriLocal(payload.avatar || '', 480000);
          if (!avRes.ok) return sendJson(res, 400, { ok: false, error: 'Awatar: ' + avRes.error });

          const tsMs = Date.now();
          const reqIdRaw = String(payload.id || '').trim();
          const hasClientId = /^[A-Za-z0-9_-]{4,64}$/.test(reqIdRaw);
          const entityId = hasClientId ? reqIdRaw : ((targetMode === 'POOL' ? 'REG_MAN_' : (leagueId + '_P_')) + tsMs + '_' + crypto.randomBytes(3).toString('hex'));

          if (hasClientId) {
            const exPl = prevDb.players.find((pl) => pl && String(pl.id || '') === entityId);
            if (exPl) return sendJson(res, 200, { ok: true, idempotent: true, mode: 'LEAGUE', player: exPl, registration: null, clan: null, updatedAt: prevDb.updatedAt || tsMs, state: prevDb });
            const exRg = prevDb.registrations.find((rg) => rg && String(rg.id || '') === entityId);
            if (exRg) return sendJson(res, 200, { ok: true, idempotent: true, mode: 'POOL', player: null, registration: exRg, clan: null, updatedAt: prevDb.updatedAt || tsMs, state: prevDb });
          }

          const nameFold = foldPlCharsLocal(cleanName);
          const nickFold = foldPlCharsLocal(cleanNick);
          if (isOnBlacklistLocal(prevDb, nameFold, nickFold, cleanFb.toLowerCase())) {
            return sendJson(res, 403, { ok: false, error: '⛔ Gracz widnieje na Czarnej Liście Score Match Ligi z dożywotnim zakazem gry.' });
          }

          const dupPlayer = prevDb.players.find((pl) => pl && !pl.isPlaceholder && !pl.gdprDeleted && pl.nick && foldPlCharsLocal(pl.nick) === nickFold);
          if (dupPlayer) return sendJson(res, 400, { ok: false, error: `Nick @${cleanNick} jest już przypisany do istniejącego gracza.` });
          const dupReg = prevDb.registrations.find((rg) => rg && (rg.status === 'PENDING' || rg.status === 'APPROVED_POOL') && rg.nick && foldPlCharsLocal(rg.nick) === nickFold);
          if (dupReg) return sendJson(res, 400, { ok: false, error: `Konto z nickiem @${cleanNick} już istnieje w kolejce/puli rejestracji.` });

          const usedLogins = collectUsedLoginsLocal(prevDb, true);
          const explicitUser = String(payload.username || '').trim().toLowerCase();
          let cleanUser = '';
          if (explicitUser) {
            if (!/^[a-z0-9._-]{3,40}$/.test(explicitUser)) {
              return sendJson(res, 400, { ok: false, error: 'Login gracza musi mieć 3–40 znaków (małe litery, cyfry, kropka, myślnik lub podkreślnik).' });
            }
            if (usedLogins[explicitUser]) {
              return sendJson(res, 400, { ok: false, error: `Login "${explicitUser}" jest już zajęty. Wpisz inny login (np. z cyfrą).` });
            }
            cleanUser = explicitUser;
          } else {
            const baseUser = toCleanUsernameLocal(cleanName);
            cleanUser = baseUser;
            if (usedLogins[cleanUser]) {
              let sfx = 2;
              while (usedLogins[baseUser + '.' + sfx] && sfx < 999) sfx++;
              cleanUser = baseUser + '.' + sfx;
            }
          }

          const admName = String(adminTokenInfo.adminName || 'Admin');
          const nowFmt = new Date().toLocaleString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '.');
          const clanRes = resolveClanPayloadLocal(prevDb, payload, admName, tsMs, nowFmt);
          if (!clanRes.ok) return sendJson(res, 400, { ok: false, error: clanRes.error });

          const curSeason = Number(prevDb.season || 56);
          const linkedHist = String(payload.historicalArchiveName || '').trim().slice(0, 80);
          const cleanBio = String(payload.bio || '').replace(/\r\n|\r/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 280);
          const histStats = (payload.historicalStats && typeof payload.historicalStats === 'object' && !Array.isArray(payload.historicalStats)) ? payload.historicalStats : null;
          const inTrophies = Array.isArray(payload.trophies) ? payload.trophies.slice(0, 40) : [];

          let outPlayer = null;
          let outReg = null;

          if (targetMode === 'POOL') {
            const prefLgRaw = String(payload.preferredLeague || 'L2').trim().toUpperCase();
            const prefLg = /^L\d{1,2}$/.test(prefLgRaw) ? prefLgRaw : 'L2';
            outReg = {
              id: entityId,
              name: cleanName,
              nick: cleanNick,
              username: cleanUser,
              fbLink: cleanFb,
              preference: `Konto utworzone ręcznie (Pula — ${prefLg})`,
              preferredLeague: prefLg,
              passwordHash: passHash,
              acceptedRules: true,
              acceptedLegalGDPR: true,
              acceptedRulesVersion: 'SMPL-REG-2026.1',
              acceptedAt: nowFmt,
              status: 'APPROVED_POOL',
              submittedAt: nowFmt,
              reviewedBy: admName,
              reviewedAt: nowFmt,
              manualCreatedBy: admName,
              notes: `Konto założone ręcznie przez Administratora ${admName} (login i hasło gotowe).`,
              avatar: avRes.value,
              bio: cleanBio,
              playedBefore: linkedHist !== '',
              linkedHistoricalName: linkedHist,
              clanId: clanRes.clanId,
              clanName: clanRes.clanName,
              clanTag: clanRes.clanTag,
              clanLogo: clanRes.clanLogo
            };
            prevDb.registrations.unshift(outReg);
          } else {
            if (!prevDb.leagues || typeof prevDb.leagues !== 'object') prevDb.leagues = {};
            if (!prevDb.leagues[leagueId]) {
              prevDb.leagues[leagueId] = { id: leagueId, name: `${leagueId} Liga SMPL`, shortName: leagueId, enabled: true, totalRounds: 15 };
            }
            const phIdx = prevDb.players.findIndex((pl) => pl && String(pl.leagueId || '') === leagueId && pl.active !== false && (pl.isPlaceholder || /^wolny los/i.test(String(pl.name || ''))));
            if (phIdx >= 0) {
              const oldPhName = String(prevDb.players[phIdx].name || 'WOLNY LOS');
              prevDb.players[phIdx].name = cleanName;
              prevDb.players[phIdx].nick = cleanNick;
              prevDb.players[phIdx].username = cleanUser;
              prevDb.players[phIdx].passwordHash = passHash;
              delete prevDb.players[phIdx].password;
              prevDb.players[phIdx].fb = cleanFb;
              prevDb.players[phIdx].fbLink = cleanFb;
              prevDb.players[phIdx].clanId = clanRes.clanId;
              prevDb.players[phIdx].clanName = clanRes.clanName;
              prevDb.players[phIdx].clanTag = clanRes.clanTag;
              prevDb.players[phIdx].clanLogo = clanRes.clanLogo;
              prevDb.players[phIdx].isPlaceholder = false;
              prevDb.players[phIdx].replacedPlaceholderName = oldPhName;
              prevDb.players[phIdx].avatar = avRes.value;
              prevDb.players[phIdx].bio = cleanBio;
              prevDb.players[phIdx].joinedSeason = curSeason;
              prevDb.players[phIdx].manualCreatedBy = admName;
              if (linkedHist) {
                prevDb.players[phIdx].historicalArchiveName = linkedHist;
                prevDb.players[phIdx].playedBefore = true;
              }
              if (histStats) prevDb.players[phIdx].historicalStats = histStats;
              if (inTrophies.length > 0) prevDb.players[phIdx].trophies = inTrophies;
              outPlayer = prevDb.players[phIdx];
            } else {
              const lgCount = prevDb.players.filter((pl) => pl && String(pl.leagueId || '') === leagueId).length;
              outPlayer = {
                id: entityId,
                name: cleanName,
                nick: cleanNick,
                username: cleanUser,
                passwordHash: passHash,
                fb: cleanFb,
                fbLink: cleanFb,
                leagueId,
                excelOrder: lgCount + 1,
                isPlaceholder: false,
                clanId: clanRes.clanId,
                clanName: clanRes.clanName,
                clanTag: clanRes.clanTag,
                clanLogo: clanRes.clanLogo,
                avatar: avRes.value,
                bio: cleanBio,
                penaltyPoints: 0,
                penaltyReason: '',
                joinedSeason: curSeason,
                manualCreatedBy: admName,
                active: true,
                trophies: inTrophies.length > 0 ? inTrophies : [{
                  id: 'tr_add_' + tsMs,
                  icon: '⚽',
                  title: `Zawodnik Score Match Ligi (${leagueId})`,
                  season: `Sezon ${curSeason}`,
                  rarity: 'SILVER'
                }],
                notifications: [{
                  id: 'NOTIF_MAN_' + tsMs,
                  time: nowFmt,
                  text: `✍️ Admin ${admName} utworzył Twoje konto i dopisał Cię do ${leagueId} (login: ${cleanUser}).`
                }]
              };
              if (linkedHist) {
                outPlayer.historicalArchiveName = linkedHist;
                outPlayer.playedBefore = true;
              }
              if (histStats) outPlayer.historicalStats = histStats;
              prevDb.players.push(outPlayer);
            }
          }

          if (!Array.isArray(prevDb.activityLog)) prevDb.activityLog = [];
          const destLabel = targetMode === 'POOL' ? 'Pula Aktywnych Kont (APPROVED_POOL)' : (`liga ${leagueId}`);
          prevDb.activityLog.unshift({
            id: 'LOG_MAN_REG_' + tsMs + '_' + Math.floor(10 + Math.random() * 89),
            time: nowFmt,
            type: 'ADMIN_MANUAL_REGISTER',
            text: `✍️ Admin ${admName} utworzył ręcznie konto gracza ${cleanName} (@${cleanNick}, login: ${cleanUser}) -> ${destLabel}.`
          });
          if (prevDb.activityLog.length > 120) prevDb.activityLog = prevDb.activityLog.slice(0, 120);

          prevDb.updatedAt = tsMs;
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(prevDb), 'utf8');
          return sendJson(res, 200, { ok: true, mode: targetMode, player: outPlayer, registration: outReg, clan: clanRes.createdClan, updatedAt: tsMs, state: prevDb });
        }

        if (action === 'admin_set_season_window') {
          let payload = {};
          try { payload = JSON.parse(body || '{}') || {}; } catch (e) { payload = {}; }
          const prevDb = readDbJson();
          const adminTokenInfo = validateAdminTokenHeader(req, prevDb, payload);
          if (!adminTokenInfo) {
            return sendJson(res, 401, {
              ok: false,
              code: 'ADMIN_TOKEN_EXPIRED',
              error: 'Sesja Administratora na serwerze wygasła lub brak tokena (X-SMPL-Admin-Token). Zaloguj się ponownie hasłem Admina i kliknij jeszcze raz.'
            });
          }
          if (!prevDb || !Array.isArray(prevDb.players)) {
            return sendJson(res, 400, { ok: false, error: 'Baza danych SMPL na serwerze jest pusta lub uszkodzona.' });
          }
          if (!prevDb.portalSettings || typeof prevDb.portalSettings !== 'object') {
            prevDb.portalSettings = {};
          }
          const isOpen = Boolean(payload.seasonJoinOpen || payload.isOpen);
          const phase = payload.seasonWindowPhase && String(payload.seasonWindowPhase).trim()
            ? String(payload.seasonWindowPhase).trim()
            : (isOpen ? 'OPEN' : 'ENDED');
          const admName = String(adminTokenInfo.adminName || 'Administrator');
          const nowFmt = new Date().toISOString().slice(0, 16).replace('T', ' ');
          const tsMs = Date.now();

          prevDb.portalSettings.seasonJoinOpen = isOpen;
          prevDb.portalSettings.seasonWindowPhase = phase;
          prevDb.portalSettings.seasonJoinUpdatedBy = admName;
          prevDb.portalSettings.seasonJoinUpdatedAt = nowFmt;
          if (Array.isArray(payload.allowedLeagues)) {
            prevDb.portalSettings.seasonJoinAllowedLeagues = payload.allowedLeagues
              .map((lg) => String(lg || '').trim().toUpperCase())
              .filter((lg) => /^L\d{1,2}$/.test(lg));
          } else if (!Array.isArray(prevDb.portalSettings.seasonJoinAllowedLeagues)) {
            prevDb.portalSettings.seasonJoinAllowedLeagues = [];
          }
          if (!Array.isArray(prevDb.activityLog)) prevDb.activityLog = [];
          prevDb.activityLog.unshift({
            id: 'LOG_WIN_' + tsMs + '_' + Math.floor(10 + Math.random() * 89),
            time: nowFmt,
            type: isOpen ? 'SEASON_WINDOW_OPEN' : 'SEASON_WINDOW_CLOSE',
            text: isOpen
              ? `🟢 Admin ${admName} zatwierdził POCZĄTEK SEZONU — przyciski [Dołącz do ligi / Opuść ligę] są OTWARTE dla graczy.`
              : `🔴 Admin ${admName} zatwierdził KONIEC / ZAMKNIĘCIE okna zapisów — dołączanie/opuszczanie dla graczy zostało ZABLOKOWANE.`
          });
          if (prevDb.activityLog.length > 120) prevDb.activityLog = prevDb.activityLog.slice(0, 120);
          prevDb.updatedAt = tsMs;
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(prevDb), 'utf8');
          return sendJson(res, 200, {
            ok: true,
            seasonJoinOpen: isOpen,
            seasonWindowPhase: phase,
            portalSettings: prevDb.portalSettings,
            updatedAt: tsMs,
            state: prevDb
          });
        }

        if (action === 'admin_set_maintenance') {
          let payload = {};
          try { payload = JSON.parse(body || '{}') || {}; } catch (e) { payload = {}; }
          const prevDb = readDbJson();
          const adminTokenInfo = validateAdminTokenHeader(req, prevDb, payload);
          if (!adminTokenInfo) {
            return sendJson(res, 401, {
              ok: false,
              code: 'ADMIN_TOKEN_EXPIRED',
              error: 'Sesja Administratora na serwerze wygasła lub brak tokena (X-SMPL-Admin-Token). Zaloguj się ponownie hasłem Admina.'
            });
          }
          if (!prevDb || !Array.isArray(prevDb.players)) {
            return sendJson(res, 400, { ok: false, error: 'Baza danych SMPL na serwerze jest pusta lub uszkodzona.' });
          }
          if (!prevDb.portalSettings || typeof prevDb.portalSettings !== 'object') prevDb.portalSettings = {};
          const prevMaint = (prevDb.portalSettings.maintenanceMode && typeof prevDb.portalSettings.maintenanceMode === 'object')
            ? prevDb.portalSettings.maintenanceMode : {};
          const enabled = Boolean(payload.enabled);
          const cleanMsg = String(Object.prototype.hasOwnProperty.call(payload, 'message') ? (payload.message || '') : (prevMaint.message || ''))
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 400)
            || 'Trwają prace techniczne na portalu Score Match Liga. Wracamy za chwilę!';
          const admName = String(adminTokenInfo.adminName || 'Szymon Komenda');
          const nowFmt = new Date().toISOString().slice(0, 16).replace('T', ' ');
          const tsMs = Date.now();
          prevDb.portalSettings.maintenanceMode = {
            enabled,
            message: cleanMsg,
            updatedBy: admName,
            updatedAt: nowFmt
          };
          prevDb.updatedAt = tsMs;
          const logItem = {
            id: 'LOG_MAINT_' + tsMs + '_' + Math.floor(10 + Math.random() * 89),
            time: nowFmt,
            type: enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED',
            text: enabled
              ? `🔧 Admin ${admName} WŁĄCZYŁ tryb Przerwy Technicznej.`
              : `🟢 Admin ${admName} WYŁĄCZYŁ tryb Przerwy Technicznej — portal jest w pełni aktywny.`
          };
          if (!Array.isArray(prevDb.activityLog)) prevDb.activityLog = [];
          prevDb.activityLog.unshift(logItem);
          if (prevDb.activityLog.length > 120) prevDb.activityLog = prevDb.activityLog.slice(0, 120);
          if (!Array.isArray(prevDb.logs)) prevDb.logs = [];
          prevDb.logs.unshift(logItem);
          if (prevDb.logs.length > 300) prevDb.logs = prevDb.logs.slice(0, 300);
          const enc = JSON.stringify(prevDb);
          fs.writeFileSync(DB_FILE, enc, 'utf8');
          try { fs.writeFileSync(BACKUP_FILE, enc, 'utf8'); } catch (e) {}
          return sendJson(res, 200, {
            ok: true,
            maintenanceMode: prevDb.portalSettings.maintenanceMode,
            updatedAt: tsMs,
            state: prevDb
          });
        }

        if (action === 'admin_approve_pool') {
          let payload = {};
          try { payload = JSON.parse(body || '{}') || {}; } catch (e) { payload = {}; }
          const prevDb = readDbJson();
          const adminTokenInfo = validateAdminTokenHeader(req, prevDb, payload);
          if (!adminTokenInfo) {
            return sendJson(res, 401, {
              ok: false,
              code: 'ADMIN_TOKEN_EXPIRED',
              error: 'Sesja Administratora na serwerze wygasła lub brak tokena. Zaloguj się ponownie hasłem Admina.'
            });
          }
          if (!prevDb || !Array.isArray(prevDb.players)) {
            return sendJson(res, 400, { ok: false, error: 'Baza danych SMPL na serwerze jest pusta lub uszkodzona.' });
          }
          if (!Array.isArray(prevDb.registrations)) prevDb.registrations = [];
          const approveAll = Boolean(payload.approveAllPending);
          const regId = String(payload.regId || '').trim();
          if (!approveAll && !regId) {
            return sendJson(res, 400, { ok: false, error: 'Brak identyfikatora zgłoszenia do zatwierdzenia.' });
          }
          const admName = String(adminTokenInfo.adminName || 'Administrator');
          const nowFmt = new Date().toISOString().slice(0, 16).replace('T', ' ');
          const tsMs = Date.now();
          const approvedList = [];
          let singleRegOut = null;

          if (approveAll) {
            prevDb.registrations.forEach((rg) => {
              if (!rg || rg.status !== 'PENDING') return;
              if (typeof isBlacklistedMatchLocal === 'function' && isBlacklistedMatchLocal(prevDb, rg.name, rg.nick, rg.fbLink)) return;
              rg.status = 'APPROVED_POOL';
              rg.reviewedBy = admName;
              rg.reviewedAt = nowFmt;
              approvedList.push(rg);
            });
          } else {
            const targetReg = prevDb.registrations.find((rg) => rg && String(rg.id) === regId);
            if (!targetReg) {
              return sendJson(res, 404, { ok: false, error: 'Nie znaleziono zgłoszenia rekrutacyjnego na serwerze.' });
            }
            if (targetReg.status !== 'APPROVED_POOL') {
              targetReg.status = 'APPROVED_POOL';
              targetReg.reviewedBy = admName;
              targetReg.reviewedAt = nowFmt;
            }
            singleRegOut = targetReg;
            approvedList.push(targetReg);
          }

          if (!Array.isArray(prevDb.activityLog)) prevDb.activityLog = [];
          if (approveAll) {
            prevDb.activityLog.unshift({
              id: 'LOG_POOL_ALL_' + tsMs + '_' + Math.floor(10 + Math.random() * 89),
              time: nowFmt,
              type: 'REG_APPROVED_POOL',
              text: `✅ Admin ${admName} zatwierdził oczekujące konta (${approvedList.length}) do Puli Graczy — mogą teraz kliknąć [Dołącz do ligi].`
            });
          } else if (singleRegOut) {
            prevDb.activityLog.unshift({
              id: 'LOG_POOL_' + tsMs + '_' + Math.floor(10 + Math.random() * 89),
              time: nowFmt,
              type: 'REG_APPROVED_POOL',
              text: `✅ Admin ${admName} zatwierdził konto gracza ${singleRegOut.name} (@${singleRegOut.nick}) do puli — gracz może kliknąć [Dołącz do ligi].`
            });
          }
          if (prevDb.activityLog.length > 120) prevDb.activityLog = prevDb.activityLog.slice(0, 120);
          prevDb.updatedAt = tsMs;
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(prevDb), 'utf8');
          return sendJson(res, 200, {
            ok: true,
            approvedCount: approvedList.length,
            registration: singleRegOut,
            registrations: prevDb.registrations,
            updatedAt: tsMs,
            state: prevDb
          });
        }

        if (action === 'player_profile_update') {
          const db = readDbJson();
          if (!db || !Array.isArray(db.players)) {
            return sendJson(res, 400, { ok: false, error: 'Brak prawidłowej bazy danych SMPL na serwerze.' });
          }
          const admInfo = validateAdminTokenHeader(req, db);
          const pAuth = !admInfo ? validatePlayerTokenHeader(req) : null;
          if (!admInfo && !pAuth) {
            return sendJson(res, 401, { ok: false, error: 'Wymagane uwierzytelnienie konta (X-SMPL-Player-Token lub X-SMPL-Admin-Token).' });
          }
          let payload = {};
          try { payload = JSON.parse(body || '{}') || {}; } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format JSON danych profilu.' });
          }
          const hasAvatar = Object.prototype.hasOwnProperty.call(payload, 'avatar');
          const hasBio = Object.prototype.hasOwnProperty.call(payload, 'bio');
          const hasVacation = Object.prototype.hasOwnProperty.call(payload, 'vacation') && payload.vacation && typeof payload.vacation === 'object';
          if (!hasAvatar && !hasBio && !hasVacation) {
            return sendJson(res, 400, { ok: false, error: 'Przekaż pole avatar, bio lub vacation do aktualizacji.' });
          }

          let cleanAvatar = '';
          if (hasAvatar) {
            const rawAv = String(payload.avatar == null ? '' : payload.avatar).trim();
            if (rawAv === '') {
              cleanAvatar = '';
            } else if (/^https?:\/\/[^\s"'<>]{4,1020}$/i.test(rawAv)) {
              cleanAvatar = rawAv;
            } else if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(rawAv) && rawAv.length <= 480000) {
              cleanAvatar = rawAv;
            } else if (/^data:image\/svg\+xml(;charset=utf-8|;utf8)?,/i.test(rawAv) && rawAv.length <= 45000) {
              const svgBody = decodeURIComponent(rawAv.replace(/^data:image\/svg\+xml[^,]*,/i, ''));
              if (/<\s*script|javascript:|on[a-z]+\s*=|<\s*foreignObject/i.test(svgBody)) {
                return sendJson(res, 400, { ok: false, error: 'Niedozwolona zawartość SVG awatara.' });
              }
              cleanAvatar = rawAv;
            } else if (/^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/i.test(rawAv) && rawAv.length <= 45000) {
              const m = rawAv.match(/^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/i);
              const svgBody = m ? Buffer.from(m[1], 'base64').toString('utf8') : '';
              if (!svgBody || /<\s*script|javascript:|on[a-z]+\s*=|<\s*foreignObject/i.test(svgBody)) {
                return sendJson(res, 400, { ok: false, error: 'Niedozwolona zawartość SVG awatara.' });
              }
              cleanAvatar = rawAv;
            } else {
              return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format lub zbyt duży rozmiar awatara (max 450 KB, PNG/JPG/WebP/SVG lub HTTPS).' });
            }
          }

          let cleanBio = '';
          if (hasBio) {
            cleanBio = String(payload.bio == null ? '' : payload.bio)
              .replace(/\r\n?/g, '\n')
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
              .trim()
              .slice(0, 280);
          }

          const cleanVacation = hasVacation ? sanitizeVacationLocal(payload.vacation) : null;

          const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
          const requestedTargetId = String(payload.targetPlayerId || '').trim();
          let targetKind = '';
          let targetId = '';
          let actorName = 'Zawodnik';
          let finalAvatar = '';
          let finalBio = '';
          let finalVacation = null;

          if (!admInfo && pAuth) {
            const subId = String(pAuth.info.subjectId || '');
            if (requestedTargetId && requestedTargetId !== subId) {
              return sendJson(res, 403, { ok: false, error: 'Odmowa dostępu: możesz edytować wyłącznie własny profil, awatar i Bio.' });
            }
            const pl = db.players.find((p) => p && String(p.id) === subId);
            if (pl) {
              if (pl.isBlacklisted || pl.banned || pl.customRank === 'BLACKLISTED') {
                return sendJson(res, 403, { ok: false, error: 'Konto znajduje się na Czarnej Liście SMPL.' });
              }
              if (hasAvatar) pl.avatar = cleanAvatar;
              if (hasBio) pl.bio = cleanBio;
              if (hasVacation) pl.vacation = cleanVacation;
              pl.profileUpdatedAt = nowStr;
              targetKind = 'PLAYER';
              targetId = String(pl.id);
              actorName = String(pl.name || 'Zawodnik');
              finalAvatar = String(pl.avatar || '');
              finalBio = String(pl.bio || '');
              finalVacation = pl.vacation || null;
            } else {
              const regs = Array.isArray(db.registrations) ? db.registrations : [];
              const regObj = regs.find((r) => r && String(r.id) === subId);
              if (!regObj) {
                return sendJson(res, 404, { ok: false, error: 'Nie znaleziono konta zawodnika w bazie.' });
              }
              if (hasAvatar) regObj.avatar = cleanAvatar;
              if (hasBio) regObj.bio = cleanBio;
              if (hasVacation) regObj.vacation = cleanVacation;
              regObj.profileUpdatedAt = nowStr;
              if (regObj.assignedPlayerId) {
                const linkedPl = db.players.find((p) => p && String(p.id) === String(regObj.assignedPlayerId));
                if (linkedPl) {
                  if (hasAvatar) linkedPl.avatar = cleanAvatar;
                  if (hasBio) linkedPl.bio = cleanBio;
                  if (hasVacation) linkedPl.vacation = cleanVacation;
                  linkedPl.profileUpdatedAt = nowStr;
                }
              }
              targetKind = 'REG';
              targetId = String(regObj.id);
              actorName = String(regObj.name || 'Zawodnik');
              finalAvatar = String(regObj.avatar || '');
              finalBio = String(regObj.bio || '');
              finalVacation = regObj.vacation || null;
            }
          } else if (admInfo) {
            const admId = String(admInfo.adminId || '');
            const adminsArr = Array.isArray(db.admins) ? db.admins : [];
            const admObj = adminsArr.find((a) => a && String(a.id) === admId) || null;
            const admNameLow = admObj && admObj.name ? String(admObj.name).trim().toLowerCase() : '';
            const admUserLow = admObj && admObj.username ? String(admObj.username).trim().toLowerCase() : '';
            const pl = requestedTargetId
              ? db.players.find((p) => p && !p.isPlaceholder && !p.gdprDeleted && String(p.id) === requestedTargetId)
              : (db.players.find((p) => {
                  if (!p || p.isPlaceholder || p.gdprDeleted || p.active === false) return false;
                  const pUserLow = p.username ? String(p.username).trim().toLowerCase() : '';
                  const pNameLow = p.name ? String(p.name).trim().toLowerCase() : '';
                  return (admId && String(p.adminId || '') === admId) || (admUserLow && pUserLow === admUserLow) || (admNameLow && pNameLow === admNameLow);
                }) || db.players.find((p) => {
                  if (!p || p.isPlaceholder || p.gdprDeleted) return false;
                  const pUserLow = p.username ? String(p.username).trim().toLowerCase() : '';
                  const pNameLow = p.name ? String(p.name).trim().toLowerCase() : '';
                  return (admId && String(p.adminId || '') === admId) || (admUserLow && pUserLow === admUserLow) || (admNameLow && pNameLow === admNameLow);
                }));
            if (admObj && (!requestedTargetId || (pl && String(pl.adminId || '') === admId))) {
              if (hasAvatar) admObj.avatar = cleanAvatar;
              if (hasBio) admObj.bio = cleanBio;
              if (hasVacation) admObj.vacation = cleanVacation;
              admObj.profileUpdatedAt = nowStr;
              targetKind = 'ADMIN';
              targetId = admId;
              actorName = String(admObj.name || 'Admin');
              finalAvatar = String(admObj.avatar || '');
              finalBio = String(admObj.bio || '');
              finalVacation = admObj.vacation || null;
            }
            if (pl) {
              if (hasAvatar) pl.avatar = cleanAvatar;
              if (hasBio) pl.bio = cleanBio;
              if (hasVacation) pl.vacation = cleanVacation;
              pl.profileUpdatedAt = nowStr;
              targetKind = 'PLAYER';
              targetId = String(pl.id);
              actorName = String(pl.name || actorName);
              finalAvatar = String(pl.avatar || finalAvatar);
              finalBio = String(pl.bio || finalBio);
              finalVacation = pl.vacation || finalVacation;
            } else if (!admObj) {
              return sendJson(res, 404, { ok: false, error: 'Nie znaleziono docelowego profilu do edycji.' });
            }
          }

          db.updatedAt = Date.now();
          if (!Array.isArray(db.logs)) db.logs = [];
          db.logs.unshift({
            id: 'LOG_PROF_' + Date.now(),
            time: nowStr,
            type: 'PLAYER_PROFILE_UPDATE',
            text: `🎨 ${actorName} zaktualizował swój awatar / Bio profilu.`
          });
          if (db.logs.length > 300) db.logs = db.logs.slice(0, 300);
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf8');
          return sendJson(res, 200, {
            ok: true,
            targetKind,
            targetId,
            avatar: finalAvatar,
            bio: finalBio,
            vacation: finalVacation,
            updatedAt: nowStr,
            state: db
          });
        }

        if (action === 'competition_action') {
          const db = readDbJson();
          if (!db || !Array.isArray(db.players)) {
            return sendJson(res, 400, { ok: false, error: 'Brak prawidłowej bazy danych SMPL na serwerze.' });
          }
          const prevDbSnapForPush = JSON.parse(JSON.stringify(db));
          let payload = {};
          try { payload = JSON.parse(body || '{}'); } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format JSON danych konkursu.' });
          }
          const adm = validateAdminTokenHeader(req, db, payload);
          const pAuth = !adm ? validatePlayerTokenHeader(req, payload) : null;
          if (!adm && !pAuth) {
            return sendJson(res, 401, { ok: false, error: 'Zaloguj się jako Zawodnik lub Administrator, aby wziąć udział w konkursie.' });
          }

          let actorId = '';
          let actorPlayerId = '';
          let actorName = 'Zawodnik';
          let actorNick = '';
          const isAdmActor = Boolean(adm);

          if (isAdmActor) {
            const admId = String(adm.adminId || 'ADM');
            actorId = 'ADM_' + admId;
            actorName = String(adm.name || 'Administrator');
            const admNameLow = actorName.trim().toLowerCase();
            const admUserLow = String(adm.username || '').trim().toLowerCase();
            const linked =
              db.players.find((p) => p && !p.isPlaceholder && !p.gdprDeleted && String(p.adminId || '') === admId) ||
              db.players.find((p) => p && !p.isPlaceholder && !p.gdprDeleted && (
                (admUserLow && String(p.username || '').trim().toLowerCase() === admUserLow) ||
                (admNameLow && String(p.name || '').trim().toLowerCase() === admNameLow)
              ));
            if (linked) {
              actorPlayerId = String(linked.id);
              actorNick = String(linked.nick || '');
            }
          } else {
            const subKind = String(pAuth.info.subjectKind || 'PLAYER');
            const subId = String(pAuth.info.subjectId || '');
            const matchedP = db.players.find((p) => p && String(p.id) === subId);
            if (matchedP) {
              if (matchedP.isBlacklisted || matchedP.banned || matchedP.customRank === 'BLACKLISTED') {
                return sendJson(res, 403, { ok: false, error: 'Konto znajduje się na Czarnej Liście SMPL.' });
              }
              actorId = 'PLR_' + subId;
              actorPlayerId = subId;
              actorName = String(matchedP.name || 'Zawodnik');
              actorNick = String(matchedP.nick || '');
            } else if (subKind === 'REG' && Array.isArray(db.registrations)) {
              const matchedR = db.registrations.find((r) => r && String(r.id) === subId);
              if (!matchedR) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono konta zawodnika.' });
              actorId = 'REG_' + subId;
              actorName = String(matchedR.name || 'Zawodnik');
              actorNick = String(matchedR.nick || '');
            } else {
              return sendJson(res, 404, { ok: false, error: 'Nie znaleziono profilu zawodnika.' });
            }
          }

          const sNum = Number(db.season || 56);
          if (!db.competitions || typeof db.competitions !== 'object') {
            db.competitions = {
              season: sNum,
              cup: { id: 'CUP_S' + sNum, name: 'Puchar Ligi SMPL', size: 8, status: 'NOT_STARTED', rounds: [], winnerPlayerId: null },
              typerOpen: true,
              typerPredictions: [],
              puskasOpen: true,
              puskasWinnerNominationId: null,
              puskasNominations: [],
              awardedHonors: {}
            };
          }

          const op = String(payload.op || '').trim().toLowerCase();

          const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
          let logText = '';

          if (op === 'typer_predict') {
            if (db.competitions.typerOpen === false && !isAdmActor) {
              return sendJson(res, 403, { ok: false, error: 'Typer Kolejki jest obecnie zamknięty przez Administrację.' });
            }
            const matchId = String(payload.matchId || '').trim();
            const ph = Number(payload.predHome);
            const pa = Number(payload.predAway);
            if (!matchId || !Number.isInteger(ph) || !Number.isInteger(pa) || ph < 0 || ph > 2 || pa < 0 || pa > 2 || (ph === 2 && pa === 2)) {
              return sendJson(res, 400, { ok: false, error: 'Podaj poprawny wynik typu do max 2 bramek (0–2, bez 2:2) oraz ID meczu.' });
            }
            const targetMatch = (db.matches || []).find((m) => m && String(m.id) === matchId);
            if (!targetMatch) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono meczu do wytypowania.' });
            if (String(targetMatch.status || '') !== 'SCHEDULED') {
              return sendJson(res, 400, { ok: false, error: 'Mecz został już rozegrany lub oczekuje na weryfikację — typowanie zamknięte.' });
            }
            if (!Array.isArray(db.competitions.typerPredictions)) db.competitions.typerPredictions = [];
            const ex = db.competitions.typerPredictions.find((pr) => pr && String(pr.matchId) === matchId && String(pr.voterId) === actorId);
            if (ex) {
              ex.predHome = ph;
              ex.predAway = pa;
              ex.updatedAt = nowStr;
            } else {
              db.competitions.typerPredictions.push({
                id: 'TYP_' + Date.now() + '_' + Math.floor(Math.random() * 900 + 100),
                matchId,
                voterId: actorId,
                voterPlayerId: actorPlayerId || null,
                voterName: actorName,
                voterNick: actorNick,
                predHome: ph,
                predAway: pa,
                createdAt: nowStr,
                updatedAt: nowStr
              });
            }
            logText = `🔮 ${actorName} zapisał typ w Typerze Kolejki (${ph}:${pa}).`;
          } else if (op === 'puskas_nominate') {
            if (db.competitions.puskasOpen === false && !isAdmActor) {
              return sendJson(res, 403, { ok: false, error: 'Zgłoszenia do Nagrody Puskása są obecnie zamknięte.' });
            }
            const nomPlrId = String(payload.playerId || '').trim();
            const nomMatchId = String(payload.matchId || '').trim();
            const title = String(payload.title || '').replace(/<[^>]*>/g, '').trim().slice(0, 100);
            const desc = String(payload.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 240);
            const clipUrl = String(payload.clipUrl || '').trim();
            if (!nomPlrId || title.length < 4) {
              return sendJson(res, 400, { ok: false, error: 'Wybierz strzelca bramki oraz wpisz tytuł gola (min. 4 znaki).' });
            }
            if (clipUrl && !/^https?:\/\/[^\s"'<>]{4,500}$/i.test(clipUrl)) {
              return sendJson(res, 400, { ok: false, error: 'Link do powtórki musi zaczynać się od https:// lub http://.' });
            }
            const scorer = db.players.find((p) => p && String(p.id) === nomPlrId);
            if (!scorer) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono wskazanego zawodnika.' });
            if (!Array.isArray(db.competitions.puskasNominations)) db.competitions.puskasNominations = [];
            if (db.competitions.puskasNominations.length >= 60) {
              return sendJson(res, 400, { ok: false, error: 'Osiągnięto limit 60 nominacji do Nagrody Puskása.' });
            }
            db.competitions.puskasNominations.push({
              id: 'PUS_' + Date.now() + '_' + Math.floor(Math.random() * 900 + 100),
              playerId: String(scorer.id),
              playerName: String(scorer.name || 'Zawodnik'),
              nick: String(scorer.nick || ''),
              leagueId: String(scorer.leagueId || 'L1'),
              matchId: nomMatchId,
              title,
              description: desc,
              clipUrl,
              nominatedById: actorId,
              nominatedByName: actorName,
              votes: [],
              createdAt: nowStr
            });
            logText = `🥅 ${actorName} nominował bramkę gracza ${scorer.name} do Nagrody Puskása!`;
          } else if (op === 'puskas_vote') {
            if (db.competitions.puskasOpen === false && !isAdmActor) {
              return sendJson(res, 403, { ok: false, error: 'Głosowanie w Nagrodzie Puskása jest obecnie zamknięte.' });
            }
            const nomId = String(payload.nominationId || '').trim();
            const noms = Array.isArray(db.competitions.puskasNominations) ? db.competitions.puskasNominations : [];
            const targetNom = noms.find((n) => n && String(n.id) === nomId);
            if (!targetNom) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono nominacji do Nagrody Puskása.' });
            if (!isAdmActor && actorPlayerId && String(targetNom.playerId) === actorPlayerId) {
              return sendJson(res, 403, { ok: false, error: 'Nie możesz głosować na własną bramkę w Nagrodzie Puskása!' });
            }
            if (!Array.isArray(targetNom.votes)) targetNom.votes = [];
            const idx = targetNom.votes.indexOf(actorId);
            if (idx >= 0) targetNom.votes.splice(idx, 1);
            else targetNom.votes.push(actorId);
            logText = `⚽🔥 ${actorName} oddał/zmienił głos w Nagrodzie Puskása.`;
          } else if (op === 'golden_ball_vote') {
            if (!db.goldenBall || typeof db.goldenBall !== 'object') {
              db.goldenBall = { season: sNum, isOpen: true, winnerPlayerId: null, votes: [] };
            }
            if (!Array.isArray(db.goldenBall.votes)) db.goldenBall.votes = [];
            if (db.goldenBall.isOpen === false && !isAdmActor) {
              return sendJson(res, 403, { ok: false, error: 'Głosowanie w plebiscycie Złota Piłka jest aktualnie zamknięte.' });
            }
            const candidateId = String(payload.candidateId || '').trim();
            const cand = db.players.find((p) => {
              if (!p || String(p.id) !== candidateId) return false;
              const active = p.active !== false;
              const isBl = Boolean(p.isBlacklisted || p.banned || p.customRank === 'BLACKLISTED');
              const hasDiv = Boolean(p.leagueId && String(p.leagueId) !== '' && String(p.leagueId) !== 'POOL');
              return active && !p.isPlaceholder && !p.gdprDeleted && !isBl && hasDiv;
            });
            if (!cand) {
              return sendJson(res, 404, { ok: false, error: 'Nie znaleziono wybranego kandydata do Złotej Piłki.' });
            }
            const candName = String(cand.name || '');
            const actorFold = foldPlCharsLocal(actorName);
            const candFold = foldPlCharsLocal(candName);
            if ((actorPlayerId && candidateId === actorPlayerId) ||
                (!isAdmActor && !actorPlayerId && actorFold && actorFold === candFold)) {
              return sendJson(res, 403, { ok: false, error: '⛔ Nie możesz głosować na samego siebie w plebiscycie Złota Piłka!' });
            }
            const actIdFold = foldPlCharsLocal(actorId);
            const actPlrFold = foldPlCharsLocal(actorPlayerId);
            const alreadyVoted = db.goldenBall.votes.some((exV) => {
              if (!exV || typeof exV !== 'object') return false;
              const exVid = foldPlCharsLocal(exV.voterId || '');
              const exPlr = foldPlCharsLocal(exV.voterPlayerId || '');
              const exName = foldPlCharsLocal(exV.voterName || '');
              if (exVid && exVid === actIdFold) return true;
              if (actPlrFold && (exPlr === actPlrFold || exVid === ('plr_' + actPlrFold))) return true;
              if (!exVid && !exPlr && actorFold && exName === actorFold) return true;
              return false;
            });
            if (alreadyVoted) {
              return sendJson(res, 409, { ok: false, error: '⛔ Już oddałeś swój jedyny głos w tej edycji Złotej Piłki (zasada: 1 gracz = 1 głos).' });
            }
            const rawCmt = String(payload.comment || '').replace(/<[^>]*>/g, '').trim();
            const cleanCmt = (rawCmt || 'Zasłużony głos za formę w Lidze!').slice(0, 240);
            db.goldenBall.votes.push({
              id: 'GB_V_' + Date.now() + '_' + Math.floor(10 + Math.random() * 89),
              voterId: actorId,
              voterPlayerId: actorPlayerId || null,
              voterName: actorName,
              voterNick: actorNick,
              candidateId,
              candidateName: candName,
              points: 1,
              comment: cleanCmt,
              createdAt: nowStr
            });
            logText = `🏆 ${actorName} oddał swój jedyny głos (1/1) w Złotej Piłce na: ${candName}!`;
          } else if (op === 'match_propose') {
            const matchId = String(payload.matchId || '').trim();
            const slots = (Array.isArray(payload.slots) ? payload.slots : []).map((s) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 60)).filter(Boolean).slice(0, 4);
            const note = String(payload.note || '').replace(/<[^>]*>/g, '').trim().slice(0, 180);
            const targetMatch = (db.matches || []).find((m) => m && String(m.id) === matchId);
            if (!targetMatch) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono meczu.' });
            const hId = String(targetMatch.homeId || ''); const aId = String(targetMatch.awayId || '');
            if (!isAdmActor && actorPlayerId !== hId && actorPlayerId !== aId) return sendJson(res, 403, { ok: false, error: 'Tylko uczestnicy tego meczu lub Admin mogą proponować termin.' });
            if (!slots.length) return sendJson(res, 400, { ok: false, error: 'Podaj co najmniej jeden proponowany termin meczu.' });
            const oppId = actorPlayerId === hId ? aId : hId;
            if (!Array.isArray(db.competitions.matchProposals)) db.competitions.matchProposals = [];
            const propId = 'PROP_' + Date.now() + '_' + Math.floor(10 + Math.random() * 89);
            db.competitions.matchProposals.unshift({
              id: propId, matchId, round: Number(targetMatch.round || 1), leagueId: String(targetMatch.leagueId || 'L1'),
              proposerId: actorId, proposerPlayerId: actorPlayerId || null, proposerName: actorName, targetPlayerId: oppId,
              proposedSlots: slots, chosenSlot: '', status: 'PROPOSED', note, createdAt: nowStr, respondedAt: '', respondedByName: ''
            });
            if (db.competitions.matchProposals.length > 400) db.competitions.matchProposals = db.competitions.matchProposals.slice(0, 400);
            const oppP = db.players.find((p) => p && String(p.id) === oppId);
            if (oppP) {
              if (!Array.isArray(oppP.notifications)) oppP.notifications = [];
              oppP.notifications.unshift({ id: 'NOTIF_' + propId, time: nowStr, text: `📅 ${actorName} zaproponował termin meczu (K${targetMatch.round || '?'}): ${slots.join(' / ')}` });
            }
            logText = `📅 ${actorName} zaproponował termin meczu (${slots.join(', ')}).`;
          } else if (op === 'match_respond') {
            const propId = String(payload.proposalId || '').trim();
            const decRaw = ['ACCEPT', 'RESCHEDULE', 'DECLINE'].includes(String(payload.decision || 'ACCEPT').toUpperCase()) ? String(payload.decision || 'ACCEPT').toUpperCase() : 'ACCEPT';
            let chosenSlot = String(payload.chosenSlot || '').replace(/<[^>]*>/g, '').trim().slice(0, 60);
            const note = String(payload.note || '').replace(/<[^>]*>/g, '').trim().slice(0, 180);
            const props = Array.isArray(db.competitions.matchProposals) ? db.competitions.matchProposals : [];
            const pObj = props.find((p) => p && String(p.id) === propId);
            if (!pObj) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono propozycji terminu.' });
            if (!isAdmActor && actorPlayerId !== String(pObj.targetPlayerId || '') && actorPlayerId !== String(pObj.proposerPlayerId || '')) {
              return sendJson(res, 403, { ok: false, error: 'Brak uprawnień do odpowiedzi na tę propozycję terminu.' });
            }
            if (decRaw === 'ACCEPT' && !chosenSlot && Array.isArray(pObj.proposedSlots) && pObj.proposedSlots[0]) chosenSlot = String(pObj.proposedSlots[0]);
            pObj.status = decRaw === 'ACCEPT' ? 'ACCEPTED' : (decRaw === 'RESCHEDULE' ? 'RESCHEDULE' : 'DECLINED');
            pObj.chosenSlot = chosenSlot; pObj.respondedAt = nowStr; pObj.respondedByName = actorName;
            if (note) pObj.responseNote = note;
            logText = `📅 ${actorName} odpowiedział na propozycję terminu (${pObj.status}${chosenSlot ? ': ' + chosenSlot : ''}).`;
          } else if (op === 'dispute_submit') {
            const matchId = String(payload.matchId || '').trim();
            const rRaw = String(payload.reasonType || 'DISCONNECT').toUpperCase();
            const reasonType = ['DISCONNECT', 'NO_SHOW_48H', 'SCORE_DISPUTE', 'APPEAL_7D', 'OTHER'].includes(rRaw) ? rRaw : 'OTHER';
            const desc = String(payload.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 420);
            if (!matchId || desc.length < 6) return sendJson(res, 400, { ok: false, error: 'Wpisz opis zgłoszenia VAR (min. 6 znaków) oraz wskaż mecz.' });
            const targetMatch = (db.matches || []).find((m) => m && String(m.id) === matchId);
            if (!targetMatch) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono meczu.' });
            const cleanSs = String(payload.screenshot || '').trim();
            if (!cleanSs || cleanSs.length > 1600000 || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(cleanSs)) {
              return sendJson(res, 400, { ok: false, error: 'Do zgłoszenia sporu / wniosku o walkower (W.O.) wymagany jest obowiązkowy zrzut ekranu (SS) pokazujący powód (dlaczego).' });
            }
            if (!Array.isArray(db.competitions.matchDisputes)) db.competitions.matchDisputes = [];
            const hId = String(targetMatch.homeId || ''); const aId = String(targetMatch.awayId || '');
            const accusedId = actorPlayerId === hId ? aId : (actorPlayerId === aId ? hId : '');
            const dlDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
            db.competitions.matchDisputes.unshift({
              id: 'VAR_' + Date.now() + '_' + Math.floor(10 + Math.random() * 89),
              matchId, leagueId: String(targetMatch.leagueId || 'L1'), round: Number(targetMatch.round || 1),
              reporterId: actorId, reporterPlayerId: actorPlayerId || null, reporterName: actorName, accusedPlayerId: accusedId,
              reasonType, description: desc, screenshot: cleanSs, deadlineAt: dlDate, status: 'PENDING',
              resolutionNote: '', resolvedBy: '', resolvedAt: '', createdAt: nowStr
            });
            if (db.competitions.matchDisputes.length > 200) db.competitions.matchDisputes = db.competitions.matchDisputes.slice(0, 200);
            logText = `🚩 ${actorName} otworzył spór VAR (${reasonType}) w meczu K${targetMatch.round || '?'}.`;
          } else if (op === 'fan_poll_vote') {
            const matchId = String(payload.matchId || '').trim();
            const pick = String(payload.pick || '').toUpperCase();
            if (!matchId || !['HOME', 'DRAW', 'AWAY'].includes(pick)) return sendJson(res, 400, { ok: false, error: 'Wybierz typ kibica: HOME, DRAW lub AWAY.' });
            if (!db.competitions.fanPolls || typeof db.competitions.fanPolls !== 'object') db.competitions.fanPolls = {};
            const poll = db.competitions.fanPolls[matchId] || { homeVotes: [], drawVotes: [], awayVotes: [] };
            ['homeVotes', 'drawVotes', 'awayVotes'].forEach((vk) => {
              poll[vk] = (Array.isArray(poll[vk]) ? poll[vk] : []).filter((v) => v !== actorId);
            });
            const tk = pick === 'HOME' ? 'homeVotes' : (pick === 'AWAY' ? 'awayVotes' : 'drawVotes');
            poll[tk].push(actorId);
            db.competitions.fanPolls[matchId] = poll;
            logText = `🗳️ ${actorName} zagłosował w sondzie kibiców (${pick}).`;
          } else if (op === 'shop_buy' || op === 'shop_equip') {
            const targetPid = actorPlayerId || (isAdmActor && payload.playerId ? String(payload.playerId).trim() : '');
            if (!targetPid) return sendJson(res, 400, { ok: false, error: 'Sklepik SMPL Coins dostępny jest dla przypisanych zawodników ligi.' });
            const u = ensureShopUnlockLocal(db, targetPid);
            const itemId = String(payload.itemId || '').trim();
            if (op === 'shop_buy') {
              const itemDef = SHOP_CATALOG_LOCAL[itemId];
              if (!itemDef) return sendJson(res, 404, { ok: false, error: 'Nieznany przedmiot w Sklepiku SMPL.' });
              if (!u.unlockedItems.includes(itemId)) {
                if (itemDef.seasonOnly && Number(itemDef.seasonOnly) !== Number(sNum)) {
                  return sendJson(res, 400, { ok: false, error: `Ten limitowany drop był dostępny wyłącznie w Sezonie ${itemDef.seasonOnly}.` });
                }
                const bal = computePlayerCoinsLocal(db, targetPid);
                if (bal < itemDef.price) return sendJson(res, 400, { ok: false, error: `Za mało SMPL Coins! Potrzebujesz ${itemDef.price} (masz: ${bal}).` });
                u.unlockedItems.push(itemId);
                u.spentCoins = Number(u.spentCoins || 0) + itemDef.price;
              }
              if (itemDef.category === 'frame') u.frame = itemDef.value;
              else if (itemDef.category === 'bg') u.bgStyle = itemDef.value;
              else if (itemDef.category === 'poster') u.posterTheme = itemDef.value;
              else if (itemDef.category === 'badge') u.profileBadge = itemDef.value;
              else if (itemDef.category === 'nickfx') u.nickEffect = itemDef.value;
              else if (itemDef.category === 'sound') u.joinSound = itemDef.value;
              else if (itemDef.category === 'title') {
                if (itemDef.value !== 'custom') u.customTitle = String(itemDef.value).replace(/<[^>]*>/g, '').trim().slice(0, 28);
                else if (payload.customTitle !== undefined) u.customTitle = String(payload.customTitle || '').replace(/<[^>]*>/g, '').trim().slice(0, 28);
              }
              logText = `🪙 ${actorName} odblokował styl w Sklepiku SMPL Coins (${itemId}).`;
            } else {
              const cat = String(payload.category || '').trim(); const val = String(payload.value || 'default').slice(0, 40);
              if (cat === 'frame') u.frame = val;
              else if (cat === 'bg') u.bgStyle = val;
              else if (cat === 'poster') u.posterTheme = val;
              else if (cat === 'badge') u.profileBadge = val;
              else if (cat === 'nickfx') u.nickEffect = val;
              else if (cat === 'sound') u.joinSound = val;
              else if (cat === 'title') {
                const cleanCustom = String(payload.customTitle || '').replace(/<[^>]*>/g, '').trim().slice(0, 28);
                if (cleanCustom) u.customTitle = cleanCustom;
                else if (val && val !== 'default' && val !== 'custom') u.customTitle = val.replace(/<[^>]*>/g, '').trim().slice(0, 28);
                else u.customTitle = '';
              }
              logText = `🎨 ${actorName} zmienił kosmetyk profilu SMPL.`;
            }
            db.competitions.playerShop.unlocks[targetPid] = u;
          } else if (op === 'shop_quest_claim') {
            const targetPid = actorPlayerId || (isAdmActor && payload.playerId ? String(payload.playerId).trim() : '');
            if (!targetPid) return sendJson(res, 400, { ok: false, error: 'Wyzwania dostępne są dla przypisanych zawodników ligi.' });
            const questId = String(payload.questId || '').trim();
            const qMap = computeWeeklyQuestsLocal(db, targetPid);
            const qDef = qMap[questId];
            if (!qDef) return sendJson(res, 404, { ok: false, error: 'Nieznane wyzwanie.' });
            if (!qDef.done) return sendJson(res, 400, { ok: false, error: 'Wyzwanie nie zostało jeszcze ukończone.' });
            const u = ensureShopUnlockLocal(db, targetPid);
            if (u.claimedQuests.includes(qDef.periodKey)) {
              return sendJson(res, 409, { ok: false, error: 'Nagroda za to wyzwanie została już odebrana.' });
            }
            u.claimedQuests.push(qDef.periodKey);
            u.questCoins = Number(u.questCoins || 0) + qDef.reward;
            db.competitions.playerShop.unlocks[targetPid] = u;
            logText = `🎯 ${actorName} odebrał +${qDef.reward} Coins za wyzwanie "${qDef.title}".`;
          } else if (op === 'shop_gift') {
            const targetPid = actorPlayerId || (isAdmActor && payload.playerId ? String(payload.playerId).trim() : '');
            if (!targetPid) return sendJson(res, 400, { ok: false, error: 'Prezenty mogą wysyłać aktywni zawodnicy ligi.' });
            const toPid = String(payload.toPlayerId || '').trim();
            if (!toPid || toPid === targetPid) return sendJson(res, 400, { ok: false, error: 'Wybierz innego gracza jako odbiorcę prezentu.' });
            const recipient = (db.players || []).find((p) => p && String(p.id) === toPid);
            if (!recipient) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono odbiorcy prezentu.' });
            const senderU = ensureShopUnlockLocal(db, targetPid);
            const recU = ensureShopUnlockLocal(db, toPid);
            const giftType = String(payload.giftType || 'coins') === 'item' ? 'item' : 'coins';
            const cleanNote = String(payload.note || '').replace(/<[^>]*>/g, '').trim().slice(0, 120);
            const bal = computePlayerCoinsLocal(db, targetPid);
            let giftLabel = ''; let amountOrItemId = '';
            if (giftType === 'item') {
              const gItemId = String(payload.itemId || '').trim();
              const itemDef = SHOP_CATALOG_LOCAL[gItemId];
              if (!itemDef) return sendJson(res, 404, { ok: false, error: 'Nieznany kosmetyk na prezent.' });
              if (itemDef.seasonOnly && Number(itemDef.seasonOnly) !== Number(sNum)) {
                return sendJson(res, 400, { ok: false, error: `Limitowany drop Sezonu ${itemDef.seasonOnly} jest zamknięty.` });
              }
              if (recU.unlockedItems.includes(gItemId)) return sendJson(res, 409, { ok: false, error: 'Odbiorca posiada już ten kosmetyk.' });
              if (bal < itemDef.price) return sendJson(res, 400, { ok: false, error: `Za mało SMPL Coins na ten prezent! Koszt: ${itemDef.price} (masz: ${bal}).` });
              senderU.spentCoins = Number(senderU.spentCoins || 0) + itemDef.price;
              recU.unlockedItems.push(gItemId);
              giftLabel = gItemId; amountOrItemId = gItemId;
            } else {
              const amt = Math.round(Number(payload.amount || 0));
              if (!amt || amt < 10 || amt > 500) return sendJson(res, 400, { ok: false, error: 'Kwota prezentu Coins musi wynosić od 10 do 500 monet.' });
              if (bal < amt) return sendJson(res, 400, { ok: false, error: `Za mało SMPL Coins! Potrzebujesz ${amt} (masz: ${bal}).` });
              senderU.spentCoins = Number(senderU.spentCoins || 0) + amt;
              recU.giftCoinsReceived = Number(recU.giftCoinsReceived || 0) + amt;
              giftLabel = `${amt} SMPL Coins`; amountOrItemId = amt;
            }
            const recName = String(recipient.name || 'Gracz');
            db.competitions.playerShop.giftHistory.unshift({
              id: 'GIFT_' + Date.now(), fromPlayerId: targetPid, fromName: actorName,
              toPlayerId: toPid, toName: recName, giftType, amountOrItemId, label: giftLabel, note: cleanNote, createdAt: nowStr
            });
            if (db.competitions.playerShop.giftHistory.length > 50) {
              db.competitions.playerShop.giftHistory = db.competitions.playerShop.giftHistory.slice(0, 50);
            }
            if (!Array.isArray(recipient.notifications)) recipient.notifications = [];
            recipient.notifications.unshift({
              id: 'NOTIF_GIFT_' + Date.now(),
              type: 'SHOP_GIFT',
              icon: '🎁',
              title: `Otrzymałeś prezent od ${actorName}!`,
              text: `Dostałeś prezent: ${giftLabel}${cleanNote ? '. Wiadomość: „' + cleanNote + '”' : '.'}`,
              time: nowStr,
              read: false
            });
            if (recipient.notifications.length > 50) recipient.notifications = recipient.notifications.slice(0, 50);
            logText = `🎁 ${actorName} podarował prezent dla ${recName}: ${giftLabel}.`;
          } else if (op === 'master_grant_coins') {
            if (!isAdmActor || !adm || String(adm.role || '') !== 'MASTER_ADMIN') {
              return sendJson(res, 403, { ok: false, error: '⛔ Wyłącznie Master Admin (Szymon Komenda) może przyznawać lub zerować SMPL Coins graczom!' });
            }
            const targetPid = String(payload.playerId || '').trim();
            if (!targetPid) return sendJson(res, 400, { ok: false, error: 'Wskaż zawodnika, któremu chcesz przyznać SMPL Coins.' });
            const targetPl = (db.players || []).find((p) => p && String(p.id) === targetPid);
            if (!targetPl) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono wskazanego zawodnika w bazie ligi.' });
            if (!db.competitions.playerShop || typeof db.competitions.playerShop !== 'object') {
              db.competitions.playerShop = { unlocks: {}, bonusCoins: {}, giftHistory: [] };
            }
            if (!db.competitions.playerShop.bonusCoins || typeof db.competitions.playerShop.bonusCoins !== 'object' || Array.isArray(db.competitions.playerShop.bonusCoins)) {
              db.competitions.playerShop.bonusCoins = {};
            }
            const mode = String(payload.mode || 'add').trim().toLowerCase();
            const curBonus = Number(db.competitions.playerShop.bonusCoins[targetPid] || 0);
            const cleanReason = String(payload.reason || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
            const maxSafe = 1000000000;
            let nextBonus = curBonus;
            let appliedDelta = 0;
            if (mode === 'reset_bonus') {
              nextBonus = 0;
              appliedDelta = -curBonus;
            } else if (mode === 'set_bonus') {
              const rawSet = Math.round(Number(payload.amount || 0) || 0);
              nextBonus = Math.max(-maxSafe, Math.min(maxSafe, rawSet));
              appliedDelta = nextBonus - curBonus;
            } else {
              const rawDelta = Math.round(Number(payload.delta !== undefined ? payload.delta : payload.amount || 0) || 0);
              if (!rawDelta) return sendJson(res, 400, { ok: false, error: 'Podaj liczbę SMPL Coins różną od 0 (np. 1000 lub -500).' });
              nextBonus = Math.max(-maxSafe, Math.min(maxSafe, curBonus + rawDelta));
              appliedDelta = nextBonus - curBonus;
            }
            db.competitions.playerShop.bonusCoins[targetPid] = nextBonus;
            const newBalance = computePlayerCoinsLocal(db, targetPid);
            const targetName = String(targetPl.name || 'Gracz');
            if (appliedDelta > 0) {
              if (!Array.isArray(targetPl.notifications)) targetPl.notifications = [];
              targetPl.notifications.unshift({
                id: 'NOTIF_MCOINS_' + Date.now(),
                type: 'MASTER_COINS',
                icon: '👑',
                title: `Otrzymałeś +${appliedDelta} SMPL Coins od Master Admina!`,
                text: `Master Admin ${actorName} doładował Twoje konto w Sklepiku SMPL o +${appliedDelta} Coins (saldo: ${newBalance} Coins).${cleanReason ? ' Powód: ' + cleanReason : ''}`,
                time: nowStr,
                read: false
              });
              if (targetPl.notifications.length > 50) targetPl.notifications = targetPl.notifications.slice(0, 50);
            }
            logText = mode === 'reset_bonus'
              ? `👑🧹 Master Admin ${actorName} wyzerował bonusowe SMPL Coins gracza ${targetName} (nowe saldo: ${newBalance} Coins).`
              : `👑🪙 Master Admin ${actorName} zmienił SMPL Coins gracza ${targetName} o ${appliedDelta >= 0 ? '+' : ''}${appliedDelta} (saldo: ${newBalance} Coins)${cleanReason ? ' [' + cleanReason + ']' : ''}.`;
          } else if (op === 'tv_clip_add') {
            const title = String(payload.title || '').replace(/<[^>]*>/g, '').trim().slice(0, 100);
            const url = String(payload.url || '').trim();
            const pName = String(payload.playerName || actorName).replace(/<[^>]*>/g, '').trim().slice(0, 60);
            const tag = String(payload.tag || 'HIGHLIGHT').replace(/<[^>]*>/g, '').trim().slice(0, 24) || 'HIGHLIGHT';
            if (title.length < 4 || !/^https?:\/\/[^\s"'<>]{6,500}$/i.test(url)) return sendJson(res, 400, { ok: false, error: 'Podaj tytuł klipu (min. 4 znaki) i poprawny link https://.' });
            if (!db.competitions.smplTV || typeof db.competitions.smplTV !== 'object') db.competitions.smplTV = { liveStream: { isLive: false }, clips: [] };
            if (!Array.isArray(db.competitions.smplTV.clips)) db.competitions.smplTV.clips = [];
            db.competitions.smplTV.clips.unshift({ id: 'TV_' + Date.now(), title, playerName: pName, url, tag, addedBy: actorName, createdAt: nowStr });
            if (db.competitions.smplTV.clips.length > 60) db.competitions.smplTV.clips = db.competitions.smplTV.clips.slice(0, 60);
            logText = `📺 ${actorName} dodał klip do SMPL TV: ${title}`;
          } else if (op === 'notif_mark_read' || op === 'notif_clear') {
            const targetPid = (isAdmActor && payload.playerId && String(payload.playerId).trim())
              ? String(payload.playerId).trim()
              : actorPlayerId;
            if (!targetPid) return sendJson(res, 400, { ok: false, error: 'Brak przypisanego profilu zawodnika dla powiadomień.' });
            const plObj = db.players.find((p) => p && String(p.id) === targetPid);
            if (!plObj) return sendJson(res, 404, { ok: false, error: 'Nie znaleziono profilu zawodnika.' });
            const curNotifs = Array.isArray(plObj.notifications) ? plObj.notifications : [];
            if (op === 'notif_mark_read') {
              const rIds = Array.isArray(payload.readIds) ? payload.readIds.map(String) : [];
              const hasFilter = rIds.length > 0;
              curNotifs.forEach((n) => {
                if (!n || typeof n !== 'object') return;
                const nid = n.id ? String(n.id) : '';
                if (!hasFilter || (nid && rIds.includes(nid))) n.read = true;
              });
              plObj.notifications = curNotifs;
            } else {
              const onlyRead = Boolean(payload.onlyRead);
              const cIds = Array.isArray(payload.clearedIds) ? payload.clearedIds.map(String) : [];
              if (onlyRead) {
                plObj.notifications = curNotifs.filter((n) => n && n.read !== true);
              } else if (cIds.length > 0) {
                plObj.notifications = curNotifs.filter((n) => {
                  if (!n) return false;
                  const nid = n.id ? String(n.id) : '';
                  const fbKey = String(n.time || '') + '|' + String(n.text || '');
                  return !(nid && cIds.includes(nid)) && !cIds.includes(fbKey);
                });
              } else {
                plObj.notifications = [];
              }
            }
            logText = '';
          } else {
            return sendJson(res, 400, { ok: false, error: 'Nieznana operacja konkursowa.' });
          }

          db.updatedAt = Date.now();
          if (logText) {
            if (!Array.isArray(db.logs)) db.logs = [];
            db.logs.unshift({ id: 'LOG_COMP_' + Date.now(), time: nowStr, type: 'COMPETITION_ACTION', text: logText });
            if (db.logs.length > 300) db.logs = db.logs.slice(0, 300);
          }
          if (fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 100) {
            try { fs.copyFileSync(DB_FILE, BACKUP_FILE); } catch (e) {}
          }
          const compOutStr = JSON.stringify(db);
          fs.writeFileSync(DB_FILE, compOutStr, 'utf8');
          saveDailySnapshotLocal(compOutStr);
          dispatchWebPushDiffLocal(prevDbSnapForPush, db, actorPlayerId);
          return sendJson(res, 200, { ok: true, op, competitions: db.competitions, goldenBall: db.goldenBall, state: db });
        }

        if (action === 'push_subscribe' || action === 'push_unsubscribe' || action === 'push_set_muted' || action === 'push_test') {
          const db = readDbJson();
          const adm = db ? validateAdminTokenHeader(req, db) : null;
          const pAuth = !adm ? validatePlayerTokenHeader(req) : null;
          let b = {}; try { b = JSON.parse(body || '{}') || {}; } catch (e) {}
          const subs = readPushSubsLocal();
          if (action === 'push_unsubscribe') {
            const ep = String(b.endpoint || '').trim();
            if (ep) {
              const h = crypto.createHash('sha256').update(ep).digest('hex');
              if (subs[h]) { delete subs[h]; savePushSubsLocal(subs); }
            }
            return sendJson(res, 200, { ok: true });
          }
          if (action === 'push_set_muted') {
            const ep = String(b.endpoint || '').trim();
            const mutedVal = Boolean(b.muted);
            if (ep) {
              const h = crypto.createHash('sha256').update(ep).digest('hex');
              if (subs[h]) { subs[h].muted = mutedVal; subs[h].updatedAt = new Date().toISOString(); savePushSubsLocal(subs); }
            }
            return sendJson(res, 200, { ok: true, muted: mutedVal });
          }
          if (action === 'push_subscribe') {
            const subIn = (b.subscription && typeof b.subscription === 'object') ? b.subscription : b;
            const ep = String(subIn.endpoint || '').trim();
            const p256 = String((subIn.keys && subIn.keys.p256dh) || '').trim();
            const auth = String((subIn.keys && subIn.keys.auth) || '').trim();
            if (!/^https:\/\/[^\s"'<>]{10,1200}$/i.test(ep) || b64uDec(p256).length !== 65 || b64uDec(auth).length !== 16) {
              return sendJson(res, 400, { ok: false, error: 'Nieprawidłowa subskrypcja Web Push (endpoint lub klucze P-256).' });
            }
            let verifiedPid = '';
            let verifiedAdminId = '';
            let verifiedIsAdmin = false;
            let verifiedLeagueId = '';
            if (adm) {
              verifiedIsAdmin = true;
              verifiedAdminId = String(adm.adminId || '');
              const linked = db && Array.isArray(db.players) ? db.players.find((p) => p && String(p.adminId || '') === verifiedAdminId) : null;
              if (linked) { verifiedPid = String(linked.id); verifiedLeagueId = String(linked.leagueId || ''); }
            } else if (pAuth && pAuth.info && String(pAuth.info.subjectKind || 'PLAYER') === 'PLAYER') {
              verifiedPid = String(pAuth.info.subjectId || '');
              const mp = db && Array.isArray(db.players) ? db.players.find((p) => p && String(p.id) === verifiedPid) : null;
              if (mp) verifiedLeagueId = String(mp.leagueId || '');
            }
            if (!verifiedLeagueId && b.leagueId && /^L\d+$/i.test(String(b.leagueId))) {
              verifiedLeagueId = String(b.leagueId).toUpperCase();
            }
            const h = crypto.createHash('sha256').update(ep).digest('hex');
            subs[h] = {
              endpoint: ep,
              keys: { p256dh: p256, auth },
              playerId: verifiedPid,
              adminId: verifiedAdminId,
              isAdmin: verifiedIsAdmin,
              leagueId: verifiedLeagueId,
              muted: Boolean(b.muted),
              isIos: Boolean(b.isIos),
              standalone: Boolean(b.standalone),
              updatedAt: new Date().toISOString()
            };
            savePushSubsLocal(subs);
            return sendJson(res, 200, { ok: true, boundPlayerId: verifiedPid, boundAdmin: verifiedIsAdmin, leagueId: verifiedLeagueId, totalSubs: Object.keys(subs).length });
          }
          const epTest = String(b.endpoint || '').trim();
          const testItems = [];
          const testPayload = { title: '🔔 Test PUSH Score Match Liga!', body: 'Super! Powiadomienia Web Push działają na Twoim telefonie nawet przy wyłączonej aplikacji.', tag: 'smpl-test-' + Date.now(), tab: 'standings', url: './index.html' };
          if (epTest) {
            const hTest = crypto.createHash('sha256').update(epTest).digest('hex');
            if (subs[hTest]) testItems.push({ hash: hTest, sub: subs[hTest], payload: testPayload });
          }
          if (!testItems.length && (adm || pAuth)) {
            const tAdm = adm ? String(adm.adminId || '') : '';
            const tPid = pAuth && pAuth.info ? String(pAuth.info.subjectId || '') : '';
            Object.keys(subs).forEach((hK) => {
              const s = subs[hK];
              if (!s) return;
              if ((tAdm && s.isAdmin) || (tPid && String(s.playerId || '') === tPid)) testItems.push({ hash: hK, sub: s, payload: testPayload });
            });
          }
          if (!testItems.length) {
            return sendJson(res, 200, { ok: false, sent: 0, error: 'Brak zapisanej subskrypcji Push dla tego urządzenia — kliknij najpierw Aktywuj PUSH.' });
          }
          const tRes = await sendWebPushBatchLocal(testItems);
          return sendJson(res, 200, tRes);
        }

        if (action === 'webhooks_save' || action === 'webhooks_test' || action === 'webhooks_broadcast') {
          const db = readDbJson();
          const adm = validateAdminTokenHeader(req, db);
          if (!adm) return sendJson(res, 403, { ok: false, error: 'Zarządzanie webhookami wymaga sesji Administratora.' });
          let b = {}; try { b = JSON.parse(body || '{}') || {}; } catch (e) {}
          const cfg = readWebhooksConfigLocal();
          if (action === 'webhooks_save') {
            if (b.enabled !== undefined) cfg.enabled = Boolean(b.enabled);
            if (b.clearDiscordPublic) cfg.discordPublicUrl = '';
            else if (b.discordPublicUrl && /^https:\/\/(discord(app)?|canary\.discord|ptb\.discord)\.com\/api\/webhooks\/.+$/i.test(String(b.discordPublicUrl).trim())) cfg.discordPublicUrl = String(b.discordPublicUrl).trim();
            if (b.clearDiscordAdmin) cfg.discordAdminUrl = '';
            else if (b.discordAdminUrl && /^https:\/\/(discord(app)?|canary\.discord|ptb\.discord)\.com\/api\/webhooks\/.+$/i.test(String(b.discordAdminUrl).trim())) cfg.discordAdminUrl = String(b.discordAdminUrl).trim();
            if (b.clearTelegram) { cfg.telegramBotToken = ''; cfg.telegramChatId = ''; }
            else if (b.telegramBotToken && String(b.telegramBotToken).trim().length >= 15) cfg.telegramBotToken = String(b.telegramBotToken).trim();
            if (b.telegramChatId !== undefined) cfg.telegramChatId = String(b.telegramChatId || '').trim().slice(0, 80);
            if (b.events && typeof b.events === 'object') cfg.events = Object.assign({}, cfg.events, b.events);
            cfg.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
            cfg.updatedBy = adm.adminName || 'Admin';
            saveWebhooksConfigLocal(cfg);
            return sendJson(res, 200, { ok: true, enabled: cfg.enabled, hasDiscordPublic: Boolean(cfg.discordPublicUrl), hasDiscordAdmin: Boolean(cfg.discordAdminUrl), hasTelegram: Boolean(cfg.telegramBotToken && cfg.telegramChatId), events: cfg.events, updatedAt: cfg.updatedAt });
          }
          if (action === 'webhooks_test') {
            const r1 = await dispatchWebhooksLocal('TEST', '🧪 Test powiadomień SMPL Liga', `Połączenie z Discordem/Telegramem działa! (${adm.adminName || 'Admin'})`, false);
            const r2 = await dispatchWebhooksLocal('TEST', '🛡️ Test kanału Administracji SMPL', 'Kanał moderacji działa poprawnie!', true);
            return sendJson(res, 200, { ok: Boolean(r1.ok || r2.ok), public: r1, admin: r2 });
          }
          const rB = await dispatchWebhooksLocal('BROADCAST', String(b.title || '📢 Ogłoszenie SMPL').slice(0, 180), String(b.message || '').slice(0, 1400), Boolean(b.adminOnly));
          return sendJson(res, 200, rB);
        }

        if (action === 'snapshot_restore') {
          const db = readDbJson();
          const adm = validateAdminTokenHeader(req, db);
          if (!adm) return sendJson(res, 403, { ok: false, error: 'Przywracanie kopii wymaga sesji Administratora.' });
          let b = {}; try { b = JSON.parse(body || '{}') || {}; } catch (e) {}
          const snapName = path.basename(String(b.name || '').trim());
          if (!/^smpl-db-[A-Za-z0-9_-]+\.json$/.test(snapName)) return sendJson(res, 400, { ok: false, error: 'Nieprawidłowa nazwa kopii zapasowej.' });
          const snapPath = path.join(SNAPSHOTS_DIR, snapName);
          if (!fs.existsSync(snapPath)) return sendJson(res, 404, { ok: false, error: 'Wybrana kopia nie istnieje.' });
          const rawSnap = fs.readFileSync(snapPath, 'utf8');
          const dec = JSON.parse(rawSnap);
          if (!dec || !Array.isArray(dec.players) || !Array.isArray(dec.matches)) return sendJson(res, 400, { ok: false, error: 'Uszkodzona kopia zapasowa.' });
          dec.updatedAt = Date.now();
          const restoredStr = JSON.stringify(dec);
          fs.writeFileSync(DB_FILE, restoredStr, 'utf8');
          try { fs.writeFileSync(BACKUP_FILE, restoredStr, 'utf8'); } catch (e) {}
          return sendJson(res, 200, { ok: true, restored: snapName, updatedAt: dec.updatedAt, state: dec });
        }

        if (action === 'ai_verify_match_ss') {
          const db = readDbJson();
          const adm = validateAdminTokenHeader(req, db);
          const pAuth = !adm ? validatePlayerTokenHeader(req) : null;
          if (!adm && !pAuth) return sendJson(res, 401, { ok: false, error: 'Zaloguj się, aby sprawdzić SS przez AI.' });
          let b = {}; try { b = JSON.parse(body || '{}') || {}; } catch (e) {}
          const rawUrl = String(b.screenshot || '').trim();
          const mImg = rawUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/i);
          if (!mImg) return sendJson(res, 400, { ok: false, error: 'Brak poprawnego screena base64.' });
          const cfg = readAiSecrets();
          const resolved = resolveGeminiKey(cfg);
          if (!cfg.enabled || !resolved.key) return sendJson(res, 200, { ok: false, offline: true, error: 'Klucz Gemini API nie jest skonfigurowany.' });
          const mimeType = mImg[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : mImg[1].toLowerCase();
          const sysP = 'Jesteś asystentem sędziowskim Score! Match Liga. Odczytaj wynik ze screena i odpowiedz czystym JSON: {"detectedLeftScore": number_or_null, "detectedRightScore": number_or_null, "matchesExpected": boolean, "confidence": "HIGH"|"MEDIUM"|"LOW", "note": "opis"}';
          const usrP = `Sprawdź screen dla ${b.homeName || 'Gospodarz'} vs ${b.awayName || 'Gość'}, zgłoszony wynik: ${Number(b.expectedHome || 0)}:${Number(b.expectedAway || 0)}.`;
          const resG = await callGeminiChatWithFallback(resolved.key, cfg.model, sysP, [{ role: 'user', parts: [{ text: usrP }, { inlineData: { mimeType, data: mImg[2] } }] }], 0.2, 512);
          if (resG && resG.ok) {
            let parsedOcr = null;
            try { parsedOcr = JSON.parse(String(resG.answer || '').replace(/^```(?:json)?\s*|\s*```$/gm, '').trim()); } catch (e) {}
            return sendJson(res, 200, { ok: true, model: resG.model, parsed: parsedOcr, rawAnswer: resG.answer });
          }
          return sendJson(res, 200, { ok: false, error: (resG && resG.error) || 'Błąd AI OCR.' });
        }

        if (action === 'ai_config_save') {
          const db = readDbJson();
          const adm = validateAdminTokenHeader(req, db);
          if (!adm) {
            return sendJson(res, 403, { ok: false, error: 'Odmowa zapisu konfiguracji AI: wymagana sesja Administratora z ważnym tokenem.' });
          }
          let cfgIn = {};
          try { cfgIn = JSON.parse(body || '{}'); } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy JSON konfiguracji AI.' });
          }
          const cfg = readAiSecrets();
          if (cfgIn.clearKey) {
            cfg.apiKey = '';
            cfg.lastTestOk = null;
            cfg.lastTestError = null;
          } else if (cfgIn.apiKey && String(cfgIn.apiKey).trim()) {
            const nk = String(cfgIn.apiKey).trim();
            if (nk.length < 12 || nk.length > 256 || /\s/.test(nk)) {
              return sendJson(res, 400, { ok: false, error: 'Format klucza Gemini API wygląda na nieprawidłowy.' });
            }
            cfg.apiKey = nk;
            cfg.lastTestOk = null;
            cfg.lastTestError = null;
          }
          if (cfgIn.model !== undefined) cfg.model = validateGeminiModel(cfgIn.model);
          if (cfgIn.enabled !== undefined) cfg.enabled = Boolean(cfgIn.enabled);
          if (cfgIn.customPersona !== undefined) cfg.customPersona = String(cfgIn.customPersona).trim().slice(0, 2000);
          if (cfgIn.temperature !== undefined) cfg.temperature = Math.max(0, Math.min(1.2, Number(cfgIn.temperature) || 0.7));
          cfg.updatedAt = new Date().toISOString();
          cfg.updatedBy = adm.adminName || 'Admin';
          saveAiSecrets(cfg);
          const resolved = resolveGeminiKey(cfg);
          return sendJson(res, 200, {
            ok: true,
            configured: Boolean(resolved.key),
            hasEnvKey: resolved.fromEnv,
            maskedKey: maskSecret(resolved.key),
            model: cfg.model,
            enabled: cfg.enabled,
            customPersona: cfg.customPersona,
            temperature: cfg.temperature,
            updatedAt: cfg.updatedAt,
            updatedBy: cfg.updatedBy
          });
        }

        if (action === 'ai_test') {
          const db = readDbJson();
          const adm = validateAdminTokenHeader(req, db);
          if (!adm) {
            return sendJson(res, 403, { ok: false, error: 'Test Gemini API wymaga sesji Administratora z ważnym tokenem.' });
          }
          let testIn = {};
          try { testIn = JSON.parse(body || '{}'); } catch (e) {}
          const cfg = readAiSecrets();
          const resolved = resolveGeminiKey(cfg);
          const testKey = (testIn.apiKey && String(testIn.apiKey).trim()) || resolved.key;
          const testModel = (testIn.model && validateGeminiModel(testIn.model)) || validateGeminiModel(cfg.model);
          if (!testKey) {
            return sendJson(res, 400, { ok: false, error: 'Najpierw wklej klucz Google Gemini API z aistudio.google.com i zapisz konfigurację.' });
          }
          const resG = await callGeminiChatWithFallback(
            testKey,
            testModel,
            'Jesteś Vanessa AI — oficjalna asystentka Score Match Liga (SMPL). Odpowiedz krótko po polsku jednym energicznym zdaniem.',
            [{ role: 'user', parts: [{ text: 'Test połączenia z Score Match Liga! Przedstaw się krótko jako Vanessa Gemini AI.' }] }],
            0.7,
            1024
          );
          cfg.lastTestOk = Boolean(resG.ok);
          cfg.lastTestAt = new Date().toISOString();
          cfg.lastTestError = resG.ok ? null : resG.error;
          saveAiSecrets(cfg);
          return sendJson(res, 200, {
            ok: Boolean(resG.ok),
            model: resG.model || testModel,
            latencyMs: resG.latencyMs || 0,
            maskedKey: maskSecret(testKey),
            answer: resG.answer || null,
            error: resG.error || null
          });
        }

        if (action === 'ai_chat') {
          let chatIn = {};
          try { chatIn = JSON.parse(body || '{}'); } catch (e) {
            return sendJson(res, 400, { ok: false, fallback: true, reason: 'BAD_REQUEST' });
          }
          const question = String(chatIn.question || '').trim();
          if (!question || question.length > 1600) {
            return sendJson(res, 200, { ok: false, fallback: true, reason: 'INVALID_LENGTH' });
          }
          const cfg = readAiSecrets();
          const resolved = resolveGeminiKey(cfg);
          if (!cfg.enabled || !resolved.key) {
            return sendJson(res, 200, { ok: false, fallback: true, reason: cfg.enabled ? 'NOT_CONFIGURED' : 'DISABLED' });
          }
          const db = readDbJson();
          const adm = validateAdminTokenHeader(req, db);
          if (!checkAiRateLimit(req, Boolean(adm))) {
            return sendJson(res, 200, { ok: false, fallback: true, reason: 'RATE_LIMITED', error: 'Za dużo pytań w krótkim czasie (limit API).' });
          }
          const clientContext = typeof chatIn.clientContext === 'string' ? chatIn.clientContext.trim().slice(0, 12000) : '';
          const snapshot = buildServerLeagueSnapshot(db);
          const sysParts = [
            'Jesteś Vanessa AI — oficjalna, charyzmatyczna i ultra-pomocna asystentka oraz opiekunka graczy portalu Score Match Liga (SMPL — polska liga gry Score! Match).',
            'MISJA: Prowadź nowych i powracających graczy krok po kroku: 1) Zapisy w `📝 Zapisy` + wybór istniejącego **Klanu** lub opcji `➕ Mojego klanu nie ma na liście` (z własnym logo PNG/JPG lub herbem SVG) + opcjonalne łączenie historii S1–S55; 2) Przydział Admina z Listy Oczekujących / filtrowanego selektora do L1 Ekstraklasy / L2 2. Ligi (lub L3/L4) ORAZ przycisk `⚽ Dołącz do ligi` / `🚪 Opuść ligę`, gdy Administracja otworzy okno zapisów na początek/koniec sezonu; 3) Admini mogą też grać w lidze (np. Ekstraklasa) pod rangą Admin i dopisywać statystyki S1–S55; 4) Kontakt i umawianie kolejek z `📅 Terminarz` wyłącznie przez **Messenger** (oraz propozycje `📅 Kiedy Gramy?`), mecz towarzyski w Score! Match do **max 2 bramek** w meczu bez 2:2, każda para gra **dwumecz: 1 u siebie + 1 na wyjeździe**; 5) Wysłanie **obu wyników i obu screenów (SS)** w `➕ Wynik` — przy zgłoszeniu Sporu VAR lub wniosku o Walkower (W.O.) OBOWIĄZKOWY jest screen (SS) dlaczego; 6) Tajne składy/formacje (portal ich nie zbiera!), `🎴 Karta UT`, `🥇 Złota Piłka`, `🥇 Konkursy`, darmowa gra 0 zł, wiek 16+ / RODO, reguła 48h na walkower.',
            'Pisz po polsku jasno z emotkami kroków i **pogrubieniami**. Bazuj WYŁĄCZNIE na przekazanych danych ligi — nigdy nie zmyślaj wyników, graczy ani statystyk i nigdy nie ujawniaj haseł, hashów, tokenów ani kluczy API.'
          ];
          if (cfg.customPersona) sysParts.push('DODATKOWE WYTYCZNE ADMINA:\n' + cfg.customPersona);
          if (snapshot) sysParts.push('=== DANE SERWERA SMPL ===\n' + snapshot);
          if (clientContext) sysParts.push('=== KONTEKST GRACZA I TABEL ===\n' + clientContext);
          const contents = [];
          if (Array.isArray(chatIn.history)) {
            chatIn.history.slice(-8).forEach((t) => {
              if (t && t.text && String(t.text).trim()) {
                contents.push({ role: t.role === 'model' ? 'model' : 'user', parts: [{ text: String(t.text).trim().slice(0, 1200) }] });
              }
            });
          }
          contents.push({ role: 'user', parts: [{ text: question }] });
          const resG = await callGeminiChatWithFallback(resolved.key, cfg.model, sysParts.join('\n\n'), contents, cfg.temperature, 1024);
          if (resG.ok) {
            return sendJson(res, 200, { ok: true, provider: 'gemini', model: resG.model, latencyMs: resG.latencyMs, answer: resG.answer });
          }
          return sendJson(res, 200, { ok: false, fallback: true, reason: 'UPSTREAM_ERROR', error: resG.error, latencyMs: resG.latencyMs || 0 });
        }

        if (action === 'ai_telemetry') {
          const db = readDbJson();
          let tel = {};
          try { tel = JSON.parse(body || '{}') || {}; } catch (e) { tel = {}; }
          if (!db) return sendJson(res, 200, { ok: false });
          if (!Array.isArray(db.aiInteractionLog)) db.aiInteractionLog = [];
          if (!Array.isArray(db.aiUnansweredQueue)) db.aiUnansweredQueue = [];
          if (!Array.isArray(db.aiKnowledge)) db.aiKnowledge = [];
          const op = String(tel.op || '');
          if (op === 'log' && tel.entry && typeof tel.entry === 'object') {
            const eIn = tel.entry;
            const eId = String(eIn.id || ('AILOG_' + Date.now())).slice(0, 80);
            const qStr = String(eIn.question || '').slice(0, 260);
            if (qStr) {
              db.aiInteractionLog.unshift({
                id: eId,
                question: qStr,
                normalized: String(eIn.normalized || '').slice(0, 260),
                matched: Boolean(eIn.matched),
                knowledgeId: eIn.knowledgeId ? String(eIn.knowledgeId).slice(0, 80) : null,
                matchedTitle: String(eIn.matchedTitle || '').slice(0, 160),
                confidence: Number(eIn.confidence || 0),
                playerId: eIn.playerId ? String(eIn.playerId).slice(0, 80) : null,
                playerName: String(eIn.playerName || 'Gość').slice(0, 80),
                rating: null,
                createdAt: String(eIn.createdAt || '').slice(0, 40)
              });
              if (db.aiInteractionLog.length > 120) db.aiInteractionLog = db.aiInteractionLog.slice(0, 120);
            }
            if (eIn.knowledgeId && String(eIn.knowledgeId).startsWith('KB_')) {
              const kb = db.aiKnowledge.find((k) => k && k.id === eIn.knowledgeId);
              if (kb) kb.asksCount = Number(kb.asksCount || 0) + 1;
            }
            if (tel.queueItem && typeof tel.queueItem === 'object' && tel.queueItem.question) {
              const qIn = tel.queueItem;
              const normQ = String(qIn.normalized || '').slice(0, 260);
              const existingQ = db.aiUnansweredQueue.find((q) => q && q.status === 'PENDING' && q.normalized === normQ);
              if (existingQ) {
                existingQ.askCount = Number(existingQ.askCount || 1) + 1;
                existingQ.lastAskedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
              } else {
                db.aiUnansweredQueue.unshift({
                  id: String(qIn.id || ('AIQ_' + Date.now())).slice(0, 80),
                  interactionId: eId,
                  question: String(qIn.question).slice(0, 320),
                  normalized: normQ,
                  playerId: qIn.playerId ? String(qIn.playerId).slice(0, 80) : null,
                  playerName: String(qIn.playerName || 'Gość / Rejestracja').slice(0, 80),
                  leagueId: String(qIn.leagueId || 'ALL').slice(0, 16),
                  createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
                  lastAskedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
                  askCount: 1,
                  reason: String(qIn.reason || 'UNKNOWN').slice(0, 30),
                  status: 'PENDING',
                  resolvedAnswer: '',
                  resolvedBy: '',
                  resolvedAt: '',
                  knowledgeId: ''
                });
                if (db.aiUnansweredQueue.length > 100) db.aiUnansweredQueue = db.aiUnansweredQueue.slice(0, 100);
              }
            }
          } else if (op === 'vote') {
            const intId = String(tel.interactionId || '');
            const voteVal = tel.vote === 'UP' ? 'UP' : 'DOWN';
            const lItem = db.aiInteractionLog.find((x) => x && x.id === intId);
            if (lItem) lItem.rating = voteVal;
            const kid = String(tel.knowledgeId || '');
            if (kid.startsWith('KB_')) {
              const kb = db.aiKnowledge.find((k) => k && k.id === kid);
              if (kb) {
                if (voteVal === 'UP') {
                  kb.helpfulCount = Number(kb.helpfulCount || 0) + 1;
                  if (tel.learnedPhrase) {
                    if (!Array.isArray(kb.learnedPhrases)) kb.learnedPhrases = [];
                    const lp = String(tel.learnedPhrase).slice(0, 160);
                    if (lp && !kb.learnedPhrases.includes(lp)) kb.learnedPhrases.push(lp);
                  }
                } else {
                  kb.unhelpfulCount = Number(kb.unhelpfulCount || 0) + 1;
                }
              }
            }
            if (voteVal === 'DOWN' && tel.queueItem && typeof tel.queueItem === 'object' && tel.queueItem.question) {
              const qIn = tel.queueItem;
              db.aiUnansweredQueue.unshift({
                id: String(qIn.id || ('AIQ_' + Date.now())).slice(0, 80),
                interactionId: intId.slice(0, 80),
                question: String(qIn.question).slice(0, 320),
                normalized: String(qIn.normalized || '').slice(0, 260),
                playerId: qIn.playerId ? String(qIn.playerId).slice(0, 80) : null,
                playerName: String(qIn.playerName || 'Gość / Rejestracja').slice(0, 80),
                leagueId: String(qIn.leagueId || 'ALL').slice(0, 16),
                createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
                lastAskedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
                askCount: 1,
                reason: 'THUMBS_DOWN',
                status: 'PENDING',
                resolvedAnswer: '',
                resolvedBy: '',
                resolvedAt: '',
                knowledgeId: ''
              });
              if (db.aiUnansweredQueue.length > 100) db.aiUnansweredQueue = db.aiUnansweredQueue.slice(0, 100);
            }
          }
          db.updatedAt = Date.now();
          fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf8');
          return sendJson(res, 200, { ok: true });
        }

        if (action) {
          return sendJson(res, 400, { ok: false, error: 'Nieznana akcja API.' });
        }

        try {
          const parsed = JSON.parse(body);
          if (!parsed || !parsed.players || !parsed.matches) {
            return sendJson(res, 400, { ok: false, error: 'Nieprawidłowy format bazy danych SMPL.' });
          }
          const prevDb = readDbJson();
          const admInfo = prevDb ? validateAdminTokenHeader(req, prevDb, parsed) : null;
          let bodyToWrite = body;
          if (parsed && (Object.prototype.hasOwnProperty.call(parsed, '_adminToken') || Object.prototype.hasOwnProperty.call(parsed, '_playerToken'))) {
            delete parsed._adminToken;
            delete parsed._playerToken;
            bodyToWrite = JSON.stringify(parsed);
          }
          if (admInfo && prevDb) {
            const callerAdm = (prevDb.admins || []).find((a) => a && String(a.id) === String(admInfo.adminId));
            const effRole = callerAdm && callerAdm.role ? String(callerAdm.role) : String(admInfo.role || '');
            if (effRole !== 'MASTER_ADMIN') {
              const admViolation = validateCoAdminAdminsGuardLocal(prevDb, parsed, String(admInfo.adminId || ''));
              if (admViolation) {
                return sendJson(res, 403, { ok: false, error: admViolation, code: 'MASTER_ADMIN_REQUIRED' });
              }
            }
          }
          if (!admInfo && prevDb && prevDb.portalSettings && prevDb.portalSettings.maintenanceMode && prevDb.portalSettings.maintenanceMode.enabled) {
            const pPend = (prevDb.matches || []).filter((m) => m && m.status === 'PENDING').length;
            const nPend = (parsed.matches || []).filter((m) => m && m.status === 'PENDING').length;
            if (nPend > pPend) {
              return sendJson(res, 403, { ok: false, error: '🚧 ' + (prevDb.portalSettings.maintenanceMode.message || 'Trwa przerwa techniczna — wysyłanie wyników chwilowo wstrzymane.') });
            }
          }
          if (fs.existsSync(DB_FILE)) {
            try {
              fs.copyFileSync(DB_FILE, BACKUP_FILE);
            } catch (e) {}
          }
          // OCHRONA SERWEROWA (v53): Zapobieganie utracie kont graczy i trofeów/historii S1-S55 przy pełnej synchronizacji POST
          const allowHardDeleteId = admInfo ? String(parsed.allowHardDeletePlayerId || '').trim() : '';
          const allowBulkWipe = Boolean(admInfo && parsed.allowBulkPlayerWipe);
          if (Object.prototype.hasOwnProperty.call(parsed, 'allowHardDeletePlayerId')) delete parsed.allowHardDeletePlayerId;
          if (Object.prototype.hasOwnProperty.call(parsed, 'allowBulkPlayerWipe')) delete parsed.allowBulkPlayerWipe;
          if (prevDb && Array.isArray(prevDb.players) && Array.isArray(parsed.players)) {
            const newById = new Map();
            const newByUser = new Map();
            parsed.players.forEach((np, idx) => {
              if (!np || typeof np !== 'object') return;
              if (np.id) newById.set(String(np.id), idx);
              if (np.username) newByUser.set(String(np.username).trim().toLowerCase(), idx);
            });
            const nowGuardStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
            prevDb.players.forEach((oldP) => {
              if (!oldP || typeof oldP !== 'object' || oldP.isPlaceholder || oldP.gdprDeleted) return;
              const oldId = String(oldP.id || '');
              const oldUser = String(oldP.username || '').trim().toLowerCase();
              let matchedIdx = null;
              if (oldId && newById.has(oldId)) matchedIdx = newById.get(oldId);
              else if (oldUser && newByUser.has(oldUser)) matchedIdx = newByUser.get(oldUser);
              if (matchedIdx === null) {
                if (!allowBulkWipe && (!allowHardDeleteId || allowHardDeleteId !== oldId)) {
                  const restoredP = Object.assign({}, oldP, {
                    leagueId: 'POOL',
                    active: false,
                    excelOrder: 0,
                    leftLeagueAt: nowGuardStr
                  });
                  parsed.players.push(restoredP);
                  const addedIdx = parsed.players.length - 1;
                  if (oldId) newById.set(oldId, addedIdx);
                  if (oldUser) newByUser.set(oldUser, addedIdx);
                }
              } else {
                const oldHasTrophies = Array.isArray(oldP.trophies) && oldP.trophies.length > 0;
                const oldHasHist = oldP.historicalStats && typeof oldP.historicalStats === 'object' && Object.keys(oldP.historicalStats).length > 0;
                const curPl = parsed.players[matchedIdx];
                const curHasTrophies = Array.isArray(curPl.trophies) && curPl.trophies.length > 0;
                const curHasHist = curPl.historicalStats && typeof curPl.historicalStats === 'object' && Object.keys(curPl.historicalStats).length > 0;
                if ((oldHasTrophies || oldHasHist) && !curHasTrophies && !curHasHist) {
                  if (oldHasTrophies) curPl.trophies = oldP.trophies;
                  if (oldHasHist) curPl.historicalStats = oldP.historicalStats;
                  if (oldP.historicalArchiveName && !curPl.historicalArchiveName) curPl.historicalArchiveName = oldP.historicalArchiveName;
                  if (oldP.playedBefore) curPl.playedBefore = true;
                }
              }
            });
          }
          if (Array.isArray(parsed.directMessages)) {
            parsed.directMessages.forEach((dmItem) => {
              if (!dmItem || typeof dmItem !== 'object') return;
              if (typeof dmItem.senderAvatar === 'string' && dmItem.senderAvatar.length > 512 && dmItem.senderAvatar.startsWith('data:image/')) {
                dmItem.senderAvatar = '';
              }
              if (typeof dmItem.recipientAvatar === 'string' && dmItem.recipientAvatar.length > 512 && dmItem.recipientAvatar.startsWith('data:image/')) {
                dmItem.recipientAvatar = '';
              }
            });
          }
          if (Array.isArray(parsed.chatMessages)) {
            parsed.chatMessages.forEach((cmItem) => {
              if (!cmItem || typeof cmItem !== 'object') return;
              if (typeof cmItem.senderAvatar === 'string' && cmItem.senderAvatar.length > 512 && cmItem.senderAvatar.startsWith('data:image/')) {
                cmItem.senderAvatar = '';
              }
            });
          }
          bodyToWrite = JSON.stringify(parsed);
          fs.writeFileSync(DB_FILE, bodyToWrite, 'utf8');
          saveDailySnapshotLocal(bodyToWrite);
          dispatchWebPushDiffLocal(prevDb, parsed);
          return sendJson(res, 200, { ok: true, updatedAt: new Date().toISOString() });
        } catch (err) {
          return sendJson(res, 400, { ok: false, error: 'Błąd zapisu JSON.' });
        }
      });
      return;
    }
  }

  // Ochrona ukrytych plików konfiguracyjnych / kluczy API w katalogu data/
  if (pathname.startsWith('/data/') && /\/(\.smpl-|secrets|tokens|webhooks|snapshots|audit\.log)/i.test(pathname)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  // Serwowanie plików statycznych (index.html, PANEL-ADMINA.html, MASTER-SZYMON-KOMENDA.html, css, js)
  let relPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(path.join(ROOT_DIR, relPath));

  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const ext = path.extname(safePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(safePath);
    const rangeHeader = req.headers && req.headers.range ? String(req.headers.range) : '';
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/^bytes=/, '').split('-');
      const start = Math.max(0, parseInt(parts[0], 10) || 0);
      const end = parts[1] ? Math.min(stat.size - 1, parseInt(parts[1], 10)) : (stat.size - 1);
      if (start >= stat.size || end < start) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Type': mime,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': (end - start) + 1
      });
      return fs.createReadStream(safePath, { start, end }).pipe(res);
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size
    });
    fs.createReadStream(safePath).pipe(res);
  } else {
    // Fallback do index.html
    const indexPath = path.join(ROOT_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
  }
});

server.listen(PORT, () => {
  console.log(`============================================================`);
  console.log(`  SCORE MATCH LIGA — OFICJALNA POLSKA LIGA SCORE! MATCH (WSZYSTKIE SEZONY)`);
  console.log(`  Serwer działa na porcie: ${PORT}`);
  console.log(`  - Link dla Graczy:          http://localhost:${PORT}/index.html`);
  console.log(`  - Link dla Współadminów:    http://localhost:${PORT}/PANEL-ADMINA.html`);
  console.log(`  - Link Master (Szymon):     http://localhost:${PORT}/MASTER-SZYMON-KOMENDA.html`);
  console.log(`============================================================`);
});
