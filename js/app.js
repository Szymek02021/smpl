/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Główny Kontroler Aplikacji (3 Poziomy Linków: Publiczny Gracz / Tajny Link Admina / Prywatny Link Master Szymona Komendy)
 * Zawiera obsługę: Kart UT, Gabloty Trofeów, Archiwum S1–S55, Złotej Piłki, Przypomnienia Hasła, 4 Kolejek/Tydzień, Czarnej Listy i Zabezpieczeń Prawnych
 */

window.SMPL_APP = (function () {
  let activeLeague = 'L1';
  let activeTab = 'standings';
  let adminSubTab = 'moderation';
  let adminRecruitmentSubTab = 'all';
  let adminSettingsSubTab = 'account';
  let masterAssignPlayerId = '';
  let masterAssignRankId = '';
  let legalSubTab = 'ALL';
  const supportUiState = {
    selectedTier: 'pizza'
  };

  const updatesFilterState = {
    category: 'ALL',
    search: ''
  };

  function getSeenUpdateVersionSafe() {
    try {
      return localStorage.getItem('smpl_seen_update_version') || '';
    } catch (e) {
      return '';
    }
  }

  function markUpdateVersionSeen(ver) {
    if (!ver) return;
    try {
      localStorage.setItem('smpl_seen_update_version', String(ver));
    } catch (e) {}
  }

  // =========================================================================
  // JEDNORAZOWY PORADNIK WIDEO ŚWIEŻAKA (OTWIERA SIĘ TYLKO RAZ PO REJESTRACJI)
  // =========================================================================
  const TUTORIAL_SEEN_PREFIX = 'smpl_onboarding_tutorial_seen_v1::';
  const TUTORIAL_SEEN_GLOBAL_KEY = 'smpl_onboarding_tutorial_seen_v1::__device_any__';
  const TUTORIAL_MEDIA_VER = '62';
  let onboardingTutorialAutoShownInSession = false;

  const TUTORIAL_CHAPTERS = [
    { num: 1, time: 0, stamp: '0:00', title: 'Start & Ligi', desc: 'Przełącznik lig L1–L3, pasek zakładek, dzwonek i motywy' },
    { num: 2, time: 26.5, stamp: '0:26', title: 'Tabela & Kurtyna', desc: 'Strefy awansu/spadku, zasada PKT → H2H i Czyste Konta' },
    { num: 3, time: 55, stamp: '0:55', title: 'Terminarz & Mecze', desc: '4 kolejki/tydz., DOM zaprasza, Messenger, Kiedy Gramy? i urlop' },
    { num: 4, time: 80.5, stamp: '1:20', title: 'Dodaj Wynik & VAR', desc: 'Obowiązkowy screen po meczu i zgłoszenia do Trybunału VAR' },
    { num: 5, time: 109.5, stamp: '1:49', title: 'Karta UT & Kariera', desc: 'OVR, eksport PNG, 18 Kamieni Milowych i Trajektoria L1–L9' },
    { num: 6, time: 140.5, stamp: '2:20', title: 'Konkursy & Złoty But', desc: 'Król Strzelców, Puchar KO, Typer, Nagroda Puskása i TOTW' },
    { num: 7, time: 167.5, stamp: '2:47', title: 'Złota Piłka & Sklepik', desc: 'Głosowanie MVP (1 gracz = 1 głos) i Sklepik Coins 0 zł' },
    { num: 8, time: 198, stamp: '3:18', title: 'H2H & Archiwum', desc: 'Porównywarka rywali H2H i pełna historia Sezonów S1–S55' },
    { num: 9, time: 224, stamp: '3:44', title: 'Vanessa AI & Start', desc: 'Asystentka AI 24/7, Regulamin, Czarna Lista i aplikacja PWA' }
  ];

  function buildOnboardingTutorialKeys(reg) {
    const keys = [TUTORIAL_SEEN_GLOBAL_KEY];
    if (reg && typeof reg === 'object') {
      const idPart = reg.id ? String(reg.id).trim().toLowerCase() : '';
      const userPart = reg.username ? String(reg.username).trim().toLowerCase() : '';
      const namePart = reg.name ? String(reg.name).trim().toLowerCase() : '';
      if (idPart) keys.push(TUTORIAL_SEEN_PREFIX + 'id:' + idPart);
      if (userPart) keys.push(TUTORIAL_SEEN_PREFIX + 'u:' + userPart);
      if (namePart) keys.push(TUTORIAL_SEEN_PREFIX + 'n:' + namePart);
    }
    return keys;
  }

  function hasSeenOnboardingTutorial(reg) {
    if (onboardingTutorialAutoShownInSession) return true;
    try {
      const keys = buildOnboardingTutorialKeys(reg);
      for (let i = 0; i < keys.length; i++) {
        if (localStorage.getItem(keys[i]) === '1') return true;
      }
    } catch (e) {}
    return false;
  }

  function markOnboardingTutorialSeen(reg) {
    onboardingTutorialAutoShownInSession = true;
    try {
      const keys = buildOnboardingTutorialKeys(reg);
      for (let i = 0; i < keys.length; i++) {
        localStorage.setItem(keys[i], '1');
      }
    } catch (e) {}
  }

  function triggerFirstTimeOnboardingTutorial(reg) {
    if (hasSeenOnboardingTutorial(reg)) return false;
    // Zapisz natychmiast synchronicznie przed otwarciem — gwarantuje absolutne 1-razowe otwarcie
    markOnboardingTutorialSeen(reg);
    const pName = reg && reg.name ? String(reg.name) : '';
    setTimeout(function () {
      openOnboardingTutorialModal({ playerName: pName, isAutoFirstTime: true });
    }, 120);
    return true;
  }

  let settingsDrawerOpen = false;
  let notifCenterOpen = false;
  let lastBackPressAt = 0;
  let backGuardInstalled = false;

  const THEME_OPTIONS = [
    { id: 'auto-system', icon: '📱', name: 'Auto Telefon', desc: 'Jasny lub nocny wg systemu' },
    { id: 'auto-time', icon: '🕒', name: 'Pora Dnia 24h', desc: 'Świt • Dzień • Wieczór • Noc' },
    { id: 'dark', icon: '🌌', name: 'Noc Mistrzów', desc: 'Onyks, Złoto & Hologramy' },
    { id: 'light', icon: '☀️', name: 'Jasny Prestiż', desc: 'Porcelana, Błękit & Złoto' },
    { id: 'prestige', icon: '💎', name: 'Szmaragd VIP', desc: 'Loża Szmaragdowa & Platyna' },
    { id: 'twilight', icon: '⚡', name: 'Wieczorne Jupitery', desc: 'Ametyst, Cyjan & Neon UCL' },
    { id: 'dawn', icon: '🌅', name: 'Poranny Stadion', desc: 'Złoty Świt w Blasku Dnia' }
  ];

  function getThemePreference() {
    if (window.SMPL_WOW && typeof window.SMPL_WOW.getThemePreference === 'function') {
      return window.SMPL_WOW.getThemePreference();
    }
    try {
      const saved = localStorage.getItem('smpl_theme_pref');
      if (saved && THEME_OPTIONS.some((t) => t.id === saved)) return saved;
    } catch (e) {}
    return 'auto-system';
  }

  function resolveEffectiveTheme(pref) {
    if (window.SMPL_WOW && typeof window.SMPL_WOW.resolveEffectiveTheme === 'function') {
      return window.SMPL_WOW.resolveEffectiveTheme(pref);
    }
    const p = pref || getThemePreference();
    if (p === 'dark' || p === 'light' || p === 'prestige' || p === 'twilight' || p === 'dawn') return p;
    if (p === 'auto-time') {
      const h = new Date().getHours();
      if (h >= 6 && h < 12) return 'dawn';
      if (h >= 12 && h < 18) return 'light';
      if (h >= 18 && h < 22) return 'twilight';
      return 'dark';
    }
    try {
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch (e) {}
    return 'dark';
  }

  function getThemeEffectiveLabel(eff) {
    if (window.SMPL_WOW && typeof window.SMPL_WOW.getThemeEffectiveLabel === 'function') {
      return window.SMPL_WOW.getThemeEffectiveLabel(eff);
    }
    if (eff === 'light') return 'Jasny Prestiż (Porcelana)';
    if (eff === 'dawn') return 'Poranny Stadion (Złoty Świt)';
    if (eff === 'twilight') return 'Wieczorne Jupitery (Neon UCL)';
    if (eff === 'prestige') return 'Szmaragdowy Pałac VIP';
    return 'Noc Mistrzów (Onyks & Złoto)';
  }

  function applyThemeToDom() {
    if (typeof document === 'undefined' || !document.documentElement) return 'dark';
    if (window.SMPL_WOW && typeof window.SMPL_WOW.applyOverhaulAttribute === 'function') {
      window.SMPL_WOW.applyOverhaulAttribute();
    } else if (!document.documentElement.getAttribute('data-smpl-overhaul')) {
      document.documentElement.setAttribute('data-smpl-overhaul', 'wow');
    }
    const pref = getThemePreference();
    const eff = resolveEffectiveTheme(pref);
    const isLight = eff === 'light' || eff === 'dawn';
    document.documentElement.setAttribute('data-smpl-theme', eff);
    document.documentElement.setAttribute('data-smpl-theme-pref', pref);
    if (document.documentElement.classList) {
      document.documentElement.classList.toggle('light', isLight);
      document.documentElement.classList.toggle('dark', !isLight);
    }
    try {
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute(
          'content',
          eff === 'dawn'
            ? '#FCF7EE'
            : isLight
            ? '#EEF3FA'
            : eff === 'prestige'
            ? '#02120B'
            : eff === 'twilight'
            ? '#07051A'
            : '#050811'
        );
      }
    } catch (e) {}
    return eff;
  }

  function getAiFabPref() {
    try {
      return localStorage.getItem('smpl_ai_fab_mode') || '';
    } catch (e) {
      return '';
    }
  }

  function isAiFabVisibleNow() {
    const pref = getAiFabPref();
    if (pref === 'hide') return false;
    if (pref === 'show') return true;
    const w = typeof window !== 'undefined' && typeof window.innerWidth === 'number' ? window.innerWidth : 1024;
    return w >= 768;
  }

  function isHeroExpandedNow() {
    try {
      const saved = localStorage.getItem('smpl_hero_expanded');
      if (saved === '1') return true;
      if (saved === '0') return false;
    } catch (e) {}
    if (window.SMPL_WOW && typeof window.SMPL_WOW.isOverhaulEnabled === 'function' && window.SMPL_WOW.isOverhaulEnabled()) {
      return false;
    }
    const w = typeof window !== 'undefined' && typeof window.innerWidth === 'number' ? window.innerWidth : 1024;
    return w >= 768;
  }

  function applyHeroBannerCollapseState() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
    const hero = document.querySelector('.hero-showcase-banner');
    if (!hero) return;
    const expanded = isHeroExpandedNow();
    if (hero.classList) {
      hero.classList.toggle('smpl-hero-collapsed', !expanded);
    }
    const togBtn = document.getElementById('smpl-hero-collapse-btn');
    if (togBtn) {
      togBtn.textContent = expanded ? 'Zwiń opis ▴' : 'Rozwiń Hub S1–S56 ▾';
      togBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  }

  const scheduleFilter = {
    round: 2,
    week: 1,
    status: 'ALL',
    search: ''
  };

  const h2hState = {
    playerAId: 'L1_P05',
    playerBId: 'L1_P10'
  };

  const profileState = {
    playerId: 'L1_P09'
  };

  const gbFormState = {
    voterName: '',
    candidateId: 'L1_P02',
    aiAnalysisLoading: false,
    aiAnalysisText: '',
    aiAnalysisSource: ''
  };

  const competitionsState = {
    subTab: 'golden_boot',
    goldenBootLeague: 'ALL'
  };

  const archiveState = {
    mode: 'SEASONS',
    seasonNumber: 54,
    leagueId: 'L1',
    seasonGroup: 'ALL',
    playerName: '',
    search: ''
  };

  const submitFormState = {
    leagueId: 'L1',
    round: 1,
    matchId: null,
    homeScore: 2,
    awayScore: 1,
    screenshotPreview: null,
    returnHomeScore: 1,
    returnAwayScore: 2,
    returnScreenshotPreview: null,
    comment: ''
  };

    let disputeDraftScreenshot = '';
  let adminEditDraftScreenshot = '';

  const aiWidgetState = {
    isOpen: false,
    isTyping: false,
    geminiReady: false,
    activeModel: 'gemini-3.8-flash',
    messages: []
  };

  let gateMode = 'login'; // 'login' | 'register' | 'guest'
  const gateRegState = {
    name: '',
    nick: '',
    league: 'L2',
    fbLink: '',
    password: '',
    avatarPreview: null,
    playedBefore: false,
    linkedHistoricalName: '',
    histSearch: '',
    clanId: '',
    newClanName: '',
    newClanTag: '',
    newClanColor: '#10b981',
    newClanLogoPreview: null
  };

  const regFormState = {
    name: '',
    nick: '',
    fbLink: '',
    preference: 'Nowy gracz — 2. Liga (L2)',
    password: '',
    notes: '',
    avatarPreview: null,
    playedBefore: false,
    linkedHistoricalName: '',
    histSearch: '',
    clanId: '',
    newClanName: '',
    newClanTag: '',
    newClanColor: '#10b981',
    newClanLogoPreview: null
  };

  function requireStrictAdmin(actionLabel) {
    if (window.SMPL_DB && typeof window.SMPL_DB.isStrictAdminSession === 'function' && window.SMPL_DB.isStrictAdminSession()) {
      return true;
    }
    showToast('⛔ Odmowa dostępu: Operacja (' + (actionLabel || 'zarządzanie ligą') + ') wymaga zalogowania w Panelu Administratora!', 'error');
    return false;
  }

  function requireMasterAdmin(actionLabel) {
    if (!requireStrictAdmin(actionLabel)) return false;
    const sess = window.SMPL_DB && typeof window.SMPL_DB.getSession === 'function' ? window.SMPL_DB.getSession() : null;
    if (!sess || sess.adminRole !== 'MASTER_ADMIN') {
      showToast('⛔ Brak uprawnień: Funkcja (' + (actionLabel || 'Master Studio') + ') jest dostępna wyłącznie dla Master Admina (Szymon Komenda).', 'error');
      return false;
    }
    return true;
  }

  function isClansUiEnabledSafe(st) {
    const resolved = st || (window.SMPL_DB && typeof window.SMPL_DB.getState === 'function' ? window.SMPL_DB.getState() : null);
    if (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.isClansUiEnabled === 'function') {
      return window.SMPL_VIEWS.isClansUiEnabled(resolved);
    }
    return Boolean(
      (typeof window !== 'undefined' && window.SMPL_ENABLE_CLANS === true) ||
      (resolved && resolved.portalSettings && resolved.portalSettings.clansEnabled === true)
    );
  }

  function applyPortalSettingsToDom(state) {
    if (typeof document === 'undefined') return;
    const cfg = (state && state.portalSettings) || {};

    const annEl = document.getElementById('portal-announcement-bar');
    if (annEl) {
      const annText = String(cfg.announcementText || '').trim();
      if (cfg.announcementActive && annText) {
        annEl.classList.remove('hidden');
        annEl.innerHTML = `<div class="flex items-center gap-2"><span class="text-base">📢</span><span>${window.SMPL_VIEWS ? window.SMPL_VIEWS.escapeHtml(annText) : annText}</span></div>`;
      } else {
        annEl.classList.add('hidden');
        annEl.textContent = '';
      }
    }

    const badgeEl = document.getElementById('hero-portal-badge');
    if (badgeEl) {
      if (!badgeEl.dataset.defaultText) badgeEl.dataset.defaultText = String(badgeEl.textContent || '').trim();
      const customBadge = String(cfg.heroBadge || '').trim();
      badgeEl.textContent = customBadge || badgeEl.dataset.defaultText;
    }

    const titleEl = document.getElementById('hero-portal-title');
    if (titleEl) {
      if (!titleEl.dataset.defaultHtml) titleEl.dataset.defaultHtml = titleEl.innerHTML;
      const customTitle = String(cfg.heroTitle || '').trim();
      if (customTitle && customTitle !== 'SCORE MATCH LIGA — OFICJALNY PORTAL') {
        titleEl.textContent = customTitle;
      } else {
        titleEl.innerHTML = titleEl.dataset.defaultHtml;
      }
    }

    const subEl = document.getElementById('hero-portal-subtitle');
    if (subEl) {
      if (!subEl.dataset.defaultHtml) subEl.dataset.defaultHtml = subEl.innerHTML;
      const customSub = String(cfg.heroSubtitle || '').trim();
      if (customSub) {
        subEl.textContent = customSub;
      } else {
        subEl.innerHTML = subEl.dataset.defaultHtml;
      }
    }

    // Live Ticker & Maintenance Banner (bezpieczne dla mock DOM i widoków Admin/Master bez .hero-showcase-banner)
    const heroBanner = document.querySelector ? document.querySelector('.hero-showcase-banner') : null;
    const mainPortalWrap = document.getElementById('main-portal-container');
    const escDom = (v) => (window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml ? window.SMPL_VIEWS.escapeHtml(v) : String(v || ''));

    if (typeof document.createElement === 'function') {
      let maintEl = document.getElementById('smpl-maintenance-banner');
      const maintRaw = cfg.maintenanceMode;
      const maintOn = Boolean(maintRaw && (typeof maintRaw === 'object' ? maintRaw.enabled : maintRaw));
      const maintMsgText = (maintRaw && typeof maintRaw === 'object' && maintRaw.message) || cfg.maintenanceMessage || 'Prace serwisowe portalu — wysyłanie wyników tymczasowo wstrzymane.';
      const isStrictAdmNow = Boolean(window.SMPL_DB && typeof window.SMPL_DB.isStrictAdminSession === 'function' && window.SMPL_DB.isStrictAdminSession());
      if (maintOn && ((heroBanner && heroBanner.parentNode) || mainPortalWrap)) {
        if (!maintEl) {
          maintEl = document.createElement('div');
          maintEl.id = 'smpl-maintenance-banner';
          maintEl.className = 'smpl-maint-banner mb-4';
          if (heroBanner && heroBanner.parentNode) {
            heroBanner.parentNode.insertBefore(maintEl, heroBanner);
          } else if (mainPortalWrap) {
            mainPortalWrap.insertBefore(maintEl, mainPortalWrap.firstChild);
          }
        }
        const adminDisableBtnHtml = isStrictAdmNow
          ? `<button type="button" onclick="SMPL_APP.adminToggleMaintenanceMode(false)" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black uppercase text-[10px] shadow">🟢 Wyłącz teraz</button>`
          : '';
        maintEl.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-100"><span>🚧 <strong>TRYB PRZERWY TECHNICZNEJ:</strong> ${escDom(maintMsgText)}</span><div class="flex items-center gap-2"><span class="px-2 py-0.5 rounded bg-rose-500/30 font-bold uppercase text-[10px]">MAINTENANCE</span>${adminDisableBtnHtml}</div></div>`;
      } else if (maintEl && maintEl.parentNode) {
        maintEl.parentNode.removeChild(maintEl);
      }
    }

    if (heroBanner && heroBanner.parentNode && typeof document.createElement === 'function') {
      const esc = escDom;

      const compSafe = (state && state.competitions) ? state.competitions : {};
      const tvLive = compSafe.smplTV && compSafe.smplTV.liveStream && compSafe.smplTV.liveStream.isLive ? compSafe.smplTV.liveStream : null;
      const totw0 = Array.isArray(compSafe.totwHistory) && compSafe.totwHistory[0] ? compSafe.totwHistory[0] : null;
      const tickerItems = [];
      if (tvLive && tvLive.url) {
        tickerItems.push(`<a href="${esc(tvLive.url)}" target="_blank" rel="noopener noreferrer" class="smpl-ticker-item text-rose-300 font-bold">🔴 LIVE SMPL TV: ${esc(tvLive.title || 'Transmisja')}</a>`);
      }
      if (totw0 && Array.isArray(totw0.starters) && totw0.starters[0]) {
        tickerItems.push(`<span class="smpl-ticker-item text-amber-300">⚡ TOTW Tydz.#${Number(totw0.week || 1)}: ${esc(totw0.starters[0].name)} (${Number(totw0.starters[0].pts || 0)} pkt)</span>`);
      }
      const pMapTk = {};
      ((state && state.players) || []).forEach((pl) => { if (pl) pMapTk[pl.id] = pl; });
      ((state && state.matches) || [])
        .filter((m) => m && m.status === 'APPROVED' && !m.isByeWalkover)
        .slice(-5)
        .reverse()
        .forEach((m) => {
          const hp = pMapTk[m.homeId];
          const ap = pMapTk[m.awayId];
          if (hp && ap) {
            tickerItems.push(`<span class="smpl-ticker-item text-slate-200">⚽ K${Number(m.round || 0)} (${esc(m.leagueId)}): ${esc(hp.name)} <strong>${Number(m.homeScore)}:${Number(m.awayScore)}</strong> ${esc(ap.name)}</span>`);
          }
        });
      if (!tickerItems.length) {
        tickerItems.push(`<span class="smpl-ticker-item text-slate-300">🏆 Score Match Liga Polska — Sezon ${Number((state && state.season) || 56)} na żywo!</span>`);
      }
      let tickerEl = document.getElementById('smpl-live-ticker-bar');
      if (!tickerEl) {
        tickerEl = document.createElement('div');
        tickerEl.id = 'smpl-live-ticker-bar';
        tickerEl.className = 'smpl-ticker-bar mb-4';
        heroBanner.parentNode.insertBefore(tickerEl, heroBanner);
      }
      tickerEl.innerHTML = `<span class="smpl-ticker-badge">📡 NA ŻYWO</span><div class="smpl-ticker-track">${tickerItems.join('')}</div>`;
    }

    // Broadcast Hero Telemetry HUD & Medallion Crest (bezpieczny dla mock DOM i mobile)
    if (heroBanner && typeof document.createElement === 'function') {
      const activePlayersCnt = ((state && state.players) || []).filter(
        (p) => p && p.active !== false && !p.isPlaceholder && !p.gdprDeleted && p.leagueId !== 'POOL'
      ).length;
      const allMatches = (state && state.matches) || [];
      const playedMatchesCnt = allMatches.filter((m) => m && (m.status === 'APPROVED' || m.status === 'WALKOVER')).length;
      const goalsScoredCnt = allMatches
        .filter((m) => m && (m.status === 'APPROVED' || m.status === 'WALKOVER'))
        .reduce((sum, m) => sum + Number(m.homeScore || 0) + Number(m.awayScore || 0), 0);
      const leaguesCnt = (window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function')
        ? window.SMPL_DB.getLeaguesList(state, false).length
        : 2;

      const playersLabel = activePlayersCnt === 1 ? '1 GRACZ' : (activePlayersCnt + ' GRACZY');
      const leaguesLabel = leaguesCnt === 1 ? '1 LIGA' : (leaguesCnt >= 2 && leaguesCnt <= 4 ? (leaguesCnt + ' LIGI') : (leaguesCnt + ' LIG'));
      const goalsLabel = goalsScoredCnt === 1 ? '1 GOL' : (goalsScoredCnt >= 2 && goalsScoredCnt <= 4 ? (goalsScoredCnt + ' GOLE') : (goalsScoredCnt + ' GOLI'));

      let hudEl = document.getElementById('smpl-hero-telemetry-hud');
      if (!hudEl) {
        hudEl = document.createElement('div');
        hudEl.id = 'smpl-hero-telemetry-hud';
        hudEl.className = 'mt-5 pt-4 border-t border-white/15';
        heroBanner.appendChild(hudEl);
      }
      hudEl.innerHTML = `
        <div class="smpl-hero-telemetry-grid">
          <div class="smpl-hero-metric-chip">
            <div class="smpl-metric-lbl text-[9px] sm:text-[10px] font-display uppercase text-slate-400 font-bold truncate">🏆 <span class="sm:hidden">Sezon</span><span class="hidden sm:inline">Sezon &amp; Dywizje</span></div>
            <div class="smpl-metric-val font-display font-black text-xs sm:text-base text-amber-300 font-mono-num mt-0.5 truncate"><span class="sm:hidden">S${(state && state.season) || 56} • ${leaguesCnt}L</span><span class="hidden sm:inline">SEZON ${(state && state.season) || 56} • ${leaguesLabel}</span></div>
          </div>
          <div class="smpl-hero-metric-chip">
            <div class="smpl-metric-lbl text-[9px] sm:text-[10px] font-display uppercase text-slate-400 font-bold truncate">⚡ <span class="sm:hidden">Gracze</span><span class="hidden sm:inline">Aktywni Zawodnicy</span></div>
            <div class="smpl-metric-val font-display font-black text-xs sm:text-base text-white font-mono-num mt-0.5 truncate"><span class="sm:hidden">${activePlayersCnt}</span><span class="hidden sm:inline">${playersLabel}</span></div>
          </div>
          <div class="smpl-hero-metric-chip">
            <div class="smpl-metric-lbl text-[9px] sm:text-[10px] font-display uppercase text-slate-400 font-bold truncate">📊 <span class="sm:hidden">Mecze</span><span class="hidden sm:inline">Mecze w Sezonie</span></div>
            <div class="smpl-metric-val font-display font-black text-xs sm:text-base text-emerald-400 font-mono-num mt-0.5 truncate">${playedMatchesCnt} / ${allMatches.length}</div>
          </div>
          <div class="smpl-hero-metric-chip">
            <div class="smpl-metric-lbl text-[9px] sm:text-[10px] font-display uppercase text-slate-400 font-bold truncate">⚽ <span class="sm:hidden">Bramki</span><span class="hidden sm:inline">Zdobyte Bramki</span></div>
            <div class="smpl-metric-val font-display font-black text-xs sm:text-base text-blue-300 font-mono-num mt-0.5 truncate"><span class="sm:hidden">${goalsScoredCnt}</span><span class="hidden sm:inline">${goalsLabel}</span></div>
          </div>
        </div>
      `;
    }
  }

  function showToast(message, type = 'success') {
    syncTopBarHeightVar();
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (container.style) {
      container.style.zIndex = '2147483640';
      container.style.position = 'fixed';
    }
    if (typeof document !== 'undefined' && document.body && typeof document.body.appendChild === 'function' && container.parentNode === document.body && document.body.lastElementChild !== container) {
      document.body.appendChild(container);
    }

    const toneCls =
      type === 'error'
        ? 'smpl-toast-error'
        : type === 'warning'
        ? 'smpl-toast-warning'
        : 'smpl-toast-success';

    const el = document.createElement('div');
    el.className = `smpl-toast ${toneCls} px-3.5 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-2.5 transition-all duration-300`;
    el.innerHTML = `<span class="flex-1 leading-snug">${message}</span><button type="button" onclick="this.parentElement&&this.parentElement.remove()" class="smpl-toast-close flex-shrink-0" aria-label="Zamknij powiadomienie" title="Zamknij">✕</button>`;
    while (container.children && container.children.length >= 2) {
      if (container.firstElementChild) container.removeChild(container.firstElementChild);
      else break;
    }
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => el.remove(), 300);
    }, 4500);
  }

  function fileToDataUrl(file, maxWidth = 850) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function clanFileToDataUrl(file, maxWidth = 240) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const isPngLike = (file && (file.type === 'image/png' || file.type === 'image/webp' || /\.png$/i.test(file.name || '')));
          let outUrl = isPngLike ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86);
          if (outUrl.length > 140000) {
            outUrl = canvas.toDataURL('image/jpeg', 0.84);
          }
          resolve(outUrl);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  let loadingScreenDismissed = false;
  function dismissLoadingScreen() {
    if (loadingScreenDismissed) return;
    loadingScreenDismissed = true;
    const loaderEl = document.getElementById('smpl-loading-screen');
    if (!loaderEl) return;
    const hideNow = function () {
      const target = document.getElementById('smpl-loading-screen');
      if (!target) return;
      const stEl = document.getElementById('smpl-loader-status-text');
      if (stEl) stEl.textContent = 'Arena gotowa — zapraszamy!';
      try {
        target.classList.add('smpl-loader-hide');
        setTimeout(function () {
          const el = document.getElementById('smpl-loading-screen');
          if (el && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        }, 460);
      } catch (e) {
        if (target && target.style) target.style.display = 'none';
      }
    };
    const canAnimateHold =
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function' &&
      Number(window.__SMPL_LOADER_BOOT || 0) > 0;
    if (canAnimateHold) {
      const elapsed = Math.max(0, Date.now() - Number(window.__SMPL_LOADER_BOOT));
      const remain = Math.max(0, 1150 - elapsed);
      if (remain > 40) {
        setTimeout(hideNow, remain);
        return;
      }
    }
    hideNow();
  }

  function getLeagueCrest(state, leagueId) {
    if (state && state.customCrests && state.customCrests[leagueId]) return state.customCrests[leagueId];
    const lgObj = state && state.leagues && state.leagues[leagueId];
    if (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.getDefaultCrest === 'function') {
      return window.SMPL_MEDIA.getDefaultCrest(leagueId, lgObj);
    }
    return window.SMPL_MEDIA.DEFAULT_CRESTS[leagueId];
  }

  // =========================================================================
  // OCHRONA IPHONE / iOS SAFE-AREA (NOTCH, DYNAMIC ISLAND, PEŁNY EKRAN PWA)
  // =========================================================================
  function syncIosSafeAreaGuard() {
    if (
      typeof document === 'undefined' ||
      !document.documentElement ||
      !document.documentElement.style ||
      typeof document.documentElement.style.setProperty !== 'function'
    ) {
      return;
    }
    try {
      const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
      const isIPhone = /iPhone|iPod/i.test(ua);
      let guardPx = 0;
      if (isIPhone && typeof window !== 'undefined') {
        const w = typeof window.innerWidth === 'number' ? window.innerWidth : 0;
        const h = typeof window.innerHeight === 'number' ? window.innerHeight : 0;
        const isPortrait = h > w && w > 0;
        const scrMax = window.screen ? Math.max(Number(window.screen.width || 0), Number(window.screen.height || 0)) : 0;
        const diffTop = isPortrait && scrMax > 0 ? scrMax - h : 999;
        const scaleOk = !window.visualViewport || typeof window.visualViewport.scale !== 'number' || window.visualViewport.scale >= 0.98;
        let envSat = 0;
        if (typeof document.createElement === 'function' && document.body && typeof window.getComputedStyle === 'function') {
          const probe = document.createElement('div');
          probe.style.cssText = 'position:fixed;top:-9999px;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top, 0px);';
          document.body.appendChild(probe);
          const parsed = parseFloat(window.getComputedStyle(probe).paddingTop);
          document.body.removeChild(probe);
          if (isFinite(parsed)) envSat = parsed;
        }
        // Fallback wyłącznie gdy iPhone działa edge-to-edge pod zegarem (diffTop < 14), a WebKit nie zwrócił safe-area
        if (isPortrait && scaleOk && envSat < 20 && diffTop >= 0 && diffTop < 14) {
          guardPx = scrMax >= 812 ? 54 : 22;
        }
      }
      document.documentElement.style.setProperty('--smpl-ios-top-guard', guardPx > 0 ? (guardPx + 'px') : '0px');
    } catch (e) {}
  }

  function syncTopBarHeightVar() {
    if (
      typeof document === 'undefined' ||
      !document.documentElement ||
      !document.documentElement.style ||
      typeof document.documentElement.style.setProperty !== 'function'
    ) {
      return;
    }
    try {
      const topBarEl = document.getElementById('top-auth-bar');
      if (!topBarEl || (topBarEl.style && topBarEl.style.display === 'none')) {
        if (typeof document.documentElement.style.removeProperty === 'function') {
          document.documentElement.style.removeProperty('--smpl-topbar-h');
          document.documentElement.style.removeProperty('--smpl-toast-top');
        }
        return;
      }
      const preRect = typeof topBarEl.getBoundingClientRect === 'function' ? topBarEl.getBoundingClientRect() : null;
      if (topBarEl.classList && preRect) {
        topBarEl.classList.toggle('smpl-topbar-under-banner', Number(preRect.top || 0) > 12);
      }
      const rect = typeof topBarEl.getBoundingClientRect === 'function' ? topBarEl.getBoundingClientRect() : preRect;
      const h = Math.round((rect && rect.height) || Number(topBarEl.offsetHeight || 0) || 49);
      const bottom = Math.round(Math.max((rect && rect.bottom) || 0, h, 49));
      if (h > 0) {
        document.documentElement.style.setProperty('--smpl-topbar-h', h + 'px');
        document.documentElement.style.setProperty('--smpl-toast-top', bottom + 'px');
      }
    } catch (e) {}
  }

  // =========================================================================
  // RENDEROWANIE CAŁEGO PORTALU W ZALEŻNOŚCI OD LINKU DOSTĘPOWEGO
  // =========================================================================
  function renderAll() {
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();

    const gateContainer = document.getElementById('fullscreen-auth-gate');
    const mainContainer = document.getElementById('main-portal-container');
    const topBarEl = document.getElementById('top-auth-bar');
    const mobEl = document.getElementById('mobile-bottom-nav');

    // Sprawdzamy czy portal jest odblokowany (zalogowany gracz, administrator lub tryb gościa)
    const isStrictAdmin = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session));
    const isUnlocked =
      session.linkMode === 'PUBLIC'
        ? Boolean(session.isGateUnlocked === true || session.isPlayerAuthenticated === true)
        : isStrictAdmin;

    if (!isUnlocked) {
      document.body.classList.add('smpl-gate-locked');
      if (gateContainer) {
        gateContainer.style.display = 'flex';
        gateContainer.innerHTML =
          session.linkMode !== 'PUBLIC'
            ? window.SMPL_FORMS_ADMIN.renderAdminLoginAndJoinGate(state, session)
            : window.SMPL_FORMS_ADMIN.renderFullScreenAuthGate(
                state,
                gateMode,
                gateRegState,
                session
              );
      }
      if (mainContainer) mainContainer.style.display = 'none';
      if (topBarEl) topBarEl.style.display = 'none';
      if (mobEl) {
        mobEl.style.display = 'none';
        mobEl.innerHTML = '';
      }
      syncIosSafeAreaGuard();
      syncTopBarHeightVar();
      settingsDrawerOpen = false;
      const lockedDrawerRoot = document.getElementById('smpl-settings-drawer-root');
      if (lockedDrawerRoot) lockedDrawerRoot.innerHTML = '';
      const aiRootLocked = document.getElementById('smpl-ai-widget-root');
      if (aiRootLocked) aiRootLocked.innerHTML = '';
      dismissLoadingScreen();
      return;
    }

    document.body.classList.remove('smpl-gate-locked');

    if (gateContainer) gateContainer.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block';
    if (topBarEl) topBarEl.style.display = 'block';
    if (mobEl) mobEl.style.display = '';

    // Na publicznym linku lub bez autoryzacji blokujemy możliwość wejścia w zakładkę 'admin'
    if (!isStrictAdmin && activeTab === 'admin') {
      activeTab = 'standings';
    }

    const activeLeagueIds = window.SMPL_DB && typeof window.SMPL_DB.getActiveLeagueIds === 'function'
      ? window.SMPL_DB.getActiveLeagueIds(state)
      : ['L1', 'L2'];
    if (activeLeagueIds.length > 0 && activeLeagueIds.indexOf(activeLeague) === -1) {
      activeLeague = activeLeagueIds[0] || 'L2';
    }
    if (submitFormState && activeLeagueIds.length > 0 && activeLeagueIds.indexOf(submitFormState.leagueId) === -1) {
      submitFormState.leagueId = activeLeague;
    }

    document.body.setAttribute('data-league', activeLeague);

    applyThemeToDom();
    applyPortalSettingsToDom(state);
    applyHeroBannerCollapseState();
    renderTopBar(state, session);
    renderLeagueSelectorCards(state, session);
    if (window.SMPL_WOW && typeof window.SMPL_WOW.renderHeroLiveHud === 'function') {
      window.SMPL_WOW.renderHeroLiveHud(state, activeLeague, session);
    }
    renderNavigationTabs(state, session);
    renderMobileBottomNav(state, session);
    renderMainContent(state, session);
    renderAiAssistantWidget(state, session);
    dismissLoadingScreen();
  }

  function getNotifActionButtonHtml(notif) {
    const t = String((notif && notif.type) || '').toUpperCase();
    if (t === 'SHOP_GIFT' || t === 'SHOP_QUEST') {
      return `<button type="button" onclick="SMPL_APP.closeNotificationsCenterModal(); SMPL_APP.openCoinShopModal('${t === 'SHOP_GIFT' ? 'gift' : 'quests'}');" class="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/40 text-[10px] font-bold">🪙 Otwórz Sklepik</button>`;
    }
    if (t === 'MATCH_REJECTED') {
      return `<button type="button" onclick="SMPL_APP.closeNotificationsCenterModal(); SMPL_APP.switchTab('submit');" class="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40 text-[10px] font-bold">➕ Popraw Wynik</button>`;
    }
    if (['MATCH_SUBMITTED', 'MATCH_APPROVED', 'MATCH_EDITED', 'WALKOVER', 'MATCH_PROPOSAL', 'DISPUTE'].indexOf(t) !== -1) {
      return `<button type="button" onclick="SMPL_APP.closeNotificationsCenterModal(); SMPL_APP.switchTab('schedule');" class="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold">🗓️ Zobacz Terminarz</button>`;
    }
    if (t === 'PRIZE' || t === 'TROPHY' || t === 'TOTW') {
      return `<button type="button" onclick="SMPL_APP.closeNotificationsCenterModal(); SMPL_APP.switchTab('profile');" class="px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/35 text-purple-200 border border-purple-400/40 text-[10px] font-bold">🎴 Zobacz Profil / Trofea</button>`;
    }
    return '';
  }

  function buildNotificationsCenterHtml(state, session, esc, targetPlayer, isPublic, notifOn, notifPerm, soundOn, adminCounts) {
    const list = targetPlayer && Array.isArray(targetPlayer.notifications) ? targetPlayer.notifications : [];
    const unreadCnt = list.filter((n) => n && n.read !== true).length;
    const admTotal = adminCounts
      ? (adminCounts.pendingMatches + adminCounts.pendingRegs + adminCounts.pendingPass + adminCounts.pendingAdmins)
      : 0;
    const iosDiag = window.SMPL_NOTIF && typeof window.SMPL_NOTIF.getIosPushDiagnostic === 'function'
      ? window.SMPL_NOTIF.getIosPushDiagnostic()
      : { needsIosHomeScreen: false, isIos: false, isInAppBrowser: false, needsHttps: false };

    return `
      <div id="smpl-notif-center-backdrop" class="smpl-notif-center-backdrop" onclick="SMPL_APP.closeNotificationsCenterModal()">
        <div class="glass-panel rounded-3xl max-w-xl w-full max-h-[88vh] flex flex-col border-2 border-amber-400/45 shadow-2xl overflow-hidden bg-slate-950/95" onclick="event.stopPropagation()">
          <div class="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-2 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-lg">${notifOn ? '🔔' : '🔕'}</span>
                <h3 class="font-display font-black text-base sm:text-lg text-white uppercase">Centrum Powiadomień</h3>
                ${unreadCnt > 0 ? `<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">${unreadCnt} NOWYCH</span>` : ''}
              </div>
              <p class="text-[11px] text-slate-300 mt-0.5">Wyniki rywali, decyzje Admina, trofea, prezenty i alerty ligowe</p>
            </div>
            <button type="button" onclick="SMPL_APP.closeNotificationsCenterModal()" class="smpl-topbar-icon-btn" title="Zamknij">✕</button>
          </div>

          <div class="p-3 sm:px-5 border-b border-white/10 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <button type="button" onclick="SMPL_APP.handleToggleNotifications()" class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${notifOn ? 'bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40' : 'bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40'}">
                ${notifOn ? '🔔 Powiadomienia (Tel/Laptop): WŁĄCZONE' : '🔕 Powiadomienia (Tel/Laptop): WYŁĄCZONE'}
              </button>
              <button type="button" onclick="SMPL_APP.handleToggleSound()" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[11px] font-bold transition">
                ${soundOn ? '🔊 Dźwięk WŁ' : '🔇 Cisza'}
              </button>
              ${
                notifOn && iosDiag.needsIosHomeScreen && notifPerm === 'unsupported'
                  ? `<button type="button" onclick="SMPL_APP.openIosInstallGuideModal()" class="px-2.5 py-1.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 border border-amber-400/50 text-[11px] font-bold transition">📲 iPhone: Jak włączyć PUSH</button>`
                  : notifOn && notifPerm === 'granted'
                  ? `<button type="button" onclick="SMPL_APP.handleTestPushNotification()" class="px-2.5 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/45 text-purple-200 border border-purple-400/45 text-[11px] font-bold transition">🧪 Test PUSH na telefon</button>`
                  : notifOn && notifPerm !== 'granted' && notifPerm !== 'denied' && notifPerm !== 'unsupported'
                  ? `<button type="button" onclick="SMPL_APP.handleEnablePushNotifications()" class="px-2.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-400/45 text-[11px] font-bold transition">📲 Aktywuj PUSH</button>`
                  : ''
              }
            </div>
            ${
              list.length > 0
                ? `<div class="flex items-center gap-1.5">
                     ${unreadCnt > 0 ? `<button type="button" onclick="SMPL_APP.handleMarkNotificationsRead()" class="px-2.5 py-1.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-400/40 text-[11px] font-bold">✅ Przeczytane</button>` : ''}
                     <button type="button" onclick="SMPL_APP.handleClearNotifications()" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 border border-white/15 text-[11px] font-bold">🗑️ Wyczyść</button>
                   </div>`
                : ''
            }
          </div>

          <div class="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
            ${
              iosDiag.needsIosHomeScreen
                ? `<div class="p-3 rounded-2xl bg-sky-500/15 border border-sky-400/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-sky-100">
                     <span>🍏 <strong>iPhone:</strong> Apple wymaga dodania portalu do Ekranu początkowego (Udostępnij ⬆️ → Dodaj do ekranu początkowego), aby dostawać powiadomienia PUSH.</span>
                     <button type="button" onclick="SMPL_APP.openIosInstallGuideModal()" class="px-2.5 py-1 rounded-xl bg-sky-400 text-slate-950 font-display font-black text-[10px] uppercase">Instrukcja iOS ›</button>
                   </div>`
                : notifPerm === 'denied'
                ? `<div class="p-3 rounded-2xl bg-rose-500/15 border border-rose-400/40 text-[11px] text-rose-100">
                     🔕 <strong>Powiadomienia systemowe zablokowane:</strong> włącz je w Ustawieniach ${iosDiag.isIos ? 'iPhone (Ustawienia → Powiadomienia → Score Match Liga)' : 'przeglądarki'}, aby dostawać alerty poza kartą.
                   </div>`
                : ''
            }
            ${
              !isPublic && admTotal > 0
                ? `<div class="p-3 rounded-2xl bg-amber-500/15 border border-amber-400/45 flex flex-wrap items-center justify-between gap-2 text-xs">
                     <div class="text-amber-100">
                       🛡️ <strong>Kolejka Admina:</strong> ${adminCounts.pendingMatches} meczów • ${adminCounts.pendingRegs} zapisów • ${adminCounts.pendingPass} haseł • ${adminCounts.pendingAdmins} adminów
                     </div>
                     <button type="button" onclick="SMPL_APP.closeNotificationsCenterModal(); SMPL_APP.switchTab('admin');" class="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-display font-black text-[10px] uppercase">Panel Admina →</button>
                   </div>`
                : ''
            }
            ${
              !targetPlayer
                ? `<div class="p-6 text-center text-xs text-slate-400 space-y-2">
                     <div class="text-2xl">🔑</div>
                     <div class="font-bold text-white">Zaloguj się na swoje konto gracza</div>
                     <p>Po zalogowaniu zobaczysz tu powiadomienia o zgłoszonych wynikach rywali, akceptacjach Admina, zdobytych trofeach, Coins i prezentach.</p>
                   </div>`
                : list.length === 0
                ? `<div class="p-6 text-center text-xs text-slate-400 space-y-1.5">
                     <div class="text-3xl">${notifOn ? '📭' : '🔕'}</div>
                     <div class="font-bold text-white">Brak powiadomień na koncie.</div>
                     <p>Gdy przeciwnik wstawi wynik, Admin zatwierdzi mecz albo otrzymasz nagrodę/trofeum — pojawi się tutaj oraz wyskoczy zawsze na wierzchu.</p>
                   </div>`
                : list
                    .map((n) => {
                      const isUnread = n && n.read !== true;
                      const actionBtn = getNotifActionButtonHtml(n);
                      return `
                        <div class="p-3 rounded-2xl border transition ${isUnread ? 'bg-slate-900/95 border-amber-400/55 shadow-lg' : 'bg-slate-950/80 border-white/10 opacity-85'}">
                          <div class="flex items-start gap-2.5">
                            <div class="text-lg flex-shrink-0 leading-none mt-0.5">${esc((n && n.icon) || '🔔')}</div>
                            <div class="min-w-0 flex-1 space-y-1">
                              <div class="flex items-center justify-between gap-2 flex-wrap">
                                <span class="font-bold text-xs text-white">${esc((n && n.title) || 'Komunikat Score Match Liga')}</span>
                                <div class="flex items-center gap-1.5">
                                  ${isUnread ? '<span class="px-1.5 py-0.2 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 text-[9px] font-black uppercase">NOWE</span>' : ''}
                                  <span class="text-[10px] text-slate-400 font-mono-num">${esc((n && (n.time || n.createdAt)) || '')}</span>
                                </div>
                              </div>
                              <p class="text-xs text-slate-200 leading-relaxed">${esc((n && n.text) || '')}</p>
                              ${actionBtn ? `<div class="pt-1">${actionBtn}</div>` : ''}
                            </div>
                          </div>
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>
        </div>
      </div>
    `;
  }

  function resolveNotificationTargetPlayer(state, session) {
    const sess = session || (window.SMPL_DB ? window.SMPL_DB.getSession() : {});
    const st = state || (window.SMPL_DB ? window.SMPL_DB.getState() : { players: [] });
    const isPublicNow = !sess || sess.linkMode === 'PUBLIC';
    const exactPl = sess && sess.activePlayerId
      ? ((st.players || []).find((p) => p && p.id === sess.activePlayerId) || null)
      : null;
    if (isPublicNow) return exactPl;
    const isStrictAdmNow = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(sess));
    const adminPl = isStrictAdmNow && window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function'
      ? window.SMPL_DB.findPlayerForAdmin(sess.adminId, st)
      : null;
    return adminPl || exactPl;
  }

  function renderTopBar(state, session) {
    const topBarEl = document.getElementById('top-auth-bar');
    if (!topBarEl) return;
    topBarEl.className = 'sticky top-0 z-40 smpl-topbar-chrome backdrop-blur-xl';
    if (topBarEl.style) topBarEl.style.zIndex = '';

    const pendingMatchesCount = state.matches.filter((m) => m.status === 'PENDING').length;
    const pendingRegsCount = (state.registrations || []).filter((r) => r.status === 'PENDING').length;
    const pendingPassCount = (state.passwordRequests || []).filter((p) => p.status === 'PENDING').length;
    const pendingAdminsCount = (state.admins || []).filter((a) => a.status === 'PENDING').length;

    const exactPlayer = session.activePlayerId
      ? (state.players.find((p) => p.id === session.activePlayerId) || null)
      : null;
    const activeReg = !exactPlayer && session.activeRegId
      ? ((state.registrations || []).find((r) => r.id === session.activeRegId) || null)
      : null;
    const activePlayer = exactPlayer;
    const winInfoTop = (window.SMPL_DB && typeof window.SMPL_DB.getSeasonJoinWindowInfo === 'function')
      ? window.SMPL_DB.getSeasonJoinWindowInfo(state)
      : { isOpen: false, allowedLeagues: [] };

    const activeNotifications = activePlayer && Array.isArray(activePlayer.notifications)
      ? activePlayer.notifications.filter((n) => n && n.read !== true).length
      : 0;
    const totalNotificationsCount = activePlayer && Array.isArray(activePlayer.notifications)
      ? activePlayer.notifications.length
      : 0;
    const topUpdVer = window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getLatestPlayerUpdateVersion === 'function'
      ? window.SMPL_STUDIO.getLatestPlayerUpdateVersion(state)
      : 'V1.0';
    const topHasUnseenUpd = getSeenUpdateVersionSafe() !== topUpdVer;
    const esc = (window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml) ? window.SMPL_VIEWS.escapeHtml : ((s) => String(s || ''));
    const curThemePref = getThemePreference();
    const curThemeEff = resolveEffectiveTheme(curThemePref);
    const curThemeObj = THEME_OPTIONS.find((t) => t.id === curThemePref) || THEME_OPTIONS[0];
    const isFullscreenNow = Boolean(typeof document !== 'undefined' && (document.fullscreenElement || document.webkitFullscreenElement));
    const aiFabOn = isAiFabVisibleNow();
    const heroExp = isHeroExpandedNow();
    const soundOn = window.SMPL_NOTIF && typeof window.SMPL_NOTIF.isSoundEnabled === 'function' ? window.SMPL_NOTIF.isSoundEnabled() : true;
    const notifOn = window.SMPL_NOTIF && typeof window.SMPL_NOTIF.isNotificationsEnabled === 'function' ? window.SMPL_NOTIF.isNotificationsEnabled() : true;
    const notifPerm = window.SMPL_NOTIF && typeof window.SMPL_NOTIF.getPermissionState === 'function' ? window.SMPL_NOTIF.getPermissionState() : 'default';
    const iosDiagTop = window.SMPL_NOTIF && typeof window.SMPL_NOTIF.getIosPushDiagnostic === 'function'
      ? window.SMPL_NOTIF.getIosPushDiagnostic()
      : { needsIosHomeScreen: false };

    const isPublic = session.linkMode === 'PUBLIC';
    const isGuest = session.isGuest === true;
    const isAuthenticated = session.isPlayerAuthenticated === true;
    const isPlayerInPool = !activePlayer || activePlayer.active === false || activePlayer.leagueId === 'POOL';
    const displayName = activePlayer ? activePlayer.name : (activeReg ? activeReg.name : 'Zawodnik');
    const displayNick = activePlayer ? activePlayer.nick : (activeReg ? activeReg.nick : '');
    const displayAvatar = (activePlayer && activePlayer.avatar) || (activeReg && activeReg.avatar) || '';

    const isStrictAdm = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session));
    const isMaster = isStrictAdm && session.adminRole === 'MASTER_ADMIN';
    const totalAdminAlerts = pendingAdminsCount + pendingMatchesCount + pendingRegsCount + pendingPassCount;
    const myAdminPlTop = isStrictAdm && window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function'
      ? window.SMPL_DB.findPlayerForAdmin(session.adminId, state)
      : null;
    const myAdminActiveLgTop = myAdminPlTop && myAdminPlTop.active !== false && /^L\d+$/i.test(String(myAdminPlTop.leagueId || ''))
      ? myAdminPlTop.leagueId
      : null;

    const adminUnreadNotifs = myAdminPlTop && Array.isArray(myAdminPlTop.notifications)
      ? myAdminPlTop.notifications.filter((n) => n && n.read !== true).length
      : 0;
    const notifTargetPlayer = resolveNotificationTargetPlayer(state, session);
    const notifTotalForDrawer = notifTargetPlayer && Array.isArray(notifTargetPlayer.notifications) ? notifTargetPlayer.notifications.length : totalNotificationsCount;
    const notifUnreadForDrawer = notifTargetPlayer && Array.isArray(notifTargetPlayer.notifications)
      ? notifTargetPlayer.notifications.filter((n) => n && n.read !== true).length
      : 0;
    const bellBadgeCount = notifUnreadForDrawer;
    const hasGearDot = topHasUnseenUpd || (bellBadgeCount > 0 && (!isPublic || notifOn));

    let identityChipHtml = '';
    if (isPublic) {
      identityChipHtml = isGuest
        ? `<span class="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/35 text-[10px] font-bold whitespace-nowrap">👁️ Gość</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35 text-[10px] font-bold max-w-[116px] sm:max-w-[230px]" title="${esc(displayName)}">
             ${displayAvatar ? `<img src="${displayAvatar}" class="w-4 h-4 rounded-full object-cover flex-shrink-0" alt=""/>` : '<span>👤</span>'}
             <span class="truncate">${esc(displayName)}</span>
             <span class="opacity-80 flex-shrink-0">${!isPlayerInPool && activePlayer ? esc(activePlayer.leagueId) : 'Pula'}</span>
           </span>`;
    } else {
      identityChipHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full ${isMaster ? 'bg-amber-400 text-slate-950 font-black' : 'bg-blue-500/20 border border-blue-400/45 text-blue-300 font-bold'} text-[10px] tracking-wide whitespace-nowrap">
          ${isMaster ? '👑 MASTER' : '🛡️ ADMIN'}
        </span>
        <span class="hidden sm:inline font-bold text-emerald-400 truncate max-w-[140px]">${esc(session.adminName || 'Admin')}</span>
      `;
    }

    const drawerHtml = settingsDrawerOpen
      ? `
        <div id="smpl-settings-backdrop" class="smpl-settings-backdrop" onclick="SMPL_APP.closeSettingsDrawer()">
          <div id="smpl-settings-drawer" class="smpl-settings-drawer space-y-3.5" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
              <div class="flex items-center gap-2.5 min-w-0">
                <img src="${displayAvatar || 'css/icon-192.png'}" class="w-10 h-10 rounded-full object-cover border border-amber-400/60 flex-shrink-0" alt=""/>
                <div class="min-w-0">
                  <div class="font-display font-black text-sm text-white truncate">
                    ${isPublic ? (isGuest ? 'Tryb Gościa (Podgląd)' : esc(displayName)) : esc(session.adminName || 'Administrator')}
                  </div>
                  <div class="text-[11px] text-slate-400 truncate">
                    ${
                      isPublic
                        ? (isGuest
                            ? 'Zaloguj się, aby umawiać mecze i wysyłać wyniki'
                            : `${displayNick ? '@' + esc(displayNick) + ' • ' : ''}${!isPlayerInPool && activePlayer ? 'Liga ' + esc(activePlayer.leagueId) : 'W Puli Graczy'}`)
                        : `${isMaster ? '👑 Master Admin SMPL' : '🛡️ Współadmin'}${myAdminActiveLgTop ? ' • Grasz w ' + esc(myAdminActiveLgTop) : ''}`
                    }
                  </div>
                </div>
              </div>
              <button type="button" onclick="SMPL_APP.closeSettingsDrawer()" class="smpl-topbar-icon-btn" title="Zamknij menu">✕</button>
            </div>

            ${
              isPublic
                ? (!isAuthenticated
                    ? `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.handleGateLock();" class="w-full btn-league py-2.5 px-4 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                         🔑 Zaloguj się / Załóż Konto Gracza
                       </button>`
                    : `<div class="grid grid-cols-2 gap-2">
                         <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); ${activePlayer ? `SMPL_APP.openPlayerProfileTab('${activePlayer.id}')` : `SMPL_APP.switchTab('profile')`}" class="smpl-drawer-action-row">
                           <span>🎴 Karta UT &amp; Trofea</span>
                           ${activeNotifications > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">${activeNotifications}</span>` : '<span>›</span>'}
                         </button>
                         <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openEditOwnProfileModal();" class="smpl-drawer-action-row">
                           <span>🎨 Awatar &amp; Bio</span><span>›</span>
                         </button>
                       </div>
                       ${
                         winInfoTop.isOpen
                           ? (isPlayerInPool
                               ? `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openPlayerQuickJoinModal();" class="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow transition">
                                    ⚡ Dołącz do Ligi (Okno otwarte)
                                  </button>`
                               : `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.handlePlayerLeaveLeague();" class="smpl-drawer-action-row text-rose-300">
                                    <span>🚪 Opuść obecną ligę</span><span>›</span>
                                  </button>`)
                           : ''
                       }`)
                : `<div class="grid grid-cols-2 gap-2">
                     <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.switchTab('${activeTab === 'admin' ? 'standings' : 'admin'}');" class="btn-league py-2 px-3 rounded-xl font-display font-black text-[11px] uppercase">
                       ${activeTab === 'admin' ? '🏆 Podgląd Tabel' : '🛡️ Panel Admina'}
                     </button>
                     <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openEditOwnProfileModal();" class="smpl-drawer-action-row">
                       <span>🎨 Awatar &amp; Bio</span><span>›</span>
                     </button>
                     ${
                       myAdminActiveLgTop
                         ? `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openPlayerProfileTab('${myAdminPlTop.id}');" class="smpl-drawer-action-row">
                              <span>🎴 Moja Karta (${esc(myAdminActiveLgTop)})</span><span>›</span>
                            </button>
                            <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openCoinShopModal();" class="smpl-drawer-action-row text-amber-200">
                              <span>🪙 Sklepik Coins</span><span>›</span>
                            </button>
                            <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openAssignHistoricalStatsModal('${myAdminPlTop.id}');" class="smpl-drawer-action-row col-span-2">
                              <span>🏛️ Moje S1–S55 (Statystyki Historyczne)</span><span>›</span>
                            </button>`
                         : `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openAdminJoinAsPlayerModal('L1');" class="smpl-drawer-action-row col-span-2">
                              <span>🛡️ Dołącz jako Gracz (np. L1)</span><span>›</span>
                            </button>`
                     }
                   </div>`
            }

            <div class="pt-1 border-t border-white/10 space-y-2">
              <div class="flex flex-col gap-0.5 text-[11px]">
                <span class="font-display font-black uppercase text-amber-300 tracking-wider">🎨 Kolorystyka i Motyw</span>
                <span class="text-slate-400 text-[10px]">Aktywny: <strong class="text-white">${esc(window.SMPL_WOW && typeof window.SMPL_WOW.getThemeScheduleHint === 'function' ? window.SMPL_WOW.getThemeScheduleHint(curThemePref, curThemeEff) : getThemeEffectiveLabel(curThemeEff))}</strong></span>
              </div>
              <div class="smpl-theme-grid">
                ${THEME_OPTIONS.map((t) => `
                  <button type="button" onclick="SMPL_APP.setThemePreference('${t.id}')" class="smpl-theme-pill-btn ${curThemePref === t.id ? 'is-active' : ''}">
                    <span class="text-xs font-bold flex items-center gap-1">${t.icon} ${esc(t.name)}</span>
                    <span class="text-[10px] text-slate-400 leading-tight">${esc(t.desc)}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="pt-1 border-t border-white/10 space-y-1.5">
              <div class="text-[10px] font-display font-black uppercase text-slate-400 tracking-wider">⚙️ Widok Aplikacji &amp; Narzędzia</div>
              <button type="button" onclick="SMPL_APP.togglePortalDesignMode()" class="smpl-drawer-action-row">
                <span>✨ Styl Portalu (Studio WOW / Klasyczny)</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] ${!window.SMPL_WOW || window.SMPL_WOW.isOverhaulEnabled() ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold' : 'bg-white/10 text-slate-300'}">${!window.SMPL_WOW || window.SMPL_WOW.isOverhaulEnabled() ? 'WOW 2026' : 'KLASYCZNY'}</span>
              </button>
              <button type="button" onclick="SMPL_APP.toggleFullscreenMode()" class="smpl-drawer-action-row">
                <span>⛶ Tryb Pełnoekranowy</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] ${isFullscreenNow ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300'}">${isFullscreenNow ? 'WŁĄCZONY' : 'WŁĄCZ'}</span>
              </button>
              <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openAiAssistant();" class="smpl-drawer-action-row">
                <span>🤖 Otwórz Asystentkę Vanessę AI</span>
                <span class="text-pink-300 text-[10px] font-bold">OTWÓRZ ›</span>
              </button>
              <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openOnboardingTutorialModal({ isAutoFirstTime: false });" class="smpl-drawer-action-row">
                <span>🎬 Poradnik Świeżaka (Wideo A–Z)</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">4:20 ▶</span>
              </button>
              <button type="button" onclick="SMPL_APP.toggleAiFabVisibility()" class="smpl-drawer-action-row">
                <span>💬 Pływający przycisk Vanessy na ekranie</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] ${aiFabOn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300'}">${aiFabOn ? 'WIDOCZNY' : 'UKRYTY'}</span>
              </button>
              <button type="button" onclick="SMPL_APP.toggleHeroExpand()" class="smpl-drawer-action-row">
                <span>📰 Baner Powitalny (Hub S1–S56)</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] ${heroExp ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300'}">${heroExp ? 'ROZWINIĘTY' : 'ZWINIĘTY'}</span>
              </button>
              <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openNotificationsCenterModal();" class="smpl-drawer-action-row">
                <span>📬 Skrzynka Powiadomień</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] ${notifUnreadForDrawer > 0 ? 'bg-rose-600 text-white font-black' : 'bg-white/10 text-slate-300 font-bold'}">${notifUnreadForDrawer > 0 ? `${notifUnreadForDrawer} NOWYCH` : `${notifTotalForDrawer} zapis.`}</span>
              </button>
              <button type="button" onclick="SMPL_APP.handleToggleNotifications()" class="smpl-drawer-action-row">
                <span>${notifOn ? '🔔' : '🔕'} Powiadomienia (Tel / Laptop)</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] ${notifOn ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-rose-500/20 text-rose-300 font-bold'}">${notifOn ? 'WŁĄCZONE' : 'WYŁĄCZONE'}</span>
              </button>
              ${
                notifOn && iosDiagTop.needsIosHomeScreen && notifPerm === 'unsupported'
                  ? `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.openIosInstallGuideModal();" class="smpl-drawer-action-row">
                       <span>🍏 Powiadomienia PUSH na iPhone</span>
                       <span class="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/25 text-amber-200 font-bold">INSTRUKCJA ›</span>
                     </button>`
                  : notifOn && notifPerm === 'granted'
                  ? `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.handleTestPushNotification();" class="smpl-drawer-action-row">
                       <span>📲 Test powiadomień PUSH (Tel)</span>
                       <span class="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-200 font-bold">WYŚLIJ TEST ›</span>
                     </button>`
                  : notifOn && notifPerm !== 'granted' && notifPerm !== 'unsupported'
                  ? `<button type="button" onclick="SMPL_APP.handleEnablePushNotifications()" class="smpl-drawer-action-row">
                       <span>📲 Alerty systemowe poza kartą (PUSH)</span>
                       <span class="px-2 py-0.5 rounded-full text-[10px] ${notifPerm === 'denied' ? 'bg-rose-950/60 text-rose-300' : 'bg-purple-500/20 text-purple-200 font-bold'}">${notifPerm === 'denied' ? 'ZABLOKOWANE' : 'AKTYWUJ ›'}</span>
                     </button>`
                  : ''
              }
              <button type="button" onclick="SMPL_APP.handleToggleSound()" class="smpl-drawer-action-row">
                <span>${soundOn ? '🔊' : '🔇'} Dźwięki Aplikacji i Powiadomień</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] ${soundOn ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300'}">${soundOn ? 'WŁĄCZONE' : 'WYCISZONE'}</span>
              </button>
              <div class="grid grid-cols-2 gap-1.5 pt-0.5">
                <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.switchTab('updates');" class="smpl-drawer-action-row">
                  <span>🆕 Update ${esc(topUpdVer)}</span>
                  ${topHasUnseenUpd ? '<span class="px-1 rounded bg-rose-600 text-white text-[9px] font-black">NEW</span>' : '<span>›</span>'}
                </button>
                <button type="button" onclick="SMPL_APP.closeSettingsDrawer(); SMPL_APP.switchTab('legal');" class="smpl-drawer-action-row">
                  <span>⚖️ Regulamin</span><span>›</span>
                </button>
              </div>
              ${
                isAuthenticated || !isPublic
                  ? `<button type="button" onclick="SMPL_APP.closeSettingsDrawer(); ${isPublic ? 'SMPL_APP.handleGateLock()' : 'SMPL_APP.handleAdminLogout()'};" class="smpl-drawer-action-row text-rose-300 mt-1">
                       <span>🚪 Wyloguj się z konta</span><span>›</span>
                     </button>`
                  : ''
              }
            </div>
          </div>
        </div>
      `
      : '';

    topBarEl.innerHTML = `
      <div class="max-w-7xl mx-auto px-2.5 sm:px-6 py-2 flex items-center justify-between gap-1.5 sm:gap-2 text-xs">
        <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <img src="css/icon-192.png" class="smpl-topbar-brand-crest" alt="Score Match Liga"/>
          <span class="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-display font-bold text-[10px] tracking-wider flex-shrink-0">
            <span class="smpl-live-beacon-dot"></span>
            <span>SCORE MATCH LIGA</span>
          </span>
          ${identityChipHtml}
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
          ${
            !isPublic
              ? `<button type="button" onclick="SMPL_APP.switchTab('${activeTab === 'admin' ? 'standings' : 'admin'}')" class="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-white/15 font-bold text-[11px]">
                   ${activeTab === 'admin' ? '🏆 Tabele' : '🛡️ Panel Admina'}
                 </button>`
              : (!isAuthenticated
                  ? `<button type="button" onclick="SMPL_APP.handleGateLock()" class="smpl-topbar-login-btn px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-[11px] uppercase shadow transition whitespace-nowrap inline-flex items-center justify-center gap-1">
                       🔑 Zaloguj
                     </button>`
                  : '')
          }
          <button type="button" onclick="SMPL_APP.openNotificationsCenterModal()" class="smpl-topbar-icon-btn ${isPublic && !notifOn ? 'opacity-65' : ''}" title="${isPublic ? (notifOn ? 'Centrum Powiadomień — kliknij, aby otworzyć skrzynkę lub wyciszyć alerty' : 'Powiadomienia WYŁĄCZONE — kliknij, aby otworzyć Centrum Powiadomień lub włączyć alerty') : 'Centrum Powiadomień i alerty zarządu'}">
            <span>${isPublic ? (notifOn ? '🔔' : '🔕') : '🔔'}</span>
            ${bellBadgeCount > 0 && (!isPublic || notifOn) ? `<span class="px-1 ml-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black">${bellBadgeCount}</span>` : ''}
          </button>
          <button type="button" onclick="SMPL_APP.cycleThemePreference()" class="smpl-topbar-icon-btn" title="Motyw: ${esc(curThemeObj.name)} (${esc(getThemeEffectiveLabel(curThemeEff))}) — kliknij aby zmienić">
            <span>${curThemeObj.icon}</span>
          </button>
          <button type="button" onclick="SMPL_APP.toggleFullscreenMode()" class="smpl-topbar-icon-btn hidden sm:inline-flex" title="${isFullscreenNow ? 'Wyjdź z pełnego ekranu' : 'Włącz pełny ekran'}">
            <span>⛶</span>
          </button>
          <button type="button" id="smpl-gear-menu-btn" aria-expanded="${settingsDrawerOpen ? 'true' : 'false'}" onclick="SMPL_APP.toggleSettingsDrawer()" class="smpl-gear-trigger relative" title="Otwórz ustawienia, profil, motywy i menu">
            <span>⚙️</span>
            <span class="hidden sm:inline">Menu</span>
            ${hasGearDot ? '<span class="w-2 h-2 rounded-full bg-amber-400"></span>' : ''}
          </button>
        </div>
      </div>
    `;

    let drawerRoot = document.getElementById('smpl-settings-drawer-root');
    if (!drawerRoot && typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
      drawerRoot = document.createElement('div');
      drawerRoot.id = 'smpl-settings-drawer-root';
      document.body.appendChild(drawerRoot);
    }
    if (drawerRoot) {
      drawerRoot.innerHTML = drawerHtml;
    }

    let notifRoot = document.getElementById('smpl-notif-center-root');
    if (!notifRoot && typeof document !== 'undefined' && document.body && typeof document.createElement === 'function') {
      notifRoot = document.createElement('div');
      notifRoot.id = 'smpl-notif-center-root';
      document.body.appendChild(notifRoot);
    }
    if (notifRoot) {
      if (notifCenterOpen) {
        const adminCountsObj = !isPublic
          ? {
              pendingMatches: pendingMatchesCount,
              pendingRegs: pendingRegsCount,
              pendingPass: pendingPassCount,
              pendingAdmins: pendingAdminsCount
            }
          : null;
        notifRoot.innerHTML = buildNotificationsCenterHtml(
          state,
          session,
          esc,
          notifTargetPlayer,
          isPublic,
          notifOn,
          notifPerm,
          soundOn,
          adminCountsObj
        );
      } else {
        notifRoot.innerHTML = '';
      }
    }
    const toastCont = document.getElementById('toast-container');
    if (toastCont && toastCont.parentNode === document.body && typeof document.body.appendChild === 'function') {
      document.body.appendChild(toastCont);
    }

    syncIosSafeAreaGuard();
    syncTopBarHeightVar();
  }

  function renderLeagueSelectorCards(state, sessionOverride) {
    const container = document.getElementById('league-selector-container');
    if (!container) return;

    const sess = sessionOverride || (window.SMPL_DB && window.SMPL_DB.getSession()) || {};
    const isStrictAdmin = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(sess));
    const activeLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(state, false)
      : [
          { id: 'L1', name: 'Ekstraklasa Score Match Liga', shortName: 'EKSTRAKLASA', primaryColor: '#D4AF37' },
          { id: 'L2', name: '2. Liga Score Match Liga (L2)', shortName: '2. LIGA (L2)', primaryColor: '#60A5FA' }
        ];
    const hiddenLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(state, true).filter((lg) => !lg.enabled)
      : [];

    const staticMeta = {
      L1: {
        badge: 'POZIOM I • ELITA SMPL',
        title: 'EKSTRAKLASA',
        colorsDesc: 'Królewskie Złoto & Bordo',
        activeClass: 'active-l1',
        accentColor: '#D4AF37'
      },
      L2: {
        badge: 'POZIOM II • 2. LIGA',
        title: 'DRUGA LIGA (L2)',
        colorsDesc: 'Metaliczne Srebro & Granat',
        activeClass: 'active-l2',
        accentColor: '#60A5FA'
      },
      L3: {
        badge: 'POZIOM III • ROZGRYWKI & REKRUTACJA',
        title: 'TRZECIA LIGA (L3)',
        colorsDesc: 'Miedziany Brąz & Ciemne Żelazo',
        activeClass: 'active-l3',
        accentColor: '#CD7F32'
      }
    };

    if (
      window.SMPL_WOW &&
      typeof window.SMPL_WOW.isOverhaulEnabled === 'function' &&
      window.SMPL_WOW.isOverhaulEnabled() &&
      typeof window.SMPL_WOW.renderSegmentedLeagueBar === 'function'
    ) {
      container.innerHTML = window.SMPL_WOW.renderSegmentedLeagueBar(
        state,
        activeLeague,
        activeLeagues,
        hiddenLeagues,
        isStrictAdmin,
        staticMeta,
        getLeagueCrest
      );
      return;
    }

    const gridColsClass =
      activeLeagues.length <= 2
        ? 'grid-cols-1 md:grid-cols-2'
        : activeLeagues.length === 3
        ? 'grid-cols-1 md:grid-cols-3'
        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';

    container.innerHTML = `
      <div class="grid ${gridColsClass} gap-3.5 sm:gap-4">
        ${activeLeagues
          .map((lg) => {
            const preset = staticMeta[lg.id];
            const num = window.SMPL_DB && typeof window.SMPL_DB.getLeagueNumber === 'function'
              ? window.SMPL_DB.getLeagueNumber(lg.id)
              : 4;
            const activeCls = preset
              ? preset.activeClass
              : (num === 4 ? 'active-l4' : num === 5 ? 'active-l5' : num === 6 ? 'active-l6' : 'active-l-custom');
            const badgeText = preset ? preset.badge : ('POZIOM ' + num + ' • DYWIZJA ' + lg.id);
            const titleText = preset ? preset.title : (lg.shortName || lg.name || lg.id);
            const descText = preset ? preset.colorsDesc : (lg.subtitle || 'Oficjalna Dywizja SMPL');
            const accent = preset ? preset.accentColor : (lg.primaryColor || '#10B981');

            const isActive = activeLeague === lg.id;
            const crest = getLeagueCrest(state, lg.id);
            const pCount = state.players.filter((p) => p.leagueId === lg.id && p.active !== false).length;
            const mPlayed = state.matches.filter(
              (m) => m.leagueId === lg.id && (m.status === 'APPROVED' || m.status === 'WALKOVER')
            ).length;
            const mPending = state.matches.filter((m) => m.leagueId === lg.id && m.status === 'PENDING').length;

            return `
              <div
                role="button"
                tabindex="0"
                onclick="SMPL_APP.switchLeague('${lg.id}')"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();SMPL_APP.switchLeague('${lg.id}');}"
                class="league-tab-card rounded-2xl p-4 sm:p-5 flex items-center gap-4 ${isActive ? activeCls : ''}"
              >
                <img src="${crest}" alt="${window.SMPL_VIEWS.escapeHtml(titleText)}" class="w-16 h-20 sm:w-20 sm:h-24 object-contain flex-shrink-0 drop-shadow-2xl ${isActive ? 'crest-float' : 'opacity-90'}"/>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[10px] font-display font-bold tracking-widest uppercase" style="color: ${accent}">
                      ${window.SMPL_VIEWS.escapeHtml(badgeText)}
                    </span>
                    ${
                      isActive
                        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-white text-[10px] font-display font-black"><span class="smpl-live-beacon-dot"></span>AKTYWNA</span>`
                        : ''
                    }
                  </div>
                  <h3 class="font-display font-black text-base sm:text-lg text-white mt-0.5 truncate">${window.SMPL_VIEWS.escapeHtml(titleText)}</h3>
                  <div class="text-[11px] text-slate-300 truncate">${window.SMPL_VIEWS.escapeHtml(descText)}</div>
                  <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span class="smpl-division-pill text-slate-200">👥 ${pCount} graczy</span>
                    <span class="smpl-division-pill text-emerald-300">⚽ ${mPlayed} rozegranych</span>
                    ${
                      mPending > 0
                        ? `<span class="smpl-division-pill text-amber-300 border-amber-400/50">⏳ ${mPending}</span>`
                        : ''
                    }
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
      ${
        isStrictAdmin
          ? `<div class="mt-3 flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-xs">
              <div class="flex flex-wrap items-center gap-2 text-slate-300">
                <span class="font-display font-bold uppercase text-emerald-300 text-[11px]">🏟️ Zarządzanie Ligami (Admin):</span>
                <span>Aktywne: <strong>${activeLeagues.map((lg) => window.SMPL_VIEWS.escapeHtml(lg.shortName || lg.id)).join(' + ')}</strong></span>
                ${
                  hiddenLeagues.length > 0
                    ? `<span class="text-slate-400">• W rezerwie (ukryte): ${hiddenLeagues.map((lg) => window.SMPL_VIEWS.escapeHtml(lg.id)).join(', ')}</span>`
                    : ''
                }
              </div>
              <div class="flex flex-wrap items-center gap-2">
                ${
                  hiddenLeagues.some((lg) => lg.id === 'L3')
                    ? `<button onclick="SMPL_APP.handleToggleLeagueEnabled('L3', true)" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/40 font-display font-bold text-[11px] uppercase transition">
                        🥉 Włącz 3. Ligę (L3)
                      </button>`
                    : ''
                }
                <button onclick="SMPL_APP.openAddLeagueModal()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 font-display font-black text-[11px] uppercase shadow-lg transition">
                  ➕ Dodaj następną ligę
                </button>
              </div>
            </div>`
          : ''
      }
    `;
  }

  function renderNavigationTabs(state, session) {
    const navEl = document.getElementById('main-tabs-nav');
    if (!navEl) return;
    navEl.className = 'smpl-nav-bar smpl-nav-chrome mb-6 sticky top-[49px] z-30 backdrop-blur-xl py-2 px-2 rounded-2xl';

    const pendingMatchesCount = state.matches.filter((m) => m.status === 'PENDING').length;
    const pendingRegsCount = (state.registrations || []).filter((r) => r.status === 'PENDING').length;
    const pendingPassCount = (state.passwordRequests || []).filter((p) => p.status === 'PENDING').length;
    const pendingAdminsCount = (state.admins || []).filter((a) => a.status === 'PENDING').length;
    const pendingDisputesCount = ((state.competitions && Array.isArray(state.competitions.matchDisputes)) ? state.competitions.matchDisputes : []).filter((d) => d && d.status === 'PENDING').length;
    const adminTotalBadge =
      pendingMatchesCount +
      pendingRegsCount +
      pendingPassCount +
      pendingDisputesCount +
      (session.linkMode === 'MASTER' ? pendingAdminsCount : 0);

    const isStrictAdm = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session));
    const latestUpdVer = window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getLatestPlayerUpdateVersion === 'function'
      ? window.SMPL_STUDIO.getLatestPlayerUpdateVersion(state)
      : 'V1.0';
    const hasUnseenUpdate = getSeenUpdateVersionSafe() !== latestUpdVer;
    const supportCfgNav =
      window.SMPL_DB && typeof window.SMPL_DB.getSupportConfig === 'function'
        ? window.SMPL_DB.getSupportConfig(state)
        : { enabled: true };
    const tabs = [
      { id: 'standings', label: '🏆 Tabela Główna' },
      { id: 'cleansheets', label: '🧤 Żelazna Kurtyna' },
      { id: 'schedule', label: '📅 Terminarz (4 kol./tydz.)' },
      { id: 'profile', label: '🎴 Profil & Karta UT (Trofea)' },
      { id: 'blacklist', label: '💀 Czarna Lista', badge: (state.blacklist || []).length },
      { id: 'goldenball', label: '🏆 Złota Piłka (Głosowanie)' },
      { id: 'competitions', label: '🥇 Konkursy Piłkarskie' },
      { id: 'archive', label: '🏛️ Archiwum & All-Time' },
      { id: 'h2h', label: '⚔️ Porównywarka H2H' },
      { id: 'submit', label: '➕ Dodaj Wynik' },
      { id: 'register', label: '📝 Konto & Zapisy', badge: pendingRegsCount },
      { id: 'updates', label: '🆕 Update ' + latestUpdVer, badge: hasUnseenUpdate ? 'NOWE' : '' },
      ...(supportCfgNav.enabled !== false ? [{ id: 'support', label: '☕ Wesprzyj Ligę', highlightClass: 'smpl-support-tab-pill' }] : []),
      { id: 'legal', label: '⚖️ Prawo & Regulamin' }
    ];

    // Zakładka Panelu Admina widoczna WYŁĄCZNIE po poprawnym zalogowaniu hasłem administratora
    if (isStrictAdm) {
      tabs.push({
        id: 'admin',
        label: session.adminRole === 'MASTER_ADMIN' ? '👑 Panel Master Admina' : '🛡️ Panel Admina',
        badge: adminTotalBadge
      });
    }

    navEl.innerHTML = `
      <div class="smpl-tabs-scroller smpl-hscroll-fade flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
        ${tabs
          .map((t) => {
            const isAct = activeTab === t.id;
            return `
              <button
                type="button"
                data-tab="${t.id}"
                aria-current="${isAct ? 'page' : 'false'}"
                onclick="SMPL_APP.switchTab('${t.id}')"
                class="px-3 py-2.5 rounded-xl font-display font-bold text-[11px] sm:text-xs uppercase tracking-wider transition flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap ${
                  isAct
                    ? 'btn-league shadow-lg'
                    : (t.highlightClass ? t.highlightClass + ' border' : 'bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-white/10')
                }"
              >
                <span>${t.label}</span>
                ${
                  t.badge
                    ? `<span class="px-1.5 py-0.2 rounded-full ${isAct ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'} text-[10px] font-black">${t.badge}</span>`
                    : ''
                }
              </button>
            `;
          })
          .join('')}
      </div>
    `;
    try {
      const navWrap = navEl.querySelector('.smpl-tabs-scroller');
      const activeBtn = navWrap ? navWrap.querySelector('[data-tab="' + activeTab + '"]') : null;
      if (navWrap && activeBtn && typeof activeBtn.offsetLeft === 'number') {
        navWrap.scrollLeft = Math.max(0, activeBtn.offsetLeft - Math.max(16, (navWrap.clientWidth - activeBtn.offsetWidth) / 2));
      }
    } catch (_e) {}
  }

  function renderMobileBottomNav(state, session) {
    const mobEl = document.getElementById('mobile-bottom-nav');
    if (!mobEl) return;

    mobEl.className = 'md:hidden fixed bottom-0 inset-x-0 z-40 smpl-dock-chrome backdrop-blur-xl px-2 py-1.5 grid grid-cols-6 gap-1 text-[10px] font-display font-bold';

    const showAdmin = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session));
    const pendingDisputesMob = ((state.competitions && Array.isArray(state.competitions.matchDisputes)) ? state.competitions.matchDisputes : []).filter((d) => d && d.status === 'PENDING').length;
    const adminDot = showAdmin && (
      (state.matches || []).some((m) => m.status === 'PENDING') ||
      (state.registrations || []).some((r) => r.status === 'PENDING') ||
      (state.passwordRequests || []).some((p) => p.status === 'PENDING') ||
      pendingDisputesMob > 0
    );
    const mobileItems = [
      { id: 'standings', icon: '🏆', label: 'Tabela', inactiveClass: 'text-slate-200' },
      { id: 'schedule', icon: '📅', label: 'Mecze', inactiveClass: 'text-blue-300' },
      { id: 'competitions', icon: '🥇', label: 'Konkursy', inactiveClass: 'text-cyan-300' },
      { id: 'submit', icon: '➕', label: 'Wynik', inactiveClass: 'text-emerald-300' },
      { id: 'profile', icon: '🎴', label: 'Karta UT', inactiveClass: 'text-amber-300' },
      showAdmin
        ? { id: 'admin', icon: '👑', label: 'Admin', inactiveClass: 'text-amber-300', badgeDot: adminDot }
        : { id: 'register', icon: '📝', label: 'Zapisy', inactiveClass: 'text-emerald-300' }
    ];

    mobEl.innerHTML = mobileItems
      .map((item) => {
        const isAct = activeTab === item.id;
        return `
          <button
            type="button"
            data-mob-tab="${item.id}"
            aria-current="${isAct ? 'page' : 'false'}"
            onclick="SMPL_APP.switchTab('${item.id}')"
            class="py-1.5 rounded-xl flex flex-col items-center relative transition ${
              isAct ? 'mob-tab-active btn-league shadow-lg' : item.inactiveClass + ' bg-slate-900/50 hover:bg-white/10'
            }"
          >
            <span class="text-base leading-none">${item.icon}</span>
            <span>${item.label}</span>
            ${item.badgeDot ? '<span class="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>' : ''}
          </button>
        `;
      })
      .join('');
  }

  function renderMainContent(state, session) {
    const mainEl = document.getElementById('app-main-view');
    if (!mainEl) return;
    mainEl.classList.remove('tab-fade-enter');
    void mainEl.offsetWidth;
    mainEl.classList.add('tab-fade-enter');

    if (activeTab === 'standings') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderStandingsView(state, activeLeague);
    } else if (activeTab === 'cleansheets') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderCleanSheetsView(state, activeLeague);
    } else if (activeTab === 'schedule') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderScheduleView(state, activeLeague, scheduleFilter, session);
    } else if (activeTab === 'profile') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderPlayerProfileUTView(state, profileState, session);
    } else if (activeTab === 'goldenball') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderGoldenBallView(state, gbFormState, session);
    } else if (activeTab === 'competitions') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderCompetitionsView(state, competitionsState, session);
    } else if (activeTab === 'archive') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderArchiveView(state, archiveState, session);
    } else if (activeTab === 'h2h') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderH2HView(state, activeLeague, h2hState);
    } else if (activeTab === 'submit') {
      mainEl.innerHTML = window.SMPL_FORMS_ADMIN.renderSubmitScoreView(state, activeLeague, submitFormState, session);
    } else if (activeTab === 'register') {
      mainEl.innerHTML = window.SMPL_FORMS_ADMIN.renderRegistrationView(state, regFormState, session);
    } else if (activeTab === 'blacklist') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderPublicBlacklistView(state);
    } else if (activeTab === 'updates') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderUpdatesChangelogView(state, session, updatesFilterState);
    } else if (activeTab === 'support') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderSupportDonateView(state, session, supportUiState);
    } else if (activeTab === 'legal') {
      mainEl.innerHTML = window.SMPL_VIEWS.renderLegalAndRulesView(state, session, legalSubTab);
    } else if (activeTab === 'admin') {
      mainEl.innerHTML = window.SMPL_FORMS_ADMIN.renderAdminDashboardView(state, activeLeague, adminSubTab, session, {
        recruitmentSubTab: adminRecruitmentSubTab,
        settingsSubTab: adminSettingsSubTab,
        masterAssignPlayerId: masterAssignPlayerId,
        masterAssignRankId: masterAssignRankId
      });
    }
  }

  // =========================================================================
  // PRZEŁĄCZANIE LINKÓW DOSTĘPOWYCH (PUBLIC / ADMIN_LINK / MASTER)
  // =========================================================================
  function exitAdminGateToPublic() {
    window.SMPL_DB.logoutAdmin();
    window.SMPL_FORCED_MODE = 'PUBLIC';
    window.location.hash = '';
    activeTab = 'standings';
    gateMode = 'login';
    showToast('🌐 Powrót do publicznej strony SMPL.');
    renderAll();
  }

  // =========================================================================
  // LOGOWANIE I WNIOSKI O DOŁĄCZENIE DO ADMINISTRACJI
  // =========================================================================

  function handleAdminGateLogin(event) {
    event.preventDefault();
    const u = document.getElementById('gate-admin-user').value || '';
    const p = document.getElementById('gate-admin-pass').value || '';

    const res = window.SMPL_DB.authenticateAdmin(u, p);
    if (!res.ok) {
      if (res.isBlacklisted) {
        if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playGavelSound === 'function') {
          window.SMPL_NOTIF.playGavelSound();
        }
        openBlacklistBlockedModal(res.error);
        return;
      }
      showToast(res.error, 'error');
      return;
    }

    showToast(`🔓 Witaj ${res.admin.name}! Zalogowano do Panelu Administracji SMPL.`);
    activeTab = 'admin';
    adminSubTab = res.admin.role === 'MASTER_ADMIN' ? 'master_studio' : 'moderation';
    renderAll();
  }

  function handleAdminApplicationSubmit(event) {
    event.preventDefault();
    const name = document.getElementById('apply-admin-name').value || '';
    const username = document.getElementById('apply-admin-user').value || '';
    const fbLink = document.getElementById('apply-admin-fb').value || '';
    const division = document.getElementById('apply-admin-division').value || '2. Liga (L2)';
    const password = document.getElementById('apply-admin-pass').value || '';
    const reason = document.getElementById('apply-admin-reason').value || '';

    try {
      const req = window.SMPL_DB.submitAdminApplication({
        name,
        username,
        fbLink,
        division,
        password,
        reason
      });
      showToast(
        `📨 Wniosek dla @${req.username} został wysłany! Oczekuje teraz na zatwierdzenie przez Głównego Admina (Szymona Komendę) na jego linku Master.`
      );
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd wysyłania wniosku.', 'error');
    }
  }

  function handleAdminLogout() {
    window.SMPL_DB.logoutAdmin();
    window.SMPL_FORCED_MODE = 'ADMIN_LINK';
    window.location.hash = 'panel-admina';
    showToast('🚪 Wylogowano z Panelu Administratora.', 'warning');
    renderAll();
  }

  function masterApproveAdmin(adminId) {
    if (!requireStrictAdmin('zatwierdzanie administratorów')) return;
    try {
      const adm = window.SMPL_DB.approveAdminApplication(adminId, 'Szymon Komenda');
      showToast(`✅ Zatwierdziłeś użytkownika ${adm.name} (@${adm.username}) jako Administratora! Może się już zalogować.`);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function masterRejectAdmin(adminId) {
    if (!requireStrictAdmin('odbieranie uprawnień administratora')) return;
    try {
      const adm = window.SMPL_DB.rejectOrRevokeAdmin(adminId, 'Odrzucono przez Głównego Administratora', 'Szymon Komenda');
      showToast(`🚫 Odrzucono / cofnięto uprawnienia administratora dla: ${adm.name}.`, 'warning');
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // AKCJE NAWIGACJI I FILTRÓW
  // =========================================================================
  function scrollNavigationIntoView(forceScroll) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    try {
      const navWrap = document.querySelector('#main-tabs-nav > div');
      if (navWrap) {
        const activeBtn = navWrap.querySelector('[data-tab="' + activeTab + '"]');
        if (activeBtn && typeof activeBtn.offsetLeft === 'number') {
          navWrap.scrollLeft = Math.max(0, activeBtn.offsetLeft - 16);
        }
      }
      if (forceScroll && typeof window.scrollTo === 'function') {
        const targetEl = document.getElementById('main-tabs-nav') || document.getElementById('app-main-view');
        if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
          const topBar = document.getElementById('top-auth-bar');
          const topOffset = topBar ? topBar.offsetHeight || 0 : 0;
          const rect = targetEl.getBoundingClientRect();
          const currentY = window.scrollY || window.pageYOffset || 0;
          const targetTop = Math.max(0, Math.round(rect.top + currentY - topOffset - 8));
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }
    } catch (_err) {}
  }

  function switchLeague(leagueId) {
    activeLeague = leagueId;
    submitFormState.leagueId = leagueId;
    const state = window.SMPL_DB.getState();
    const lp = state.players.filter((p) => p.leagueId === leagueId && p.active !== false);
    if (lp.length >= 2) {
      h2hState.playerAId = lp[0].id;
      h2hState.playerBId = lp[1].id;
      profileState.playerId = lp[0].id;
    }
    const activeWeek = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 2;
    scheduleFilter.week = activeWeek;
    scheduleFilter.round = null;
    renderAll();
  }


  function switchTab(tabId) {
    closeRankTooltip();
    settingsDrawerOpen = false;
    const session = window.SMPL_DB.getSession();
    if (tabId === 'admin' && (!window.SMPL_DB || !window.SMPL_DB.isStrictAdminSession(session))) {
      showToast('Panel Admina jest dostępny tylko po zalogowaniu jako Administrator.', 'error');
      return;
    }
    if (tabId === 'chat') { tabId = 'schedule'; }
    if (tabId === 'updates' && window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getLatestPlayerUpdateVersion === 'function') {
      markUpdateVersionSeen(window.SMPL_STUDIO.getLatestPlayerUpdateVersion(window.SMPL_DB.getState()));
    }
    activeTab = tabId;
    if (window.SMPL_DB && typeof window.SMPL_DB.pullIfStale === 'function') {
      window.SMPL_DB.pullIfStale(10000);
    }
    renderAll();
    scrollNavigationIntoView(false);
    if (tabId === 'admin' && adminSubTab === 'ai_vanessa') {
      setTimeout(refreshAiGeminiAdminPanel, 0);
    } else if (tabId === 'admin' && (adminSubTab === 'settings' || adminSubTab === 'master_backup')) {
      const isHttpNow = typeof window !== 'undefined' && window.location && window.location.protocol && window.location.protocol.startsWith('http');
      if (isHttpNow) {
        setTimeout(() => {
          if (!window._smplAdminWebhooksLoaded) adminLoadWebhooksPanel(true);
          if (!window._smplAdminSnapshotsLoaded) adminLoadSnapshotsPanel(true);
        }, 0);
      }
    }
  }

  function normalizeAdminSubTabId(subTab) {
    const raw = String(subTab || 'moderation').trim();
    if (raw === 'squads') return 'recruitment';
    if (raw === 'master_portal') return 'master_studio';
    return raw;
  }

  function setAdminSubTab(subTab) {
    adminSubTab = normalizeAdminSubTabId(subTab);
    renderAll();
    const isHttpNow = typeof window !== 'undefined' && window.location && window.location.protocol && window.location.protocol.startsWith('http');
    if (adminSubTab === 'ai_vanessa') {
      setTimeout(refreshAiGeminiAdminPanel, 0);
    } else if ((adminSubTab === 'settings' || adminSubTab === 'master_backup') && isHttpNow) {
      setTimeout(() => {
        adminLoadWebhooksPanel(true);
        adminLoadSnapshotsPanel(true);
      }, 0);
    }
  }

  function setAdminRecruitmentSubTab(subTab) {
    adminRecruitmentSubTab = String(subTab || 'all');
    adminSubTab = 'recruitment';
    renderAll();
  }

  function setAdminSettingsSubTab(subTab) {
    adminSettingsSubTab = String(subTab || 'account');
    adminSubTab = 'settings';
    renderAll();
    const isHttpNow = typeof window !== 'undefined' && window.location && window.location.protocol && window.location.protocol.startsWith('http');
    if ((adminSettingsSubTab === 'webhooks' || adminSettingsSubTab === 'backups') && isHttpNow) {
      setTimeout(() => {
        adminLoadWebhooksPanel(true);
        adminLoadSnapshotsPanel(true);
      }, 0);
    }
  }

  function setAdminLeagueQuick(leagueId) {
    if (!leagueId) return;
    activeLeague = String(leagueId);
    renderAll();
  }

  function setScheduleRound(r) {
    scheduleFilter.round = r;
    scheduleFilter.week = null;
    renderAll();
  }

  function setScheduleWeek(w) {
    scheduleFilter.week = w;
    scheduleFilter.round = null;
    renderAll();
  }

  function setScheduleStatus(st) {
    scheduleFilter.status = st;
    renderAll();
  }

  function setScheduleSearch(q) {
    scheduleFilter.search = q;
    renderAll();
  }

  function setH2HPlayer(slot, playerId) {
    if (slot === 'A') h2hState.playerAId = playerId;
    else h2hState.playerBId = playerId;
    renderAll();
  }

  function setProfilePlayer(playerId) {
    profileState.playerId = playerId;
    const state = window.SMPL_DB.getState();
    const p = state.players.find((item) => item.id === playerId);
    if (p && p.leagueId !== activeLeague) {
      activeLeague = p.leagueId;
    }
    renderAll();
  }

  function openPlayerProfileTab(playerId) {
    closeRankTooltip();
    closeModal();
    const state = window.SMPL_DB.getState();
    const p = state.players.find((item) => item.id === playerId);
    if (p) {
      activeLeague = p.leagueId;
      profileState.playerId = p.id;
    }
    activeTab = 'profile';
    renderAll();
    scrollNavigationIntoView(true);
  }

  function copyRegistrationLink() {
    const baseUrl = window.location.href.split('#')[0].replace(/\/[^\/]*$/, '');
    const regUrl = `${baseUrl}/REJESTRACJA.html`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(regUrl);
    }
    showToast(`📋 Skopiowano bezpośredni link do strony rejestracji graczy: ${regUrl}`);
  }

  // =========================================================================
  // PEŁNOEKRANOWY ETAP POWITALNY / BRAMKA LOGOWANIA I REJESTRACJI (FULL-SCREEN GATE)
  // =========================================================================
  function setGateMode(mode) {
    gateMode = mode;
    renderAll();
  }

  function handleGateLoginSubmit() {
    const idInput = document.getElementById('gate-login-id');
    const passInput = document.getElementById('gate-login-pass');
    const identifier = idInput ? idInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (!identifier) {
      showToast('Wpisz swój Login, Nick lub Imię i Nazwisko.', 'error');
      return;
    }
    if (!password) {
      showToast('Wpisz hasło do swojego konta gracza.', 'error');
      return;
    }

    const res = window.SMPL_DB.loginPlayer(identifier, password);
    if (!res.ok) {
      if (res.isBlacklisted) {
        if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playGavelSound === 'function') {
          window.SMPL_NOTIF.playGavelSound();
        }
        openBlacklistBlockedModal(res.error);
        return;
      }
      showToast(res.error || 'Błąd logowania.', 'error');
      return;
    }

    if (res.type === 'ADMIN') {
      window.SMPL_FORCED_MODE = res.isMaster ? 'MASTER' : 'ADMIN_LINK';
      if (typeof window !== 'undefined' && window.location) {
        try { window.location.hash = res.isMaster ? 'master-szymon' : 'panel-admina'; } catch (e) {}
      }
      activeTab = 'admin';
      showToast(`👑 Witaj ${res.admin.name}! Zalogowano pomyślnie do Panelu Administratora SMPL.`);
      renderAll();
      return;
    }

    if (res.type === 'APPROVED_POOL') {
      activeLeague = (res.registration && res.registration.preferredLeague) || 'L1';
      activeTab = 'standings';
      showToast(`✅ Witaj ${res.registration ? res.registration.name : ''}! Konto zatwierdzone — gdy Administracja otworzy start sezonu, kliknij [Dołącz do Ligi].`);
      renderAll();
      return;
    }

    const plLg = res.player && res.player.leagueId && res.player.leagueId !== 'POOL' && res.player.active !== false
      ? res.player.leagueId
      : 'L1';
    activeLeague = plLg;
    profileState.playerId = res.player ? res.player.id : null;
    showToast(`✅ Zalogowano pomyślnie! Witaj ${res.player ? res.player.name : 'Zawodniku'} w portalu SMPL.`);
    renderAll();
  }

  function handleGateGuestEnter() {
    window.SMPL_DB.unlockGateAsGuest();
    showToast('👁️ Witaj w oficjalnym portalu SMPL! Przeglądasz tabele w trybie gościa.');
    renderAll();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) {}
  }

  function handleGateLock() {
    window.SMPL_DB.lockGate();
    window.SMPL_FORCED_MODE = window.SMPL_FORCED_TAB === 'register' ? 'PUBLIC' : '';
    if (window.location.hash && window.location.hash.toLowerCase().indexOf('admin') !== -1 || (window.location.hash || '').toLowerCase().indexOf('master') !== -1) {
      window.location.hash = '';
    }
    gateMode = 'login';
    showToast('🚪 Wylogowano. Powrót do ekranu logowania i rejestracji.');
    renderAll();
  }

  function handleGateAvatarUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    fileToDataUrl(file, 400).then((dataUrl) => {
      gateRegState.avatarPreview = dataUrl;
      const img = document.getElementById('gate-reg-avatar-img');
      if (img) img.src = dataUrl;
    });
  }

  function foldPlText(str) {
    const map = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
    return String(str || '').trim().toLowerCase().replace(/[ąćęłńóśźż]/g, function (ch) {
      return map[ch] || ch;
    });
  }

  function formatArchiveOptionText(a, prefix) {
    const medalStr =
      (a.gold ? ' 👑' + a.gold : '') +
      (a.silver ? ' 🥈' + a.silver : '') +
      (a.bronze ? ' 🥉' + a.bronze : '');
    const statMeta = a.matches > 0
      ? `${a.seasons} sez., ${a.matches}M, ${a.total} pkt${medalStr}`
      : a.bestPos || 'Ranking S1–S55';
    return `${prefix || ''}${a.name} (${statMeta})`;
  }

  function filterHistSelect(selectId, query, mode) {
    const sel = document.getElementById(selectId);
    if (!sel || !window.SMPL_DB || typeof window.SMPL_DB.getHistoricalPlayersCatalog !== 'function') return;
    if (mode === 'reg') regFormState.histSearch = query || '';
    if (mode === 'gate') gateRegState.histSearch = query || '';

    const prevVal = sel.value || '';
    const q = foldPlText(query);
    const catalog = window.SMPL_DB.getHistoricalPlayersCatalog();
    const filtered = !q
      ? catalog
      : catalog.filter(function (a) {
          return foldPlText(a.name).indexOf(q) !== -1;
        });

    const isAdminRecruit = selectId.indexOf('reg-hist-select-') === 0;
    const prefix = isAdminRecruit ? '🏛️ Z Archiwum S1–S55: ' : '';

    const staticOptions = [];
    for (let i = 0; i < sel.options.length; i++) {
      const opt = sel.options[i];
      if (opt.value === '' || String(opt.value).indexOf('PRESET:') === 0) {
        staticOptions.push({ value: opt.value, text: opt.text });
      }
    }

    sel.innerHTML = '';
    staticOptions.forEach(function (so) {
      const o = document.createElement('option');
      o.value = so.value;
      o.textContent = so.text;
      sel.appendChild(o);
    });

    if (filtered.length === 0) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.disabled = true;
      emptyOpt.textContent = '-- Brak graczy pasujących do wyszukiwania --';
      sel.appendChild(emptyOpt);
    } else {
      const targetParent = isAdminRecruit ? document.createElement('optgroup') : sel;
      if (isAdminRecruit) {
        targetParent.label = q ? `--- WYNIKI FILTRU (${filtered.length}) ---` : '--- PEŁNA LISTA GRACZY Z ARCHIWUM S1–S55 ---';
        sel.appendChild(targetParent);
      }
      filtered.forEach(function (a) {
        const o = document.createElement('option');
        o.value = a.name;
        o.textContent = formatArchiveOptionText(a, prefix);
        targetParent.appendChild(o);
      });
    }

    const hasPrev = prevVal && Array.prototype.some.call(sel.options, function (o) { return o.value === prevVal; });
    if (hasPrev) {
      sel.value = prevVal;
    } else if (q && filtered.length === 1) {
      sel.value = filtered[0].name;
      if (mode === 'reg') regFormState.linkedHistoricalName = filtered[0].name;
      if (mode === 'gate') gateRegState.linkedHistoricalName = filtered[0].name;
    }
  }

  function toggleGatePlayedBefore(checked) {
    gateRegState.playedBefore = Boolean(checked);
    const wrap = document.getElementById('gate-reg-hist-picker-wrap');
    if (wrap) {
      if (gateRegState.playedBefore) wrap.classList.remove('hidden');
      else wrap.classList.add('hidden');
    }
    if (!gateRegState.playedBefore) {
      gateRegState.linkedHistoricalName = '';
      const sel = document.getElementById('gate-reg-hist-select');
      if (sel) sel.value = '';
    }
  }

  function onGateHistSelect(val) {
    gateRegState.linkedHistoricalName = val ? String(val).trim() : '';
  }

  function fillDemoRegistrationGate() {
    const stGate = window.SMPL_DB && window.SMPL_DB.getState ? window.SMPL_DB.getState() : null;
    const activeIdsGate = window.SMPL_DB && window.SMPL_DB.getActiveLeagueIds ? window.SMPL_DB.getActiveLeagueIds(stGate) : ['L1', 'L2'];
    const fallbackLgGate = activeIdsGate.indexOf('L2') !== -1 ? 'L2' : (activeIdsGate[0] || 'L2');
    const names = [
      { name: 'Kornel Radlak', nick: 'Radlak_KR3', lg: fallbackLgGate, fb: 'https://m.me/kornel.radlak' },
      { name: 'Szymon Więcław', nick: 'Wieclaw_SW7', lg: fallbackLgGate, fb: 'https://m.me/szymon.wieclaw' },
      { name: 'Waldemar Siwadło', nick: 'Siwadlo_WS', lg: activeIdsGate.indexOf('L3') !== -1 ? 'L3' : fallbackLgGate, fb: 'https://m.me/waldemar.siwadlo' },
      { name: 'Seba Ożóg', nick: 'Ozog_Seba', lg: activeIdsGate.indexOf('L3') !== -1 ? 'L3' : fallbackLgGate, fb: 'https://m.me/seba.ozog' }
    ];
    const pick = names[Math.floor(Math.random() * names.length)];
    const nEl = document.getElementById('gate-reg-name');
    const niEl = document.getElementById('gate-reg-nick');
    const lgEl = document.getElementById('gate-reg-league');
    const fbEl = document.getElementById('gate-reg-fb');
    const pEl = document.getElementById('gate-reg-pass');
    if (nEl) nEl.value = pick.name;
    if (niEl) niEl.value = pick.nick;
    if (lgEl) lgEl.value = pick.lg;
    if (fbEl) fbEl.value = pick.fb;
    if (pEl) pEl.value = '';

    gateRegState.name = pick.name;
    gateRegState.nick = pick.nick;
    gateRegState.league = pick.lg;
    gateRegState.fbLink = pick.fb;
    gateRegState.password = '';
    gateRegState.clanId = '';
    gateRegState.newClanName = '';
    gateRegState.newClanTag = '';
    gateRegState.newClanColor = '#10b981';
    gateRegState.newClanLogoPreview = null;

    gateRegState.avatarPreview = window.SMPL_MEDIA.generatePlayerAvatar(pick.name, pick.nick, 88);
    const aImg = document.getElementById('gate-reg-avatar-img');
    if (aImg) aImg.src = gateRegState.avatarPreview;

    showToast('⚡ Wypełniono przykładowy profil — wpisz teraz swoje własne hasło!');
  }

  function syncGateFieldsToState() {
    const nEl = document.getElementById('gate-reg-name');
    const niEl = document.getElementById('gate-reg-nick');
    const lgEl = document.getElementById('gate-reg-league');
    const fbEl = document.getElementById('gate-reg-fb');
    const pEl = document.getElementById('gate-reg-pass');
    if (nEl && nEl.value) gateRegState.name = nEl.value;
    if (niEl && niEl.value) gateRegState.nick = niEl.value;
    if (lgEl && lgEl.value) gateRegState.league = lgEl.value;
    if (fbEl && fbEl.value) gateRegState.fbLink = fbEl.value;
    if (pEl && pEl.value) gateRegState.password = pEl.value;
  }

  function updateGateField(field, val) {
    if (!field) return;
    gateRegState[field] = String(val == null ? '' : val);
  }

  function getClanFormState(modeKey) {
    return modeKey === 'gate' ? gateRegState : regFormState;
  }

  function getClanDomPrefix(modeKey) {
    return modeKey === 'gate' ? 'gate-reg' : 'reg';
  }

  function onClanSelectChange(modeKey, clanId) {
    const stateObj = getClanFormState(modeKey);
    if (!stateObj) return;
    if (modeKey === 'gate') syncGateFieldsToState();
    stateObj.clanId = String(clanId || '').trim();
    renderAll();
  }

  function updateClanField(modeKey, field, val) {
    const stateObj = getClanFormState(modeKey);
    if (!stateObj || !field) return;
    stateObj[field] = String(val == null ? '' : val);
    if (!stateObj.newClanLogoPreview && window.SMPL_MEDIA && typeof window.SMPL_MEDIA.createClanEmblemSVG === 'function') {
      const prefix = getClanDomPrefix(modeKey);
      const previewImg = document.getElementById(prefix + '-clan-logo-preview');
      if (previewImg) {
        previewImg.src = window.SMPL_MEDIA.createClanEmblemSVG(
          stateObj.newClanName || 'Nowy Klan',
          stateObj.newClanTag || '',
          stateObj.newClanColor || '#10b981'
        );
      }
    }
  }

  function handleClanLogoUpload(modeKey, event) {
    const files = event && event.target ? event.target.files : null;
    const file = files && files[0] ? files[0] : null;
    if (!file) return;
    const stateObj = getClanFormState(modeKey);
    if (!stateObj) return;
    if (modeKey === 'gate') syncGateFieldsToState();
    clanFileToDataUrl(file, 240).then(function (dataUrl) {
      stateObj.newClanLogoPreview = dataUrl;
      stateObj.clanId = '__NEW__';
      showToast('🛡️ Herb / logo klanu zostało wgrane!');
      renderAll();
    });
  }

  function clearClanLogoUpload(modeKey) {
    const stateObj = getClanFormState(modeKey);
    if (!stateObj) return;
    if (modeKey === 'gate') syncGateFieldsToState();
    stateObj.newClanLogoPreview = null;
    showToast('🧹 Usunięto wgrane logo — użyty zostanie automatyczny herb klanu.');
    renderAll();
  }

  function handleGateRegistrationSubmit() {
    syncGateFieldsToState();
    const nameEl = document.getElementById('gate-reg-name');
    const nickEl = document.getElementById('gate-reg-nick');
    const lgEl = document.getElementById('gate-reg-league');
    const fbEl = document.getElementById('gate-reg-fb');
    const passEl = document.getElementById('gate-reg-pass');
    const rulesEl = document.getElementById('gate-reg-rules-check');
    const gdprEl = document.getElementById('gate-reg-gdpr-check');
    const playedEl = document.getElementById('gate-reg-played-before');
    const histSelEl = document.getElementById('gate-reg-hist-select');

    const name = nameEl ? nameEl.value.trim() : String(gateRegState.name || '').trim();
    const nick = nickEl ? nickEl.value.trim() : String(gateRegState.nick || '').trim();
    const preferredLeague = lgEl ? lgEl.value : (gateRegState.league || 'L2');
    const fbLink = fbEl ? fbEl.value.trim() : String(gateRegState.fbLink || '').trim();
    const password = passEl ? passEl.value.trim() : String(gateRegState.password || '').trim();
    const rules = rulesEl ? Boolean(rulesEl.checked) : true;
    const gdprOk = gdprEl ? Boolean(gdprEl.checked) : true;
    const playedBefore = playedEl ? Boolean(playedEl.checked) : Boolean(gateRegState.playedBefore);
    const linkedHistoricalName = playedBefore
      ? (histSelEl ? String(histSelEl.value || '').trim() : String(gateRegState.linkedHistoricalName || '').trim())
      : '';
    const clanId = String(gateRegState.clanId || '').trim();
    const newClanName = String(gateRegState.newClanName || '').trim();
    const newClanTag = String(gateRegState.newClanTag || '').trim();
    const newClanColor = String(gateRegState.newClanColor || '#10b981').trim();

    if (!name || !nick) {
      showToast('Wpisz swoje Imię, Nazwisko oraz Nick w grze.', 'error');
      return;
    }
    if (!password || password.length < 4) {
      showToast('Ustaw swoje prywatne hasło (minimum 4 znaki).', 'error');
      return;
    }
    if (!fbLink) {
      showToast('Podaj link do swojego profilu Messenger lub Facebook do kontaktu z rywalami.', 'error');
      return;
    }
    if (clanId === '__NEW__' && newClanName.length < 2) {
      showToast('🛡️ Wpisz nazwę nowego klanu (minimum 2 znaki) lub wybierz istniejący klan z listy.', 'error');
      return;
    }
    if (playedBefore && !linkedHistoricalName) {
      showToast('Zaznaczyłeś udział w sezonach 1–55 — wybierz swoje Imię i Nazwisko z listy lub odznacz opcję.', 'error');
      return;
    }
    if (!rules) {
      showToast('Musisz zaakceptować Regulamin Rozgrywek SMPL (SMPL-REG-2026.1).', 'error');
      return;
    }
    if (!gdprOk) {
      showToast('Musisz zaakceptować Klauzulę Prawną, RODO oraz potwierdzić wymóg wieku 16+ (lub zgodę opiekuna).', 'error');
      return;
    }

    const isHttpEnv = Boolean(window.location && window.location.protocol && window.location.protocol.indexOf('http') === 0 && typeof fetch === 'function');
    const wasAdminSession = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(window.SMPL_DB.getSession()));
    let reg;
    function resetGateForm() {
      gateRegState.name = '';
      gateRegState.nick = '';
      gateRegState.fbLink = '';
      gateRegState.password = '';
      gateRegState.avatarPreview = null;
      gateRegState.playedBefore = false;
      gateRegState.linkedHistoricalName = '';
      gateRegState.histSearch = '';
      gateRegState.clanId = '';
      gateRegState.newClanName = '';
      gateRegState.newClanTag = '';
      gateRegState.newClanColor = '#10b981';
      gateRegState.newClanLogoPreview = null;
    }

    try {
      reg = window.SMPL_DB.submitRegistration({
        name,
        nick,
        fbLink,
        preference: `Zapis do Score Match Liga (${preferredLeague})`,
        preferredLeague,
        password,
        avatar: gateRegState.avatarPreview,
        clanId: clanId,
        newClanName: newClanName,
        newClanTag: newClanTag,
        newClanColor: newClanColor,
        newClanLogo: gateRegState.newClanLogoPreview || '',
        playedBefore,
        linkedHistoricalName,
        acceptedRules: true,
        acceptedLegalGDPR: true,
        onServerResult: isHttpEnv
          ? (srvErr, srvData) => {
              if (srvErr) {
                if (srvErr.indexOf('Czarn') !== -1 || srvErr.indexOf('ban') !== -1 || srvErr.indexOf('BAN') !== -1 || srvErr.indexOf('ODRAZU') !== -1) {
                  if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playGavelSound === 'function') {
                    window.SMPL_NOTIF.playGavelSound();
                  }
                  openBlacklistBlockedModal(srvErr);
                } else {
                  showToast('❌ Serwer nie zapisał rejestracji: ' + srvErr, 'error');
                }
                renderAll();
                return;
              }
              resetGateForm();
              const finalReg = (srvData && srvData.registration) ? srvData.registration : reg;
              if (!wasAdminSession) {
                window.SMPL_DB.unlockGateAsGuest();
              }
              if (srvData && srvData.offline) {
                showToast('⚠️ Zapisano lokalnie w tej przeglądarce — serwer nie odpowiedział! Jeśli problem się powtarza, napisz do Admina.', 'error');
              } else {
                const loginTxt = finalReg && finalReg.username ? ` (Twój login: ${finalReg.username})` : '';
                showToast(`🎉 Zgłoszenie wysłane do Panelu Admina! Dziękujemy ${finalReg.name}${loginTxt} — oczekuj na przypisanie do ligi.`);
              }
              renderAll();
              if (wasAdminSession && finalReg && finalReg.id) {
                openPostRegistrationAdminChoiceModal(finalReg.id);
              } else if (!wasAdminSession) {
                triggerFirstTimeOnboardingTutorial(finalReg);
              }
            }
          : null
      });
    } catch (err) {
      const errMsg = (err && err.message) ? err.message : 'Odmowa rejestracji.';
      if (errMsg.indexOf('Czarn') !== -1 || errMsg.indexOf('ban') !== -1 || errMsg.indexOf('BAN') !== -1) {
        if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playGavelSound === 'function') {
          window.SMPL_NOTIF.playGavelSound();
        }
        openBlacklistBlockedModal(errMsg);
      } else {
        showToast(errMsg, 'error');
      }
      return;
    }

    if (isHttpEnv) {
      showToast('⏳ Wysyłanie zgłoszenia na serwer SMPL...');
      return;
    }

    resetGateForm();
    if (!wasAdminSession) {
      window.SMPL_DB.unlockGateAsGuest();
    }
    showToast(`🎉 Dziękujemy ${reg.name}! Twoje konto zostało założone${wasAdminSession ? ' — wybierz teraz ligę lub zatwierdź do puli.' : ' i oczekuje na przypisanie do ligi przez Admina.'}`);
    renderAll();
    if (wasAdminSession && reg && reg.id) {
      openPostRegistrationAdminChoiceModal(reg.id);
    } else if (!wasAdminSession) {
      triggerFirstTimeOnboardingTutorial(reg);
    }
  }

  // =========================================================================
  // LOGOWANIE GRACZA ORAZ PRZYPOMNIENIE HASŁA (SELF-SERVICE + WYSYŁANIE PRZEZ ADMINA)
  // =========================================================================
  function handlePlayerLoginSubmit(event) {
    event.preventDefault();
    const idEl = document.getElementById('player-login-id') || document.getElementById('player-login-identifier');
    const passEl = document.getElementById('player-login-pass') || document.getElementById('player-login-password');
    const identifier = idEl ? idEl.value || '' : '';
    const password = passEl ? passEl.value || '' : '';

    const res = window.SMPL_DB.loginPlayer(identifier, password);
    if (!res.ok) {
      if (res.isBlacklisted) {
        if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playGavelSound === 'function') {
          window.SMPL_NOTIF.playGavelSound();
        }
        openBlacklistBlockedModal(res.error);
        return;
      }
      showToast(res.error, 'error');
      return;
    }

    if (res.type === 'ADMIN') {
      window.SMPL_FORCED_MODE = res.isMaster ? 'MASTER' : 'ADMIN_LINK';
      if (typeof window !== 'undefined' && window.location) {
        try { window.location.hash = res.isMaster ? 'master-szymon' : 'panel-admina'; } catch (e) {}
      }
      activeTab = 'admin';
      showToast(`👑 Witaj ${res.admin.name}! Zalogowano pomyślnie do Panelu Administratora SMPL.`);
    } else if (res.type === 'APPROVED_POOL') {
      activeLeague = (res.registration && res.registration.preferredLeague) || 'L1';
      activeTab = 'standings';
      showToast(`✅ Zalogowano do puli graczy (${res.registration ? res.registration.name : ''})! Gdy okno startu sezonu jest otwarte, kliknij [Dołącz do Ligi].`);
    } else if (res.type === 'ACTIVE_PLAYER') {
      const plLg = res.player.leagueId && res.player.leagueId !== 'POOL' && res.player.active !== false
        ? res.player.leagueId
        : 'L1';
      activeLeague = plLg;
      profileState.playerId = res.player.id;
      activeTab = 'profile';
      showToast(`🔓 Zalogowano na konto zawodnika: ${res.player.name} (@${res.player.nick})! Otwieram Twoją Kartę UT i Trofea.`);
    } else if (res.type === 'PENDING_REGISTRATION') {
      showToast(
        `⏳ Twoje konto (${res.registration.name}) jest aktywne i znajduje się na „Liście Graczy do Dodania i Dopisania do Ligi” — oczekuje na przypisanie przez Administrację!`,
        'warning'
      );
    }
    renderAll();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch(e) {}
  }

  function openPasswordReminderModal() {
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-amber-400">SYSTEM ODZYSKIWANIA DOSTĘPU SMPL</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🔑 Przypomnienie Hasła Gracza</h3>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <p class="text-xs text-slate-300 mb-4 leading-relaxed">
          Podaj swoje <strong>Imię i Nazwisko</strong> lub <strong>Nick z gry</strong> oraz link / nazwę na Messengerze. System wyśle prośbę do Administracji (która 1 kliknięciem wyśle Ci przypomnienie na Messengerze) oraz sprawdzi podpowiedź systemową.
        </p>

        <form onsubmit="SMPL_APP.handlePlayerPasswordReminderSubmit(event)" class="space-y-3.5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Imię i Nazwisko lub Nick w grze *</label>
            <input id="remind-player-id" type="text" required placeholder="Np. Piotr Pastuszak lub Pastuszak_SM" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Link do Messengera / FB (gdzie wysłać przypomnienie) *</label>
            <input id="remind-player-fb" type="text" required placeholder="Np. m.me/twoj.profil" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
            <button type="submit" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display uppercase">
              📨 Przypomnij hasło / Wyślij prośbę
            </button>
          </div>
        </form>
      </div>
    `);
  }

  function handlePlayerPasswordReminderSubmit(event) {
    event.preventDefault();
    const idVal = document.getElementById('remind-player-id').value || '';
    const fbVal = document.getElementById('remind-player-fb').value || '';

    try {
      const res = window.SMPL_DB.requestPasswordReminder(idVal, fbVal);
      closeModal();

      openModal(`
        <div class="p-6">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <h3 class="font-display font-black text-lg text-emerald-400 uppercase">✅ Prośba o przypomnienie hasła przyjęta!</h3>
            <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
          </div>
          <div class="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-slate-200 space-y-2 mb-4">
            <div>👤 Konto: <strong class="text-white">${window.SMPL_VIEWS.escapeHtml(res.request.playerName)} (@${window.SMPL_VIEWS.escapeHtml(res.request.playerNick)})</strong></div>
            <div>📨 Status: <strong class="text-emerald-300">Wysłano powiadomienie do Panelu Administracji SMPL</strong> — ze względów bezpieczeństwa nowe hasło tymczasowe przekaże Ci wyłącznie Administrator w prywatnej wiadomości na Messengerze!</div>
          </div>
          <div class="flex justify-end">
            <button onclick="SMPL_APP.closeModal()" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">Rozumiem</button>
          </div>
        </div>
      `);
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd wysyłania prośby.', 'error');
    }
  }

  function handleAdminSendPasswordReminder(playerId) {
    if (!requireStrictAdmin('przypomnienie hasła')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.adminSendPasswordReminder(playerId, session.adminName || 'Szymon Komenda');
      openModal(`
        <div class="p-6">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <span class="text-[10px] font-display font-bold uppercase text-amber-400">WYSYŁANIE PRZYPOMNIENIA HASŁA GRACZOWI</span>
              <h3 class="font-display font-black text-lg text-white uppercase">📨 Przypomnienie Hasła dla: ${window.SMPL_VIEWS.escapeHtml(res.player.name)}</h3>
            </div>
            <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
          </div>

          <div class="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 mb-4">
            ✅ <strong>Wysłano powiadomienie bezpośrednio na Profil Gracza w aplikacji!</strong> Poniżej masz gotową wiadomość z jego loginem i hasłem — kliknij „Kopiuj wiadomość na Messenger” i wklej ją graczowi na czacie:
          </div>

          <textarea id="admin-password-reminder-msg" rows="7" readonly class="w-full p-3.5 rounded-2xl bg-slate-950 border border-white/15 text-xs text-slate-200 font-mono mb-4">${res.reminderText}</textarea>

          <div class="flex flex-wrap justify-between items-center gap-2">
            <a href="${window.SMPL_VIEWS.escapeHtml(res.player.fbLink || 'https://m.me/')}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-bold">
              💬 Otwórz Messenger Gracza
            </a>
            <div class="flex gap-2">
              <button onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Zamknij</button>
              <button onclick="SMPL_APP.copyTextHelper('admin-password-reminder-msg', '📋 Skopiowano wiadomość z przypomnieniem hasła! Wklej ją graczowi na Messengerze.')" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display uppercase">
                📋 Kopiuj wiadomość na Messenger
              </button>
            </div>
          </div>
        </div>
      `);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function copyTextHelper(elementId, toastMsg) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(el.value);
    } else {
      document.execCommand('copy');
    }
    showToast(toastMsg || '📋 Skopiowano do schowka!');
  }

  function openAdminResetPasswordModal(playerId) {
    if (!requireStrictAdmin('reset hasła gracza')) return;
    const state = window.SMPL_DB.getState();
    const p =
      (state.players || []).find((item) => item && item.id === playerId) ||
      (state.registrations || []).find((item) => item && item.id === playerId);
    if (!p) return;

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <h3 class="font-display font-black text-lg text-white uppercase">🔑 Zmień / Zresetuj Hasło Gracza</h3>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <p class="text-xs text-slate-300 mb-3">
          Gracz: <strong>${window.SMPL_VIEWS.escapeHtml(p.name)} (@${window.SMPL_VIEWS.escapeHtml(p.nick)})</strong> • Login: <code class="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono-num">${window.SMPL_VIEWS.escapeHtml(p.username || '-')}</code>
        </p>
        <div class="mb-4">
          <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nowe hasło dla gracza (min. 4 znaki) *</label>
          <input id="admin-new-player-pass" type="text" value="" placeholder="Wpisz nowe hasło tymczasowe..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-mono-num"/>
        </div>
        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.confirmAdminResetPassword('${p.id}')" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">
            💾 Zapisz nowe hasło
          </button>
        </div>
      </div>
    `);
  }

  function confirmAdminResetPassword(playerId) {
    if (!requireStrictAdmin('zapisanie hasła gracza')) return;
    const session = window.SMPL_DB.getSession();
    const newPass = (document.getElementById('admin-new-player-pass').value || '').trim();
    if (!newPass || newPass.length < 4) {
      showToast('Nowe hasło musi mieć minimum 4 znaki.', 'error');
      return;
    }
    try {
      const p = window.SMPL_DB.adminResetPlayerPassword(playerId, newPass, session.adminName || 'Szymon Komenda');
      closeModal();
      showToast(`🔑 Ustawiono nowe hasło dla gracza ${p.name}: ${newPass}`);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  let manualRegUsernameEdited = false;
  let addPlayerModalUsernameEdited = false;

  function openPreparedCredentialsModal(info) {
    const cfg = info && typeof info === 'object' ? info : {};
    const esc = (s) => (window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml ? window.SMPL_VIEWS.escapeHtml(s) : String(s || ''));
    const fbHref = String(cfg.fbLink || '').trim();
    const hasHttpFb = /^https?:\/\//i.test(fbHref);
    const passDisplay = cfg.usedExistingPassword
      ? 'Zachowano dotychczasowe hasło gracza'
      : String(cfg.password || '');

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-amber-400">${esc(cfg.badge || 'DANE LOGOWANIA GOTOWE')}</span>
            <h3 class="font-display font-black text-lg text-white uppercase">${esc(cfg.title || '🔑 Gotowe Dane Logowania')}</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div class="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-100 mb-4 space-y-2">
          <div class="font-bold text-emerald-300">✅ Konto zapisane w bazie! Przekaż poniższe dane graczowi / adminowi:</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <div class="p-2.5 rounded-xl bg-slate-950/90 border border-white/10">
              <div class="text-[10px] text-slate-400 uppercase font-bold">Osoba / Cel</div>
              <div class="font-bold text-white">${esc(cfg.name || '')}${cfg.nick ? ' (@' + esc(cfg.nick) + ')' : ''}</div>
              <div class="text-[11px] text-blue-300 mt-0.5">${esc(cfg.targetLabel || '')}</div>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-950/90 border border-amber-400/40">
              <div class="text-[10px] text-slate-400 uppercase font-bold">Login &amp; Hasło</div>
              <div class="text-xs text-slate-200 mt-0.5">Login: <code class="text-amber-300 font-mono-num font-bold">${esc(cfg.username || '')}</code></div>
              <div class="text-xs text-slate-200 mt-0.5">Hasło: <code class="text-emerald-300 font-mono-num font-bold">${esc(passDisplay)}</code></div>
            </div>
          </div>
        </div>

        <label class="block text-[11px] font-display uppercase text-slate-300 mb-1.5 font-bold">Gotowa wiadomość na Messenger / WhatsApp:</label>
        <textarea id="prepared-credentials-messenger-msg" rows="6" readonly class="w-full p-3.5 rounded-2xl bg-slate-950 border border-white/15 text-xs text-slate-200 font-mono mb-4">${esc(cfg.messengerText || '')}</textarea>

        <div class="flex flex-wrap justify-between items-center gap-2">
          ${
            hasHttpFb
              ? `<a href="${esc(fbHref)}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-bold">💬 Otwórz Messenger</a>`
              : '<span></span>'
          }
          <div class="flex gap-2">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Zamknij</button>
            <button type="button" onclick="SMPL_APP.copyTextHelper('prepared-credentials-messenger-msg', '📋 Skopiowano login, hasło i wiadomość do wysłania!')" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display uppercase">
              📋 Kopiuj Wiadomość
            </button>
          </div>
        </div>
      </div>
    `);
  }

  function masterFillGrantAdminFromSource() {
    const sel = document.getElementById('master-grant-source');
    const nameEl = document.getElementById('master-grant-name');
    const userEl = document.getElementById('master-grant-username');
    const fbEl = document.getElementById('master-grant-fb');
    const hintEl = document.getElementById('master-grant-pass-hint');
    if (!sel || !nameEl || !userEl) return;

    const val = String(sel.value || '');
    const st = window.SMPL_DB.getState();
    if (!val) {
      nameEl.value = '';
      userEl.value = '';
      if (fbEl) fbEl.value = '';
      if (hintEl) hintEl.textContent = 'Wpisz nowe hasło dla administratora lub kliknij 🎲 Losuj.';
      return;
    }

    let src = null;
    if (val.indexOf('PLAYER::') === 0) {
      const pid = val.slice(8);
      src = (st.players || []).find((p) => p && String(p.id) === pid) || null;
    } else if (val.indexOf('REG::') === 0) {
      const rid = val.slice(5);
      src = (st.registrations || []).find((r) => r && String(r.id) === rid) || null;
    }
    if (!src) return;

    nameEl.value = src.name || '';
    userEl.value = src.username || window.SMPL_DB.toCleanUsername(src.name || '');
    if (fbEl) fbEl.value = src.fbLink || src.fb || '';
    if (hintEl) {
      hintEl.textContent = src.passwordHash
        ? 'Wybrany gracz ma aktywne hasło — zostaw pole puste aby je zachować, albo wpisz/wylosuj nowe.'
        : 'Konto źródłowe nie ma hasła — wpisz hasło lub kliknij 🎲 Losuj.';
    }
  }

  function masterGenerateGrantAdminPass() {
    const passEl = document.getElementById('master-grant-password');
    if (!passEl) return;
    passEl.value = window.SMPL_DB.generateReadablePassword('ADM');
  }

  function masterGrantAdminSubmit() {
    if (!requireMasterAdmin('bezpośrednie nadanie uprawnień Administratora')) return;
    const session = window.SMPL_DB.getSession();
    const srcRaw = (document.getElementById('master-grant-source') && document.getElementById('master-grant-source').value) || '';
    const name = (document.getElementById('master-grant-name') && document.getElementById('master-grant-name').value) || '';
    const username = (document.getElementById('master-grant-username') && document.getElementById('master-grant-username').value) || '';
    const password = (document.getElementById('master-grant-password') && document.getElementById('master-grant-password').value) || '';
    const division = (document.getElementById('master-grant-division') && document.getElementById('master-grant-division').value) || 'Wszystkie Dywizje (Zarząd)';
    const fbLink = (document.getElementById('master-grant-fb') && document.getElementById('master-grant-fb').value) || '';
    const linkEl = document.getElementById('master-grant-link-player');
    const linkPlayer = linkEl ? Boolean(linkEl.checked) : true;

    const sourcePlayerId = srcRaw.indexOf('PLAYER::') === 0 ? srcRaw.slice(8) : '';
    const sourceRegId = srcRaw.indexOf('REG::') === 0 ? srcRaw.slice(5) : '';

    try {
      let res = null;
      res = window.SMPL_DB.masterGrantAdminDirect(
        {
          sourcePlayerId,
          sourceRegId,
          name,
          username,
          password,
          division,
          fbLink,
          linkPlayer,
          masterName: session.adminName || 'Szymon Komenda'
        },
        (err, serverData) => {
          if (err) {
            showToast('❌ ' + err, 'error');
            renderAll();
            return;
          }
          const info = serverData || res || {};
          const finalAdm = info.admin || (res && res.admin);
          renderAll();
          openPreparedCredentialsModal({
            title: '👑 Uprawnienia Administratora Nadane ("TAK O")!',
            badge: 'MASTER ADMIN • CO_ADMIN AKTYWNY OD RĘKI',
            name: finalAdm.name,
            username: finalAdm.username,
            password: info.tempPassword,
            usedExistingPassword: info.usedExistingPassword,
            targetLabel: 'Administrator SMPL — ' + (finalAdm.division || division),
            fbLink: finalAdm.fbLink,
            messengerText: info.messengerText
          });
          showToast(`👑 Nadano uprawnienia Admina dla ${finalAdm.name} (@${finalAdm.username})!`);
        }
      );
      if (res && res.admin) {
        renderAll();
      }
    } catch (err) {
      showToast((err && err.message) || 'Błąd nadawania uprawnień Administratora.', 'error');
    }
  }

  function openMasterGrantPlayerAdminModal(playerId) {
    if (!requireMasterAdmin('awans gracza na Administratora')) return;
    const st = window.SMPL_DB.getState();
    const p = (st.players || []).find((item) => item && String(item.id) === String(playerId));
    if (!p) return;
    const leagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(st, false)
      : [];
    const esc = (s) => (window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml ? window.SMPL_VIEWS.escapeHtml(s) : String(s || ''));
    const suggestedUser = p.username || window.SMPL_DB.toCleanUsername(p.name || 'admin');

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-amber-400">👑 TYLKO MASTER ADMIN • AWANS GRACZA BEZ WNIOSKU</span>
            <h3 class="font-display font-black text-lg text-white uppercase">Nadaj Admina: ${esc(p.name)}</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <p class="text-xs text-slate-300 mb-4">
          Gracz <strong>${esc(p.name)} (@${esc(p.nick)})</strong> otrzyma natychmiast uprawnienia <strong>CO_ADMIN (APPROVED)</strong> oraz odznakę 🛡️ ADMIN w lidze.
        </p>

        <div class="space-y-3 mb-5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Login Administratora *</label>
            <input id="master-modal-grant-username" type="text" value="${esc(suggestedUser)}" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Hasło Admina (opcjonalnie)</label>
            <div class="flex items-center gap-2">
              <input id="master-modal-grant-password" type="text" value="" placeholder="${p.passwordHash ? 'Puste = zachowa obecne hasło gracza' : 'Wpisz hasło lub kliknij Losuj'}" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold"/>
              <button type="button" onclick="SMPL_APP.masterModalGenerateGrantPass()" class="px-3 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-xs font-bold flex-shrink-0">🎲 Losuj</button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Sekcja / Dywizja</label>
            <select id="master-modal-grant-division" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold">
              <option value="Wszystkie Dywizje (Zarząd)">Wszystkie Dywizje (Zarząd)</option>
              ${leagues.map((lg) => `<option value="Opiekun ${esc(lg.name || lg.id)}">Opiekun ${esc(lg.name || lg.id)}</option>`).join('')}
              <option value="Tabela & Terminarze">Tabela &amp; Terminarze</option>
              <option value="Moderacja & Skargi">Moderacja &amp; Skargi</option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
            <input id="master-modal-grant-link" type="checkbox" checked class="w-4 h-4 cursor-pointer"/>
            <span>Powiąż konto admina z profilem gracza w tabeli</span>
          </label>
        </div>

        <div class="flex justify-end gap-2">
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">Anuluj</button>
          <button type="button" onclick="SMPL_APP.confirmMasterGrantPlayerAdmin('${esc(p.id)}')" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">
            👑 Nadaj Admina ("TAK O")
          </button>
        </div>
      </div>
    `);
  }

  function masterModalGenerateGrantPass() {
    const el = document.getElementById('master-modal-grant-password');
    if (!el) return;
    el.value = window.SMPL_DB.generateReadablePassword('ADM');
  }

  function confirmMasterGrantPlayerAdmin(playerId) {
    if (!requireMasterAdmin('awans gracza na Administratora')) return;
    const session = window.SMPL_DB.getSession();
    const username = (document.getElementById('master-modal-grant-username') && document.getElementById('master-modal-grant-username').value) || '';
    const password = (document.getElementById('master-modal-grant-password') && document.getElementById('master-modal-grant-password').value) || '';
    const division = (document.getElementById('master-modal-grant-division') && document.getElementById('master-modal-grant-division').value) || 'Wszystkie Dywizje (Zarząd)';
    const linkEl = document.getElementById('master-modal-grant-link');
    const linkPlayer = linkEl ? Boolean(linkEl.checked) : true;

    try {
      let res = null;
      res = window.SMPL_DB.masterGrantAdminDirect(
        {
          sourcePlayerId: playerId,
          username,
          password,
          division,
          linkPlayer,
          masterName: session.adminName || 'Szymon Komenda'
        },
        (err, serverData) => {
          if (err) {
            showToast('❌ ' + err, 'error');
            renderAll();
            return;
          }
          const info = serverData || res || {};
          const finalAdm = info.admin || (res && res.admin);
          closeModal();
          renderAll();
          openPreparedCredentialsModal({
            title: '👑 Gracz Awansowany na Admina ("TAK O")!',
            badge: 'MASTER ADMIN • CO_ADMIN AKTYWNY',
            name: finalAdm.name,
            username: finalAdm.username,
            password: info.tempPassword,
            usedExistingPassword: info.usedExistingPassword,
            targetLabel: 'Administrator SMPL — ' + (finalAdm.division || division),
            fbLink: finalAdm.fbLink,
            messengerText: info.messengerText
          });
          showToast(`👑 ${finalAdm.name} jest już Administratorem!`);
        }
      );
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się nadać uprawnień Administratora.', 'error');
    }
  }

  function onManualRegIdentityInput() {
    if (manualRegUsernameEdited) return;
    const nameEl = document.getElementById('manual-reg-name');
    const userEl = document.getElementById('manual-reg-username');
    if (!nameEl || !userEl) return;
    const val = String(nameEl.value || '').trim();
    userEl.value = val ? window.SMPL_DB.toCleanUsername(val) : '';
  }

  function onManualRegUsernameManualEdit() {
    const userEl = document.getElementById('manual-reg-username');
    manualRegUsernameEdited = Boolean(userEl && String(userEl.value || '').trim());
  }

  function manualRegGeneratePass() {
    const passEl = document.getElementById('manual-reg-password');
    if (!passEl) return;
    passEl.value = window.SMPL_DB.generateReadablePassword('SMPL');
  }

  function handleAdminManualRegisterSubmit() {
    if (!requireStrictAdmin('ręczne utworzenie konta gracza')) return;
    const session = window.SMPL_DB.getSession();
    const name = (document.getElementById('manual-reg-name') && document.getElementById('manual-reg-name').value) || '';
    const nick = (document.getElementById('manual-reg-nick') && document.getElementById('manual-reg-nick').value) || '';
    const username = (document.getElementById('manual-reg-username') && document.getElementById('manual-reg-username').value) || '';
    const password = (document.getElementById('manual-reg-password') && document.getElementById('manual-reg-password').value) || '';
    const targetVal = (document.getElementById('manual-reg-target') && document.getElementById('manual-reg-target').value) || activeLeague || 'L2';
    const fbLink = (document.getElementById('manual-reg-fb') && document.getElementById('manual-reg-fb').value) || '';
    const clanId = (document.getElementById('manual-reg-clan') && document.getElementById('manual-reg-clan').value) || 'NONE';
    const histVal = (document.getElementById('manual-reg-hist') && document.getElementById('manual-reg-hist').value) || '';

    try {
      let res = null;
      res = window.SMPL_DB.adminManualRegisterPlayer(
        {
          name,
          nick,
          username,
          password,
          fbLink,
          leagueId: targetVal,
          targetMode: targetVal === 'APPROVED_POOL' ? 'POOL' : 'LEAGUE',
          preferredLeague: activeLeague || 'L2',
          clanId,
          historicalArchiveName: histVal
        },
        session.adminName || 'Szymon Komenda',
        (err, serverData) => {
          if (err) {
            showToast('❌ ' + err, 'error');
            renderAll();
            return;
          }
          const info = serverData || res || {};
          manualRegUsernameEdited = false;
          if (targetVal !== 'APPROVED_POOL') activeLeague = targetVal;
          const entity = info.player || info.registration || (res && (res.player || res.registration));
          const finalUser = (entity && entity.username) || info.username || username;
          renderAll();
          openPreparedCredentialsModal({
            title: '✍️ Konto Gracza Utworzone Ręcznie!',
            badge: info.mode === 'POOL' ? 'PULA AKTYWNYCH KONT (GOTOWY DO LOGOWANIA)' : 'ZAWODNIK DODANY DO LIGI',
            name: entity ? entity.name : name,
            nick: entity ? entity.nick : nick,
            username: finalUser,
            password: info.tempPassword,
            targetLabel: info.destLabel,
            fbLink: (entity && entity.fbLink) || fbLink,
            messengerText: info.messengerText
          });
          showToast(`✍️ Utworzono konto ${entity ? entity.name : name} (login: ${finalUser})`);
        }
      );
    } catch (err) {
      showToast((err && err.message) || 'Błąd ręcznej rejestracji konta.', 'error');
    }
  }

  function onAddPlayerModalNameInput() {
    if (addPlayerModalUsernameEdited) return;
    const nameEl = document.getElementById('new-player-name');
    const userEl = document.getElementById('new-player-username');
    if (!nameEl || !userEl) return;
    const val = String(nameEl.value || '').trim();
    userEl.value = val ? window.SMPL_DB.toCleanUsername(val) : '';
  }

  function onAddPlayerModalUsernameEdit() {
    const userEl = document.getElementById('new-player-username');
    addPlayerModalUsernameEdited = Boolean(userEl && String(userEl.value || '').trim());
  }

  function addPlayerModalGeneratePass() {
    const passEl = document.getElementById('new-player-pass');
    if (!passEl) return;
    passEl.value = window.SMPL_DB.generateReadablePassword('SMPL');
  }

  // =========================================================================
  // GABLOTA TROFEÓW GRACZA — NADAWANIE TROFEÓW PRZEZ ADMINA
  // =========================================================================
  function openAwardTrophyModal(playerId) {
    if (!requireStrictAdmin('przyznawanie trofeum')) return;
    const state = window.SMPL_DB.getState();
    const p = state.players.find((item) => item.id === playerId);
    if (!p) return;

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <h3 class="font-display font-black text-lg text-amber-400 uppercase">🏆 Przyznaj Trofeum do Gabloty Gracza</h3>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <p class="text-xs text-slate-300 mb-4">
          Dodajesz oficjalne trofeum na profil zawodnika: <strong>${window.SMPL_VIEWS.escapeHtml(p.name)} (@${window.SMPL_VIEWS.escapeHtml(p.nick)})</strong>
        </p>
        <div class="space-y-3 mb-5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Wybierz ikonę trofeum</label>
            <select id="award-trophy-icon" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-bold">
              <option value="👑">👑 Korona Mistrza Ligi</option>
              <option value="🏆">🏆 Złota Piłka / Puchar</option>
              <option value="🥈">🥈 Srebrny Medal (Wicemistrz)</option>
              <option value="🥉">🥉 Brązowy Medal (Podium)</option>
              <option value="🧤">🧤 Złote Rękawice (Żelazna Kurtyna)</option>
              <option value="⚽">⚽ Król Strzelców SMPL</option>
              <option value="🔥">🔥 Zawodnik Tygodnia / Kolejki</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nazwa Trofeum *</label>
            <input id="award-trophy-title" type="text" value="Zawodnik Tygodnia Score Match Liga" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Sezon / Opis</label>
            <input id="award-trophy-season" type="text" value="Sezon ${(window.SMPL_DB.getState().season || 56)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.confirmAwardTrophy('${p.id}')" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">
            🏆 Dodaj do Gabloty Gracza
          </button>
        </div>
      </div>
    `);
  }

  function confirmAwardTrophy(playerId) {
    if (!requireStrictAdmin('przyznawanie trofeum')) return;
    const session = window.SMPL_DB.getSession();
    const icon = document.getElementById('award-trophy-icon').value || '🏆';
    const title = document.getElementById('award-trophy-title').value || 'Trofeum SMPL';
    const season = document.getElementById('award-trophy-season').value || 'Sezon ' + (window.SMPL_DB.getState().season || 56);

    try {
      const p = window.SMPL_DB.awardTrophyToPlayer(playerId, { icon, title, season }, session.adminName || 'Szymon Komenda');
      closeModal();
      showToast(`🏆 Przyznano trofeum „${title}” do gabloty gracza ${p.name}!`);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // PLEBISCYT ZŁOTA PIŁKA SMPL (GŁOSOWANIE + NAGRODA)
  // =========================================================================
  function handleGoldenBallVoteSubmit(event) {
    event.preventDefault();
    const voterEl = document.getElementById('gb-voter-name');
    const candEl = document.getElementById('gb-candidate-id');
    const cmtEl = document.getElementById('gb-vote-comment');
    const voterName = voterEl ? voterEl.value || '' : '';
    const candidateId = candEl ? candEl.value || '' : '';
    const comment = cmtEl ? cmtEl.value || '' : '';

    try {
      const vote = window.SMPL_DB.castGoldenBallVote({ voterName, candidateId, comment });
      gbFormState.voterName = vote.voterName || voterName;
      gbFormState.candidateId = candidateId;
      showToast('🗳️ Twój jedyny głos (1/1) w Złotej Piłce został oddany na ' + (vote.candidateName || 'kandydata') + '!');
      renderAll();
      if (vote && vote.remotePromise && typeof vote.remotePromise.then === 'function') {
        vote.remotePromise.then((srvRes) => {
          if (srvRes && srvRes.ok === false && !srvRes.localOnly) {
            showToast(srvRes.error || 'Odmowa zapisu głosu na serwerze.', 'error');
            renderAll();
          } else if (srvRes && srvRes.ok && !srvRes.localOnly) {
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast(err.message || 'Błąd oddawania głosu.', 'error');
    }
  }

  function buildDeterministicGoldenBallReport(gbData) {
    const top = (gbData && Array.isArray(gbData.candidates)) ? gbData.candidates.slice(0, 3) : [];
    if (!top.length) {
      return 'Brak aktywnych kandydatów w bieżącym sezonie — rozegraj pierwsze mecze ligowe, aby silnik SI wyliczył faworytów do Złotej Piłki.';
    }
    const lines = [];
    const leader = top[0];
    const bd = leader.aiBreakdown || {};
    lines.push(
      `🏆 WERDYKT MATEMATYCZNY SI: Obecnie najbardziej na Złotą Piłkę zasługuje ${leader.name} (${leader.leagueId} Poz. #${leader.leaguePos}) z łącznym wynikiem ${leader.finalScore} pkt (Ocena boiskowa SI: ${leader.meritScore}/100, ważne głosy 1/1: ${leader.votes}).`
    );
    lines.push(
      `📊 Składowe lidera: Dominacja ${bd.pointsPower || 0} • Atak ${bd.attackPower || 0} • Obrona/CK ${bd.defensePower || 0} • Forma ${bd.formConsistency || 0} • Fair Play ${bd.fairPlayScore || 0}. Powody: ${(leader.aiReasons || []).join(', ')}.`
    );
    if (gbData.aiTopMerit && gbData.aiTopMerit.playerId !== leader.playerId) {
      lines.push(
        `🧠 Czysto boiskowo #1 SI to ${gbData.aiTopMerit.name} (${gbData.aiTopMerit.meritScore}/100, ${gbData.aiTopMerit.PKT} PKT), ale głosy kibiców dają przewagę liderowi.`
      );
    }
    if (top.length > 1) {
      lines.push('🥈 Pościg TOP 3:');
      for (let i = 1; i < top.length; i++) {
        const c = top[i];
        lines.push(`#${i + 1} ${c.name} (${c.leagueId}) — Łącznie ${c.finalScore} pkt | SI ${c.meritScore}/100 | ${c.PKT} PKT (${c.M}M) | ${c.votes} gł.`);
      }
    }
    return lines.join('\n');
  }

  function handleGoldenBallAiAnalysis() {
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const gbData = window.SMPL_ENGINE.calculateGoldenBallStandings(state);
    const localReport = buildDeterministicGoldenBallReport(gbData);

    gbFormState.aiAnalysisText = localReport;
    gbFormState.aiAnalysisSource = 'Silnik Matematyczny SI SMPL';

    const top5Summary = gbData.candidates.slice(0, 5).map((c, idx) =>
      `#${idx + 1} ${c.name} (${c.leagueId} Poz.${c.leaguePos}): łącznie=${c.finalScore}, SI=${c.meritScore}/100 [PKT=${c.PKT}, M=${c.M}, PPG=${c.ppg}, BZ=${c.BZ}, BS=${c.BS}, CK=${c.cleanSheets}], głosy=${c.votes} (${c.votePct}%), werdykt=${c.aiVerdict}`
    ).join('\n');

    const isHttp = typeof window !== 'undefined' && window.location && /^https?:$/i.test(String(window.location.protocol || ''));
    if (!isHttp || !window.SMPL_DB || typeof window.SMPL_DB.askVanessaGemini !== 'function') {
      renderAll();
      showToast('🤖 Przeliczono raport zasług boiskowych do Złotej Piłki!');
      return;
    }

    gbFormState.aiAnalysisLoading = true;
    renderAll();

    const prompt = `Przeanalizuj szczegółowo aktualnych kandydatów do Złotej Piłki Score Match Liga na podstawie twardych wyliczeń matematycznych (wagi: ${gbData.meritWeightPct}% SI boiskowe + ${gbData.voteWeightPct}% głosy kibiców przy zasadzie 1 gracz = 1 głos) i wskaż w 4-5 zwięzłych zdaniach, kto najbardziej zasługuje na trofeum i dlaczego:\n${top5Summary}`;

    const clientContext = window.SMPL_AI && typeof window.SMPL_AI.buildLiveLeagueContext === 'function'
      ? window.SMPL_AI.buildLiveLeagueContext(state, session)
      : top5Summary;

    window.SMPL_DB.askVanessaGemini({
      question: prompt,
      history: [],
      clientContext: clientContext
    })
      .then((gRes) => {
        gbFormState.aiAnalysisLoading = false;
        if (gRes && gRes.ok && gRes.answer) {
          gbFormState.aiAnalysisText = gRes.answer + '\n\n---\n' + localReport;
          gbFormState.aiAnalysisSource = 'Vanessa AI ⚡ Gemini (' + (gRes.model || 'gemini') + ')';
        }
        renderAll();
      })
      .catch(() => {
        gbFormState.aiAnalysisLoading = false;
        renderAll();
      });
  }

  function handleAdminAwardGoldenBall() {
    if (!requireStrictAdmin('wręczenie Złotej Piłki')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const winner = window.SMPL_DB.adminAwardGoldenBallWinner(session.adminName || 'Szymon Komenda');
      showToast(`🏆 Oficjalnie wręczono Złotą Piłkę Score Match Liga do gabloty zawodnika: ${winner.playerName}!`);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // KONKURSY PIŁKARSKIE SMPL (ZŁOTY BUT, PUCHAR LIGI KO, TYPER, PUSKÁS, FORMA, FAIR PLAY)
  // =========================================================================
  function setCompetitionsSubTab(subTab) {
    competitionsState.subTab = subTab || 'golden_boot';
    activeTab = 'competitions';
    renderAll();
  }

  function setGoldenBootLeague(lgId) {
    competitionsState.goldenBootLeague = lgId || 'ALL';
    competitionsState.subTab = 'golden_boot';
    activeTab = 'competitions';
    renderAll();
  }

  function handleAdminAwardCompetition(compKey, overrideId) {
    if (!requireStrictAdmin('wręczenie trofeum konkursowego')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.adminAwardCompetitionTrophy(compKey, overrideId || null, session.adminName || 'Szymon Komenda');
      showToast(`🏆 Wręczono trofeum „${res.label}” dla: ${res.winnerName}!`);
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd wręczania nagrody.', 'error');
    }
  }

  function handleGenerateCupBracket(event) {
    if (event) event.preventDefault();
    if (!requireStrictAdmin('rozlosowanie Pucharu Ligi SMPL')) return;
    const session = window.SMPL_DB.getSession();
    const sizeEl = document.getElementById('cup-draw-size');
    const modeEl = document.getElementById('cup-draw-mode');
    const size = sizeEl ? Number(sizeEl.value || 8) : 8;
    const mode = modeEl ? String(modeEl.value || 'TOP_RANKED') : 'TOP_RANKED';
    try {
      const cup = window.SMPL_DB.generateLeagueCupBracket({ size, mode }, session.adminName || 'Szymon Komenda');
      showToast(`🎲 Rozlosowano Puchar Ligi SMPL (${cup.size} miejsc)!`);
      competitionsState.subTab = 'cup';
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się rozlosować Pucharu.', 'error');
    }
  }

  function handleClearCupBracket() {
    if (!requireStrictAdmin('reset drabinki Pucharu Ligi')) return;
    const session = window.SMPL_DB.getSession();
    try {
      window.SMPL_DB.clearCupBracket(session.adminName || 'Szymon Komenda');
      showToast('🧹 Zresetowano drabinkę Pucharu Ligi SMPL.');
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function toggleCupPenaltyVisibility() {
    const hsEl = document.getElementById('cup-score-home');
    const asEl = document.getElementById('cup-score-away');
    const boxEl = document.getElementById('cup-penalty-box');
    if (!hsEl || !asEl || !boxEl) return;
    const isTie = hsEl.value !== '' && asEl.value !== '' && Number(hsEl.value) === Number(asEl.value);
    boxEl.style.display = isTie ? 'block' : 'none';
  }

  function openCupMatchModal(cupMatchId) {
    if (!requireStrictAdmin('zapis wyniku Pucharu Ligi SMPL')) return;
    const state = window.SMPL_DB.getState();
    const cup = state.competitions && state.competitions.cup;
    if (!cup || !Array.isArray(cup.rounds)) return;
    let targetMatch = null;
    let roundName = 'Puchar Ligi';
    cup.rounds.forEach((rd) => {
      (rd.matches || []).forEach((cm) => {
        if (cm && cm.id === cupMatchId) {
          targetMatch = cm;
          roundName = rd.name || 'Puchar Ligi';
        }
      });
    });
    if (!targetMatch) return;
    const esc = window.SMPL_VIEWS.escapeHtml;
    const players = state.players || [];
    const hp = players.find((p) => p && p.id === targetMatch.homeId) || { id: targetMatch.homeId, name: 'Gospodarz' };
    const ap = players.find((p) => p && p.id === targetMatch.awayId) || { id: targetMatch.awayId, name: 'Gość' };
    const hsInit = targetMatch.homeScore !== null && targetMatch.homeScore !== undefined ? targetMatch.homeScore : '';
    const asInit = targetMatch.awayScore !== null && targetMatch.awayScore !== undefined ? targetMatch.awayScore : '';
    const showPen = hsInit !== '' && asInit !== '' && Number(hsInit) === Number(asInit);

    openModal(`
      <div class="glass-panel rounded-3xl p-6 max-w-md w-full border border-amber-400/50 space-y-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <div class="text-[11px] font-display uppercase text-amber-300 font-bold">${esc(roundName)}</div>
            <h3 class="font-display font-black text-lg text-white uppercase">🏆 Wynik Meczu Pucharowego</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold">✕</button>
        </div>
        <form onsubmit="SMPL_APP.handleSaveCupMatchResult(event, '${esc(targetMatch.id)}')" class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-white mb-1 truncate">${esc(hp.name)}</label>
              <input id="cup-score-home" type="number" min="0" max="2" required value="${Math.min(2, Number(hsInit || 0))}" oninput="SMPL_APP.toggleCupPenaltyVisibility()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-center font-display font-black text-lg text-white"/>
            </div>
            <div>
              <label class="block text-xs font-bold text-white mb-1 truncate">${esc(ap.name)}</label>
              <input id="cup-score-away" type="number" min="0" max="2" required value="${Math.min(2, Number(asInit || 0))}" oninput="SMPL_APP.toggleCupPenaltyVisibility()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-center font-display font-black text-lg text-white"/>
            </div>
          </div>
          <div id="cup-penalty-box" style="display:${showPen ? 'block' : 'none'};" class="p-3 rounded-xl bg-slate-950 border border-amber-400/40 space-y-1.5">
            <label class="block text-xs font-display font-bold uppercase text-amber-300">⚽ Zwycięzca po Rzutach Karnych (Remis)</label>
            <select id="cup-penalty-winner" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-bold">
              <option value="${esc(hp.id)}" ${targetMatch.penaltyWinnerId === hp.id ? 'selected' : ''}>${esc(hp.name)}</option>
              <option value="${esc(ap.id)}" ${targetMatch.penaltyWinnerId === ap.id ? 'selected' : ''}>${esc(ap.name)}</option>
            </select>
          </div>
          <button type="submit" class="w-full btn-league py-3 rounded-xl font-display font-black text-xs uppercase shadow-lg">💾 Zapisz Wynik & Awansuj Zwycięzcę</button>
        </form>
      </div>
    `);
  }

  function handleSaveCupMatchResult(event, cupMatchId) {
    if (event) event.preventDefault();
    if (!requireStrictAdmin('zapis wyniku Pucharu Ligi SMPL')) return;
    const session = window.SMPL_DB.getSession();
    const hsEl = document.getElementById('cup-score-home');
    const asEl = document.getElementById('cup-score-away');
    const penEl = document.getElementById('cup-penalty-winner');
    try {
      const hs = Number(hsEl ? hsEl.value : -1);
      const as = Number(asEl ? asEl.value : -1);
      const penWinnerId = hs === as && penEl ? penEl.value : null;
      window.SMPL_DB.recordCupMatchResult({ cupMatchId, homeScore: hs, awayScore: as, penaltyWinnerId: penWinnerId }, session.adminName || 'Szymon Komenda');
      closeModal();
      showToast('🏆 Wynik pucharowy zapisany! Zwycięzca awansował w drabince.');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd zapisu meczu pucharowego.', 'error');
    }
  }

  function handleTyperPredictionSubmit(event, matchId) {
    if (event) event.preventDefault();
    const phEl = document.getElementById('typer-home-' + matchId);
    const paEl = document.getElementById('typer-away-' + matchId);
    if (!phEl || !paEl) return;
    try {
      const res = window.SMPL_DB.submitTyperPrediction({
        matchId: matchId,
        predHome: Number(phEl.value),
        predAway: Number(paEl.value)
      });
      showToast(`🔮 Zapisano Twój typ ${phEl.value}:${paEl.value} w Typerze Kolejki!`);
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then((srvRes) => {
          if (srvRes && srvRes.ok === false && !srvRes.localOnly) {
            showToast(srvRes.error || 'Błąd zapisu typu na serwerze.', 'error');
            renderAll();
          } else if (srvRes && srvRes.ok && !srvRes.localOnly) {
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast(err.message || 'Błąd zapisu typu.', 'error');
    }
  }

  function handlePuskasNominateSubmit(event) {
    if (event) event.preventDefault();
    const plrEl = document.getElementById('puskas-player-id');
    const mEl = document.getElementById('puskas-match-id');
    const tEl = document.getElementById('puskas-title');
    const dEl = document.getElementById('puskas-desc');
    const cEl = document.getElementById('puskas-clip');
    try {
      const res = window.SMPL_DB.nominatePuskasGoal({
        playerId: plrEl ? plrEl.value : '',
        matchId: mEl ? mEl.value : '',
        title: tEl ? tEl.value : '',
        description: dEl ? dEl.value : '',
        clipUrl: cEl ? cEl.value : ''
      });
      showToast('🥅 Dodano nominację do Nagrody Puskása SMPL!');
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then((srvRes) => {
          if (srvRes && srvRes.ok === false && !srvRes.localOnly) {
            showToast(srvRes.error || 'Błąd zapisu nominacji na serwerze.', 'error');
            renderAll();
          } else if (srvRes && srvRes.ok && !srvRes.localOnly) {
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast(err.message || 'Błąd zgłaszania bramki.', 'error');
    }
  }

  function handlePuskasVote(nominationId) {
    try {
      const res = window.SMPL_DB.votePuskasGoal(nominationId);
      showToast(res.voted ? '⚽🔥 Oddano głos w Nagrodzie Puskása!' : '↩️ Cofnięto głos w Nagrodzie Puskása.');
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then((srvRes) => {
          if (srvRes && srvRes.ok === false && !srvRes.localOnly) {
            showToast(srvRes.error || 'Błąd zapisu głosu na serwerze.', 'error');
            renderAll();
          } else if (srvRes && srvRes.ok && !srvRes.localOnly) {
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast(err.message || 'Nie można oddać głosu.', 'error');
    }
  }

  function handleMasterCompetitionAction(action) {
    if (!requireMasterOwner('zarządzanie konkursami')) return;
    const session = window.SMPL_DB.getSession();
    try {
      window.SMPL_DB.masterManageCompetitions(action, session.adminName || 'Szymon Komenda');
      showToast('🎛️ Zaktualizowano ustawienia konkursów piłkarskich SMPL.');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd zarządzania konkursami.', 'error');
    }
  }

  // =========================================================================
  // ARCHIWUM SEZONÓW (S1–S55) & RANKING WSZECH CZASÓW (ALL-TIME)
  // =========================================================================
  function setArchiveMode(mode) {
    archiveState.mode = mode;
    renderAll();
  }

  function setArchiveSeason(sNum) {
    archiveState.seasonNumber = Number(sNum);
    renderAll();
  }

  function setArchiveLeague(lid) {
    archiveState.leagueId = lid;
    renderAll();
  }

  function setArchiveSeasonGroup(groupId) {
    archiveState.seasonGroup = groupId;
    renderAll();
  }

  function openArchivePlayerCareer(playerName) {
    archiveState.mode = 'PLAYER_HISTORY';
    archiveState.playerName = playerName || '';
    activeTab = 'archive';
    renderAll();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  }

  function setArchiveSearch(q) {
    archiveState.search = q;
    renderAll();
  }

  function handleArchiveCurrentSeason() {
    if (!requireStrictAdmin('archiwizacja sezonu')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const archived = window.SMPL_DB.archiveCurrentSeason(session.adminName || 'Szymon Komenda');
      archiveState.mode = 'SEASONS';
      archiveState.seasonNumber = archived.seasonNumber;
      activeTab = 'archive';
      showToast(
        `📦 Sezon ${archived.seasonNumber} został oficjalnie zarchiwizowany w Historii, a medale (👑🥈🥉) trafiły do gablot graczy!`
      );
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // SYSTEM „4 KOLEJKI NA TYDZIEŃ” + GENERATOR RAPORTU NA MESSENGER / FB
  // =========================================================================
  function handleSetActiveWeek(weekNum) {
    if (!requireStrictAdmin('zmiana aktywnego tygodnia')) return;
    const session = window.SMPL_DB.getSession();
    window.SMPL_DB.setCurrentWeek(weekNum, session.adminName || 'Szymon Komenda');
    scheduleFilter.round = `WEEK_${weekNum}`;
    showToast(`📅 Ustawiono Tydzień ${weekNum} (4 kolejki na tydzień) jako aktualnie rozgrywany tydzień w lidze!`);
    renderAll();
  }

  function openMessengerReportModal() {
    const state = window.SMPL_DB.getState();
    const activeWeek = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 2;
    const reportText = window.SMPL_ENGINE.generateWeeklyMessengerReport(state, activeLeague, activeWeek);

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-emerald-400">AUTOMATYCZNY GENERATOR POSTÓW SMPL</span>
            <h3 class="font-display font-black text-lg text-white uppercase">📱 Raport Tygodnia ${activeWeek} na Grupę FB / Messenger</h3>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <p class="text-xs text-slate-300 mb-3">
          Gotowe podsumowanie 4 kolejek tygodnia, podium tabeli, lidera Czystych Kont i zaległych spotkań — skopiuj jednym kliknięciem i wklej na grupę Messenger:
        </p>
        <textarea id="messenger-weekly-report-text" rows="12" readonly class="w-full p-3.5 rounded-2xl bg-slate-950 border border-white/15 text-xs text-slate-200 font-mono mb-4">${reportText}</textarea>
        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Zamknij</button>
          <button onclick="SMPL_APP.copyMessengerReportText()" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display uppercase">
            📋 Kopiuj Raport na Messenger / FB
          </button>
        </div>
      </div>
    `);
  }

  function copyMessengerReportText() {
    copyTextHelper('messenger-weekly-report-text', '📋 Skopiowano raport tygodniowy! Możesz go od razu wkleić na grupę FB / Messenger.');
  }

  function copyAdminChangelog() {
    const text = window.SMPL_ARCHIVE_DATA ? window.SMPL_ARCHIVE_DATA.ADMIN_CHANGELOG_SIMPLE : '';
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
    showToast('📋 Skopiowano cały „Changelog jak dla debila”! Możesz go teraz wkleić na Messenger Administracji.');
  }

  // =========================================================================
  // RODO / PRAWO DO BYCIA ZAPOMNIANYM (ART. 17 RODO)
  // =========================================================================
  function openGdprDeleteModal() {
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-rose-400">ART. 17 RODO (GDPR) • PRAWO DO BYCIA ZAPOMNIANYM</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🗑️ Anonimizacja / Usunięcie Danych Osobowych</h3>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <p class="text-xs text-slate-300 mb-4 leading-relaxed">
          Zgodnie z Art. 17 RODO każdy gracz może zażądać usunięcia swojego imienia, nazwiska, zdjęcia profilowego i linku FB bez psucia historycznych tabel ligowych (profil zostaje zanonimizowany jako <em>„Gracz Zanonimizowany (RODO)”</em>).
        </p>
        <div class="space-y-3 mb-5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Wybierz profil gracza</label>
            <select id="gdpr-player-id" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold">
              ${state.players
                .map(
                  (p) =>
                    `<option value="${p.id}" ${session.activePlayerId === p.id ? 'selected' : ''}>[${p.leagueId}] ${window.SMPL_VIEWS.escapeHtml(p.name)} (@${window.SMPL_VIEWS.escapeHtml(p.nick)})</option>`
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Potwierdź hasłem konta *</label>
            <input id="gdpr-player-pass" type="password" placeholder="Wpisz hasło konta..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.confirmGdprDelete()" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs uppercase">
            🗑️ Wykonaj Anonimizację RODO
          </button>
        </div>
      </div>
    `);
  }

  function confirmGdprDelete() {
    const pid = document.getElementById('gdpr-player-id').value;
    const pass = document.getElementById('gdpr-player-pass').value || '';
    try {
      window.SMPL_DB.deletePlayerAccountGDPR(pid, pass);
      closeModal();
      showToast('✅ Dane osobowe gracza zostały zanonimizowane zgodnie z Art. 17 RODO.');
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function setLegalSubTab(mode) {
    legalSubTab = mode === 'PLAYERS' || mode === 'LEGAL' ? mode : 'ALL';
    if (activeTab === 'legal') {
      renderAll();
    }
  }

  function openLegalSummaryModal() {
    if (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.renderLegalSummaryModalHtml === 'function') {
      openModal(window.SMPL_VIEWS.renderLegalSummaryModalHtml());
    }
  }

  function openLegalReportOrAppeal() {
    openModal(`
      <div class="p-6 space-y-4">
        <div class="border-b border-white/10 pb-3">
          <span class="text-[10px] font-display font-bold uppercase text-blue-300">⚖️ ODWOŁANIA &amp; DSA NOTICE &amp; TAKEDOWN</span>
          <h3 class="font-display font-black text-lg text-white uppercase mt-1">
            Jak zgłosić odwołanie lub naruszenie prawa?
          </h3>
        </div>
        <div class="space-y-2.5 text-xs text-slate-300 leading-relaxed">
          <p>
            1. <strong>Odwołanie od kary lub walkowera (7 dni):</strong> Przy sporze meczowym kliknij <strong>„🚩 Spór VAR / W.O.”</strong> przy spotkaniu w Terminarzu (obowiązkowo załączając <strong>SS dlaczego</strong>) albo napisz bezpośrednio na <strong>Messengerze do Głównego Administratora (Szymona Komendy)</strong>.
          </p>
          <p>
            2. <strong>Goście i osoby spoza ligi (DSA / RODO):</strong> Jeśli zauważyłeś naruszenie dóbr osobistych, danych osobowych lub praw autorskich, możesz natychmiast usunąć swój profil przyciskiem <em>Żądanie RODO</em> albo skontaktować się bezpośrednio z Zarządem SMPL na oficjalnej grupie Facebook / Messenger ligi.
          </p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-white/10">
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200">
            Zamknij
          </button>
          <button type="button" onclick="SMPL_APP.closeModal(); SMPL_APP.openGdprDeleteModal();" class="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-bold text-xs">
            🗑️ Żądanie RODO
          </button>
          <button type="button" onclick="SMPL_APP.closeModal(); SMPL_APP.openMessengerForPlayer('ADM_MASTER');" class="btn-league px-4 py-2 rounded-xl font-display font-bold text-xs uppercase">
            💬 Kontakt Messenger / Zaproszenie
          </button>
        </div>
      </div>
    `);
  }

  // =========================================================================
  // OBSŁUGA FORMULARZA DODAWANIA WYNIKU MECZU (PANEL GRACZA)
  // =========================================================================
  function prefillMatchSubmission(matchId) {
    const state = window.SMPL_DB.getState();
    const m = state.matches.find((item) => item.id === matchId);
    if (!m) return;
    submitFormState.leagueId = m.leagueId;
    submitFormState.round = 'ALL';
    submitFormState.matchId = m.id;
    submitFormState.homeScore = 2;
    submitFormState.awayScore = 1;
    submitFormState.screenshotPreview = null;
    submitFormState.returnHomeScore = 1;
    submitFormState.returnAwayScore = 2;
    submitFormState.returnScreenshotPreview = null;
    activeTab = 'submit';
    renderAll();
    window.scrollTo({ top: 180, behavior: 'smooth' });
  }

  function updateSubmitFormLeague(lid) {
    submitFormState.leagueId = lid;
    submitFormState.round = 'ALL';
    submitFormState.matchId = null;
    submitFormState.screenshotPreview = null;
    submitFormState.returnScreenshotPreview = null;
    renderAll();
  }

  function updateSubmitFormRound(r) {
    submitFormState.round = r === 'ALL' ? 'ALL' : Number(r);
    submitFormState.matchId = null;
    submitFormState.screenshotPreview = null;
    submitFormState.returnScreenshotPreview = null;
    renderAll();
  }

  function updateSubmitFormMatch(mid) {
    submitFormState.matchId = mid;
    submitFormState.screenshotPreview = null;
    submitFormState.returnScreenshotPreview = null;
    renderAll();
  }

  function clampLeagueGoalVal(val) {
    const num = parseInt(val, 10);
    if (isNaN(num)) return 0;
    return Math.min(2, Math.max(0, num));
  }

  function stepSubmitScore(side, delta, leg = 'leg1') {
    const isLeg2 = leg === 'leg2';
    const hKey = isLeg2 ? 'returnHomeScore' : 'homeScore';
    const aKey = isLeg2 ? 'returnAwayScore' : 'awayScore';
    if (side === 'home') {
      const nextH = clampLeagueGoalVal(Number(submitFormState[hKey] || 0) + delta);
      submitFormState[hKey] = nextH;
      if (nextH === 2 && Number(submitFormState[aKey]) === 2) {
        submitFormState[aKey] = 1;
      }
    } else {
      const nextA = clampLeagueGoalVal(Number(submitFormState[aKey] || 0) + delta);
      submitFormState[aKey] = nextA;
      if (nextA === 2 && Number(submitFormState[hKey]) === 2) {
        submitFormState[hKey] = 1;
      }
    }
    renderAll();
  }

  function setSubmitScore(side, val, leg = 'leg1') {
    const num = clampLeagueGoalVal(val);
    if (leg === 'leg2') {
      if (side === 'home') submitFormState.returnHomeScore = num;
      else submitFormState.returnAwayScore = num;
    } else {
      if (side === 'home') submitFormState.homeScore = num;
      else submitFormState.awayScore = num;
    }
  }

  function setSubmitQuickScore(leg, hs, as) {
    const safeH = clampLeagueGoalVal(hs);
    const safeA = clampLeagueGoalVal(as);
    if (safeH === 2 && safeA === 2) return;
    if (leg === 'leg2') {
      submitFormState.returnHomeScore = safeH;
      submitFormState.returnAwayScore = safeA;
    } else {
      submitFormState.homeScore = safeH;
      submitFormState.awayScore = safeA;
    }
    renderAll();
  }

  function setSubmitComment(val) {
    submitFormState.comment = val;
  }

  function handleMatchScreenUpload(event, leg = 'leg1') {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    fileToDataUrl(file, 900).then((dataUrl) => {
      if (leg === 'leg2') {
        submitFormState.returnScreenshotPreview = dataUrl;
        showToast('📸 Wgrano zrzut ekranu (SS #2) z meczu rewanżowego!');
      } else {
        submitFormState.screenshotPreview = dataUrl;
        showToast('📸 Wgrano zrzut ekranu (SS #1) z 1. meczu!');
      }
      renderAll();
    });
  }

  function generateDemoMatchScreenForForm(leg = 'leg1') {
    const state = window.SMPL_DB.getState();
    const selectEl = document.getElementById('submit-match-select');
    const primaryId = selectEl && selectEl.value ? selectEl.value : submitFormState.matchId;
    const pair = window.SMPL_DB.resolveMatchSubmissionPair(state.matches, primaryId);
    const targetM = leg === 'leg2' ? pair.leg2 : pair.leg1;
    if (!targetM) {
      showToast('Wybierz najpierw mecz z listy.', 'warning');
      return;
    }
    const hp = state.players.find((p) => p.id === targetM.homeId);
    const ap = state.players.find((p) => p.id === targetM.awayId);
    const hsVal = leg === 'leg2' ? submitFormState.returnHomeScore : submitFormState.homeScore;
    const asVal = leg === 'leg2' ? submitFormState.returnAwayScore : submitFormState.awayScore;
    const imgUrl = window.SMPL_MEDIA.generateMatchScreenshot({
      homeName: hp ? hp.name : 'Gospodarz',
      awayName: ap ? ap.name : 'Gość',
      homeNick: hp ? hp.nick : 'Home',
      awayNick: ap ? ap.nick : 'Away',
      homeScore: hsVal,
      awayScore: asVal,
      round: targetM.round,
      leagueName: (state.leagues && state.leagues[targetM.leagueId] && state.leagues[targetM.leagueId].shortName) || targetM.leagueId || 'SMPL'
    });
    if (leg === 'leg2') {
      submitFormState.returnScreenshotPreview = imgUrl;
      showToast('⚡ Wygenerowano screen testowy #2 (Rewanż) z gry Score! Match.');
    } else {
      submitFormState.screenshotPreview = imgUrl;
      showToast('⚡ Wygenerowano screen testowy #1 z gry Score! Match.');
    }
    renderAll();
  }

  function handleMatchSubmit(event) {
    event.preventDefault();
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const isAdmin = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session));

    if (!isAdmin) {
      if (session.isGuest || !session.isPlayerAuthenticated || !session.activePlayerId) {
        showToast('⛔ Brak uprawnień! Aby zgłosić wynik, musisz być zalogowany na swoje konto gracza.', 'error');
        return;
      }
    }

    const selectEl = document.getElementById('submit-match-select');
    const matchId = (selectEl && selectEl.value) ? selectEl.value : submitFormState.matchId;
    if (!matchId) {
      showToast('Wybierz mecz z listy zaplanowanych spotkań!', 'error');
      return;
    }

    const pair = window.SMPL_DB.resolveMatchSubmissionPair(state.matches, matchId);
    const match = pair.leg1;
    const returnMatch = pair.leg2;
    if (!match) {
      showToast('Nie znaleziono wskazanego meczu.', 'error');
      return;
    }

    if (!isAdmin) {
      if (match.homeId !== session.activePlayerId && match.awayId !== session.activePlayerId) {
        showToast('[\u26D4] ODMOWA DOST\u0118PU: Mo\u017cesz zg\u0142asza\u0107 wyniki WY\u0141\u0104CZNIE dla swoich w\u0142asnych mecz\u00f3w!', 'error');
        return;
      }
      if (match.status === 'PENDING') {
        showToast('[\u23F3] Wynik tego meczu zosta\u0142 ju\u017c zg\u0142oszony i oczekuje na weryfikacj\u0119 Administratora.', 'info');
        return;
      }
      if (match.status === 'APPROVED' || match.status === 'WALKOVER') {
        showToast('[\u26D4] Ten mecz zosta\u0142 ju\u017c rozegrany i zatwierdzony. Tylko Administrator mo\u017ce modyfikowa\u0107 wyniki.', 'error');
        return;
      }
    }

    const hs1 = Number(submitFormState.homeScore);
    const as1 = Number(submitFormState.awayScore);
    if (!window.SMPL_DB.isValidLeagueGoalPair(hs1, as1, false)) {
      showToast('⚽ W lidze Score! Match mecz trwa do max 2 bramek (0–2, bez 2:2; np. 2:0, 2:1, 1:1).', 'error');
      return;
    }

    if (pair.requiresDouble && returnMatch) {
      const hs2 = Number(submitFormState.returnHomeScore);
      const as2 = Number(submitFormState.returnAwayScore);
      if (!window.SMPL_DB.isValidLeagueGoalPair(hs2, as2, false)) {
        showToast('⚽ W rewanżu (2. mecz dwumeczu) również obowiązuje limit max 2 bramek (0–2, bez 2:2)!', 'error');
        return;
      }
      if (!isAdmin) {
        if (!submitFormState.screenshotPreview) {
          showToast('📸 Wgraj zrzut ekranu (SS #1) z pierwszego meczu przed wysłaniem dwumeczu!', 'error');
          return;
        }
        if (!submitFormState.returnScreenshotPreview) {
          showToast('📸 Wgraj zrzut ekranu (SS #2) z meczu rewanżowego przed wysłaniem dwumeczu!', 'error');
          return;
        }
      }
    } else if (!isAdmin && !submitFormState.screenshotPreview) {
      showToast('📸 Dołącz zrzut ekranu (SS) z końca meczu! Admini zatwierdzają wynik po otrzymaniu SS.', 'error');
      return;
    }

    const activePlayer = state.players.find((p) => p.id === session.activePlayerId);
    const submittedBy =
      isAdmin
        ? `${session.adminName} (Administrator)`
        : activePlayer
        ? `${activePlayer.name} (@${activePlayer.nick})`
        : 'Gracz SMPL';

    try {
      if (pair.requiresDouble && returnMatch) {
        window.SMPL_DB.submitDoubleMatchResult({
          primaryMatchId: match.id,
          primaryHomeScore: hs1,
          primaryAwayScore: as1,
          primaryScreenshot: submitFormState.screenshotPreview,
          returnMatchId: returnMatch.id,
          returnHomeScore: submitFormState.returnHomeScore,
          returnAwayScore: submitFormState.returnAwayScore,
          returnScreenshot: submitFormState.returnScreenshotPreview,
          submittedBy,
          comment: submitFormState.comment,
          requireScreenshots: !isAdmin
        });
      } else {
        window.SMPL_DB.submitMatchResult({
          matchId: match.id,
          homeScore: hs1,
          awayScore: as1,
          screenshot: submitFormState.screenshotPreview,
          submittedBy,
          comment: submitFormState.comment,
          requireScreenshot: !isAdmin
        });
      }
    } catch (err) {
      showToast(err.message || 'Błąd podczas zgłaszania wyniku meczu.', 'error');
      return;
    }

    submitFormState.screenshotPreview = null;
    submitFormState.returnScreenshotPreview = null;
    submitFormState.comment = '';
    submitFormState.matchId = null;

    showToast(
      pair.requiresDouble && returnMatch
        ? '⏳ Oba wyniki dwumeczu (Dom + Wyjazd) i 2× SS wysłane! Admin zatwierdzi je po weryfikacji screenów.'
        : '⏳ Wynik ze screenem (SS) wysłany! Mecz oczekuje na weryfikację Administratora.'
    );
    if (window.SMPL_STUDIO && window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playShopSound === 'function') {
      const stSound = window.SMPL_DB.getState();
      const soundPl = resolveNotificationTargetPlayer(stSound, session);
      const soundPid = (soundPl && soundPl.id) || (session && session.activePlayerId) || null;
      if (soundPid) {
        const mCos = window.SMPL_STUDIO.getPlayerCosmetics(stSound, soundPid);
        if (mCos && mCos.joinSound && mCos.joinSound !== 'default') {
          window.SMPL_NOTIF.playShopSound(mCos.joinSound, false);
        }
      }
    }
    renderAll();
  }

  // =========================================================================
  // OBSŁUGA FORMULARZA REJESTRACJI KONTA -> LISTA DO DOPISANIA DO LIGI
  // =========================================================================
  function updateRegField(field, val) {
    regFormState[field] = val;
  }

  function handleRegAvatarUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    fileToDataUrl(file, 400).then((dataUrl) => {
      regFormState.avatarPreview = dataUrl;
      showToast('👤 Zdjęcie profilowe (awatar) zostało wgrane.');
      renderAll();
    });
  }

  function toggleRegPlayedBefore(checked) {
    regFormState.playedBefore = Boolean(checked);
    const wrap = document.getElementById('reg-hist-picker-wrap');
    if (wrap) {
      if (regFormState.playedBefore) wrap.classList.remove('hidden');
      else wrap.classList.add('hidden');
    }
    if (!regFormState.playedBefore) {
      regFormState.linkedHistoricalName = '';
      regFormState.histSearch = '';
      const sel = document.getElementById('reg-hist-select');
      if (sel) sel.value = '';
    }
  }

  function onRegHistSelect(val) {
    regFormState.linkedHistoricalName = val ? String(val).trim() : '';
  }

  function fillDemoRegistration() {
    const randomNum = Math.floor(Math.random() * 89) + 10;
    const demoName = 'Kamil Dąbrowski';
    const demoNick = `Dabrowski_SM${randomNum}`;
    regFormState.name = demoName;
    regFormState.nick = demoNick;
    regFormState.fbLink = 'https://m.me/kamil.dabrowski.smpl';
    regFormState.preference = 'Nowy gracz — 2. Liga (L2)';
    regFormState.password = '';
    regFormState.notes = 'Gotowy na pełny sezon (15 kolejek dwumeczów, 4 kolejki/tydzień).';
    regFormState.clanId = '';
    regFormState.newClanName = '';
    regFormState.newClanTag = '';
    regFormState.newClanColor = '#10b981';
    regFormState.newClanLogoPreview = null;
    regFormState.avatarPreview = window.SMPL_MEDIA.generatePlayerAvatar(demoName, demoNick, randomNum);
    showToast('⚡ Formularz wypełniony przykładowymi danymi!');
    renderAll();
  }

  function handleRegistrationSubmit(event) {
    event.preventDefault();
    const regName = regFormState.name ? regFormState.name.trim() : '';
    const regNick = regFormState.nick ? regFormState.nick.trim() : '';
    const regFb = regFormState.fbLink ? regFormState.fbLink.trim() : '';
    const regPass = regFormState.password ? regFormState.password.trim() : '';

    const playedEl = document.getElementById('reg-played-before');
    const histSelEl = document.getElementById('reg-hist-select');
    const regRulesEl = document.getElementById('reg-rules');
    const regGdprEl = document.getElementById('reg-legal-gdpr');
    const playedBefore = playedEl ? Boolean(playedEl.checked) : Boolean(regFormState.playedBefore);
    const linkedHistoricalName = playedBefore
      ? (histSelEl ? String(histSelEl.value || '').trim() : String(regFormState.linkedHistoricalName || '').trim())
      : '';
    const regClanId = String(regFormState.clanId || '').trim();
    const regNewClanName = String(regFormState.newClanName || '').trim();
    const regNewClanTag = String(regFormState.newClanTag || '').trim();
    const regNewClanColor = String(regFormState.newClanColor || '#10b981').trim();

    if (!regName || !regNick || !regFb) {
      showToast('Wypełnij wszystkie pola obowiązkowe!', 'error');
      return;
    }
    if (!regPass || regPass.length < 4) {
      showToast('🔐 Podaj własne hasło do konta (minimum 4 znaki).', 'error');
      return;
    }
    if (regClanId === '__NEW__' && regNewClanName.length < 2) {
      showToast('🛡️ Podaj nazwę nowego klanu (minimum 2 znaki) lub wybierz istniejący z listy.', 'error');
      return;
    }
    if (playedBefore && !linkedHistoricalName) {
      showToast('Zaznaczyłeś udział w sezonach 1–55 — wybierz swoje Imię i Nazwisko z listy lub odznacz opcję.', 'error');
      return;
    }
    if (regRulesEl && !regRulesEl.checked) {
      showToast('Musisz zaakceptować Regulamin Rozgrywek SMPL (SMPL-REG-2026.1).', 'error');
      return;
    }
    if (regGdprEl && !regGdprEl.checked) {
      showToast('Musisz zaakceptować Klauzulę Prawną, RODO oraz potwierdzić wymóg wieku 16+ (lub zgodę opiekuna).', 'error');
      return;
    }

    const activeRegLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(window.SMPL_DB.getState(), false)
      : [];
    const matchedRegLg = activeRegLeagues.find(
      (lg) =>
        regFormState.preference.includes('(' + lg.id + ')') ||
        (lg.shortName && regFormState.preference.includes(lg.shortName))
    );
    const prefLeague = matchedRegLg
      ? matchedRegLg.id
      : regFormState.preference.includes('Ekstraklasa')
      ? 'L1'
      : 'L2';

    const isHttpEnv = Boolean(window.location && window.location.protocol && window.location.protocol.indexOf('http') === 0 && typeof fetch === 'function');
    const isAdminCreator = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(window.SMPL_DB.getSession()));
    let createdReg = null;

    function resetPublicRegForm() {
      regFormState.name = '';
      regFormState.nick = '';
      regFormState.fbLink = '';
      regFormState.password = '';
      regFormState.notes = '';
      regFormState.avatarPreview = null;
      regFormState.playedBefore = false;
      regFormState.linkedHistoricalName = '';
      regFormState.histSearch = '';
      regFormState.clanId = '';
      regFormState.newClanName = '';
      regFormState.newClanTag = '';
      regFormState.newClanColor = '#10b981';
      regFormState.newClanLogoPreview = null;
    }

    function showRegFailure(msg, prefix) {
      const m = String(msg || 'Odmowa rejestracji.');
      if (m.indexOf('Czarn') !== -1 || m.indexOf('ban') !== -1 || m.indexOf('BAN') !== -1 || m.indexOf('ODRAZU') !== -1) {
        if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playGavelSound === 'function') {
          window.SMPL_NOTIF.playGavelSound();
        }
        openBlacklistBlockedModal(m);
      } else {
        showToast((prefix || '') + m, 'error');
      }
    }

    try {
      createdReg = window.SMPL_DB.submitRegistration({
        name: regName,
        nick: regNick,
        fbLink: regFb,
        preference: regFormState.preference,
        preferredLeague: prefLeague,
        password: regPass,
        avatar: regFormState.avatarPreview,
        clanId: regClanId,
        newClanName: regNewClanName,
        newClanTag: regNewClanTag,
        newClanColor: regNewClanColor,
        newClanLogo: regFormState.newClanLogoPreview || '',
        notes: regFormState.notes,
        playedBefore: playedBefore,
        linkedHistoricalName: linkedHistoricalName,
        acceptedRules: true,
        acceptedLegalGDPR: true,
        onServerResult: isHttpEnv
          ? (srvErr, srvData) => {
              if (srvErr) {
                showRegFailure(srvErr, '❌ Serwer nie zapisał rejestracji: ');
                renderAll();
                return;
              }
              resetPublicRegForm();
              const finalReg = (srvData && srvData.registration) ? srvData.registration : createdReg;
              const finalLogin = finalReg && finalReg.username ? finalReg.username : regNick;
              if (srvData && srvData.offline) {
                showToast('⚠️ Zapisano tylko lokalnie w przeglądarce — serwer nie odpowiedział! Odśwież stronę przy działającym internecie.', 'error');
              } else {
                showToast(
                  isAdminCreator
                    ? `✅ Zapisano na serwerze: rejestracja ${finalReg.name} (${finalLogin})! Wybierz teraz ligę lub pulę graczy.`
                    : `✅ Zgłoszenie wysłane do Panelu Admina! Twój login: ${finalLogin}. Po dopisaniu przez Admina zalogujesz się swoim loginem/nickiem i hasłem.`
                );
              }
              renderAll();
              if (isAdminCreator && finalReg && finalReg.id) {
                openPostRegistrationAdminChoiceModal(finalReg.id);
              } else if (!isAdminCreator) {
                triggerFirstTimeOnboardingTutorial(finalReg);
              }
            }
          : null
      });
    } catch (err) {
      showRegFailure(err && err.message ? err.message : 'Odmowa rejestracji.', '');
      return;
    }

    if (isHttpEnv) {
      showToast('⏳ Wysyłanie zgłoszenia na serwer SMPL...');
      return;
    }

    resetPublicRegForm();
    const assignedLogin = createdReg && createdReg.username ? createdReg.username : regNick;
    showToast(
      isAdminCreator
        ? `✅ Utworzono rejestrację ${createdReg.name} (${assignedLogin})! Wybierz teraz ligę lub pulę graczy.`
        : `✅ Konto utworzone! Twój login: ${assignedLogin}. Po dopisaniu przez Admina lub otwarciu puli zalogujesz się swoim loginem/nickiem i hasłem.`
    );
    renderAll();
    if (isAdminCreator && createdReg && createdReg.id) {
      openPostRegistrationAdminChoiceModal(createdReg.id);
    } else if (!isAdminCreator) {
      triggerFirstTimeOnboardingTutorial(createdReg);
    }
  }

  // =========================================================================
  // AKCJE ADMINISTRATORA (ZATWIERDZANIE MECZÓW, REKRUTACJA, KARY)
  // =========================================================================
  function adminApproveMatch(matchId) {
    if (!requireStrictAdmin('zatwierdzanie wyniku')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const m = window.SMPL_DB.approveMatch(matchId, session.adminName || 'Szymon Komenda');
      showToast(`✅ Zatwierdzono wynik ${m.homeScore}:${m.awayScore}! Tabela główna, Karta UT, H2H, forma i Czyste Konta zostały przeliczone.`);
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie można zatwierdzić meczu.', 'error');
    }
  }

  function adminApproveDoubleMatch(primaryMatchId, returnMatchId) {
    if (!requireStrictAdmin('zatwierdzanie dwumeczu')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.approveDoubleMatch(primaryMatchId, returnMatchId, session.adminName || 'Szymon Komenda');
      showToast(`✅ Zatwierdzono cały DWUMECZ (${res.primaryMatch.homeScore}:${res.primaryMatch.awayScore} i ${res.returnMatch.homeScore}:${res.returnMatch.awayScore}) po weryfikacji obu SS! Tabela zaktualizowana.`);
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie można zatwierdzić dwumeczu.', 'error');
    }
  }

  function approveAllPendingMatches() {
    if (!requireStrictAdmin('masowe zatwierdzanie meczów')) return;
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const pendingWithSS = state.matches.filter((m) => m.status === 'PENDING' && m.screenshot);
    let count = 0;
    for (const m of pendingWithSS) {
      window.SMPL_DB.approveMatch(m.id, session.adminName || 'Szymon Komenda');
      count++;
    }
    const skipped = state.matches.filter((m) => m.status === 'PENDING' && !m.screenshot).length;
    showToast(
      skipped > 0
        ? `✅ Zatwierdzono ${count} meczów z SS. Pominięto ${skipped} bez zrzutu ekranu!`
        : `✅ Zatwierdzono wszystkie (${count}) oczekujące mecze z SS! Wszystkie tabele i Karty UT zaktualizowane.`
    );
    renderAll();
  }

  function adminRejectMatchPrompt(matchId) {
    if (!requireStrictAdmin('odrzucanie zgłoszenia wyniku')) return;
    const state = window.SMPL_DB.getState();
    const m = state.matches.find((item) => item.id === matchId);
    if (!m) return;
    const hp = state.players.find((p) => p.id === m.homeId);
    const ap = state.players.find((p) => p.id === m.awayId);

    openModal(`
      <div class="p-6">
        <h3 class="font-display font-black text-lg text-white uppercase mb-2">❌ Odrzuć zgłoszenie wyniku meczu</h3>
        <p class="text-xs text-slate-300 mb-4">
          Mecz Kolejki ${m.round}: <strong>${window.SMPL_VIEWS.escapeHtml(hp ? hp.name : '')} vs ${window.SMPL_VIEWS.escapeHtml(ap ? ap.name : '')}</strong> (zgłoszony wynik: ${m.homeScore}:${m.awayScore}).
        </p>
        <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Powód odrzucenia (widoczny dla graczy) *</label>
        <input
          type="text"
          id="reject-match-reason-input"
          value="Niewyraźny zrzut ekranu z wynikiem końcowym — prośba o ponowne wgranie."
          class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white mb-5"
        />
        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.confirmRejectMatch('${m.id}')" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs uppercase">
            ❌ Potwierdź odrzucenie
          </button>
        </div>
      </div>
    `);
  }

  function confirmRejectMatch(matchId) {
    if (!requireStrictAdmin('odrzucanie wyniku')) return;
    const session = window.SMPL_DB.getSession();
    const input = document.getElementById('reject-match-reason-input');
    const reason = input ? input.value.trim() : 'Brak wymaganego screena końcowego.';
    window.SMPL_DB.rejectMatch(matchId, reason, session.adminName || 'Szymon Komenda');
    closeModal();
    showToast('❌ Zgłoszenie wyniku zostało odrzucone. Mecz wrócił do statusu Nierozegrany.', 'warning');
    renderAll();
  }

  function _handleEvidenceImageUpload(event, previewId, onLoaded) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    fileToDataUrl(file, 850)
      .then((dataUrl) => {
        if (!dataUrl || !/^data:image\//i.test(String(dataUrl))) {
          showToast('Wybierz poprawny plik graficzny (JPG/PNG/WEBP).', 'error');
          return;
        }
        if (typeof onLoaded === 'function') onLoaded(dataUrl);
        const prevEl = document.getElementById(previewId);
        if (prevEl) {
          prevEl.innerHTML = `<img src="${dataUrl}" class="max-h-36 w-auto rounded-xl border border-emerald-400/50 object-contain mx-auto" alt="Podgląd dowodu SS"/>
            <div class="text-[11px] font-bold text-emerald-300 mt-1 text-center">✅ Zrzut ekranu (SS dlaczego) załączony!</div>`;
        }
      })
      .catch(() => {
        showToast('Nie udało się wczytać zrzutu ekranu.', 'error');
      });
  }

  function handleAdminWalkoverScreenUpload(event) {
    _handleEvidenceImageUpload(event, 'admin-wo-screen-preview', (dataUrl) => {
      adminEditDraftScreenshot = dataUrl;
    });
  }

  function openAdminEditMatchModal(matchId) {
    if (!requireStrictAdmin('edycja wyniku / walkower')) return;
    const state = window.SMPL_DB.getState();
    const m = state.matches.find((item) => item.id === matchId);
    if (!m) return;
    const hp = state.players.find((p) => p.id === m.homeId);
    const ap = state.players.find((p) => p.id === m.awayId);
    adminEditDraftScreenshot = m.screenshot && /^data:image\//i.test(String(m.screenshot)) ? String(m.screenshot) : '';

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <h3 class="font-display font-black text-lg text-white uppercase">✏️ Edycja Wyniku / Walkower (Kolejka ${m.round})</h3>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div class="grid grid-cols-7 items-center gap-3 my-4 p-4 rounded-2xl bg-slate-950 border border-white/10">
          <div class="col-span-3 text-center">
            <img src="${hp ? hp.avatar : ''}" class="w-12 h-12 rounded-full mx-auto mb-1 border border-white/20" alt=""/>
            <div class="font-bold text-xs text-white">${window.SMPL_VIEWS.escapeHtml(hp ? hp.name : '')}</div>
            <input id="admin-edit-hs" type="number" min="0" max="2" value="${m.homeScore || 0}" class="mt-2 w-16 h-11 text-center rounded-xl bg-slate-900 border border-blue-500 font-display font-black text-xl text-white"/>
          </div>
          <div class="col-span-1 text-center font-display font-black text-xl text-slate-400">:</div>
          <div class="col-span-3 text-center">
            <img src="${ap ? ap.avatar : ''}" class="w-12 h-12 rounded-full mx-auto mb-1 border border-white/20" alt=""/>
            <div class="font-bold text-xs text-white">${window.SMPL_VIEWS.escapeHtml(ap ? ap.name : '')}</div>
            <input id="admin-edit-as" type="number" min="0" max="2" value="${m.awayScore || 0}" class="mt-2 w-16 h-11 text-center rounded-xl bg-slate-900 border border-rose-500 font-display font-black text-xl text-white"/>
          </div>
        </div>
        <div class="text-[11px] text-center text-slate-400 -mt-2 mb-3">⚽ Mecz ligowy: <strong class="text-white">zawsze max 2 bramki (0–2, bez 2:2)</strong> • Walkowery: <strong class="text-rose-300">2:0 / 0:2 / 0:0 WO</strong>.</div>

        <div class="mb-4">
          <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Status meczu</label>
          <select id="admin-edit-status" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold">
            <option value="APPROVED" ${m.status === 'APPROVED' || m.status === 'PENDING' || m.status === 'SCHEDULED' ? 'selected' : ''}>✅ Rozegrany i Zatwierdzony (Liczony do tabeli)</option>
            <option value="WALKOVER" ${m.status === 'WALKOVER' ? 'selected' : ''}>⚠️ Walkower (WO / Wolny Los)</option>
            <option value="PENDING">⏳ Oczekujący na weryfikację</option>
            <option value="SCHEDULED">📅 Nierozegrany (Wyczyść wynik)</option>
          </select>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Notatka / Powód (WYMAGANE min. 3 znaki przy W.O.)</label>
          <input id="admin-edit-comment" type="text" value="${window.SMPL_VIEWS.escapeHtml(m.comment || '')}" placeholder="Np. Brak odzewu na Messengerze przez 48h" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
        </div>

        <div class="mb-4 p-3 rounded-xl bg-slate-950/90 border border-sky-400/35 space-y-2">
          <label class="block text-[11px] font-display uppercase text-sky-300 font-bold">
            📸 Dowód W.O. — SS dlaczego (WYMAGANY przy Walkowerze)
          </label>
          <input id="admin-wo-screen-input" type="file" accept="image/*" onchange="SMPL_APP.handleAdminWalkoverScreenUpload(event)" class="w-full text-[11px] text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-sky-600/30 file:text-sky-200 file:font-bold"/>
          <div id="admin-wo-screen-preview" class="text-[11px] text-slate-400">
            ${
              adminEditDraftScreenshot
                ? `<img src="${adminEditDraftScreenshot}" class="max-h-32 w-auto rounded-lg border border-emerald-400/40 object-contain mx-auto" alt="Aktualny dowód SS"/>
                   <div class="text-center text-emerald-300 font-bold mt-1">✅ Aktualny SS dowodowy przypięty do meczu</div>`
                : 'Załącz screen z Messengera lub gry potwierdzający powód W.O.'
            }
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-950/90 border border-white/10 mb-5">
          <div class="text-[11px] font-display uppercase text-amber-300 font-bold mb-2">⚡ Szybki Walkower 1 kliknięciem (po załączeniu SS i wpisaniu powodu):</div>
          <div class="grid grid-cols-3 gap-2">
            <button onclick="SMPL_APP.adminQuickWalkover('${m.id}', 'HOME_WIN')" class="py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
              2:0 WO (${window.SMPL_VIEWS.escapeHtml(hp ? hp.name.split(' ')[0] : 'Gosp')})
            </button>
            <button onclick="SMPL_APP.adminQuickWalkover('${m.id}', 'AWAY_WIN')" class="py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-xs font-bold">
              0:2 WO (${window.SMPL_VIEWS.escapeHtml(ap ? ap.name.split(' ')[0] : 'Gość')})
            </button>
            <button onclick="SMPL_APP.adminQuickWalkover('${m.id}', 'BOTH_LOSE')" class="py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs font-bold">
              0:0 WO (Obustronny)
            </button>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.saveAdminMatchEdit('${m.id}')" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display uppercase">
            💾 Zapisz i przelicz tabelę
          </button>
        </div>
      </div>
    `);
  }

  function validateAdminWalkoverProof(matchObj, commentStr) {
    if (matchObj && matchObj.isByeWalkover) return { ok: true, screenshot: adminEditDraftScreenshot || (matchObj.screenshot || '') };
    const cleanComment = String(commentStr || '').trim();
    if (cleanComment.length < 3) {
      showToast('📝 Przy walkowerze (W.O.) podaj powód (min. 3 znaki) w Notatce Admina!', 'error');
      return { ok: false };
    }
    const proofSs = String(adminEditDraftScreenshot || (matchObj && matchObj.screenshot) || '').trim();
    if (!proofSs || !/^data:image\//i.test(proofSs)) {
      showToast('📸 Walkower (W.O.) wymaga obowiązkowego zrzutu ekranu (SS dlaczego)!', 'error');
      return { ok: false };
    }
    return { ok: true, screenshot: proofSs, comment: cleanComment };
  }

  function saveAdminMatchEdit(matchId) {
    if (!requireStrictAdmin('zapisanie edycji meczu')) return;
    const session = window.SMPL_DB.getSession();
    const state = window.SMPL_DB.getState();
    const matchObj = (state.matches || []).find((x) => x && x.id === matchId);
    const hs = Number(document.getElementById('admin-edit-hs').value || 0);
    const as = Number(document.getElementById('admin-edit-as').value || 0);
    const status = document.getElementById('admin-edit-status').value || 'APPROVED';
    const comment = document.getElementById('admin-edit-comment').value || '';

    let proofSs = adminEditDraftScreenshot || (matchObj && matchObj.screenshot) || '';
    if (status === 'WALKOVER') {
      const woCheck = validateAdminWalkoverProof(matchObj, comment);
      if (!woCheck.ok) return;
      proofSs = woCheck.screenshot;
    }

    try {
      if (status === 'SCHEDULED') {
        window.SMPL_DB.rejectMatch(matchId, 'Zresetowano do nierozegranego przez Admina.', session.adminName || 'Szymon Komenda');
      } else {
        window.SMPL_DB.editMatchByAdmin(
          matchId,
          { homeScore: hs, awayScore: as, status, comment, screenshot: proofSs || undefined },
          session.adminName || 'Szymon Komenda'
        );
      }
      adminEditDraftScreenshot = '';
      closeModal();
      showToast('✅ Zaktualizowano mecz i automatycznie przeliczono tabelę oraz statystyki!');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nieprawidłowy wynik meczu.', 'error');
    }
  }

  function adminQuickWalkover(matchId, type) {
    if (!requireStrictAdmin('przyznanie walkowera')) return;
    const session = window.SMPL_DB.getSession();
    const state = window.SMPL_DB.getState();
    const matchObj = (state.matches || []).find((x) => x && x.id === matchId);
    const commentEl = document.getElementById('admin-edit-comment');
    const comment = commentEl ? commentEl.value : '';
    const woCheck = validateAdminWalkoverProof(matchObj, comment);
    if (!woCheck.ok) return;
    window.SMPL_DB.setWalkover(
      matchId,
      type,
      session.adminName || 'Szymon Komenda',
      woCheck.comment || comment,
      woCheck.screenshot
    );
    adminEditDraftScreenshot = '';
    closeModal();
    showToast('⚠️ Przyznano Walkower (WO) z dowodem SS i zaktualizowano tabelę!');
    renderAll();
  }

  function adminAssignReg(regId, targetLeagueId) {
    if (!requireStrictAdmin('dopisanie gracza do ligi')) return;
    const session = window.SMPL_DB.getSession();
    const selectEl = document.getElementById(`reg-hist-select-${regId}`);
    const histChoice = selectEl ? selectEl.value : null;
    const res = window.SMPL_DB.assignRegistration(
      regId,
      targetLeagueId,
      session.adminName || 'Szymon Komenda',
      histChoice
    );
    showToast(
      `🎉 Gracz ${res.player.name} został dopisany z Listy Oczekujących do ligi ${targetLeagueId}${
        res.replacedSlotLabel ? ` (w miejsce ${res.replacedSlotLabel} — przejął pełny terminarz!)` : ''
      }${
        res.assignedHistInfo ? ` wraz ze statystykami z poprzednich lat (${res.assignedHistInfo.sourceLabel})` : ''
      }!`
    );
    renderAll();
  }

  function adminAssignPoolReg(regId) {
    const sel = document.getElementById(`reg-league-${regId}`);
    const targetLg = (sel && sel.value) || activeLeague || 'L2';
    adminAssignReg(regId, targetLg);
  }

  function openAssignHistoricalStatsModal(playerId) {
    if (!requireStrictAdmin('przypisanie statystyk historycznych')) return;
    const state = window.SMPL_DB.getState();
    const p = state.players.find((item) => item.id === playerId);
    if (!p) return;

    const catalog =
      typeof window.SMPL_DB.getHistoricalPlayersCatalog === 'function'
        ? window.SMPL_DB.getHistoricalPlayersCatalog()
        : (state.allTimeRanking || []);
    const targetHistName = p.historicalArchiveName || p.name;
    const matchedCatalog = catalog.find(
      (a) => a.name.toLowerCase() === String(targetHistName).toLowerCase()
    );
    const currentHist =
      p.historicalStats ||
      matchedCatalog || {
        seasons: 1,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        points: 0,
        total: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        bestPos: '#1–#10 SMPL'
      };

    const archiveOptionsHtml = catalog
      .map(
        (a) =>
          `<option value="${window.SMPL_VIEWS.escapeHtml(a.name)}" ${
            matchedCatalog && matchedCatalog.name === a.name ? 'selected' : ''
          }>${window.SMPL_VIEWS.escapeHtml(formatArchiveOptionText(a, ''))}</option>`
      )
      .join('');

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-amber-400">DOPISYWANIE STATYSTYK Z POPRZEDNICH SEZONÓW (S1–S55)</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🏛️ Statystyki Historyczne: ${window.SMPL_VIEWS.escapeHtml(p.name)}</h3>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <!-- Opcja A: 1 Kliknięciem dopasuj z Archiwum Excela (Sezony 1–55) -->
        <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 mb-4 space-y-2.5">
          <div class="text-xs font-display font-black uppercase text-amber-300">
            ⚡ OPCJA 1 (NAJSZYBSZA): Dopisz pełny profil S1–S55 (${catalog.length} graczy z historii)
          </div>
          <p class="text-[11px] text-slate-300">
            Wpisz nazwisko albo wybierz z pełnej listy graczy S1–S55 — system przypisze sezony, mecze, bramki, punkty All-Time, tabelę sezonową i medale bezpośrednio do profilu gracza:
          </p>
          <input
            type="text"
            id="modal-hist-archive-filter"
            placeholder="🔍 Wpisz imię lub nazwisko, aby przefiltrować listę (${catalog.length} graczy)..."
            oninput="SMPL_APP.filterHistSelect('modal-hist-archive-select', this.value)"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
          />
          <div class="flex flex-col sm:flex-row gap-2">
            <select id="modal-hist-archive-select" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white font-bold">
              ${archiveOptionsHtml}
            </select>
            <button onclick="SMPL_APP.applyHistoricalArchiveOneClick('${p.id}')" class="btn-league px-4 py-2.5 rounded-xl text-xs font-display font-black uppercase whitespace-nowrap">
              ⚡ Dopisz z Archiwum (1 Klik)
            </button>
          </div>
        </div>

        <!-- Opcja B: Gotowe Pakiety 1-Kliknięciem -->
        <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10 mb-4">
          <div class="text-xs font-display font-black uppercase text-emerald-400 mb-2">
            🚀 OPCJA 2: Gotowe Pakiety Statystyk z Poprzednich Lat (1 Kliknięciem)
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onclick="SMPL_APP.applyHistoricalPresetOneClick('${p.id}', 'CHAMPION_PAST')" class="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/40 text-left text-xs font-bold">
              👑 Były Mistrz / Legenda (8 sez., 240M, 2x👑, 580 pkt)
            </button>
            <button onclick="SMPL_APP.applyHistoricalPresetOneClick('${p.id}', 'VETERAN_5S')" class="p-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/35 text-blue-300 border border-blue-400/40 text-left text-xs font-bold">
              🔥 Weteran SMPL (5 sez., 150M, 🥈+🥉, 295 pkt)
            </button>
            <button onclick="SMPL_APP.applyHistoricalPresetOneClick('${p.id}', 'VETERAN_2S')" class="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 text-left text-xs font-bold">
              ⚽ Gracz z poprzednich lat (2 sez., 60M, 1x🥉, 110 pkt)
            </button>
            <button onclick="SMPL_APP.applyHistoricalPresetOneClick('${p.id}', 'DEBUT_S55')" class="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/15 text-left text-xs font-bold">
              🆕 Debiutant w Lidze (Wyzeruj poprzednie sezony)
            </button>
          </div>
        </div>

        <!-- Opcja C: Dokładne liczby z poprzednich lat -->
        <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10 mb-4">
          <div class="text-xs font-display font-black uppercase text-white mb-2.5">
            ✏️ OPCJA 3: Wpisz dokładne statystyki z poprzednich sezonów:
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs mb-3">
            <div>
              <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Sezony</label>
              <input id="hist-custom-seasons" type="number" min="1" value="${currentHist.seasons || 1}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Mecze (M)</label>
              <input id="hist-custom-matches" type="number" min="0" value="${currentHist.matches || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-emerald-400 uppercase font-bold mb-1">Wygrane (W)</label>
              <input id="hist-custom-wins" type="number" min="0" value="${currentHist.wins || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-amber-400 uppercase font-bold mb-1">Remisy (R)</label>
              <input id="hist-custom-draws" type="number" min="0" value="${currentHist.draws || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-rose-400 uppercase font-bold mb-1">Porażki (P)</label>
              <input id="hist-custom-losses" type="number" min="0" value="${currentHist.losses || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Gole Zdobyte</label>
              <input id="hist-custom-gf" type="number" min="0" value="${currentHist.gf || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Gole Stracone</label>
              <input id="hist-custom-ga" type="number" min="0" value="${currentHist.ga || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-amber-300 uppercase font-bold mb-1">TOTAL PKT All-Time</label>
              <input id="hist-custom-total" type="number" min="0" value="${currentHist.total || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-400/50 text-amber-300 font-bold"/>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2.5 text-xs">
            <div>
              <label class="block text-[10px] text-amber-300 uppercase font-bold mb-1">👑 Złote Medale</label>
              <input id="hist-custom-gold" type="number" min="0" value="${currentHist.gold || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-400/40 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-slate-300 uppercase font-bold mb-1">🥈 Srebrne Medale</label>
              <input id="hist-custom-silver" type="number" min="0" value="${currentHist.silver || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-white font-bold"/>
            </div>
            <div>
              <label class="block text-[10px] text-amber-600 uppercase font-bold mb-1">🥉 Brązowe Medale</label>
              <input id="hist-custom-bronze" type="number" min="0" value="${currentHist.bronze || 0}" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-amber-700/40 text-white font-bold"/>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.saveCustomHistoricalStats('${p.id}')" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">
            💾 Zapisz wpisane statystyki z poprzednich lat
          </button>
        </div>
      </div>
    `);
  }

  function applyHistoricalArchiveOneClick(playerId) {
    if (!requireStrictAdmin('zapisanie statystyk z archiwum')) return;
    const session = window.SMPL_DB.getSession();
    const sel = document.getElementById('modal-hist-archive-select');
    const archiveName = sel ? sel.value : '';
    try {
      const res = window.SMPL_DB.assignHistoricalStatsToPlayer(
        playerId,
        { archiveName },
        session.adminName || 'Szymon Komenda'
      );
      closeModal();
      showToast(`🏛️ Jednym kliknięciem dopisano statystyki i medale z Archiwum S1–S55 (${res.sourceLabel}) dla gracza ${res.player.name}!`);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function applyHistoricalPresetOneClick(playerId, presetKey) {
    if (!requireStrictAdmin('nadanie pakietu historycznego')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.assignHistoricalStatsToPlayer(
        playerId,
        { preset: presetKey },
        session.adminName || 'Szymon Komenda'
      );
      closeModal();
      showToast(`⚡ Jednym kliknięciem dopisano pakiet historyczny (${res.sourceLabel}) dla gracza ${res.player.name}!`);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function saveCustomHistoricalStats(playerId) {
    if (!requireStrictAdmin('edycja statystyk historycznych')) return;
    const session = window.SMPL_DB.getSession();
    const custom = {
      seasons: Number(document.getElementById('hist-custom-seasons').value || 1),
      matches: Number(document.getElementById('hist-custom-matches').value || 0),
      wins: Number(document.getElementById('hist-custom-wins').value || 0),
      draws: Number(document.getElementById('hist-custom-draws').value || 0),
      losses: Number(document.getElementById('hist-custom-losses').value || 0),
      gf: Number(document.getElementById('hist-custom-gf').value || 0),
      ga: Number(document.getElementById('hist-custom-ga').value || 0),
      total: Number(document.getElementById('hist-custom-total').value || 0),
      gold: Number(document.getElementById('hist-custom-gold').value || 0),
      silver: Number(document.getElementById('hist-custom-silver').value || 0),
      bronze: Number(document.getElementById('hist-custom-bronze').value || 0)
    };
    try {
      const res = window.SMPL_DB.assignHistoricalStatsToPlayer(
        playerId,
        { custom },
        session.adminName || 'Szymon Komenda'
      );
      closeModal();
      showToast(`💾 Zapisano statystyki z poprzednich lat (${res.sourceLabel}) i przeliczono Kartę UT dla gracza ${res.player.name}!`);
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function adminRejectRegPrompt(regId) {
    if (!requireStrictAdmin('odrzucenie zgłoszenia')) return;
    const session = window.SMPL_DB.getSession();
    const reason = prompt('Podaj powód odrzucenia zgłoszenia rekrutacyjnego:', 'Komplet miejsc w wybranej lidze lub niepełne dane zgłoszenia.');
    if (reason === null) return;
    window.SMPL_DB.rejectRegistration(regId, reason, session.adminName || 'Szymon Komenda');
    showToast('❌ Zgłoszenie z Listy Oczekujących zostało odrzucone.', 'warning');
    renderAll();
  }

  function quickPenaltyThree(playerId) {
    openDeductPointsModal(playerId);
  }

  function setDeductAmountPreset(val) {
    const el = document.getElementById('deduct-pts-amount');
    if (el) el.value = String(val);
  }

  function openDeductPointsModal(playerId) {
    if (!requireStrictAdmin('odjęcie punktów karnych')) return;
    const state = window.SMPL_DB.getState();
    const p = state.players.find((item) => item.id === playerId);
    if (!p) return;
    const curPen = Number(p.penaltyPoints || 0);
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-black uppercase text-rose-400">Komisja Ligi • Brak Limitu Punktów</span>
            <h3 class="font-display font-black text-lg text-white uppercase">⚖️ Odejmij Punkty: ${window.SMPL_VIEWS.escapeHtml(p.name)}</h3>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div class="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-300 mb-4 flex items-center justify-between gap-2">
          <span>Liga: <strong class="text-white">${window.SMPL_VIEWS.escapeHtml(p.leagueId)}</strong> (@${window.SMPL_VIEWS.escapeHtml(p.nick)})</span>
          <span>Obecna kara: <strong class="text-rose-400">-${curPen} PKT</strong></span>
        </div>

        <div class="space-y-4 mb-5">
          <div>
            <label class="block text-xs font-display uppercase text-rose-300 mb-1.5 font-bold">Ile punktów odjąć? (BEZ LIMITU — wpisz dowolną liczbę) *</label>
            <input id="deduct-pts-amount" type="number" min="1" step="1" value="3" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-rose-500/50 text-base text-white font-black"/>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <button type="button" onclick="SMPL_APP.setDeductAmountPreset(1)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-white/10 text-[11px] font-bold">-1 pkt</button>
              <button type="button" onclick="SMPL_APP.setDeductAmountPreset(3)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-white/10 text-[11px] font-bold">-3 pkt</button>
              <button type="button" onclick="SMPL_APP.setDeductAmountPreset(6)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-white/10 text-[11px] font-bold">-6 pkt</button>
              <button type="button" onclick="SMPL_APP.setDeductAmountPreset(10)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-white/10 text-[11px] font-bold">-10 pkt</button>
              <button type="button" onclick="SMPL_APP.setDeductAmountPreset(25)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-white/10 text-[11px] font-bold">-25 pkt</button>
              <button type="button" onclick="SMPL_APP.setDeductAmountPreset(50)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-300 border border-white/10 text-[11px] font-bold">-50 pkt</button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-display uppercase text-amber-300 mb-1.5 font-bold">Powód odjęcia punktów (OBOWIĄZKOWY — każdy Admin to widzi) *</label>
            <textarea id="deduct-pts-reason" rows="2" placeholder="Wpisz dokładnie dlaczego odejmujesz punkty (np. Walkower bez zgłoszenia, brak 4 kolejek w terminie, niesportowe zachowanie)..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white focus:outline-none"></textarea>
            <div class="text-[11px] text-slate-400 mt-1">
              🔍 Ten wpis (Twój nick admina, liczba odjętych punktów i powód) zapisze się na stałe w Dzienniku Kar widocznym dla wszystkich Adminów.
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          ${
            curPen > 0
              ? `<button type="button" onclick="SMPL_APP.clearPlayerPenaltyFromModal('${p.id}')" class="px-3.5 py-2.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                   ✅ Wyzeruj karę na 0 pkt
                 </button>`
              : '<span></span>'
          }
          <div class="flex items-center gap-2">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
            <button type="button" onclick="SMPL_APP.confirmDeductPoints('${p.id}')" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-display uppercase font-black shadow-lg">
              ⚖️ Odejmij Punkty i Zapisz Powód
            </button>
          </div>
        </div>
      </div>
    `);
  }

  function confirmDeductPoints(playerId) {
    if (!requireStrictAdmin('odjęcie punktów karnych')) return;
    const amtEl = document.getElementById('deduct-pts-amount');
    const reasonEl = document.getElementById('deduct-pts-reason');
    const amt = amtEl ? parseInt(amtEl.value, 10) : 0;
    const reason = reasonEl ? reasonEl.value.trim() : '';
    if (isNaN(amt) || amt < 1) {
      showToast('Wpisz poprawną liczbę punktów do odjęcia (minimum 1 pkt).', 'error');
      return;
    }
    if (reason.length < 3) {
      showToast('⚠️ Musisz podać powód dlaczego odejmujesz punkty (min. 3 znaki) — widzi go każdy Admin!', 'error');
      return;
    }
    const session = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.deductPlayerPoints(playerId, amt, reason, session.adminName || 'Szymon Komenda');
      closeModal();
      showToast(`⚖️ Odjęto -${amt} pkt (łącznie -${res.player.penaltyPoints} pkt). Powód zapisany i widoczny dla wszystkich Adminów!`, 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się odjąć punktów.', 'error');
    }
  }

  function clearPlayerPenaltyFromModal(playerId) {
    if (!requireStrictAdmin('cofnięcie kary punktowej')) return;
    const reasonEl = document.getElementById('deduct-pts-reason');
    const reason = reasonEl ? reasonEl.value.trim() : '';
    if (reason.length < 3) {
      showToast('⚠️ Wpisz w polu powyżej powód zdjęcia kary (min. 3 znaki), aby inni Admini wiedzieli dlaczego ją cofasz!', 'error');
      return;
    }
    const session = window.SMPL_DB.getSession();
    try {
      window.SMPL_DB.pardonPlayerDiscipline(playerId, session.adminName || 'Szymon Komenda', reason);
      closeModal();
      showToast('✅ Zdjęto karę punktową i zapisano powód w Dzienniku Kar.', 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd zerowania kary.', 'error');
    }
  }

  function openEditPlayerModal(playerId) {
    if (!requireStrictAdmin('edycja zawodnika')) return;
    tempEditedAvatar = null;
    const state = window.SMPL_DB.getState();
    const p = state.players.find((item) => item.id === playerId);
    if (!p) return;

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <h3 class="font-display font-black text-lg text-white uppercase">✏️ Edycja Gracza & Kary Punktowe</h3>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div class="flex items-center gap-4 mb-4">
          <img id="edit-player-avatar-preview" src="${p.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-league" alt=""/>
          <div class="flex-1">
            <label class="block text-xs font-display uppercase text-slate-300 font-bold mb-1">Zmień zdjęcie / awatar gracza</label>
            <input type="file" accept="image/*" onchange="SMPL_APP.previewEditPlayerAvatar(event)" class="text-xs text-slate-300"/>
          </div>
        </div>

        <div class="space-y-3 mb-5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Imię i Nazwisko</label>
            <input id="edit-player-name" type="text" value="${window.SMPL_VIEWS.escapeHtml(p.name)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nick w grze</label>
              <input id="edit-player-nick" type="text" value="${window.SMPL_VIEWS.escapeHtml(p.nick)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
            </div>
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Przypisana Liga</label>
              <select id="edit-player-league" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-bold">
                ${
                  (() => {
                    const optsLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
                      ? window.SMPL_DB.getLeaguesList(state, false).slice()
                      : [];
                    if (p.leagueId && !optsLeagues.some((lg) => lg.id === p.leagueId)) {
                      const extraLg = state.leagues && state.leagues[p.leagueId];
                      optsLeagues.push(extraLg || { id: p.leagueId, name: p.leagueId });
                    }
                    return optsLeagues
                      .map(
                        (lg) => `<option value="${window.SMPL_VIEWS.escapeHtml(lg.id)}" ${p.leagueId === lg.id ? 'selected' : ''}>${window.SMPL_VIEWS.escapeHtml(lg.name || lg.shortName || lg.id)} (${window.SMPL_VIEWS.escapeHtml(lg.id)})</option>`
                      )
                      .join('');
                  })()
                }
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">👑 Tytuł Specjalny / Wyróżnienie Zarządu</label>
            <select id="edit-player-custom-rank" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/40 text-xs sm:text-sm text-white font-bold">
              <option value="" ${!p.customRank ? 'selected' : ''}>-- Brak (Tylko automatyczna ranga z XP) --</option>
              ${
                (() => {
                  const allTitles = window.SMPL_RANKS && typeof window.SMPL_RANKS.getAllAvailableTitles === 'function'
                    ? window.SMPL_RANKS.getAllAvailableTitles(state)
                    : [];
                  const renderOpt = (t) => `<option value="${window.SMPL_VIEWS.escapeHtml(t.id)}" ${p.customRank === t.id ? 'selected' : ''}>${window.SMPL_VIEWS.escapeHtml((t.icon || '🎖️') + ' ' + t.name + (t.isCustom ? ' [WŁASNA]' : ''))}</option>`;
                  const customList = allTitles.filter((t) => t.isCustom);
                  const eliteList = allTitles.filter((t) => !t.isCustom && t.category === 'ELITE');
                  const skillList = allTitles.filter((t) => !t.isCustom && t.category === 'SKILL');
                  const prestigeList = allTitles.filter((t) => !t.isCustom && (!t.category || t.category === 'PRESTIGE'));
                  return [
                    customList.length ? `<optgroup label="⭐ Własne Rangi Mastera">${customList.map(renderOpt).join('')}</optgroup>` : '',
                    eliteList.length ? `<optgroup label="👑 Elita &amp; Legendy SMPL">${eliteList.map(renderOpt).join('')}</optgroup>` : '',
                    skillList.length ? `<optgroup label="🎯 Styl Gry &amp; Kunszt">${skillList.map(renderOpt).join('')}</optgroup>` : '',
                    prestigeList.length ? `<optgroup label="🛡️ Prestiż &amp; Społeczność">${prestigeList.map(renderOpt).join('')}</optgroup>` : ''
                  ].join('');
                })()
              }
            </select>
          </div>
          ${isClansUiEnabledSafe(state) ? `<div>
            <label class="block text-xs font-display uppercase text-emerald-300 mb-1 font-bold">🛡️ Klan Gracza Score! Match</label>
            <select id="edit-player-clan" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-emerald-400/35 text-xs sm:text-sm text-white font-bold">
              <option value="" ${!p.clanId ? 'selected' : ''}>-- Bez klanu / Wolny strzelec --</option>
              ${
                (() => {
                  const clansList = window.SMPL_DB && typeof window.SMPL_DB.getClansList === 'function'
                    ? window.SMPL_DB.getClansList(state).slice()
                    : [];
                  if (p.clanId && p.clanName && !clansList.some((c) => c && c.id === p.clanId)) {
                    clansList.push({ id: p.clanId, name: p.clanName, tag: p.clanTag || '' });
                  }
                  return clansList
                    .map((c) => `<option value="${window.SMPL_VIEWS.escapeHtml(c.id)}" ${p.clanId === c.id ? 'selected' : ''}>${c.tag ? '[' + window.SMPL_VIEWS.escapeHtml(c.tag) + '] ' : ''}${window.SMPL_VIEWS.escapeHtml(c.name)}</option>`)
                    .join('');
                })()
              }
            </select>
          </div>` : ''}
          <div>
            <label class="block text-xs font-display uppercase text-sky-300 mb-1 font-bold">📝 Bio Gracza (widoczne na Karcie UT)</label>
            <textarea id="edit-player-bio" rows="2" maxlength="280" placeholder="Krótki opis, styl gry, cel na sezon..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white">${window.SMPL_VIEWS.escapeHtml(p.bio || '')}</textarea>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30">
            <div>
              <label class="block text-xs font-display uppercase text-rose-300 mb-1 font-bold">Kara Punktowa (Odejmowane PKT — BEZ LIMITU)</label>
              <input id="edit-player-penalty" type="number" min="0" step="1" value="${p.penaltyPoints || 0}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-rose-500/50 text-sm text-white font-bold"/>
            </div>
            <div>
              <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">Powód kary (WYMAGANY — widzi każdy Admin) *</label>
              <input id="edit-player-penalty-reason" type="text" value="${window.SMPL_VIEWS.escapeHtml(p.penaltyReason || '')}" placeholder="Np. Walkower / brak aktywności (min. 3 znaki)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white"/>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.saveEditPlayer('${p.id}')" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">
            💾 Zapisz Zmiany
          </button>
        </div>
      </div>
    `);
  }

  let tempEditedAvatar = null;
  function previewEditPlayerAvatar(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    fileToDataUrl(file, 400).then((dataUrl) => {
      tempEditedAvatar = dataUrl;
      const img = document.getElementById('edit-player-avatar-preview');
      if (img) img.src = tempEditedAvatar;
    });
  }

  function saveEditPlayer(playerId) {
    if (!requireStrictAdmin('zapisanie zmian gracza')) return;
    const session = window.SMPL_DB.getSession();
    const name = document.getElementById('edit-player-name').value || '';
    const nick = document.getElementById('edit-player-nick').value || '';
    const leagueId = document.getElementById('edit-player-league').value || 'L2';
    const penaltyPoints = Number(document.getElementById('edit-player-penalty').value || 0);
    const penaltyReason = document.getElementById('edit-player-penalty-reason').value || '';
    const customRankEl = document.getElementById('edit-player-custom-rank');
    const customRank = customRankEl ? customRankEl.value : null;
    const clanEl = document.getElementById('edit-player-clan');
    const clanId = clanEl ? clanEl.value : undefined;
    const bioEl = document.getElementById('edit-player-bio');
    const bio = bioEl ? bioEl.value : undefined;

    try {
      window.SMPL_DB.updatePlayer(
        playerId,
        {
          name,
          nick,
          leagueId,
          penaltyPoints,
          penaltyReason,
          customRank,
          clanId,
          bio,
          avatar: tempEditedAvatar || undefined
        },
        session.adminName || 'Szymon Komenda'
      );
      tempEditedAvatar = null;
      closeModal();
      showToast('✅ Zaktualizowano profil zawodnika oraz tabelę ligową!');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd aktualizacji gracza.', 'error');
    }
  }

  function renderAddPlayerCandidatesHtml(filterText, kindFilter, targetLeague) {
    if (!window.SMPL_DB || typeof window.SMPL_DB.getAddPlayerCandidates !== 'function') {
      return '<div class="text-xs text-slate-400 italic py-3">Ładowanie listy...</div>';
    }
    const st = window.SMPL_DB.getState();
    const q = String(filterText || '').trim().toLowerCase();
    const k = String(kindFilter || 'ALL').trim().toUpperCase();
    let list = window.SMPL_DB.getAddPlayerCandidates(st);
    if (k && k !== 'ALL') {
      list = list.filter((c) => {
        if (k === 'REG') return c.kind === 'REG_PENDING' || c.kind === 'REG_POOL';
        if (k === 'POOL') return c.kind === 'PLAYER_POOL' || c.kind === 'REG_POOL';
        return c.kind === k;
      });
    }
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);
      list = list.filter((c) => terms.every((t) => (c.searchBlob || '').indexOf(t) !== -1));
    }
    const totalCount = list.length;
    const sliced = list.slice(0, 40);
    if (sliced.length === 0) {
      return `<div class="text-xs text-slate-400 italic py-4 text-center">Brak pasujących graczy w wybranej kategorii — użyj formularza ręcznego poniżej.</div>`;
    }
    const esc = window.SMPL_VIEWS.escapeHtml;
    const lgLabel = (st && st.leagues && st.leagues[targetLeague] && (st.leagues[targetLeague].shortName || st.leagues[targetLeague].id)) || targetLeague || 'L1';
    return `
      <div class="text-[10px] text-slate-400 font-bold uppercase mb-1.5">
        Znaleziono ${totalCount} kandydatów${totalCount > 40 ? ' (pokazano pierwszych 40 — wpisz fragment nazwiska lub nicku, aby zawęzić)' : ''}
      </div>
      <div class="space-y-2">
        ${sliced.map((c) => `
          <div class="p-2.5 rounded-xl bg-slate-900/90 border border-white/10 hover:border-amber-400/45 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 transition">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 mb-0.5">
                <span class="px-2 py-0.5 rounded-md text-[10px] font-display font-black uppercase ${
                  c.kind === 'ADMIN'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-400/40'
                    : c.kind === 'REG_PENDING' || c.kind === 'REG_POOL'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                    : c.kind === 'PLAYER_POOL'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : 'bg-slate-800 text-slate-300 border border-white/15'
                }">${esc(c.badge)}</span>
                <span class="font-display font-black text-xs text-white truncate">${esc(c.name)}</span>
                ${c.nick ? `<span class="text-[11px] text-emerald-300">@${esc(c.nick)}</span>` : ''}
                ${c.preferredLeague ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-bold">Chce: ${esc(c.preferredLeague)}</span>` : ''}
              </div>
              <div class="text-[11px] text-slate-400 truncate">${esc(c.meta || '')}</div>
            </div>
            <button
              type="button"
              onclick="SMPL_APP.adminAddCandidate('${esc(c.kind)}', '${encodeURIComponent(String(c.refId || ''))}')"
              class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-[11px] uppercase whitespace-nowrap shadow transition flex-shrink-0"
            >
              ➕ Dodaj do ${esc(lgLabel)}
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function openAddPlayerModal(targetLeagueId) {
    if (!requireStrictAdmin('dodawanie gracza do tabeli')) return;
    addPlayerModalUsernameEdited = false;
    const stAdd = window.SMPL_DB.getState();
    const curSeason = (stAdd && stAdd.season) || 56;
    const defaultLeague = targetLeagueId || activeLeague || 'L1';
    const addLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(stAdd, false).slice()
      : [{ id: 'L1', name: 'Ekstraklasa SMPL' }, { id: 'L2', name: '2. Liga SMPL' }];
    if (defaultLeague && defaultLeague !== 'APPROVED_POOL' && !addLeagues.some((lg) => lg.id === defaultLeague)) {
      const extraCfg = stAdd && stAdd.leagues && stAdd.leagues[defaultLeague];
      addLeagues.push(extraCfg || { id: defaultLeague, name: defaultLeague + ' Liga SMPL' });
    }
    const clansListAdd = window.SMPL_DB && typeof window.SMPL_DB.getClansList === 'function'
      ? window.SMPL_DB.getClansList(stAdd)
      : [];
    const catalog = window.SMPL_DB && typeof window.SMPL_DB.getHistoricalPlayersCatalog === 'function'
      ? window.SMPL_DB.getHistoricalPlayersCatalog()
      : [];

    openModal(`
      <div class="p-6 max-h-[88vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-amber-400">ADMINISTRACJA • SZYBKI WYBÓR Z LISTY LUB NOWE KONTO</span>
            <h3 class="font-display font-black text-lg text-white uppercase">➕ Dodaj Gracza / Załóż Konto Ręcznie (Sezon ${curSeason})</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <!-- DOCELOWA LIGA / PULA -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">Docelowa Liga / Pula *</label>
            <select id="new-player-league" onchange="SMPL_APP.filterAddPlayerCandidates()" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-sm text-white font-bold">
              ${addLeagues
                .map((lg) => {
                  const icon = lg.id === 'L1' ? '👑 ' : lg.id === 'L2' ? '🥈 ' : lg.id === 'L3' ? '🥉 ' : '🏟️ ';
                  return `<option value="${window.SMPL_VIEWS.escapeHtml(lg.id)}" ${defaultLeague === lg.id ? 'selected' : ''}>${icon}${window.SMPL_VIEWS.escapeHtml(lg.name || lg.id)} (${window.SMPL_VIEWS.escapeHtml(lg.id)})</option>`;
                })
                .join('')}
              <option value="APPROVED_POOL" ${defaultLeague === 'APPROVED_POOL' ? 'selected' : ''}>📋 Pula Aktywnych Kont (gotowe do logowania bez tabeli)</option>
            </select>
          </div>
          ${isClansUiEnabledSafe(stAdd) ? `<div>
            <label class="block text-xs font-display uppercase text-emerald-300 mb-1 font-bold">Klan (opcjonalnie)</label>
            <select id="new-player-clan" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-emerald-400/35 text-xs sm:text-sm text-white font-bold">
              <option value="">-- Bez klanu / Wolny strzelec --</option>
              ${clansListAdd
                .map((c) => `<option value="${window.SMPL_VIEWS.escapeHtml(c.id)}">${c.tag ? '[' + window.SMPL_VIEWS.escapeHtml(c.tag) + '] ' : ''}${window.SMPL_VIEWS.escapeHtml(c.name)}</option>`)
                .join('')}
            </select>
          </div>` : ''}
        </div>

        <!-- KROK 1: FILTROWANA LISTA KANDYDATÓW (REJESTRACJE, ADMINI, PULA, ARCHIWUM S1-S55) -->
        <div class="p-4 rounded-2xl bg-slate-950/90 border border-emerald-400/35 mb-5 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-xs font-display font-black uppercase text-emerald-300">🔍 Dodaj z Listy (wpisz nazwisko/nick lub wybierz kategorię)</span>
            <label class="inline-flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
              <input id="add-player-auto-hist" type="checkbox" checked class="accent-emerald-400"/>
              <span>Dopnij historię S1–S55</span>
            </label>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              id="add-player-filter-input"
              type="text"
              placeholder="🔍 Wpisz imię, nazwisko, nick lub @login..."
              oninput="SMPL_APP.filterAddPlayerCandidates()"
              class="sm:col-span-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/20 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
            <select
              id="add-player-kind-filter"
              onchange="SMPL_APP.filterAddPlayerCandidates()"
              class="px-3 py-2 rounded-xl bg-slate-900 border border-white/20 text-xs text-white font-bold"
            >
              <option value="ALL">Wszyscy kandydaci</option>
              <option value="REG">⏳ Rejestracje &amp; Zatwierdzeni</option>
              <option value="ADMIN">🛡️ Administratorzy (ADMIN)</option>
              <option value="POOL">🪑 Z Puli Graczy</option>
              <option value="PLAYER_OTHER">🔁 Z innych lig</option>
              <option value="ARCHIVE">🏛️ Archiwum S1–S55</option>
            </select>
          </div>
          <div id="add-player-candidates-list" class="max-h-60 overflow-y-auto pr-1">
            ${renderAddPlayerCandidatesHtml('', 'ALL', defaultLeague)}
          </div>
        </div>

        <!-- KROK 2: RĘCZNE DODANIE NOWEGO GRACZA -->
        <div class="border-t border-white/10 pt-4">
          <div class="text-xs font-display font-black uppercase text-slate-300 mb-3">
            ✍️ Lub wpisz nowego zawodnika ręcznie (tworzy nowe konto z gotowym loginem i hasłem):
          </div>
          <div class="space-y-3 mb-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Imię i Nazwisko zawodnika *</label>
                <input id="new-player-name" type="text" oninput="SMPL_APP.onAddPlayerModalNameInput()" placeholder="Np. Jan Kowalski" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-sm text-white font-bold"/>
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nick w grze *</label>
                <input id="new-player-nick" type="text" placeholder="Np. Kowal_JK1" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-sm text-white font-bold"/>
              </div>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Login do portalu (edytowalny)</label>
                <input id="new-player-username" type="text" oninput="SMPL_APP.onAddPlayerModalUsernameEdit()" placeholder="Np. jan.kowalski" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold"/>
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Hasło startowe (opcjonalnie)</label>
                <div class="flex items-center gap-2">
                  <input id="new-player-pass" type="text" placeholder="Puste = losowe hasło" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-300"/>
                  <button type="button" onclick="SMPL_APP.addPlayerModalGeneratePass()" class="px-2.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-xs font-bold flex-shrink-0" title="Wylosuj czytelne hasło">🎲</button>
                </div>
              </div>
            </div>
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Messenger / FB (opcjonalnie)</label>
              <input id="new-player-fb" type="text" placeholder="https://m.me/profil" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-300"/>
            </div>
            <div>
              <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">Statystyki z poprzednich lat S1–S55 (opcjonalnie)</label>
              <select id="new-player-hist-select" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-400/35 text-xs text-white font-bold">
                <option value="">🆕 Debiutant / brak historii (lub dopisz później)</option>
                <option value="PRESET:VETERAN_2S">⚡ Pakiet: Weteran 2 sezony (60M, 1x 🥉)</option>
                <option value="PRESET:VETERAN_5S">🔥 Pakiet: Weteran 5 sezonów (150M, 🥈+🥉)</option>
                <option value="PRESET:CHAMPION_PAST">👑 Pakiet: Były Mistrz / Legenda (8 sez., 2x 👑)</option>
                <optgroup label="--- ARCHIWUM S1–S55 ---">
                  ${catalog.map((a) => `<option value="ARCHIVE:${window.SMPL_VIEWS.escapeHtml(a.name)}">${window.SMPL_VIEWS.escapeHtml(formatArchiveOptionText(a, ''))}</option>`).join('')}
                </optgroup>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-2.5">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-xs font-bold">Anuluj</button>
            <button type="button" onclick="SMPL_APP.confirmAddPlayer()" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display uppercase font-black shadow-lg">
              ➕ Dodaj Nowego do Tabeli
            </button>
          </div>
        </div>
      </div>
    `);
  }

  function filterAddPlayerCandidates() {
    const listEl = document.getElementById('add-player-candidates-list');
    if (!listEl) return;
    const filterEl = document.getElementById('add-player-filter-input');
    const kindEl = document.getElementById('add-player-kind-filter');
    const lgEl = document.getElementById('new-player-league');
    const rawLg = lgEl ? lgEl.value : '';
    const candidateLg = rawLg && rawLg !== 'APPROVED_POOL' ? rawLg : (activeLeague || 'L1');
    listEl.innerHTML = renderAddPlayerCandidatesHtml(
      filterEl ? filterEl.value : '',
      kindEl ? kindEl.value : 'ALL',
      candidateLg
    );
  }

  function adminAddCandidate(kind, encodedRefId) {
    if (!requireStrictAdmin('dodanie gracza z listy do ligi')) return;
    const session = window.SMPL_DB.getSession();
    let refId = '';
    try {
      refId = decodeURIComponent(String(encodedRefId || ''));
    } catch (e) {
      refId = String(encodedRefId || '');
    }
    const lgEl = document.getElementById('new-player-league');
    const clanEl = document.getElementById('new-player-clan');
    const passEl = document.getElementById('new-player-pass');
    const autoHistEl = document.getElementById('add-player-auto-hist');
    const leagueId = (lgEl && lgEl.value) || activeLeague || 'L1';
    const clanId = clanEl ? (clanEl.value || '') : '';
    const password = passEl ? (passEl.value || '') : '';
    const autoHistory = autoHistEl ? Boolean(autoHistEl.checked) : true;

    try {
      const res = window.SMPL_DB.adminAddCandidateToLeague(
        {
          kind,
          refId,
          archiveName: kind === 'ARCHIVE' ? refId : undefined,
          leagueId,
          clanId,
          password,
          autoHistory
        },
        session.adminName || 'Szymon Komenda'
      );
      closeModal();
      activeLeague = leagueId;
      const pl = res && res.player;
      const genPass = pl && pl._tempInitialPassword ? pl._tempInitialPassword : '';
      const histTxt = pl && pl.historicalStats ? ` + statystyki S1–S55 (${pl.historicalStats.seasons || 1} sez.)` : '';
      const roleTxt = pl && pl.isAdminPlayer ? ' pod rangą 🛡️ ADMIN' : '';
      showToast(
        genPass
          ? `✅ Dodano ${pl ? pl.name : ''} do ${leagueId}${roleTxt}${histTxt}! Login: ${pl.username} | Hasło: ${genPass}`
          : `✅ Dodano ${pl ? pl.name : 'gracza'} do ${leagueId}${roleTxt}${histTxt}!`
      );
      renderAll();
    } catch (e) {
      showToast((e && e.message) || 'Nie udało się dodać kandydata do ligi.', 'error');
    }
  }

  function confirmAddPlayer() {
    if (!requireStrictAdmin('dodanie gracza do tabeli')) return;
    const session = window.SMPL_DB.getSession();
    const name = document.getElementById('new-player-name').value || '';
    const nick = document.getElementById('new-player-nick').value || '';
    const userEl = document.getElementById('new-player-username');
    const username = userEl ? (userEl.value || '') : '';
    const fb = document.getElementById('new-player-fb').value || '';
    const passEl = document.getElementById('new-player-pass');
    const password = passEl ? (passEl.value || '') : '';
    const clanEl = document.getElementById('new-player-clan');
    const clanId = clanEl ? (clanEl.value || '') : '';
    const histEl = document.getElementById('new-player-hist-select');
    const histVal = histEl ? (histEl.value || '') : '';
    const leagueId = document.getElementById('new-player-league').value || activeLeague;
    if (!name.trim() || !nick.trim()) {
      showToast('Podaj imię, nazwisko oraz nick gracza.', 'error');
      return;
    }
    try {
      const isArchive = histVal.indexOf('ARCHIVE:') === 0;
      const isPreset = histVal.indexOf('PRESET:') === 0;
      let res = null;
      res = window.SMPL_DB.adminManualRegisterPlayer(
        {
          name,
          nick,
          username,
          fb,
          leagueId,
          targetMode: leagueId === 'APPROVED_POOL' ? 'POOL' : 'LEAGUE',
          preferredLeague: activeLeague || 'L2',
          password,
          clanId,
          historicalArchiveName: isArchive ? histVal.slice(8) : ''
        },
        session.adminName || 'Szymon Komenda',
        (err, serverData) => {
          if (err) {
            showToast('❌ ' + err, 'error');
            renderAll();
            return;
          }
          const info = serverData || res || {};
          const entity = info.player || info.registration || (res && (res.player || res.registration));
          const finalUser = (entity && entity.username) || info.username || username;
          if (entity && isPreset && leagueId !== 'APPROVED_POOL') {
            try {
              window.SMPL_DB.assignHistoricalStatsToPlayer(entity.id, { preset: histVal.slice(7) }, session.adminName || 'Szymon Komenda');
            } catch (e) {}
          }
          closeModal();
          addPlayerModalUsernameEdited = false;
          if (leagueId !== 'APPROVED_POOL') activeLeague = leagueId;
          renderAll();
          openPreparedCredentialsModal({
            title: '➕ Utworzono Konto Gracza!',
            badge: leagueId === 'APPROVED_POOL' ? 'PULA AKTYWNYCH KONT (GOTOWY DO LOGOWANIA)' : 'ZAWODNIK DODANY DO LIGI',
            name: entity ? entity.name : name,
            nick: entity ? entity.nick : nick,
            username: finalUser,
            password: info.tempPassword,
            targetLabel: info.destLabel,
            fbLink: (entity && entity.fbLink) || fb,
            messengerText: info.messengerText
          });
          showToast(`✅ Dodano ${entity ? entity.name : name} (@${entity ? entity.nick : nick})! Login: ${finalUser} | Hasło: ${info.tempPassword || ''}`);
        }
      );
    } catch (e) {
      showToast(e.message || 'Błąd dodawania gracza.', 'error');
    }
  }

  function openPostRegistrationAdminChoiceModal(regId) {
    if (!requireStrictAdmin('wybór po rejestracji')) return;
    const st = window.SMPL_DB.getState();
    const r = (st.registrations || []).find((item) => item.id === regId);
    if (!r) return;
    const activeLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(st, false)
      : [{ id: 'L1', name: 'Ekstraklasa' }, { id: 'L2', name: '2. Liga' }];
    const catalog = window.SMPL_DB && typeof window.SMPL_DB.getHistoricalPlayersCatalog === 'function'
      ? window.SMPL_DB.getHistoricalPlayersCatalog()
      : [];
    const esc = window.SMPL_VIEWS.escapeHtml;
    openModal(`
      <div class="p-6 max-h-[86vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-emerald-400">WYBÓR ADMINISTRACJI PO REJESTRACJI</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🎯 Co zrobić z kontem: ${esc(r.name)} (@${esc(r.nick)})?</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <p class="text-xs text-slate-300 mb-4 leading-relaxed">
          Zarejestrowano gracza <strong>${esc(r.name)}</strong> (login: <code class="text-amber-300">${esc(r.username || '')}</code>${r.preferredLeague ? ` • preferowana liga: <strong>${esc(r.preferredLeague)}</strong>` : ''}). Wybierz od razu jego los:
        </p>
        <div class="mb-4">
          <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">Statystyki S1–S55 (przy bezpośrednim dopisaniu do ligi):</label>
          <select id="post-reg-hist-select-${esc(r.id)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/40 text-xs text-white font-bold">
            <option value="${r.linkedHistoricalName ? esc(r.linkedHistoricalName) : 'PRESET:DEBUT_S55'}">${r.linkedHistoricalName ? '🏛️ Powiązano z Archiwum: ' + esc(r.linkedHistoricalName) : '🆕 Debiutant / brak historii'}</option>
            <option value="PRESET:VETERAN_2S">⚡ Pakiet: Weteran 2 sezony (60M)</option>
            <option value="PRESET:VETERAN_5S">🔥 Pakiet: Weteran 5 sezonów (150M)</option>
            <option value="PRESET:CHAMPION_PAST">👑 Pakiet: Legenda SMPL (8 sez., 2x 👑)</option>
            <optgroup label="--- ARCHIWUM S1–S55 ---">
              ${catalog.map((a) => `<option value="${esc(a.name)}" ${r.linkedHistoricalName === a.name ? 'selected' : ''}>${esc(formatArchiveOptionText(a, ''))}</option>`).join('')}
            </optgroup>
          </select>
        </div>
        <div class="space-y-2.5">
          <div class="text-[11px] font-display uppercase text-emerald-300 font-bold">OPCJA 1: Od razu dopisz do wybranej ligi w tabeli:</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            ${activeLeagues.map((lg) => `
              <button type="button" onclick="SMPL_APP.adminAssignRegFromChoice('${esc(r.id)}', '${esc(lg.id)}')" class="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg">
                ➕ Dodaj do ${esc(lg.shortName || lg.id)} (${esc(lg.id)})
              </button>
            `).join('')}
          </div>
          <div class="text-[11px] font-display uppercase text-blue-300 font-bold pt-2">OPCJA 2: Zatwierdź samo konto (gracz sam kliknie [Dołącz do Ligi]):</div>
          <button type="button" onclick="SMPL_APP.adminApproveRegAccount('${esc(r.id)}', true)" class="w-full py-2.5 px-4 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-100 border border-blue-400/50 font-display font-black text-xs uppercase">
            ✅ Zatwierdź do Puli Graczy (gracz wybierze ligę samodzielnie przy starcie sezonu)
          </button>
          <button type="button" onclick="SMPL_APP.closeModal()" class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase">
            ⏳ Zostaw na liście oczekujących na później
          </button>
        </div>
      </div>
    `);
  }

  function adminAssignRegFromChoice(regId, targetLeagueId) {
    if (!requireStrictAdmin('przypisanie po rejestracji')) return;
    const session = window.SMPL_DB.getSession();
    const sel = document.getElementById(`post-reg-hist-select-${regId}`);
    const histChoice = sel ? sel.value : null;
    try {
      const res = window.SMPL_DB.assignRegistration(regId, targetLeagueId, session.adminName || 'Szymon Komenda', histChoice);
      closeModal();
      activeLeague = targetLeagueId;
      showToast(`🎉 Od razu dodano ${res.player.name} do ligi ${targetLeagueId}${res.assignedHistInfo ? ` (+ ${res.assignedHistInfo.sourceLabel})` : ''}!`);
      renderAll();
    } catch (e) {
      showToast((e && e.message) || 'Błąd przypisywania.', 'error');
    }
  }

  function adminApproveRegAccount(regId, shouldCloseModal) {
    if (!requireStrictAdmin('zatwierdzenie konta do puli')) return;
    const session = window.SMPL_DB.getSession();
    const isHttpEnv = window.location && window.location.protocol && window.location.protocol.startsWith('http') && typeof fetch === 'function';
    try {
      const res = window.SMPL_DB.approveRegistrationAccount(
        regId,
        session.adminName || 'Szymon Komenda',
        isHttpEnv
          ? (srvErr, srvData) => {
              if (srvErr) {
                showToast('❌ Serwer nie zapisał zatwierdzenia konta: ' + srvErr, 'error');
                renderAll();
                return;
              }
              const rObj = (srvData && srvData.registration) || res || {};
              const rName = (rObj && rObj.name) ? rObj.name : '';
              if (srvData && srvData.offline) {
                showToast(`⚠️ Zatwierdzono lokalnie ${rName} (brak połączenia z serwerem)!`, 'error');
              } else {
                showToast(`✅ Zapisano na serwerze: konto ${rName} przeniesione do Puli Graczy! Może teraz użyć [Dołącz do Ligi].`);
              }
              renderAll();
            }
          : null
      );
      if (shouldCloseModal) closeModal();
      const regName = (res && res.name) || (res && res.registration && res.registration.name) || '';
      if (!isHttpEnv) {
        showToast(`✅ Zatwierdzono konto ${regName} do Puli Graczy! Może teraz użyć przycisku [Dołącz do Ligi] gdy otworzysz start sezonu.`);
      }
      renderAll();
    } catch (e) {
      showToast((e && e.message) || 'Błąd zatwierdzania konta.', 'error');
    }
  }

  function handleApproveAllPendingToPool(shouldAlsoOpenWindow) {
    if (!requireStrictAdmin('masowe zatwierdzenie kont oczekujących do Puli')) return;
    const session = window.SMPL_DB.getSession();
    const adminNm = session.adminName || 'Szymon Komenda';
    const isHttpEnv = window.location && window.location.protocol && window.location.protocol.startsWith('http') && typeof fetch === 'function';
    try {
      const poolRes = window.SMPL_DB.approveAllPendingToPool(
        adminNm,
        isHttpEnv
          ? (srvErr, srvData) => {
              if (srvErr) {
                showToast('❌ Serwer odrzucił zatwierdzenie kont do Puli: ' + srvErr, 'error');
                renderAll();
                return;
              }
              const cnt = Number((srvData && srvData.approvedCount) || (poolRes && poolRes.approvedCount) || 0);
              if (srvData && srvData.offline) {
                showToast(`⚠️ Zatwierdzono lokalnie ${cnt} kont — brak połączenia z serwerem.`, 'error');
                renderAll();
              } else if (shouldAlsoOpenWindow) {
                showToast(`✅ Zatwierdzono ${cnt} kont do Puli na serwerze — otwieram okno dołączania...`);
                handleSetSeasonJoinWindow(true);
              } else {
                showToast(`✅ Zapisano na serwerze: zatwierdzono ${cnt} oczekujących kont do Puli Graczy!`);
                renderAll();
              }
            }
          : null
      );
      if (!isHttpEnv) {
        showToast(`✅ Zatwierdzono ${poolRes.approvedCount || 0} oczekujących kont do Puli Graczy!`);
        if (shouldAlsoOpenWindow) {
          handleSetSeasonJoinWindow(true);
        } else {
          renderAll();
        }
      } else {
        renderAll();
      }
    } catch (e) {
      showToast((e && e.message) || 'Błąd zatwierdzania kont do Puli.', 'error');
    }
  }

  function toggleAdminJoinHistFields() {
    const sel = document.getElementById('admin-join-hist-mode');
    const customBox = document.getElementById('admin-join-custom-box');
    if (!sel || !customBox) return;
    customBox.style.display = sel.value === 'CUSTOM' ? 'block' : 'none';
  }

  function openAdminJoinAsPlayerModal(defaultLeagueId) {
    if (!requireStrictAdmin('dołączenie jako Administrator-Zawodnik')) return;
    const session = window.SMPL_DB.getSession();
    const st = window.SMPL_DB.getState();
    const existingPl = typeof window.SMPL_DB.findPlayerForAdmin === 'function'
      ? window.SMPL_DB.findPlayerForAdmin(session.adminId, st)
      : null;
    const targetLg = defaultLeagueId || (existingPl && existingPl.leagueId !== 'POOL' ? existingPl.leagueId : 'L1');
    const activeLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(st, false)
      : [{ id: 'L1', name: 'Ekstraklasa' }, { id: 'L2', name: '2. Liga' }];
    const clans = window.SMPL_DB && typeof window.SMPL_DB.getClansList === 'function'
      ? window.SMPL_DB.getClansList(st)
      : [];
    const catalog = window.SMPL_DB && typeof window.SMPL_DB.getHistoricalPlayersCatalog === 'function'
      ? window.SMPL_DB.getHistoricalPlayersCatalog()
      : [];
    const matchedCat = catalog.find((a) =>
      a.name.toLowerCase() === String((existingPl && existingPl.historicalArchiveName) || session.adminName || '').toLowerCase()
    );
    const curHist = (existingPl && existingPl.historicalStats) || matchedCat || {
      seasons: 1, matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, total: 0, gold: 0, silver: 0, bronze: 0
    };
    const esc = window.SMPL_VIEWS.escapeHtml;
    const defaultNick = (existingPl && existingPl.nick) || session.adminUsername || session.adminName || 'Admin';

    openModal(`
      <div class="p-6 max-h-[88vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-blue-300">GRA ADMINISTRATORA POD RANGĄ 🛡️ ADMIN</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🛡️ Dołącz / Graj w Lidze jako Administrator</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <p class="text-xs text-slate-300 mb-4 leading-relaxed">
          Administratorzy grający w lidze (np. w <strong>Ekstraklasie L1</strong>) występują w tabeli, na Karcie UT oraz na czacie z oficjalną rangą <strong>🛡️ Admin</strong> (a Master Admin z dodatkową odznaką Właściciela Ligi) oraz mogą od razu dopisać swoje statystyki z poprzednich sezonów.
        </p>

        <div class="space-y-3.5 mb-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">Liga Docelowa *</label>
              <select id="admin-join-league" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-sm text-white font-bold">
                ${activeLeagues.map((lg) => `<option value="${esc(lg.id)}" ${lg.id === targetLg ? 'selected' : ''}>${esc(lg.name || lg.id)} (${esc(lg.id)})</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Twój Nick w grze *</label>
              <input id="admin-join-nick" type="text" value="${esc(defaultNick)}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-sm text-white font-bold"/>
            </div>
          </div>

          ${isClansUiEnabledSafe(st) ? `<div>
            <label class="block text-xs font-display uppercase text-emerald-300 mb-1 font-bold">Klan w grze (opcjonalnie)</label>
            <select id="admin-join-clan" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-emerald-400/35 text-xs text-white font-bold">
              <option value="">-- Bez zmiany / Bez klanu --</option>
              ${clans.map((c) => `<option value="${esc(c.id)}" ${existingPl && existingPl.clanId === c.id ? 'selected' : ''}>${c.tag ? '[' + esc(c.tag) + '] ' : ''}${esc(c.name)}</option>`).join('')}
            </select>
          </div>` : ''}

          <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 space-y-2.5">
            <div class="text-xs font-display font-black uppercase text-amber-300">
              🏛️ Twoje Statystyki z Poprzednich Sezonów (S1–S55)
            </div>
            <input
              type="text"
              id="admin-join-hist-search"
              placeholder="🔍 Filtruj listę graczy z Archiwum S1–S55..."
              oninput="SMPL_APP.filterHistSelect('admin-join-hist-mode', this.value)"
              class="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <select id="admin-join-hist-mode" onchange="SMPL_APP.toggleAdminJoinHistFields()" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white font-bold">
              ${existingPl && existingPl.historicalStats ? `<option value="KEEP" selected>✅ Zachowaj obecne statystyki (${existingPl.historicalStats.seasons || 1} sez., ${existingPl.historicalStats.total || 0} pkt All-Time)</option>` : ''}
              <option value="CUSTOM" ${!(existingPl && existingPl.historicalStats) && !matchedCat ? '' : ''}>✍️ Wpisz własne statystyki z poprzednich lat ręcznie (sezony, mecze, bramki, medale)</option>
              <option value="NONE" ${!(existingPl && existingPl.historicalStats) && !matchedCat ? 'selected' : ''}>🆕 Start od zera (bez dopisywania historii)</option>
              <option value="PRESET:VETERAN_2S">⚡ Pakiet: Weteran 2 sezony (60M, 1x 🥉)</option>
              <option value="PRESET:VETERAN_5S">🔥 Pakiet: Weteran 5 sezonów (150M, 🥈+🥉)</option>
              <option value="PRESET:CHAMPION_PAST">👑 Pakiet: Były Mistrz / Legenda (8 sez., 2x 👑, 580 pkt)</option>
              <optgroup label="--- ARCHIWUM S1–S55 ---">
                ${catalog.map((a) => `<option value="ARCHIVE:${esc(a.name)}" ${!(existingPl && existingPl.historicalStats) && matchedCat && matchedCat.name === a.name ? 'selected' : ''}>${esc(formatArchiveOptionText(a, ''))}</option>`).join('')}
              </optgroup>
            </select>

            <div id="admin-join-custom-box" style="display:none" class="p-3 rounded-xl bg-slate-950 border border-white/15 space-y-2.5 mt-2">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Sezony</label><input id="adj-h-seasons" type="number" min="1" value="${curHist.seasons || 1}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-slate-400 uppercase font-bold mb-1">Mecze</label><input id="adj-h-matches" type="number" min="0" value="${curHist.matches || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-emerald-400 uppercase font-bold mb-1">Wygrane</label><input id="adj-h-wins" type="number" min="0" value="${curHist.wins || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-amber-300 uppercase font-bold mb-1">Remisy</label><input id="adj-h-draws" type="number" min="0" value="${curHist.draws || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-rose-400 uppercase font-bold mb-1">Przegrane</label><input id="adj-h-losses" type="number" min="0" value="${curHist.losses || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-emerald-300 uppercase font-bold mb-1">Gole Zd.</label><input id="adj-h-gf" type="number" min="0" value="${curHist.gf || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-rose-300 uppercase font-bold mb-1">Gole St.</label><input id="adj-h-ga" type="number" min="0" value="${curHist.ga || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/15 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-amber-300 uppercase font-bold mb-1">Pkt All-Time</label><input id="adj-h-total" type="number" min="0" value="${curHist.total || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-amber-400/50 text-amber-300 font-bold"/></div>
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div><label class="block text-[10px] text-amber-300 uppercase font-bold mb-1">👑 Złote</label><input id="adj-h-gold" type="number" min="0" value="${curHist.gold || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-amber-400/40 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-slate-300 uppercase font-bold mb-1">🥈 Srebrne</label><input id="adj-h-silver" type="number" min="0" value="${curHist.silver || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-white/20 text-white font-bold"/></div>
                <div><label class="block text-[10px] text-amber-600 uppercase font-bold mb-1">🥉 Brązowe</label><input id="adj-h-bronze" type="number" min="0" value="${curHist.bronze || 0}" class="w-full px-2 py-1 rounded bg-slate-900 border border-amber-700/40 text-white font-bold"/></div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2.5">
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-xs font-bold">Anuluj</button>
          <button type="button" onclick="SMPL_APP.confirmAdminJoinAsPlayer()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-display font-black uppercase shadow-lg">
            🛡️ Zatwierdź i Dołącz do Ligi
          </button>
        </div>
      </div>
    `);
  }

  function confirmAdminJoinAsPlayer() {
    if (!requireStrictAdmin('dołączenie Admina do ligi')) return;
    const session = window.SMPL_DB.getSession();
    const leagueId = (document.getElementById('admin-join-league') || {}).value || 'L1';
    const nick = (document.getElementById('admin-join-nick') || {}).value || '';
    const clanId = (document.getElementById('admin-join-clan') || {}).value || '';
    const histMode = (document.getElementById('admin-join-hist-mode') || {}).value || 'NONE';

    try {
      const res = window.SMPL_DB.adminJoinOrLeaveLeague(
        { op: 'join', leagueId, nick, clanId },
        session.adminName || 'Szymon Komenda'
      );
      const pl = res && res.player;
      let histMsg = '';
      if (pl && histMode === 'CUSTOM') {
        const custom = {
          seasons: Number((document.getElementById('adj-h-seasons') || {}).value || 1),
          matches: Number((document.getElementById('adj-h-matches') || {}).value || 0),
          wins: Number((document.getElementById('adj-h-wins') || {}).value || 0),
          draws: Number((document.getElementById('adj-h-draws') || {}).value || 0),
          losses: Number((document.getElementById('adj-h-losses') || {}).value || 0),
          gf: Number((document.getElementById('adj-h-gf') || {}).value || 0),
          ga: Number((document.getElementById('adj-h-ga') || {}).value || 0),
          total: Number((document.getElementById('adj-h-total') || {}).value || 0),
          gold: Number((document.getElementById('adj-h-gold') || {}).value || 0),
          silver: Number((document.getElementById('adj-h-silver') || {}).value || 0),
          bronze: Number((document.getElementById('adj-h-bronze') || {}).value || 0)
        };
        const hRes = window.SMPL_DB.assignHistoricalStatsToPlayer(pl.id, { custom }, session.adminName || 'Szymon Komenda');
        histMsg = hRes ? ` + ${hRes.sourceLabel}` : '';
      } else if (pl && histMode.indexOf('PRESET:') === 0) {
        const hRes = window.SMPL_DB.assignHistoricalStatsToPlayer(pl.id, { preset: histMode.slice(7) }, session.adminName || 'Szymon Komenda');
        histMsg = hRes ? ` + ${hRes.sourceLabel}` : '';
      } else if (pl && histMode.indexOf('ARCHIVE:') === 0) {
        const hRes = window.SMPL_DB.assignHistoricalStatsToPlayer(pl.id, { archiveName: histMode.slice(8) }, session.adminName || 'Szymon Komenda');
        histMsg = hRes ? ` + ${hRes.sourceLabel}` : '';
      }
      closeModal();
      activeLeague = leagueId;
      if (pl) profileState.playerId = pl.id;
      showToast(`🛡️ Grasz teraz w ${leagueId} jako ${pl ? pl.name : 'Admin'} pod rangą ADMIN${histMsg}!`);
      renderAll();
    } catch (e) {
      showToast((e && e.message) || 'Błąd dołączania do ligi.', 'error');
    }
  }

  function openPlayerQuickJoinModal() {
    const st = window.SMPL_DB.getState();
    const winInfo = window.SMPL_DB.getSeasonJoinWindowInfo(st);
    const enabledLeagues = Object.keys(st.leagues || {}).filter(
      (id) => !(st.portalSettings && Array.isArray(st.portalSettings.disabledLeagues) && st.portalSettings.disabledLeagues.includes(id))
    );
    const joinable = (winInfo.allowedLeagues && winInfo.allowedLeagues.length > 0)
      ? enabledLeagues.filter((id) => winInfo.allowedLeagues.includes(id))
      : enabledLeagues;
    if (!winInfo.isOpen) {
      showToast('⏳ Okno zapisów jest jeszcze zamknięte przez Administrację.', 'warning');
      return;
    }
    const esc = window.SMPL_VIEWS.escapeHtml;
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-emerald-400">POCZĄTEK SEZONU • SAMODZIELNE DOŁĄCZANIE</span>
            <h3 class="font-display font-black text-lg text-white uppercase">⚡ Wybierz Ligę i Dołącz</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <div class="grid grid-cols-1 gap-2.5 mb-4">
          ${joinable.map((lg) => `
            <button type="button" onclick="SMPL_APP.handlePlayerJoinLeague('${esc(lg)}')" class="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg">
              ⚡ Dołącz do ${esc((st.leagues[lg] && st.leagues[lg].name) || lg)} (${esc(lg)})
            </button>
          `).join('')}
        </div>
        <button type="button" onclick="SMPL_APP.closeModal()" class="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold uppercase">Zamknij</button>
      </div>
    `);
  }

  function handlePlayerJoinLeague(leagueId) {
    if (!window.SMPL_DB || typeof window.SMPL_DB.playerJoinLeague !== 'function') return;
    const isHttpEnv = window.location && window.location.protocol && window.location.protocol.startsWith('http') && typeof fetch === 'function';
    try {
      const res = window.SMPL_DB.playerJoinLeague(
        leagueId,
        {},
        isHttpEnv
          ? (srvErr, srvData) => {
              if (srvErr) {
                showToast('❌ Serwer nie zapisał dołączenia: ' + srvErr, 'error');
                renderAll();
                return;
              }
              const joinedLgSrv = (srvData && srvData.leagueId) || (res && res.leagueId) || (res && res.player && res.player.leagueId) || leagueId || 'L1';
              activeLeague = joinedLgSrv;
              if (srvData && srvData.playerId) {
                profileState.playerId = srvData.playerId;
              } else if (res && res.player && res.player.id) {
                profileState.playerId = res.player.id;
              }
              activeTab = 'standings';
              if (srvData && srvData.offline) {
                showToast(`⚠️ Dołączono lokalnie do ${joinedLgSrv} (brak połączenia z serwerem)!`, 'error');
              } else {
                showToast(`⚡ Zapisano na serwerze! Dołączyłeś pomyślnie do ligi ${joinedLgSrv}.`);
              }
              renderAll();
            }
          : null
      );
      closeModal();
      const joinedLg = (res && res.leagueId) || (res && res.player && res.player.leagueId) || leagueId || 'L1';
      activeLeague = joinedLg;
      if (res && res.player && res.player.id) {
        profileState.playerId = res.player.id;
      }
      activeTab = 'standings';
      if (!isHttpEnv) {
        showToast(`⚡ Dołączyłeś pomyślnie do ligi ${joinedLg}!`);
      }
      renderAll();
    } catch (e) {
      showToast((e && e.message) || 'Nie udało się dołączyć do ligi.', 'error');
    }
  }

  function handlePlayerLeaveLeague() {
    if (!window.SMPL_DB || typeof window.SMPL_DB.playerLeaveLeague !== 'function') return;
    const isHttpEnv = window.location && window.location.protocol && window.location.protocol.startsWith('http') && typeof fetch === 'function';
    try {
      window.SMPL_DB.playerLeaveLeague(
        isHttpEnv
          ? (srvErr, srvData) => {
              if (srvErr) {
                showToast('❌ Serwer nie zapisał opuszczenia ligi: ' + srvErr, 'error');
                renderAll();
                return;
              }
              if (srvData && srvData.offline) {
                showToast('⚠️ Opuściłeś tabelę lokalnie (brak połączenia z serwerem).', 'error');
              } else {
                showToast('🚪 Zapisano na serwerze: opuściłeś tabelę ligową — Twoje konto i historia nadal czekają w puli.');
              }
              renderAll();
            }
          : null
      );
      if (!isHttpEnv) {
        showToast('🚪 Opuściłeś tabelę ligową — Twoje konto i historia nadal czekają w puli.');
      }
      renderAll();
    } catch (e) {
      showToast((e && e.message) || 'Nie udało się opuścić ligi.', 'error');
    }
  }

  function handleSetSeasonJoinWindow(isOpen) {
    if (!requireStrictAdmin('zmiana okna zapisów na start/koniec sezonu')) return;
    const session = window.SMPL_DB.getSession();
    const isHttpEnv = window.location && window.location.protocol && window.location.protocol.startsWith('http') && typeof fetch === 'function';
    try {
      window.SMPL_DB.setSeasonJoinWindow(
        Boolean(isOpen),
        {},
        session.adminName || 'Szymon Komenda',
        isHttpEnv
          ? (srvErr, srvData) => {
              if (srvErr) {
                showToast('❌ Serwer NIE zapisał zmiany okna: ' + srvErr, 'error');
                renderAll();
                return;
              }
              if (srvData && srvData.offline) {
                showToast('⚠️ Zmieniono tylko lokalnie w przeglądarce — serwer nie odpowiedział!', 'error');
              } else {
                showToast(
                  isOpen
                    ? '🟢 Zapisano na serwerze! Otwarto Początek Sezonu dla graczy — przyciski [Dołącz / Opuść] działają już dla wszystkich.'
                    : '🔴 Zapisano na serwerze! Zamknięto okno zapisów dla graczy.'
                );
              }
              renderAll();
            }
          : null
      );
      if (!isHttpEnv) {
        showToast(
          isOpen
            ? '🟢 Otwarto Początek Sezonu dla graczy — przyciski [Dołącz do ligi / Opuść ligę] są teraz aktywne!'
            : '🔴 Zamknięto okno zapisów — gracze nie mogą już samodzielnie dołączać ani opuszczać lig.'
        );
      }
      renderAll();
    } catch (e) {
      showToast((e && e.message) || 'Błąd zmiany statusu okna sezonu.', 'error');
    }
  }

  function handleClearAllTablesSeason56() {
    if (!requireStrictAdmin('czyszczenie tabel')) return;
    const st = window.SMPL_DB.getState();
    const curSeason = Number((st && st.season) || 56);
    openModal(`
      <div class="p-6">
        <h3 class="font-display font-black text-lg text-white uppercase mb-2">🧹 Czysty Start Nowego Sezonu</h3>
        <p class="text-xs text-slate-300 mb-4 leading-relaxed">
          Przygotuj portal od zera pod nowy sezon. Archiwum historyczne (S1–S55) oraz Ranking Wszech Czasów pozostaną nienaruszone.
        </p>
        <div class="space-y-3 mb-5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Numer Nowego Sezonu *</label>
            <input id="clean-season-number" type="number" min="1" max="999" value="${curSeason}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-sm text-white font-bold"/>
          </div>
          <label class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-200 cursor-pointer">
            <input id="clean-wipe-social" type="checkbox" checked class="mt-0.5 accent-amber-400"/>
            <span><strong>Usuń wszystkie dane demo bieżącego sezonu</strong> (zgłoszenia kandydatów, prośby o hasła, archiwalny log, głosy Złotej Piłki, dzienniki zdarzeń)</span>
          </label>
          <label class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-200 cursor-pointer">
            <input id="clean-wipe-blacklist" type="checkbox" checked class="mt-0.5 accent-amber-400"/>
            <span><strong>Wyczyść Czarną Listę</strong> (usuwa też przykładowe wpisy testowe na start)</span>
          </label>
          <label class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-200 cursor-pointer">
            <input id="clean-keep-master" type="checkbox" checked class="mt-0.5 accent-amber-400"/>
            <span><strong>Zostaw tylko konto Głównego Admina</strong> (Szymon Komenda — usuwa testowe konta i wnioski adminów)</span>
          </label>
        </div>
        <div class="flex justify-end gap-2.5">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.confirmCleanNewSeason()" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-display uppercase font-black shadow-lg">
            🧹 Wyczyść i Ustaw Nowy Sezon
          </button>
        </div>
      </div>
    `);
  }

  function confirmCleanNewSeason() {
    if (!requireStrictAdmin('czysty start sezonu')) return;
    const seasonInput = document.getElementById('clean-season-number');
    const wipeSocialEl = document.getElementById('clean-wipe-social');
    const wipeBlacklistEl = document.getElementById('clean-wipe-blacklist');
    const keepMasterEl = document.getElementById('clean-keep-master');
    const seasonNumber = Math.max(1, parseInt(seasonInput ? seasonInput.value : '56', 10) || 56);
    const session = window.SMPL_DB.getSession();
    window.SMPL_DB.clearAllTablesForFreshSeason56(session.adminName || 'Szymon Komenda', {
      seasonNumber: seasonNumber,
      wipeSocialAndVotes: wipeSocialEl ? wipeSocialEl.checked : true,
      wipeBlacklist: wipeBlacklistEl ? wipeBlacklistEl.checked : true,
      keepOnlyMasterAdmin: keepMasterEl ? keepMasterEl.checked : true
    });
    scheduleFilter.round = 1;
    scheduleFilter.week = 1;
    closeModal();
    showToast(`🧹 Gotowe! Ustawiono czysty Sezon ${seasonNumber} (0 graczy, 0 meczów, Tydzień 1).`);
    renderAll();
  }

  function handleClearSingleLeague(leagueId) {
    if (!requireStrictAdmin('czyszczenie dywizji')) return;
    const state = window.SMPL_DB.getState();
    const lgName = (state.leagues && state.leagues[leagueId] && state.leagues[leagueId].name) || leagueId;
    if (!confirm(`Czy na pewno chcesz wyczyścić terminarz i tabelę ligi: ${lgName}?\n\nWszyscy zawodnicy tej ligi zostaną bezpiecznie przeniesieni do Puli Graczy (POOL) z pełnym zachowaniem ich kont, haseł, trofeów i statystyk S1–S55.`)) return;
    const session = window.SMPL_DB.getSession();
    window.SMPL_DB.clearSingleLeague(leagueId, session.adminName || 'Szymon Komenda');
    showToast(`🧹 Wyczyszczono terminarz i tabelę ligi ${lgName} — zawodnicy zostali bezpiecznie przeniesieni do Puli Graczy (POOL)!`);
    renderAll();
  }

  function handleMovePlayerToLeague(playerId, targetLeagueId) {
    if (!requireStrictAdmin('przeniesienie gracza między ligami')) return;
    const session = window.SMPL_DB.getSession();
    const p = window.SMPL_DB.movePlayerToLeague(playerId, targetLeagueId, session.adminName || 'Szymon Komenda');
    showToast(`🔄 Przeniesiono gracza ${p.name} do ${targetLeagueId}!`);
    renderAll();
  }

  function handleDeletePlayer(playerId) {
    if (!requireStrictAdmin('wypisanie gracza z ligi')) return;
    const state = window.SMPL_DB.getState();
    const p = (state.players || []).find((item) => item.id === playerId);
    if (!p) return;
    const isPh = p.isPlaceholder === true;
    const promptMsg = isPh
      ? `Czy na pewno chcesz usunąć wolny slot „${p.name}” z ligi?`
      : `Czy na pewno chcesz wypisać gracza ${p.name} (@${p.nick}) z ligi i przenieść go do Puli Graczy (POOL)?\n\nKonto gracza, hasło, trofea oraz historia S1–S55 zostaną zachowane w Puli.`;
    if (!confirm(promptMsg)) return;
    const session = window.SMPL_DB.getSession();
    window.SMPL_DB.deletePlayer(playerId, session.adminName || 'Szymon Komenda');
    showToast(isPh ? `🗑️ Usunięto slot ${p.name}.` : `📦 Przeniesiono gracza ${p.name} do Puli Graczy (POOL) — konto i statystyki zachowane!`);
    renderAll();
  }

  function handleHardDeletePlayer(playerId) {
    if (!requireStrictAdmin('trwałe usunięcie konta gracza')) return;
    const state = window.SMPL_DB.getState();
    const p = (state.players || []).find((item) => item.id === playerId);
    if (!p) return;
    if (
      !confirm(
        `⚠️ UWAGA — TRWAŁE USUNIĘCIE KONTA!\n\nCzy na pewno chcesz całkowicie usunąć konto gracza ${p.name} (@${p.nick}) z bazy danych SMPL? Ta operacja usunie profil zawodnika z listy graczy (zapis w Puli rejestracji zostanie odblokowany do ponownego przypisania).`
      )
    ) {
      return;
    }
    const session = window.SMPL_DB.getSession();
    window.SMPL_DB.deletePlayer(playerId, session.adminName || 'Szymon Komenda', { hardDeleteAccount: true });
    showToast(`🗑️ Trwale usunięto konto gracza ${p.name} z bazy danych.`);
    renderAll();
  }

  function adminClearSchedule(leagueIdOrAll = 'ALL') {
    if (!requireStrictAdmin('zerowanie terminarza')) return;
    const state = window.SMPL_DB.getState();
    const target = String(leagueIdOrAll || 'ALL').trim().toUpperCase() || 'ALL';
    const currentMatches = Array.isArray(state.matches) ? state.matches : [];
    const targetMatchesCount =
      target === 'ALL'
        ? currentMatches.length
        : currentMatches.filter((m) => m && m.leagueId === target).length;

    const targetLabel =
      target === 'ALL'
        ? 'WSZYSTKIE LIGI (CA\u0141Y TERMINARZ)'
        : ((state.leagues && state.leagues[target] && state.leagues[target].name) || target);

    if (
      !confirm(
        `Czy na pewno chcesz WYZEROWA\u0106 terminarz dla: ${targetLabel}?\n\nUsuni\u0119tych zostanie ${targetMatchesCount} mecz\u00F3w (wraz z wynikami z tego terminarza), a liczba kolejek zostanie wyzerowana (0) \u2014 gotowe do nowego wygenerowania.\n\nZawodnicy, tabele historyczne S1\u2013S55 i rangi pozostaj\u0105 nietkni\u0119te.`
      )
    ) {
      return;
    }

    const session = window.SMPL_DB.getSession();
    const res = window.SMPL_DB.clearLeagueSchedule(target, session.adminName || 'Szymon Komenda');
    scheduleFilter.round = 1;
    scheduleFilter.week = 1;
    showToast(
      `\uD83D\uDDD1\uFE0F Wyzerowano terminarz (${target === 'ALL' ? 'wszystkie ligi' : target}) \u2014 usuni\u0119to ${res.removedCount} mecz\u00F3w. Mo\u017Cesz wygenerowa\u0107 nowy terminarz!`
    );
    renderAll();
  }

  function adminRecalculateAllHistoricalStats() {
    if (!requireStrictAdmin('przeliczenie pe\u0142nych statystyk historycznych')) return;
    const session = window.SMPL_DB.getSession();
    const res = window.SMPL_DB.adminRecalculateAllHistoricalStats(session.adminName || 'Szymon Komenda');
    showToast(
      `\uD83D\uDD04 Przeliczono pe\u0142ne statystyki S1\u2013S55+: ${res.careerCount} graczy w Karierze L1\u2013L9, ${res.allTimeCount} w Ekstraklasie All-Time (zaktualizowano ${res.updatedPlayers} profili)!`
    );
    renderAll();
  }

  function adminRegenerateSchedule(leagueId, preservePlayed) {
    if (!requireStrictAdmin('generowanie terminarza')) return;
    const session = window.SMPL_DB.getSession();
    const generated = window.SMPL_DB.generateLeagueSchedule(leagueId, preservePlayed, session.adminName || 'Szymon Komenda');
    const maxR = generated.reduce((acc, m) => Math.max(acc, Number((m && m.round) || 1)), 1);
    showToast(`🗓️ Wygenerowano terminarz „Każdy z każdym” (${maxR} kolejek dwumeczów, ${generated.length} spotkań) dla ligi ${leagueId}!`);
    renderAll();
  }

  function adminAddByeSlot(leagueId) {
    if (!requireStrictAdmin('dodanie slotu WOLNY LOS')) return;
    const session = window.SMPL_DB.getSession();
    const added = window.SMPL_DB.addByeSlotPlayer(leagueId, session.adminName || 'Szymon Komenda');
    showToast(`🤖 Dodano slot ${added.name} do ligi ${leagueId}. Wygeneruj lub przelicz terminarz, aby nadać automatyczne 2:0 / 0:2 WO!`);
    renderAll();
  }

  function handleCustomCrestUpload(leagueId, event) {
    if (!requireStrictAdmin('zmiana herbu ligi')) return;
    const session = window.SMPL_DB.getSession();
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    fileToDataUrl(file, 500).then((dataUrl) => {
      window.SMPL_DB.setCustomCrest(leagueId, dataUrl, session.adminName || 'Szymon Komenda');
      showToast(`🛡️ Zaktualizowano herb ligowy dla ${leagueId}!`);
      renderAll();
    });
  }

  function exportDatabaseJson() {
    if (!requireStrictAdmin('eksport bazy danych')) return;
    const state = window.SMPL_DB.getState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ScoreMatchLiga_BazaDanych_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Wyeksportowano pełną bazę danych Score Match Liga do pliku JSON.');
  }

  function resetSeedConfirm() {
    if (!requireStrictAdmin('przywrócenie bazy startowej')) return;
    if (!confirm('Czy na pewno chcesz przywrócić początkową bazę z arkusza Excel pod Sezon 56 (wraz z 4 kandydatami w poczekalni)?')) return;
    window.SMPL_DB.resetDatabaseToSeed();
    showToast('🔄 Przywrócono pełną bazę startową z arkusza Excel pod Sezon 56!');
    renderAll();
  }

  function handleStartFreshSeason56() {
    if (!requireStrictAdmin('zerowanie sezonu')) return;
    const st = window.SMPL_DB.getState();
    const curS = Number((st && st.season) || 56);
    if (!confirm(`Czy chcesz wyzerować wszystkie tabele (0:0) i kartki w bieżącym Sezonie ${curS} pod 1. kolejkę?`)) return;
    const session = window.SMPL_DB.getSession();
    window.SMPL_DB.startFreshSeason56(session.adminName || 'Szymon Komenda');
    scheduleFilter.round = 1;
    scheduleFilter.week = 1;
    const activeLbls = window.SMPL_DB.getActiveLeagueIds ? window.SMPL_DB.getActiveLeagueIds(st).join('/') : 'L1/L2';
    showToast(`🚀 Wyzerowano Sezon ${curS}! Wszystkie tabele (${activeLbls}) mają 0:0 i są gotowe na 1. kolejkę!`);
    renderAll();
  }

  function openAddLeagueModal(presetId) {
    if (!requireStrictAdmin('dodania lub włączenia kolejnej ligi')) return;
    const st = window.SMPL_DB.getState();
    const allLeagues = window.SMPL_DB.getLeaguesList ? window.SMPL_DB.getLeaguesList(st, true) : [];
    const hiddenLeagues = allLeagues.filter((lg) => !lg.enabled);
    const suggestion = presetId && window.SMPL_DB.getDefaultLeaguePreset
      ? ((st && st.leagues && st.leagues[presetId]) || window.SMPL_DB.getDefaultLeaguePreset(presetId))
      : window.SMPL_DB.getNextLeagueSuggestion(st);

    const previewCrest = window.SMPL_MEDIA && typeof window.SMPL_MEDIA.getDefaultCrest === 'function'
      ? window.SMPL_MEDIA.getDefaultCrest(suggestion.id, suggestion)
      : (window.SMPL_MEDIA && window.SMPL_MEDIA.DEFAULT_CRESTS[suggestion.id]) || '';

    const nextNum = allLeagues.reduce((acc, l) => Math.max(acc, window.SMPL_DB.getLeagueNumber(l.id)), 3) + 1;
    const nextBrandNewId = 'L' + nextNum;

    const quickChoices = [];
    hiddenLeagues.forEach((lg) => {
      quickChoices.push({ id: lg.id, label: (lg.id === 'L3' ? '🥉 Włącz ' : '🔓 Włącz ') + lg.id + ' (' + (lg.shortName || lg.name) + ')' });
    });
    if (!quickChoices.some((q) => q.id === nextBrandNewId)) {
      quickChoices.push({ id: nextBrandNewId, label: '🏟️ Nowa dywizja ' + nextBrandNewId + ' (' + nextNum + '. Liga)' });
    }

    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <div class="text-[11px] font-display uppercase font-bold text-emerald-300">Rozbudowa Rozgrywek SMPL</div>
            <h3 class="font-display font-black text-xl text-white uppercase mt-0.5">🏟️ Dodaj / Włącz Następną Ligę</h3>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <p class="text-xs text-slate-300 mb-4 leading-relaxed">
          Gdy zbierze się odpowiednia liczba graczy, możesz jednym kliknięciem uruchomić ukrytą <strong>3. Ligę (L3)</strong> lub utworzyć zupełnie nową dywizję (np. <strong>${window.SMPL_VIEWS.escapeHtml(nextBrandNewId)}</strong>). Nowa liga dostanie własną tabelę, terminarz, karty statystyk i herb!
        </p>

        ${
          quickChoices.length > 0
            ? `<div class="mb-4 p-3 rounded-xl bg-slate-950/90 border border-white/10">
                <div class="text-[10px] font-display font-bold uppercase text-slate-400 mb-2">Szybki wybór dywizji:</div>
                <div class="flex flex-wrap gap-2">
                  ${quickChoices
                    .map(
                      (qc) => `<button type="button" onclick="SMPL_APP.selectAddLeaguePreset('${window.SMPL_VIEWS.escapeHtml(qc.id)}')" class="px-3 py-1.5 rounded-lg text-xs font-display font-bold uppercase transition ${
                        suggestion.id === qc.id
                          ? 'bg-emerald-600 text-white border border-emerald-400/50 shadow-lg'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
                      }">${window.SMPL_VIEWS.escapeHtml(qc.label)}</button>`
                    )
                    .join('')}
                </div>
              </div>`
            : ''
        }

        <div class="flex items-center gap-4 mb-4 p-3 rounded-xl bg-slate-950/90 border border-white/10">
          <img id="add-league-crest-preview" src="${previewCrest}" class="w-16 h-20 object-contain shrink-0" alt="Herb ligi"/>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-display font-bold text-white uppercase">Podgląd Herbu: <span id="add-league-id-badge">${window.SMPL_VIEWS.escapeHtml(suggestion.id)}</span></div>
            <div class="text-[11px] text-slate-400 mt-0.5">Tarcza generuje się automatycznie na podstawie kodu i kolorów ligi (możesz później wgrać własny obrazek w Ustawieniach).</div>
          </div>
        </div>

        <div class="space-y-3 mb-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Kod Ligi (np. L3, L4) *</label>
              <input id="add-league-id" type="text" value="${window.SMPL_VIEWS.escapeHtml(suggestion.id)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-bold uppercase"/>
            </div>
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Krótka nazwa na kafelku *</label>
              <input id="add-league-short" type="text" value="${window.SMPL_VIEWS.escapeHtml(suggestion.shortName || suggestion.id)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-bold"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Pełna oficjalna nazwa ligi *</label>
            <input id="add-league-name" type="text" value="${window.SMPL_VIEWS.escapeHtml(suggestion.name)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-bold"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Opis / Podtytuł (opcjonalnie)</label>
            <input id="add-league-subtitle" type="text" value="${window.SMPL_VIEWS.escapeHtml(suggestion.subtitle || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-200"/>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Kolor Główny</label>
              <input id="add-league-primary" type="color" value="${window.SMPL_VIEWS.escapeHtml(suggestion.primaryColor || '#CD7F32')}" class="w-full rounded-xl bg-slate-950 border border-white/15 cursor-pointer" style="height:40px;"/>
            </div>
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Kolor Akcentu</label>
              <input id="add-league-secondary" type="color" value="${window.SMPL_VIEWS.escapeHtml(suggestion.secondaryColor || '#27272A')}" class="w-full rounded-xl bg-slate-950 border border-white/15 cursor-pointer" style="height:40px;"/>
            </div>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Opiekun / Administrator Ligi</label>
            <input id="add-league-admin" type="text" value="${window.SMPL_VIEWS.escapeHtml(suggestion.adminName || 'Szymon Komenda & Zarząd SMPL')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-slate-200"/>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-2.5">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.confirmAddLeague()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-display uppercase font-black shadow-lg">
            🚀 Włącz / Utwórz Ligę Teraz
          </button>
        </div>
      </div>
    `);
  }

  function selectAddLeaguePreset(leagueId) {
    if (!requireStrictAdmin('wyboru szablonu ligi')) return;
    openAddLeagueModal(leagueId);
  }

  function confirmAddLeague() {
    if (!requireStrictAdmin('dodania lub włączenia kolejnej ligi')) return;
    const idVal = String((document.getElementById('add-league-id') && document.getElementById('add-league-id').value) || '').trim().toUpperCase();
    const shortVal = String((document.getElementById('add-league-short') && document.getElementById('add-league-short').value) || '').trim();
    const nameVal = String((document.getElementById('add-league-name') && document.getElementById('add-league-name').value) || '').trim();
    const subVal = String((document.getElementById('add-league-subtitle') && document.getElementById('add-league-subtitle').value) || '').trim();
    const primVal = String((document.getElementById('add-league-primary') && document.getElementById('add-league-primary').value) || '#CD7F32').trim();
    const secVal = String((document.getElementById('add-league-secondary') && document.getElementById('add-league-secondary').value) || '#27272A').trim();
    const adminVal = String((document.getElementById('add-league-admin') && document.getElementById('add-league-admin').value) || '').trim();

    if (!idVal || !nameVal) {
      showToast('Podaj kod ligi (np. L3 lub L4) oraz nazwę ligi.', 'error');
      return;
    }

    try {
      const session = window.SMPL_DB.getSession();
      const created = window.SMPL_DB.adminCreateOrEnableLeague(
        {
          id: idVal,
          name: nameVal,
          shortName: shortVal || idVal,
          subtitle: subVal,
          primaryColor: primVal,
          secondaryColor: secVal,
          adminName: adminVal
        },
        session.adminName || 'Szymon Komenda'
      );
      activeLeague = created.id;
      submitFormState.leagueId = created.id;
      closeModal();
      showToast(`🏟️ Aktywowano ligę: ${created.name} (${created.id})! Możesz już dodawać graczy i wygenerować terminarz.`);
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd tworzenia ligi.', 'error');
    }
  }

  function handleToggleLeagueEnabled(leagueId, enabled) {
    if (!requireStrictAdmin('zmiany widoczności ligi')) return;
    const session = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.adminToggleLeagueEnabled(leagueId, enabled, session.adminName || 'Szymon Komenda');
      if (!res.enabled && activeLeague === res.id) {
        activeLeague = 'L2';
      } else if (res.enabled) {
        activeLeague = res.id;
      }
      showToast(
        res.enabled
          ? `✅ Włączono ligę ${res.name} (${res.id})!`
          : `🙈 Ukryto ligę ${res.name} (${res.id}) z widoków publicznych.`
      );
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie można zmienić statusu ligi.', 'error');
    }
  }

  function openNextSeasonRolloverModal() {
    if (!requireStrictAdmin('uruchomienie kolejnego sezonu')) return;
    const st = window.SMPL_DB.getState();
    const curSeason = Number((st && st.season) || 56);
    const nextSeason = curSeason + 1;
    const players = (st && st.players) || [];
    const activeLeaguesList = window.SMPL_DB.getLeaguesList ? window.SMPL_DB.getLeaguesList(st, false) : [];
    const rolloverCountsSummary = activeLeaguesList
      .map((lg) => `${window.SMPL_VIEWS.escapeHtml(lg.id)}: <strong>${players.filter((p) => p.leagueId === lg.id && p.active !== false).length}</strong>`)
      .join(', ');
    const pendingMatches = ((st && st.matches) || []).filter((m) => m.status === 'PENDING').length;

    openModal(`
      <div class="p-6">
        <div class="text-xs font-display uppercase font-bold text-amber-400 mb-1">Automatyzacja Zarządu SMPL • 1-Klik</div>
        <h3 class="font-display font-black text-xl text-white uppercase mb-2">🚀 Koniec Sezonu ${curSeason} ➔ Start Sezonu ${nextSeason}</h3>
        <p class="text-xs text-slate-300 mb-4 leading-relaxed">
          Jednym kliknięciem zamkniesz <strong>Sezon ${curSeason}</strong> i automatycznie otworzysz <strong>Sezon ${nextSeason}</strong> z nowym terminarzem (Każdy z każdym) dla aktywnych graczy (${rolloverCountsSummary}).
        </p>
        ${pendingMatches > 0 ? `
          <div class="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-200 font-bold mb-4">
            ⏳ Uwaga: masz jeszcze ${pendingMatches} oczekujących wyników do kliknięcia w kolejce! Możesz je najpierw zatwierdzić albo przejść od razu dalej.
          </div>
        ` : ''}
        <div class="space-y-3 mb-5">
          <label class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-200 cursor-pointer">
            <input id="rollover-archive" type="checkbox" checked class="mt-0.5 accent-amber-400"/>
            <span><strong>📦 Zapisz Sezon ${curSeason} do Archiwum, statystyk karier i rozdaj medale (👑🥈🥉)</strong><br/><span class="text-slate-400">Tabela, mistrzowie i mecze Sezonu ${curSeason} trafią do Profili Graczy oraz Rankingu Wszech Czasów bez dublowania.</span></span>
          </label>
          <label class="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-slate-200 cursor-pointer">
            <input id="rollover-promotions" type="checkbox" checked class="mt-0.5 accent-amber-400"/>
            <span><strong>↕️ Automatyczne awanse i spadki między ligami (Top 2 w górę / Ostatnich 2 w dół)</strong><br/><span class="text-slate-400">Działa automatycznie między ligami, które mają min. 4 graczy i rozegrane mecze w Sezonie ${curSeason}.</span></span>
          </label>
        </div>
        <div class="flex flex-wrap justify-end gap-2.5">
          <button onclick="SMPL_APP.closeModal()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
          <button onclick="SMPL_APP.confirmNextSeasonRollover()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-display uppercase font-black shadow-lg">
            🚀 TAK — WYSTARTUJ SEZON ${nextSeason} TERAZ!
          </button>
        </div>
      </div>
    `);
  }

  function confirmNextSeasonRollover() {
    if (!requireStrictAdmin('start nowego sezonu')) return;
    const archiveEl = document.getElementById('rollover-archive');
    const promoEl = document.getElementById('rollover-promotions');
    const archiveOldSeason = archiveEl ? archiveEl.checked : true;
    const applyPromotions = promoEl ? promoEl.checked : true;
    const session = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.startNextSeasonRollover(
        {
          archiveOldSeason: archiveOldSeason,
          applyPromotions: applyPromotions
        },
        session.adminName || 'Szymon Komenda'
      );
      scheduleFilter.round = 1;
      scheduleFilter.week = 1;
      closeModal();
      const promoCount = (res.movesSummary && res.movesSummary.length) || 0;
      showToast(
        `🚀 Sezon ${res.nextSeason} WYSTARTOWAŁ! Zamknięto Sezon ${res.finishedSeason}, wygenerowano ${res.matchCount} meczów${promoCount > 0 ? ' i wykonano ' + promoCount + ' awansów/spadków' : ''}!`
      );
      renderAll();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function handleRestoreExcelState() {
    if (!requireStrictAdmin('przywrócenie stanu z Excela')) return;
    const session = window.SMPL_DB.getSession();
    window.SMPL_DB.restoreExcelSeason55State(session.adminName || 'Szymon Komenda');
    scheduleFilter.round = 2;
    scheduleFilter.week = 1;
    showToast('📊 Przywrócono dokładny stan tabeli z przesłanego arkusza Excel (6 rozegranych meczów w Ekstraklasie)!');
    renderAll();
  }

  // =========================================================================
  // MODALE: LIGHTBOX SCREENÓW, PROFIL GRACZA, WYBÓR GRACZA
  // =========================================================================
  function openModal(htmlContent, maxWidthClass) {
    closeRankTooltip();
    const modalRoot = document.getElementById('global-modal-root');
    if (!modalRoot) return;
    const widthCls = maxWidthClass || 'max-w-xl';
    modalRoot.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md" onclick="SMPL_APP.closeModal()">
        <div class="glass-panel rounded-3xl ${widthCls} w-full max-h-[90vh] overflow-y-auto border border-white/20 shadow-2xl" onclick="event.stopPropagation()">
          ${htmlContent}
        </div>
      </div>
    `;
  }

  function stopOnboardingTutorialVideo() {
    const vid = document.getElementById('smpl-onboarding-tutorial-video');
    if (vid) {
      try {
        vid.pause();
      } catch (e) {}
    }
  }

  function closeModal() {
    stopOnboardingTutorialVideo();
    const dlg = document.getElementById('smpl-tutorial-dialog');
    if (dlg && dlg.open && typeof dlg.close === 'function') {
      try {
        dlg.close();
      } catch (e) {}
    }
    const modalRoot = document.getElementById('global-modal-root');
    if (modalRoot) modalRoot.innerHTML = '';
  }

  function escapeTutorialHtml(str) {
    if (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.escapeHtml === 'function') {
      return window.SMPL_VIEWS.escapeHtml(str);
    }
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function updateOnboardingTutorialChapterHighlight(currentSec) {
    const t = Number(currentSec) || 0;
    let activeIdx = 0;
    for (let i = 0; i < TUTORIAL_CHAPTERS.length; i++) {
      if (t + 0.25 >= TUTORIAL_CHAPTERS[i].time) activeIdx = i;
    }
    const ch = TUTORIAL_CHAPTERS[activeIdx] || TUTORIAL_CHAPTERS[0];
    for (let j = 0; j < TUTORIAL_CHAPTERS.length; j++) {
      const btn = document.getElementById('smpl-tut-ch-btn-' + TUTORIAL_CHAPTERS[j].num);
      if (btn) {
        if (j === activeIdx) btn.classList.add('is-active');
        else btn.classList.remove('is-active');
      }
    }
    const nowEl = document.getElementById('smpl-tut-now-playing');
    if (nowEl && ch) {
      nowEl.innerHTML = '<span>Rozdział <strong>' + ch.num + '/9 • ' + escapeTutorialHtml(ch.title) + '</strong> — ' + escapeTutorialHtml(ch.desc) + '</span>'
        + '<span style="color:#94a3b8;font-size:10.5px;white-space:nowrap;">Czas: ' + escapeTutorialHtml(ch.stamp) + ' / 4:20</span>';
    }
  }

  function openOnboardingTutorialModal(opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const playerName = options.playerName ? String(options.playerName).trim() : '';
    const isAutoFirstTime = Boolean(options.isAutoFirstTime);
    const isStandaloneReg = window.SMPL_FORCED_TAB === 'register';

    closeRankTooltip();
    stopOnboardingTutorialVideo();
    const modalRoot = document.getElementById('global-modal-root');
    if (!modalRoot) return;

    const existingDlg = document.getElementById('smpl-tutorial-dialog');
    if (existingDlg && existingDlg.open && typeof existingDlg.close === 'function') {
      try { existingDlg.close(); } catch (e) {}
    }

    const firstName = playerName ? playerName.split(/\s+/)[0] : '';
    const headingText = isAutoFirstTime && firstName
      ? ('Witamy w SMPL, ' + firstName + '! Poradnik Świeżaka od A do Z')
      : 'Oficjalny Poradnik Świeżaka SMPL — Wszystko od A do Z';
    const subtitleText = isAutoFirstTime
      ? 'Twoje konto jest już utworzone! Obejrzyj 4-minutowy przewodnik z lektorem po wszystkich zakładkach, meczach, Karcie UT, konkursach i zasadach ligi.'
      : 'Kompletny przewodnik wideo HD (4:20) z lektorem po każdej funkcji portalu Score Match Polska Liga — kliknij dowolny rozdział, aby przeskoczyć.';

    const chaptersHtml = TUTORIAL_CHAPTERS.map(function (ch, idx) {
      return (
        '<button type="button" id="smpl-tut-ch-btn-' + ch.num + '" class="smpl-tutorial-ch-btn' + (idx === 0 ? ' is-active' : '') + '"'
        + ' onclick="SMPL_APP.seekOnboardingTutorial(' + ch.time + ')" title="' + escapeTutorialHtml(ch.desc) + '">'
        + '<span class="smpl-tutorial-ch-stamp">' + escapeTutorialHtml(ch.stamp) + '</span>'
        + '<span class="smpl-tutorial-ch-label">' + ch.num + '. ' + escapeTutorialHtml(ch.title) + '</span>'
        + '</button>'
      );
    }).join('');

    const firstCh = TUTORIAL_CHAPTERS[0];
    const portalLinkHtml = isStandaloneReg
      ? '<a href="./index.html" class="smpl-tutorial-cta-secondary">🏆 Portal Główny</a>'
      : '';

    modalRoot.innerHTML =
      '<dialog id="smpl-tutorial-dialog" class="smpl-tutorial-dialog" aria-labelledby="smpl-tutorial-title" closedby="any">'
      + '<div class="smpl-tutorial-header">'
        + '<div style="min-width:0;">'
          + '<span class="smpl-tutorial-badge">🎬 PORADNIK ŚWIEŻAKA • LEKTOR PL • 4:20 HD</span>'
          + '<h2 id="smpl-tutorial-title" class="smpl-tutorial-title">' + escapeTutorialHtml(headingText) + '</h2>'
          + '<p class="smpl-tutorial-subtitle">' + escapeTutorialHtml(subtitleText) + '</p>'
        + '</div>'
        + '<form method="dialog" style="margin:0;">'
          + '<button type="submit" value="close" autofocus class="smpl-tutorial-close-btn" aria-label="Zamknij poradnik wideo" title="Zamknij (Esc)">✕</button>'
        + '</form>'
      + '</div>'
      + '<div class="smpl-tutorial-body">'
        + '<div class="smpl-tutorial-stage">'
          + '<video id="smpl-onboarding-tutorial-video" class="smpl-tutorial-video" controls playsinline preload="metadata"'
            + ' poster="./media/smpl-tutorial-poster.jpg?v=' + TUTORIAL_MEDIA_VER + '">'
            + '<source src="./media/smpl-tutorial-swiezaka.mp4?v=' + TUTORIAL_MEDIA_VER + '" type="video/mp4">'
            + 'Twoja przeglądarka nie obsługuje odtwarzacza wideo HTML5.'
          + '</video>'
          + '<button type="button" id="smpl-tut-play-overlay" class="smpl-tutorial-play-overlay" style="display:none;"'
            + ' onclick="SMPL_APP.playOnboardingTutorialFromOverlay()" aria-label="Odtwórz poradnik z lektorem">'
            + '<span class="smpl-tutorial-play-cta">▶ ODTWÓRZ Z LEKTOREM (4:20)</span>'
            + '<span class="smpl-tutorial-play-hint">🔊 Kliknij, aby włączyć film z pełnym głosem lektora</span>'
          + '</button>'
        + '</div>'
        + '<div id="smpl-tut-now-playing" class="smpl-tutorial-nowbar">'
          + '<span>Rozdział <strong>1/9 • ' + escapeTutorialHtml(firstCh.title) + '</strong> — ' + escapeTutorialHtml(firstCh.desc) + '</span>'
          + '<span style="color:#94a3b8;font-size:10.5px;white-space:nowrap;">Czas: 0:00 / 4:20</span>'
        + '</div>'
        + '<div class="smpl-tutorial-chapters-grid" aria-label="Rozdziały poradnika">'
          + chaptersHtml
        + '</div>'
        + '<div class="smpl-tutorial-footer">'
          + '<div class="smpl-tutorial-once-note">'
            + '<strong>🔒 Otwiera się automatycznie tylko raz</strong> — nigdy więcej nie wyskoczy po odświeżeniu ani logowaniu. '
            + 'Gdybyś chciał wrócić, znajdziesz go w <strong>Menu → Poradnik Świeżaka</strong> oraz w zakładce <strong>Regulamin</strong>.'
          + '</div>'
          + '<div class="smpl-tutorial-actions">'
            + portalLinkHtml
            + '<form method="dialog" style="margin:0;">'
              + '<button type="submit" value="done" class="smpl-tutorial-cta-primary">✅ Wszystko jasne — Wchodzę do Ligi</button>'
            + '</form>'
          + '</div>'
        + '</div>'
      + '</div>'
      + '</dialog>';

    const dlg = document.getElementById('smpl-tutorial-dialog');
    const vid = document.getElementById('smpl-onboarding-tutorial-video');
    const overlay = document.getElementById('smpl-tut-play-overlay');

    if (dlg) {
      if (typeof dlg.showModal === 'function') {
        try {
          dlg.showModal();
        } catch (e) {
          dlg.setAttribute('open', 'open');
        }
      } else {
        dlg.setAttribute('open', 'open');
      }
      dlg.scrollTop = 0;

      // Fallback light-dismiss dla przeglądarek bez natywnego <dialog closedby="any"> (np. Safari)
      if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
        const isOutsideDialog = function (ev) {
          const r = dlg.getBoundingClientRect();
          return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
        };
        let pressedOutside = false;
        dlg.addEventListener('pointerdown', function (ev) {
          pressedOutside = isOutsideDialog(ev);
        });
        dlg.addEventListener('pointerup', function (ev) {
          if (pressedOutside && isOutsideDialog(ev)) {
            closeOnboardingTutorialModal();
          }
          pressedOutside = false;
        });
      }

      dlg.addEventListener('close', function () {
        dlg.returnValue = '';
        stopOnboardingTutorialVideo();
        const rootNow = document.getElementById('global-modal-root');
        if (rootNow && rootNow.contains(dlg)) {
          rootNow.innerHTML = '';
        }
      });
    }

    if (vid) {
      vid.addEventListener('play', function () {
        if (overlay) overlay.style.display = 'none';
      });
      vid.addEventListener('timeupdate', function () {
        updateOnboardingTutorialChapterHighlight(vid.currentTime);
      });
      vid.addEventListener('error', function () {
        const nowEl = document.getElementById('smpl-tut-now-playing');
        if (nowEl) {
          nowEl.innerHTML = '<span style="color:#fda4af;">⚠️ Nie udało się wczytać pliku wideo poradnika — sprawdź połączenie z internetem lub odśwież stronę (Ctrl+F5).</span>';
        }
      });
      try {
        const playPromise = vid.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(function () {
            if (overlay) overlay.style.display = 'none';
          }).catch(function () {
            if (overlay) overlay.style.display = 'flex';
          });
        }
      } catch (e) {
        if (overlay) overlay.style.display = 'flex';
      }
    }
  }

  function playOnboardingTutorialFromOverlay() {
    const vid = document.getElementById('smpl-onboarding-tutorial-video');
    const overlay = document.getElementById('smpl-tut-play-overlay');
    if (overlay) overlay.style.display = 'none';
    if (vid) {
      try {
        vid.muted = false;
        const p = vid.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function () {});
        }
      } catch (e) {}
    }
  }

  function seekOnboardingTutorial(seconds) {
    const targetSec = Math.max(0, Number(seconds) || 0);
    const vid = document.getElementById('smpl-onboarding-tutorial-video');
    const overlay = document.getElementById('smpl-tut-play-overlay');
    updateOnboardingTutorialChapterHighlight(targetSec);
    if (!vid) return;
    if (overlay) overlay.style.display = 'none';
    const applySeek = function () {
      try {
        vid.currentTime = targetSec;
        vid.muted = false;
        const p = vid.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (e) {}
    };
    if (vid.readyState >= 1) {
      applySeek();
    } else {
      vid.addEventListener('loadedmetadata', function onMeta() {
        vid.removeEventListener('loadedmetadata', onMeta);
        applySeek();
      });
      try { vid.load(); } catch (e) {}
    }
  }

  function closeOnboardingTutorialModal() {
    stopOnboardingTutorialVideo();
    const dlg = document.getElementById('smpl-tutorial-dialog');
    if (dlg && dlg.open && typeof dlg.close === 'function') {
      try {
        dlg.close('done');
        return;
      } catch (e) {}
    }
    const modalRoot = document.getElementById('global-modal-root');
    if (modalRoot) modalRoot.innerHTML = '';
  }

  // =========================================================================
  // ASYSTENTKA AI VANESSA — WIDGET POMOCY + SAMOUCZENIE NA ŻYWO
  // =========================================================================
  function ensureAiGreeting(stateOverride, sessionOverride) {
    if (aiWidgetState.messages.length === 0) {
      const st = stateOverride || (window.SMPL_DB && window.SMPL_DB.getState ? window.SMPL_DB.getState() : null);
      const sess = sessionOverride || (window.SMPL_DB && window.SMPL_DB.getSession ? window.SMPL_DB.getSession() : null);
      const curPl = (st && Array.isArray(st.players) && sess && sess.activePlayerId)
        ? st.players.find(function (p) { return p && p.id === sess.activePlayerId; })
        : null;

      const showClans = isClansUiEnabledSafe(stateOverride);
      let title = 'Cześć! Jestem Vanessa AI ⚡';
      let text = showClans
        ? 'Jestem Twoją osobistą przewodniczką po **Score Match Liga**!\n'
          + '1️⃣ **Zapisy & Klan**: Kliknij `📝 Otwórz Zapisy`, wybierz klan albo wgraj własne logo klanu.\n'
          + '2️⃣ **Mecze**: W `📅 Terminarz` sprawdzisz rywala i napiszesz przez `💬 Napisz na Messengerze` lub `📅 Kiedy Gramy?`.\n'
          + '3️⃣ **Wynik & Karta UT**: Zagraj mecz towarzyski w *Score! Match* i wyślij screena w `➕ Wynik`!\n'
          + 'Zapytaj mnie o cokolwiek — tabele, zasady, walkowery, RODO albo jak zacząć!'
        : 'Jestem Twoją osobistą przewodniczką po **Score Match Liga**!\n'
          + '1️⃣ **Zapisy**: Kliknij `📝 Otwórz Zapisy`, uzupełnij profil gracza i odbierz własną Kartę UT.\n'
          + '2️⃣ **Mecze**: W `📅 Terminarz` sprawdzisz rywala i napiszesz przez `💬 Napisz na Messengerze` lub `📅 Kiedy Gramy?`.\n'
          + '3️⃣ **Wynik & Karta UT**: Zagraj mecz towarzyski w *Score! Match* i wyślij screena w `➕ Wynik`!\n'
          + 'Zapytaj mnie o cokolwiek — tabele, zasady, walkowery, RODO albo jak zacząć!';

      if (sess && sess.isAdminAuthenticated) {
        title = 'Witaj Szefie (' + (sess.adminName || 'Admin') + ') ⚡';
        text = showClans
          ? 'Silnik Gemini AI i Baza Wiedzy SMPL są gotowe. Pomagam nowym graczom z zapisami, klanami, terminarzem i wynikami na żywo — w każdej chwili możesz też uczyć mnie nowych odpowiedzi w zakładce Admin ➔ AI Vanessa.'
          : 'Silnik Gemini AI i Baza Wiedzy SMPL są gotowe. Pomagam nowym graczom z zapisami, terminarzem i wynikami na żywo — w każdej chwili możesz też uczyć mnie nowych odpowiedzi w zakładce Admin ➔ AI Vanessa.';
      } else if (curPl) {
        const clanPart = (showClans && curPl.clanName) ? (' (' + (curPl.clanTag ? '[' + curPl.clanTag + '] ' : '') + curPl.clanName + ')') : '';
        title = 'Cześć ' + curPl.name + '! Jestem Vanessa AI ⚡';
        text = 'Grasz w dywizji **' + (curPl.leagueId || 'L2') + '**' + clanPart + '. Mogę sprawdzić Twoje najbliższe mecze, pozycję w tabeli, zasady 4 kolejek/tydzień, wrzucanie screena wyniku czy rozwój **Karty UT & Złotej Piłki**. O co chcesz zapytać?';
      }

      aiWidgetState.messages.push({
        id: 'AI_WELCOME_1',
        role: 'BOT',
        title: title,
        text: text,
        interactionId: null,
        rating: null
      });
    }
  }

  function formatAiMessageHtml(rawText, escFn) {
    const escaped = escFn(String(rawText == null ? '' : rawText));
    return escaped
      .replace(/\*\*([^*\n]{1,160})\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/`([^`\n]{1,120})`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-900 text-pink-300 font-semibold">$1</code>')
      .replace(/\r?\n/g, '<br/>');
  }

  function refreshAiEngineStatus(shouldRenderWidget) {
    if (!window.SMPL_DB || typeof window.SMPL_DB.getAiStatus !== 'function') return;
    window.SMPL_DB.getAiStatus().then(function (st) {
      if (st && st.ok) {
        const changed = aiWidgetState.geminiReady !== Boolean(st.geminiReady) || aiWidgetState.activeModel !== (st.model || 'gemini-3.8-flash');
        aiWidgetState.geminiReady = Boolean(st.geminiReady);
        aiWidgetState.activeModel = st.model || 'gemini-3.8-flash';
        if (changed && shouldRenderWidget !== false) {
          renderAiAssistantWidget();
        }
      }
    });
  }

  function resetAiConversation() {
    aiWidgetState.messages = [];
    aiWidgetState.isTyping = false;
    ensureAiGreeting();
    renderAiAssistantWidget();
    showToast('🔄 Rozpoczęto nową rozmowę z Vanessą AI.');
  }

  function renderAiAssistantWidget(stateOverride, sessionOverride) {
    let root = document.getElementById('smpl-ai-widget-root');
    if (!root) return;
    if (!window.SMPL_AI) {
      root.innerHTML = '';
      return;
    }

    const esc = (window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml)
      ? window.SMPL_VIEWS.escapeHtml
      : function (s) { return String(s == null ? '' : s); };

    if (window.SMPL_DB && typeof window.SMPL_DB.getAiStatusCached === 'function') {
      const cachedAi = window.SMPL_DB.getAiStatusCached();
      if (cachedAi && cachedAi.checked) {
        aiWidgetState.geminiReady = Boolean(cachedAi.geminiReady);
        if (cachedAi.model) aiWidgetState.activeModel = cachedAi.model;
      }
    }

    ensureAiGreeting(stateOverride, sessionOverride);
    const state = stateOverride || window.SMPL_DB.getState();
    const session = sessionOverride || window.SMPL_DB.getSession();
    const pendingAiCount = session && session.isAdminAuthenticated
      ? (state.aiUnansweredQueue || []).filter((q) => q && q.status === 'PENDING').length
      : 0;
    const learnedCount = (state.aiKnowledge || []).length;
    const quickPrompts = window.SMPL_AI.getQuickPrompts(state);
    const onboardingActions = typeof window.SMPL_AI.getOnboardingActions === 'function'
      ? window.SMPL_AI.getOnboardingActions(state, session)
      : [];

    if (!aiWidgetState.isOpen) {
      if (!isAiFabVisibleNow() || (typeof document !== 'undefined' && document.body && document.body.classList.contains('smpl-gate-locked'))) {
        root.innerHTML = '';
        return;
      }
      root.innerHTML = `
        <div class="smpl-ai-fab-wrap">
          <button
            type="button"
            onclick="SMPL_APP.openAiAssistant()"
            class="smpl-ai-fab"
            title="Zapytaj Asystentkę AI Vanessę o pomoc na stronie lub w apce"
          >
            <img src="${window.SMPL_WOW && typeof window.SMPL_WOW.isOverhaulEnabled === 'function' && window.SMPL_WOW.isOverhaulEnabled() ? './img/wow-vanessa-ai.jpg' : './img/vanessa-ai-emblem.jpg'}" class="smpl-ai-fab-photo" alt="Vanessa AI"/>
            <span class="font-display font-black text-xs uppercase">${aiWidgetState.geminiReady ? 'Vanessa AI' : 'Pomoc AI'}</span>
            ${
              pendingAiCount > 0
                ? `<span class="px-1.5 py-0.5 rounded-full bg-slate-950 text-amber-300 text-[10px] font-black">${pendingAiCount}</span>`
                : ''
            }
          </button>
          <button
            type="button"
            onclick="SMPL_APP.toggleAiFabVisibility(false)"
            class="smpl-ai-fab-close"
            title="Ukryj przycisk Vanessy AI (zawsze dostępna w ⚙️ Menu)"
            aria-label="Ukryj Vanessę AI"
          >✕</button>
        </div>
      `;
      return;
    }

    const prevQb = document.getElementById('smpl-ai-quickbar');
    const savedQbScroll = prevQb && typeof prevQb.scrollLeft === 'number' ? prevQb.scrollLeft : 0;

    root.innerHTML = `
      <div class="smpl-ai-drawer">
        <div class="smpl-ai-header p-3.5 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <img src="${window.SMPL_WOW && typeof window.SMPL_WOW.isOverhaulEnabled === 'function' && window.SMPL_WOW.isOverhaulEnabled() ? './img/wow-vanessa-ai.jpg' : './img/vanessa-ai-emblem.jpg'}" class="smpl-ai-header-photo" alt="Vanessa AI"/>
            <div class="min-w-0">
              <div class="font-display font-black text-sm text-white uppercase truncate flex items-center gap-1.5">
                <span>Vanessa AI</span>
                ${
                  aiWidgetState.geminiReady
                    ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold uppercase">⚡ Gemini</span>`
                    : ''
                }
              </div>
              <div class="text-[10px] text-pink-300 font-semibold truncate">
                ${
                  aiWidgetState.geminiReady
                    ? `Przewodnik Ligi • ${esc(aiWidgetState.activeModel)}`
                    : `Asystentka SMPL${learnedCount > 0 ? ` • ${learnedCount} tematów` : ''}`
                }
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onclick="SMPL_APP.resetAiConversation()"
              class="w-8 h-8 rounded-full bg-slate-900 text-slate-300 font-bold flex items-center justify-center border border-white/15"
              title="Nowa rozmowa"
            >
              🔄
            </button>
            <button
              type="button"
              onclick="SMPL_APP.closeAiAssistant()"
              class="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center border border-white/15"
              title="Zamknij Vanessę"
            >
              ✕
            </button>
          </div>
        </div>

        <div id="smpl-ai-messages-box" class="smpl-ai-messages p-3.5 space-y-2.5">
          ${aiWidgetState.messages
            .map((m, idx) => {
              const latestAttr = idx === aiWidgetState.messages.length - 1 ? ' id="smpl-ai-latest-msg"' : '';
              if (m.role === 'USER') {
                return `
                  <div${latestAttr} class="smpl-ai-msg-user p-3 rounded-2xl text-xs text-white font-semibold">
                    ${esc(m.text)}
                  </div>
                `;
              }
              return `
                <div${latestAttr} class="smpl-ai-msg-bot p-3 rounded-2xl text-xs space-y-2">
                  <div class="flex flex-wrap items-center justify-between gap-1.5">
                    ${m.title ? `<div class="font-display font-black text-[11px] text-pink-300 uppercase">${esc(m.title)}</div>` : '<span></span>'}
                    ${
                      m.provider === 'gemini'
                        ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold">⚡ Gemini${m.latencyMs ? ' • ' + m.latencyMs + 'ms' : ''}</span>`
                        : ''
                    }
                  </div>
                  <div class="text-white leading-relaxed">${formatAiMessageHtml(m.text, esc)}</div>
                  ${
                    m.contextNote
                      ? `<div class="p-2 rounded-xl bg-slate-950/75 border border-amber-400/35 text-[11px] text-amber-300 font-semibold">${esc(m.contextNote)}</div>`
                      : ''
                  }
                  ${
                    m.interactionId
                      ? `<div class="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10 text-[10px]">
                           <span class="text-slate-400">Czy odpowiedź pomogła?</span>
                           <div class="flex items-center gap-1.5">
                             <button type="button" onclick="SMPL_APP.rateAiAnswer('${m.interactionId}', 'UP')" class="px-2 py-1 rounded-lg ${m.rating === 'UP' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black' : 'bg-slate-900 text-slate-300 border border-white/15'}">
                               👍 Pomogło
                             </button>
                             <button type="button" onclick="SMPL_APP.rateAiAnswer('${m.interactionId}', 'DOWN')" class="px-2 py-1 rounded-lg ${m.rating === 'DOWN' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black' : 'bg-slate-900 text-slate-300 border border-white/15'}">
                               👎 Dopytaj Admina
                             </button>
                           </div>
                         </div>`
                      : ''
                  }
                  ${
                    Array.isArray(m.related) && m.related.length > 0
                      ? `<div class="flex flex-wrap gap-1 pt-1">
                           ${m.related
                             .map((rel) => `<button type="button" data-ai-query="${esc(rel.title)}" onclick="SMPL_APP.askAiFromButton(this)" class="smpl-ai-chip px-2 py-1 rounded-lg text-[10px] font-semibold">🔎 ${esc(rel.title)}</button>`)
                             .join('')}
                         </div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}

          ${
            aiWidgetState.isTyping
              ? `<div class="smpl-ai-msg-bot p-3 rounded-2xl text-xs text-pink-300 font-semibold animate-pulse">
                   ✨ Vanessa myśli z Google Gemini (${esc(aiWidgetState.activeModel)})...
                 </div>`
              : ''
          }
        </div>

        <div class="smpl-ai-quickbar-wrap" aria-label="Gotowe pytania do Vanessy i szybkie przejścia">
          <button type="button" onclick="SMPL_APP.scrollAiQuickBar(-1)" class="smpl-ai-scroll-btn" title="Przewiń pytania w lewo" aria-label="Przewiń w lewo">‹</button>
          <div id="smpl-ai-quickbar" class="smpl-ai-quickbar" onwheel="if(event.deltaY){this.scrollLeft+=event.deltaY;event.preventDefault();}">
            ${quickPrompts
              .map((qp) => `<button type="button" data-ai-query="${esc(qp.query)}" onclick="SMPL_APP.askAiFromButton(this)" class="smpl-ai-chip px-2.5 py-1 rounded-xl text-[10px] font-bold">${esc(qp.label)}</button>`)
              .join('')}
            ${
              onboardingActions.length > 0
                ? `<span class="smpl-ai-quickbar-div" aria-hidden="true"></span>` +
                  onboardingActions
                    .map((act) => `<button type="button" onclick="SMPL_APP.aiNavigate('${esc(act.action)}')" class="smpl-ai-action-btn">${esc(act.label)}</button>`)
                    .join('')
                : ''
            }
          </div>
          <button type="button" onclick="SMPL_APP.scrollAiQuickBar(1)" class="smpl-ai-scroll-btn" title="Przewiń pytania w prawo" aria-label="Przewiń w prawo">›</button>
        </div>

        <div class="p-3 border-t border-white/10 bg-slate-950/90 flex items-center gap-2 flex-shrink-0">
          <input
            id="smpl-ai-input"
            type="text"
            placeholder="${aiWidgetState.geminiReady ? (isClansUiEnabledSafe(state) ? 'Zapytaj Vanessę Gemini o klan, tabelę, mecze...' : 'Zapytaj Vanessę Gemini o tabelę, mecze, Puchar...') : 'Zadaj Vanessie dowolne pytanie...'}"
            onkeydown="if(event.key==='Enter') SMPL_APP.sendAiQuestion()"
            class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"
          />
          <button
            type="button"
            onclick="SMPL_APP.sendAiQuestion()"
            class="${aiWidgetState.isTyping ? 'bg-slate-800 text-slate-400' : 'btn-league'} px-3.5 py-2 rounded-xl font-display font-black text-xs uppercase flex-shrink-0"
          >
            ${aiWidgetState.isTyping ? '...' : 'Wyślij'}
          </button>
        </div>
      </div>
    `;

    const newQb = document.getElementById('smpl-ai-quickbar');
    if (newQb && savedQbScroll > 0) {
      try { newQb.scrollLeft = savedQbScroll; } catch (e) {}
    }
    const msgBox = document.getElementById('smpl-ai-messages-box');
    const latestMsg = document.getElementById('smpl-ai-latest-msg');
    const lastItem = aiWidgetState.messages.length ? aiWidgetState.messages[aiWidgetState.messages.length - 1] : null;
    if (msgBox) {
      try {
        if (
          lastItem &&
          lastItem.role === 'BOT' &&
          !aiWidgetState.isTyping &&
          latestMsg &&
          typeof latestMsg.offsetTop === 'number' &&
          typeof msgBox.clientHeight === 'number' &&
          msgBox.clientHeight > 0 &&
          (msgBox.scrollHeight - latestMsg.offsetTop) > msgBox.clientHeight
        ) {
          msgBox.scrollTop = Math.max(0, latestMsg.offsetTop - 8);
        } else {
          msgBox.scrollTop = msgBox.scrollHeight;
        }
      } catch (e) {}
    }
  }

  function aiNavigate(target) {
    const dest = String(target || '').trim();
    if (!dest) return;
    const sess = window.SMPL_DB && window.SMPL_DB.getSession ? window.SMPL_DB.getSession() : null;
    if (sess && sess.isGateUnlocked !== true && sess.isPlayerAuthenticated !== true && sess.linkMode === 'PUBLIC') {
      if (dest === 'register') {
        gateMode = 'register';
        aiWidgetState.isOpen = false;
        renderAll();
        return;
      }
      if (window.SMPL_DB && typeof window.SMPL_DB.unlockGateAsGuest === 'function') {
        window.SMPL_DB.unlockGateAsGuest();
      }
    }
    aiWidgetState.isOpen = false;
    switchTab(dest);
  }

  function openAiAssistant() {
    aiWidgetState.isOpen = true;
    refreshAiEngineStatus(true);
    renderAiAssistantWidget();
    const inp = document.getElementById('smpl-ai-input');
    if (inp && typeof inp.focus === 'function') {
      try { inp.focus(); } catch (e) {}
    }
  }

  function closeAiAssistant() {
    aiWidgetState.isOpen = false;
    renderAiAssistantWidget();
  }

  function pushLocalVanessaReply(cleanQ, localRes, overrideNote) {
    const logged = window.SMPL_DB.logAiInteraction({
      question: cleanQ,
      matched: localRes.matched,
      knowledgeId: localRes.knowledgeId,
      title: localRes.title,
      confidence: localRes.confidence
    });

    const msgObj = {
      id: 'AIB_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      role: 'BOT',
      provider: 'local',
      title: localRes.title,
      text: localRes.answer,
      contextNote: overrideNote || localRes.contextNote || '',
      related: localRes.related || [],
      interactionId: logged ? logged.id : null,
      rating: null
    };
    aiWidgetState.messages.push(msgObj);

    if (aiWidgetState.messages.length > 30) {
      aiWidgetState.messages = aiWidgetState.messages.slice(-30);
    }
    renderAiAssistantWidget();
    return msgObj;
  }

  function sendVanessaGeminiQuestion(cleanQ, history, localRes, state, session, replaceBotMsgId) {
    const clientContext = window.SMPL_AI && typeof window.SMPL_AI.buildLiveLeagueContext === 'function'
      ? window.SMPL_AI.buildLiveLeagueContext(state, session)
      : '';

    aiWidgetState.isTyping = true;
    renderAiAssistantWidget();

    window.SMPL_DB.askVanessaGemini({
      question: cleanQ,
      history: history,
      clientContext: clientContext
    })
      .then(function (gRes) {
        aiWidgetState.isTyping = false;
        if (gRes && gRes.ok && gRes.answer) {
          const existingMsg = replaceBotMsgId
            ? aiWidgetState.messages.find(function (m) { return m && m.id === replaceBotMsgId; })
            : null;

          if (existingMsg) {
            existingMsg.provider = 'gemini';
            existingMsg.model = gRes.model || aiWidgetState.activeModel;
            existingMsg.latencyMs = gRes.latencyMs || 0;
            existingMsg.title = 'Vanessa AI ⚡ Gemini';
            existingMsg.text = gRes.answer;
            existingMsg.contextNote = '';
            renderAiAssistantWidget();
            return;
          }

          const logged = window.SMPL_DB.logAiInteraction({
            question: cleanQ,
            matched: true,
            knowledgeId: 'GEMINI_' + (gRes.model || aiWidgetState.activeModel || 'flash'),
            title: 'Gemini: ' + cleanQ.slice(0, 60),
            confidence: 100
          });
          aiWidgetState.messages.push({
            id: 'AIB_' + Date.now(),
            role: 'BOT',
            provider: 'gemini',
            model: gRes.model || aiWidgetState.activeModel,
            latencyMs: gRes.latencyMs || 0,
            title: 'Vanessa AI ⚡ Gemini',
            text: gRes.answer,
            contextNote: '',
            related: localRes.related || [],
            interactionId: logged ? logged.id : null,
            rating: null
          });
          if (aiWidgetState.messages.length > 30) {
            aiWidgetState.messages = aiWidgetState.messages.slice(-30);
          }
          renderAiAssistantWidget();
          return;
        }

        if (gRes && (gRes.reason === 'NOT_CONFIGURED' || gRes.reason === 'DISABLED')) {
          aiWidgetState.geminiReady = false;
        }
        if (replaceBotMsgId) {
          renderAiAssistantWidget();
          return;
        }
        const warnNote = gRes && gRes.error
          ? ('Tryb awaryjny bazy SMPL (' + gRes.error + ')')
          : '';
        pushLocalVanessaReply(cleanQ, localRes, warnNote);
      })
      .catch(function () {
        aiWidgetState.isTyping = false;
        if (replaceBotMsgId) {
          renderAiAssistantWidget();
        } else {
          pushLocalVanessaReply(cleanQ, localRes, '');
        }
      });
  }

  function processAiPrompt(rawText) {
    const cleanQ = String(rawText || '').trim();
    if (!cleanQ) {
      showToast('Wpisz pytanie dla Vanessy!', 'warning');
      return;
    }
    if (aiWidgetState.isTyping) {
      showToast('Vanessa kończy pisać poprzednią odpowiedź...', 'warning');
      return;
    }

    ensureAiGreeting();
    aiWidgetState.isOpen = true;

    const history = aiWidgetState.messages
      .filter((m) => m && m.id !== 'AI_WELCOME_1' && m.text)
      .slice(-8)
      .map((m) => ({
        role: m.role === 'USER' ? 'user' : 'model',
        text: String(m.text).slice(0, 1000)
      }));

    aiWidgetState.messages.push({
      id: 'AIU_' + Date.now(),
      role: 'USER',
      text: cleanQ
    });

    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const localRes = window.SMPL_AI.ask(cleanQ, state, session);

    const cachedAi = (window.SMPL_DB && typeof window.SMPL_DB.getAiStatusCached === 'function')
      ? window.SMPL_DB.getAiStatusCached()
      : null;
    const isHttp = typeof window !== 'undefined' && window.location && /^https?:$/i.test(String(window.location.protocol || ''));
    const canAskGeminiApi = Boolean(
      isHttp &&
      window.SMPL_DB &&
      typeof window.SMPL_DB.askVanessaGemini === 'function'
    );

    if (canAskGeminiApi && cachedAi && cachedAi.checked && cachedAi.geminiReady) {
      sendVanessaGeminiQuestion(cleanQ, history, localRes, state, session, null);
      return;
    }

    const instantMsg = pushLocalVanessaReply(cleanQ, localRes, '');
    const statusStale = Boolean(
      !cachedAi ||
      !cachedAi.checked ||
      (!cachedAi.geminiReady && (Date.now() - Number(cachedAi.checkedAt || 0) > 45000))
    );
    if (canAskGeminiApi && statusStale && window.SMPL_DB && typeof window.SMPL_DB.getAiStatus === 'function') {
      window.SMPL_DB.getAiStatus().then(function (stData) {
        if (stData && stData.ok) {
          aiWidgetState.geminiReady = Boolean(stData.geminiReady);
          if (stData.model) aiWidgetState.activeModel = stData.model;
          if (stData.geminiReady) {
            sendVanessaGeminiQuestion(cleanQ, history, localRes, window.SMPL_DB.getState(), window.SMPL_DB.getSession(), instantMsg ? instantMsg.id : null);
          }
        }
      });
    }
  }

  function refreshAiGeminiAdminPanel() {
    if (!window.SMPL_DB || typeof window.SMPL_DB.getAiGeminiConfig !== 'function') return;
    const badgeEl = document.getElementById('ai-gemini-status-badge');
    const hintEl = document.getElementById('ai-gemini-key-hint');
    const resEl = document.getElementById('ai-gemini-test-result');
    if (!badgeEl) return;

    const sess = window.SMPL_DB.getSession();
    if (!window.SMPL_DB.isStrictAdminSession(sess)) return;

    window.SMPL_DB.getAiGeminiConfig().then(function (cfg) {
      const badge = document.getElementById('ai-gemini-status-badge');
      const hint = document.getElementById('ai-gemini-key-hint');
      const enEl = document.getElementById('ai-gemini-enabled');
      const modEl = document.getElementById('ai-gemini-model');
      const customEl = document.getElementById('ai-gemini-custom-model');
      const persEl = document.getElementById('ai-gemini-persona');
      const resBox = document.getElementById('ai-gemini-test-result');
      if (!badge) return;

      if (!cfg || !cfg.ok) {
        badge.className = 'px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-xs font-display font-bold text-amber-300';
        badge.textContent = (cfg && cfg.offline) ? '🔌 Tryb Offline (brak serwera HTTP)' : '⚠️ Wymaga autoryzacji serwera';
        if (resBox && cfg && cfg.error) {
          resBox.textContent = cfg.error;
        }
        return;
      }

      if (enEl) enEl.checked = Boolean(cfg.enabled);
      if (persEl && typeof cfg.customPersona === 'string') persEl.value = cfg.customPersona;

      if (modEl && cfg.model) {
        let foundOpt = false;
        for (let i = 0; i < modEl.options.length; i++) {
          if (modEl.options[i].value === cfg.model) {
            modEl.selectedIndex = i;
            foundOpt = true;
            break;
          }
        }
        if (!foundOpt) {
          modEl.value = 'CUSTOM';
          if (customEl) customEl.value = cfg.model;
        } else if (customEl) {
          customEl.value = '';
        }
      }

      if (cfg.configured && cfg.enabled) {
        badge.className = 'px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs font-display font-bold text-emerald-300';
        badge.textContent = '🟢 Aktywny • ' + (cfg.model || 'gemini-3.8-flash');
      } else if (cfg.configured) {
        badge.className = 'px-3 py-1.5 rounded-xl bg-slate-800 border border-white/15 text-xs font-display font-bold text-slate-300';
        badge.textContent = '⚪ Klucz zapisany (wyłączony)';
      } else {
        badge.className = 'px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-xs font-display font-bold text-amber-300';
        badge.textContent = '🟡 Brak klucza API — Tryb Lokalny';
      }

      if (hint) {
        if (cfg.hasEnvKey) {
          hint.textContent = 'Aktywny klucz ze zmiennej środowiskowej SMPL_GEMINI_API_KEY (' + (cfg.maskedKey || '***') + ').';
        } else if (cfg.configured) {
          hint.textContent = 'Zapisany klucz na serwerze: ' + (cfg.maskedKey || '***') + ' (zostaw puste, jeśli nie zmieniasz klucza).';
        } else {
          hint.textContent = 'Brak zapisanego klucza. Wygeneruj darmowy klucz na aistudio.google.com i wklej go powyżej.';
        }
      }

      if (resBox && cfg.lastTestAt) {
        if (cfg.lastTestOk) {
          resBox.className = 'p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-300';
          resBox.textContent = '✅ Ostatni test połączenia (' + cfg.lastTestAt + ') przeszedł pomyślnie.';
        } else if (cfg.lastTestError) {
          resBox.className = 'p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300';
          resBox.textContent = '❌ Ostatni test (' + cfg.lastTestAt + ') nie powiódł się: ' + cfg.lastTestError;
        }
      }
      renderAiAssistantWidget();
    });
  }

  function handleSaveAiGeminiConfig() {
    if (!requireStrictAdmin('konfiguracja Gemini AI')) return;
    if (!window.SMPL_DB || typeof window.SMPL_DB.saveAiGeminiConfig !== 'function') return;

    const keyEl = document.getElementById('ai-gemini-key');
    const clearEl = document.getElementById('ai-gemini-clear-key');
    const enEl = document.getElementById('ai-gemini-enabled');
    const modEl = document.getElementById('ai-gemini-model');
    const customEl = document.getElementById('ai-gemini-custom-model');
    const persEl = document.getElementById('ai-gemini-persona');

    const selModel = modEl ? modEl.value : 'gemini-3.8-flash';
    const customModel = customEl ? customEl.value.trim() : '';
    const finalModel = (selModel === 'CUSTOM' && customModel) ? customModel : (customModel || selModel);

    const payload = {
      apiKey: keyEl ? keyEl.value.trim() : '',
      clearKey: Boolean(clearEl && clearEl.checked),
      enabled: Boolean(enEl ? enEl.checked : true),
      model: finalModel || 'gemini-3.8-flash',
      customPersona: persEl ? persEl.value.trim() : ''
    };

    window.SMPL_DB.saveAiGeminiConfig(payload).then(function (res) {
      if (res && res.ok) {
        if (keyEl) keyEl.value = '';
        if (clearEl) clearEl.checked = false;
        aiWidgetState.geminiReady = Boolean(res.configured && res.enabled);
        aiWidgetState.activeModel = res.model || 'gemini-3.8-flash';
        showToast('⚡ Konfiguracja Gemini AI została bezpiecznie zapisana na serwerze!');
        refreshAiGeminiAdminPanel();
        renderAiAssistantWidget();
      } else {
        showToast((res && res.error) || 'Nie udało się zapisać konfiguracji Gemini.', 'error');
      }
    });
  }

  function handleTestAiGeminiConfig() {
    if (!requireStrictAdmin('test Gemini AI')) return;
    if (!window.SMPL_DB || typeof window.SMPL_DB.testAiGeminiConnection !== 'function') return;

    const keyEl = document.getElementById('ai-gemini-key');
    const modEl = document.getElementById('ai-gemini-model');
    const customEl = document.getElementById('ai-gemini-custom-model');
    const resBox = document.getElementById('ai-gemini-test-result');

    const selModel = modEl ? modEl.value : 'gemini-3.8-flash';
    const customModel = customEl ? customEl.value.trim() : '';
    const finalModel = (selModel === 'CUSTOM' && customModel) ? customModel : (customModel || selModel);

    if (resBox) {
      resBox.className = 'p-3.5 rounded-xl bg-slate-900/90 border border-blue-400/40 text-xs text-blue-300 animate-pulse';
      resBox.textContent = '⏳ Łączenie z Google Gemini API (' + (finalModel || 'gemini-3.8-flash') + ')...';
    }

    window.SMPL_DB.testAiGeminiConnection({
      apiKey: keyEl ? keyEl.value.trim() : '',
      model: finalModel || 'gemini-3.8-flash'
    }).then(function (res) {
      const box = document.getElementById('ai-gemini-test-result');
      const esc = (window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml)
        ? window.SMPL_VIEWS.escapeHtml
        : function (s) { return String(s == null ? '' : s); };
      if (res && res.ok) {
        if (box) {
          box.className = 'p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-xs text-emerald-300';
          box.innerHTML = '✅ <strong>Połączenie z Gemini działa!</strong> (' + esc(res.model) + ' • ' + (res.latencyMs || 0) + ' ms)<br/>Odpowiedź testowa Vanessy: <em>„' + esc(res.answer || '') + '”</em>';
        }
        showToast('✅ Połączenie z Google Gemini działa na żywo!');
      } else {
        const errTxt = (res && res.error) || 'Nie udało się połączyć z Gemini API.';
        if (box) {
          box.className = 'p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300';
          box.textContent = '❌ Test nieudany: ' + errTxt;
        }
        showToast(errTxt, 'error');
      }
      refreshAiGeminiAdminPanel();
    });
  }

  function sendAiQuestion() {
    const inp = document.getElementById('smpl-ai-input');
    const txt = inp ? inp.value : '';
    if (inp) inp.value = '';
    processAiPrompt(txt);
  }

  function askAiQuickPrompt(queryText) {
    processAiPrompt(queryText);
  }

  function askAiFromButton(btnEl) {
    const q = btnEl && typeof btnEl.getAttribute === 'function' ? btnEl.getAttribute('data-ai-query') : '';
    if (q) processAiPrompt(q);
  }

  function scrollAiQuickBar(dir) {
    const qb = document.getElementById('smpl-ai-quickbar');
    if (!qb) return;
    const step = Number(dir || 1) * 180;
    try {
      if (typeof qb.scrollBy === 'function') {
        qb.scrollBy({ left: step, behavior: 'smooth' });
      } else {
        qb.scrollLeft = Math.max(0, (qb.scrollLeft || 0) + step);
      }
    } catch (e) {
      qb.scrollLeft = Math.max(0, (qb.scrollLeft || 0) + step);
    }
  }

  function rateAiAnswer(interactionId, vote) {
    const res = window.SMPL_DB.recordAiFeedback(interactionId, vote);
    aiWidgetState.messages.forEach((m) => {
      if (m && m.interactionId === interactionId) {
        m.rating = vote;
      }
    });
    if (res && res.ok) {
      if (vote === 'UP') {
        showToast('💋 Dzięki! Vanessa zapamiętała Twoje pytanie i będzie mądrzejsza na przyszłość!');
      } else {
        showToast('📩 Zapisane! Pytanie trafiło do Szymona i Adminów — gdy odpowiedzą, Vanessa się tego nauczy.', 'warning');
      }
    }
    renderAiAssistantWidget();
    const sess = window.SMPL_DB.getSession();
    if (window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(sess) && activeTab === 'admin' && adminSubTab === 'ai_vanessa') {
      renderAll();
    }
  }

  function handleAdminTeachFromQueue(queueId) {
    if (!requireStrictAdmin('nauka asystentki AI')) return;
    const ansEl = document.getElementById('ai-teach-ans-' + queueId);
    const kwEl = document.getElementById('ai-teach-kw-' + queueId);
    const ans = ansEl ? ansEl.value : '';
    const kws = kwEl ? kwEl.value : '';
    const sess = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.adminTeachAiAnswer(
        {
          queueId: queueId,
          keywords: kws,
          answer: ans
        },
        sess.adminName || 'Szymon Komenda'
      );
      if (res && res.ok) {
        showToast('💋 Super! Vanessa właśnie nauczyła się nowej odpowiedzi dla całej ligi.');
        renderAll();
      }
    } catch (err) {
      showToast(err.message || String(err), 'error');
    }
  }

  function handleAdminDismissAiQueue(queueId) {
    if (!requireStrictAdmin('moderacja kolejki AI')) return;
    const sess = window.SMPL_DB.getSession();
    window.SMPL_DB.adminDismissAiQueueItem(queueId, sess.adminName || 'Szymon Komenda');
    showToast('Wpis usunięty z kolejki pytań.');
    renderAll();
  }

  function handleAdminAddCustomAiKnowledge() {
    if (!requireStrictAdmin('dodawanie wiedzy AI')) return;
    const titleEl = document.getElementById('ai-manual-title');
    const kwEl = document.getElementById('ai-manual-keywords');
    const ansEl = document.getElementById('ai-manual-answer');
    const sess = window.SMPL_DB.getSession();
    try {
      const res = window.SMPL_DB.adminTeachAiAnswer(
        {
          title: titleEl ? titleEl.value : '',
          questionPhrase: titleEl ? titleEl.value : '',
          keywords: kwEl ? kwEl.value : '',
          answer: ansEl ? ansEl.value : ''
        },
        sess.adminName || 'Szymon Komenda'
      );
      if (res && res.ok) {
        if (titleEl) titleEl.value = '';
        if (kwEl) kwEl.value = '';
        if (ansEl) ansEl.value = '';
        showToast('💋 Dodano nową wiedzę do Vanessy AI!');
        renderAll();
      }
    } catch (err) {
      showToast(err.message || String(err), 'error');
    }
  }

  function handleAdminDeleteAiKnowledge(knowledgeId) {
    if (!requireStrictAdmin('usuwanie wpisu AI')) return;
    const sess = window.SMPL_DB.getSession();
    window.SMPL_DB.adminDeleteAiKnowledge(knowledgeId, sess.adminName || 'Szymon Komenda');
    showToast('Usunięto wpis z pamięci Vanessy.');
    renderAll();
  }

  function _openImageLightbox(opts) {
    const cfg = opts || {};
    if (!cfg.imageUrl) return;
    openModal(`
      <div class="p-4 sm:p-6">
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
          <div>
            <div class="text-xs font-display text-league-primary font-bold uppercase">${window.SMPL_VIEWS.escapeHtml(cfg.badge || 'DOWÓD ZRZUT EKRANU')}</div>
            <div class="font-display font-black text-base text-white">${window.SMPL_VIEWS.escapeHtml(cfg.title || '')}</div>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold">✕</button>
        </div>
        <div class="rounded-2xl overflow-hidden bg-slate-950 border border-white/15 flex justify-center">
          <img src="${cfg.imageUrl}" class="max-h-[70vh] w-auto object-contain" alt="${window.SMPL_VIEWS.escapeHtml(cfg.altText || 'Zrzut ekranu')}"/>
        </div>
      </div>
    `);
  }

  function openScreenshotModal(matchId) {
    const state = window.SMPL_DB.getState();
    const m = state.matches.find((item) => item.id === matchId);
    if (!m || !m.screenshot) return;
    const hp = state.players.find((p) => p.id === m.homeId);
    const ap = state.players.find((p) => p.id === m.awayId);
    _openImageLightbox({
      badge: `KOLEJKA ${m.round} • ${m.status === 'WALKOVER' ? 'DOWÓD W.O. (SS DLACZEGO)' : 'DOWÓD Z GRY SCORE! MATCH'}`,
      title: `${hp ? hp.name : ''} ${m.homeScore}:${m.awayScore} ${ap ? ap.name : ''}`,
      imageUrl: m.screenshot,
      altText: 'Screen wyniku / dowód W.O.'
    });
  }

  function openDisputeScreenshotModal(disputeId) {
    const state = window.SMPL_DB.getState();
    const allDisputes = (state.competitions && Array.isArray(state.competitions.matchDisputes) ? state.competitions.matchDisputes : [])
      .concat(Array.isArray(state.matchDisputes) ? state.matchDisputes : []);
    const disp = allDisputes.find((d) => d && d.id === disputeId);
    if (!disp || !disp.screenshot) {
      showToast('Brak załączonego screena dla tego zgłoszenia.', 'error');
      return;
    }
    _openImageLightbox({
      badge: `SPÓR VAR / W.O. • K${Number(disp.round || 0)} (${disp.leagueId || ''}) • ${disp.reasonType || 'VAR'}`,
      title: `Zgłaszający: ${disp.reporterName || 'Zawodnik'}`,
      imageUrl: disp.screenshot,
      altText: 'Dowód SS dlaczego do sporu VAR / W.O.'
    });
  }

  function openPlayerModal(playerId) {
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const p = state.players.find((item) => item.id === playerId);
    if (!p) return;
    const utData = window.SMPL_ENGINE.calculatePlayerUTCard(state, playerId);
    if (!utData) return;
    const row = utData.row;

    const canEditAsAdmin = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session));
    const myAdminPlQuick = canEditAsAdmin && window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function'
      ? window.SMPL_DB.findPlayerForAdmin(session.adminId, state)
      : null;
    const isOwnQuick = Boolean(
      (session && session.isPlayerAuthenticated && session.activePlayerId === p.id) ||
      (myAdminPlQuick && myAdminPlQuick.id === p.id)
    );
    const quickBio = p.bio ? String(p.bio).trim() : '';
    const quickAvatar = (row && row.avatar) || p.avatar || (window.SMPL_MEDIA ? window.SMPL_MEDIA.generatePlayerAvatar(p.name, p.nick, Math.max(0, ((row && row.position) || 1) - 1)) : '');
    const qCos = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getPlayerCosmetics === 'function')
      ? window.SMPL_STUDIO.getPlayerCosmetics(state, p.id)
      : { frameCss: '', bgCss: '', nickFxCss: '', badgeLabel: '', badgeColor: '#38bdf8', customTitle: '' };
    const qHeaderCosCls = (qCos.bgCss || qCos.frameCss)
      ? ('smpl-cosmetic-card ' + (qCos.bgCss || '') + ' ' + (qCos.frameCss || '') + ' p-4 mb-4')
      : 'pb-4 mb-4 border-b border-white/10';
    const qBadgeHtml = qCos.badgeLabel
      ? `<span class="smpl-shop-badge-pill" style="border-color:${window.SMPL_VIEWS.escapeHtml(qCos.badgeColor || '#38bdf8')};color:${window.SMPL_VIEWS.escapeHtml(qCos.badgeColor || '#38bdf8')};box-shadow:0 0 10px ${window.SMPL_VIEWS.escapeHtml(qCos.badgeColor || '#38bdf8')}33;">${window.SMPL_VIEWS.escapeHtml(qCos.badgeLabel)}</span>`
      : '';
    const qTitleHtml = qCos.customTitle
      ? `<div class="mt-1"><span class="smpl-coin-title-ribbon">🪙 ${window.SMPL_VIEWS.escapeHtml(qCos.customTitle)}</span></div>`
      : '';

    openModal(`
      <div class="p-5 sm:p-6">
        <div class="flex items-start justify-between gap-4 ${qHeaderCosCls}">
          <div class="flex items-center gap-4">
            <div class="relative">
              ${window.SMPL_RANKS ? window.SMPL_RANKS.avatarWithGlassBadgeHtml(quickAvatar, p.name, 'w-16 h-16 rounded-full object-cover border-2 border-league', window.SMPL_RANKS.getPlayerRank(p, state), p.id, 'sm') : `<img src="${quickAvatar}" class="w-16 h-16 rounded-full object-cover border-2 border-league" alt="${window.SMPL_VIEWS.escapeHtml(p.name)}"/>`}
              <span class="absolute px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-display font-black text-[10px] z-10 shadow" style="top:-6px;left:-6px">
                OVR ${utData.ovr}
              </span>
            </div>
            <div>
              <span class="px-2 py-0.5 rounded bg-white/10 text-[10px] font-display font-bold text-league-primary uppercase">
                Pozycja #${row.position} • ${window.SMPL_VIEWS.escapeHtml((state.leagues && state.leagues[p.leagueId] && state.leagues[p.leagueId].shortName) || p.leagueId)} • ${utData.tierLabel}
              </span>
              <h3 class="font-display font-black text-xl text-white mt-1 ${window.SMPL_RANKS ? window.SMPL_RANKS.nameClass(window.SMPL_RANKS.getPlayerRank(p, state)) : ''} ${qCos.nickFxCss || ''}">${window.SMPL_VIEWS.escapeHtml(p.name)}</h3>
              ${window.SMPL_RANKS ? `<div class="my-1.5 flex items-center gap-1.5 flex-wrap">${window.SMPL_RANKS.fullBadgesHtml(window.SMPL_RANKS.getPlayerRank(p, state), 'sm', p.id)}${qBadgeHtml}</div>` : (qBadgeHtml ? `<div class="my-1.5">${qBadgeHtml}</div>` : '')}
              ${qTitleHtml}
              <div class="text-xs text-slate-400">@${window.SMPL_VIEWS.escapeHtml(p.nick)} • ${utData.playstyle}</div>
            </div>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="w-8 h-8 rounded-full bg-slate-800 text-white font-bold">✕</button>
        </div>

        ${
          quickBio
            ? `<div class="mb-4 px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-xs text-slate-200 italic">📝 „${window.SMPL_VIEWS.escapeHtml(quickBio)}”</div>`
            : ''
        }

        <div class="grid grid-cols-4 gap-2.5 text-center mb-4">
          <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div class="text-[10px] text-slate-400 uppercase">Punkty</div>
            <div class="font-display font-black text-xl text-white mt-0.5">${row.PKT}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div class="text-[10px] text-slate-400 uppercase">Bilans</div>
            <div class="font-display font-black text-xl text-emerald-400 mt-0.5">${row.BZ}:${row.BS}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div class="text-[10px] text-slate-400 uppercase">Czyste Konta</div>
            <div class="font-display font-black text-xl text-emerald-300 mt-0.5">🧤 ${row.cleanSheets}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div class="text-[10px] text-slate-400 uppercase">Trofea</div>
            <div class="font-display font-black text-xl text-amber-300 mt-0.5">🏆 ${(utData.trophies || []).length}</div>
          </div>
        </div>

        ${(() => {
          const quickS55 = (window.SMPL_DB && typeof window.SMPL_DB.findPlayerS55Record === 'function')
            ? window.SMPL_DB.findPlayerS55Record(state, p)
            : null;
          if (!quickS55 || quickS55.M <= 0) return '';
          return `
            <div class="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-400/35 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <div class="text-[10px] font-display font-black uppercase text-amber-300">⏳ Obecny wynik w Sezonie 55 (Półmetek) • ${window.SMPL_VIEWS.escapeHtml(quickS55.leagueLabel)}</div>
                <div class="text-white font-bold mt-0.5">
                  #${quickS55.pos} • <span class="text-amber-300">${quickS55.PKT} pkt</span> • ${quickS55.M}M (${quickS55.W}W-${quickS55.R}R-${quickS55.P}P) • ${quickS55.BZ}:${quickS55.BS} • 🧤 ${quickS55.cs} CS
                </div>
              </div>
              <button type="button" onclick="SMPL_APP.closeModal(); SMPL_APP.setArchiveMode('SEASONS'); SMPL_APP.setArchiveSeason(55); SMPL_APP.setArchiveLeague('${quickS55.leagueId}'); SMPL_APP.switchTab('archive');" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-display font-bold text-[10px] uppercase">
                Tabela S55 →
              </button>
            </div>
          `;
        })()}

        <div class="flex flex-wrap justify-between gap-2 pt-3 border-t border-white/10">
          <button onclick="SMPL_APP.closeModal(); SMPL_APP.openPlayerProfileTab('${p.id}');" class="btn-league px-4 py-2 rounded-xl text-xs font-display uppercase">
            🎴 Otwórz Pełną Kartę UT & Gablotę Trofeów
          </button>
          <button onclick="SMPL_APP.closeModal(); SMPL_APP.setH2HPlayer('A', '${p.id}'); SMPL_APP.switchTab('h2h');" class="px-3.5 py-2 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-xs font-bold">
            ⚔️ H2H
          </button>
          <button type="button" onclick="SMPL_APP.closeModal(); SMPL_APP.openMessengerForPlayer('');" class="px-3.5 py-2 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 text-sky-200 border border-sky-400/40 text-xs font-bold flex items-center gap-1">
            💬 Messenger
          </button>
          ${
            isOwnQuick
              ? `<button onclick="SMPL_APP.closeModal(); SMPL_APP.openEditOwnProfileModal();" class="px-3.5 py-2 rounded-xl bg-blue-600/35 hover:bg-blue-600/50 text-blue-100 border border-blue-400/50 text-xs font-bold">🎨 Edytuj Awatar i Bio</button>`
              : ''
          }
          ${
            canEditAsAdmin
              ? `<button onclick="SMPL_APP.closeModal(); SMPL_APP.openEditPlayerModal('${p.id}');" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold">✏️ Edytuj (Admin)</button>`
              : (!isOwnQuick ? `<span class="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-400/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1.5">👁️ Tryb Podglądu Statystyk</span>` : '')
          }
        </div>
      </div>
    `);
  }

  function openPlayerSelectModal() {
    const session = window.SMPL_DB.getSession();
    if (session && session.isPlayerAuthenticated && session.activePlayerId) {
      profileState.playerId = session.activePlayerId;
      activeTab = 'profile';
      renderAll();
      return;
    }
    handleGateLock();
  }

  function openPlayerChangePasswordModal() {
    const session = window.SMPL_DB.getSession();
    if (!session || !session.isPlayerAuthenticated || !session.activePlayerId) {
      showToast('Zaloguj się najpierw na swoje konto zawodnika.', 'error');
      return;
    }
    openModal(`
      <div class="p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-amber-400">PRYWATNE BEZPIECZEŃSTWO KONTA</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🔑 Zmień Moje Hasło</h3>
          </div>
          <button onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>
        <form onsubmit="SMPL_APP.handleChangeMyPlayerPassword(event)" class="space-y-3.5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Obecne hasło *</label>
            <input id="player-pwd-current" type="password" required placeholder="Wpisz obecne lub tymczasowe hasło" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nowe prywatne hasło (min. 4 znaki) *</label>
            <input id="player-pwd-new" type="password" required minlength="4" placeholder="Wpisz nowe prywatne hasło" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
            <button type="submit" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">💾 Zapisz nowe hasło</button>
          </div>
        </form>
      </div>
    `);
  }

  function handleChangeMyPlayerPassword(event) {
    event.preventDefault();
    const curEl = document.getElementById('player-pwd-current');
    const newEl = document.getElementById('player-pwd-new');
    const currentPassword = curEl ? curEl.value || '' : '';
    const newPassword = newEl ? newEl.value || '' : '';
    try {
      window.SMPL_DB.updateMyPlayerPassword({ currentPassword, newPassword });
      closeModal();
      showToast('🔑 Twoje prywatne hasło zostało bezpiecznie zmienione!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się zmienić hasła.', 'error');
    }
  }

  let editOwnProfileDraft = { avatar: '', bio: '' };

  function openEditOwnProfileModal(focusTarget) {
    if (!window.SMPL_DB || typeof window.SMPL_DB.getOwnProfileSubject !== 'function') return;
    const subj = window.SMPL_DB.getOwnProfileSubject();
    if (!subj || !subj.canEdit) {
      showToast('Zaloguj się najpierw na swoje konto zawodnika lub administratora.', 'error');
      return;
    }
    const esc = window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml ? window.SMPL_VIEWS.escapeHtml : function (v) { return String(v || ''); };
    const defaultAvatar = window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
      ? window.SMPL_MEDIA.generatePlayerAvatar(subj.name, subj.nick || 'SMPL', 1)
      : '';
    const curAvatar = subj.avatar || defaultAvatar;
    const curBio = subj.bio || '';
    editOwnProfileDraft = { avatar: curAvatar, bio: curBio };

    const presetsHtml = [0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
      const url = window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
        ? window.SMPL_MEDIA.generatePlayerAvatar(subj.name, subj.nick || 'SMPL', idx)
        : '';
      return url
        ? `<button type="button" onclick="SMPL_APP.selectEditProfilePresetAvatar(${idx})" class="p-1 rounded-full border-2 border-white/15 hover:border-amber-400 bg-slate-900 transition hover:scale-105" title="Gotowy herb SMPL #${idx + 1}">
             <img src="${url}" class="w-10 h-10 rounded-full object-cover" alt="Herb #${idx + 1}"/>
           </button>`
        : '';
    }).join('');

    const isHttpUrl = /^https?:\/\//i.test(curAvatar);
    openModal(`
      <div class="p-5 sm:p-6">
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-blue-300">TWÓJ PROFIL ULTIMATE TEAM • ${esc(subj.leagueId || 'SMPL')}</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🎨 Edytuj Swój Awatar i Bio</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <form onsubmit="SMPL_APP.handleSaveOwnProfile(event)" class="space-y-4">
          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10 flex flex-col sm:flex-row items-center gap-4">
            <img id="edit-own-avatar-preview" src="${curAvatar}" class="w-20 h-20 rounded-full object-cover border-4 border-amber-400 shadow-xl flex-shrink-0" alt="${esc(subj.name)}"/>
            <div class="flex-1 w-full space-y-2 text-center sm:text-left">
              <div class="text-xs font-display uppercase font-bold text-white">${esc(subj.name)} <span class="text-amber-300">@${esc(subj.nick || 'gracz')}</span></div>
              <div id="edit-own-avatar-status" class="text-[11px] text-emerald-300">Wybierz własne zdjęcie, wklej link albo kliknij gotowy herb SMPL poniżej.</div>
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <label class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-display font-bold uppercase cursor-pointer shadow">
                  📷 Wgraj Zdjęcie
                  <input type="file" accept="image/*" class="hidden" onchange="SMPL_APP.handleEditProfileAvatarFile(event)"/>
                </label>
                <button type="button" onclick="SMPL_APP.resetEditOwnProfileAvatar()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-xs font-bold">
                  🔄 Domyślny Herb
                </button>
              </div>
            </div>
          </div>

          <div>
            <div class="text-[11px] font-display uppercase font-bold text-slate-300 mb-2">🎨 Szybkie Herby Zawodnika SMPL</div>
            <div class="flex flex-wrap items-center gap-2">${presetsHtml}</div>
          </div>

          <div>
            <label class="block text-[11px] font-display uppercase font-bold text-slate-300 mb-1">🔗 Lub wklej link URL obrazka (opcjonalnie, https://...)</label>
            <input
              id="edit-own-avatar-url-input"
              type="url"
              value="${isHttpUrl ? esc(curAvatar) : ''}"
              oninput="SMPL_APP.handleEditProfileAvatarUrlInput(this.value)"
              placeholder="https://example.com/moj-awatar.jpg"
              class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label for="edit-own-bio-input" class="text-xs font-display uppercase font-bold text-amber-300">📝 Twoje Bio Gracza (widoczne na Karcie UT)</label>
              <span id="edit-own-bio-counter" class="text-[11px] text-slate-400 font-mono-num">${curBio.length} / 280</span>
            </div>
            <textarea
              id="edit-own-bio-input"
              rows="3"
              maxlength="280"
              oninput="SMPL_APP.updateEditProfileBioCounter()"
              placeholder="Napisz coś o sobie, np.: Gram w Score! Match od 2022 r., ulubiony styl kontra i wysokie presingi, celuję w awans do Ekstraklasy! 🏆"
              class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
            >${esc(curBio)}</textarea>
            <p class="text-[10px] text-slate-400 mt-1">Twoje Bio nie zdradza tajnych składów z gry — możesz podzielić się stylem gry, motto lub historią w lidze.</p>
          </div>

          <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Anuluj</button>
            <button type="submit" class="btn-league px-5 py-2 rounded-xl text-xs font-display uppercase">💾 Zapisz Awatar i Bio</button>
          </div>
        </form>
      </div>
    `);

    if (focusTarget === 'bio') {
      setTimeout(function () {
        const bEl = document.getElementById('edit-own-bio-input');
        if (bEl && typeof bEl.focus === 'function') bEl.focus();
      }, 40);
    }
  }

  function handleEditProfileAvatarFile(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size && file.size > 15 * 1024 * 1024) {
      showToast('Zdjęcie jest za duże (max 15 MB przed kompresją).', 'error');
      return;
    }
    fileToDataUrl(file, 360).then((dataUrl) => {
      if (!dataUrl) return;
      editOwnProfileDraft.avatar = dataUrl;
      const img = document.getElementById('edit-own-avatar-preview');
      if (img) img.src = dataUrl;
      const urlIn = document.getElementById('edit-own-avatar-url-input');
      if (urlIn) urlIn.value = '';
      const stEl = document.getElementById('edit-own-avatar-status');
      if (stEl) stEl.textContent = '✅ Wgrano własne zdjęcie (gotowe do zapisu).';
    });
  }

  function selectEditProfilePresetAvatar(presetIdx) {
    const subj = window.SMPL_DB && typeof window.SMPL_DB.getOwnProfileSubject === 'function'
      ? window.SMPL_DB.getOwnProfileSubject()
      : null;
    const nm = (subj && subj.name) || 'Gracz SMPL';
    const nk = (subj && subj.nick) || 'SMPL';
    if (!window.SMPL_MEDIA || typeof window.SMPL_MEDIA.generatePlayerAvatar !== 'function') return;
    const url = window.SMPL_MEDIA.generatePlayerAvatar(nm, nk, Number(presetIdx) || 0);
    editOwnProfileDraft.avatar = url;
    const img = document.getElementById('edit-own-avatar-preview');
    if (img) img.src = url;
    const urlIn = document.getElementById('edit-own-avatar-url-input');
    if (urlIn) urlIn.value = '';
    const stEl = document.getElementById('edit-own-avatar-status');
    if (stEl) stEl.textContent = '🎨 Wybrano herb SMPL #' + ((Number(presetIdx) || 0) + 1) + '.';
  }

  function handleEditProfileAvatarUrlInput(val) {
    const clean = String(val || '').trim();
    if (!clean) return;
    if (/^https?:\/\/[^\s"'<>]{4,1020}$/i.test(clean)) {
      editOwnProfileDraft.avatar = clean;
      const img = document.getElementById('edit-own-avatar-preview');
      if (img) img.src = clean;
      const stEl = document.getElementById('edit-own-avatar-status');
      if (stEl) stEl.textContent = '🔗 Podgląd awatara z linku URL.';
    }
  }

  function resetEditOwnProfileAvatar() {
    selectEditProfilePresetAvatar(1);
  }

  function updateEditProfileBioCounter() {
    const bEl = document.getElementById('edit-own-bio-input');
    const cEl = document.getElementById('edit-own-bio-counter');
    if (bEl && cEl) {
      const len = String(bEl.value || '').length;
      cEl.textContent = len + ' / 280';
    }
  }

  function handleSaveOwnProfile(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const urlIn = document.getElementById('edit-own-avatar-url-input');
    const typedUrl = urlIn ? String(urlIn.value || '').trim() : '';
    const nextAvatar = typedUrl ? typedUrl : editOwnProfileDraft.avatar;
    const bioEl = document.getElementById('edit-own-bio-input');
    const nextBio = bioEl ? String(bioEl.value || '') : '';
    try {
      const res = window.SMPL_DB.updateOwnProfile({
        avatar: nextAvatar,
        bio: nextBio
      });
      closeModal();
      showToast('🎨 Zaktualizowano Twój awatar i Bio na Karcie UT!');
      renderAll();
      if (res && res.serverPromise && typeof res.serverPromise.then === 'function') {
        res.serverPromise.then((srvRes) => {
          if (srvRes && srvRes.ok === false && srvRes.error) {
            showToast('⚠️ ' + srvRes.error, 'error');
            renderAll();
          } else if (srvRes && srvRes.data) {
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się zapisać awatara i Bio.', 'error');
    }
  }

  function selectActivePlayer(playerId) {
    if (!requireStrictAdmin('przełączenie aktywnego gracza')) return;
    const session = window.SMPL_DB.getSession();
    const stCheck = window.SMPL_DB.getState();
    const targetP = (stCheck.players || []).find((item) => item.id === playerId);
    if (targetP && (targetP.isBlacklisted || targetP.banned || targetP.customRank === 'BLACKLISTED')) {
      showToast('⛔ ODMOWA: Ten gracz znajduje się na Czarnej Liście Ligi z dożywotnim banem!', 'error');
      return;
    }
    session.activePlayerId = playerId;
    window.SMPL_DB.saveSession(session);
    closeModal();
    const state = window.SMPL_DB.getState();
    const p = state.players.find((item) => item.id === playerId);
    if (p) {
      activeLeague = p.leagueId;
      profileState.playerId = p.id;
    }
    showToast(`👤 Aktywny profil gracza: ${p ? p.name : ''}`);
    renderAll();
  }

  function refreshViewFromServer() {
    renderAll();
  }

  function manualServerSync() {
    if (window.SMPL_DB && typeof window.SMPL_DB.pullFromServer === 'function') {
      window.SMPL_DB.pullFromServer((ok) => {
        if (ok) {
          showToast('🔄 Pobrano najnowszą bazę danych z serwera!');
          renderAll();
        }
      });
    }
  }

  function start() {
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.init === 'function') {
      window.SMPL_NOTIF.init();
    }
    window.SMPL_DB.init();
    const session = window.SMPL_DB.getSession();
    const hashStr = (window.location.hash || '').toLowerCase();

    if (
      window.SMPL_FORCED_TAB === 'register' ||
      hashStr.includes('rejestracja') ||
      hashStr.includes('zapisy')
    ) {
      activeTab = 'register';
      gateMode = 'register';
      if (window.SMPL_FORCED_TAB === 'register' && !session.isPlayerAuthenticated && !session.isAdminAuthenticated) {
        window.SMPL_DB.unlockGateAsGuest();
      }
    } else if (session.linkMode === 'ADMIN_LINK') {
      activeTab = 'admin';
      adminSubTab = 'moderation';
    } else if (session.linkMode === 'MASTER') {
      activeTab = 'admin';
      adminSubTab = 'master_studio';
    } else if (hashStr.includes('chat') || hashStr.includes('czat')) {
      activeTab = 'schedule';
    } else if (hashStr.includes('schedule') || hashStr.includes('terminarz')) {
      activeTab = 'schedule';
    } else if (hashStr.includes('submit') || hashStr.includes('wynik')) {
      activeTab = 'submit';
    } else if (hashStr.includes('profile') || hashStr.includes('profil')) {
      activeTab = 'profile';
    } else if (hashStr.includes('competitions') || hashStr.includes('sklep')) {
      activeTab = 'competitions';
    } else {
      activeTab = 'standings';
    }

    window.addEventListener('hashchange', () => {
      const hasAdminSess = Boolean(window.SMPL_DB && typeof window.SMPL_DB.isStrictAdminSession === 'function' && window.SMPL_DB.isStrictAdminSession());
      if (!hasAdminSess) {
        window.SMPL_FORCED_MODE = null;
      }
      const newHash = (window.location.hash || '').toLowerCase();
      const newSession = window.SMPL_DB.getSession();
      if (newHash.includes('rejestracja') || newHash.includes('zapisy')) {
        activeTab = 'register';
      } else if (newSession.linkMode === 'ADMIN_LINK' || newSession.linkMode === 'MASTER') {
        activeTab = 'admin';
      } else if (activeTab === 'admin') {
        activeTab = 'standings';
      }
      renderAll();
    });

    if (typeof window.addEventListener === 'function') {
      window.addEventListener('smpl:db-synced', () => {
        const modalRoot = document.getElementById('global-modal-root');
        if (modalRoot && modalRoot.innerHTML && modalRoot.innerHTML.trim()) return;
        const activeTag = document.activeElement && document.activeElement.tagName;
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
        renderAll();
      });
      window.addEventListener('smpl:server-rejected', (ev) => {
        const srvMsg = ev && ev.detail && ev.detail.message ? String(ev.detail.message) : '';
        showToast(srvMsg ? ('⛔ ' + srvMsg) : '⛔ Serwer odrzucił nieautoryzowaną zmianę bazy! Tylko zalogowany Administrator może modyfikować ligę.', 'error');
        renderAll();
      });
      const onViewportGeometryChange = () => {
        syncIosSafeAreaGuard();
        syncTopBarHeightVar();
      };
      window.addEventListener('resize', onViewportGeometryChange);
      window.addEventListener('orientationchange', () => {
        if (typeof setTimeout === 'function') setTimeout(onViewportGeometryChange, 120);
        else onViewportGeometryChange();
      });
      if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
        window.visualViewport.addEventListener('resize', onViewportGeometryChange);
      }
      window.addEventListener('scroll', () => {
        const bnr = document.getElementById('pwa-install-banner');
        if (bnr && bnr.style && bnr.style.display !== 'none') syncTopBarHeightVar();
      }, { passive: true });
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          applyThemeToDom();
          if (window.SMPL_DB && typeof window.SMPL_DB.pullIfStale === 'function') {
            window.SMPL_DB.pullIfStale(2500);
          }
        }
      });
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const refreshOnReturn = () => {
          if (window.SMPL_DB && typeof window.SMPL_DB.pullIfStale === 'function') {
            window.SMPL_DB.pullIfStale(2500);
          }
        };
        window.addEventListener('pageshow', refreshOnReturn);
        window.addEventListener('focus', refreshOnReturn);
      }
      document.addEventListener('fullscreenchange', () => {
        renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
      });
    }
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const onSchemeChange = () => {
          if (getThemePreference() === 'auto-system') {
            applyThemeToDom();
            renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
          }
        };
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onSchemeChange);
        else if (typeof mq.addListener === 'function') mq.addListener(onSchemeChange);
      } catch (e) {}
    }
    if (typeof setInterval === 'function') {
      setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        if (getThemePreference() === 'auto-time') applyThemeToDom();
        if (window.SMPL_DB && typeof window.SMPL_DB.pullIfStale === 'function') {
          window.SMPL_DB.pullIfStale(5500);
        }
      }, 6000);
    }

    installAndroidBackButtonGuard();
    renderAll();
    refreshAiEngineStatus(true);
  }

  function handleToggleSound() {
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.toggleSound === 'function') {
      window.SMPL_NOTIF.toggleSound();
      renderAll();
    }
  }

  function handleToggleNotifications() {
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.toggleNotifications === 'function') {
      window.SMPL_NOTIF.toggleNotifications();
      renderAll();
    }
  }

  function handleEnablePushNotifications() {
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.requestNotificationPermission === 'function') {
      Promise.resolve(window.SMPL_NOTIF.requestNotificationPermission()).then(() => {
        renderAll();
      });
    } else {
      renderAll();
    }
  }

  function handleTestPushNotification() {
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.sendServerPushTest === 'function') {
      Promise.resolve(window.SMPL_NOTIF.sendServerPushTest()).then(() => {
        renderAll();
      });
    }
  }

  function openIosInstallGuideModal() {
    const diag = window.SMPL_NOTIF && typeof window.SMPL_NOTIF.getIosPushDiagnostic === 'function'
      ? window.SMPL_NOTIF.getIosPushDiagnostic()
      : { isInAppBrowser: false, isStandalone: false, needsHttps: false };
    closeNotificationsCenterModal();
    openModal(`
      <div class="p-5 sm:p-6 max-w-lg mx-auto space-y-4">
        <div class="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <span class="text-[10px] font-display font-bold uppercase text-sky-400">APPLE iOS / iPHONE PWA</span>
            <h3 class="font-display font-black text-lg text-white uppercase">🍏 Jak włączyć powiadomienia na iPhone?</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="smpl-topbar-icon-btn">✕</button>
        </div>
        ${
          diag.needsHttps
            ? `<div class="p-3 rounded-2xl bg-rose-500/20 border border-rose-400/50 text-xs text-rose-100">
                 ⚠️ <strong>Brak HTTPS:</strong> aktualny adres nie używa HTTPS. Apple blokuje Web Push na zwykłym HTTP — użyj oficjalnego adresu <code>https://...</code> portalu.
               </div>`
            : ''
        }
        ${
          diag.isInAppBrowser
            ? `<div class="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-xs text-amber-100">
                 💬 <strong>Wykryto przeglądarkę Messenger / Facebook:</strong> tutaj iOS blokuje instalację PWA i powiadomienia! Najpierw dotknij menu (<strong>⋯</strong> lub ikonę kompasu w rogu) i wybierz <strong>Otwórz w Safari</strong>.
               </div>`
            : ''
        }
        <p class="text-xs text-slate-300 leading-relaxed">
          Apple (iOS 16.4+) wymaga uruchomienia portalu jako aplikacji z ekranu głównego, aby powiadomienia o meczach, decyzjach Admina i sporach VAR przychodziły jak w natywnej aplikacji:
        </p>
        <ol class="space-y-2.5 text-xs text-slate-200 bg-slate-900/80 p-4 rounded-2xl border border-white/10">
          <li class="flex items-start gap-2.5">
            <span class="px-2 py-0.5 rounded-full bg-sky-500/25 text-sky-300 font-black">1</span>
            <span>Otwórz ten portal w przeglądarce <strong>Safari</strong> na iPhone.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="px-2 py-0.5 rounded-full bg-sky-500/25 text-sky-300 font-black">2</span>
            <span>Kliknij ikonę <strong>Udostępnij (kwadrat ze strzałką ⬆️)</strong> na pasku Safari.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="px-2 py-0.5 rounded-full bg-sky-500/25 text-sky-300 font-black">3</span>
            <span>Przewiń listę i wybierz <strong>„Dodaj do ekranu początkowego”</strong>, a następnie zatwierdź <strong>Dodaj</strong>.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 font-black">4</span>
            <span>Zamknij Safari, uruchom <strong>Score Match Liga z nowej ikony na pulpicie</strong>, kliknij dzwonek 🔔 i wybierz <strong>Aktywuj PUSH</strong>!</span>
          </li>
        </ol>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-xs uppercase">Rozumiem</button>
        </div>
      </div>
    `);
  }

  


  


  // =========================================================================
  // TRYBUNAŁ DYSCYPLINARNY, PUSZCZANIE KOLEJEK I POWIADOMIENIA PUSH
  // =========================================================================

  function handleBroadcastRoundRelease() {
    if (!requireStrictAdmin('ogłoszenie kolejki')) return;
    const state = window.SMPL_DB.getState();
    const curWeek = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1;
    const curRound = (curWeek - 1) * 4 + 1;

    const roundInput = prompt(
      `Podaj numer kolejki, którą chcesz oficjalnie wystartować (np. ${curRound}):`,
      curRound
    );
    if (!roundInput) return;

    const r = parseInt(roundInput, 10);
    if (isNaN(r) || r < 1 || r > 30) {
      showToast('Nieprawid\u0142owy numer kolejki (wybierz 1-30).', 'error');
      return;
    }
    const w = Math.ceil(r / 4);

    try {
      window.SMPL_DB.broadcastRoundRelease(r, w);
      showToast(`📢 Kolejka #${r} (Tydzień #${w}) została puszczona! Wysłano powiadomienie PUSH do graczy.`, 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd puszczania kolejki.', 'error');
    }
  }

  function handleApplyTribunalVerdict(incidentId, playerId) {
    if (!requireStrictAdmin('wyrok trybunału')) return;
    const ptsEl = document.getElementById(`trib-pts-${incidentId}`);
    const cardEl = document.getElementById(`trib-card-${incidentId}`);
    const suspEl = document.getElementById(`trib-susp-${incidentId}`);
    const reasonEl = document.getElementById(`trib-reason-${incidentId}`);

    const pts = ptsEl ? parseInt(ptsEl.value, 10) : 0;
    const cardVal = cardEl ? cardEl.value : 'NONE';
    const isSuspended = suspEl ? suspEl.checked : false;
    const reason = reasonEl ? reasonEl.value.trim() : '';

    if (isNaN(pts) || pts < 0) {
      showToast('Podaj poprawną liczbę punktów karnych (0 lub więcej).', 'error');
      return;
    }
    if (pts > 0 && reason.length < 3) {
      showToast('⚠️ Musisz obowiązkowo wpisać powód odjęcia punktów (min. 3 znaki) — każdy Admin zobaczy ten wpis!', 'error');
      return;
    }

    const yellowCards = cardVal === 'YELLOW' ? 1 : 0;
    const redCards = cardVal === 'RED' ? 1 : 0;

    try {
      window.SMPL_DB.applyDisciplinaryAction({
        playerId,
        incidentId,
        penaltyPoints: pts,
        yellowCards,
        redCards,
        isSuspended,
        suspensionReason: reason,
        penaltyReason: reason
      });
      showToast('⚖️ Wyrok wydany! Zastosowano karę, odjęto punkty i poinformowano ligę.', 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd orzekania kary.', 'error');
    }
  }

  function handleDismissIncident(incidentId) {
    if (!requireStrictAdmin('oddalenie zgłoszenia trybunału')) return;
    try {
      window.SMPL_DB.dismissModerationIncident(incidentId);
      showToast('Wypowiedź uznana za zgodną z regulaminem. Flaga cofnięta.', 'info');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd uniewinnienia.', 'error');
    }
  }

  

  function handleManualDisciplinarySubmit(event) {
    if (event) event.preventDefault();
    if (!requireStrictAdmin('nałożenie kary dyscyplinarnej')) return;
    const pEl = document.getElementById('manual-disc-player');
    const ptsEl = document.getElementById('manual-disc-pts');
    const cardEl = document.getElementById('manual-disc-card');
    const suspEl = document.getElementById('manual-disc-susp');
    const reasonEl = document.getElementById('manual-disc-reason');

    const playerId = pEl ? pEl.value : '';
    const pts = ptsEl ? parseInt(ptsEl.value, 10) : 0;
    const cardVal = cardEl ? cardEl.value : 'NONE';
    const isSuspended = suspEl ? suspEl.checked : false;
    const reason = reasonEl ? reasonEl.value.trim() : '';

    if (!playerId) {
      showToast('Wybierz zawodnika.', 'error');
      return;
    }
    if (isNaN(pts) || pts < 0) {
      showToast('Podaj poprawną liczbę punktów ujemnych (0 lub więcej, bez limitu).', 'error');
      return;
    }
    if (pts > 0 && reason.length < 3) {
      showToast('⚠️ Musisz obowiązkowo podać powód odjęcia punktów (min. 3 znaki) — każdy Admin to widzi!', 'error');
      return;
    }

    const yellowCards = cardVal === 'YELLOW' ? 1 : 0;
    const redCards = cardVal === 'RED' ? 1 : 0;

    try {
      window.SMPL_DB.applyDisciplinaryAction({
        playerId,
        penaltyPoints: pts,
        yellowCards,
        redCards,
        isSuspended,
        suspensionReason: reason,
        penaltyReason: reason
      });
      showToast('⚖️ Kara regulaminowa została nałożona na zawodnika!', 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd nakładania kary.', 'error');
    }
  }

  function handlePardonPlayer(playerId) {
    if (!requireStrictAdmin('ułaskawienie gracza')) return;
    if (!confirm('Czy na pewno chcesz znieść wszystkie kary punktowe, kartki i zawieszenia tego zawodnika?')) return;
    try {
      window.SMPL_DB.pardonPlayerDiscipline(playerId);
      showToast('Ułaskawienie zatwierdzone. Gracz ma czyste konto.', 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd ułaskawienia.', 'error');
    }
  }

  

  function openDisciplinaryModalForPlayer(playerId, messageId) {
    if (!requireStrictAdmin('trybunał dyscyplinarny')) return;
    activeTab = 'admin';
    adminSubTab = 'tribunal';
    renderAll();
  }


  // --- OBSŁUGA WSZYSTKICH SEZONÓW ORAZ CZARNEJ LISTY (DOŻYWOTNI BAN) ---
  function switchGlobalSeason(mode) {
    if (mode === 'CURRENT_56') {
      activeTab = 'standings';
      const st = window.SMPL_DB.getState();
      showToast(`⚡ Tabela i rozgrywki na żywo (Sezon ${st.season || 56}).`);
    } else if (mode === 'ARCHIVE_55') {
      activeTab = 'archive';
      archiveState.mode = 'SEASONS';
      archiveState.seasonNumber = 55;
      showToast('⏳ Otwarto tabelę Sezonu 55 (W trakcie — półmetek).');
    } else if (mode === 'ARCHIVE_ALL') {
      activeTab = 'archive';
      archiveState.mode = 'SEASONS';
      showToast('🏛️ Otwarto Pełne Archiwum Wszystkich Sezonów (S1–S55).');
    } else if (mode === 'ALL_TIME') {
      activeTab = 'archive';
      archiveState.mode = 'ALL_TIME';
      showToast('👑 Otwarto Ranking Wszech Czasów Score Match Liga.');
    } else if (mode === 'GENERAL') {
      activeTab = 'archive';
      archiveState.mode = 'GENERAL';
      showToast('📈 Otwarto Ranking Ogólny Wszystkich Lig.');
    } else if (mode === 'BLACKLIST') {
      activeTab = 'blacklist';
      showToast('💀 Otwarto Oficjalną Czarną Listę Ligi.');
    }
    renderAll();
    scrollNavigationIntoView(false);
  }

  function fillBlacklistFromSelect(playerId) {
    if (!playerId) return;
    const state = window.SMPL_DB.getState();
    const p = (state.players || []).find((item) => item.id === playerId);
    if (!p) return;
    const nameInp = document.getElementById('bl-input-name');
    const nickInp = document.getElementById('bl-input-nick');
    const fbInp = document.getElementById('bl-input-fb');
    if (nameInp) nameInp.value = p.name || '';
    if (nickInp) nickInp.value = p.nick || '';
    if (fbInp) fbInp.value = p.fbLink || p.fb || '';
  }

  function presetBlacklistReason(category) {
    const reasonEl = document.getElementById('bl-input-reason');
    if (!reasonEl) return;
    const map = {
      LAG_SWITCH: 'Celowe rozłączanie połączenia internetowego w trakcie przegrywanych meczów (lag switch), wymuszanie błędów sieci i unikanie porażek.',
      SCREEN_FORGERY: 'Próba sfałszowania oficjalnego zrzutu ekranu z wynikiem meczu ligowego oraz wprowadzanie Zarządu Ligi w błąd.',
      AGGRESSION: 'Wulgarne wyzwiska, groźby, mobbing wobec rywali w wiadomościach prywatnych oraz notoryczny brak szacunku dla innych graczy i Administracji.',
      MULTI_ACC: 'Tworzenie fałszywych multikont w celu ominięcia kar dyscyplinarnych oraz gry za inne osoby (account sharing).',
      OTHER: 'Rażące i powtarzające się naruszanie regulaminu Score Match Ligi ze szkodą dla rozgrywek.'
    };
    reasonEl.value = map[category] || '';
  }

  function handleAddToBlacklist(event) {
    event.preventDefault();
    if (!requireStrictAdmin('wpisanie na Czarną Listę')) return;
    const session = window.SMPL_DB.getSession();

    const nameInp = document.getElementById('bl-input-name');
    const nickInp = document.getElementById('bl-input-nick');
    const fbInp = document.getElementById('bl-input-fb');
    const reasonInp = document.getElementById('bl-input-reason');

    const name = nameInp ? nameInp.value.trim() : '';
    const nick = nickInp ? nickInp.value.trim() : '';
    const fbProfile = fbInp ? fbInp.value.trim() : '';
    const reason = reasonInp ? reasonInp.value.trim() : '';

    if (!name && !nick) {
      showToast('Wpisz imię i nazwisko lub nick gracza!', 'error');
      return;
    }
    if (!reason) {
      showToast('Wpisz szczegółowe uzasadnienie dożywotniego bana!', 'error');
      return;
    }

    if (!confirm('Czy na pewno chcesz NADAĆ DOŻYWOTNI BAN dla ' + (name || nick) + '? Gracz zostanie TRWALE wykluczony ze wszystkich rozgrywek Score Match Ligi!')) {
      return;
    }

    try {
      window.SMPL_DB.addToBlacklist({
        name,
        nick,
        fbProfile,
        reason,
        bannedBy: session.adminName || 'Szymon Komenda (Master Admin)'
      });

      if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playGavelSound === 'function') {
        window.SMPL_NOTIF.playGavelSound();
      }

      showToast('💀 Gracz został wpisany na Czarną Listę! DOŻYWOTNI BAN aktywny.', 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd podczas dodawania do Czarnej Listy.', 'error');
    }
  }

  function handleRemoveFromBlacklist(blacklistId) {
    if (!requireStrictAdmin('zarządzanie Czarną Listą')) return;
    const session = window.SMPL_DB.getSession();

    if (!confirm('Czy na pewno chcesz zdjąć ten dożywotni ban i ułaskawić gracza?')) {
      return;
    }

    try {
      window.SMPL_DB.removeFromBlacklist(blacklistId, session.adminName || 'Szymon Komenda');
      showToast('🔓 Zdjęto gracza z Czarnej Listy.');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd podczas usuwania z Czarnej Listy.', 'error');
    }
  }

  function openBlacklistBlockedModal(errorMessage) {
    openModal(`
      <div class="p-6 sm:p-8 max-w-lg mx-auto text-center space-y-4">
        <div class="w-20 h-20 rounded-3xl bg-red-600/20 border-2 border-red-500 flex items-center justify-center text-4xl mx-auto shadow-2xl animate-pulse">
          💀
        </div>
        <div class="inline-block px-3 py-1 rounded-full bg-red-600 text-white font-display font-black text-xs uppercase tracking-widest">
          STATUS: PERSONA NON GRATA
        </div>
        <h2 class="font-display font-black text-2xl text-white uppercase tracking-tight">
          DOŻYWOTNI BAN — ZAKAZ WSTĘPU
        </h2>
        <div class="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 leading-relaxed text-left space-y-2">
          <p><strong>⛔ DECYZJA ZARZĄDU SCORE MATCH LIGA (SZYMON KOMENDA):</strong></p>
          <p>${window.SMPL_VIEWS ? window.SMPL_VIEWS.escapeHtml(errorMessage) : errorMessage}</p>
          <p class="text-[11px] text-red-300">Zgodnie z regulaminem, naruszenia zasad fair play, oszustwa w trakcie meczów i agresja skutkują bezwzględnym wykluczeniem z całej ligi.</p>
        </div>
        <div class="pt-2 flex flex-wrap gap-2 justify-center">
          <button onclick="SMPL_APP.closeModal(); SMPL_DB.unlockGateAsGuest(); SMPL_APP.switchTab('blacklist');" class="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-display font-black text-xs uppercase tracking-wider shadow-lg transition">
            💀 Zobacz Czarną Listę Ligi
          </button>
          <button onclick="SMPL_APP.closeModal()" class="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">
            Zamknij
          </button>
        </div>
      </div>
    `);
  }

  function closeRankTooltip() {
    const existing = document.getElementById('smpl-glass-tooltip-root');
    if (existing) existing.remove();
  }

  function openRankTooltipModal(playerId, triggerEl, focusBadgeId) {
    if (!window.SMPL_RANKS) return;
    const state = window.SMPL_DB.getState();
    const content = window.SMPL_RANKS.renderRankTooltipContent(playerId, state, focusBadgeId || '');
    if (!content) return;

    closeRankTooltip();

    const root = document.createElement('div');
    root.id = 'smpl-glass-tooltip-root';

    const backdrop = document.createElement('div');
    backdrop.className = 'smpl-glass-backdrop';
    backdrop.addEventListener('click', closeRankTooltip);

    const popover = document.createElement('div');
    popover.className = 'smpl-glass-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'true');
    popover.innerHTML = content;
    popover.addEventListener('click', (ev) => ev.stopPropagation());

    root.appendChild(backdrop);
    root.appendChild(popover);
    document.body.appendChild(root);

    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const pw = popover.offsetWidth || Math.min(370, vw * 0.92);
    const ph = popover.offsetHeight || 300;

    if (vw >= 640 && triggerEl && typeof triggerEl.getBoundingClientRect === 'function') {
      const rect = triggerEl.getBoundingClientRect();
      let left = rect.left;
      if (left + pw > vw - 12) left = vw - pw - 12;
      if (left < 12) left = 12;
      let top = rect.bottom + 8;
      if (top + ph > vh - 12) {
        const above = rect.top - ph - 8;
        top = above >= 12 ? above : Math.max(12, Math.round((vh - ph) / 2));
      }
      popover.style.left = Math.round(left) + 'px';
      popover.style.top = Math.round(top) + 'px';
    } else {
      popover.style.left = Math.max(10, Math.round((vw - pw) / 2)) + 'px';
      popover.style.top = Math.max(10, Math.round((vh - ph) / 2)) + 'px';
    }
  }

  function handleUpdateAdminCredentials(event) {
    if (event) event.preventDefault();
    const curEl = document.getElementById('adm-cred-current-pass');
    const userEl = document.getElementById('adm-cred-new-user');
    const emailEl = document.getElementById('adm-cred-new-email');
    const passEl = document.getElementById('adm-cred-new-pass');
    const pass2El = document.getElementById('adm-cred-new-pass2');

    const currentPassword = curEl ? curEl.value : '';
    const newUsername = userEl ? userEl.value : '';
    const newEmail = emailEl ? emailEl.value : '';
    const newPassword = passEl ? passEl.value : '';
    const newPassword2 = pass2El ? pass2El.value : '';

    if (newPassword && newPassword !== newPassword2) {
      showToast('Nowe hasła nie są identyczne!', 'error');
      return;
    }

    try {
      const res = window.SMPL_DB.updateMyAdminCredentials({
        currentPassword,
        newUsername,
        newEmail,
        newPassword
      });
      if (curEl) curEl.value = '';
      if (passEl) passEl.value = '';
      if (pass2El) pass2El.value = '';
      showToast(
        res.passwordChanged
          ? `✅ Zapisano nowy login (@${res.username}) i nowe prywatne hasło!`
          : `✅ Zapisano nowy login administratora (@${res.username})!`
      );
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się zapisać nowych danych logowania.', 'error');
    }
  }

  // =========================================================================
  // MASTER STUDIO — PEŁNE ZARZĄDZANIE RANGAMI, PORTALEM, KLANAMI I BAZĄ
  // =========================================================================
  let tempMasterClanLogo = null;

  function masterPreviewRank() {
    const prevEl = document.getElementById('master-rank-preview');
    if (!prevEl) return;
    const nameEl = document.getElementById('master-rank-name');
    const iconEl = document.getElementById('master-rank-icon');
    const colorEl = document.getElementById('master-rank-color');
    const styleEl = document.getElementById('master-rank-style');
    const nameVal = (nameEl && nameEl.value ? nameEl.value : '').trim() || 'Przykładowa Ranga';
    const iconVal = (iconEl && iconEl.value ? iconEl.value : '').trim() || '👑';
    const colorVal = (colorEl && colorEl.value ? colorEl.value : '').trim() || '#f59e0b';
    const styleVal = (styleEl && styleEl.value ? styleEl.value : 'HOLO_GOLD').trim();
    const esc = window.SMPL_VIEWS ? window.SMPL_VIEWS.escapeHtml : (s) => String(s || '');
    const varMap = {
      METALLIC: 'tt-var-metallic',
      NEON_GLOW: 'tt-var-neon',
      LIQUID_GLASS: 'tt-var-glass',
      CHROME_OBSIDIAN: 'tt-var-obsidian',
      HOLO_GOLD: 'tt-var-holo'
    };
    prevEl.className = 'smpl-title tt-custom ' + (varMap[styleVal] || 'tt-var-holo');
    prevEl.style.setProperty('--tt-accent', colorVal);
    prevEl.style.borderColor = colorVal;
    prevEl.style.color = '#ffffff';
    prevEl.style.background = 'linear-gradient(135deg, ' + colorVal + '52 0%, rgba(15,23,42,0.92) 52%, ' + colorVal + '3a 100%)';
    prevEl.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 4px rgba(0,0,0,0.5), 0 4px 14px -3px ' + colorVal + '88';
    prevEl.innerHTML = '<span class="rk-ico">' + esc(iconVal) + '</span><span class="rk-txt">' + esc(nameVal) + '</span>';
  }

  function masterApplyRankTemplate(name, icon, colorHex, styleVariant, xpBonus, description) {
    if (!requireMasterAdmin('szablon rangi')) return;
    const idEl = document.getElementById('master-rank-id');
    const nameEl = document.getElementById('master-rank-name');
    const iconEl = document.getElementById('master-rank-icon');
    const colorEl = document.getElementById('master-rank-color');
    const styleEl = document.getElementById('master-rank-style');
    const xpEl = document.getElementById('master-rank-xp');
    const descEl = document.getElementById('master-rank-desc');
    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = name || '';
    if (iconEl) iconEl.value = icon || '👑';
    if (colorEl) colorEl.value = colorHex || '#f59e0b';
    if (styleEl) styleEl.value = styleVariant || 'HOLO_GOLD';
    if (xpEl) xpEl.value = String(Number(xpBonus || 0));
    if (descEl) descEl.value = description || '';
    masterPreviewRank();
    showToast('✨ Wczytano szablon "' + (icon || '👑') + ' ' + (name || '') + '". Kliknij Zapisz, aby dodać do ligi!');
  }

  function masterPreviewAssignSelection() {
    const state = window.SMPL_DB.getState();
    const playerEl = document.getElementById('master-assign-player-id');
    const rankEl = document.getElementById('master-assign-rank-id');
    if (playerEl && playerEl.value) masterAssignPlayerId = playerEl.value;
    if (rankEl && rankEl.value) masterAssignRankId = rankEl.value;
    const playerWrap = document.getElementById('master-assign-player-current');
    const rankWrap = document.getElementById('master-assign-rank-preview');
    if (playerWrap && playerEl && window.SMPL_RANKS) {
      const pObj = (state.players || []).find((p) => p && p.id === playerEl.value);
      if (pObj) {
        const rk = window.SMPL_RANKS.getPlayerRank(pObj, state);
        playerWrap.innerHTML = window.SMPL_RANKS.fullBadgesHtml(rk, 'sm', pObj.id) || '<span class="text-[11px] text-slate-400">Brak odznak</span>';
      }
    }
    if (rankWrap && rankEl && window.SMPL_RANKS) {
      const tObj = window.SMPL_RANKS.getTitleById(rankEl.value, state);
      const esc = window.SMPL_VIEWS ? window.SMPL_VIEWS.escapeHtml : (s) => String(s || '');
      if (tObj) {
        const xpTxt = Number(tObj.xpBonus || 0) > 0 ? '<span class="text-[10px] font-bold text-emerald-300">+' + Number(tObj.xpBonus) + ' XP</span>' : '';
        const descTxt = tObj.description ? '<span class="text-[10px] text-slate-300">' + esc(tObj.description) + '</span>' : '';
        rankWrap.innerHTML = window.SMPL_RANKS.titleHtml(tObj) + xpTxt + descTxt;
      }
    }
  }

  function masterQuickSelectAssignRank(rankId) {
    const rankEl = document.getElementById('master-assign-rank-id');
    if (rankId) masterAssignRankId = rankId;
    if (rankEl && rankId) {
      rankEl.value = rankId;
      masterPreviewAssignSelection();
    }
  }

  function masterPickRankIcon(icon) {
    const iconEl = document.getElementById('master-rank-icon');
    if (iconEl) iconEl.value = icon || '👑';
    masterPreviewRank();
  }

  function masterPickRankColor(hex) {
    const colorEl = document.getElementById('master-rank-color');
    if (colorEl) colorEl.value = hex || '#f59e0b';
    masterPreviewRank();
  }

  function masterResetRankForm() {
    const idEl = document.getElementById('master-rank-id');
    const nameEl = document.getElementById('master-rank-name');
    const iconEl = document.getElementById('master-rank-icon');
    const colorEl = document.getElementById('master-rank-color');
    const styleEl = document.getElementById('master-rank-style');
    const xpEl = document.getElementById('master-rank-xp');
    const descEl = document.getElementById('master-rank-desc');
    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = '';
    if (iconEl) iconEl.value = '👑';
    if (colorEl) colorEl.value = '#f59e0b';
    if (styleEl) styleEl.value = 'HOLO_GOLD';
    if (xpEl) xpEl.value = '150';
    if (descEl) descEl.value = '';
    masterPreviewRank();
  }

  function masterEditCustomRank(rankId) {
    if (!requireMasterAdmin('edycja własnej rangi')) return;
    const state = window.SMPL_DB.getState();
    const cr = ((state && state.customRanks) || []).find((r) => r && r.id === rankId);
    if (!cr) return;
    const idEl = document.getElementById('master-rank-id');
    const nameEl = document.getElementById('master-rank-name');
    const iconEl = document.getElementById('master-rank-icon');
    const colorEl = document.getElementById('master-rank-color');
    const styleEl = document.getElementById('master-rank-style');
    const xpEl = document.getElementById('master-rank-xp');
    const descEl = document.getElementById('master-rank-desc');
    if (idEl) idEl.value = cr.id || '';
    if (nameEl) nameEl.value = cr.name || '';
    if (iconEl) iconEl.value = cr.icon || '👑';
    if (colorEl) colorEl.value = cr.colorHex || '#f59e0b';
    if (styleEl) styleEl.value = cr.styleVariant || 'HOLO_GOLD';
    if (xpEl) xpEl.value = String(Number(cr.xpBonus || 0));
    if (descEl) descEl.value = cr.description || '';
    masterPreviewRank();
    showToast('✏️ Wczytano rangę "' + cr.name + '" do edytora.');
  }

  function masterSaveCustomRankSubmit() {
    if (!requireMasterAdmin('zapisanie własnej rangi')) return;
    const session = window.SMPL_DB.getSession();
    const idEl = document.getElementById('master-rank-id');
    const nameEl = document.getElementById('master-rank-name');
    const iconEl = document.getElementById('master-rank-icon');
    const colorEl = document.getElementById('master-rank-color');
    const styleEl = document.getElementById('master-rank-style');
    const xpEl = document.getElementById('master-rank-xp');
    const descEl = document.getElementById('master-rank-desc');
    try {
      const saved = window.SMPL_DB.masterSaveCustomRank(
        {
          id: idEl ? idEl.value : '',
          name: nameEl ? nameEl.value : '',
          icon: iconEl ? iconEl.value : '👑',
          colorHex: colorEl ? colorEl.value : '#f59e0b',
          styleVariant: styleEl ? styleEl.value : 'HOLO_GOLD',
          xpBonus: xpEl ? Number(xpEl.value || 0) : 0,
          description: descEl ? descEl.value : ''
        },
        session.adminName || 'Szymon Komenda'
      );
      showToast('✅ Zapisano rangę: ' + saved.icon + ' ' + saved.name + ' (+' + Number(saved.xpBonus || 0) + ' XP)!');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się zapisać rangi.', 'error');
    }
  }

  function masterDeleteCustomRank(rankId) {
    if (!requireMasterAdmin('usunięcie rangi')) return;
    const session = window.SMPL_DB.getSession();
    try {
      window.SMPL_DB.masterDeleteCustomRank(rankId, session.adminName || 'Szymon Komenda');
      showToast('🗑️ Usunięto wybraną rangę specjalną.');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się usunąć rangi.', 'error');
    }
  }

  function masterAssignRankSubmit(mode) {
    if (!requireMasterAdmin('nadawanie rang graczom')) return;
    const session = window.SMPL_DB.getSession();
    const playerEl = document.getElementById('master-assign-player-id');
    const rankEl = document.getElementById('master-assign-rank-id');
    const playerId = playerEl ? playerEl.value : '';
    const rankId = rankEl ? rankEl.value : '';
    if (playerId) masterAssignPlayerId = playerId;
    if (rankId) masterAssignRankId = rankId;
    try {
      window.SMPL_DB.masterAssignRankToPlayer(
        playerId,
        rankId,
        mode || 'primary',
        session.adminName || 'Szymon Komenda'
      );
      showToast('✅ Zaktualizowano rangi wybranego zawodnika!');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się przypisać rangi.', 'error');
    }
  }

  function masterSavePortalSettingsSubmit() {
    if (!requireMasterAdmin('zapisanie globalnych ustawień portalu')) return;
    const session = window.SMPL_DB.getSession();
    const seasonEl = document.getElementById('master-cfg-season');
    const weekEl = document.getElementById('master-cfg-week');
    const rpwEl = document.getElementById('master-cfg-rpw');
    const seasonNameEl = document.getElementById('master-cfg-season-name');
    const badgeEl = document.getElementById('master-cfg-hero-badge');
    const titleEl = document.getElementById('master-cfg-hero-title');
    const subtitleEl = document.getElementById('master-cfg-hero-subtitle');
    const annActiveEl = document.getElementById('master-cfg-announce-active');
    const annTextEl = document.getElementById('master-cfg-announce-text');
    const maintActiveEl = document.getElementById('master-cfg-maint-active');
    const maintMsgEl = document.getElementById('master-cfg-maint-msg');

    try {
      window.SMPL_DB.masterUpdatePortalSettings(
        {
          season: seasonEl ? Number(seasonEl.value || 56) : undefined,
          currentWeek: weekEl ? Number(weekEl.value || 1) : undefined,
          roundsPerWeek: rpwEl ? Number(rpwEl.value || 4) : undefined,
          seasonName: seasonNameEl ? seasonNameEl.value : undefined,
          heroBadge: badgeEl ? badgeEl.value : '',
          heroTitle: titleEl ? titleEl.value : '',
          heroSubtitle: subtitleEl ? subtitleEl.value : '',
          announcementActive: annActiveEl ? Boolean(annActiveEl.checked) : false,
          announcementText: annTextEl ? annTextEl.value : '',
          maintenanceMode: maintActiveEl ? Boolean(maintActiveEl.checked) : undefined,
          maintenanceMessage: maintMsgEl ? maintMsgEl.value : undefined
        },
        session.adminName || 'Szymon Komenda'
      );
      showToast('✅ Zapisano globalne ustawienia portalu SMPL!');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd zapisu ustawień portalu.', 'error');
    }
  }

  function masterHandleClanLogoFile(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    clanFileToDataUrl(file, 240).then(function (dataUrl) {
      tempMasterClanLogo = dataUrl;
      const img = document.getElementById('master-clan-logo-preview');
      if (img) img.src = tempMasterClanLogo;
      const clr = document.getElementById('master-clan-clear-logo');
      if (clr) clr.checked = false;
      showToast('🛡️ Wczytano nowe logo klanu — kliknij Zapisz Klan.');
    });
  }

  function masterResetClanForm() {
    tempMasterClanLogo = null;
    const idEl = document.getElementById('master-clan-id');
    const nameEl = document.getElementById('master-clan-name');
    const tagEl = document.getElementById('master-clan-tag');
    const colorEl = document.getElementById('master-clan-color');
    const clrEl = document.getElementById('master-clan-clear-logo');
    const fileEl = document.getElementById('master-clan-logo-file');
    const img = document.getElementById('master-clan-logo-preview');
    if (idEl) idEl.value = '';
    if (nameEl) nameEl.value = '';
    if (tagEl) tagEl.value = '';
    if (colorEl) colorEl.value = '#10B981';
    if (clrEl) clrEl.checked = false;
    if (fileEl) fileEl.value = '';
    if (img && window.SMPL_MEDIA && typeof window.SMPL_MEDIA.createClanEmblemSVG === 'function') {
      img.src = window.SMPL_MEDIA.createClanEmblemSVG('Nowy Klan', 'SMPL', '#10B981', '#064E3B');
    }
  }

  function masterEditClan(clanId) {
    if (!requireMasterAdmin('edycja klanu')) return;
    const state = window.SMPL_DB.getState();
    const list = typeof window.SMPL_DB.getClansList === 'function' ? window.SMPL_DB.getClansList(state) : (state.clans || []);
    const c = list.find((item) => item && item.id === clanId);
    if (!c) return;
    tempMasterClanLogo = null;
    const idEl = document.getElementById('master-clan-id');
    const nameEl = document.getElementById('master-clan-name');
    const tagEl = document.getElementById('master-clan-tag');
    const colorEl = document.getElementById('master-clan-color');
    const clrEl = document.getElementById('master-clan-clear-logo');
    const img = document.getElementById('master-clan-logo-preview');
    if (idEl) idEl.value = c.id || '';
    if (nameEl) nameEl.value = c.name || '';
    if (tagEl) tagEl.value = c.tag || '';
    if (colorEl) colorEl.value = c.primaryColor || '#10B981';
    if (clrEl) clrEl.checked = false;
    if (img && typeof window.SMPL_DB.resolveClanLogo === 'function') {
      img.src = window.SMPL_DB.resolveClanLogo(c);
    }
    showToast('✏️ Wczytano klan "' + c.name + '" do edycji.');
  }

  function masterSaveClanSubmit() {
    if (!requireMasterAdmin('zapisanie klanu')) return;
    const session = window.SMPL_DB.getSession();
    const idEl = document.getElementById('master-clan-id');
    const nameEl = document.getElementById('master-clan-name');
    const tagEl = document.getElementById('master-clan-tag');
    const colorEl = document.getElementById('master-clan-color');
    const clrEl = document.getElementById('master-clan-clear-logo');

    try {
      const saved = window.SMPL_DB.masterSaveClan(
        {
          id: idEl ? idEl.value : '',
          name: nameEl ? nameEl.value : '',
          tag: tagEl ? tagEl.value : '',
          primaryColor: colorEl ? colorEl.value : '#10B981',
          logo: tempMasterClanLogo || undefined,
          clearLogo: clrEl ? Boolean(clrEl.checked) : false
        },
        session.adminName || 'Szymon Komenda'
      );
      tempMasterClanLogo = null;
      showToast('✅ Zapisano klan: ' + saved.name + '!');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się zapisać klanu.', 'error');
    }
  }

  function masterDeleteClan(clanId) {
    if (!requireMasterAdmin('usunięcie klanu')) return;
    const session = window.SMPL_DB.getSession();
    try {
      window.SMPL_DB.masterDeleteClan(clanId, session.adminName || 'Szymon Komenda');
      showToast('🗑️ Usunięto klan z listy.');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się usunąć klanu.', 'error');
    }
  }

  function masterSaveLeagueSubmit(leagueId) {
    if (!requireMasterAdmin('edycja ustawień ligi')) return;
    const session = window.SMPL_DB.getSession();
    const nameEl = document.getElementById('master-lg-name-' + leagueId);
    const shortEl = document.getElementById('master-lg-short-' + leagueId);
    const colorEl = document.getElementById('master-lg-color-' + leagueId);
    const adminEl = document.getElementById('master-lg-admin-' + leagueId);
    try {
      const lg = window.SMPL_DB.masterUpdateLeague(
        leagueId,
        {
          name: nameEl ? nameEl.value : '',
          shortName: shortEl ? shortEl.value : '',
          primaryColor: colorEl ? colorEl.value : undefined,
          adminName: adminEl ? adminEl.value : ''
        },
        session.adminName || 'Szymon Komenda'
      );
      showToast('✅ Zaktualizowano ligę ' + lg.id + ' (' + lg.shortName + ')!');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Nie udało się zaktualizować ligi.', 'error');
    }
  }

  function masterGoldenBallAction(action) {
    if (!requireMasterAdmin('zarządzanie Złotą Piłką')) return;
    const session = window.SMPL_DB.getSession();
    try {
      window.SMPL_DB.masterManageGoldenBall(action, session.adminName || 'Szymon Komenda');
      showToast('🏆 Złota Piłka zaktualizowana (' + action + ').');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd akcji Złotej Piłki.', 'error');
    }
  }

  function masterImportDatabaseFile(event) {
    if (!requireMasterAdmin('import bazy JSON')) return;
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    const session = window.SMPL_DB.getSession();
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const rawText = ev && ev.target ? ev.target.result : '';
        const res = window.SMPL_DB.masterImportDatabaseJson(rawText, session.adminName || 'Szymon Komenda');
        const cnt = res && Array.isArray(res.players) ? res.players.length : 0;
        showToast('✅ Przywrócono bazę JSON! Gracze: ' + cnt + ', Sezon ' + ((res && res.season) || 56) + '.');
        renderAll();
      } catch (err) {
        showToast(err.message || 'Błąd odczytu pliku JSON.', 'error');
      }
    };
    reader.readAsText(file);
  }

  function handleUtCardTilt(ev, el) {
    if (!el || !ev) return;
    if (ev.pointerType && ev.pointerType !== 'mouse') return;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}
    const rect = el.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const px = Math.max(0.18, Math.min(0.82, (ev.clientX - rect.left) / rect.width));
    const py = Math.max(0.08, Math.min(0.60, (ev.clientY - rect.top) / rect.height));
    el.style.setProperty('--ut-mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--ut-my', (py * 100).toFixed(1) + '%');
  }

  function resetUtCardTilt(el) {
    if (!el) return;
    el.style.setProperty('--ut-mx', '50%');
    el.style.setProperty('--ut-my', '14%');
  }

  // =========================================================================
  // MODUŁY ROZSZERZEŃ SMPL STUDIO (18 FUNKCJI: PNG, KIEDY GRAMY, VAR, COINS, WRAPPED, TOTW, BARAŻE, SUPERCUP, BLITZ, TV, GAZETA, DRAFT, ZASTĘPSTWO, WEBHOOKS, SNAPSHOTY, AI OCR, CSV)
  // =========================================================================
  function getCurrentAdminDisplayName() {
    const sess = window.SMPL_DB ? window.SMPL_DB.getSession() : null;
    return (sess && sess.adminName) || 'Szymon Komenda';
  }

  function studioEsc(v) {
    return (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.escapeHtml === 'function')
      ? window.SMPL_VIEWS.escapeHtml(v)
      : String(v == null ? '' : v);
  }

  let _lastGeneratedPoster = null;

  function openPosterPreviewModal(poster) {
    if (!poster || !poster.dataUrl || typeof openModal !== 'function') return;
    const escFn = (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.escapeHtml === 'function')
      ? window.SMPL_VIEWS.escapeHtml
      : function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    const safeTitle = escFn(poster.title || 'Grafika SMPL PNG');
    const safeFile = escFn(poster.filename || 'smpl-grafika.png');
    const backBtnHtml = poster.backWrappedPlayerId
      ? `<button type="button" onclick="SMPL_APP.openSmplWrappedModal('${escFn(poster.backWrappedPlayerId)}')" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 font-display font-bold text-xs uppercase">← Wróć do Wrapped</button>`
      : '';
    const shareBtnHtml = (typeof navigator !== 'undefined' && typeof navigator.share === 'function')
      ? `<button type="button" onclick="SMPL_APP.shareLastGeneratedPng()" class="px-4 py-2.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 font-display font-black text-xs uppercase">📤 Udostępnij / Zapisz</button>`
      : '';
    const html = `
      <div class="p-4 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[10px] font-display font-black uppercase">📸 STUDIO GRAFIK PNG</span>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase mt-1">${safeTitle}</h3>
            <div class="text-xs text-slate-400 font-mono-num">${safeFile}</div>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold">✕</button>
        </div>
        <div class="p-2.5 rounded-xl bg-slate-950 border border-white/10 text-center">
          <img src="${poster.dataUrl}" alt="${safeFile}" class="w-full rounded-xl" style="max-height:60vh;object-fit:contain;margin:0 auto;display:block;" />
        </div>
        <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 text-xs text-slate-300">
          💡 Jeśli przeglądarka na telefonie lub w Messengerze zablokowała automatyczny zapis: kliknij <strong>Pobierz PNG</strong> / <strong>Udostępnij</strong> albo przytrzymaj grafikę palcem ➔ <em>Zapisz zdjęcie</em>.
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
          ${backBtnHtml}
          ${shareBtnHtml}
          <button type="button" onclick="SMPL_APP.downloadLastGeneratedPng()" class="btn-league px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase">💾 Pobierz PNG</button>
        </div>
      </div>
    `;
    openModal(html);
  }

  function downloadLastGeneratedPng() {
    if (!_lastGeneratedPoster || !_lastGeneratedPoster.dataUrl || !window.SMPL_STUDIO) {
      showToast('Brak wygenerowanej grafiki do pobrania.', 'error');
      return false;
    }
    const ok = window.SMPL_STUDIO.downloadPngDataUrl(_lastGeneratedPoster.dataUrl, _lastGeneratedPoster.filename);
    if (ok) showToast('📸 Ponowiono pobieranie: ' + _lastGeneratedPoster.filename);
    else showToast('Nie udało się zapisać pliku bezpośrednio — użyj Udostępnij lub przytrzymaj obraz.', 'error');
    return ok;
  }

  function shareLastGeneratedPng() {
    if (!_lastGeneratedPoster || !_lastGeneratedPoster.dataUrl || !window.SMPL_STUDIO) return Promise.resolve(false);
    try {
      const blob = typeof window.SMPL_STUDIO.dataUrlToBlob === 'function'
        ? window.SMPL_STUDIO.dataUrlToBlob(_lastGeneratedPoster.dataUrl)
        : null;
      if (blob && typeof File === 'function' && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        const file = new File([blob], _lastGeneratedPoster.filename || 'smpl-grafika.png', { type: 'image/png' });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: _lastGeneratedPoster.title || 'Grafika SMPL' })
            .then(function () { return true; })
            .catch(function () { return downloadLastGeneratedPng(); });
        }
      }
    } catch (e) {}
    return Promise.resolve(downloadLastGeneratedPng());
  }

  function handlePosterPngDownload(promise, fallbackFilename, successMsg, failMsg, previewMeta) {
    var p = (promise && typeof promise.then === 'function') ? promise : Promise.resolve(promise);
    return p
      .then(function (res) {
        var dataUrl = (res && typeof res === 'object') ? (res.dataUrl || '') : (typeof res === 'string' ? res : '');
        if (!res || (typeof res === 'object' && res.ok === false) || !dataUrl) {
          throw new Error((res && res.error) || failMsg);
        }
        var outName = (res && typeof res === 'object' && res.filename) ? res.filename : fallbackFilename;
        _lastGeneratedPoster = {
          dataUrl: dataUrl,
          filename: outName,
          title: (previewMeta && previewMeta.title) || 'Grafika SMPL PNG',
          backWrappedPlayerId: (previewMeta && previewMeta.wrappedPlayerId) || ''
        };
        var dlOk = window.SMPL_STUDIO.downloadPngDataUrl(dataUrl, outName);
        openPosterPreviewModal(_lastGeneratedPoster);
        if (dlOk) {
          showToast(successMsg);
        } else {
          showToast('🖼️ Wygenerowano grafikę! Zapisz ją z okna podglądu.', 'info');
        }
        return true;
      })
      .catch(function (err) {
        showToast((err && err.message) || failMsg, 'error');
        return false;
      });
  }

  function downloadStandingsPosterPng(leagueId) {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.generateStandingsPosterPng !== 'function') {
      showToast('Studio Grafik PNG jest niedostępne.', 'error');
      return Promise.resolve(false);
    }
    const state = window.SMPL_DB.getState();
    const sess = window.SMPL_DB.getSession();
    const viewerPl = resolveNotificationTargetPlayer(state, sess);
    const viewerPid = (viewerPl && viewerPl.id) || (sess && sess.activePlayerId) || null;
    showToast('🎨 Generowanie grafiki tabeli ' + (leagueId || 'L1') + ' (PNG)...');
    return handlePosterPngDownload(
      window.SMPL_STUDIO.generateStandingsPosterPng(state, leagueId, viewerPid),
      'smpl-tabela-' + (leagueId || 'L1') + '-s' + (state.season || 56) + '.png',
      '📸 Pobrano grafikę tabeli PNG!',
      'Błąd generowania PNG.',
      { title: 'Tabela Ligi ' + (leagueId || 'L1') + ' (Sezon ' + (state.season || 56) + ')' }
    );
  }

  function downloadMatchdayPosterPng(matchId) {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.generateMatchdayPosterPng !== 'function') {
      showToast('Studio Grafik PNG jest niedostępne.', 'error');
      return Promise.resolve(false);
    }
    const state = window.SMPL_DB.getState();
    const sess = window.SMPL_DB.getSession();
    const viewerPl = resolveNotificationTargetPlayer(state, sess);
    const viewerPid = (viewerPl && viewerPl.id) || (sess && sess.activePlayerId) || null;
    showToast('🎨 Generowanie karty VS meczu (PNG)...');
    return handlePosterPngDownload(
      window.SMPL_STUDIO.generateMatchdayPosterPng(state, matchId, viewerPid),
      'smpl-mecz-' + matchId + '.png',
      '📸 Pobrano kartę VS PNG!',
      'Błąd generowania karty VS.',
      { title: 'Karta VS Meczu (' + matchId + ')' }
    );
  }

  function downloadUtCardPosterPng(playerId) {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.generateUtCardPosterPng !== 'function') {
      showToast('Studio Grafik PNG jest niedostępne.', 'error');
      return Promise.resolve(false);
    }
    const state = window.SMPL_DB.getState();
    showToast('🎨 Renderowanie Karty UT PNG...');
    return handlePosterPngDownload(
      window.SMPL_STUDIO.generateUtCardPosterPng(state, playerId),
      'smpl-karta-ut-' + playerId + '.png',
      '📸 Pobrano Kartę UT PNG!',
      'Błąd generowania Karty UT.',
      { title: 'Karta Ultimate Team PNG' }
    );
  }

  function downloadWrappedPosterPng(playerId) {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.buildSmplWrappedData !== 'function') {
      showToast('Moduł SMPL Wrapped jest niedostępny.', 'error');
      return Promise.resolve(false);
    }
    const state = window.SMPL_DB.getState();
    const wrapped = window.SMPL_STUDIO.buildSmplWrappedData(state, playerId);
    if (!wrapped) {
      showToast('Nie znaleziono danych gracza do SMPL Wrapped.', 'error');
      return Promise.resolve(false);
    }
    showToast('🎨 Tworzenie plakatu SMPL Wrapped PNG...');
    return handlePosterPngDownload(
      window.SMPL_STUDIO.generateWrappedPosterPng(wrapped),
      'smpl-wrapped-' + playerId + '-s' + (state.season || 56) + '.png',
      '🎁 Pobrano plakat SMPL Wrapped PNG!',
      'Błąd generowania SMPL Wrapped.',
      { title: 'Plakat SMPL Wrapped — Sezon ' + (state.season || 56), wrappedPlayerId: String(playerId || '') }
    );
  }

  function exportStandingsCsv(leagueId) {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.exportStandingsCsv !== 'function') return;
    window.SMPL_STUDIO.exportStandingsCsv(window.SMPL_DB.getState(), leagueId);
    showToast('📊 Wyeksportowano tabelę ' + (leagueId || 'L1') + ' do CSV (Polski Excel ; + BOM)!');
  }

  function exportArchiveRankingCsv(rankingKey) {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.exportArchiveRankingCsv !== 'function') return;
    const state = window.SMPL_DB.getState();
    const arch = window.SMPL_ARCHIVE_DATA || {};
    let rows = [];
    if (rankingKey === 'ALL_TIME') rows = state.allTimeRanking || arch.ALL_TIME_RANKING || [];
    else if (rankingKey === 'CAREER') rows = state.careerRanking || arch.CAREER_RANKING || [];
    else if (rankingKey === 'GENERAL') rows = state.generalRanking || arch.GENERAL_RANKING || [];
    else if (rankingKey === 'FIVE_SEASONS') rows = state.fiveSeasonRanking || arch.FIVE_SEASON_RANKING || [];
    window.SMPL_STUDIO.exportArchiveRankingCsv(rankingKey, rows);
    showToast('📊 Wyeksportowano ranking archiwalny ' + rankingKey + ' do CSV!');
  }

  function exportDisciplinaryLogCsv() {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.exportDisciplinaryLogCsv !== 'function') return;
    window.SMPL_STUDIO.exportDisciplinaryLogCsv(window.SMPL_DB.getState());
    showToast('📊 Wyeksportowano Log Dyscyplinarny do CSV!');
  }

  function printCurrentView() {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  function openMatchProposalModal(matchId) {
    const state = window.SMPL_DB.getState();
    const m = (state.matches || []).find((x) => x && x.id === matchId);
    if (!m) {
      showToast('Nie znaleziono meczu.', 'error');
      return;
    }
    const pMap = {};
    (state.players || []).forEach((p) => { if (p) pMap[p.id] = p; });
    const hp = pMap[m.homeId] || { name: 'Gospodarz' };
    const ap = pMap[m.awayId] || { name: 'Gość' };
    const html = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg text-white uppercase">📅 Kiedy Gramy? — Propozycja Terminu</h3>
            <p class="text-xs text-slate-300 mt-0.5">K${Number(m.round || 0)}: <strong>${studioEsc(hp.name)}</strong> vs <strong>${studioEsc(ap.name)}</strong></p>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold">✕</button>
        </div>
        <form onsubmit="SMPL_APP.submitMatchProposalForm(event, '${studioEsc(matchId)}')" class="space-y-3 text-xs">
          <div>
            <label class="block font-display font-bold uppercase text-amber-300 mb-1">Proponowane terminy (do 3 slotów)</label>
            <input name="slot1" type="text" required placeholder="np. Dziś 20:30" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white mb-2"/>
            <input name="slot2" type="text" placeholder="np. Jutro 19:00 (opcjonalnie)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white mb-2"/>
            <input name="slot3" type="text" placeholder="np. Weekend 18:00–21:00 (opcjonalnie)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"/>
          </div>
          <div>
            <label class="block font-display font-bold uppercase text-slate-300 mb-1">Notatka do rywala / Admina (dowód aktywności pod 2:0 WO)</label>
            <textarea name="note" rows="2" maxlength="180" placeholder="np. Jestem dostępny wieczorami od 20:00 na WhatsApp/Discord..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold uppercase">Anuluj</button>
            <button type="submit" class="btn-league px-5 py-2 rounded-xl font-display font-black uppercase">📅 Wyślij Propozycję</button>
          </div>
        </form>
      </div>
    `;
    openModal(html);
  }

  function submitMatchProposalForm(event, matchId) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    const slots = [
      form.slot1 ? form.slot1.value : '',
      form.slot2 ? form.slot2.value : '',
      form.slot3 ? form.slot3.value : ''
    ].map((s) => String(s || '').trim()).filter(Boolean);
    const note = form.note ? form.note.value : '';
    try {
      const res = window.SMPL_DB.proposeMatchTime({ matchId: matchId, slots: slots, note: note });
      closeModal();
      showToast('📅 Wysłano propozycję terminu „Kiedy Gramy?” do rywala!');
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then(() => { if (window.SMPL_DB.pullFromServer) window.SMPL_DB.pullFromServer(true); });
      }
    } catch (err) {
      showToast((err && err.message) || 'Błąd wysyłania propozycji.', 'error');
    }
  }

  function respondToMatchProposal(proposalId, decision, chosenSlot) {
    try {
      const res = window.SMPL_DB.respondMatchProposal({ proposalId: proposalId, decision: decision || 'ACCEPT', chosenSlot: chosenSlot || '', note: '' });
      showToast(decision === 'DECLINE' ? '❌ Odrzucono propozycję terminu.' : '✅ Zaakceptowano termin meczu: ' + (chosenSlot || ''));
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then(() => { if (window.SMPL_DB.pullFromServer) window.SMPL_DB.pullFromServer(true); });
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się odpowiedzieć na propozycję.', 'error');
    }
  }

  function handleDisputeScreenUpload(event) {
    _handleEvidenceImageUpload(event, 'dispute-screen-preview', (dataUrl) => {
      disputeDraftScreenshot = dataUrl;
    });
  }

  function openMatchDisputeModal(matchId) {
    const state = window.SMPL_DB.getState();
    const m = (state.matches || []).find((x) => x && x.id === matchId);
    if (!m) {
      showToast('Nie znaleziono meczu.', 'error');
      return;
    }
    disputeDraftScreenshot = '';
    const html = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg text-rose-300 uppercase">🚩 Zgłoś Spór / VAR &amp; Wniosek o W.O. (+SS)</h3>
            <p class="text-xs text-slate-300 mt-0.5">Sprawa trafi bezpośrednio do Trybunału VAR Administracji SMPL (limit 48h na odpowiedź).</p>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold">✕</button>
        </div>
        <form onsubmit="SMPL_APP.submitMatchDisputeForm(event, '${studioEsc(matchId)}')" class="space-y-3 text-xs">
          <div>
            <label class="block font-display font-bold uppercase text-amber-300 mb-1">Powód zgłoszenia VAR / W.O.</label>
            <select name="reasonType" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-bold">
              <option value="NO_SHOW_48H">⏱️ Rywal nie odpowiada na Messengerze / brak gry (W.O.)</option>
              <option value="DISCONNECT">📶 Rozłączenie / Rage quit w trakcie meczu</option>
              <option value="SCORE_DISPUTE">❌ Spór o wpisany wynik</option>
              <option value="APPEAL_7D">📜 Odwołanie od decyzji / Walkowera (7 dni)</option>
              <option value="OTHER">🔍 Inne naruszenie zasad</option>
            </select>
          </div>
          <div>
            <label class="block font-display font-bold uppercase text-slate-300 mb-1">Opis zdarzenia — dlaczego? (min. 6 znaków) *</label>
            <textarea name="description" rows="3" required minlength="6" maxlength="420" placeholder="Opisz dokładnie co się stało (np. daty wiadomości na Messengerze, minuta rozłączenia)..." class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"></textarea>
          </div>
          <div class="p-3 rounded-xl bg-slate-950/90 border border-rose-500/40 space-y-2">
            <label class="block font-display font-bold uppercase text-rose-300">
              📸 Dowód — SS dlaczego (WYMAGANY zrzut ekranu) *
            </label>
            <p class="text-[11px] text-slate-400 leading-relaxed">
              Załącz screen rozmowy na Messengerze z datami/godzinami (przy W.O. / 48h) albo zrzut z gry potwierdzający rozłączenie lub wynik. Bez SS zgłoszenie nie zostanie wysłane.
            </p>
            <input id="dispute-screen-input" type="file" accept="image/*" required onchange="SMPL_APP.handleDisputeScreenUpload(event)" class="w-full text-[11px] text-slate-200 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-rose-600/35 file:text-rose-100 file:font-bold"/>
            <div id="dispute-screen-preview" class="text-[11px] text-amber-300 font-semibold">
              ⚠️ Brak załączonego SS — wybierz obrazek przed wysłaniem.
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold uppercase">Anuluj</button>
            <button type="submit" class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-black uppercase">🚩 Wyślij do VAR (+SS)</button>
          </div>
        </form>
      </div>
    `;
    openModal(html);
  }

  function submitMatchDisputeForm(event, matchId) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    if (!disputeDraftScreenshot || !/^data:image\//i.test(String(disputeDraftScreenshot))) {
      showToast('📸 Obowiązkowo załącz zrzut ekranu (SS dlaczego) przed wysłaniem sporu VAR / W.O.!', 'error');
      return;
    }
    try {
      const res = window.SMPL_DB.submitMatchDispute({
        matchId: matchId,
        reasonType: form.reasonType ? form.reasonType.value : 'OTHER',
        description: form.description ? form.description.value : '',
        screenshot: disputeDraftScreenshot
      });
      disputeDraftScreenshot = '';
      closeModal();
      showToast('🚩 Zgłoszenie VAR (+SS) zostało wysłane do Administracji!');
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then(() => { if (window.SMPL_DB.pullFromServer) window.SMPL_DB.pullFromServer(true); });
      }
    } catch (err) {
      showToast((err && err.message) || 'Błąd wysyłania sporu VAR.', 'error');
    }
  }

  function adminResolveDispute(disputeId, decision) {
    try {
      window.SMPL_DB.resolveMatchDispute(disputeId, decision, 'Decyzja VAR: ' + decision, getCurrentAdminDisplayName());
      showToast('⚖️ Spór VAR rozstrzygnięty (' + decision + ')!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd rozstrzygania sporu VAR.', 'error');
    }
  }

  function voteMatchFanPoll(matchId, pick) {
    try {
      const res = window.SMPL_DB.voteFanPoll({ matchId: matchId, pick: pick });
      showToast('🗳️ Oddano głos kibica na typ ' + (pick === 'HOME' ? '1' : pick === 'AWAY' ? '2' : 'X') + '!');
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then(() => {});
      }
    } catch (err) {
      showToast((err && err.message) || 'Zaloguj się, aby głosować.', 'error');
    }
  }

  let coinShopCategoryFilter = 'all';

  function setCoinShopCategory(cat) {
    coinShopCategoryFilter = String(cat || 'all');
    openCoinShopModal(coinShopCategoryFilter);
  }

  function previewShopSound(soundValue) {
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playShopSound === 'function') {
      const played = window.SMPL_NOTIF.playShopSound(soundValue, true);
      if (!played) {
        showToast('🔊 Podgląd dźwięku Web Audio wymaga obsługi dźwięku w tej przeglądarce.', 'info');
      }
    }
  }

  function openCoinShopModal(categoryFilter) {
    if (categoryFilter !== undefined) {
      coinShopCategoryFilter = String(categoryFilter || 'all');
    }
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const isMasterOwner = Boolean(session && window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session) && session.adminRole === 'MASTER_ADMIN');
    const resolvedPl = resolveNotificationTargetPlayer(state, session);
    const pid = (resolvedPl && resolvedPl.id) || (session && session.activePlayerId) || null;
    if (!pid || !window.SMPL_STUDIO) {
      if (isMasterOwner && window.SMPL_STUDIO) {
        openMasterGrantCoinsModal('');
        return;
      }
      showToast('Sklepik SMPL Loyalty Coins dostępny jest dla przypisanych zawodników.', 'error');
      return;
    }
    const currentSeason = Number(state.season || 56);
    const coins = window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, pid);
    const cos = window.SMPL_STUDIO.getPlayerCosmetics(state, pid);
    const catalog = window.SMPL_STUDIO.SHOP_CATALOG || [];
    const quests = (typeof window.SMPL_STUDIO.computePlayerWeeklyQuests === 'function')
      ? window.SMPL_STUDIO.computePlayerWeeklyQuests(state, pid)
      : [];
    const claimableCount = quests.filter((q) => q.claimable).length;
    const dropItems = catalog.filter((x) => Boolean(x.seasonOnly));
    const tabs = [
      { id: 'all', label: 'Wszystkie', cnt: catalog.length },
      { id: 'drops', label: '⏳ Drop S' + currentSeason, cnt: dropItems.length },
      { id: 'frame', label: '🖼️ Ramki UT', cnt: catalog.filter((x) => x.category === 'frame').length },
      { id: 'bg', label: '🏟️ Tła', cnt: catalog.filter((x) => x.category === 'bg').length },
      { id: 'poster', label: '🎨 Skórki PNG', cnt: catalog.filter((x) => x.category === 'poster').length },
      { id: 'badge', label: '🎯 Odznaki', cnt: catalog.filter((x) => x.category === 'badge').length },
      { id: 'nickfx', label: '✨ Blask Nicku', cnt: catalog.filter((x) => x.category === 'nickfx').length },
      { id: 'title', label: '🏷️ Tytuły', cnt: catalog.filter((x) => x.category === 'title').length },
      { id: 'sound', label: '🔊 Dźwięki', cnt: catalog.filter((x) => x.category === 'sound').length },
      { id: 'quests', label: '🎯 Wyzwania', cnt: claimableCount > 0 ? ('+' + claimableCount) : quests.length },
      { id: 'gift', label: '🎁 Wyślij Prezent', cnt: '' }
    ];
    const presetTitles = catalog
      .filter((x) => x.category === 'title' && x.value !== 'custom')
      .map((x) => x.value);
    const ownedCount = cos.unlockedItems.length;
    const tabsHtml = tabs.map((t) => {
      const active = coinShopCategoryFilter === t.id;
      const cntTxt = t.cnt !== '' ? (' (' + t.cnt + ')') : '';
      return '<button type="button" onclick="SMPL_APP.setCoinShopCategory(\'' + studioEsc(t.id) + '\')" class="smpl-shop-tab ' + (active ? 'smpl-shop-tab-active' : '') + '">' + studioEsc(t.label) + cntTxt + '</button>';
    }).join('');

    let bodyHtml = '';
    if (coinShopCategoryFilter === 'quests') {
      const questRowsHtml = quests.map((q) => {
        const cls = q.done ? 'smpl-quest-card smpl-quest-done' : 'smpl-quest-card';
        let btnHtml = '<span class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 font-bold">⏳ ' + q.progress + '/' + q.target + '</span>';
        if (q.claimed) {
          btnHtml = '<span class="px-2.5 py-1 rounded-lg bg-emerald-600/35 text-emerald-200 font-bold">✅ Odebrano (+' + q.reward + ')</span>';
        } else if (q.claimable) {
          btnHtml = '<button type="button" onclick="SMPL_APP.handleClaimShopQuest(\'' + studioEsc(q.id) + '\')" class="btn-league px-3 py-1.5 rounded-lg font-display font-black uppercase">🪙 Odbierz +' + q.reward + ' Coins</button>';
        }
        return (
          '<div class="' + cls + ' flex flex-wrap items-center justify-between gap-2">' +
            '<div class="min-w-0 flex-1">' +
              '<div class="font-display font-bold text-white">' + studioEsc(q.icon) + ' ' + studioEsc(q.title) + ' <span class="text-amber-300">(+' + q.reward + ' Coins)</span></div>' +
              '<div class="text-[11px] text-slate-300 mt-0.5">' + studioEsc(q.desc) + ' • Postęp: <strong class="text-white">' + q.progress + ' / ' + q.target + '</strong></div>' +
            '</div>' +
            '<div class="flex-shrink-0">' + btnHtml + '</div>' +
          '</div>'
        );
      }).join('');
      bodyHtml =
        '<div class="p-3 rounded-xl bg-slate-900/80 border border-emerald-400/25 text-[11px] text-emerald-200">🎯 Wyzwania odświeżają się co tydzień rozgrywkowy i skalują próg wymagań (aktualnie: Tydzień ' + Number((state.weeklyConfig && state.weeklyConfig.currentWeek) || 1) + ', Sezon ' + currentSeason + '). Odbierz do <strong>65 dodatkowych SMPL Coins</strong> tygodniowo!</div>' +
        questRowsHtml;
    } else if (coinShopCategoryFilter === 'gift') {
      const recipients = (state.players || []).filter((p) => {
        if (!p || String(p.id) === String(pid)) return false;
        const isBl = Boolean(p.isBlacklisted || p.banned || p.customRank === 'BLACKLISTED');
        return p.active !== false && !p.gdprDeleted && !p.isPlaceholder && !isBl;
      }).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pl'));
      const recOpts = recipients.map((p) => '<option value="' + studioEsc(p.id) + '">' + studioEsc(p.name) + ' (' + studioEsc(p.leagueId || 'L1') + ')</option>').join('');
      const giftableItems = catalog.filter((x) => !x.seasonOnly || Number(x.seasonOnly) === currentSeason).slice().sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
      const itemOpts = giftableItems.map((x) => '<option value="' + studioEsc(x.id) + '">' + studioEsc(x.title) + ' — ' + Number(x.price || 0) + ' Coins</option>').join('');
      const giftHist = (state.competitions && state.competitions.playerShop && Array.isArray(state.competitions.playerShop.giftHistory))
        ? state.competitions.playerShop.giftHistory
        : [];
      const histHtml = giftHist.length === 0
        ? '<div class="text-slate-400 text-[11px]">Brak wysłanych prezentów w tym sezonie — bądź pierwszy!</div>'
        : giftHist.slice(0, 10).map((g) => {
          const noteTxt = g.note ? (' • „' + studioEsc(g.note) + '”') : '';
          return '<div class="smpl-gift-row text-[11px] text-slate-200">🎁 <strong>' + studioEsc(g.fromName || 'Gracz') + '</strong> ➔ <strong>' + studioEsc(g.toName || 'Gracz') + '</strong>: <span class="text-amber-300 font-bold">' + studioEsc(g.label || '') + '</span>' + noteTxt + '</div>';
        }).join('');
      bodyHtml =
        '<div class="smpl-gift-card space-y-3">' +
          '<div class="text-[11px] text-amber-200">🎁 Podaruj znajomemu <strong>10–500 SMPL Coins</strong> (napiwek Fair Play) albo dowolny odblokowywany kosmetyk z katalogu! Koszt pokrywa Twoje saldo (<strong>' + coins.balance + ' Coins</strong>).</div>' +
          '<form onsubmit="SMPL_APP.handleSendShopGift(event)" class="space-y-2.5">' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
              '<div><label class="block text-[11px] text-slate-300 font-bold mb-1">Odbiorca prezentu</label><select name="toPlayerId" required class="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-white">' + (recOpts || '<option value="">Brak innych graczy</option>') + '</select></div>' +
              '<div><label class="block text-[11px] text-slate-300 font-bold mb-1">Rodzaj prezentu</label><select name="giftType" onchange="SMPL_APP.toggleShopGiftType(this.value)" class="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-white font-bold"><option value="coins">🪙 Przelej SMPL Coins (10–500)</option><option value="item">✨ Podaruj Kosmetyk ze Sklepiku</option></select></div>' +
            '</div>' +
            '<div id="shop-gift-coins-wrap"><label class="block text-[11px] text-slate-300 font-bold mb-1">Liczba Coins (10 – 500)</label><input type="number" name="amount" min="10" max="500" value="25" class="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-white"/></div>' +
            '<div id="shop-gift-item-wrap" style="display:none"><label class="block text-[11px] text-slate-300 font-bold mb-1">Wybierz kosmetyk (zapłacisz z własnego salda)</label><select name="itemId" class="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-white">' + itemOpts + '</select></div>' +
            '<div><label class="block text-[11px] text-slate-300 font-bold mb-1">Wiadomość do gracza (opcjonalnie)</label><input type="text" name="note" maxlength="120" placeholder="Dzięki za świetny mecz Fair Play!" class="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-white/15 text-white"/></div>' +
            '<div class="flex justify-end"><button type="submit" class="btn-league px-4 py-2 rounded-xl font-display font-black uppercase">🎁 Wyślij Prezent</button></div>' +
          '</form>' +
        '</div>' +
        '<div class="space-y-1.5 pt-2"><div class="text-[11px] font-bold uppercase text-slate-400">Ostatnie prezenty w lidze:</div>' + histHtml + '</div>';
    } else {
      const filteredCatalog = coinShopCategoryFilter === 'all'
        ? catalog
        : coinShopCategoryFilter === 'drops'
          ? dropItems
          : catalog.filter((x) => x.category === coinShopCategoryFilter);

      bodyHtml = filteredCatalog.map((item) => {
        const owned = cos.unlockedItems.indexOf(item.id) >= 0;
        const dropClosed = Boolean(item.seasonOnly && Number(item.seasonOnly) !== currentSeason);
        const isPresetTitle = item.category === 'title' && item.value !== 'custom';
        const isCustomTitleItem = item.category === 'title' && item.value === 'custom';
        const isEquipped =
          (item.category === 'frame' && cos.frame === item.value) ||
          ((item.category === 'bg' || item.category === 'bgStyle') && cos.bgStyle === item.value) ||
          (item.category === 'poster' && cos.posterTheme === item.value) ||
          (item.category === 'badge' && cos.profileBadge === item.value) ||
          (item.category === 'nickfx' && cos.nickEffect === item.value) ||
          ((item.category === 'sound' || item.category === 'joinSound') && cos.joinSound === item.value) ||
          (isPresetTitle && cos.customTitle === item.value) ||
          (isCustomTitleItem && Boolean(cos.customTitle) && presetTitles.indexOf(cos.customTitle) < 0);
        const extraInputId = isCustomTitleItem ? 'shop-custom-title-inp' : '';
        const itemTitle = item.title || item.name || item.id;
        const itemPrice = Number(item.price !== undefined ? item.price : item.cost || 0);
        const isSoundItem = item.category === 'sound' || item.category === 'joinSound';

        const swatchHtml = item.swatch
          ? '<span class="smpl-shop-swatch" style="background:' + studioEsc(item.swatch) + '"></span>'
          : '';
        const dropBadgeHtml = item.seasonOnly
          ? '<span class="smpl-drop-pill">⏳ LIMIT S' + studioEsc(String(item.seasonOnly)) + '</span>'
          : '';
        const rarityHtml = item.rarity
          ? '<span class="smpl-shop-rarity">' + studioEsc(item.rarity) + '</span>'
          : '';
        const customInpHtml = isCustomTitleItem
          ? '<input id="' + extraInputId + '" type="text" maxlength="28" value="' + studioEsc(cos.customTitle || '') + '" placeholder="Wpisz własny tytuł UT (max 28 zn.)" class="mt-2 w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white"/>'
          : '';
        const testBtnHtml = isSoundItem
          ? '<button type="button" onclick="SMPL_APP.previewShopSound(\'' + studioEsc(item.value) + '\')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-bold" title="Odsłuchaj dźwięk przed zakupem">🔊 Test</button>'
          : '';

        let actionBtnsHtml = '';
        if (!owned && dropClosed) {
          actionBtnsHtml = '<span class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 font-bold">🔒 Zamknięty Drop S' + studioEsc(String(item.seasonOnly)) + '</span>';
        } else if (!owned) {
          actionBtnsHtml = '<button type="button" onclick="SMPL_APP.handleBuyShopItem(\'' + studioEsc(item.id) + '\', \'' + extraInputId + '\')" class="btn-league px-3 py-1.5 rounded-lg font-display font-black uppercase">Kup</button>';
        } else if (isEquipped) {
          if (isCustomTitleItem) {
            actionBtnsHtml += '<button type="button" onclick="SMPL_APP.handleEquipShopItem(\'' + studioEsc(item.category) + '\', \'' + studioEsc(item.value) + '\', \'' + extraInputId + '\')" class="px-2.5 py-1.5 rounded-lg bg-blue-600/35 hover:bg-blue-600/50 text-blue-100 border border-blue-400/40 font-bold uppercase">✏️ Zapisz</button>';
          }
          actionBtnsHtml += '<button type="button" onclick="SMPL_APP.handleEquipShopItem(\'' + studioEsc(item.category) + '\', \'default\', \'\')" class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold uppercase" title="Kliknij, aby zdjąć ten element">✅ Zdejmij</button>';
        } else {
          actionBtnsHtml = '<button type="button" onclick="SMPL_APP.handleEquipShopItem(\'' + studioEsc(item.category) + '\', \'' + studioEsc(item.value) + '\', \'' + extraInputId + '\')" class="px-3 py-1.5 rounded-lg bg-blue-600/35 hover:bg-blue-600/50 text-blue-100 border border-blue-400/40 font-bold uppercase">✨ Załóż</button>';
        }

        const borderCls = isEquipped ? 'border-emerald-400/50' : owned ? 'border-amber-400/40' : 'border-white/10';
        const missingHtml = (!owned && !dropClosed && coins.balance < itemPrice)
          ? '<span class="text-[10px] text-rose-300/90 font-semibold">• brakuje ' + (itemPrice - coins.balance) + '</span>'
          : '';
        return (
          '<div class="p-3 rounded-xl bg-slate-950/85 border ' + borderCls + ' flex flex-wrap items-center justify-between gap-2">' +
            '<div class="min-w-0 flex-1">' +
              '<div class="font-display font-bold text-white flex items-center gap-1.5 flex-wrap">' +
                swatchHtml +
                '<span>' + (item.icon ? studioEsc(item.icon) + ' ' : '') + studioEsc(itemTitle) + '</span>' +
                dropBadgeHtml +
                rarityHtml +
                '<span class="text-amber-300">(' + itemPrice + ' Coins)</span>' +
                missingHtml +
              '</div>' +
              '<div class="text-[11px] text-slate-400 mt-0.5">' + studioEsc(item.desc) + '</div>' +
              customInpHtml +
            '</div>' +
            '<div class="flex items-center gap-1.5 flex-shrink-0">' + testBtnHtml + actionBtnsHtml + '</div>' +
          '</div>'
        );
      }).join('');
    }

    const masterPlayersForCoins = isMasterOwner
      ? (state.players || [])
          .filter((p) => p && !p.isPlaceholder && !p.gdprDeleted)
          .slice()
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pl'))
      : [];
    const masterCoinsOptsHtml = masterPlayersForCoins.map((p) => {
      const pCoins = window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, p.id);
      const isSelf = String(p.id) === String(pid);
      return '<option value="' + studioEsc(p.id) + '"' + (isSelf ? ' selected' : '') + '>'
        + studioEsc(p.name) + (isSelf ? ' [TY]' : '') + ' (' + studioEsc(p.leagueId || 'POOL') + ') — ' + pCoins.balance + ' Coins'
        + '</option>';
    }).join('');
    const masterCoinsVaultHtml = isMasterOwner
      ? '<div class="p-3 rounded-xl bg-amber-500/10 border border-amber-400/45 space-y-2.5 text-[11px]">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<span class="font-display font-black text-amber-300 uppercase">👑 Skarbiec Master Admina — Dodaj Coinsy Bez Limitu (Test Sklepiku)</span>' +
            '<div class="flex flex-wrap items-center gap-1">' +
              '<button type="button" onclick="SMPL_APP.masterQuickGrantCoins(\'' + studioEsc(pid) + '\', 500, true)" class="px-2 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/45 font-bold">+500</button>' +
              '<button type="button" onclick="SMPL_APP.masterQuickGrantCoins(\'' + studioEsc(pid) + '\', 2500, true)" class="px-2 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/45 font-bold">+2 500</button>' +
              '<button type="button" onclick="SMPL_APP.masterQuickGrantCoins(\'' + studioEsc(pid) + '\', 10000, true)" class="px-2 py-1 rounded-lg bg-amber-400/25 hover:bg-amber-400/40 text-amber-100 border border-amber-400/55 font-black">+10 000</button>' +
              '<button type="button" onclick="SMPL_APP.masterQuickGrantCoins(\'' + studioEsc(pid) + '\', 100000, true)" class="px-2 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/50 font-black">+100 000</button>' +
              (coins.breakdown.adminBonusCoins
                ? '<button type="button" onclick="SMPL_APP.masterResetPlayerBonusCoins(\'' + studioEsc(pid) + '\', true)" class="px-2 py-1 rounded-lg bg-rose-600/25 hover:bg-rose-600/40 text-rose-200 border border-rose-400/40 font-bold" title="Zeruje Twoje bonusowe Coins od Mastera">🧹 Zeruj (' + coins.breakdown.adminBonusCoins + ')</button>'
                : '') +
            '</div>' +
          '</div>' +
          '<form onsubmit="SMPL_APP.masterSubmitGrantCoinsForm(event, true)" class="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">' +
            '<select name="playerId" class="sm:col-span-5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-white font-semibold">' + masterCoinsOptsHtml + '</select>' +
            '<input type="number" name="delta" step="1" value="5000" required placeholder="Kwota bez limitu (lub -500)" class="sm:col-span-3 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-amber-400/40 text-amber-200 font-mono-num font-bold"/>' +
            '<input type="text" name="reason" maxlength="100" placeholder="Powód (opcj., np. Test)" class="sm:col-span-2 px-2 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-slate-200"/>' +
            '<button type="submit" class="sm:col-span-2 btn-league px-2.5 py-1.5 rounded-lg font-display font-black uppercase">🪙 Dodaj</button>' +
          '</form>' +
        '</div>'
      : '';
    const adminBonusPart = coins.breakdown.adminBonusCoins
      ? (', <strong class="text-amber-300">Bonus Master (' + (coins.breakdown.adminBonusCoins >= 0 ? '+' : '') + coins.breakdown.adminBonusCoins + ')</strong>')
      : '';

    const shopPlObj = (state.players || []).find((p) => p && String(p.id) === String(pid)) || null;
    const shopPlName = shopPlObj ? String(shopPlObj.name || 'Gracz') : 'Gracz';
    const shopPlNick = shopPlObj ? String(shopPlObj.nick || '') : '';
    const shopPlLeague = (shopPlObj && shopPlObj.leagueId && /^L\d+$/i.test(String(shopPlObj.leagueId))) ? String(shopPlObj.leagueId) : (currentLeagueId || 'L1');
    const shopPlRk = (shopPlObj && window.SMPL_RANKS) ? window.SMPL_RANKS.getPlayerRank(shopPlObj, state) : null;
    const shopPlRkNameCls = (shopPlRk && window.SMPL_RANKS) ? window.SMPL_RANKS.nameClass(shopPlRk) : '';
    const shopPlAvatar = (shopPlObj && shopPlObj.avatar) || (window.SMPL_MEDIA ? window.SMPL_MEDIA.generatePlayerAvatar(shopPlName, shopPlNick || 'SMPL', 1) : '');
    const shopPreviewBadgeHtml = cos.badgeLabel
      ? '<span class="smpl-shop-badge-pill" style="border-color:' + studioEsc(cos.badgeColor || '#38bdf8') + ';color:' + studioEsc(cos.badgeColor || '#38bdf8') + ';box-shadow:0 0 10px ' + studioEsc(cos.badgeColor || '#38bdf8') + '44;">' + studioEsc(cos.badgeLabel) + '</span>'
      : '';
    const shopPreviewTitleHtml = cos.customTitle
      ? '<span class="smpl-coin-title-ribbon">🪙 ' + studioEsc(cos.customTitle) + '</span>'
      : '';
    const findCatalogTitle = (cat, val) => {
      if (!val || val === 'default') return 'domyślny';
      const hit = catalog.find((it) => it && it.category === cat && it.value === val);
      return hit ? String(hit.title || val).replace(/^(Tło|Blask Nicku|Skórka PNG|Dźwięk|Odznaka|Tytuł|DROP S56):\s*/i, '') : String(val);
    };
    const livePreviewCardHtml =
      '<div class="smpl-cosmetic-card smpl-shop-live-preview ' + studioEsc(cos.bgCss || '') + ' ' + studioEsc(cos.frameCss || '') + ' border border-white/15">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          (shopPlAvatar ? '<img src="' + shopPlAvatar + '" alt="' + studioEsc(shopPlName) + '" class="w-12 h-12 rounded-full object-cover border-2 border-amber-400/70 shadow-lg flex-shrink-0"/>' : '') +
          '<div class="min-w-0">' +
            '<div class="text-[9.5px] font-display font-bold uppercase tracking-wider text-slate-300">✨ PODGLĄD TWOJEGO STYLU NA ŻYWO (KARTA UT + PROFIL + TABELA)</div>' +
            '<div class="flex items-center gap-2 flex-wrap mt-0.5">' +
              '<span class="font-display font-black text-base text-white uppercase ' + studioEsc(shopPlRkNameCls) + ' ' + studioEsc(cos.nickFxCss || '') + '">' + studioEsc(shopPlName) + '</span>' +
              shopPreviewBadgeHtml +
            '</div>' +
            (shopPreviewTitleHtml ? '<div class="mt-1">' + shopPreviewTitleHtml + '</div>' : '<div class="text-[10.5px] text-slate-300 mt-0.5">@' + studioEsc(shopPlNick) + '</div>') +
          '</div>' +
        '</div>' +
        '<div class="flex flex-wrap items-center gap-1.5 flex-shrink-0">' +
          '<button type="button" onclick="SMPL_APP.closeModal(); SMPL_APP.openPlayerProfileTab(\'' + studioEsc(pid) + '\');" class="px-2.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/50 text-[11px] font-display font-black uppercase">🎴 Karta UT</button>' +
          '<button type="button" onclick="SMPL_APP.downloadUtCardPosterPng(\'' + studioEsc(pid) + '\')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/45 text-[11px] font-display font-black uppercase">📸 Karta PNG</button>' +
          '<button type="button" onclick="SMPL_APP.downloadStandingsPosterPng(\'' + studioEsc(shopPlLeague) + '\')" class="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/45 text-[11px] font-display font-black uppercase">📊 Tabela PNG</button>' +
        '</div>' +
      '</div>';

    const html = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg text-amber-300 uppercase">🪙 Sklepik Kosmetyczny SMPL Loyalty Coins</h3>
            <p class="text-xs text-slate-300 mt-0.5">Twoje saldo: <strong class="text-amber-300 text-sm">${coins.balance} COINS</strong> • Odblokowane: <strong class="text-emerald-300">${ownedCount}/${catalog.length}</strong> (Zdobyto: ${coins.earned} • Wydano: ${coins.spent})</p>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold">✕</button>
        </div>
        ${livePreviewCardHtml}
        ${masterCoinsVaultHtml}
        <div class="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-[11px] text-slate-300 space-y-1.5">
          <div><strong class="text-amber-300">Ekonomia Wielo-Sezonowa:</strong> +6/mecz • +5/CK • +35 za 10 meczów bez WO • Typer +12/+4 • ZP +10 • Puskás +15 • Wyzwania do +65/tydz. <em>Odblokowane nagrody i Coins przechodzą na kolejne sezony!</em></div>
          <div>Twoje źródła: Mecze (${coins.breakdown.matchesCoins}), Czyste Konta (${coins.breakdown.cleanSheetCoins}), Terminowość (${coins.breakdown.timelyBonusCoins}), Typer/ZP/Puskás (${coins.breakdown.typerCoins + coins.breakdown.puskasCoins + coins.breakdown.goldenBallCoins}), Wyzwania (${coins.breakdown.questCoins || 0}), Prezenty (${coins.breakdown.giftCoinsReceived || 0}), Poprz. sezony (${coins.breakdown.carryoverCoins || 0})${adminBonusPart}.</div>
          <div class="text-slate-400">Aktywne teraz: Ramka <strong class="text-white">${studioEsc(findCatalogTitle('frame', cos.frame))}</strong> • Tło <strong class="text-white">${studioEsc(findCatalogTitle('bg', cos.bgStyle))}</strong> • Skórka PNG <strong class="text-white">${studioEsc(findCatalogTitle('poster', cos.posterTheme))}</strong> • Odznaka <strong class="text-white">${studioEsc(cos.badgeLabel || 'brak')}</strong> • Blask <strong class="text-white">${studioEsc(findCatalogTitle('nickfx', cos.nickEffect))}</strong> • Dźwięk <strong class="text-white">${studioEsc(findCatalogTitle('sound', cos.joinSound))}</strong></div>
        </div>
        <div class="flex flex-wrap gap-1.5">${tabsHtml}</div>
        <div class="space-y-2.5 max-h-96 overflow-y-auto pr-1 text-xs">${bodyHtml}</div>
      </div>
    `;
    openModal(html, 'max-w-3xl');
  }

  function handleBuyShopItem(itemId, customTitleInputId) {
    const titleEl = customTitleInputId ? document.getElementById(customTitleInputId) : null;
    const rawCustomTitle = titleEl ? String(titleEl.value || '').trim() : '';
    const effectiveCustomTitle = (itemId === 'title_custom' && !rawCustomTitle) ? 'MISTRZ SMPL' : rawCustomTitle;
    try {
      const res = window.SMPL_DB.buyShopItem({ itemId: itemId, customTitle: effectiveCustomTitle });
      const catalog = (window.SMPL_STUDIO && window.SMPL_STUDIO.SHOP_CATALOG) || [];
      const boughtItem = catalog.find((x) => x.id === itemId);
      if (boughtItem && boughtItem.category === 'sound' && window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playShopSound === 'function') {
        window.SMPL_NOTIF.playShopSound(boughtItem.value, false);
      }
      showToast(
        itemId === 'title_custom' && !rawCustomTitle
          ? '🪙 Odblokowano Własny Tytuł! Wpisz swój napis w polu i kliknij „✏️ Zapisz”.'
          : '🪙 Zakupiono i aktywowano element kosmetyczny!'
      );
      renderAll();
      openCoinShopModal();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then((srv) => {
          if (srv && srv.ok === false && srv.error) {
            showToast('⚠️ Serwer nie zapisał zakupu: ' + srv.error, 'error');
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się kupić przedmiotu.', 'error');
    }
  }

  function handleEquipShopItem(category, value, customTitleInputId) {
    const titleEl = customTitleInputId ? document.getElementById(customTitleInputId) : null;
    const rawCustomTitle = titleEl ? String(titleEl.value || '').trim() : '';
    const effectiveCustomTitle = (category === 'title' && value === 'custom' && !rawCustomTitle) ? 'MISTRZ SMPL' : rawCustomTitle;
    try {
      const res = window.SMPL_DB.equipShopItem({ category: category, value: value, customTitle: effectiveCustomTitle });
      if (category === 'sound' && value && value !== 'default' && window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playShopSound === 'function') {
        window.SMPL_NOTIF.playShopSound(value, false);
      }
      showToast(value === 'default' ? '🎨 Przywrócono domyślny element kosmetyczny.' : '✨ Zaktualizowano wygląd i styl profilu!');
      renderAll();
      openCoinShopModal();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then((srv) => {
          if (srv && srv.ok === false && srv.error) {
            showToast('⚠️ Serwer nie zapisał zmiany stylu: ' + srv.error, 'error');
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się zmienić stylu.', 'error');
    }
  }

  function handleClaimShopQuest(questId) {
    try {
      const res = window.SMPL_DB.claimShopQuest({ questId: questId });
      if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playShopSound === 'function') {
        window.SMPL_NOTIF.playShopSound('fanfare', false);
      }
      showToast('🎯 Odebrano +' + Number((res && res.quest && res.quest.reward) || 0) + ' SMPL Coins z wyzwania!');
      renderAll();
      openCoinShopModal('quests');
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then(() => {});
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się odebrać nagrody z wyzwania.', 'error');
    }
  }

  function toggleShopGiftType(val) {
    const coinsWrap = document.getElementById('shop-gift-coins-wrap');
    const itemWrap = document.getElementById('shop-gift-item-wrap');
    const isItem = String(val || '') === 'item';
    if (coinsWrap) coinsWrap.style.display = isItem ? 'none' : 'block';
    if (itemWrap) itemWrap.style.display = isItem ? 'block' : 'none';
  }

  function handleSendShopGift(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    const toPlayerId = form.toPlayerId ? form.toPlayerId.value : '';
    const giftType = form.giftType ? form.giftType.value : 'coins';
    const amount = form.amount ? Number(form.amount.value || 0) : 0;
    const itemId = form.itemId ? form.itemId.value : '';
    const note = form.note ? form.note.value : '';
    try {
      const res = window.SMPL_DB.sendShopGift({
        toPlayerId: toPlayerId,
        giftType: giftType,
        amount: amount,
        itemId: itemId,
        note: note
      });
      if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playShopSound === 'function') {
        window.SMPL_NOTIF.playShopSound('arcade_levelup', false);
      }
      showToast('🎁 Wysłano prezent: ' + ((res && res.gift && res.gift.label) || 'SMPL Coins') + '!');
      renderAll();
      openCoinShopModal('gift');
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then(() => {});
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się wysłać prezentu.', 'error');
    }
  }

  function masterQuickGrantCoins(playerId, delta, reopenShop, reason) {
    try {
      const res = window.SMPL_DB.masterGrantPlayerCoins({
        playerId: playerId,
        delta: Number(delta || 0),
        mode: 'add',
        reason: reason || ''
      });
      if (Number(delta || 0) > 0 && window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playShopSound === 'function') {
        window.SMPL_NOTIF.playShopSound('arcade_levelup', false);
      }
      const sign = res.delta >= 0 ? '+' : '';
      showToast('👑🪙 ' + res.playerName + ': ' + sign + res.delta + ' SMPL Coins (nowe saldo: ' + res.balance + ' Coins)!');
      renderAll();
      if (reopenShop) openCoinShopModal();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then((srv) => {
          if (srv && srv.ok === false && srv.error) {
            showToast('⚠️ Serwer odrzucił zmianę Coins: ' + srv.error, 'error');
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się przyznać SMPL Coins.', 'error');
    }
  }

  function masterSubmitGrantCoinsForm(event, reopenShop) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    const playerId = form.playerId ? form.playerId.value : '';
    const rawDelta = form.delta ? Number(form.delta.value || 0) : 0;
    const reason = form.reason ? form.reason.value : '';
    if (!playerId) {
      showToast('Wybierz zawodnika z listy.', 'error');
      return;
    }
    if (!rawDelta || !isFinite(rawDelta)) {
      showToast('Podaj liczbę SMPL Coins różną od 0 (np. 5000 lub -500).', 'error');
      return;
    }
    masterQuickGrantCoins(playerId, Math.round(rawDelta), Boolean(reopenShop), reason);
  }

  function masterResetPlayerBonusCoins(playerId, reopenShop) {
    try {
      const res = window.SMPL_DB.masterGrantPlayerCoins({
        playerId: playerId,
        mode: 'reset_bonus'
      });
      showToast('👑🧹 Wyzerowano bonusowe SMPL Coins dla ' + res.playerName + ' (saldo: ' + res.balance + ' Coins).');
      renderAll();
      if (reopenShop) openCoinShopModal();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then((srv) => {
          if (srv && srv.ok === false && srv.error) {
            showToast('⚠️ Serwer odrzucił zerowanie Coins: ' + srv.error, 'error');
            renderAll();
          }
        });
      }
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się wyzerować bonusowych Coins.', 'error');
    }
  }

  function openMasterGrantCoinsModal(defaultPlayerId) {
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const isMasterOwner = Boolean(session && window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session) && session.adminRole === 'MASTER_ADMIN');
    if (!isMasterOwner) {
      showToast('⛔ Skarbiec SMPL Coins dostępny jest wyłącznie dla Master Admina.', 'error');
      return;
    }
    const players = (state.players || [])
      .filter((p) => p && !p.isPlaceholder && !p.gdprDeleted)
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pl'));
    const chosenId = defaultPlayerId || (players[0] ? players[0].id : '');
    const chosenPl = players.find((p) => String(p.id) === String(chosenId)) || players[0] || null;
    const chosenBal = chosenPl && window.SMPL_STUDIO
      ? window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, chosenPl.id)
      : { balance: 0, breakdown: { adminBonusCoins: 0 } };
    const optsHtml = players.map((p) => {
      const b = window.SMPL_STUDIO ? window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, p.id) : { balance: 0 };
      const sel = chosenPl && String(p.id) === String(chosenPl.id) ? ' selected' : '';
      return '<option value="' + studioEsc(p.id) + '"' + sel + '>' + studioEsc(p.name) + ' (' + studioEsc(p.leagueId || 'POOL') + ') — ' + b.balance + ' Coins</option>';
    }).join('');
    const html = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <span class="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-display font-black text-[10px] uppercase">👑 TYLKO MASTER ADMIN • BEZ LIMITU</span>
            <h3 class="font-display font-black text-lg text-amber-300 uppercase mt-1">🪙 Przyznaj SMPL Coins Graczowi</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold">✕</button>
        </div>
        ${chosenPl ? `
          <div class="p-3 rounded-xl bg-slate-950/90 border border-amber-400/30 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>Wybrany gracz: <strong class="text-white">${studioEsc(chosenPl.name)}</strong> • Saldo: <strong class="text-amber-300">${chosenBal.balance} Coins</strong> (Bonus Master: ${chosenBal.breakdown.adminBonusCoins || 0})</div>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" onclick="SMPL_APP.masterQuickGrantCoins('${studioEsc(chosenPl.id)}', 500, false); SMPL_APP.openMasterGrantCoinsModal('${studioEsc(chosenPl.id)}');" class="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/45 font-bold">+500</button>
              <button type="button" onclick="SMPL_APP.masterQuickGrantCoins('${studioEsc(chosenPl.id)}', 2500, false); SMPL_APP.openMasterGrantCoinsModal('${studioEsc(chosenPl.id)}');" class="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/45 font-bold">+2 500</button>
              <button type="button" onclick="SMPL_APP.masterQuickGrantCoins('${studioEsc(chosenPl.id)}', 10000, false); SMPL_APP.openMasterGrantCoinsModal('${studioEsc(chosenPl.id)}');" class="px-2.5 py-1 rounded-lg bg-amber-400/30 hover:bg-amber-400/45 text-amber-100 border border-amber-400/55 font-black">+10 000</button>
              <button type="button" onclick="SMPL_APP.masterQuickGrantCoins('${studioEsc(chosenPl.id)}', 100000, false); SMPL_APP.openMasterGrantCoinsModal('${studioEsc(chosenPl.id)}');" class="px-2.5 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-400/50 font-black">+100 000</button>
            </div>
          </div>
        ` : ''}
        <form onsubmit="SMPL_APP.masterSubmitGrantCoinsForm(event, false); SMPL_APP.closeModal();" class="space-y-3 text-xs">
          <div>
            <label class="block text-[11px] font-bold uppercase text-slate-300 mb-1">Zawodnik</label>
            <select name="playerId" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold">${optsHtml || '<option value="">Brak zawodników w bazie</option>'}</select>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold uppercase text-amber-300 mb-1">Liczba SMPL Coins (bez limitu, ujemna = odejmij)</label>
              <input type="number" name="delta" step="1" value="5000" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/40 text-amber-200 font-mono-num font-bold"/>
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-slate-300 mb-1">Powód / notatka (opcjonalnie)</label>
              <input type="text" name="reason" maxlength="140" placeholder="np. Test Sklepiku / Nagroda Specjalna" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"/>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
            ${chosenPl && chosenBal.breakdown.adminBonusCoins ? `<button type="button" onclick="SMPL_APP.masterResetPlayerBonusCoins('${studioEsc(chosenPl.id)}', false); SMPL_APP.openMasterGrantCoinsModal('${studioEsc(chosenPl.id)}');" class="px-3 py-2 rounded-xl bg-rose-600/25 hover:bg-rose-600/40 text-rose-200 border border-rose-500/40 font-bold">🧹 Wyzeruj Bonus (${chosenBal.breakdown.adminBonusCoins})</button>` : '<span></span>'}
            <button type="submit" class="btn-league px-4 py-2 rounded-xl font-display font-black uppercase">🪙 Przyznaj SMPL Coins</button>
          </div>
        </form>
      </div>
    `;
    openModal(html);
  }

  function openSmplWrappedModal(playerId) {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.buildSmplWrappedData !== 'function') {
      showToast('Moduł SMPL Wrapped jest niedostępny.', 'error');
      return;
    }
    const state = window.SMPL_DB.getState();
    const w = window.SMPL_STUDIO.buildSmplWrappedData(state, playerId);
    if (!w) {
      showToast('Nie znaleziono danych zawodnika do SMPL Wrapped.', 'error');
      return;
    }
    const html = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/50 text-[10px] font-display font-black uppercase">🎁 SMPL WRAPPED • SEZON ${w.season}</span>
            <h3 class="font-display font-black text-xl text-white uppercase mt-1">${studioEsc(w.player.name)} (@${studioEsc(w.player.nick)})</h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold">✕</button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono-num">
          <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
            <div class="text-[10px] text-slate-400">MECZE</div>
            <div class="font-display font-black text-xl text-white">${w.played}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-emerald-400/35">
            <div class="text-[10px] text-emerald-300">WIN RATE</div>
            <div class="font-display font-black text-xl text-emerald-400">${w.winPct}%</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-amber-400/35">
            <div class="text-[10px] text-amber-300">BILANS GOLI</div>
            <div class="font-display font-black text-xl text-amber-300">${w.gf}:${w.ga}</div>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-blue-400/35">
            <div class="text-[10px] text-blue-300">CZYSTE KONTA</div>
            <div class="font-display font-black text-xl text-blue-300">🧤 ${w.cleanSheets}</div>
          </div>
        </div>
        <div class="space-y-2 text-xs">
          <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex justify-between gap-2">
            <span class="text-slate-400">🔥 Najdłuższa seria zwycięstw:</span>
            <strong class="text-amber-300">${w.maxWinStreak} meczów z rzędu</strong>
          </div>
          <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex justify-between gap-2">
            <span class="text-slate-400">💥 Największa wygrana:</span>
            <strong class="text-emerald-300">${w.bestWin ? (w.bestWin.myG + ':' + w.bestWin.opG + ' vs ' + studioEsc(w.bestWin.oppName) + ' (K' + w.bestWin.round + ')') : 'Brak danych'}</strong>
          </div>
          <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex justify-between gap-2">
            <span class="text-slate-400">👑 Ulubiona ofiara:</span>
            <strong class="text-blue-300">${w.favoriteVictim ? studioEsc(w.favoriteVictim.name) + ' (' + w.favoriteVictim.ptsFor + ' pkt)' : 'Brak danych'}</strong>
          </div>
          <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex justify-between gap-2">
            <span class="text-slate-400">🏛️ Kariera S1–S55 &amp; Osiągnięcia:</span>
            <strong class="text-amber-300">${w.careerEntry ? ('All-Time #' + w.careerEntry.rank + ' • ') : ''}${w.achievements.unlockedCount}/${w.achievements.totalCount} odznak • 🪙 ${w.coins.balance} Coins</strong>
          </div>
        </div>
        <div class="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" onclick="SMPL_APP.downloadWrappedPosterPng('${studioEsc(playerId)}')" class="btn-league px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase">📸 Pobierz Plakat SMPL Wrapped PNG</button>
        </div>
      </div>
    `;
    openModal(html);
  }

  function openVacationModeModal() {
    const state = window.SMPL_DB.getState();
    const session = window.SMPL_DB.getSession();
    const p = (state.players || []).find((x) => x && x.id === (session && session.activePlayerId));
    const vac = (p && p.vacation) || { isOnVacation: false, untilDate: '', reason: '' };
    const isVacOn = Boolean(vac.isOnVacation !== undefined ? vac.isOnVacation : vac.enabled);
    const vacUntil = vac.untilDate || vac.until || '';
    const vacReason = vac.reason || vac.note || '';
    const html = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg text-blue-300 uppercase">✈️ Tryb Urlopowy / Nieobecność</h3>
            <p class="text-xs text-slate-300 mt-0.5">Wyświetla odznakę urlopową przy Twoim nicku w tabeli, aby rywale i Admin widzieli kiedy wracasz.</p>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold">✕</button>
        </div>
        <form onsubmit="SMPL_APP.submitVacationModeForm(event)" class="space-y-3 text-xs">
          <label class="flex items-center gap-2 font-bold text-white cursor-pointer">
            <input name="enabled" type="checkbox" ${isVacOn ? 'checked' : ''} class="w-4 h-4 rounded"/>
            <span>Aktywuj odznakę ✈️ URLOP w Tabeli i Terminarzu</span>
          </label>
          <div>
            <label class="block font-display font-bold uppercase text-slate-300 mb-1">Powrót w dniu (RRRR-MM-DD, opcjonalnie)</label>
            <input name="until" type="date" value="${studioEsc(vacUntil)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"/>
          </div>
          <div>
            <label class="block font-display font-bold uppercase text-slate-300 mb-1">Powód / Wiadomość (opcjonalnie)</label>
            <input name="note" type="text" maxlength="100" value="${studioEsc(vacReason)}" placeholder="np. Wyjazd służbowy, wracam w niedzielę wieczorem" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"/>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold uppercase">Anuluj</button>
            <button type="submit" class="btn-league px-5 py-2 rounded-xl font-display font-black uppercase">✈️ Zapisz Status Urlopu</button>
          </div>
        </form>
      </div>
    `;
    openModal(html);
  }

  function submitVacationModeForm(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    try {
      const res = window.SMPL_DB.setOwnVacation({
        isOnVacation: Boolean(form.enabled && form.enabled.checked),
        untilDate: form.until ? form.until.value : '',
        reason: form.note ? form.note.value : ''
      });
      const srvPromise = res && res.serverPromise ? res.serverPromise : Promise.resolve(res);
      srvPromise.then((srvRes) => {
        if (srvRes && srvRes.ok === false) {
          showToast(srvRes.error || 'Błąd aktualizacji statusu urlopu.', 'error');
          return;
        }
        closeModal();
        showToast('✈️ Zaktualizowano Tryb Urlopowy!');
        renderAll();
      });
    } catch (err) {
      showToast((err && err.message) || 'Błąd aktualizacji statusu urlopu.', 'error');
    }
  }

  function adminAwardTotwWeek(weekNum) {
    try {
      const res = window.SMPL_DB.awardWeeklyTotw(Number(weekNum || 1), getCurrentAdminDisplayName());
      showToast('⚡ Ogłoszono Drużynę Kolejki (TOTW Tydzień #' + res.week + ')!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się zatwierdzić TOTW.', 'error');
    }
  }

  function adminGeneratePlayoffTies() {
    try {
      const res = window.SMPL_DB.generatePlayoffTies(getCurrentAdminDisplayName());
      showToast('🥊 Wygenerowano pary barażowe (' + (res.ties ? res.ties.length : 0) + ')!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd generowania baraży.', 'error');
    }
  }

  function adminSubmitPlayoffLeg(event, tieId, leg) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    try {
      window.SMPL_DB.updatePlayoffLegResult({
        tieId: tieId,
        leg: leg,
        homeScore: Number(form.hs ? form.hs.value : 0),
        awayScore: Number(form.as ? form.as.value : 0),
        penWinnerId: form.pen ? form.pen.value : ''
      }, getCurrentAdminDisplayName());
      showToast('🥊 Zapisano wynik Barażu!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd zapisu wyniku Barażu.', 'error');
    }
  }

  function adminGenerateSupercupBracket() {
    try {
      window.SMPL_DB.generateSupercupBracket({}, getCurrentAdminDisplayName());
      showToast('🌟 Zestawiono parę Superpucharu Mistrzów!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się zestawić Superpucharu.', 'error');
    }
  }

  function adminSubmitSupercupMatch(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    try {
      window.SMPL_DB.updateSupercupMatch({
        homeScore: Number(form.hs ? form.hs.value : 0),
        awayScore: Number(form.as ? form.as.value : 0),
        penWinnerId: form.pen ? form.pen.value : ''
      }, getCurrentAdminDisplayName());
      showToast('🌟 Zapisano wynik Superpucharu Mistrzów!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd zapisu wyniku Superpucharu.', 'error');
    }
  }

  function adminGenerateBlitzBracket(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    try {
      window.SMPL_DB.generateBlitzBracket({
        size: form && form.size ? Number(form.size.value) : 8,
        name: form && form.name ? form.name.value : 'Weekendowy Blitz Cup SMPL'
      }, getCurrentAdminDisplayName());
      showToast('⚡ Rozlosowano Weekendowy Blitz Cup!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd losowania Blitz Cup.', 'error');
    }
  }

  function adminSubmitBlitzMatch(event, matchId) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    try {
      window.SMPL_DB.updateBlitzMatch({
        matchId: matchId,
        homeScore: Number(form.hs ? form.hs.value : 0),
        awayScore: Number(form.as ? form.as.value : 0),
        penWinnerId: form.pen ? form.pen.value : ''
      }, getCurrentAdminDisplayName());
      showToast('⚡ Zapisano wynik meczu Blitz Cup!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd zapisu meczu Blitz Cup.', 'error');
    }
  }

  function handleAddSmplTvClip(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    try {
      const res = window.SMPL_DB.addSmplTvClip({
        title: form.title ? form.title.value : '',
        url: form.url ? form.url.value : '',
        tag: form.tag ? form.tag.value : 'HIGHLIGHT'
      });
      showToast('🎬 Opublikowano klip w SMPL TV!');
      renderAll();
      if (res && res.remotePromise && typeof res.remotePromise.then === 'function') {
        res.remotePromise.then(() => {});
      }
    } catch (err) {
      showToast((err && err.message) || 'Błąd dodawania klipu SMPL TV.', 'error');
    }
  }

  function adminSaveSmplTvLive(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    try {
      window.SMPL_DB.setSmplTvLiveStream({
        isLive: true,
        title: form.title ? form.title.value : '',
        url: form.url ? form.url.value : '',
        streamerName: getCurrentAdminDisplayName()
      }, getCurrentAdminDisplayName());
      showToast('🔴 Transmisja SMPL TV została uruchomiona!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd uruchamiania streamu.', 'error');
    }
  }

  function adminEndSmplTvLive() {
    try {
      window.SMPL_DB.setSmplTvLiveStream({ isLive: false, title: '', url: '', streamerName: '' }, getCurrentAdminDisplayName());
      showToast('📺 Zakończono transmisję na żywo SMPL TV.');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd zamykania transmisji.', 'error');
    }
  }

  function adminPublishNewsletter(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    const state = window.SMPL_DB.getState();
    const wk = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1;
    try {
      window.SMPL_DB.saveNewsletterEntry({
        week: wk,
        title: form && form.title ? form.title.value : ('Gazeta Ligi SMPL — Tydzień #' + wk),
        content: form && form.content ? form.content.value : '',
        isAiGenerated: false
      }, getCurrentAdminDisplayName());
      showToast('📰 Opublikowano nowe wydanie Gazety Ligi SMPL!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd publikacji Gazety.', 'error');
    }
  }

  function adminGenerateOfflineNewsletter() {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.buildOfflineNewsletterText !== 'function') return;
    const state = window.SMPL_DB.getState();
    const wk = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1;
    const body = window.SMPL_STUDIO.buildOfflineNewsletterText(state, wk);
    try {
      window.SMPL_DB.saveNewsletterEntry({
        week: wk,
        title: 'Gazeta Ligi SMPL — Tydzień #' + wk + ' (Raport Kolejki)',
        content: body,
        isAiGenerated: false
      }, getCurrentAdminDisplayName());
      showToast('⚡ Wygenerowano i opublikowano Gazetę Ligi (tryb statystyczny)!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd generowania Gazety.', 'error');
    }
  }

  function adminGenerateAiNewsletter() {
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.buildOfflineNewsletterText !== 'function') return;
    const state = window.SMPL_DB.getState();
    const wk = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1;
    const baseText = window.SMPL_STUDIO.buildOfflineNewsletterText(state, wk);
    const isHttp = typeof window !== 'undefined' && window.location && /^https?:$/i.test(String(window.location.protocol || ''));
    if (!isHttp || typeof window.SMPL_DB.askVanessaGemini !== 'function') {
      adminGenerateOfflineNewsletter();
      return;
    }
    showToast('🤖 Redakcja AI pisze wydanie Gazety Ligi SMPL...');
    const prompt = 'Napisz barwny, sportowy przegląd kolejki do Gazety Ligi SMPL Polska (maks. 12 zdań, po polsku) na podstawie poniższych faktów i wyników. Pamiętaj o limicie max 2 bramki w lidze:\n\n' + baseText;
    window.SMPL_DB.askVanessaGemini({ question: prompt, history: [], clientContext: baseText })
      .then((res) => {
        const finalText = (res && res.ok && res.answer) ? (res.answer + '\n\n---\n' + baseText) : baseText;
        window.SMPL_DB.saveNewsletterEntry({
          week: wk,
          title: 'Gazeta Ligi SMPL — Tydzień #' + wk + (res && res.ok ? ' (Redakcja AI)' : ''),
          content: finalText,
          isAiGenerated: Boolean(res && res.ok)
        }, getCurrentAdminDisplayName());
        showToast('📰 Opublikowano wydanie AI Gazety Ligi SMPL!');
        renderAll();
      })
      .catch(() => adminGenerateOfflineNewsletter());
  }

  function adminVerifyMatchScreenshotAI(matchId) {
    const state = window.SMPL_DB.getState();
    const m = (state.matches || []).find((x) => x && x.id === matchId);
    if (!m || !m.screenshot) {
      showToast('Mecz nie ma załączonego zrzutu ekranu (SS).', 'error');
      return;
    }
    const pMap = {};
    (state.players || []).forEach((p) => { if (p) pMap[p.id] = p; });
    const hp = pMap[m.homeId] || { name: 'Gospodarz' };
    const ap = pMap[m.awayId] || { name: 'Gość' };
    showToast('🤖 Analizuję screen wyniku przez AI Vision OCR...');
    window.SMPL_DB.verifyMatchScreenshotAI({
      screenshot: m.screenshot,
      homeName: hp.name,
      awayName: ap.name,
      expectedHome: m.homeScore,
      expectedAway: m.awayScore
    }).then((res) => {
      const verdictText = res && res.ok
        ? (res.analysis || JSON.stringify(res, null, 2))
        : ((res && res.error) || 'Weryfikacja AI wymaga aktywnego klucza Gemini API w Ustawieniach AI Vanessa.');
      openModal(`
        <div class="p-5 sm:p-6 space-y-4">
          <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
            <h3 class="font-display font-black text-lg text-purple-300 uppercase">🤖 Wynik Analizy AI OCR Screen (SS)</h3>
            <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">✕</button>
          </div>
          <div class="text-xs text-slate-300">Mecz K${Number(m.round || 0)}: <strong>${studioEsc(hp.name)}</strong> ${Number(m.homeScore)}:${Number(m.awayScore)} <strong>${studioEsc(ap.name)}</strong></div>
          <div class="p-4 rounded-xl bg-slate-950 border border-purple-400/35 text-xs text-white whitespace-pre-line leading-relaxed">${studioEsc(verdictText)}</div>
          <div class="flex justify-end">
            <button type="button" onclick="SMPL_APP.closeModal()" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase">Zamknij</button>
          </div>
        </div>
      `);
    });
  }

  function openDraftBucketsModal() {
    const state = window.SMPL_DB.getState();
    const activeLgs = window.SMPL_DB.getActiveLeagueIds ? window.SMPL_DB.getActiveLeagueIds(state) : ['L1', 'L2'];
    const comp = state.competitions || {};
    const draft = comp.draftSession || null;
    const html = `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg text-purple-300 uppercase">🎲 Centrum Koszyków &amp; Losowanie Live (Draft)</h3>
            <p class="text-xs text-slate-300 mt-0.5">Automatyczne koszyki wg rankingu Kariery S1–S55 przed rozdysponowaniem do dywizji.</p>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">✕</button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" onclick="SMPL_APP.handleGenerateDraftBuckets()" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase">🎲 Wygeneruj Koszyki z Puli Aktywnych</button>
        </div>
        ${
          draft && Array.isArray(draft.buckets) && draft.buckets.length > 0
            ? `<form onsubmit="SMPL_APP.handleCommitDraftAssignments(event)" class="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
                 ${draft.buckets.map((bk) => `
                   <div class="p-3 rounded-xl bg-slate-950 border border-white/15 space-y-2">
                     <div class="font-display font-black text-amber-300 uppercase">${studioEsc(bk.label || ('Koszyk ' + bk.bucketNumber))} (${(bk.players || []).length})</div>
                     ${(bk.players || []).map((bp) => `
                       <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-white/10">
                         <span class="font-bold text-white">${studioEsc(bp.name)} <span class="text-slate-400">(@${studioEsc(bp.nick)} • Kariera #${Number(bp.careerRank || 999)})</span></span>
                         <select name="lg_${studioEsc(bp.playerId)}" class="px-2 py-1 rounded bg-slate-950 border border-amber-400/40 text-white font-bold">
                           ${activeLgs.map((lid) => `<option value="${studioEsc(lid)}" ${bp.assignedLeagueId === lid ? 'selected' : ''}>${studioEsc(lid)}</option>`).join('')}
                         </select>
                       </div>
                     `).join('')}
                   </div>
                 `).join('')}
                 <div class="flex justify-end pt-2">
                   <button type="submit" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black uppercase">✅ Zatwierdź Przydział Lig</button>
                 </div>
               </form>`
            : `<div class="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-950/75 border border-white/10">Kliknij przycisk wyżej, aby zbudować koszyki losowania Live!</div>`
        }
      </div>
    `;
    openModal(html);
  }

  function handleGenerateDraftBuckets() {
    const state = window.SMPL_DB.getState();
    const numLgs = (window.SMPL_DB.getActiveLeagueIds ? window.SMPL_DB.getActiveLeagueIds(state).length : 3) || 3;
    try {
      window.SMPL_DB.generateDraftBuckets(numLgs, getCurrentAdminDisplayName());
      showToast('🎲 Wygenerowano koszyki Draft Live!');
      renderAll();
      openDraftBucketsModal();
    } catch (err) {
      showToast((err && err.message) || 'Błąd generowania koszyków.', 'error');
    }
  }

  function handleCommitDraftAssignments(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    const map = {};
    const els = form.querySelectorAll ? form.querySelectorAll('select[name^="lg_"]') : [];
    for (let i = 0; i < els.length; i++) {
      const pid = String(els[i].name || '').replace(/^lg_/, '');
      if (pid) map[pid] = els[i].value;
    }
    try {
      const res = window.SMPL_DB.commitDraftAssignments(map, getCurrentAdminDisplayName());
      closeModal();
      showToast('✅ Zatwierdzono przydział lig Draft Live (' + res.moved + ' graczy)!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd zatwierdzania Draftu.', 'error');
    }
  }

  function openReplacePlayerModal(outPlayerId) {
    const state = window.SMPL_DB.getState();
    const outP = (state.players || []).find((p) => p && p.id === outPlayerId);
    if (!outP) {
      showToast('Nie znaleziono gracza.', 'error');
      return;
    }
    const poolPlayers = (state.players || []).filter((p) => p && p.id !== outPlayerId && !p.isPlaceholder && (p.leagueId === 'POOL' || p.active === false));
    const poolRegs = (state.registrations || []).filter((r) => r && (r.status === 'APPROVED_POOL' || r.status === 'PENDING'));
    const opts = poolPlayers
      .map((pl) => `<option value="PLAYER:${studioEsc(pl.id)}">[PULA] ${studioEsc(pl.name)} (@${studioEsc(pl.nick)})</option>`)
      .concat(poolRegs.map((rg) => `<option value="REG:${studioEsc(rg.id)}">[ZGŁOSZENIE] ${studioEsc(rg.name)} (@${studioEsc(rg.nick)})</option>`));

    openModal(`
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg text-amber-300 uppercase">🔄 Zastępstwo Śródsezonowe</h3>
            <p class="text-xs text-slate-300 mt-0.5">Zawodnik <strong>${studioEsc(outP.name)}</strong> (${studioEsc(outP.leagueId)}) zostanie zastąpiony nowym graczem w terminarzu.</p>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">✕</button>
        </div>
        ${
          opts.length === 0
            ? `<div class="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs text-slate-300">Brak oczekujących kandydatów w Puli Graczy lub Zgłoszeniach. Dodaj najpierw kandydata w Puli/Rejestracji.</div>`
            : `<form onsubmit="SMPL_APP.handleConfirmReplacePlayer(event, '${studioEsc(outPlayerId)}')" class="space-y-3 text-xs">
                 <label class="block font-display font-bold uppercase text-white mb-1">Wybierz zawodnika wchodzącego za ${studioEsc(outP.name)}:</label>
                 <select name="candidate" required class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-white font-bold">
                   ${opts.join('')}
                 </select>
                 <div class="flex justify-end gap-2 pt-2">
                   <button type="button" onclick="SMPL_APP.closeModal()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold uppercase">Anuluj</button>
                   <button type="submit" class="btn-league px-5 py-2 rounded-xl font-display font-black uppercase">🔄 Wykonaj Zastępstwo</button>
                 </div>
               </form>`
        }
      </div>
    `);
  }

  function handleConfirmReplacePlayer(event, outPlayerId) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    const token = form && form.candidate ? form.candidate.value : '';
    try {
      const res = window.SMPL_DB.replacePlayerMidSeason(outPlayerId, token, getCurrentAdminDisplayName());
      closeModal();
      showToast('🔄 Zastępstwo wykonane (' + res.reboundMatches + ' meczów zachowanych w terminarzu)!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd zastępstwa śródsezonowego.', 'error');
    }
  }

  function adminToggleMaintenanceMode(enabled) {
    try {
      const state = window.SMPL_DB.getState();
      const mm = state && state.portalSettings ? state.portalSettings.maintenanceMode : null;
      const msgInput = typeof document !== 'undefined' ? document.getElementById('master-cfg-maint-msg') : null;
      const inputMsg = msgInput && typeof msgInput.value === 'string' ? msgInput.value.trim() : '';
      const curMsg = inputMsg || (mm && typeof mm === 'object' && mm.message) || (state.portalSettings && state.portalSettings.maintenanceMessage) || 'Przerwa techniczna portalu SMPL — wysyłanie wyników chwilowo wstrzymane.';
      window.SMPL_DB.setMaintenanceMode(Boolean(enabled), curMsg, getCurrentAdminDisplayName());
      const chkEl = typeof document !== 'undefined' ? document.getElementById('master-cfg-maint-active') : null;
      if (chkEl) chkEl.checked = Boolean(enabled);
      applyPortalSettingsToDom(window.SMPL_DB.getState());
      showToast(enabled ? '🚧 Włączono Tryb Przerwy Technicznej!' : '🟢 Wyłączono Tryb Przerwy Technicznej!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd zmiany trybu technicznego.', 'error');
    }
  }

  function adminLoadWebhooksPanel(silent) {
    if (!window.SMPL_DB || typeof window.SMPL_DB.fetchWebhooksConfig !== 'function') return;
    window._smplAdminWebhooksLoaded = true;
    window.SMPL_DB.fetchWebhooksConfig().then((res) => {
      if (res && res.ok) {
        window._smplAdminWebhooksCache = res.config || res;
        renderAll();
        if (!silent) showToast('🔔 Wczytano konfigurację webhooków z serwera.');
      } else if (!silent) {
        showToast((res && res.error) || 'Webhooki wymagają aktywnego serwera HTTP.', 'error');
      }
    });
  }

  function adminSaveWebhooks(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    const payload = {
      enabled: Boolean(form.enabled && form.enabled.checked),
      discordPublicUrl: form.discordPublicUrl ? form.discordPublicUrl.value.trim() : (form.discordWebhookUrl ? form.discordWebhookUrl.value.trim() : ''),
      discordAdminUrl: form.discordAdminUrl ? form.discordAdminUrl.value.trim() : '',
      clearDiscordPublic: Boolean(form.clearDiscordPublic && form.clearDiscordPublic.checked),
      clearDiscordAdmin: Boolean(form.clearDiscordAdmin && form.clearDiscordAdmin.checked),
      telegramBotToken: form.telegramBotToken ? form.telegramBotToken.value.trim() : '',
      telegramChatId: form.telegramChatId ? form.telegramChatId.value.trim() : '',
      clearTelegram: Boolean(form.clearTelegram && form.clearTelegram.checked),
      events: {
        matchSubmitted: Boolean(form.matchSubmitted ? form.matchSubmitted.checked : (form.onMatchApproved ? form.onMatchApproved.checked : true)),
        matchApproved: Boolean(form.matchSubmitted ? form.matchSubmitted.checked : (form.onMatchApproved ? form.onMatchApproved.checked : true)),
        newRegistration: Boolean(form.newRegistration ? form.newRegistration.checked : true),
        roundReleased: Boolean(form.roundReleased ? form.roundReleased.checked : true),
        tribunalVerdict: Boolean(form.tribunalVerdict ? form.tribunalVerdict.checked : true),
        puskasOrGb: Boolean(form.puskasOrGb ? form.puskasOrGb.checked : true),
        disputeSubmitted: Boolean(form.disputeSubmitted ? form.disputeSubmitted.checked : (form.onDispute ? form.onDispute.checked : true)),
        onMatchApproved: Boolean(form.matchSubmitted ? form.matchSubmitted.checked : (form.onMatchApproved ? form.onMatchApproved.checked : true)),
        onWalkover: Boolean(form.tribunalVerdict ? form.tribunalVerdict.checked : (form.onWalkover ? form.onWalkover.checked : true)),
        onDispute: Boolean(form.disputeSubmitted ? form.disputeSubmitted.checked : (form.onDispute ? form.onDispute.checked : true)),
        onTotw: Boolean(form.roundReleased ? form.roundReleased.checked : (form.onTotw ? form.onTotw.checked : true))
      }
    };
    window.SMPL_DB.saveWebhooksConfig(payload).then((res) => {
      if (res && res.ok) {
        window._smplAdminWebhooksCache = Object.assign({}, window._smplAdminWebhooksCache || {}, res.config || res);
        showToast('✅ Zapisano konfigurację Discord & Telegram Webhooks!');
        adminLoadWebhooksPanel(true);
      } else {
        showToast((res && res.error) || 'Nie udało się zapisać webhooków.', 'error');
      }
    });
  }

  function adminTestWebhooks() {
    window.SMPL_DB.testWebhooks().then((res) => {
      if (res && res.ok) showToast('🧪 Wysłano wiadomość testową na skonfigurowane kanały!');
      else showToast((res && res.error) || 'Błąd testu webhooków.', 'error');
    });
  }

  function adminBroadcastWebhook(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = event && event.target ? event.target : null;
    if (!form) return;
    window.SMPL_DB.broadcastWebhook(
      form.title ? form.title.value : 'Ogłoszenie SMPL',
      form.message ? form.message.value : '',
      false
    ).then((res) => {
      if (res && res.ok) showToast('📣 Wysłano ogłoszenie broadcast!');
      else showToast((res && res.error) || 'Błąd broadcastu.', 'error');
    });
  }

  function adminLoadSnapshotsPanel(silent) {
    if (!window.SMPL_DB || typeof window.SMPL_DB.fetchSnapshotsList !== 'function') return;
    window._smplAdminSnapshotsLoaded = true;
    window.SMPL_DB.fetchSnapshotsList().then((res) => {
      if (res && res.ok && Array.isArray(res.snapshots)) {
        window._smplAdminSnapshotsCache = res.snapshots;
        renderAll();
        if (!silent) showToast('🛡️ Wczytano listę kopii zapasowych (' + res.snapshots.length + ').');
      } else if (!silent) {
        showToast((res && res.error) || 'Lista snapshotów wymaga serwera HTTP.', 'error');
      }
    });
  }

  function adminRestoreSnapshot(snapshotName) {
    if (typeof confirm === 'function' && !confirm('Czy na pewno przywrócić bazę danych z kopii: ' + snapshotName + '?')) {
      return;
    }
    window.SMPL_DB.restoreServerSnapshot(snapshotName).then((res) => {
      if (res && res.ok) {
        showToast('⏪ Przywrócono snapshot: ' + snapshotName + '! Odświeżanie danych...');
        if (typeof window.SMPL_DB.pullFromServer === 'function') {
          const pullPromise = window.SMPL_DB.pullFromServer(null, true);
          if (pullPromise && typeof pullPromise.then === 'function') {
            pullPromise.then(() => renderAll());
          } else {
            renderAll();
          }
        } else {
          renderAll();
        }
      } else {
        showToast((res && res.error) || 'Błąd przywracania snapshotu.', 'error');
      }
    });
  }

  function setUpdatesFilterCategory(cat) {
    updatesFilterState.category = String(cat || 'ALL').toUpperCase();
    renderMainContent(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
  }

  function setUpdatesSearchQuery(query) {
    updatesFilterState.search = String(query || '');
    renderMainContent(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
    setTimeout(() => {
      const inp = document.getElementById('smpl-updates-search');
      if (inp) {
        inp.focus();
        try {
          const len = inp.value.length;
          inp.setSelectionRange(len, len);
        } catch (e) {}
      }
    }, 0);
  }

  function openAdminUpdatePublisher() {
    const session = window.SMPL_DB.getSession();
    if (!window.SMPL_DB || !window.SMPL_DB.isStrictAdminSession(session)) {
      showToast('Dodawanie wpisów Update V... wymaga uprawnień Administratora.', 'error');
      return;
    }
    adminSubTab = 'settings';
    adminSettingsSubTab = 'updates';
    activeTab = 'admin';
    renderAll();
    setTimeout(() => {
      const card = document.getElementById('admin-player-updates-card');
      if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const verInp = document.getElementById('admin-player-updates-version');
      if (verInp) verInp.focus();
    }, 60);
  }

  function fillNextUpdateVersion(ver) {
    const inp = document.getElementById('admin-player-updates-version');
    if (inp) {
      inp.value = String(ver || '');
      inp.focus();
    }
  }

  function adminPublishPlayerUpdate(e) {
    if (e && e.preventDefault) e.preventDefault();
    const session = window.SMPL_DB.getSession();
    if (!window.SMPL_DB || !window.SMPL_DB.isStrictAdminSession(session)) {
      showToast('Tylko zalogowany Administrator może publikować Update V...', 'error');
      return;
    }
    const form = e && e.target ? e.target : null;
    if (!form) return;
    try {
      const saved = window.SMPL_DB.publishPlayerUpdate({
        version: form.version ? form.version.value : '',
        category: form.category ? form.category.value : 'NOWOŚCI',
        title: form.title ? form.title.value : '',
        summary: form.summary ? form.summary.value : '',
        highlights: form.highlights ? form.highlights.value : ''
      }, session.adminName || 'Szymon Komenda');
      markUpdateVersionSeen(saved.version);
      showToast('🆕 Opublikowano dla graczy Update ' + saved.version + '!');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się zapisać wpisu Update.', 'error');
    }
  }

  function adminDeletePlayerUpdate(updateId) {
    const session = window.SMPL_DB.getSession();
    if (!window.SMPL_DB || !window.SMPL_DB.isStrictAdminSession(session)) {
      showToast('Tylko Administrator może usuwać wpisy Update.', 'error');
      return;
    }
    try {
      window.SMPL_DB.deletePlayerUpdate(updateId, session.adminName || 'Szymon Komenda');
      showToast('🗑️ Usunięto wpis z dziennika zmian.');
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Nie udało się usunąć wpisu.', 'error');
    }
  }

  function toggleSettingsDrawer() {
    settingsDrawerOpen = !settingsDrawerOpen;
    if (settingsDrawerOpen) notifCenterOpen = false;
    renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
  }

  function closeSettingsDrawer() {
    if (!settingsDrawerOpen) return;
    settingsDrawerOpen = false;
    renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
  }

  function openNotificationsCenterModal() {
    settingsDrawerOpen = false;
    notifCenterOpen = true;
    renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
  }

  function closeNotificationsCenterModal() {
    if (!notifCenterOpen) return;
    notifCenterOpen = false;
    renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
  }

  function handleMarkNotificationsRead() {
    if (window.SMPL_DB && typeof window.SMPL_DB.markAllNotificationsRead === 'function') {
      const targetPl = resolveNotificationTargetPlayer();
      const cnt = window.SMPL_DB.markAllNotificationsRead(targetPl ? targetPl.id : null);
      if (cnt > 0) showToast(`✅ Oznaczono ${cnt} powiadomień jako przeczytane.`);
      renderAll();
    }
  }

  function handleClearNotifications() {
    if (window.SMPL_DB && typeof window.SMPL_DB.clearPlayerNotifications === 'function') {
      const targetPl = resolveNotificationTargetPlayer();
      const cnt = window.SMPL_DB.clearPlayerNotifications(targetPl ? targetPl.id : null, false);
      if (cnt > 0) showToast(`🗑️ Wyczyszczono ${cnt} powiadomień ze skrzynki.`);
      renderAll();
    }
  }

  function setThemePreference(themeId) {
    const found = THEME_OPTIONS.find((t) => t.id === themeId) || THEME_OPTIONS[0];
    try {
      localStorage.setItem('smpl_theme_pref', found.id);
    } catch (e) {}
    const eff = applyThemeToDom();
    renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
    const effLabel = getThemeEffectiveLabel(eff);
    const toastTitle = effLabel.toLowerCase().indexOf(found.name.toLowerCase()) !== -1
      ? effLabel
      : `${found.name} • ${effLabel}`;
    showToast(`${found.icon} Motyw: ${toastTitle}`);
  }

  function setPortalDesignMode(mode) {
    const clean = mode === 'classic' ? 'classic' : 'wow';
    if (window.SMPL_WOW && typeof window.SMPL_WOW.setPortalDesignMode === 'function') {
      window.SMPL_WOW.setPortalDesignMode(clean);
    } else if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-smpl-overhaul', clean);
    }
    renderAll();
    showToast(
      clean === 'wow'
        ? '✨ Włączono przebudowany styl „Studio Mistrzów 2026” (WOW).'
        : '🏛️ Przełączono na klasyczny widok sprzed przebudowy.'
    );
  }

  function togglePortalDesignMode() {
    const isWow = !window.SMPL_WOW || typeof window.SMPL_WOW.isOverhaulEnabled !== 'function'
      ? (typeof document !== 'undefined' && document.documentElement && document.documentElement.getAttribute('data-smpl-overhaul') !== 'classic')
      : window.SMPL_WOW.isOverhaulEnabled();
    setPortalDesignMode(isWow ? 'classic' : 'wow');
  }

  function cycleThemePreference() {
    const cur = getThemePreference();
    const idx = THEME_OPTIONS.findIndex((t) => t.id === cur);
    const next = THEME_OPTIONS[(idx + 1) % THEME_OPTIONS.length];
    setThemePreference(next.id);
  }

  function toggleFullscreenMode() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    try {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsEl) {
        const ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (typeof ex === 'function') ex.call(document);
        showToast('⛶ Wyłączono tryb pełnoekranowy.');
        return;
      }
      const req = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
      if (typeof req === 'function') {
        const prom = req.call(document.documentElement);
        if (prom && typeof prom.then === 'function') {
          prom.then(() => {
            renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
          }).catch(() => {
            showToast('📱 Pełny ekran na tym urządzeniu otwórz z pulpitu: Udostępnij ➔ Dodaj do ekranu początkowego (PWA).', 'info');
          });
        }
        return;
      }
      showToast('📱 Pełny ekran na telefonie działa najlepiej po zainstalowaniu jako PWA („Dodaj do ekranu głównego”).', 'info');
    } catch (e) {
      showToast('📱 Pełny ekran włączysz instalując aplikację na ekranie głównym telefonu (PWA).', 'info');
    }
  }

  function toggleHeroExpand(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !isHeroExpandedNow();
    try {
      localStorage.setItem('smpl_hero_expanded', next ? '1' : '0');
    } catch (e) {}
    applyHeroBannerCollapseState();
    if (settingsDrawerOpen) renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
  }

  function toggleAiFabVisibility(forceState) {
    const nextVisible = typeof forceState === 'boolean' ? forceState : !isAiFabVisibleNow();
    try {
      localStorage.setItem('smpl_ai_fab_mode', nextVisible ? 'show' : 'hide');
    } catch (e) {}
    renderAiAssistantWidget(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
    if (settingsDrawerOpen) renderTopBar(window.SMPL_DB.getState(), window.SMPL_DB.getSession());
    showToast(nextVisible ? '🤖 Pływający przycisk Vanessy AI widoczny na ekranie.' : '🤖 Przycisk Vanessy AI ukryty — zawsze dostępna w ⚙️ Menu.');
  }

  function copyCleanRoomCode(rawCode) {
    const clean = window.SMPL_NOTIF && typeof window.SMPL_NOTIF.sanitizeScoreMatchRoomCode === 'function'
      ? window.SMPL_NOTIF.sanitizeScoreMatchRoomCode(rawCode)
      : String(rawCode || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!clean) return;
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.copyToClipboard === 'function') {
      window.SMPL_NOTIF.copyToClipboard(clean, `Skopiowano kod słowny: ${clean} (bez cyfr — wklej w Score! Match!)`);
    }
  }

  function copyRoomInviteForMessenger(partnerName, fbLink) {
    const fallbackWords = ['DERBY', 'KARNY', 'ARENA', 'BRAMA', 'PUCHAR', 'MISTRZ'];
    const code = window.SMPL_NOTIF
      ? window.SMPL_NOTIF.generateScoreMatchRoomCode()
      : fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
    const msg = `Cześć! Gramy nasz mecz ligowy w Score! Match?\nZałożyłem pokój, wpisz kod (tylko litery): ${code}\nCzekam w grze!`;
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.copyToClipboard === 'function') {
      window.SMPL_NOTIF.copyToClipboard(msg, `Skopiowano zaproszenie na Messenger z kodem ${code}!`);
    }
    const cleanUrl = String(fbLink || '').trim();
    if (/^https?:\/\//i.test(cleanUrl) && cleanUrl !== 'https://m.me/' && cleanUrl !== 'https://m.me/smpl') {
      try {
        window.open(cleanUrl, '_blank', 'noopener,noreferrer');
      } catch (e) {}
    }
  }

  function openMessengerForPlayer(playerId) {
    const state = window.SMPL_DB.getState();
    const p = (state.players || []).find((x) => x && x.id === playerId);
    const adm = !p && (state.admins || []).find((a) => a && a.id === playerId);
    const targetName = p ? p.name : (adm ? adm.name : 'Rywal');
    const targetFb = (p && p.fbLink) ? p.fbLink : ((adm && adm.fbLink) ? adm.fbLink : '');
    copyRoomInviteForMessenger(targetName, targetFb);
    if (!targetFb) {
      showToast(`📋 Skopiowano zaproszenie — otwórz Messenger i wyślij je do: ${targetName}!`, 'info');
    }
  }

  function handleSetupUatMiniLeague(leagueId, seedSamples) {
    if (!requireStrictAdmin('uruchomienie Mini-Ligi Testowej UAT')) return;
    try {
      const sess = window.SMPL_DB.getSession();
      const res = window.SMPL_DB.setupUatMiniLeague(
        { leagueId: leagueId || 'L3', seedSampleResults: Boolean(seedSamples) },
        sess.adminName || 'Szymon Komenda'
      );
      activeLeague = res.leagueId;
      renderAll();
      const esc = (window.SMPL_VIEWS && window.SMPL_VIEWS.escapeHtml) ? window.SMPL_VIEWS.escapeHtml : ((v) => String(v || ''));
      const messengerBlock = res.credentials
        .map((c) => `• ${c.name} (${c.role}) -> login: ${c.username} | hasło: ${c.password}`)
        .join('\n');
      const modalHtml = `
        <div class="p-5 sm:p-6 space-y-4 text-xs">
          <div class="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <div class="font-display font-black text-base sm:text-lg text-emerald-300 uppercase">🧪 Mini-Liga Testowa UAT Gotowa (${esc(res.leagueId)})!</div>
              <p class="text-slate-300 mt-0.5">Utworzono 5 kont testowych oraz ${res.matchesCount} meczów (${res.roundsCount} kolejek dwumeczów).</p>
            </div>
            <button type="button" onclick="SMPL_APP.closeModal()" class="smpl-topbar-icon-btn">✕</button>
          </div>
          <div class="space-y-2 max-h-64 overflow-y-auto pr-1">
            ${res.credentials.map((c) => `
              <div class="p-3 rounded-xl bg-slate-950 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="font-bold text-white">${esc(c.name)} <span class="text-amber-300 text-[10px]">(${esc(c.role)})</span></div>
                  <div class="text-slate-300 mt-0.5">Login: <code class="text-emerald-300 font-bold">${esc(c.username)}</code> • Hasło: <code class="text-amber-300 font-bold">${esc(c.password)}</code></div>
                </div>
              </div>
            `).join('')}
          </div>
          <textarea id="uat-creds-copy-box" readonly rows="6" class="w-full p-3 rounded-xl bg-slate-950 border border-white/15 text-slate-200 font-mono text-[11px]">${esc('🧪 MINI-LIGA TESTOWA SMPL (' + res.leagueId + '):\n' + messengerBlock)}</textarea>
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" onclick="SMPL_APP.copyTextHelper(document.getElementById('uat-creds-copy-box').value, 'Skopiowano dane wszystkich 5 testerów na Messenger!')" class="btn-league px-4 py-2.5 rounded-xl font-display font-black uppercase">
              📋 Kopiuj Dane na Messenger
            </button>
            <button type="button" onclick="SMPL_APP.closeModal(); SMPL_APP.switchLeague('${esc(res.leagueId)}'); SMPL_APP.switchTab('standings');" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase">
              🏆 Otwórz Tabelę ${esc(res.leagueId)}
            </button>
          </div>
        </div>
      `;
      openModal(modalHtml);
      showToast(`🧪 Utworzono Mini-Ligę Testową UAT w ${res.leagueId} (${res.matchesCount} meczów)!`);
    } catch (err) {
      showToast((err && err.message) || 'Błąd uruchamiania ligi testowej.', 'error');
    }
  }

  function handleCleanupUatMiniLeague() {
    if (!requireStrictAdmin('usunięcie danych testowych UAT')) return;
    try {
      const sess = window.SMPL_DB.getSession();
      const res = window.SMPL_DB.cleanupUatMiniLeague(sess.adminName || 'Szymon Komenda');
      showToast(`🧹 Usunięto dane testowe UAT (${res.removedPlayers} kont, ${res.removedMatches} meczów).`);
      renderAll();
    } catch (err) {
      showToast((err && err.message) || 'Błąd czyszczenia danych UAT.', 'error');
    }
  }

  function installAndroidBackButtonGuard() {
    if (backGuardInstalled || typeof window === 'undefined' || !window.history || typeof window.history.pushState !== 'function') return;
    backGuardInstalled = true;
    try {
      window.history.pushState({ smplAppGuard: true }, '', window.location.href);
    } catch (e) {}

    window.addEventListener('popstate', function () {
      const modalRoot = document.getElementById('global-modal-root');
      const hasModal = Boolean(modalRoot && modalRoot.innerHTML && modalRoot.innerHTML.trim());
      if (notifCenterOpen) {
        closeNotificationsCenterModal();
        try { window.history.pushState({ smplAppGuard: true }, '', window.location.href); } catch (e) {}
        return;
      }
      if (settingsDrawerOpen) {
        closeSettingsDrawer();
        try { window.history.pushState({ smplAppGuard: true }, '', window.location.href); } catch (e) {}
        return;
      }
      if (aiWidgetState.isOpen) {
        closeAiAssistant();
        try { window.history.pushState({ smplAppGuard: true }, '', window.location.href); } catch (e) {}
        return;
      }
      if (hasModal) {
        closeModal();
        try { window.history.pushState({ smplAppGuard: true }, '', window.location.href); } catch (e) {}
        return;
      }
      const sess = window.SMPL_DB && typeof window.SMPL_DB.getSession === 'function' ? window.SMPL_DB.getSession() : null;
      if (sess && sess.linkMode === 'PUBLIC' && activeTab !== 'standings') {
        switchTab('standings');
        try { window.history.pushState({ smplAppGuard: true }, '', window.location.href); } catch (e) {}
        return;
      }
      const now = Date.now();
      if (now - lastBackPressAt < 2500) {
        return;
      }
      lastBackPressAt = now;
      try { window.history.pushState({ smplAppGuard: true }, '', window.location.href); } catch (e) {}
      showToast('📱 Naciśnij Wstecz jeszcze raz, aby zamknąć aplikację.', 'info');
    });
  }

  function selectSupportTier(tierId) {
    supportUiState.selectedTier = String(tierId || 'pizza');
    renderAll();
  }

  function copySupportText(text, successMsg) {
    const val = String(text || '');
    if (!val) return;
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.copyToClipboard === 'function') {
      window.SMPL_NOTIF.copyToClipboard(val, successMsg || 'Skopiowano do schowka!');
      return;
    }
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val);
      }
    } catch (e) {}
    showToast('📋 ' + (successMsg || 'Skopiowano do schowka!'), 'success');
  }

  function openMasterSupportConfig() {
    activeTab = 'admin';
    adminSubTab = 'master_studio';
    renderAll();
    setTimeout(() => {
      const card = document.getElementById('master-support-config-card');
      if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  }

  function masterSaveSupportConfig(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    try {
      const sess = window.SMPL_DB.getSession();
      const val = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : undefined;
      };
      const chk = (id) => {
        const el = document.getElementById(id);
        return el ? Boolean(el.checked) : undefined;
      };
      window.SMPL_DB.masterUpdateSupportConfig(
        {
          enabled: chk('master-sup-enabled'),
          adminSupportEnabled: chk('master-sup-admin-enabled'),
          buyCoffeeUrl: val('master-sup-buycoffee'),
          suppiUrl: val('master-sup-suppi'),
          paypalUrl: val('master-sup-paypal'),
          blikInfo: val('master-sup-blik'),
          goalTitle: val('master-sup-goal-title'),
          goalPeriod: val('master-sup-goal-period'),
          goalAmount: val('master-sup-goal-amt'),
          currentAmount: val('master-sup-cur-amt'),
          adminSupportUrl: val('master-sup-admin-url'),
          headline: val('master-sup-headline'),
          intro: val('master-sup-intro')
        },
        (sess && sess.adminName) || 'Szymon Komenda'
      );
      showToast('☕ Zapisano konfigurację zakładki Wsparcia (Donate)!', 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd zapisu ustawień Wsparcia.', 'error');
    }
  }

  function masterAddSupporter(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    try {
      const sess = window.SMPL_DB.getSession();
      const nameEl = document.getElementById('master-sup-add-name');
      const badgeEl = document.getElementById('master-sup-add-badge');
      const noteEl = document.getElementById('master-sup-add-note');
      const res = window.SMPL_DB.masterAddSupporterEntry(
        {
          displayName: nameEl ? nameEl.value : '',
          badge: badgeEl ? badgeEl.value : '☕',
          note: noteEl ? noteEl.value : ''
        },
        (sess && sess.adminName) || 'Szymon Komenda'
      );
      showToast(`🏆 Dodano podziękowanie dla: ${res.displayName}!`, 'success');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd dodawania wpisu na Ścianę Mecenasów.', 'error');
    }
  }

  function masterRemoveSupporter(supporterId) {
    if (!confirm('Usunąć ten wpis ze Ściany Mecenasów?')) return;
    try {
      const sess = window.SMPL_DB.getSession();
      window.SMPL_DB.masterRemoveSupporterEntry(supporterId, (sess && sess.adminName) || 'Szymon Komenda');
      showToast('🗑️ Usunięto wpis ze Ściany Mecenasów.', 'info');
      renderAll();
    } catch (err) {
      showToast(err.message || 'Błąd usuwania wpisu.', 'error');
    }
  }

  return {
    showToast,
    handleUtCardTilt,
    resetUtCardTilt,
    openRankTooltipModal,
    closeRankTooltip,
    handleBroadcastRoundRelease,
    handleApplyTribunalVerdict,
    handleDismissIncident,
    handleManualDisciplinarySubmit,
    handlePardonPlayer,
    openDisciplinaryModalForPlayer,
    handleToggleSound,
    handleToggleNotifications,
    handleEnablePushNotifications,
    handleTestPushNotification,
    openIosInstallGuideModal,
    start,
    refreshViewFromServer,
    manualServerSync,
    copyRegistrationLink,
    switchLeague,
    switchTab,
    setAdminSubTab,
    setAdminRecruitmentSubTab,
    setAdminSettingsSubTab,
    setAdminLeagueQuick,
    setScheduleRound,
    setScheduleWeek,
    setScheduleStatus,
    setScheduleSearch,
    setH2HPlayer,
    setProfilePlayer,
    openPlayerProfileTab,
    handlePlayerLoginSubmit,
    openPasswordReminderModal,
    handlePlayerPasswordReminderSubmit,
    handleAdminSendPasswordReminder,
    copyTextHelper,
    openAdminResetPasswordModal,
    confirmAdminResetPassword,
    openAwardTrophyModal,
    confirmAwardTrophy,
    handleGoldenBallVoteSubmit,
    handleGoldenBallAiAnalysis,
    handleAdminAwardGoldenBall,
    setCompetitionsSubTab,
    setGoldenBootLeague,
    handleAdminAwardCompetition,
    handleGenerateCupBracket,
    handleClearCupBracket,
    openCupMatchModal,
    toggleCupPenaltyVisibility,
    handleSaveCupMatchResult,
    handleTyperPredictionSubmit,
    handlePuskasNominateSubmit,
    handlePuskasVote,
    handleMasterCompetitionAction,
    setArchiveMode,
    setArchiveSeason,
    setArchiveLeague,
    setArchiveSearch,
    handleArchiveCurrentSeason,
    handleSetActiveWeek,
    openMessengerReportModal,
    copyMessengerReportText,
    copyAdminChangelog,
    openGdprDeleteModal,
    confirmGdprDelete,
    setLegalSubTab,
    openLegalSummaryModal,
    openLegalReportOrAppeal,
    exitAdminGateToPublic,
    handleUpdateAdminCredentials,
    handleAdminGateLogin,
    handleAdminApplicationSubmit,
    handleAdminLogout,
    masterApproveAdmin,
    masterRejectAdmin,
    prefillMatchSubmission,
    updateSubmitFormLeague,
    updateSubmitFormRound,
    updateSubmitFormMatch,
    stepSubmitScore,
    setSubmitScore,
    setSubmitQuickScore,
    setSubmitComment,
    handleMatchScreenUpload,
    generateDemoMatchScreenForForm,
    handleMatchSubmit,
    updateRegField,
    handleRegAvatarUpload,
    toggleRegPlayedBefore,
    onRegHistSelect,
    fillDemoRegistration,
    handleRegistrationSubmit,
    adminApproveMatch,
    adminApproveDoubleMatch,
    approveAllPendingMatches,
    adminRejectMatchPrompt,
    confirmRejectMatch,
    openAdminEditMatchModal,
    saveAdminMatchEdit,
    adminQuickWalkover,
    adminAssignReg,
    openAssignHistoricalStatsModal,
    applyHistoricalArchiveOneClick,
    applyHistoricalPresetOneClick,
    saveCustomHistoricalStats,
    adminRejectRegPrompt,
    quickPenaltyThree,
    openDeductPointsModal,
    confirmDeductPoints,
    setDeductAmountPreset,
    clearPlayerPenaltyFromModal,
    openEditPlayerModal,
    previewEditPlayerAvatar,
    saveEditPlayer,
    openAddPlayerModal,
    confirmAddPlayer,
    handleClearAllTablesSeason56,
    confirmCleanNewSeason,
    handleClearSingleLeague,
    handleMovePlayerToLeague,
    handleDeletePlayer,
    handleHardDeletePlayer,
    adminClearSchedule,
    adminRecalculateAllHistoricalStats,
    adminRegenerateSchedule,
    adminAddByeSlot,
    handleCustomCrestUpload,
    exportDatabaseJson,
    resetSeedConfirm,
    handleStartFreshSeason56,
    openNextSeasonRolloverModal,
    confirmNextSeasonRollover,
    handleRestoreExcelState,
    setGateMode,
    handleGateLoginSubmit,
    handleGateGuestEnter,
    handleGateLock,
    updateGateField,
    handleGateAvatarUpload,
    onClanSelectChange,
    updateClanField,
    handleClanLogoUpload,
    clearClanLogoUpload,
    filterHistSelect,
    toggleGatePlayedBefore,
    onGateHistSelect,
    fillDemoRegistrationGate,
    handleGateRegistrationSubmit,
    openScreenshotModal,
    openPlayerModal,
    openPlayerSelectModal,
    openPlayerChangePasswordModal,
    handleChangeMyPlayerPassword,
    openEditOwnProfileModal,
    handleEditProfileAvatarFile,
    selectEditProfilePresetAvatar,
    handleEditProfileAvatarUrlInput,
    resetEditOwnProfileAvatar,
    updateEditProfileBioCounter,
    handleSaveOwnProfile,
    selectActivePlayer,
    setArchiveSeasonGroup,
    openArchivePlayerCareer,
    switchGlobalSeason,
    fillBlacklistFromSelect,
    presetBlacklistReason,
    handleAddToBlacklist,
    handleRemoveFromBlacklist,
    openBlacklistBlockedModal,
    aiNavigate,
    openAiAssistant,
    closeAiAssistant,
    resetAiConversation,
    refreshAiEngineStatus,
    refreshAiGeminiAdminPanel,
    handleSaveAiGeminiConfig,
    handleTestAiGeminiConfig,
    sendAiQuestion,
    askAiQuickPrompt,
    askAiFromButton,
    scrollAiQuickBar,
    rateAiAnswer,
    handleAdminTeachFromQueue,
    handleAdminDismissAiQueue,
    handleAdminAddCustomAiKnowledge,
    handleAdminDeleteAiKnowledge,
    openAddLeagueModal,
    selectAddLeaguePreset,
    confirmAddLeague,
    handleToggleLeagueEnabled,
    masterPreviewRank,
    masterApplyRankTemplate,
    masterPreviewAssignSelection,
    masterQuickSelectAssignRank,
    masterPickRankIcon,
    masterPickRankColor,
    masterResetRankForm,
    masterEditCustomRank,
    masterSaveCustomRankSubmit,
    masterDeleteCustomRank,
    masterAssignRankSubmit,
    masterSavePortalSettingsSubmit,
    masterHandleClanLogoFile,
    masterResetClanForm,
    masterEditClan,
    masterSaveClanSubmit,
    masterDeleteClan,
    masterSaveLeagueSubmit,
    masterGoldenBallAction,
    masterImportDatabaseFile,
    filterAddPlayerCandidates,
    adminAddCandidate,
    adminAssignPoolReg,
    openPreparedCredentialsModal,
    masterFillGrantAdminFromSource,
    masterGenerateGrantAdminPass,
    masterGrantAdminSubmit,
    openMasterGrantPlayerAdminModal,
    masterModalGenerateGrantPass,
    confirmMasterGrantPlayerAdmin,
    onManualRegIdentityInput,
    onManualRegUsernameManualEdit,
    manualRegGeneratePass,
    handleAdminManualRegisterSubmit,
    onAddPlayerModalNameInput,
    onAddPlayerModalUsernameEdit,
    addPlayerModalGeneratePass,
    openPostRegistrationAdminChoiceModal,
    adminAssignRegFromChoice,
    adminApproveRegAccount,
    handleApproveAllPendingToPool,
    openAdminJoinAsPlayerModal,
    toggleAdminJoinHistFields,
    confirmAdminJoinAsPlayer,
    openPlayerQuickJoinModal,
    handlePlayerJoinLeague,
    handlePlayerLeaveLeague,
    handleSetSeasonJoinWindow,
    downloadStandingsPosterPng,
    downloadMatchdayPosterPng,
    downloadUtCardPosterPng,
    downloadWrappedPosterPng,
    downloadLastGeneratedPng,
    shareLastGeneratedPng,
    exportStandingsCsv,
    exportArchiveRankingCsv,
    exportDisciplinaryLogCsv,
    printCurrentView,
    openMatchProposalModal,
    submitMatchProposalForm,
    respondToMatchProposal,
    openMatchDisputeModal,
    submitMatchDisputeForm,
    adminResolveDispute,
    voteMatchFanPoll,
    openCoinShopModal,
    setCoinShopCategory,
    previewShopSound,
    handleBuyShopItem,
    handleEquipShopItem,
    handleClaimShopQuest,
    toggleShopGiftType,
    handleSendShopGift,
    masterQuickGrantCoins,
    masterSubmitGrantCoinsForm,
    masterResetPlayerBonusCoins,
    openMasterGrantCoinsModal,
    openSmplWrappedModal,
    openVacationModeModal,
    submitVacationModeForm,
    adminAwardTotwWeek,
    adminGeneratePlayoffTies,
    adminSubmitPlayoffLeg,
    adminGenerateSupercupBracket,
    adminSubmitSupercupMatch,
    adminGenerateBlitzBracket,
    adminSubmitBlitzMatch,
    handleAddSmplTvClip,
    adminSaveSmplTvLive,
    adminEndSmplTvLive,
    adminPublishNewsletter,
    adminGenerateOfflineNewsletter,
    adminGenerateAiNewsletter,
    adminVerifyMatchScreenshotAI,
    openDraftBucketsModal,
    handleGenerateDraftBuckets,
    handleCommitDraftAssignments,
    openReplacePlayerModal,
    handleConfirmReplacePlayer,
    adminToggleMaintenanceMode,
    adminLoadWebhooksPanel,
    adminSaveWebhooks,
    adminTestWebhooks,
    adminBroadcastWebhook,
    adminLoadSnapshotsPanel,
    adminRestoreSnapshot,
    setUpdatesFilterCategory,
    setUpdatesSearchQuery,
    openAdminUpdatePublisher,
    fillNextUpdateVersion,
    adminPublishPlayerUpdate,
    adminDeletePlayerUpdate,
    toggleSettingsDrawer,
    closeSettingsDrawer,
    openNotificationsCenterModal,
    closeNotificationsCenterModal,
    handleMarkNotificationsRead,
    handleClearNotifications,
    setThemePreference,
    cycleThemePreference,
    setPortalDesignMode,
    togglePortalDesignMode,
    toggleFullscreenMode,
    toggleHeroExpand,
    toggleAiFabVisibility,
    copyCleanRoomCode,
    copyRoomInviteForMessenger,
    openMessengerForPlayer,
    openDisputeScreenshotModal,
    handleDisputeScreenUpload,
    handleAdminWalkoverScreenUpload,
    handleSetupUatMiniLeague,
    handleCleanupUatMiniLeague,
    selectSupportTier,
    copySupportText,
    openMasterSupportConfig,
    masterSaveSupportConfig,
    masterAddSupporter,
    masterRemoveSupporter,
    openOnboardingTutorialModal,
    closeOnboardingTutorialModal,
    seekOnboardingTutorial,
    playOnboardingTutorialFromOverlay,
    closeModal
  };
})();



document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('smpl-glass-tooltip-root') && window.SMPL_APP && window.SMPL_APP.closeRankTooltip) {
      window.SMPL_APP.closeRankTooltip();
    }
    if (window.SMPL_APP && window.SMPL_APP.closeSettingsDrawer) {
      window.SMPL_APP.closeSettingsDrawer();
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    window.SMPL_APP.start();
  } catch (bootErr) {
    console.error('[SMPL BOOT ERROR]', bootErr);
    const gate = document.getElementById('fullscreen-auth-gate');
    if (gate) gate.style.display = 'none';
    const main = document.getElementById('main-portal-container');
    if (main) main.style.display = 'block';
    const view = document.getElementById('app-main-view');
    if (view) {
      view.innerHTML = `<div style="padding:24px;border-radius:16px;background:rgba(127,29,29,0.45);border:1px solid #ef4444;color:#fecaca;font-family:sans-serif;max-width:720px;margin:24px auto;">
        <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;">⚠️ Błąd uruchamiania portalu Score Match Liga</h2>
        <p style="font-size:13px;line-height:1.5;">Odśwież stronę klawiszami <strong>Ctrl + F5</strong> (twarde odświeżenie cache przeglądarki). Jeśli problem nie ustąpi: <code>${String(bootErr && bootErr.message ? bootErr.message : bootErr)}</code></p>
      </div>`;
    }
  }
});
