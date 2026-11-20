/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * System Rang Zawodników (auto-awans na podstawie kariery S1–S56)
 * + Tytuły specjalne nadawane przez Administrację
 * + Oznaczanie graczy na czacie (@nick)
 */

window.SMPL_RANKS = (function () {
  // ---------------------------------------------------------------------------
  // 1. DYNAMICZNY SYSTEM ODZNAK PRESTIŻU (5 RANG LIQUID GLASS)
  // ---------------------------------------------------------------------------
  const GLASS_ORDER = [
    'LEGEND_MISTRZ',
    'ELITE_SNIPER',
    'IRON_DEFENSE',
    'VETERAN_PILLAR',
    'ROOKIE_BLOOD'
  ];

  const GLASS_BADGES = {
    LEGEND_MISTRZ: {
      id: 'LEGEND_MISTRZ',
      order: 1,
      icon: '👑',
      displayIcon: '👑',
      name: 'Legenda Ligi (Mistrz)',
      shortName: 'Legenda Ligi',
      css: 'rk-glass-legend',
      ringCss: 'rk-ring-glass-legend',
      nameCss: 'rk-name-glass-legend',
      criteriaLabel: 'Aktualny Mistrz / Lider Ekstraklasy',
      unlockHint: 'Zdobądź tytuł Mistrza lub zajmuj 1. miejsce w Ekstraklasie',
      accentHex: '#fde047',
      isGlass: true
    },
    ELITE_SNIPER: {
      id: 'ELITE_SNIPER',
      order: 2,
      icon: '🔥',
      displayIcon: '🔥🎯',
      name: 'Elita / Top Snajper',
      shortName: 'Elita • Snajper',
      css: 'rk-glass-elite',
      ringCss: 'rk-ring-glass-elite',
      nameCss: 'rk-name-glass-elite',
      criteriaLabel: 'Miejsca 2–4 w tabeli lub Lider Strzelców',
      unlockHint: 'Zajmij pozycję #2–#4 w tabeli albo prowadź w klasyfikacji strzelców',
      accentHex: '#fbbf24',
      isGlass: true
    },
    IRON_DEFENSE: {
      id: 'IRON_DEFENSE',
      order: 3,
      icon: '🛡️',
      displayIcon: '🛡️🧤',
      name: 'Żelazna Defensywa',
      shortName: 'Żelazna Def.',
      css: 'rk-glass-defense',
      ringCss: 'rk-ring-glass-defense',
      nameCss: 'rk-name-glass-defense',
      criteriaLabel: 'Lider klasyfikacji „Złote Rękawice / Czyste Konta”',
      unlockHint: 'Prowadź w rankingu Czystych Kont lub zachowaj najwięcej meczów na zero',
      accentHex: '#94a3b8',
      isGlass: true
    },
    VETERAN_PILLAR: {
      id: 'VETERAN_PILLAR',
      order: 4,
      icon: '⚡',
      displayIcon: '⚡',
      name: 'Weteran / Stalowy Filar',
      shortName: 'Weteran',
      css: 'rk-glass-veteran',
      ringCss: 'rk-ring-glass-veteran',
      nameCss: 'rk-name-glass-veteran',
      criteriaLabel: 'Staż > 3 sezony lub ≥ 95% rozegranych meczów w terminie',
      unlockHint: 'Rozegraj min. 4 sezony w lidze lub utrzymaj ≥ 95% frekwencji',
      accentHex: '#fb923c',
      isGlass: true
    },
    ROOKIE_BLOOD: {
      id: 'ROOKIE_BLOOD',
      order: 5,
      icon: '🚀',
      displayIcon: '🚀',
      name: 'Debiutant / Świeża Krew',
      shortName: 'Debiutant',
      css: 'rk-glass-rookie',
      ringCss: 'rk-ring-glass-rookie',
      nameCss: 'rk-name-glass-rookie',
      criteriaLabel: 'Nowy zawodnik w 2. Lidze lub niższej dywizji',
      unlockHint: 'Dla nowych zawodników dołączających do 2. Ligi lub niższych dywizji (staż ≤ 3 sez.)',
      accentHex: '#38bdf8',
      isGlass: true
    }
  };

  // ---------------------------------------------------------------------------
  // 2. DRABINKA KARIERY XP (S1–S56) + RANGI FUNKCYJNE I TYTUŁY ZARZĄDU
  // ---------------------------------------------------------------------------
  const TIERS = [
    { id: 'ROOKIE',   minXp: 0,    icon: '🌱', name: 'Debiutant',          css: 'rk-rookie' },
    { id: 'BRONZE',   minXp: 150,  icon: '🥉', name: 'Brązowy Zawodnik',   css: 'rk-bronze' },
    { id: 'SILVER',   minXp: 350,  icon: '🥈', name: 'Srebrny Wyjadacz',   css: 'rk-silver' },
    { id: 'GOLD',     minXp: 650,  icon: '🥇', name: 'Złoty Snajper',      css: 'rk-gold' },
    { id: 'PLATINUM', minXp: 1000, icon: '💎', name: 'Platynowy Taktyk',   css: 'rk-platinum' },
    { id: 'DIAMOND',  minXp: 1500, icon: '💠', name: 'Diamentowy Kapitan', css: 'rk-diamond' },
    { id: 'MASTER',   minXp: 2100, icon: '🔥', name: 'Mistrz Boiska',      css: 'rk-master' },
    { id: 'LEGEND',   minXp: 2800, icon: '👑', name: 'Legenda SMPL',       css: 'rk-legend' },
    { id: 'GOAT',     minXp: 3600, icon: '🐐', name: 'G.O.A.T. SMPL',      css: 'rk-goat' }
  ];

  // Rangi funkcyjne i dyscyplinarne — ponad drabinką
  const SPECIAL_STATUS_RANKS = {
    BLACKLISTED: {
      id: 'BLACKLISTED',
      icon: '💀',
      displayIcon: '💀',
      name: 'CZARNA LISTA • DOŻYWOTNI BAN',
      shortName: 'DOŻYWOTNI BAN',
      css: 'rk-blacklisted',
      ringCss: 'rk-ring-blacklisted',
      nameCss: 'rk-name-blacklisted',
      criteriaLabel: 'Wykluczenie dyscyplinarne',
      desc: 'Gracz usunięty dyscyplinarnie decyzją Zarządu z dożywotnim zakazem wstępu do wszystkich lig Score Match Liga.'
    }
  };

  const ROLE_RANKS = {
    OWNER: { id: 'OWNER', icon: '⚡', displayIcon: '⚡', name: 'Właściciel Ligi', shortName: 'Właściciel', css: 'rk-owner' },
    ADMIN: { id: 'ADMIN', icon: '🛡️', displayIcon: '🛡️', name: 'Administrator', shortName: 'Admin', css: 'rk-admin' }
  };

  // Tytuły specjalne nadawane ręcznie przez Zarząd / Master Admina
  const TITLES = {
    // --- ELITA, KORONY & LEGENDY SMPL ---
    CHAMPION:       { id: 'CHAMPION',       icon: '🏆', name: 'Mistrz Sezonu',          css: 'tt-champion',    category: 'ELITE',    colorHex: '#fbbf24', xpBonus: 0, description: 'Oficjalny Mistrz Sezonu wyróżniony złotą koroną SMPL' },
    GOLDEN_BALL:    { id: 'GOLDEN_BALL',    icon: '⚽', name: 'Złota Piłka',            css: 'tt-golden-ball', category: 'ELITE',    colorHex: '#f59e0b', xpBonus: 0, description: 'Najwybitniejszy zawodnik sezonu uhonorowany Złotą Piłką SMPL' },
    GALACTICO:      { id: 'GALACTICO',      icon: '🌌', name: 'Galáctico SMPL',         css: 'tt-galactico',   category: 'ELITE',    colorHex: '#818cf8', xpBonus: 0, description: 'Absolutna supergwiazda i wizytówka Ekstraklasy Score! Match' },
    EMPEROR:        { id: 'EMPEROR',        icon: '👑', name: 'Cesarz Areny',           css: 'tt-emperor',     category: 'ELITE',    colorHex: '#f59e0b', xpBonus: 0, description: 'Niekwestionowany władca boiska i dominator rozgrywek' },
    INVINCIBLE:     { id: 'INVINCIBLE',     icon: '⚜️', name: 'Niepokonany',            css: 'tt-invincible',  category: 'ELITE',    colorHex: '#34d399', xpBonus: 0, description: 'Twierdza nie do zdobycia — seria meczów bez porażki' },
    ICON_PRIME:     { id: 'ICON_PRIME',     icon: '✨', name: 'Ikona Prime',            css: 'tt-icon-prime',  category: 'ELITE',    colorHex: '#e2e8f0', xpBonus: 0, description: 'Legenda o historycznym statusie w polskiej społeczności SM' },
    GOLDEN_BOY:     { id: 'GOLDEN_BOY',     icon: '🌟', name: 'Złoty Chłopiec',         css: 'tt-golden-boy',  category: 'ELITE',    colorHex: '#fde047', xpBonus: 0, description: 'Objawienie ligowe i największy wschodzący talent SMPL' },
    TREBLE_KING:    { id: 'TREBLE_KING',    icon: '🎖️', name: 'Król Trypletu',          css: 'tt-treble',      category: 'ELITE',    colorHex: '#fb923c', xpBonus: 0, description: 'Kolekcjoner pucharów, trofeów ligowych i turniejów specjalnych' },
    HALL_FAME:      { id: 'HALL_FAME',      icon: '🏛️', name: 'Hall of Fame',           css: 'tt-hall-fame',   category: 'ELITE',    colorHex: '#fcd34d', xpBonus: 0, description: 'Zasłużony członek Galerii Sław Score Match Liga' },

    // --- STYL GRY & KUNSZT BOISKOWY ---
    TOTW:           { id: 'TOTW',           icon: '⚡', name: 'Gwiazda Kolejki',        css: 'tt-totw',        category: 'SKILL',    colorHex: '#6366f1', xpBonus: 0, description: 'Najlepszy zawodnik minionej kolejki rozgrywek' },
    SNIPER:         { id: 'SNIPER',         icon: '🎯', name: 'Król Strzelców',         css: 'tt-sniper',      category: 'SKILL',    colorHex: '#ef4444', xpBonus: 0, description: 'Bezlitosny snajper królujący w klasyfikacji bramek' },
    CLUTCH_KING:    { id: 'CLUTCH_KING',    icon: '⏱️', name: 'Król Końcówek',         css: 'tt-clutch',      category: 'SKILL',    colorHex: '#f97316', xpBonus: 0, description: 'Zimna krew i decydujące trafienia w ostatnich sekundach' },
    TIKI_TAKA:      { id: 'TIKI_TAKA',      icon: '🎨', name: 'Maestro Tiki-Taki',      css: 'tt-tikitaka',    category: 'SKILL',    colorHex: '#06b6d4', xpBonus: 0, description: 'Wirtuoz podań, kontroli piłki i kombinacyjnej gry' },
    COUNTER_GOD:    { id: 'COUNTER_GOD',    icon: '🐆', name: 'Bóg Kontrataku',         css: 'tt-counter',     category: 'SKILL',    colorHex: '#eab308', xpBonus: 0, description: 'Zabójcza szybkość i bezbłędne wyjścia sam na sam' },
    FREEKICK_KING:  { id: 'FREEKICK_KING',  icon: '☄️', name: 'Król Rzutów Wolnych',   css: 'tt-freekick',    category: 'SKILL',    colorHex: '#ec4899', xpBonus: 0, description: 'Chirurgiczna precyzja ze stałych fragmentów gry' },
    PENALTY_KILLER: { id: 'PENALTY_KILLER', icon: '🧤', name: 'Zabójca Karnych',        css: 'tt-penalty',     category: 'SKILL',    colorHex: '#2dd4bf', xpBonus: 0, description: 'Mistrz wojny nerwów i rzutów karnych w SMPL' },
    COMEBACK_KING:  { id: 'COMEBACK_KING',  icon: '🔄', name: 'Król Powrotów',          css: 'tt-comeback',    category: 'SKILL',    colorHex: '#38bdf8', xpBonus: 0, description: 'Nigdy nie odpuszcza — odwraca losy przegranych meczów' },
    WALL:           { id: 'WALL',           icon: '🧱', name: 'Żelazna Kurtyna',        css: 'tt-wall',        category: 'SKILL',    colorHex: '#94a3b8', xpBonus: 0, description: 'Nieprzekraczalna zapora w defensywie i czyste konta' },
    GOAL_MACHINE:   { id: 'GOAL_MACHINE',   icon: '💥', name: 'Maszyna do Goli',        css: 'tt-goalmachine', category: 'SKILL',    colorHex: '#dc2626', xpBonus: 0, description: 'Niesamowity instynkt i seryjne zdobywanie bramek' },
    PLAYMAKER:      { id: 'PLAYMAKER',      icon: '🧠', name: 'Mózg Zespołu',           css: 'tt-playmaker',   category: 'SKILL',    colorHex: '#a78bfa', xpBonus: 0, description: 'Genialna wizja gry, ustawienie i czytanie rywala' },
    SPEED_DEMON:    { id: 'SPEED_DEMON',    icon: '💨', name: 'Demon Prędkości',        css: 'tt-speed',       category: 'SKILL',    colorHex: '#22d3ee', xpBonus: 0, description: 'Najszybsze skrzydła i nieuchwytne rajdy po linii' },
    DERBY_LORD:     { id: 'DERBY_LORD',     icon: '🔥', name: 'Król Derbów',            css: 'tt-derby',       category: 'SKILL',    colorHex: '#f43f5e', xpBonus: 0, description: 'Największy wojownik ligowych hitów kolejki i derbów' },

    // --- PRESTIŻ, WETERANI & SPOŁECZNOŚĆ ---
    VIP:            { id: 'VIP',            icon: '💜', name: 'VIP SMPL',               css: 'tt-vip',         category: 'PRESTIGE', colorHex: '#a855f7', xpBonus: 0, description: 'Oficjalny status VIP oraz szczególne wyróżnienie Zarządu' },
    VETERAN_OG:     { id: 'VETERAN_OG',     icon: '🛡️', name: 'Weteran OG S1+',         css: 'tt-veteran-og',  category: 'PRESTIGE', colorHex: '#fb923c', xpBonus: 0, description: 'Pionier i wielosezonowy filar polskiej sceny Score Match' },
    CAPTAIN_CLAN:   { id: 'CAPTAIN_CLAN',   icon: '⚔️', name: 'Kapitan Klanu',          css: 'tt-captain',     category: 'PRESTIGE', colorHex: '#10b981', xpBonus: 0, description: 'Charyzmatyczny lider drużyny klanowej SMPL' },
    TOURNAMENT_PRO: { id: 'TOURNAMENT_PRO', icon: '🏟️', name: 'Gladiator Pucharów',     css: 'tt-gladiator',   category: 'PRESTIGE', colorHex: '#f59e0b', xpBonus: 0, description: 'Specjalista od drabinek pucharowych i turniejów weekendowych' },
    FAIRPLAY:       { id: 'FAIRPLAY',       icon: '🤝', name: 'Ambasador Fair Play',    css: 'tt-fairplay',    category: 'PRESTIGE', colorHex: '#10b981', xpBonus: 0, description: 'Wzór kultury, punktualności i sportowej klasy na boisku' },
    ROOKIE_OTS:     { id: 'ROOKIE_OTS',     icon: '🚀', name: 'Odkrycie Sezonu',        css: 'tt-rookie',      category: 'PRESTIGE', colorHex: '#0ea5e9', xpBonus: 0, description: 'Najbardziej imponujący debiut sezonu w lidze' },
    HYPE:           { id: 'HYPE',           icon: '🎙️', name: 'Hype Man',               css: 'tt-hype',        category: 'PRESTIGE', colorHex: '#ec4899', xpBonus: 0, description: 'Dusza ligowego czatu budująca atmosferę i emocje' },
    MEDIA_STAR:     { id: 'MEDIA_STAR',     icon: '📺', name: 'Gwiazda Streamów',       css: 'tt-media',       category: 'PRESTIGE', colorHex: '#c084fc', xpBonus: 0, description: 'Twórca topowych powtórek, bramek i transmisji SMPL' },
    SCOUT_MASTER:   { id: 'SCOUT_MASTER',   icon: '🔍', name: 'Łowca Talentów',         css: 'tt-scout',       category: 'PRESTIGE', colorHex: '#14b8a6', xpBonus: 0, description: 'Wspiera rozwój nowych graczy i rekrutację do ligi' },

    // --- STATUS DYSCYPLINARNY ---
    BANNED:         { id: 'BANNED',         icon: '💀', name: 'DOŻYWOTNI BAN',          css: 'tt-banned',      category: 'STATUS',   colorHex: '#dc2626', xpBonus: 0, description: 'Dożywotnie wykluczenie z ligi decyzją Zarządu' }
  };

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function plWord(n, one, few, many) {
    const abs = Math.abs(Math.round(Number(n || 0)));
    if (abs === 1) return one;
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function isPlayerPlaceholder(player) {
    if (!player) return true;
    return Boolean(player.isPlaceholder) || /^wolny\s*los/i.test(String(player.name || '').trim());
  }

  function checkBlacklisted(player, state) {
    if (!player) return false;
    return !!(
      player.isBlacklisted ||
      player.banned ||
      player.customRank === 'BLACKLISTED' ||
      (state && state.blacklist && state.blacklist.some(function (b) {
        return (b.name && player.name && b.name.toLowerCase() === player.name.toLowerCase()) ||
               (b.nick && player.nick && b.nick.toLowerCase() === player.nick.toLowerCase());
      }))
    );
  }

  // ---------------------------------------------------------------------------
  // 3. PUNKTY KARIERY (XP) + KONTEKST DYNAMICZNYCH ODZNAK LIQUID GLASS
  // ---------------------------------------------------------------------------
  let cacheKey = null;
  let seasonPtsCache = {};
  let glassCacheKey = null;
  let glassContextCache = null;
  let glassEvalCache = {};

  function buildSeasonPoints(state) {
    const key = (state.updatedAt || '') + '|' + (state.matches || []).length + '|' +
      (state.matches || []).filter((m) => m.status === 'APPROVED' || m.status === 'WALKOVER').length;
    if (key === cacheKey) return seasonPtsCache;
    const map = {};
    (state.matches || []).forEach((m) => {
      if (m.status !== 'APPROVED' && m.status !== 'WALKOVER') return;
      const hs = Number(m.homeScore), as = Number(m.awayScore);
      if (isNaN(hs) || isNaN(as)) return;
      map[m.homeId] = (map[m.homeId] || 0) + (hs > as ? 3 : hs === as ? 1 : 0);
      map[m.awayId] = (map[m.awayId] || 0) + (as > hs ? 3 : hs === as ? 1 : 0);
    });
    cacheKey = key;
    seasonPtsCache = map;
    return map;
  }

  function normalizeHexColor(hex, fallback) {
    const val = String(hex || '').trim();
    return /^#[0-9A-Fa-f]{6}$/.test(val) ? val : (fallback || '#fbbf24');
  }

  function getTitleById(titleId, state) {
    const cleanId = String(titleId || '').trim();
    if (!cleanId) return null;
    if (TITLES[cleanId]) return TITLES[cleanId];
    const customList = state && Array.isArray(state.customRanks) ? state.customRanks : [];
    const found = customList.find((cr) => cr && cr.id === cleanId);
    if (!found) return null;
    return {
      id: found.id,
      icon: found.icon || '🌟',
      name: found.name || cleanId,
      css: found.css || 'tt-custom',
      styleVariant: found.styleVariant || 'HOLO_GOLD',
      colorHex: normalizeHexColor(found.colorHex, '#fbbf24'),
      textColor: normalizeHexColor(found.textColor, '#ffffff'),
      description: found.description || '',
      xpBonus: Number(found.xpBonus || 0),
      category: 'CUSTOM',
      isCustom: true
    };
  }

  function getAllAvailableTitles(state) {
    const list = [];
    const customList = state && Array.isArray(state.customRanks) ? state.customRanks : [];
    customList.forEach((cr) => {
      if (!cr || !cr.id) return;
      list.push({
        id: cr.id,
        icon: cr.icon || '🌟',
        name: cr.name || cr.id,
        css: cr.css || 'tt-custom',
        styleVariant: cr.styleVariant || 'HOLO_GOLD',
        colorHex: normalizeHexColor(cr.colorHex, '#fbbf24'),
        textColor: normalizeHexColor(cr.textColor, '#ffffff'),
        description: cr.description || 'Ranga własna dodana przez Master Admina',
        xpBonus: Number(cr.xpBonus || 0),
        category: 'CUSTOM',
        isCustom: true
      });
    });
    Object.keys(TITLES).forEach((key) => {
      if (key === 'BANNED') return;
      const t = TITLES[key];
      list.push({
        id: t.id,
        icon: t.icon,
        name: t.name,
        css: t.css,
        category: t.category || 'PRESTIGE',
        colorHex: normalizeHexColor(t.colorHex, '#fbbf24'),
        textColor: '#ffffff',
        description: t.description || 'Wbudowany tytuł zarządu SMPL',
        xpBonus: Number(t.xpBonus || 0),
        isCustom: false
      });
    });
    return list;
  }

  function getPlayerCustomTitleXpBonus(player, state) {
    if (!player || !state) return 0;
    let total = 0;
    const seen = {};
    const addBonus = (rid) => {
      if (!rid || seen[rid]) return;
      seen[rid] = true;
      const t = getTitleById(rid, state);
      if (t && Number(t.xpBonus || 0) > 0) {
        total += Math.min(5000, Number(t.xpBonus || 0));
      }
    };
    addBonus(player.customRank);
    if (Array.isArray(player.extraCustomRanks)) {
      player.extraCustomRanks.forEach(addBonus);
    }
    return total;
  }

  function getPlayerXp(player, state) {
    if (!player) return 0;
    const hs = player.historicalStats || {};
    const base = Number(hs.total || hs.points || 0);
    const medals = Number(hs.gold || 0) * 150 + Number(hs.silver || 0) * 80 + Number(hs.bronze || 0) * 40;
    const season = state ? (buildSeasonPoints(state)[player.id] || 0) * 2 : 0;
    const trophyBonus = (player.trophies || []).filter((t) => t.rarity === 'GOLD' || t.rarity === 'ICON').length * 25;
    const customRankXp = getPlayerCustomTitleXpBonus(player, state);
    const discipline = Number(player.penaltyPoints || 0) * 10 + Number(player.yellowCards || 0) * 15 + Number(player.redCards || 0) * 50;
    return Math.max(0, Math.round(base + medals + season + trophyBonus + customRankXp - discipline));
  }

  function getTierForXp(xp) {
    let current = TIERS[0];
    for (let i = 0; i < TIERS.length; i++) {
      if (xp >= TIERS[i].minXp) current = TIERS[i];
    }
    const idx = TIERS.indexOf(current);
    const next = TIERS[idx + 1] || null;
    const progress = next
      ? Math.min(100, Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100))
      : 100;
    return { tier: current, index: idx, next, progress, xp };
  }

  function buildGlassContext(state) {
    const safeState = state || {};
    const playedCount = (safeState.matches || []).filter(
      (m) => m.status === 'APPROVED' || m.status === 'WALKOVER'
    ).length;
    const allLeagueIds = [];
    const seenLids = {};
    const addLid = (id) => {
      if (id && !seenLids[id]) {
        seenLids[id] = true;
        allLeagueIds.push(id);
      }
    };
    if (safeState.leagues) Object.keys(safeState.leagues).forEach(addLid);
    (safeState.players || []).forEach((p) => { if (p && p.leagueId) addLid(p.leagueId); });
    if (allLeagueIds.length === 0) ['L1', 'L2'].forEach(addLid);

    const key = [
      safeState.season || 56,
      safeState.updatedAt || '',
      (safeState.players || []).length,
      (safeState.matches || []).length,
      playedCount,
      (safeState.blacklist || []).length,
      (safeState.historicalSeasons || []).length,
      allLeagueIds.join(',')
    ].join('|');

    if (key === glassCacheKey && glassContextCache) return glassContextCache;

    const engine = window.SMPL_ENGINE;
    const standingsByLeague = {};
    const rowByPlayerId = {};
    const csRankByPlayerId = {};
    const leagueMeta = {};

    allLeagueIds.forEach((lid) => {
      const rows = engine && engine.calculateStandings ? engine.calculateStandings(safeState, lid) : [];
      const csRows = engine && engine.calculateCleanSheetsRanking ? engine.calculateCleanSheetsRanking(safeState, lid) : [];
      standingsByLeague[lid] = rows;

      let totalPlayed = 0;
      let maxGoals = 0;
      rows.forEach((r) => {
        rowByPlayerId[r.playerId] = r;
        totalPlayed += Number(r.M || 0);
        if (!isPlayerPlaceholder({ name: r.name, isPlaceholder: r.player && r.player.isPlaceholder })) {
          if (Number(r.BZ || 0) > maxGoals) maxGoals = Number(r.BZ || 0);
        }
      });

      let maxCs = 0;
      csRows.forEach((c) => {
        csRankByPlayerId[c.playerId] = c;
        if (!isPlayerPlaceholder({ name: c.name }) && Number(c.cleanSheets || 0) > maxCs) {
          maxCs = Number(c.cleanSheets || 0);
        }
      });

      // Zliczamy aktywne kolejki z rozegranymi meczami (do wyliczenia frekwencji na żywo)
      const activeRoundSet = {};
      (safeState.matches || []).forEach((m) => {
        if (m.leagueId === lid && (m.status === 'APPROVED' || m.status === 'WALKOVER')) {
          activeRoundSet[Number(m.round || 0)] = true;
        }
      });
      const openedRoundsCount = Object.keys(activeRoundSet).length;

      leagueMeta[lid] = {
        totalPlayed,
        maxGoals,
        maxCs,
        openedRoundsCount
      };
    });

    // Historia sezonów (S1–S55) — aktualny Mistrz Ekstraklasy, statystyki ostatnich zakończonych sezonów oraz staż
    const rawSeasons =
      (safeState.historicalSeasons && safeState.historicalSeasons.length > 0
        ? safeState.historicalSeasons
        : (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.HISTORICAL_SEASONS)) || [];
    const sortedSeasons = [...rawSeasons].sort((a, b) => Number(b.seasonNumber || 0) - Number(a.seasonNumber || 0));

    let reigningChampion = null;
    const seasonAppearances = {};
    const lastFinishedByNameAndLeague = {};
    const lastFinishedLeagueStats = {};

    sortedSeasons.forEach((s) => {
      const sNum = Number(s.seasonNumber || 0);
      const leagues = s.leagues || {};
      Object.keys(leagues).forEach((lid) => {
        const list = leagues[lid] || [];
        if (!list.length) return;
        const maxMInTable = list.reduce((mx, r) => Math.max(mx, Number(r.M || 0)), 0);
        const isFinishedTable = maxMInTable >= 10;

        // Zliczamy liczbę sezonów ukończonych przez każdego gracza w historii
        if (isFinishedTable) {
          list.forEach((r) => {
            if (!r.name || /^wolny\s*los/i.test(r.name)) return;
            const nKey = String(r.name).trim().toLowerCase();
            if (!seasonAppearances[nKey]) seasonAppearances[nKey] = new Set();
            seasonAppearances[nKey].add(sNum);
          });
        }

        // Najnowszy zakończony Mistrz Ekstraklasy (L1)
        if (lid === 'L1' && !reigningChampion && isFinishedTable) {
          const top = list.find((r) => Number(r.pos) === 1) || list[0];
          if (top && top.name) {
            reigningChampion = {
              seasonNumber: sNum,
              name: top.name,
              nameLower: String(top.name).trim().toLowerCase(),
              pkt: Number(top.PKT || 0),
              wins: Number(top.W || 0),
              gf: Number(top.BZ || 0),
              ga: Number(top.BS || 0),
              m: Number(top.M || 0)
            };
          }
        }

        // Najnowszy zakończony sezon dla każdej dywizji (np. S54)
        if (!lastFinishedLeagueStats[lid] && isFinishedTable) {
          let maxBz = 0;
          let minBsPerMatch = Infinity;
          let minBsName = null;
          list.forEach((r) => {
            if (!r.name || /^wolny\s*los/i.test(r.name)) return;
            const bz = Number(r.BZ || 0);
            const bs = Number(r.BS || 0);
            const m = Number(r.M || 0);
            if (bz > maxBz) maxBz = bz;
            if (m >= 25) {
              const avg = bs / m;
              if (avg < minBsPerMatch) {
                minBsPerMatch = avg;
                minBsName = String(r.name).trim().toLowerCase();
              }
            }
          });
          lastFinishedLeagueStats[lid] = {
            seasonNumber: sNum,
            maxM: maxMInTable,
            maxBz,
            minBsName
          };
          list.forEach((r) => {
            if (!r.name || /^wolny\s*los/i.test(r.name)) return;
            const nKey = String(r.name).trim().toLowerCase();
            lastFinishedByNameAndLeague[nKey + '|' + lid] = {
              seasonNumber: sNum,
              leagueId: lid,
              pos: Number(r.pos || 0),
              M: Number(r.M || 0),
              W: Number(r.W || 0),
              BZ: Number(r.BZ || 0),
              BS: Number(r.BS || 0),
              PKT: Number(r.PKT || 0),
              maxMInTable
            };
          });
        }
      });
    });

    const allTimeList =
      (safeState.allTimeRanking && safeState.allTimeRanking.length > 0
        ? safeState.allTimeRanking
        : (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.ALL_TIME_RANKING)) || [];
    const careerList =
      (safeState.careerRanking && safeState.careerRanking.length > 0
        ? safeState.careerRanking
        : (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.CAREER_RANKING)) || [];
    const allTimeByName = {};
    allTimeList.forEach((a) => {
      if (a && a.name) allTimeByName[String(a.name).trim().toLowerCase()] = a;
    });
    careerList.forEach((c) => {
      if (c && c.name) {
        allTimeByName[String(c.name).trim().toLowerCase()] = c;
      }
    });

    // Wyliczamy OVR karty zawodnika raz na kontekst
    const ovrByPlayerId = {};
    (safeState.players || []).forEach((p) => {
      if (engine && engine.calculatePlayerUTCard) {
        const ut = engine.calculatePlayerUTCard(safeState, p.id);
        ovrByPlayerId[p.id] = ut ? Number(ut.ovr || 76) : 76;
      } else {
        ovrByPlayerId[p.id] = 76;
      }
    });

    glassCacheKey = key;
    glassContextCache = {
      standingsByLeague,
      rowByPlayerId,
      csRankByPlayerId,
      leagueMeta,
      reigningChampion,
      seasonAppearances,
      lastFinishedByNameAndLeague,
      lastFinishedLeagueStats,
      allTimeByName,
      ovrByPlayerId
    };
    glassEvalCache = {};
    return glassContextCache;
  }

  function evaluatePlayerGlass(player, state) {
    if (!player) return null;
    const safeState = state || {};
    const ctx = buildGlassContext(safeState);

    if (glassEvalCache[player.id]) return glassEvalCache[player.id];

    const nameLower = String(player.name || '').trim().toLowerCase();
    const isBl = checkBlacklisted(player, safeState);
    if (isBl) {
      const blRes = {
        isPlaceholder: false,
        isBlacklisted: true,
        primaryBadge: SPECIAL_STATUS_RANKS.BLACKLISTED,
        reason: 'Dożywotnie wykluczenie z rozgrywek Score Match Liga decyzją Zarządu.',
        badgeReasons: { BLACKLISTED: 'Dożywotnie wykluczenie z rozgrywek Score Match Liga decyzją Zarządu.' },
        earned: [],
        metrics: { ovr: 0, seasonsCount: 0, cleanSheets: 0, goals: 0, position: '-' }
      };
      glassEvalCache[player.id] = blRes;
      return blRes;
    }

    if (isPlayerPlaceholder(player)) {
      const phRes = {
        isPlaceholder: true,
        isBlacklisted: false,
        primaryBadge: null,
        reason: '',
        badgeReasons: {},
        earned: [],
        metrics: { ovr: 0, seasonsCount: 0, cleanSheets: 0, goals: 0, position: '-' }
      };
      glassEvalCache[player.id] = phRes;
      return phRes;
    }

    const lid = player.leagueId || 'L1';
    const lgShort =
      (safeState.leagues && safeState.leagues[lid] && safeState.leagues[lid].shortName) ||
      (lid === 'L1' ? 'Ekstraklasa' : lid === 'L2' ? '2. Liga' : '3. Liga');
    const seasonNum = Number(safeState.season || 56);
    const row = ctx.rowByPlayerId[player.id] || { position: '-', M: 0, W: 0, R: 0, P: 0, BZ: 0, BS: 0, PKT: 0, cleanSheets: 0, cleanSheetPct: 0, goalsForAvg: 0, goalsAgainstAvg: 0 };
    const meta = ctx.leagueMeta[lid] || { totalPlayed: 0, maxGoals: 0, maxCs: 0, openedRoundsCount: 0 };
    const csEntry = ctx.csRankByPlayerId[player.id];
    const hs = player.historicalStats || {};
    const at = ctx.allTimeByName[nameLower] ||
      (player.historicalArchiveName ? ctx.allTimeByName[String(player.historicalArchiveName).trim().toLowerCase()] : null) || {};
    const ovr = ctx.ovrByPlayerId[player.id] || 76;

    const histSet = ctx.seasonAppearances[nameLower];
    const histCount = histSet ? histSet.size : 0;
    const seasonsCount = Math.max(
      Number(hs.seasons || 0),
      Number(at.seasons || 0),
      histCount,
      row.M > 0 ? 1 : 0
    );

    const lastInLeague = ctx.lastFinishedByNameAndLeague[nameLower + '|' + lid] ||
      ctx.lastFinishedByNameAndLeague[nameLower + '|L1'] || null;
    const lastLgStats = lastInLeague ? ctx.lastFinishedLeagueStats[lastInLeague.leagueId] : null;

    // Frekwencja na żywo i z ostatniego ukończonego sezonu (≥ 95%)
    const liveAttendancePct = meta.openedRoundsCount >= 3
      ? Math.min(100, Math.round((Number(row.M || 0) / meta.openedRoundsCount) * 100))
      : 0;
    const lastAttendancePct = lastInLeague && lastInLeague.maxMInTable >= 20
      ? Math.min(100, Math.round((lastInLeague.M / lastInLeague.maxMInTable) * 100))
      : 0;

    const trophies = player.trophies || [];
    const goldMedals = Math.max(Number(hs.gold || 0), Number(at.gold || 0));
    const silverMedals = Math.max(Number(hs.silver || 0), Number(at.silver || 0));
    const bronzeMedals = Math.max(Number(hs.bronze || 0), Number(at.bronze || 0));
    const totalAllTimePts = Math.max(Number(hs.total || 0), Number(at.total || 0), Number(hs.points || 0), Number(at.points || 0));

    const badgeReasons = {};
    const earned = [];

    function unlock(badgeId, reasonText) {
      if (badgeReasons[badgeId]) return;
      badgeReasons[badgeId] = reasonText;
      earned.push({ badge: GLASS_BADGES[badgeId], reason: reasonText });
    }

    // 1. 👑 LEGENDA LIGI (MISTRZ)
    const champ = ctx.reigningChampion;
    const isLiveEkstraklasaLeader = lid === 'L1' && Number(row.position) === 1 && Number(row.M || 0) > 0;
    const isReigningChampion = champ && champ.nameLower === nameLower;
    if (isLiveEkstraklasaLeader && isReigningChampion) {
      unlock(
        'LEGEND_MISTRZ',
        `Mistrzostwo Ekstraklasy S${champ.seasonNumber} (${champ.pkt} pkt) oraz aktualny lider #1 w Sezonie ${seasonNum} (${row.PKT} pkt, OVR ${ovr})`
      );
    } else if (isReigningChampion) {
      unlock(
        'LEGEND_MISTRZ',
        `Mistrzostwo Ekstraklasy S${champ.seasonNumber} (${champ.pkt} pkt, ${champ.wins}Z)${goldMedals > 1 ? ` • ${goldMedals}× Złoto w karierze` : ''} • OVR ${ovr}`
      );
    } else if (isLiveEkstraklasaLeader) {
      unlock(
        'LEGEND_MISTRZ',
        `Aktualny lider #1 Ekstraklasy w Sezonie ${seasonNum} (${row.PKT} pkt, ${row.W}Z, bilans ${row.BZ}:${row.BS}) • OVR ${ovr}`
      );
    } else if (player.customRank === 'CHAMPION') {
      unlock(
        'LEGEND_MISTRZ',
        `Oficjalny Mistrz Ekstraklasy (tytuł Zarządu)${goldMedals > 0 ? ` • ${goldMedals}× Złoto SMPL` : ''} • OVR ${ovr}`
      );
    }

    // 2. 🔥 ELITA / TOP SNAJPER
    const pos = Number(row.position || 99);
    const liveHasMatches = Number(meta.totalPlayed || 0) > 0;
    const isLiveTopScorer = Number(row.BZ || 0) >= 2 && Number(row.BZ || 0) === meta.maxGoals;
    const isLiveTop24 = Number(row.M || 0) > 0 && pos >= 2 && pos <= 4;

    if (isLiveTop24 && isLiveTopScorer) {
      unlock(
        'ELITE_SNIPER',
        `${pos}. miejsce w tabeli ${lgShort} oraz współlider strzelców S${seasonNum} (${row.BZ} ${plWord(row.BZ, 'gol', 'gole', 'goli')} w ${row.M}M)`
      );
    } else if (isLiveTop24) {
      unlock(
        'ELITE_SNIPER',
        `Czołówka tabeli — #${pos} miejsce w ${lgShort} w Sezonie ${seasonNum} (${row.PKT} pkt, bramki ${row.BZ}:${row.BS}, OVR ${ovr})`
      );
    } else if (isLiveTopScorer) {
      unlock(
        'ELITE_SNIPER',
        `Lider klasyfikacji strzelców w ${lgShort} S${seasonNum} — ${row.BZ} ${plWord(row.BZ, 'gol', 'gole', 'goli')} (śr. ${row.goalsForAvg}/mecz)`
      );
    } else if (!liveHasMatches && lastInLeague && (lastInLeague.pos >= 2 && lastInLeague.pos <= 4 || (lastLgStats && lastInLeague.BZ > 0 && lastInLeague.BZ === lastLgStats.maxBz))) {
      unlock(
        'ELITE_SNIPER',
        `Top 4 / Najlepsza ofensywa w Sezonie ${lastInLeague.seasonNumber} (#${lastInLeague.pos} • ${lastInLeague.BZ} goli, ${lastInLeague.PKT} pkt, OVR ${ovr})`
      );
    } else if (player.customRank === 'SNIPER' || player.customRank === 'TOTW') {
      unlock(
        'ELITE_SNIPER',
        `Elitarne wyróżnienie strzeleckie Zarządu (${TITLES[player.customRank].name} • OVR ${ovr})`
      );
    }

    // 3. 🛡️ ŻELAZNA DEFENSYWA
    const cs = Number(row.cleanSheets || 0);
    const isLiveCsLeader = cs >= 1 && (cs === meta.maxCs || (csEntry && Number(csEntry.rank) <= 2));
    const defenseTrophy = trophies.find((t) => /rękawic|czyste|kurtyna|defens|ściana/i.test(String(t.title || '')));
    const isLastSeasonBestDef = !liveHasMatches && lastInLeague && lastLgStats && lastLgStats.minBsName === nameLower;

    if (isLiveCsLeader) {
      const rankTxt = cs === meta.maxCs ? 'Lider' : 'Top 2';
      unlock(
        'IRON_DEFENSE',
        `${rankTxt} „Złotych Rękawic” w ${lgShort} S${seasonNum} — ${cs} ${plWord(cs, 'czyste konto', 'czyste konta', 'czystych kont')} (${row.cleanSheetPct}% na zero, śr. ${row.goalsAgainstAvg} BS/mecz)`
      );
    } else if (defenseTrophy) {
      unlock(
        'IRON_DEFENSE',
        `${defenseTrophy.title}${defenseTrophy.season ? ` (${defenseTrophy.season})` : ''} • Żelazny blok defensywny (OVR ${ovr})`
      );
    } else if (isLastSeasonBestDef) {
      const avgGa = (lastInLeague.BS / lastInLeague.M).toFixed(2);
      unlock(
        'IRON_DEFENSE',
        `Najszczelniejsza obrona ${lastInLeague.leagueId} w Sezonie ${lastInLeague.seasonNumber} — tylko ${lastInLeague.BS} straconych bramek w ${lastInLeague.M} meczach (${avgGa}/mecz)`
      );
    } else if (player.customRank === 'WALL') {
      unlock(
        'IRON_DEFENSE',
        `Wyróżnienie Defensywne Zarządu (Żelazna Kurtyna • OVR ${ovr})`
      );
    }

    // 4. ⚡ WETERAN / STALOWY FILAR
    const hasHighAttendance = (meta.openedRoundsCount >= 3 && liveAttendancePct >= 95) || lastAttendancePct >= 95;
    if (seasonsCount > 3 && hasHighAttendance) {
      const attPct = meta.openedRoundsCount >= 3 && liveAttendancePct >= 95 ? liveAttendancePct : lastAttendancePct;
      const attContext = meta.openedRoundsCount >= 3 && liveAttendancePct >= 95
        ? `${attPct}% frekwencji w Sezonie ${seasonNum}`
        : `${lastInLeague.M}/${lastInLeague.maxMInTable} meczów (${attPct}% frekwencji) w S${lastInLeague.seasonNumber}`;
      unlock(
        'VETERAN_PILLAR',
        `Staż ${seasonsCount} ${plWord(seasonsCount, 'sezon', 'sezony', 'sezonów')} w lidze oraz ${attContext} (${totalAllTimePts} pkt All-Time)`
      );
    } else if (seasonsCount > 3) {
      unlock(
        'VETERAN_PILLAR',
        `Staż w Score Match Liga: ${seasonsCount} ${plWord(seasonsCount, 'sezon', 'sezony', 'sezonów')} (${Number(hs.matches || at.matches || row.M || 0)} meczów, ${totalAllTimePts} pkt All-Time)`
      );
    } else if (hasHighAttendance) {
      const attPct = meta.openedRoundsCount >= 3 && liveAttendancePct >= 95 ? liveAttendancePct : lastAttendancePct;
      const sRef = meta.openedRoundsCount >= 3 && liveAttendancePct >= 95 ? seasonNum : lastInLeague.seasonNumber;
      unlock(
        'VETERAN_PILLAR',
        `Wysoka frekwencja: ${attPct}% rozegranych meczów w terminie (Sezon ${sRef})`
      );
    }

    // 5. 🚀 DEBIUTANT / ŚWIEŻA KREW
    const isLowerDivNewcomer = lid !== 'L1' && seasonsCount <= 3;
    const isBrandNew = seasonsCount <= 1 && Number(row.M || 0) <= 6;
    if (isLowerDivNewcomer || isBrandNew || player.customRank === 'ROOKIE_OTS' || earned.length === 0) {
      const sezLabel = seasonsCount <= 1 ? 'debiutancki sezon' : `${seasonsCount}. sezon w lidze`;
      unlock(
        'ROOKIE_BLOOD',
        `Nowa siła w ${lgShort} — ${sezLabel} w Score Match Liga (OVR ${ovr})`
      );
    }

    // Wybór najwyższej odznaki wg priorytetu 1 → 5
    earned.sort((a, b) => a.badge.order - b.badge.order);
    const primary = earned[0];

    const res = {
      isPlaceholder: false,
      isBlacklisted: false,
      primaryBadge: primary.badge,
      reason: primary.reason,
      badgeReasons,
      earned,
      metrics: {
        ovr,
        leagueId: lid,
        leagueShort: lgShort,
        position: row.position || '-',
        matches: Number(row.M || 0),
        points: Number(row.PKT || 0),
        goals: Number(row.BZ || 0),
        conceded: Number(row.BS || 0),
        cleanSheets: cs,
        cleanSheetPct: Number(row.cleanSheetPct || 0),
        seasonsCount,
        liveAttendancePct,
        lastAttendancePct,
        goldMedals,
        silverMedals,
        bronzeMedals,
        totalAllTimePts
      }
    };
    glassEvalCache[player.id] = res;
    return res;
  }

  function getPlayerRank(player, state) {
    if (!player) return null;
    if (checkBlacklisted(player, state)) {
      return {
        tier: SPECIAL_STATUS_RANKS.BLACKLISTED,
        rank: SPECIAL_STATUS_RANKS.BLACKLISTED,
        glass: null,
        title: TITLES.BANNED,
        roleBadge: null,
        isRole: false,
        isBlacklisted: true,
        isPlaceholder: false,
        reason: 'Dożywotnie wykluczenie z ligi decyzją Zarządu.',
        earned: [],
        badgeReasons: {},
        index: -999,
        xp: 0,
        progress: 0,
        next: null
      };
    }

    const glassInfo = evaluatePlayerGlass(player, state);
    if (glassInfo && glassInfo.isPlaceholder) {
      return {
        tier: TIERS[0],
        rank: null,
        glass: null,
        title: null,
        roleBadge: null,
        isRole: false,
        isBlacklisted: false,
        isPlaceholder: true,
        reason: '',
        earned: [],
        badgeReasons: {},
        metrics: glassInfo.metrics,
        index: 0,
        xp: 0,
        progress: 0,
        next: null
      };
    }

    const xp = getPlayerXp(player, state);
    const info = getTierForXp(xp);
    const title = player && player.customRank ? getTitleById(player.customRank, state) : null;
    const extraTitles = [];
    if (player && Array.isArray(player.extraCustomRanks)) {
      const seenTitles = {};
      if (title && title.id) seenTitles[title.id] = true;
      player.extraCustomRanks.forEach((eid) => {
        if (!eid || seenTitles[eid]) return;
        const resolved = getTitleById(eid, state);
        if (resolved) {
          seenTitles[eid] = true;
          extraTitles.push(resolved);
        }
      });
    }
    const primaryGlass = glassInfo ? glassInfo.primaryBadge : GLASS_BADGES.ROOKIE_BLOOD;

    // Rozpoznanie rangi Administratora dla aktywnych Adminów grających w lidze (np. Ekstraklasa L1)
    const adminsList = (state && Array.isArray(state.admins) ? state.admins : []);
    const pNameLow = player && player.name ? String(player.name).trim().toLowerCase() : '';
    const pUserLow = player && player.username ? String(player.username).trim().toLowerCase() : '';
    const matchedAdmin = !player || player.isPlaceholder
      ? null
      : adminsList.find((a) => {
          if (!a || (a.status !== 'APPROVED' && a.role !== 'MASTER_ADMIN')) return false;
          if (player.adminId && a.id === player.adminId) return true;
          const aNameLow = a.name ? String(a.name).trim().toLowerCase() : '';
          const aUserLow = a.username ? String(a.username).trim().toLowerCase() : '';
          if (player.isAdminPlayer && ((aNameLow && pNameLow === aNameLow) || (aUserLow && pUserLow === aUserLow))) {
            return true;
          }
          if (aUserLow && pUserLow && aUserLow === pUserLow) return true;
          if (aNameLow && pNameLow && aNameLow === pNameLow) return true;
          return false;
        });

    const isPlayingAdmin = Boolean((player && player.isAdminPlayer) || matchedAdmin);
    const isMasterPlayingAdmin = Boolean(
      (matchedAdmin && (matchedAdmin.role === 'MASTER_ADMIN' || matchedAdmin.id === 'ADM_MASTER')) ||
      (player && player.adminRole === 'MASTER_ADMIN')
    );
    const resolvedRoleBadge = isPlayingAdmin ? ROLE_RANKS.ADMIN : null;
    const resolvedMasterBadge = isMasterPlayingAdmin ? ROLE_RANKS.OWNER : null;

    return Object.assign({}, info, {
      rank: primaryGlass,
      xpTier: info.tier,
      glass: primaryGlass,
      reason: glassInfo ? glassInfo.reason : '',
      badgeReasons: glassInfo ? glassInfo.badgeReasons : {},
      earned: glassInfo ? glassInfo.earned : [],
      metrics: glassInfo ? glassInfo.metrics : {},
      title: title,
      extraTitles: extraTitles,
      roleBadge: resolvedRoleBadge,
      masterBadge: resolvedMasterBadge,
      isPlayingAdmin: isPlayingAdmin,
      isRole: false,
      isBlacklisted: false,
      isPlaceholder: false
    });
  }

  // Ranga autora wiadomości czatu (Zarząd / gracz — obsługuje wszystkie warstwy: Rola + Liquid Glass + Poziom XP + Tytuł)
  function getSenderRank(msg, state) {
    if (!msg) return null;
    const players = (state && state.players) || [];
    const admins = (state && state.admins) || [];
    const senderLower = String(msg.senderName || '').trim().toLowerCase();
    const adminRec = admins.find(
      (a) =>
        a.id === msg.senderId ||
        a.username === msg.senderId ||
        (senderLower && a.name && String(a.name).trim().toLowerCase() === senderLower)
    );
    const matchedPlayer =
      players.find((p) => p.id === msg.senderId) ||
      (msg.isAdmin && senderLower
        ? players.find((p) => p.name && String(p.name).trim().toLowerCase() === senderLower)
        : null);

    if (
      msg.senderId === 'ADM_MASTER' ||
      (adminRec && adminRec.role === 'MASTER_ADMIN') ||
      msg.senderName === 'Szymon Komenda'
    ) {
      if (matchedPlayer) {
        const pr = getPlayerRank(matchedPlayer, state);
        if (pr && !pr.isPlaceholder) {
          return Object.assign({}, pr, {
            rank: ROLE_RANKS.OWNER,
            glass: pr.glass,
            xpTier: pr.xpTier,
            title: pr.title,
            roleBadge: null,
            isRole: true,
            index: 99
          });
        }
      }
      return { rank: ROLE_RANKS.OWNER, xpTier: null, title: null, isRole: true, index: 99 };
    }

    if ((msg.isAdmin || adminRec) && !matchedPlayer) {
      return { rank: ROLE_RANKS.ADMIN, xpTier: null, title: null, isRole: true, index: 98 };
    }
    if (!matchedPlayer) return null;
    const r = getPlayerRank(matchedPlayer, state);
    if (r && (msg.isAdmin || adminRec)) r.roleBadge = ROLE_RANKS.ADMIN;
    return r;
  }

  // ---------------------------------------------------------------------------
  // 4. RENDEROWANIE SZKLANYCH ODZNAK LIQUID GLASS, AWATARÓW ORAZ TOOLTIPA
  // ---------------------------------------------------------------------------
  function badgeHtml(rankObj, size, playerId, reasonText) {
    if (!rankObj) return '';
    const sz = size === 'lg' ? 'rk-lg' : size === 'sm' ? 'rk-sm' : '';
    const isGlass = Boolean(rankObj.isGlass);
    const titleAttr = reasonText
      ? `${esc(rankObj.name)}: ${esc(reasonText)} (kliknij, aby zobaczyć szczegóły)`
      : `Ranga: ${esc(rankObj.name)}`;
    const labelText = size === 'sm' && rankObj.shortName ? rankObj.shortName : rankObj.name;
    const ico = rankObj.displayIcon || rankObj.icon;

    if (isGlass && playerId) {
      return `<button type="button" onclick="event.stopPropagation(); SMPL_APP.openRankTooltipModal('${esc(playerId)}', this, '${esc(rankObj.id)}')" class="smpl-glass-badge ${rankObj.css} ${sz}" title="${titleAttr}"><span class="rk-ico">${ico}</span><span class="rk-txt">${esc(labelText)}</span><span class="rk-info-dot" aria-hidden="true">i</span></button>`;
    }
    if (isGlass) {
      return `<span class="smpl-glass-badge ${rankObj.css} ${sz}" title="${titleAttr}"><span class="rk-ico">${ico}</span><span class="rk-txt">${esc(labelText)}</span></span>`;
    }
    return `<span class="smpl-rank ${rankObj.css} ${sz}" title="${titleAttr}"><span class="rk-ico">${rankObj.icon}</span><span class="rk-txt">${esc(rankObj.name)}</span></span>`;
  }

  function glassBadgeHtml(rankInfoOrPlayer, stateOrId, size, extraOpts) {
    if (!rankInfoOrPlayer) return '';
    let r = rankInfoOrPlayer;
    let playerId = '';
    if (r.name && r.id && stateOrId && typeof stateOrId === 'object') {
      playerId = r.id;
      r = getPlayerRank(rankInfoOrPlayer, stateOrId);
    } else if (typeof stateOrId === 'string') {
      playerId = stateOrId;
    }
    if (!r || r.isPlaceholder || !r.rank) return '';
    const badgeObj = extraOpts && extraOpts.badge ? extraOpts.badge : r.rank;
    const reason = extraOpts && extraOpts.reason ? extraOpts.reason : r.reason;
    return badgeHtml(badgeObj, size, playerId, reason);
  }

  function titleHtml(titleObj, size) {
    if (!titleObj) return '';
    const sz = size === 'lg' ? 'rk-lg' : size === 'sm' ? 'rk-sm' : '';
    const descAttr = titleObj.description
      ? esc(titleObj.name + ' — ' + titleObj.description)
      : 'Tytuł / Ranga nadana przez Administrację';
    if ((titleObj.isCustom || titleObj.css === 'tt-custom') && titleObj.colorHex) {
      const hex = normalizeHexColor(titleObj.colorHex, '#fbbf24');
      const txtHex = normalizeHexColor(titleObj.textColor, '#ffffff');
      const varMap = {
        METALLIC: 'tt-var-metallic',
        NEON_GLOW: 'tt-var-neon',
        LIQUID_GLASS: 'tt-var-glass',
        CHROME_OBSIDIAN: 'tt-var-obsidian',
        HOLO_GOLD: 'tt-var-holo'
      };
      const varCls = varMap[String(titleObj.styleVariant || 'HOLO_GOLD').toUpperCase()] || 'tt-var-holo';
      const customStyle = `--tt-accent:${hex};border-color:${hex};color:${txtHex};background:linear-gradient(135deg, ${hex}52 0%, rgba(15,23,42,0.92) 52%, ${hex}3a 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 4px rgba(0,0,0,0.5), 0 4px 14px -3px ${hex}88;`;
      return `<span class="smpl-title tt-custom ${varCls} ${sz}" style="${customStyle}" title="${descAttr}"><span class="rk-ico">${esc(titleObj.icon || '🌟')}</span><span class="rk-txt">${esc(titleObj.name)}</span></span>`;
    }
    return `<span class="smpl-title ${titleObj.css} ${sz}" title="${descAttr}"><span class="rk-ico">${esc(titleObj.icon || '🏆')}</span><span class="rk-txt">${esc(titleObj.name)}</span></span>`;
  }

  function roleBadgesHtml(r, size) {
    if (!r || r.isPlaceholder) return '';
    return [
      r.masterBadge ? badgeHtml(r.masterBadge, size) : '',
      r.roleBadge ? badgeHtml(r.roleBadge, size) : ''
    ].join('');
  }

  function fullBadgesHtml(r, size, playerId) {
    if (!r || r.isPlaceholder) return '';
    const extraHtml = Array.isArray(r.extraTitles) && r.extraTitles.length > 0
      ? r.extraTitles.map((t) => titleHtml(t, size)).join('')
      : '';
    return [
      r.masterBadge ? badgeHtml(r.masterBadge, size) : '',
      r.roleBadge ? badgeHtml(r.roleBadge, size) : '',
      r.rank ? badgeHtml(r.rank, size, playerId, r.reason) : '',
      !r.isBlacklisted && r.xpTier && (!r.rank || r.xpTier.id !== r.rank.id) ? badgeHtml(r.xpTier, size) : '',
      titleHtml(r.title, size),
      extraHtml
    ].join('');
  }

  function totwBadgeHtml(state, playerId) {
    if (!state || !playerId || typeof window === 'undefined' || !window.SMPL_STUDIO) return '';
    const hit = typeof window.SMPL_STUDIO.isPlayerInCurrentTotw === 'function'
      ? window.SMPL_STUDIO.isPlayerInCurrentTotw(state, playerId)
      : null;
    if (!hit) return '';
    return '<span class="smpl-totw-badge" title="Druzyna Kolejki / TOTW Tydzien #' + esc(hit.week || 1) + '">⚡ TOTW</span>';
  }

  function expansionBadgesHtml(state, player, compact) {
    if (!state || !player || player.isPlaceholder || typeof window === 'undefined' || !window.SMPL_STUDIO) return '';
    const st = window.SMPL_STUDIO;
    const parts = [];
    if (typeof st.vacationBadgeHtml === 'function') {
      const vb = st.vacationBadgeHtml(player);
      if (vb) parts.push(vb);
    }
    const tb = totwBadgeHtml(state, player.id);
    if (tb) parts.push(tb);
    if (typeof st.reliabilityBadgeHtml === 'function') {
      const rb = st.reliabilityBadgeHtml(state, player.id, Boolean(compact));
      if (rb) parts.push(rb);
    }
    if (!compact && typeof st.getPlayerCosmetics === 'function') {
      const cos = st.getPlayerCosmetics(state, player.id);
      if (cos && cos.badgeLabel) {
        parts.push('<span class="smpl-shop-badge-pill" title="Odznaka ze Sklepiku SMPL Coins">' + esc(cos.badgeLabel) + '</span>');
      }
      if (cos && cos.customTitle) {
        parts.push('<span class="smpl-coin-title-badge" title="Wlasny tytul ze Sklepiku SMPL Coins">🪙 ' + esc(cos.customTitle) + '</span>');
      }
    }
    return parts.join(' ');
  }

  // Klasa koloru nicku i ramki awatara
  function nameClass(r) {
    if (!r || !r.rank || r.isPlaceholder) return '';
    if (r.isBlacklisted || r.rank.id === 'BLACKLISTED') return 'rk-name-blacklisted';
    if (r.rank.nameCss) return r.rank.nameCss;
    return 'rk-name-' + r.rank.id.toLowerCase();
  }

  function avatarRingClass(r) {
    if (!r || !r.rank || r.isPlaceholder) return '';
    if (r.isBlacklisted || r.rank.id === 'BLACKLISTED') return 'rk-ring rk-ring-blacklisted';
    if (r.rank.ringCss) return 'rk-ring ' + r.rank.ringCss;
    const strong = ['DIAMOND', 'MASTER', 'LEGEND', 'GOAT', 'OWNER', 'ADMIN'];
    return strong.includes(r.rank.id) ? 'rk-ring rk-ring-' + r.rank.id.toLowerCase() : '';
  }

  // Awatar otoczony pierścieniem i małą szklaną odznaką Liquid Glass w rogu
  function avatarWithGlassBadgeHtml(avatarUrl, altText, imgClass, r, playerId, variant) {
    const resolvedUrl =
      (avatarUrl && String(avatarUrl).trim()) ||
      (typeof window !== 'undefined' && window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
        ? window.SMPL_MEDIA.generatePlayerAvatar(altText || 'Gracz', '', 0)
        : '');
    const safeUrl = esc(resolvedUrl || '');
    const safeAlt = esc(altText || '');
    const ringCls = avatarRingClass(r);
    const rankObj = r && !r.isPlaceholder ? r.rank : null;

    let cornerBadge = '';
    if (rankObj && !r.isPlaceholder) {
      const sizeCls = variant === 'ut' ? 'rk-avatar-glass rk-avatar-glass-ut' : 'rk-avatar-glass';
      const titleTip = r.reason ? `${esc(rankObj.name)} — ${esc(r.reason)}` : esc(rankObj.name);
      if (playerId && !r.isRole) {
        cornerBadge = `<button type="button" onclick="event.stopPropagation(); SMPL_APP.openRankTooltipModal('${esc(playerId)}', this, '${esc(rankObj.id)}')" class="${sizeCls} ${rankObj.css}" title="${titleTip}" aria-label="${esc(rankObj.name)}">${rankObj.icon}</button>`;
      } else {
        cornerBadge = `<span class="${sizeCls} ${rankObj.css}" title="${titleTip}">${rankObj.icon}</span>`;
      }
    }

    return `
      <span class="rk-avatar-wrap">
        <span class="${ringCls}">
          <img src="${safeUrl}" alt="${safeAlt}" class="${imgClass}" />
        </span>
        ${cornerBadge}
      </span>
    `;
  }

  // Treść interaktywnego Szklanego Tooltipa (pop-upu) po kliknięciu w rangę gracza
  function renderRankTooltipContent(playerId, state, focusBadgeId) {
    const safeState = state || {};
    const player = (safeState.players || []).find((p) => p.id === playerId);
    if (!player) return '';
    const r = getPlayerRank(player, safeState);
    if (!r) return '';

    const activeBadge =
      r.isBlacklisted
        ? r.rank
        : ((focusBadgeId && GLASS_BADGES[focusBadgeId]) || r.glass || r.rank);
    const activeReason =
      r.isBlacklisted
        ? r.reason
        : ((focusBadgeId && r.badgeReasons && r.badgeReasons[focusBadgeId]) ||
          r.reason ||
          activeBadge.unlockHint ||
          'Aktywna ranga w Score Match Liga.');
    const isUnlocked =
      r.isBlacklisted ||
      !focusBadgeId ||
      Boolean(r.badgeReasons && r.badgeReasons[focusBadgeId]);
    const m = r.metrics || {};

    const secondaryHtml = (r.earned || [])
      .filter((item) => !activeBadge || item.badge.id !== activeBadge.id)
      .map((item) => `
        <button type="button" onclick="SMPL_APP.openRankTooltipModal('${esc(player.id)}', null, '${esc(item.badge.id)}')" class="smpl-glass-badge ${item.badge.css} rk-sm">
          <span class="rk-ico">${item.badge.displayIcon}</span>
          <span class="rk-txt">${esc(item.badge.shortName)}</span>
        </button>
      `).join('');

    return `
      <div class="p-4 sm:p-5 text-white" style="--rk-glow:${esc(activeBadge.accentHex || '#fde047')}">
        <div class="flex items-start justify-between gap-3 pb-3 border-b border-white/15">
          <div class="flex items-center gap-3 min-w-0">
            ${avatarWithGlassBadgeHtml(
              player.avatar || (typeof window !== 'undefined' && window.SMPL_MEDIA ? window.SMPL_MEDIA.generatePlayerAvatar(player.name, player.nick, 0) : ''),
              player.name,
              'w-11 h-11 rounded-full object-cover border-2 border-white/20',
              r,
              null,
              'sm'
            )}
            <div class="min-w-0">
              <div class="text-[10px] font-display font-bold uppercase tracking-widest text-slate-400">
                RANGA LIQUID GLASS • ${esc(m.leagueShort || player.leagueId || 'LIGA')}
              </div>
              <div class="font-display font-black text-sm sm:text-base text-white truncate ${nameClass(r)}">${esc(player.name)}</div>
              <div class="text-[11px] text-slate-400">@${esc(player.nick || '')}</div>
            </div>
          </div>
          <button type="button" onclick="SMPL_APP.closeRankTooltip()" class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex-shrink-0" aria-label="Zamknij">✕</button>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="smpl-glass-badge ${activeBadge.css} rk-lg">
            <span class="rk-ico">${activeBadge.displayIcon || activeBadge.icon}</span>
            <span class="rk-txt">${esc(activeBadge.name)}</span>
          </span>
          ${r.title ? titleHtml(r.title, 'sm') : ''}
          ${Array.isArray(r.extraTitles) && r.extraTitles.length > 0 ? r.extraTitles.map((t) => titleHtml(t, 'sm')).join('') : ''}
        </div>

        <div class="mt-3 p-3.5 rounded-2xl border ${isUnlocked ? 'bg-white/10 border-white/20' : 'bg-slate-950/90 border-white/10'}">
          <div class="text-[10px] font-display font-black uppercase tracking-wider ${isUnlocked ? 'text-amber-300' : 'text-slate-400'}">
            ${isUnlocked ? '✨ Za co przyznano tę odznakę:' : '🔒 Warunek odblokowania odznaki:'}
          </div>
          <div class="text-xs sm:text-sm text-white font-semibold mt-1 leading-relaxed">
            ${esc(isUnlocked ? activeReason : (activeBadge.unlockHint || activeReason))}
          </div>
          <div class="text-[10px] text-slate-300 mt-1.5">
            Kryterium rangi: <strong class="text-white">${esc(activeBadge.criteriaLabel || '')}</strong>
          </div>
        </div>

        ${
          !r.isBlacklisted
            ? `<div class="grid grid-cols-4 gap-2 mt-3 text-center">
                 <div class="p-2 rounded-xl bg-black/40 border border-white/10">
                   <div class="rk-glass-telemetry-lbl">OVR</div>
                   <div class="font-display font-black text-sm text-amber-300">${m.ovr || 76}</div>
                 </div>
                 <div class="p-2 rounded-xl bg-black/40 border border-white/10">
                   <div class="rk-glass-telemetry-lbl">Pozycja</div>
                   <div class="font-display font-black text-sm text-white">#${m.position || '-'}</div>
                 </div>
                 <div class="p-2 rounded-xl bg-black/40 border border-white/10">
                   <div class="rk-glass-telemetry-lbl">Sezony</div>
                   <div class="font-display font-black text-sm text-blue-300">${m.seasonsCount || 1}</div>
                 </div>
                 <div class="p-2 rounded-xl bg-black/40 border border-white/10">
                   <div class="rk-glass-telemetry-lbl">${m.cleanSheets > 0 ? 'Czyste' : 'Gole'}</div>
                   <div class="font-display font-black text-sm text-emerald-300">${m.cleanSheets > 0 ? ('🧤 ' + m.cleanSheets) : ('⚽ ' + (m.goals || 0))}</div>
                 </div>
               </div>`
            : ''
        }

        ${
          secondaryHtml
            ? `<div class="mt-3 pt-3 border-t border-white/10">
                 <div class="text-[10px] font-display font-bold uppercase text-slate-400 mb-1.5">Pozostałe zdobyte odznaki gracza:</div>
                 <div class="flex flex-wrap gap-1.5">${secondaryHtml}</div>
               </div>`
            : ''
        }

        <div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
          <button type="button" onclick="SMPL_APP.closeRankTooltip(); SMPL_APP.openPlayerProfileTab('${esc(player.id)}')" class="btn-league px-3.5 py-2 rounded-xl text-[11px] font-display font-black uppercase">
            🎴 Otwórz Kartę Zawodnika
          </button>
          <button type="button" onclick="SMPL_APP.closeRankTooltip()" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200">
            Zamknij
          </button>
        </div>
      </div>
    `;
  }

  // Duży panel rangi na profilu gracza (Liquid Glass Badges + powód + drabinka XP)
  function profileRankPanelHtml(player, state) {
    if (!player) return '';
    const r = getPlayerRank(player, state);
    if (!r) return '';
    const t = r.rank;
    if (r.isBlacklisted) {
      return `
        <div class="glass-panel rounded-3xl p-5 sm:p-6 mb-6 rk-hero rk-blacklisted-hero relative overflow-hidden">
          <div class="flex flex-col md:flex-row md:items-center gap-5">
            <div class="rk-emblem rk-blacklisted">
              <div class="rk-emblem-ico">💀</div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[10px] font-display font-bold uppercase tracking-widest text-rose-400">STATUS DYSCYPLINARNY — WYKLUCZENIE Z LIGI</div>
              <div class="flex flex-wrap items-center gap-2 mt-1.5">
                ${badgeHtml(t, 'lg')}
                ${titleHtml(r.title, 'lg')}
              </div>
              <div class="mt-3 p-3.5 rounded-xl bg-slate-950/90 border border-rose-500/40 text-xs text-rose-200 leading-relaxed">
                <strong>⛔ DOŻYWOTNI ZAKAZ WSTĘPU DO SCORE MATCH LIGA:</strong> Ten gracz znajduje się na Oficjalnej Czarnej Liście Ligi decyzją Zarządu (Szymon Komenda). Posiada całkowity zakaz udziału we wszystkich sezonach, meczach sparingowych oraz obecności na czacie ligowym.
              </div>
            </div>
          </div>
        </div>`;
    }

    const glassObj = r.glass || GLASS_BADGES.ROOKIE_BLOOD;
    const showcaseGrid = GLASS_ORDER.map((gid) => {
      const gb = GLASS_BADGES[gid];
      const unlockedReason = r.badgeReasons && r.badgeReasons[gid];
      const isPrimary = glassObj.id === gid;
      return `
        <button type="button" onclick="SMPL_APP.openRankTooltipModal('${esc(player.id)}', this, '${esc(gid)}')" class="rk-glass-slot ${unlockedReason ? 'rk-glass-slot-on' : 'rk-glass-slot-off'}">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="text-lg">${gb.displayIcon || gb.icon}</span>
            <span class="text-[10px] font-display font-black uppercase ${isPrimary ? 'text-amber-300' : unlockedReason ? 'text-emerald-300' : 'text-slate-500'}">
              ${isPrimary ? 'GŁÓWNA' : unlockedReason ? 'ZDOBYTA' : 'ZABLOK.'}
            </span>
          </div>
          <div class="font-display font-black text-[10px] text-white leading-tight">${esc(gb.name)}</div>
          <div class="rk-glass-slot-desc">
            ${esc(unlockedReason || gb.unlockHint)}
          </div>
        </button>
      `;
    }).join('');

    const xpTier = r.xpTier || TIERS[0];
    const ladder = TIERS.map((tier, i) => {
      const reached = i <= r.index;
      const isCur = i === r.index;
      return `<div class="rk-step ${reached ? 'rk-step-on' : ''} ${isCur ? 'rk-step-cur ' + tier.css : ''}" title="${esc(tier.name)} — od ${tier.minXp} XP">
          <div class="rk-step-ico">${tier.icon}</div>
          <div class="rk-step-name">${esc(tier.name)}</div>
          <div class="rk-step-xp">${tier.minXp} XP</div>
        </div>`;
    }).join('');

    return `
      <div class="glass-panel rounded-3xl p-5 sm:p-6 mb-6 rk-hero ${glassObj.css}-hero relative overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center gap-5">
          <div class="rk-emblem ${glassObj.css}">
            <div class="rk-emblem-ico">${glassObj.displayIcon || glassObj.icon}</div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[10px] font-display font-bold uppercase tracking-widest text-slate-300">
              DYNAMICZNA RANGA PRESTIŻU (LIQUID GLASS BADGE)
            </div>
            <div class="flex flex-wrap items-center gap-2 mt-1.5">
              ${r.masterBadge ? badgeHtml(r.masterBadge, 'lg') : ''}
              ${r.roleBadge ? badgeHtml(r.roleBadge, 'lg') : ''}
              ${badgeHtml(glassObj, 'lg', player.id, r.reason)}
              ${titleHtml(r.title, 'lg')}
              ${Array.isArray(r.extraTitles) && r.extraTitles.length > 0 ? r.extraTitles.map((t) => titleHtml(t, 'lg')).join('') : ''}
              ${player.isSuspended ? '<span class="smpl-rank rk-suspended rk-lg"><span class="rk-ico">⛔</span><span class="rk-txt">Zawieszony</span></span>' : ''}
            </div>
            <div class="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/15 backdrop-blur-md text-xs text-white leading-relaxed">
              <span class="text-amber-300 font-display font-bold uppercase text-[10px] tracking-wider mr-2">✨ Przyznano za:</span>
              <span>${esc(r.reason)}</span>
            </div>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span class="text-slate-300">
                Poziom Kariery: <strong class="text-white font-display">${xpTier.icon} ${esc(xpTier.name)}</strong> • <strong class="text-amber-300 font-display">${r.xp} XP</strong>
              </span>
              <span class="text-slate-400">${r.next ? `Do kolejnego progu <strong class="text-white">${r.next.icon} ${esc(r.next.name)}</strong>: ${r.next.minXp - r.xp} XP` : '<strong class="text-amber-300">MAKSYMALNA RANGA XP!</strong>'}</span>
            </div>
            <div class="rk-progress mt-1.5"><div class="rk-progress-fill ${xpTier.css}" style="width:${r.progress}%"></div></div>
          </div>
        </div>

        <div class="mt-5">
          <div class="text-[10px] font-display font-bold uppercase tracking-widest text-slate-400 mb-2">
            5 Dynamicznych Odznak Liquid Glass (kliknij dowolną, aby zobaczyć szczegóły)
          </div>
          <div class="rk-glass-showcase-grid">${showcaseGrid}</div>
        </div>

        <div class="rk-ladder mt-4">${ladder}</div>
      </div>`;
  }

  // ---------------------------------------------------------------------------
  // 4. OZNACZANIE GRACZY NA CZACIE (@nick)
  // ---------------------------------------------------------------------------
  const MENTION_RE = /@([A-Za-z0-9_.\-ĄĆĘŁŃÓŚŹŻąćęłńóśźż]{2,40})/g;

  function findPlayerByToken(token, state) {
    const t = String(token || '').toLowerCase().replace(/[.\-]+$/, '');
    return (state.players || []).find(
      (p) => p.active !== false && !p.isPlaceholder && p.nick && p.nick.toLowerCase() === t
    );
  }

  function extractMentions(text, state) {
    const ids = [];
    String(text || '').replace(MENTION_RE, (full, token) => {
      const p = findPlayerByToken(token, state);
      if (p && !ids.includes(p.id)) ids.push(p.id);
      return full;
    });
    return ids;
  }

  // Zwraca bezpieczny HTML z podświetlonymi oznaczeniami
  function renderMessageText(text, state, currentUserId) {
    const safe = esc(text);
    return safe.replace(MENTION_RE, (full, token) => {
      const p = findPlayerByToken(token, state);
      if (!p) return full;
      const isMe = currentUserId && p.id === currentUserId;
      return `<button type="button" onclick="SMPL_APP.openPlayerModal('${p.id}')" class="smpl-mention ${isMe ? 'smpl-mention-me' : ''}" title="${esc(p.name)}">@${esc(p.nick)}</button>`;
    });
  }

  function mentionsUser(msg, userId) {
    if (!msg || !userId) return false;
    return Array.isArray(msg.mentions) && msg.mentions.includes(userId);
  }

  // Lista podpowiedzi do autouzupełniania
  function suggestPlayers(query, state, excludeId) {
    const q = String(query || '').toLowerCase();
    return (state.players || [])
      .filter((p) => p.active !== false && !p.isPlaceholder && p.nick && p.id !== excludeId)
      .filter((p) => !q || p.nick.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.nick.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.nick.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs || a.nick.localeCompare(b.nick);
      })
      .slice(0, 7);
  }

  return {
    GLASS_BADGES,
    GLASS_ORDER,
    TIERS,
    TITLES,
    ROLE_RANKS,
    getAllAvailableTitles,
    getTitleById,
    getPlayerXp,
    getTierForXp,
    evaluatePlayerGlass,
    getPlayerRank,
    getSenderRank,
    badgeHtml,
    roleBadgesHtml,
    glassBadgeHtml,
    avatarWithGlassBadgeHtml,
    titleHtml,
    fullBadgesHtml,
    totwBadgeHtml,
    expansionBadgesHtml,
    nameClass,
    avatarRingClass,
    renderRankTooltipContent,
    profileRankPanelHtml,
    extractMentions,
    renderMessageText,
    mentionsUser,
    suggestPlayers
  };
})();
