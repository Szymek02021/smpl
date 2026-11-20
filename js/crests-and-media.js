/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Moduł Herbów Ligowych (Ekstraklasa, 2. Liga, 3. Liga) oraz Generatorów Graficznych
 * (Realistyczne zrzuty ekranu z gry Score! Match, składy i awatary graczy)
 */

window.SMPL_MEDIA = (function () {
  // 1. HERBY 3 POZIOMÓW ROZGRYWKOWYCH (Ultra-detaliczne wektorowe herby e-sportowe SVG Data URI)
  function createEkstraklasaCrestSVG() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280">
      <defs>
        <linearGradient id="ekGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFF3B0"/>
          <stop offset="28%" stop-color="#D4AF37"/>
          <stop offset="55%" stop-color="#AA7C11"/>
          <stop offset="80%" stop-color="#F3E5AB"/>
          <stop offset="100%" stop-color="#8A620A"/>
        </linearGradient>
        <linearGradient id="ekBurgundy" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#9E192A"/>
          <stop offset="50%" stop-color="#6B0F1A"/>
          <stop offset="100%" stop-color="#2D0409"/>
        </linearGradient>
        <radialGradient id="ekGlow" cx="50%" cy="42%" r="50%">
          <stop offset="0%" stop-color="#D4AF37" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#6B0F1A" stop-opacity="0"/>
        </radialGradient>
        <filter id="dropShadowEk" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.75"/>
        </filter>
      </defs>
      <!-- Outer Glow -->
      <circle cx="120" cy="135" r="105" fill="url(#ekGlow)"/>
      <!-- 3 Championship Stars -->
      <g fill="url(#ekGold)" filter="url(#dropShadowEk)">
        <polygon points="120,6 125,18 138,18 127,26 131,38 120,30 109,38 113,26 102,18 115,18"/>
        <polygon points="75,18 79,27 89,27 81,33 84,42 75,36 66,42 69,33 61,27 71,27"/>
        <polygon points="165,18 169,27 179,27 171,33 174,42 165,36 156,42 159,33 151,27 161,27"/>
      </g>
      <!-- Royal Crown -->
      <path d="M82,58 L92,38 L120,50 L148,38 L158,58 Z" fill="url(#ekGold)" stroke="#3A2500" stroke-width="1.5"/>
      <!-- Outer Shield Gold Frame -->
      <path d="M36,62 L204,62 L204,148 C204,205 120,248 120,248 C120,248 36,205 36,148 Z" fill="url(#ekGold)" filter="url(#dropShadowEk)"/>
      <!-- Inner Shield Burgundy -->
      <path d="M46,70 L194,70 L194,146 C194,196 120,236 120,236 C120,236 46,196 46,146 Z" fill="url(#ekBurgundy)" stroke="url(#ekGold)" stroke-width="2"/>
      <!-- Diagonal Royal Stripes -->
      <path d="M60,72 L95,72 L52,155 L52,115 Z" fill="#D4AF37" fill-opacity="0.12"/>
      <path d="M125,72 L160,72 L85,205 L65,190 Z" fill="#D4AF37" fill-opacity="0.12"/>
      <!-- Eagle / Trophy Wing Motif -->
      <path d="M62,112 C82,102 102,108 120,122 C138,108 158,102 178,112 C166,132 146,142 120,146 C94,142 74,132 62,112 Z" fill="url(#ekGold)" opacity="0.9"/>
      <!-- Center Football Emblem -->
      <circle cx="120" cy="136" r="28" fill="#1A0508" stroke="url(#ekGold)" stroke-width="3.5"/>
      <polygon points="120,119 131,127 127,140 113,140 109,127" fill="url(#ekGold)"/>
      <circle cx="120" cy="136" r="22" fill="none" stroke="#FFF3B0" stroke-width="1" stroke-dasharray="6 4"/>
      <!-- Typography inside Shield -->
      <text x="120" y="94" text-anchor="middle" fill="#FFF3B0" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="15" letter-spacing="3">SMPL</text>
      <text x="120" y="185" text-anchor="middle" fill="url(#ekGold)" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="16" letter-spacing="1.5">EKSTRAKLASA</text>
      <text x="120" y="203" text-anchor="middle" fill="#FDE68A" font-family="Montserrat, sans-serif" font-weight="700" font-size="9.5" letter-spacing="2">SCORE! MATCH POLSKA</text>
      <!-- Bottom Ribbon -->
      <path d="M44,238 L196,238 L186,264 L54,264 Z" fill="url(#ekGold)" filter="url(#dropShadowEk)"/>
      <path d="M48,241 L192,241 L184,261 L56,261 Z" fill="#4A0810"/>
      <text x="120" y="255" text-anchor="middle" fill="#FFF3B0" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="10.5" letter-spacing="1.8">SCORE MATCH LIGA • ELITA</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function createLiga2CrestSVG() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280">
      <defs>
        <linearGradient id="l2Silver" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="30%" stop-color="#D8DEE9"/>
          <stop offset="55%" stop-color="#8E9BAE"/>
          <stop offset="80%" stop-color="#ECEFF4"/>
          <stop offset="100%" stop-color="#5E6B7E"/>
        </linearGradient>
        <linearGradient id="l2Navy" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#2563EB"/>
          <stop offset="45%" stop-color="#1E3A8A"/>
          <stop offset="100%" stop-color="#0B1536"/>
        </linearGradient>
        <radialGradient id="l2Glow" cx="50%" cy="42%" r="50%">
          <stop offset="0%" stop-color="#60A5FA" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#1E3A8A" stop-opacity="0"/>
        </radialGradient>
        <filter id="dropShadowL2" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.75"/>
        </filter>
      </defs>
      <circle cx="120" cy="135" r="105" fill="url(#l2Glow)"/>
      <!-- 2 Silver Stars -->
      <g fill="url(#l2Silver)" filter="url(#dropShadowL2)">
        <polygon points="96,14 101,25 113,25 103,32 107,44 96,37 85,44 89,32 79,25 91,25"/>
        <polygon points="144,14 149,25 161,25 151,32 155,44 144,37 133,44 137,32 127,25 139,25"/>
      </g>
      <!-- Top Crest Crown / Chevron -->
      <path d="M78,56 L120,40 L162,56 L152,64 L88,64 Z" fill="url(#l2Silver)"/>
      <!-- Outer Shield Silver Frame -->
      <path d="M36,62 L204,62 L204,148 C204,205 120,248 120,248 C120,248 36,205 36,148 Z" fill="url(#l2Silver)" filter="url(#dropShadowL2)"/>
      <!-- Inner Shield Royal Navy -->
      <path d="M46,70 L194,70 L194,146 C194,196 120,236 120,236 C120,236 46,196 46,146 Z" fill="url(#l2Navy)" stroke="url(#l2Silver)" stroke-width="2"/>
      <!-- Vertical Stadium Stripes -->
      <rect x="78" y="72" width="18" height="130" fill="#60A5FA" fill-opacity="0.1"/>
      <rect x="111" y="72" width="18" height="155" fill="#60A5FA" fill-opacity="0.12"/>
      <rect x="144" y="72" width="18" height="130" fill="#60A5FA" fill-opacity="0.1"/>
      <!-- Dynamic Silver Wings -->
      <path d="M58,118 L95,130 L95,144 L58,134 Z" fill="url(#l2Silver)"/>
      <path d="M182,118 L145,130 L145,144 L182,134 Z" fill="url(#l2Silver)"/>
      <!-- Center Football & L2 Badge -->
      <circle cx="120" cy="135" r="30" fill="#0B1536" stroke="url(#l2Silver)" stroke-width="3.5"/>
      <text x="120" y="145" text-anchor="middle" fill="url(#l2Silver)" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="28">L2</text>
      <!-- Typography -->
      <text x="120" y="94" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="15" letter-spacing="3">SMPL</text>
      <text x="120" y="186" text-anchor="middle" fill="url(#l2Silver)" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="18" letter-spacing="2">2. LIGA</text>
      <text x="120" y="204" text-anchor="middle" fill="#93C5FD" font-family="Montserrat, sans-serif" font-weight="700" font-size="9.5" letter-spacing="2">SCORE! MATCH POLSKA</text>
      <!-- Bottom Ribbon -->
      <path d="M44,238 L196,238 L186,264 L54,264 Z" fill="url(#l2Silver)" filter="url(#dropShadowL2)"/>
      <path d="M48,241 L192,241 L184,261 L56,261 Z" fill="#0F2156"/>
      <text x="120" y="255" text-anchor="middle" fill="#E2E8F0" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="10" letter-spacing="1.5">SCORE MATCH LIGA • DYWIZJA II</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function createLiga3CrestSVG() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280">
      <defs>
        <linearGradient id="l3Bronze" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FBD38D"/>
          <stop offset="30%" stop-color="#CD7F32"/>
          <stop offset="60%" stop-color="#8C4A15"/>
          <stop offset="82%" stop-color="#E6A15C"/>
          <stop offset="100%" stop-color="#5C2D08"/>
        </linearGradient>
        <linearGradient id="l3Iron" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#3F3F46"/>
          <stop offset="50%" stop-color="#27272A"/>
          <stop offset="100%" stop-color="#09090B"/>
        </linearGradient>
        <radialGradient id="l3Glow" cx="50%" cy="42%" r="50%">
          <stop offset="0%" stop-color="#CD7F32" stop-opacity="0.42"/>
          <stop offset="100%" stop-color="#27272A" stop-opacity="0"/>
        </radialGradient>
        <filter id="dropShadowL3" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.75"/>
        </filter>
      </defs>
      <circle cx="120" cy="135" r="105" fill="url(#l3Glow)"/>
      <!-- 1 Bronze Star -->
      <g fill="url(#l3Bronze)" filter="url(#dropShadowL3)">
        <polygon points="120,10 126,23 140,23 129,31 133,44 120,36 107,44 111,31 100,23 114,23"/>
      </g>
      <path d="M84,56 L120,43 L156,56 L148,64 L92,64 Z" fill="url(#l3Bronze)"/>
      <!-- Outer Shield Bronze Frame -->
      <path d="M36,62 L204,62 L204,148 C204,205 120,248 120,248 C120,248 36,205 36,148 Z" fill="url(#l3Bronze)" filter="url(#dropShadowL3)"/>
      <!-- Inner Shield Dark Iron -->
      <path d="M46,70 L194,70 L194,146 C194,196 120,236 120,236 C120,236 46,196 46,146 Z" fill="url(#l3Iron)" stroke="url(#l3Bronze)" stroke-width="2"/>
      <!-- Carbon / Iron Hex Pattern Accent -->
      <path d="M48,110 L192,110 L192,160 L48,160 Z" fill="#CD7F32" fill-opacity="0.08"/>
      <path d="M58,118 L95,130 L95,144 L58,134 Z" fill="url(#l3Bronze)"/>
      <path d="M182,118 L145,130 L145,144 L182,134 Z" fill="url(#l3Bronze)"/>
      <!-- Center Badge -->
      <circle cx="120" cy="135" r="30" fill="#18181B" stroke="url(#l3Bronze)" stroke-width="3.5"/>
      <text x="120" y="145" text-anchor="middle" fill="url(#l3Bronze)" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="28">L3</text>
      <!-- Typography -->
      <text x="120" y="94" text-anchor="middle" fill="#FDE68A" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="15" letter-spacing="3">SMPL</text>
      <text x="120" y="186" text-anchor="middle" fill="url(#l3Bronze)" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="18" letter-spacing="2">3. LIGA</text>
      <text x="120" y="204" text-anchor="middle" fill="#D4D4D8" font-family="Montserrat, sans-serif" font-weight="700" font-size="9.5" letter-spacing="2">SCORE! MATCH POLSKA</text>
      <!-- Bottom Ribbon -->
      <path d="M44,238 L196,238 L186,264 L54,264 Z" fill="url(#l3Bronze)" filter="url(#dropShadowL3)"/>
      <path d="M48,241 L192,241 L184,261 L56,261 Z" fill="#18181B"/>
      <text x="120" y="255" text-anchor="middle" fill="#FBD38D" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="10" letter-spacing="1.5">SCORE MATCH LIGA • DYWIZJA III</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function createDynamicLeagueCrestSVG(leagueId, shortLabel, primaryColor, secondaryColor) {
    const cleanId = String(leagueId || 'L4').replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'L4';
    const label = String(shortLabel || cleanId).replace(/[<>&"']/g, '').toUpperCase().slice(0, 14);
    const prim = /^#[0-9A-Fa-f]{3,8}$/.test(String(primaryColor || '')) ? String(primaryColor) : '#10B981';
    const sec = /^#[0-9A-Fa-f]{3,8}$/.test(String(secondaryColor || '')) ? String(secondaryColor) : '#064E3B';
    const gid = 'lgDyn_' + cleanId + '_' + Math.random().toString(36).slice(2, 6);
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" width="240" height="280">
      <defs>
        <linearGradient id="${gid}P" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/>
          <stop offset="35%" stop-color="${prim}"/>
          <stop offset="100%" stop-color="${sec}"/>
        </linearGradient>
        <linearGradient id="${gid}S" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${sec}"/>
          <stop offset="100%" stop-color="#070A12"/>
        </linearGradient>
        <radialGradient id="${gid}G" cx="50%" cy="42%" r="50%">
          <stop offset="0%" stop-color="${prim}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${prim}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="120" cy="135" r="105" fill="url(#${gid}G)"/>
      <path d="M84,56 L120,42 L156,56 L148,64 L92,64 Z" fill="url(#${gid}P)"/>
      <path d="M36,62 L204,62 L204,148 C204,205 120,248 120,248 C120,248 36,205 36,148 Z" fill="url(#${gid}P)"/>
      <path d="M46,70 L194,70 L194,146 C194,196 120,236 120,236 C120,236 46,196 46,146 Z" fill="url(#${gid}S)" stroke="${prim}" stroke-width="2"/>
      <circle cx="120" cy="135" r="30" fill="#0B1120" stroke="${prim}" stroke-width="3.5"/>
      <text x="120" y="145" text-anchor="middle" fill="${prim}" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="26">${cleanId}</text>
      <text x="120" y="94" text-anchor="middle" fill="#E2E8F0" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="15" letter-spacing="3">SMPL</text>
      <text x="120" y="186" text-anchor="middle" fill="${prim}" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="16" letter-spacing="1.5">${label}</text>
      <text x="120" y="204" text-anchor="middle" fill="#CBD5E1" font-family="Montserrat, sans-serif" font-weight="700" font-size="9.5" letter-spacing="2">SCORE! MATCH POLSKA</text>
      <path d="M44,238 L196,238 L186,264 L54,264 Z" fill="${prim}"/>
      <path d="M48,241 L192,241 L184,261 L56,261 Z" fill="#0B1120"/>
      <text x="120" y="255" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="10" letter-spacing="1.5">SCORE MATCH LIGA • ${cleanId}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const DEFAULT_CRESTS = {
    L1: createEkstraklasaCrestSVG(),
    L2: createLiga2CrestSVG(),
    L3: createLiga3CrestSVG()
  };

  function getDefaultCrest(leagueId, leagueObj) {
    const lid = String(leagueId || 'L2').toUpperCase();
    if (DEFAULT_CRESTS[lid]) return DEFAULT_CRESTS[lid];
    const cacheKey = lid + '|' + ((leagueObj && leagueObj.shortName) || '') + '|' + ((leagueObj && leagueObj.primaryColor) || '');
    if (!DEFAULT_CRESTS[cacheKey]) {
      DEFAULT_CRESTS[cacheKey] = createDynamicLeagueCrestSVG(
        lid,
        (leagueObj && leagueObj.shortName) || lid,
        leagueObj && leagueObj.primaryColor,
        leagueObj && leagueObj.secondaryColor
      );
    }
    return DEFAULT_CRESTS[cacheKey];
  }

  // 2. GENERATOR AWATARÓW GRACZY (E-Sportowe portrety / tarcze z inicjałami i barwami)
  const AVATAR_PALETTES = [
    ['#1E3A8A', '#3B82F6', '#93C5FD'],
    ['#6B0F1A', '#E11D48', '#FDA4AF'],
    ['#065F46', '#10B981', '#6EE7B7'],
    ['#581C87', '#9333EA', '#D8B4FE'],
    ['#7C2D12', '#EA580C', '#FDBA74'],
    ['#0F172A', '#0284C7', '#7DD3FC'],
    ['#78350F', '#D97706', '#FDE68A'],
    ['#1F2937', '#6366F1', '#A5B4FC']
  ];

  function generatePlayerAvatar(name, nick, index = 0) {
    const parts = (name || 'Gracz SMPL').trim().split(/\s+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (name || 'SM').substring(0, 2).toUpperCase();
    const pal = AVATAR_PALETTES[Math.abs(index) % AVATAR_PALETTES.length];
    const jerseyNum = ((index * 7 + 9) % 98) + 1;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
      <defs>
        <linearGradient id="bg_${index}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${pal[0]}"/>
          <stop offset="100%" stop-color="#070A12"/>
        </linearGradient>
        <linearGradient id="accent_${index}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${pal[1]}"/>
          <stop offset="100%" stop-color="${pal[2]}"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill="url(#bg_${index})" stroke="url(#accent_${index})" stroke-width="3.5"/>
      <!-- Jersey Silhouette -->
      <path d="M26,108 C28,84 42,76 60,76 C78,76 92,84 94,108" fill="${pal[1]}" fill-opacity="0.35" stroke="${pal[2]}" stroke-width="1.5"/>
      <!-- Head Silhouette -->
      <circle cx="60" cy="46" r="20" fill="${pal[1]}" fill-opacity="0.25" stroke="${pal[2]}" stroke-width="1.5"/>
      <!-- Initials -->
      <text x="60" y="54" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="22" letter-spacing="1">${initials}</text>
      <!-- Mini Jersey Number Tag -->
      <rect x="34" y="84" width="52" height="18" rx="9" fill="#070A12" fill-opacity="0.85" stroke="${pal[2]}" stroke-width="1"/>
      <text x="60" y="96" text-anchor="middle" fill="${pal[2]}" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="10">#${jerseyNum} SMPL</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // 3. GENERATOR REALISTYCZNYCH SCREENÓW MECZOWYCH Z GRY SCORE! MATCH
  function generateMatchScreenshot({
    homeName,
    awayName,
    homeNick,
    awayNick,
    homeScore,
    awayScore,
    round,
    leagueName = '2. LIGA SMPL',
    dateStr = '08.11.2026'
  }) {
    const seed = (homeName.length * 13 + awayName.length * 7 + Number(round || 1)) % 20;
    const homePoss = 44 + (seed % 15);
    const awayPoss = 100 - homePoss;
    const homeShots = Math.max(Number(homeScore) + 1, 3 + (seed % 5));
    const awayShots = Math.max(Number(awayScore) + 1, 2 + ((seed + 3) % 5));
    const homeOnTarget = Math.max(Number(homeScore), Math.min(homeShots, Number(homeScore) + 2));
    const awayOnTarget = Math.max(Number(awayScore), Math.min(awayShots, Number(awayScore) + 1));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 900" width="540" height="900">
      <defs>
        <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0A192F"/>
          <stop offset="30%" stop-color="#0D3B2E"/>
          <stop offset="70%" stop-color="#07221B"/>
          <stop offset="100%" stop-color="#050811"/>
        </linearGradient>
        <linearGradient id="goldBar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D4AF37"/>
          <stop offset="50%" stop-color="#FFF3B0"/>
          <stop offset="100%" stop-color="#AA7C11"/>
        </linearGradient>
      </defs>
      <!-- Background Stadium & Pitch -->
      <rect width="540" height="900" fill="url(#pitchGrad)"/>
      <!-- Stadium Spotlights -->
      <circle cx="90" cy="80" r="140" fill="#60A5FA" fill-opacity="0.15"/>
      <circle cx="450" cy="80" r="140" fill="#D4AF37" fill-opacity="0.15"/>
      <!-- Pitch Lines -->
      <rect x="30" y="180" width="480" height="660" fill="none" stroke="#10B981" stroke-opacity="0.18" stroke-width="2"/>
      <circle cx="270" cy="510" r="85" fill="none" stroke="#10B981" stroke-opacity="0.18" stroke-width="2"/>
      <line x1="30" y1="510" x2="510" y2="510" stroke="#10B981" stroke-opacity="0.18" stroke-width="2"/>

      <!-- Top Game Header -->
      <rect x="20" y="24" width="500" height="66" rx="14" fill="#070A12" fill-opacity="0.9" stroke="#334155" stroke-width="1.5"/>
      <text x="270" y="52" text-anchor="middle" fill="url(#goldBar)" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="18" letter-spacing="3">SCORE! MATCH • KONIEC MECZU</text>
      <text x="270" y="74" text-anchor="middle" fill="#94A3B8" font-family="Montserrat, sans-serif" font-weight="700" font-size="12" letter-spacing="1.5">${leagueName} • KOLEJKA ${round} • ${dateStr}</text>

      <!-- Scoreboard Card -->
      <rect x="24" y="110" width="492" height="210" rx="20" fill="#0D1322" fill-opacity="0.95" stroke="#3B82F6" stroke-opacity="0.5" stroke-width="2"/>
      <rect x="195" y="122" width="150" height="26" rx="13" fill="#1E3A8A"/>
      <text x="270" y="139" text-anchor="middle" fill="#E2E8F0" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="11" letter-spacing="1.5">WYNIK KOŃCOWY</text>

      <!-- Home Player -->
      <circle cx="110" cy="200" r="36" fill="#1E3A8A" stroke="#60A5FA" stroke-width="3"/>
      <text x="110" y="208" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="20">DOM</text>
      <text x="110" y="262" text-anchor="middle" fill="#FFFFFF" font-family="Montserrat, sans-serif" font-weight="800" font-size="14">${homeName}</text>
      <text x="110" y="282" text-anchor="middle" fill="#60A5FA" font-family="Montserrat, sans-serif" font-weight="600" font-size="11">@${homeNick || 'Gracz1'}</text>

      <!-- Score Digits -->
      <rect x="195" y="166" width="64" height="74" rx="12" fill="#070A12" stroke="#D4AF37" stroke-width="2"/>
      <text x="227" y="218" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="42">${homeScore}</text>
      <text x="270" y="212" text-anchor="middle" fill="#D4AF37" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="28">:</text>
      <rect x="281" y="166" width="64" height="74" rx="12" fill="#070A12" stroke="#D4AF37" stroke-width="2"/>
      <text x="313" y="218" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="42">${awayScore}</text>

      <!-- Away Player -->
      <circle cx="430" cy="200" r="36" fill="#6B0F1A" stroke="#F43F5E" stroke-width="3"/>
      <text x="430" y="208" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="20">GOŚ</text>
      <text x="430" y="262" text-anchor="middle" fill="#FFFFFF" font-family="Montserrat, sans-serif" font-weight="800" font-size="14">${awayName}</text>
      <text x="430" y="282" text-anchor="middle" fill="#FDA4AF" font-family="Montserrat, sans-serif" font-weight="600" font-size="11">@${awayNick || 'Gracz2'}</text>

      <!-- Match Statistics Panel -->
      <rect x="24" y="344" width="492" height="420" rx="20" fill="#0D1322" fill-opacity="0.92" stroke="#1E293B" stroke-width="2"/>
      <text x="270" y="384" text-anchor="middle" fill="#D4AF37" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="15" letter-spacing="2">STATYSTYKI MECZOWE SCORE! MATCH</text>

      <!-- Stat 1: Possession -->
      <text x="60" y="430" fill="#60A5FA" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">${homePoss}%</text>
      <text x="270" y="430" text-anchor="middle" fill="#CBD5E1" font-family="Montserrat, sans-serif" font-weight="700" font-size="13">POSIADANIE PIŁKI</text>
      <text x="480" y="430" text-anchor="end" fill="#F43F5E" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">${awayPoss}%</text>
      <rect x="60" y="442" width="420" height="10" rx="5" fill="#1E293B"/>
      <rect x="60" y="442" width="${Math.round(4.2 * homePoss)}" height="10" rx="5" fill="#3B82F6"/>

      <!-- Stat 2: Shots -->
      <text x="60" y="495" fill="#60A5FA" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">${homeShots}</text>
      <text x="270" y="495" text-anchor="middle" fill="#CBD5E1" font-family="Montserrat, sans-serif" font-weight="700" font-size="13">STRZAŁY OGÓŁEM</text>
      <text x="480" y="495" text-anchor="end" fill="#F43F5E" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">${awayShots}</text>
      <rect x="60" y="507" width="420" height="10" rx="5" fill="#1E293B"/>
      <rect x="60" y="507" width="${Math.round(420 * (homeShots / (homeShots + awayShots)))}" height="10" rx="5" fill="#3B82F6"/>

      <!-- Stat 3: Shots on Target -->
      <text x="60" y="560" fill="#60A5FA" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">${homeOnTarget}</text>
      <text x="270" y="560" text-anchor="middle" fill="#CBD5E1" font-family="Montserrat, sans-serif" font-weight="700" font-size="13">STRZAŁY CELNE</text>
      <text x="480" y="560" text-anchor="end" fill="#F43F5E" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">${awayOnTarget}</text>
      <rect x="60" y="572" width="420" height="10" rx="5" fill="#1E293B"/>
      <rect x="60" y="572" width="${Math.round(420 * (homeOnTarget / Math.max(1, homeOnTarget + awayOnTarget)))}" height="10" rx="5" fill="#10B981"/>

      <!-- Stat 4: Pass Accuracy -->
      <text x="60" y="625" fill="#60A5FA" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">88%</text>
      <text x="270" y="625" text-anchor="middle" fill="#CBD5E1" font-family="Montserrat, sans-serif" font-weight="700" font-size="13">CELNOŚĆ PODAŃ</text>
      <text x="480" y="625" text-anchor="end" fill="#F43F5E" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="16">84%</text>
      <rect x="60" y="637" width="420" height="10" rx="5" fill="#1E293B"/>
      <rect x="60" y="637" width="218" height="10" rx="5" fill="#D4AF37"/>

      <!-- Clean Sheet Badge if applicable -->
      <rect x="60" y="675" width="420" height="58" rx="12" fill="#070A12" stroke="#334155" stroke-width="1"/>
      <text x="270" y="700" text-anchor="middle" fill="#10B981" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="12" letter-spacing="1">
        ${Number(homeScore) === 0 || Number(awayScore) === 0 ? '🧤 ZAREJESTROWANO CZYSTE KONTO (ŻELAZNA KURTYNA +1)' : '⚽ MECZ ZWERYFIKOWANY SYSTEMEM SCORE MATCH LIGA'}
      </text>
      <text x="270" y="720" text-anchor="middle" fill="#64748B" font-family="Montserrat, sans-serif" font-weight="600" font-size="11">ID Weryfikacji: SML-R${round}-${Math.abs(seed * 97 + 1042)}</text>

      <!-- Footer Stamp -->
      <rect x="24" y="786" width="492" height="80" rx="16" fill="#070A12" fill-opacity="0.9" stroke="#D4AF37" stroke-opacity="0.4" stroke-width="1.5"/>
      <text x="270" y="820" text-anchor="middle" fill="#E2E8F0" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="13" letter-spacing="2">OFICJALNY DOWÓD MECZOWY • SCORE MATCH LIGA</text>
      <text x="270" y="844" text-anchor="middle" fill="#94A3B8" font-family="Montserrat, sans-serif" font-weight="600" font-size="11">Zrzut ekranu z gry Score! Match przesłany przez panel gracza</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // 4. GENERATOR ZRZUTU EKRANU PROFILU I SKŁADU GRACZA (DO WERYFIKACJI REKRUTACYJNEJ)
  function generateSquadScreenshot({
    playerName,
    nick,
    formation = '4-3-3',
    stars = 'Arena 10 • Infinity',
    gamesPlayed = 4820,
    winRate = '64.8%'
  }) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 900" width="540" height="900">
      <defs>
        <linearGradient id="squadPitch" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#071120"/>
          <stop offset="35%" stop-color="#0A3622"/>
          <stop offset="85%" stop-color="#072819"/>
          <stop offset="100%" stop-color="#050811"/>
        </linearGradient>
      </defs>
      <rect width="540" height="900" fill="url(#squadPitch)"/>
      <!-- Header Profile Card -->
      <rect x="20" y="20" width="500" height="165" rx="18" fill="#0D1322" stroke="#D4AF37" stroke-width="2"/>
      <circle cx="80" cy="85" r="38" fill="#1E3A8A" stroke="#D4AF37" stroke-width="3"/>
      <text x="80" y="92" text-anchor="middle" fill="#FFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="18">MAX</text>
      <text x="140" y="62" fill="#D4AF37" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="13" letter-spacing="2">PROFIL GRACZA SCORE! MATCH</text>
      <text x="140" y="90" fill="#FFFFFF" font-family="Montserrat, sans-serif" font-weight="900" font-size="20">${playerName}</text>
      <text x="140" y="112" fill="#60A5FA" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="700" font-size="13">NICK: ${nick} • ${stars}</text>

      <!-- Mini Profile Stats -->
      <rect x="40" y="132" width="140" height="38" rx="8" fill="#070A12" stroke="#334155"/>
      <text x="110" y="156" text-anchor="middle" fill="#E2E8F0" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="700" font-size="11">MECZE: ${gamesPlayed}</text>
      <rect x="200" y="132" width="140" height="38" rx="8" fill="#070A12" stroke="#334155"/>
      <text x="270" y="156" text-anchor="middle" fill="#10B981" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="700" font-size="11">WYGRANE: ${winRate}</text>
      <rect x="360" y="132" width="140" height="38" rx="8" fill="#070A12" stroke="#334155"/>
      <text x="430" y="156" text-anchor="middle" fill="#FBBF24" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="700" font-size="11">TAKTYKA: ${formation}</text>

      <!-- Tactical Pitch Box -->
      <rect x="30" y="205" width="480" height="585" rx="16" fill="#0B3B24" fill-opacity="0.7" stroke="#10B981" stroke-opacity="0.4" stroke-width="2"/>
      <line x1="30" y1="497" x2="510" y2="497" stroke="#10B981" stroke-opacity="0.3" stroke-width="2"/>
      <circle cx="270" cy="497" r="65" fill="none" stroke="#10B981" stroke-opacity="0.3" stroke-width="2"/>
      <rect x="145" y="205" width="250" height="85" fill="none" stroke="#10B981" stroke-opacity="0.3" stroke-width="2"/>
      <rect x="145" y="705" width="250" height="85" fill="none" stroke="#10B981" stroke-opacity="0.3" stroke-width="2"/>

      <!-- Forwards (3) -->
      <g font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="11" text-anchor="middle">
        <circle cx="120" cy="290" r="26" fill="#6B0F1A" stroke="#D4AF37" stroke-width="2.5"/>
        <text x="120" y="294" fill="#FFF">JET 10</text>
        <text x="120" y="332" fill="#FDE68A">★ MAX</text>

        <circle cx="270" cy="260" r="28" fill="#D4AF37" stroke="#FFF" stroke-width="3"/>
        <text x="270" y="264" fill="#070A12">KAPITAN</text>
        <text x="270" y="304" fill="#FFF">HAMMER 10 (C)</text>

        <circle cx="420" cy="290" r="26" fill="#6B0F1A" stroke="#D4AF37" stroke-width="2.5"/>
        <text x="420" y="294" fill="#FFF">POACHER</text>
        <text x="420" y="332" fill="#FDE68A">★ LVL 10</text>

        <!-- Midfielders (3) -->
        <circle cx="135" cy="455" r="25" fill="#1E3A8A" stroke="#60A5FA" stroke-width="2.5"/>
        <text x="135" y="459" fill="#FFF">GUARD 10</text>

        <circle cx="270" cy="485" r="25" fill="#1E3A8A" stroke="#60A5FA" stroke-width="2.5"/>
        <text x="270" y="489" fill="#FFF">COMMAND</text>

        <circle cx="405" cy="455" r="25" fill="#1E3A8A" stroke="#60A5FA" stroke-width="2.5"/>
        <text x="405" y="459" fill="#FFF">PRODUCER</text>

        <!-- Defenders (4) -->
        <circle cx="85" cy="615" r="24" fill="#0F172A" stroke="#38BDF8" stroke-width="2"/>
        <text x="85" y="619" fill="#FFF">EXPLORER</text>

        <circle cx="205" cy="630" r="24" fill="#0F172A" stroke="#38BDF8" stroke-width="2"/>
        <text x="205" y="634" fill="#FFF">VOYAGER</text>

        <circle cx="335" cy="630" r="24" fill="#0F172A" stroke="#38BDF8" stroke-width="2"/>
        <text x="335" y="634" fill="#FFF">RAIDER 10</text>

        <circle cx="455" cy="615" r="24" fill="#0F172A" stroke="#38BDF8" stroke-width="2"/>
        <text x="455" y="619" fill="#FFF">INTRUDER</text>

        <!-- Goalkeeper (1) -->
        <circle cx="270" cy="735" r="25" fill="#065F46" stroke="#34D399" stroke-width="2.5"/>
        <text x="270" y="739" fill="#FFF">STOPPER 10</text>
      </g>

      <!-- Footer Verification -->
      <rect x="30" y="810" width="480" height="65" rx="14" fill="#0D1322" stroke="#334155" stroke-width="1.5"/>
      <text x="270" y="838" text-anchor="middle" fill="#D4AF37" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="13" letter-spacing="1.5">WERYFIKACJA SKŁADU • SCORE MATCH LIGA</text>
      <text x="270" y="858" text-anchor="middle" fill="#94A3B8" font-family="Montserrat, sans-serif" font-weight="600" font-size="11">Zgłoszenie kandydata: ${playerName} (${nick})</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const BANNER_ASSETS = {
    authArena: './img/auth-arena-bg.jpg',
    portalStadium: './img/portal-stadium-bg.jpg',
    heroRegistration: './img/hero-registration-banner.jpg',
    goldenBall: './img/golden-ball-bg.jpg',
    matchArena: './img/match-arena-banner.jpg',
    hallOfFame: './img/hall-of-fame-bg.jpg',
    utCardFoil: './img/ut-card-foil-bg.jpg',
    vanessaAvatar: './img/vanessa-ai-emblem.jpg'
  };

  function getBannerAsset(key) {
    return BANNER_ASSETS[key] || BANNER_ASSETS.portalStadium;
  }

  function escapeSvgText(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const CLAN_EMBLEM_CACHE = {};
  function createClanEmblemSVG(clanName, clanTag, primaryColor, secondaryColor) {
    const cleanName = String(clanName || 'Klan SMPL').trim();
    const fallbackTag = cleanName
      .replace(/[^A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż ]/g, '')
      .trim()
      .slice(0, 4)
      .toUpperCase() || 'SMPL';
    const tag = String(clanTag || fallbackTag).trim().toUpperCase().slice(0, 6);
    const prim = /^#[0-9A-Fa-f]{6}$/.test(String(primaryColor || '')) ? String(primaryColor) : '#10B981';
    const sec = /^#[0-9A-Fa-f]{6}$/.test(String(secondaryColor || '')) ? String(secondaryColor) : '#064E3B';
    const key = cleanName + '|' + tag + '|' + prim + '|' + sec;
    if (CLAN_EMBLEM_CACHE[key]) return CLAN_EMBLEM_CACHE[key];

    const gid = 'cl_' + Math.abs(tag.split('').reduce(function (acc, c) { return ((acc << 5) - acc + c.charCodeAt(0)) | 0; }, 17)).toString(36);
    const shortTitle = cleanName.length > 14 ? cleanName.slice(0, 12) + '..' : cleanName;
    const tagFontSize = tag.length >= 5 ? 18 : 22;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 200" width="180" height="200">
      <defs>
        <linearGradient id="${gid}_rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="28%" stop-color="${prim}"/>
          <stop offset="68%" stop-color="#D4AF37"/>
          <stop offset="100%" stop-color="${prim}"/>
        </linearGradient>
        <linearGradient id="${gid}_bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${prim}" stop-opacity="0.92"/>
          <stop offset="48%" stop-color="${sec}"/>
          <stop offset="100%" stop-color="#070A12"/>
        </linearGradient>
        <radialGradient id="${gid}_glow" cx="50%" cy="40%" r="55%">
          <stop offset="0%" stop-color="${prim}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#070A12" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="90" cy="98" r="80" fill="url(#${gid}_glow)"/>
      <polygon points="90,8 94,18 105,18 96,24 99,34 90,28 81,34 84,24 75,18 86,18" fill="#FDE68A"/>
      <path d="M26,38 L154,38 L154,106 C154,152 90,186 90,186 C90,186 26,152 26,106 Z" fill="url(#${gid}_rim)"/>
      <path d="M33,45 L147,45 L147,104 C147,145 90,176 90,176 C90,176 33,145 33,104 Z" fill="url(#${gid}_bg)" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="1.5"/>
      <path d="M40,46 L72,46 L40,118 Z" fill="#FFFFFF" fill-opacity="0.1"/>
      <circle cx="90" cy="95" r="32" fill="#070A12" fill-opacity="0.72" stroke="url(#${gid}_rim)" stroke-width="2.5"/>
      <polygon points="90,71 102,80 98,95 82,95 78,80" fill="${prim}" fill-opacity="0.28"/>
      <text x="90" y="102" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="900" font-size="${tagFontSize}" letter-spacing="1">${escapeSvgText(tag)}</text>
      <text x="90" y="62" text-anchor="middle" fill="#FDE68A" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="9" letter-spacing="1.5">KLAN SMPL</text>
      <path d="M24,142 L156,142 L148,166 L32,166 Z" fill="url(#${gid}_rim)"/>
      <path d="M28,145 L152,145 L146,163 L34,163 Z" fill="#070A12"/>
      <text x="90" y="158" text-anchor="middle" fill="#FFFFFF" font-family="'Exo 2', 'Space Grotesk', sans-serif" font-weight="800" font-size="9.5" letter-spacing="0.8">${escapeSvgText(shortTitle.toUpperCase())}</text>
    </svg>`;
    CLAN_EMBLEM_CACHE[key] = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    return CLAN_EMBLEM_CACHE[key];
  }

  return {
    DEFAULT_CRESTS,
    getDefaultCrest,
    createDynamicLeagueCrestSVG,
    createClanEmblemSVG,
    BANNER_ASSETS,
    getBannerAsset,
    generatePlayerAvatar,
    generateMatchScreenshot,
    generateSquadScreenshot
  };
})();
