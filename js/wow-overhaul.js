/* ==========================================================================
   SCORE MATCH LIGA (SMPL) — SILNIK PRZEBUDOWY „STUDIO MISTRZÓW” (WOW OVERHAUL)
   Oddzielny moduł JS odpowiedzialny za:
     • 5 w pełni działających motywów + tryby Auto Telefon / Pora Dnia 24h
     • Broadcast Live HUD w sekcji Hero (Lider + Najbliższy Mecz + Postęp Kolejki)
     • Kompaktowy pasek przełączania lig (Segmented Pro Bar)
     • Przełącznik Stylu Portalu: Nowy WOW 2026 <-> Klasyczny (1-klik rollback UX)
   ========================================================================== */
(function () {
  'use strict';

  var DESIGN_STORAGE_KEY = 'smpl_portal_design';
  var THEME_STORAGE_KEY = 'smpl_theme_pref';

  var THEME_OPTIONS = [
    { id: 'auto-system', icon: '📱', name: 'Auto Telefon', desc: 'Jasny lub nocny wg systemu' },
    { id: 'auto-time', icon: '🕒', name: 'Pora Dnia 24h', desc: 'Świt • Dzień • Wieczór • Noc' },
    { id: 'dark', icon: '🌌', name: 'Noc Mistrzów', desc: 'Onyks, Złoto & Hologramy' },
    { id: 'light', icon: '☀️', name: 'Jasny Prestiż', desc: 'Porcelana, Błękit & Złoto' },
    { id: 'prestige', icon: '💎', name: 'Szmaragd VIP', desc: 'Loża Szmaragdowa & Platyna' },
    { id: 'twilight', icon: '⚡', name: 'Wieczorne Jupitery', desc: 'Ametyst, Cyjan & Neon UCL' },
    { id: 'dawn', icon: '🌅', name: 'Poranny Stadion', desc: 'Złoty Świt w Blasku Dnia' }
  ];

  function escHtml(str) {
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

  function getPortalDesignMode() {
    try {
      var v = localStorage.getItem(DESIGN_STORAGE_KEY);
      if (v === 'classic' || v === 'wow') return v;
    } catch (e) {}
    return 'wow';
  }

  function isOverhaulEnabled() {
    return getPortalDesignMode() !== 'classic';
  }

  function setPortalDesignMode(mode) {
    var clean = mode === 'classic' ? 'classic' : 'wow';
    try {
      localStorage.setItem(DESIGN_STORAGE_KEY, clean);
    } catch (e) {}
    applyOverhaulAttribute(clean);
    return clean;
  }

  function applyOverhaulAttribute(explicitMode) {
    if (typeof document === 'undefined' || !document.documentElement) return 'wow';
    var mode = explicitMode || getPortalDesignMode();
    document.documentElement.setAttribute('data-smpl-overhaul', mode);
    return mode;
  }

  function getThemePreference() {
    try {
      var saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) {
        for (var i = 0; i < THEME_OPTIONS.length; i++) {
          if (THEME_OPTIONS[i].id === saved) return saved;
        }
      }
    } catch (e) {}
    return 'auto-system';
  }

  function resolveEffectiveTheme(pref) {
    var p = pref || getThemePreference();
    if (p === 'dark' || p === 'light' || p === 'prestige' || p === 'twilight' || p === 'dawn') {
      return p;
    }
    if (p === 'auto-time') {
      var h = new Date().getHours();
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
    if (eff === 'light') return 'Jasny Prestiż (Porcelana)';
    if (eff === 'dawn') return 'Poranny Stadion (Złoty Świt)';
    if (eff === 'twilight') return 'Wieczorne Jupitery (Neon UCL)';
    if (eff === 'prestige') return 'Szmaragdowy Pałac VIP';
    return 'Noc Mistrzów (Onyks & Złoto)';
  }

  function getThemeScheduleHint(pref, eff) {
    var base = getThemeEffectiveLabel(eff);
    if (pref === 'auto-time') {
      var h = new Date().getHours();
      if (h >= 6 && h < 12) return base + ' • następna zmiana o 12:00';
      if (h >= 12 && h < 18) return base + ' • następna zmiana o 18:00';
      if (h >= 18 && h < 22) return base + ' • następna zmiana o 22:00';
      return base + ' • następna zmiana o 06:00';
    }
    if (pref === 'auto-system') {
      return base + ' (z systemu urządzenia)';
    }
    return base;
  }

  function findNextSpotlightMatch(state, activeLeagueId, session) {
    var matches = (state && Array.isArray(state.matches) ? state.matches : []).filter(function (m) {
      return m && m.leagueId === activeLeagueId && m.status === 'SCHEDULED';
    });
    if (!matches.length) return null;

    var myPlayerId = session && session.activePlayerId ? session.activePlayerId : '';
    if (myPlayerId) {
      for (var i = 0; i < matches.length; i++) {
        if (matches[i].homeId === myPlayerId || matches[i].awayId === myPlayerId) {
          return { match: matches[i], isOwn: true };
        }
      }
    }
    matches.sort(function (a, b) {
      return Number(a.round || 999) - Number(b.round || 999);
    });
    return { match: matches[0], isOwn: false };
  }

  function renderHeroLiveHud(state, activeLeagueId, session) {
    if (typeof document === 'undefined') return;
    var hudEl = document.getElementById('wow-hero-live-hud');
    if (!hudEl) return;

    applyOverhaulAttribute();
    if (!isOverhaulEnabled() || !state) {
      hudEl.className = 'hidden';
      hudEl.innerHTML = '';
      return;
    }

    var lgId = activeLeagueId || 'L1';
    var lgObj = (state.leagues && state.leagues[lgId]) || { id: lgId, shortName: lgId };
    var lgMatches = (state.matches || []).filter(function (m) {
      return m && m.leagueId === lgId;
    });
    var playedCount = lgMatches.filter(function (m) {
      return m && (m.status === 'APPROVED' || m.status === 'WALKOVER');
    }).length;
    var pendingCount = lgMatches.filter(function (m) {
      return m && m.status === 'PENDING';
    }).length;
    var totalCount = lgMatches.length;
    var pct = totalCount > 0 ? Math.min(100, Math.round((playedCount * 100) / totalCount)) : 0;
    var curWeek = Number((state.weeklyConfig && state.weeklyConfig.currentWeek) || 1);
    var rpw = Number((state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4);
    var rStart = (curWeek - 1) * rpw + 1;
    var rEnd = curWeek * rpw;

    var standings =
      window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateStandings === 'function'
        ? window.SMPL_ENGINE.calculateStandings(state, lgId)
        : [];
    var leader = standings && standings.length > 0 ? standings[0] : null;
    var playersMap = {};
    (state.players || []).forEach(function (p) {
      if (p && p.id) playersMap[p.id] = p;
    });
    var nextSpot = findNextSpotlightMatch(state, lgId, session);
    var nextHome = nextSpot && nextSpot.match ? playersMap[nextSpot.match.homeId] : null;
    var nextAway = nextSpot && nextSpot.match ? playersMap[nextSpot.match.awayId] : null;

    hudEl.className = 'wow-hero-hud-card space-y-2.5';
    hudEl.innerHTML =
      '<div class="flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] font-display font-bold uppercase whitespace-nowrap overflow-hidden">' +
      '  <span class="inline-flex items-center gap-1 text-emerald-300 whitespace-nowrap min-w-0 truncate">' +
      '    <span class="smpl-live-beacon-dot flex-shrink-0"></span>' +
      '    <span class="truncate">STUDIO • ' + escHtml(lgObj.shortName || lgId) + ' • TYDZ. ' + curWeek + ' (K' + rStart + '–' + rEnd + ')</span>' +
      '  </span>' +
      '  <span class="text-slate-300 font-mono-num whitespace-nowrap flex-shrink-0">' + playedCount + '/' + totalCount + ' meczów (' + pct + '%)' + (pendingCount > 0 ? ' • ⏳ ' + pendingCount : '') + '</span>' +
      '</div>' +
      '<div class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">' +
      '  <div class="h-full rounded-full transition-all duration-300" style="width:' + pct + '%;background:linear-gradient(90deg,var(--league-primary),var(--wow-accent-prism))"></div>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-2 pt-0.5">' +
      (leader
        ? '<button type="button" onclick="SMPL_APP.openPlayerProfileTab(\'' + escHtml(leader.playerId) + '\')" class="text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center gap-2.5 min-w-0">' +
          (leader.avatar ? '<img src="' + escHtml(leader.avatar) + '" class="w-9 h-9 rounded-full object-cover border border-amber-400/70 flex-shrink-0" alt=""/>' : '<div class="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-400/60 flex items-center justify-center flex-shrink-0">👑</div>') +
          '  <div class="min-w-0 flex-1">' +
          '    <div class="text-[9px] font-display font-black uppercase text-amber-300 tracking-wider">👑 Lider Tabeli</div>' +
          '    <div class="text-xs font-display font-bold text-white truncate">' + escHtml(leader.name) + '</div>' +
          '    <div class="text-[10px] text-slate-300 font-mono-num">' + Number(leader.PKT || 0) + ' pkt • ' + Number(leader.W || 0) + '-' + Number(leader.R || 0) + '-' + Number(leader.P || 0) + '</div>' +
          '  </div>' +
          '</button>'
        : '<div class="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300">👑 Lider tabeli pojawi się po 1. meczu</div>') +
      (nextSpot && nextHome && nextAway
        ? '<button type="button" onclick="SMPL_APP.switchTab(\'' + (nextSpot.isOwn ? 'submit' : 'schedule') + '\')" class="text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex flex-col justify-center min-w-0">' +
          '  <div class="flex items-center justify-between gap-1 text-[9px] font-display font-black uppercase tracking-wider ' + (nextSpot.isOwn ? 'text-emerald-300' : 'text-blue-300') + '">' +
          '    <span>' + (nextSpot.isOwn ? '⚡ Twój Najbliższy Mecz' : '📅 Następny Mecz (K' + Number(nextSpot.match.round || 1) + ')') + '</span>' +
          '    <span>›</span>' +
          '  </div>' +
          '  <div class="text-xs font-display font-bold text-white truncate mt-0.5">' + escHtml(nextHome.name) + ' <span class="text-amber-300">vs</span> ' + escHtml(nextAway.name) + '</div>' +
          '  <div class="text-[10px] text-slate-300 truncate">' + (nextSpot.isOwn ? 'Kliknij, aby wpisać wynik po meczu' : 'Kliknij, aby otworzyć terminarz') + '</div>' +
          '</button>'
        : '<button type="button" onclick="SMPL_APP.switchTab(\'schedule\')" class="text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition flex flex-col justify-center min-w-0">' +
          '  <div class="text-[9px] font-display font-black uppercase text-blue-300">📅 Terminarz Sezonu</div>' +
          '  <div class="text-xs font-bold text-white mt-0.5">Sprawdź kolejki i wyniki</div>' +
          '  <div class="text-[10px] text-slate-300">' + (totalCount > 0 ? 'Wszystkie mecze rozegrane' : 'Wygeneruj terminarz w panelu') + '</div>' +
          '</button>') +
      '</div>';
  }

  function renderSegmentedLeagueBar(state, activeLeague, activeLeagues, hiddenLeagues, isStrictAdmin, staticMeta, getLeagueCrest) {
    var html = '<div class="wow-league-seg-grid">';
    for (var i = 0; i < activeLeagues.length; i++) {
      var lg = activeLeagues[i];
      var preset = staticMeta[lg.id];
      var num =
        window.SMPL_DB && typeof window.SMPL_DB.getLeagueNumber === 'function'
          ? window.SMPL_DB.getLeagueNumber(lg.id)
          : 4;
      var activeCls = preset
        ? preset.activeClass
        : num === 4
        ? 'active-l4'
        : num === 5
        ? 'active-l5'
        : num === 6
        ? 'active-l6'
        : 'active-l-custom';
      var titleText = preset ? preset.title : lg.shortName || lg.name || lg.id;
      var accent = preset ? preset.accentColor : lg.primaryColor || '#10B981';
      var isActive = activeLeague === lg.id;
      var crest = getLeagueCrest(state, lg.id);
      var pCount = state.players.filter(function (p) {
        return p.leagueId === lg.id && p.active !== false;
      }).length;
      var mPlayed = state.matches.filter(function (m) {
        return m.leagueId === lg.id && (m.status === 'APPROVED' || m.status === 'WALKOVER');
      }).length;
      var mPending = state.matches.filter(function (m) {
        return m.leagueId === lg.id && m.status === 'PENDING';
      }).length;

      html +=
        '<div role="button" tabindex="0" onclick="SMPL_APP.switchLeague(\'' + escHtml(lg.id) + '\')" ' +
        'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();SMPL_APP.switchLeague(\'' + escHtml(lg.id) + '\');}" ' +
        'class="league-tab-card wow-league-seg-card flex items-center ' + (isActive ? activeCls : '') + '">' +
        '<img src="' + escHtml(crest) + '" alt="' + escHtml(titleText) + '" class="wow-seg-crest ' + (isActive ? 'crest-float' : 'opacity-90') + '"/>' +
        '<div class="min-w-0 flex-1">' +
        '  <div class="flex items-center justify-between gap-1.5">' +
        '    <span class="font-display font-black text-xs sm:text-sm text-white truncate">' + escHtml(titleText) + '</span>' +
        (isActive ? '<span class="smpl-live-beacon-dot flex-shrink-0" title="Aktywna liga"></span>' : '') +
        '  </div>' +
        '  <div class="flex items-center flex-wrap gap-1.5 mt-0.5 text-[10px] font-bold">' +
        '    <span class="text-slate-300" style="color:' + (isActive ? accent : '') + '">👥 ' + pCount + '</span>' +
        '    <span class="wow-seg-meta text-emerald-300">• ⚽ ' + mPlayed + '</span>' +
        (mPending > 0 ? '<span class="px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">⏳ ' + mPending + '</span>' : '') +
        '  </div>' +
        '</div>' +
        '</div>';
    }
    html += '</div>';

    if (isStrictAdmin) {
      html +=
        '<div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-slate-900/80 border border-emerald-500/30 text-xs">' +
        '  <div class="flex flex-wrap items-center gap-2 text-slate-300">' +
        '    <span class="font-display font-bold uppercase text-emerald-300 text-[11px]">🏟️ Zarządzanie Ligami:</span>' +
        '    <span>Aktywne: <strong>' + activeLeagues.map(function (l) { return escHtml(l.shortName || l.id); }).join(' + ') + '</strong></span>' +
        (hiddenLeagues.length > 0 ? '<span class="text-slate-400">• Ukryte: ' + hiddenLeagues.map(function (l) { return escHtml(l.id); }).join(', ') + '</span>' : '') +
        '  </div>' +
        '  <div class="flex flex-wrap items-center gap-1.5">' +
        (hiddenLeagues.some(function (l) { return l.id === 'L3'; })
          ? '<button type="button" onclick="SMPL_APP.handleToggleLeagueEnabled(\'L3\', true)" class="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/40 font-display font-bold text-[10px] uppercase transition">🥉 Włącz L3</button>'
          : '') +
        '    <button type="button" onclick="SMPL_APP.openAddLeagueModal()" class="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 font-display font-black text-[10px] uppercase shadow transition">➕ Dodaj ligę</button>' +
        '  </div>' +
        '</div>';
    }
    return html;
  }

  window.SMPL_WOW = {
    THEME_OPTIONS: THEME_OPTIONS,
    getPortalDesignMode: getPortalDesignMode,
    isOverhaulEnabled: isOverhaulEnabled,
    setPortalDesignMode: setPortalDesignMode,
    applyOverhaulAttribute: applyOverhaulAttribute,
    getThemePreference: getThemePreference,
    resolveEffectiveTheme: resolveEffectiveTheme,
    getThemeEffectiveLabel: getThemeEffectiveLabel,
    getThemeScheduleHint: getThemeScheduleHint,
    renderHeroLiveHud: renderHeroLiveHud,
    renderSegmentedLeagueBar: renderSegmentedLeagueBar
  };
})();
