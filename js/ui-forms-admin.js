/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Moduł Widoków: Panel Gracza, Zapisy do Ligi, Bramka Logowania/Wniosków Administracji oraz Panel Master Admina (Szymon Komenda)
 */

window.SMPL_FORMS_ADMIN = (function () {
  const escapeHtml = (s) => window.SMPL_VIEWS.escapeHtml(s);

  function getLeaguesSafe(state, includeDisabled) {
    if (window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function') {
      return window.SMPL_DB.getLeaguesList(state, Boolean(includeDisabled));
    }
    const fallback = [];
    const lgMap = (state && state.leagues) || {};
    Object.keys(lgMap).forEach((lid) => {
      const lg = lgMap[lid];
      if (!lg) return;
      const enabled = typeof lg.enabled === 'undefined' ? lid !== 'L3' : lg.enabled !== false;
      if (includeDisabled || enabled) fallback.push(lg);
    });
    if (fallback.length === 0) {
      fallback.push({ id: 'L1', name: 'Ekstraklasa Score Match Liga', shortName: 'EKSTRAKLASA', enabled: true, order: 1 });
      fallback.push({ id: 'L2', name: '2. Liga Score Match Liga (L2)', shortName: '2. LIGA (L2)', enabled: true, order: 2 });
    }
    return fallback;
  }

  function getLeagueIconSafe(leagueId) {
    if (leagueId === 'L1') return '🏆';
    if (leagueId === 'L2') return '🥈';
    if (leagueId === 'L3') return '🥉';
    return '🏟️';
  }

  function getLeagueCrestSafe(state, league) {
    const lid = typeof league === 'string' ? league : league && league.id;
    const lgObj = typeof league === 'object' ? league : state && state.leagues && state.leagues[lid];
    if (state && state.customCrests && state.customCrests[lid]) return state.customCrests[lid];
    if (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.getDefaultCrest === 'function') {
      return window.SMPL_MEDIA.getDefaultCrest(lid, lgObj);
    }
    return (window.SMPL_MEDIA && window.SMPL_MEDIA.DEFAULT_CRESTS && window.SMPL_MEDIA.DEFAULT_CRESTS[lid]) || '';
  }

  function getClanLogoSafe(clanObj) {
    if (!clanObj) return '';
    if (window.SMPL_DB && typeof window.SMPL_DB.resolveClanLogo === 'function') {
      return window.SMPL_DB.resolveClanLogo(clanObj);
    }
    if (clanObj.logo) return clanObj.logo;
    if (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.createClanEmblemSVG === 'function') {
      return window.SMPL_MEDIA.createClanEmblemSVG(
        clanObj.name || clanObj.clanName || 'Klan',
        clanObj.tag || clanObj.clanTag || '',
        clanObj.primaryColor || '#10B981',
        clanObj.secondaryColor || '#064E3B'
      );
    }
    return '';
  }

  function isClansUiEnabledSafe(state) {
    if (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.isClansUiEnabled === 'function') {
      return window.SMPL_VIEWS.isClansUiEnabled(state);
    }
    return Boolean(
      (typeof window !== 'undefined' && window.SMPL_ENABLE_CLANS === true) ||
      (state && state.portalSettings && state.portalSettings.clansEnabled === true)
    );
  }

  function renderClanBadgeSafe(entity, state, compact) {
    if (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.renderClanBadgeHtml === 'function') {
      return window.SMPL_VIEWS.renderClanBadgeHtml(entity, state, compact);
    }
    return '';
  }

  function renderClanSelectorHtml(prefix, modeKey, state, clanState) {
    if (!isClansUiEnabledSafe(state)) return '';
    const clansList =
      window.SMPL_DB && typeof window.SMPL_DB.getClansList === 'function'
        ? window.SMPL_DB.getClansList(state)
        : (state && Array.isArray(state.clans) ? state.clans : []);
    const selectedClanId = (clanState && clanState.clanId) || '';
    const isNewClan = selectedClanId === '__NEW__';
    const selectedClanObj = !isNewClan && selectedClanId
      ? clansList.find((c) => c && c.id === selectedClanId) || null
      : null;

    const newName = (clanState && clanState.newClanName) || '';
    const newTag = (clanState && clanState.newClanTag) || '';
    const newColor = (clanState && clanState.newClanColor) || '#10B981';
    const newLogoUploaded = (clanState && clanState.newClanLogoPreview) || null;
    const newPreviewSrc = newLogoUploaded || (
      window.SMPL_MEDIA && typeof window.SMPL_MEDIA.createClanEmblemSVG === 'function'
        ? window.SMPL_MEDIA.createClanEmblemSVG(newName || 'Nowy Klan', newTag || 'NOWY', newColor, '#0F172A')
        : ''
    );
    const existingLogoSrc = selectedClanObj ? getClanLogoSafe(selectedClanObj) : '';

    const colorOptions = [
      { color: '#10B981', label: 'Szmaragdowy' },
      { color: '#D4AF37', label: 'Królewskie Złoto' },
      { color: '#3B82F6', label: 'Szafirowy' },
      { color: '#EF4444', label: 'Karmazynowy' },
      { color: '#A855F7', label: 'Purpurowy' },
      { color: '#06B6D4', label: 'Cyjanowy' },
      { color: '#F59E0B', label: 'Bursztynowy' }
    ];

    return `
      <div class="p-4 rounded-2xl bg-slate-950/85 border border-emerald-400/40 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label class="block text-xs font-display uppercase text-emerald-300 font-bold">
            🛡️ Klan / Drużyna Score! Match (dla jakiego klanu grasz)
          </label>
          <span class="text-[10px] text-slate-400 font-semibold">Wybierz z listy lub dopisz nowy z własnym logo</span>
        </div>

        <select
          id="${prefix}-clan"
          onchange="SMPL_APP.onClanSelectChange('${modeKey}', this.value)"
          class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-bold focus:outline-none focus:border-emerald-400"
        >
          <option value="" ${!selectedClanId ? 'selected' : ''}>🤝 Bez klanu / Wolny strzelec (Solo)</option>
          ${clansList
            .map(
              (c) => `<option value="${escapeHtml(c.id)}" ${selectedClanId === c.id ? 'selected' : ''}>🛡️ ${escapeHtml(c.name)} [${escapeHtml(c.tag || '')}]</option>`
            )
            .join('')}
          <option value="__NEW__" ${isNewClan ? 'selected' : ''}>➕ Mojego klanu nie ma na liście — Dodaj klan i wgraj logo!</option>
        </select>

        ${
          selectedClanObj
            ? `<div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                 ${existingLogoSrc ? `<img src="${existingLogoSrc}" class="w-10 h-10 rounded-xl object-cover border border-emerald-400/50 flex-shrink-0 bg-slate-950" alt="${escapeHtml(selectedClanObj.name)}"/>` : ''}
                 <div class="min-w-0">
                   <div class="text-xs font-display font-black text-white">Wybrany klan: ${escapeHtml(selectedClanObj.name)} <span class="text-emerald-300">[${escapeHtml(selectedClanObj.tag || '')}]</span></div>
                   <div class="text-[11px] text-slate-300">Herb i tag klanu pojawią się przy Twoim profilu w tabeli i na Karcie UT.</div>
                 </div>
               </div>`
            : ''
        }

        <div id="${prefix}-clan-new-wrap" class="${isNewClan ? '' : 'hidden'} p-3.5 rounded-xl bg-slate-900/90 border border-amber-400/40 space-y-3">
          <div class="text-[11px] font-display font-black uppercase text-amber-300">
            ✨ Dodaj swój klan do oficjalnej bazy SMPL i wgraj jego herb / logo:
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Nazwa Twojego Klanu *</label>
              <input
                id="${prefix}-clan-new-name"
                type="text"
                maxlength="60"
                value="${escapeHtml(newName)}"
                placeholder="np. Polish Legends Team"
                oninput="SMPL_APP.updateClanField('${modeKey}', 'newClanName', this.value)"
                class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold focus:outline-none focus:border-amber-400"
              />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Tag / Skrót (2-6 zn.)</label>
                <input
                  id="${prefix}-clan-new-tag"
                  type="text"
                  maxlength="6"
                  value="${escapeHtml(newTag)}"
                  placeholder="np. PLG"
                  oninput="SMPL_APP.updateClanField('${modeKey}', 'newClanTag', this.value)"
                  class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold uppercase focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Barwa Herbu</label>
                <select
                  id="${prefix}-clan-new-color"
                  onchange="SMPL_APP.updateClanField('${modeKey}', 'newClanColor', this.value)"
                  class="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold"
                >
                  ${colorOptions
                    .map((co) => `<option value="${co.color}" ${newColor === co.color ? 'selected' : ''}>${co.label}</option>`)
                    .join('')}
                </select>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <img id="${prefix}-clan-logo-preview" src="${newPreviewSrc}" class="w-14 h-14 rounded-xl object-cover border-2 border-emerald-400/50 bg-slate-950 flex-shrink-0" alt="Podgląd logo klanu"/>
            <div class="flex-1 text-center sm:text-left">
              <div class="text-[11px] font-display uppercase font-bold text-slate-200 mb-1">Logo / Herb Klanu (PNG, JPG, WEBP lub własny z gry)</div>
              <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <label class="inline-block py-1.5 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-bold cursor-pointer border border-emerald-400/50">
                  🛡️ Wgraj logo klanu
                  <input id="${prefix}-clan-new-logo" type="file" accept="image/*" class="hidden" onchange="SMPL_APP.handleClanLogoUpload('${modeKey}', event)"/>
                </label>
                ${
                  newLogoUploaded
                    ? `<button type="button" onclick="SMPL_APP.clearClanLogoUpload('${modeKey}')" class="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 text-[11px] font-bold border border-white/15">✕ Resetuj logo</button>`
                    : `<span class="text-[10px] text-slate-400">Opcjonalne — bez zdjęcia utworzymy herb SVG automatycznie!</span>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getLeagueChipBtnClass(leagueId) {
    if (leagueId === 'L1') return 'bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-400/50';
    if (leagueId === 'L2') return 'bg-blue-500/25 hover:bg-blue-500/40 text-blue-300 border border-blue-400/50';
    if (leagueId === 'L3') return 'bg-orange-500/25 hover:bg-orange-500/40 text-orange-300 border border-orange-400/50';
    return 'bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-400/50';
  }

  function getLeagueSolidBtnClass(leagueId) {
    if (leagueId === 'L1') return 'bg-amber-500 hover:bg-amber-400 text-slate-950';
    if (leagueId === 'L2') return 'bg-blue-600 hover:bg-blue-500 text-white';
    if (leagueId === 'L3') return 'bg-amber-700 hover:bg-amber-600 text-white';
    return 'bg-emerald-600 hover:bg-emerald-500 text-white';
  }

  function getArchiveCatalogList(state) {
    if (window.SMPL_DB && typeof window.SMPL_DB.getHistoricalPlayersCatalog === 'function') {
      return window.SMPL_DB.getHistoricalPlayersCatalog();
    }
    return (state && state.allTimeRanking) || [];
  }

  function buildHistoricalSelectOptionsHtml(state, selectedName, labelPrefix) {
    const list = getArchiveCatalogList(state);
    const selLow = String(selectedName || '').trim().toLowerCase();
    const prefix = labelPrefix || '';
    return list
      .map(function (a) {
        const isSel = selLow && a.name.toLowerCase() === selLow ? 'selected' : '';
        const medalStr =
          (a.gold ? ' 👑' + a.gold : '') +
          (a.silver ? ' 🥈' + a.silver : '') +
          (a.bronze ? ' 🥉' + a.bronze : '');
        const statMeta = a.matches > 0
          ? `${a.seasons} sez., ${a.matches}M, ${a.total} pkt${medalStr}`
          : a.bestPos || 'Ranking S1–S55';
        return `<option value="${escapeHtml(a.name)}" ${isSel}>${prefix}${escapeHtml(a.name)} (${statMeta})</option>`;
      })
      .join('');
  }

  // =========================================================================
  // 5. PANEL GRACZA — WPISYWANIE WYNIKÓW MECZÓW (ŚCIŚLE ZABEZPIECZONY)
  // =========================================================================
  function renderSubmitScoreView(state, leagueId, formState, session) {
    const isAdmin = Boolean(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'));
    const isGuest = session.isGuest || (!session.isPlayerAuthenticated && !isAdmin);
    if (isGuest) {
      return `
        <div class="glass-panel-league rounded-3xl p-6 sm:p-10 text-center max-w-2xl mx-auto border-2 border-amber-500/40 shadow-2xl">
          <div class="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-amber-500/20">
            🔒
          </div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-display font-black text-xs uppercase tracking-wider mb-2">
            TRYB GOŚCIA — BLOKADA ZAPISU WYNIKÓW
          </div>
          <h2 class="font-display font-black text-xl sm:text-3xl text-white uppercase mt-1">
            Tylko Zalogowani Zawodnicy Mogą Zgłaszać Wyniki
          </h2>
          <p class="text-xs sm:text-sm text-slate-300 mt-2.5 max-w-lg mx-auto leading-relaxed">
            Ze względów bezpieczeństwa ligi SMPL, tabele i statystyki są chronione przed manipulacją. Wyniki meczów mogą zgłaszać <strong>wyłącznie oficjalnie zarejestrowani zawodnicy dla swoich własnych spotkań</strong>. Goście mają dostęp wyłącznie do przeglądania tabel, statystyk, kart UT i terminarzy.
          </p>
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button onclick="SMPL_APP.handleGateLock()" class="btn-league px-5 py-3 rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-xl flex items-center gap-2">
              <span>🔑 Zaloguj się na swoje konto gracza</span>
            </button>
            <button onclick="SMPL_APP.setGateMode('register'); SMPL_APP.handleGateLock();" class="px-5 py-3 rounded-xl bg-slate-900 border border-white/20 text-white font-display font-bold text-xs uppercase hover:bg-slate-800 transition">
              <span>📝 Zarejestruj się do Ligi</span>
            </button>
          </div>
        </div>
      `;
    }

    const playersMap = {};
    state.players.forEach((p) => {
      playersMap[p.id] = p;
    });

    const adminLinkedPlayer = (isAdmin && window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function')
      ? window.SMPL_DB.findPlayerForAdmin(session.adminId, state)
      : null;
    const mySubmitPlayerId = session.activePlayerId || (adminLinkedPlayer && adminLinkedPlayer.id ? adminLinkedPlayer.id : '');
    const activePlayer = mySubmitPlayerId ? playersMap[mySubmitPlayerId] : null;
    const winInfoSubmit = (window.SMPL_DB && typeof window.SMPL_DB.getSeasonJoinWindowInfo === 'function')
      ? window.SMPL_DB.getSeasonJoinWindowInfo(state)
      : { isOpen: false, allowedLeagues: [] };

    if (!isAdmin && (!activePlayer || activePlayer.active === false || activePlayer.leagueId === 'POOL')) {
      const enabledLgs = Object.keys(state.leagues || {}).filter(
        (id) => !(state.portalSettings && Array.isArray(state.portalSettings.disabledLeagues) && state.portalSettings.disabledLeagues.includes(id))
      );
      const joinLgs = (winInfoSubmit.allowedLeagues && winInfoSubmit.allowedLeagues.length > 0)
        ? enabledLgs.filter((id) => winInfoSubmit.allowedLeagues.includes(id))
        : enabledLgs;
      return `
        <div class="glass-panel-league rounded-3xl p-8 text-center space-y-4">
          <div class="text-4xl">🪑</div>
          <h3 class="font-display font-black text-xl text-white uppercase">Twoje Konto Znajduje Się w Puli Graczy (Poza Ligą)</h3>
          <p class="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            ${
              winInfoSubmit.isOpen
                ? 'Aby zgłaszać wyniki meczów, dołącz najpierw do wybranej dywizji przyciskiem poniżej (okno zapisów jest teraz otwarte!).'
                : 'Aby zgłaszać wyniki meczów, poczekaj aż Administracja otworzy start sezonu [Dołącz do Ligi] lub dopisze Cię do dywizji.'
            }
          </p>
          ${
            winInfoSubmit.isOpen && joinLgs.length > 0
              ? `<div class="inline-flex flex-wrap items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-950/35 border border-emerald-400/40">
                   <select id="submit-pool-join-lg" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-400/50 text-xs text-white font-bold">
                     ${joinLgs.map((lg) => `<option value="${lg}">${escapeHtml((state.leagues[lg] && state.leagues[lg].name) || lg)} (${lg})</option>`).join('')}
                   </select>
                   <button type="button" onclick="SMPL_APP.handlePlayerJoinLeague(document.getElementById('submit-pool-join-lg').value)" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg">
                     ⚡ Dołącz do Ligi
                   </button>
                 </div>`
              : ''
          }
          <div>
            <button onclick="SMPL_APP.switchTab('standings')" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 font-display font-bold text-xs uppercase">
              🏆 Wróć do Tabel Ligowych
            </button>
          </div>
        </div>
      `;
    }

    // Gracz jest przypisany do swojej ligi; Admin może przełączać ligi
    const subLeagueId = isAdmin ? (formState.leagueId || leagueId) : (activePlayer ? activePlayer.leagueId : leagueId);
    const leagueMatches = state.matches.filter((m) => m.leagueId === subLeagueId);

    // BEZPIECZEŃSTWO: Gracz widzi i może wybrać WYŁĄCZNIE mecze z własnym udziałem!
    const scheduledMatches = leagueMatches.filter((m) => {
      if (m.status !== 'SCHEDULED') return false;
      if (isAdmin) return true;
      return m.homeId === session.activePlayerId || m.awayId === session.activePlayerId;
    });

    const pendingMatches = leagueMatches.filter((m) => {
      if (m.status !== 'PENDING') return false;
      if (isAdmin) return true;
      return m.homeId === session.activePlayerId || m.awayId === session.activePlayerId;
    });

    const selectedRound = formState.round || 'ALL';
    const filteredScheduled = scheduledMatches.filter(
      (m) => selectedRound === 'ALL' || Number(m.round) === Number(selectedRound)
    );

    const selectedMatch =
      scheduledMatches.find((m) => m.id === formState.matchId) ||
      filteredScheduled[0] ||
      scheduledMatches[0] ||
      null;

    const homeP = selectedMatch ? playersMap[selectedMatch.homeId] : null;
    const awayP = selectedMatch ? playersMap[selectedMatch.awayId] : null;
    const maxRound = leagueMatches.reduce((acc, m) => Math.max(acc, Number(m.round || 1)), 1);

    let roundOpts = `<option value="ALL">Wszystkie nierozegrane kolejki (${scheduledMatches.length} meczów)</option>`;
    for (let r = 1; r <= maxRound; r++) {
      const cnt = scheduledMatches.filter((m) => Number(m.round) === r).length;
      if (cnt > 0) {
        roundOpts += `<option value="${r}" ${Number(selectedRound) === r ? 'selected' : ''}>Kolejka ${r} (${cnt} do rozegrania)</option>`;
      }
    }

    const activeUserLabel = isAdmin
      ? `${session.adminName} (Administrator)`
      : activePlayer ? `${activePlayer.name} (@${activePlayer.nick})` : 'Zawodnik SMPL';

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Formularz Dodaj Wynik Meczu -->
        <div class="lg:col-span-7 glass-panel-league rounded-2xl p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-white/10">
            <div>
              <span class="px-2.5 py-1 rounded-full bg-white/10 text-league-primary text-[11px] font-display font-bold uppercase tracking-wider">
                ${isAdmin ? '🛡️ MODUŁ ADMINISTRATORA' : '📱 PANEL ZAWODNIKA • TWOJE MECZE'}
              </span>
              <h2 class="font-display font-black text-xl sm:text-2xl text-white mt-1.5 uppercase">
                Dodaj Wynik Meczu
              </h2>
            </div>
            <div class="text-right text-xs text-slate-300">
              Zgłasza jako: <strong class="text-white">${escapeHtml(activeUserLabel)}</strong>
              ${!isAdmin ? `<div class="text-[10px] text-emerald-400 font-semibold mt-0.5">🔒 Tylko mecze z Twoim udziałem</div>` : ''}
            </div>
          </div>

          <form onsubmit="SMPL_APP.handleMatchSubmit(event)" class="space-y-5">
            <!-- Krok 1: Wybór Ligi oraz Kolejki -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">1. Liga Rozgrywek</label>
                ${
                  isAdmin
                    ? `<select onchange="SMPL_APP.updateSubmitFormLeague(this.value)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white font-semibold focus:outline-none focus:border-blue-400">
                        ${getLeaguesSafe(state, false)
                          .map((lg) => `<option value="${lg.id}" ${subLeagueId === lg.id ? 'selected' : ''}>${getLeagueIconSafe(lg.id)} ${escapeHtml(lg.name)}</option>`)
                          .join('')}
                      </select>`
                    : `<div class="px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white font-semibold flex items-center justify-between">
                        <span>${escapeHtml((state.leagues[subLeagueId] && state.leagues[subLeagueId].name) || subLeagueId)}</span>
                        <span class="text-[10px] text-league-primary uppercase font-display font-bold">Twoja Liga</span>
                      </div>`
                }
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">2. Filtruj Kolejkę</label>
                <select onchange="SMPL_APP.updateSubmitFormRound(this.value)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white font-semibold focus:outline-none focus:border-blue-400">
                  ${roundOpts}
                </select>
              </div>
            </div>

            <!-- Krok 2: Wybór konkretnego meczu z listy zaplanowanych -->
            <div>
              <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">
                3. Wybierz swój mecz z terminarza ${!isAdmin ? '<span class="text-emerald-400 font-normal">(wyłącznie spotkania z Twoim udziałem)</span>' : ''}
              </label>
              <select id="submit-match-select" onchange="SMPL_APP.updateSubmitFormMatch(this.value)" class="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-league text-sm text-white font-bold focus:outline-none">
                ${
                  filteredScheduled.length === 0
                    ? `<option value="">Brak nierozegranych spotkań w wybranym filtrze</option>`
                    : filteredScheduled
                        .map((m) => {
                          const hp = playersMap[m.homeId];
                          const ap = playersMap[m.awayId];
                          const isHost = Boolean(mySubmitPlayerId && m.homeId === mySubmitPlayerId);
                          const isAway = Boolean(mySubmitPlayerId && m.awayId === mySubmitPlayerId);
                          const roleBadge = isHost ? '[TY vs GOŚĆ]' : isAway ? '[GOSPODARZ vs TY]' : '';
                          return `<option value="${m.id}" ${selectedMatch && selectedMatch.id === m.id ? 'selected' : ''}>
                            [Kolejka ${m.round}] ${escapeHtml(hp.name)} vs ${escapeHtml(ap.name)} ${roleBadge}
                          </option>`;
                        })
                        .join('')
                }
              </select>
            </div>

            <div class="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-400/30 text-xs text-slate-200 flex items-start gap-2.5">
              <span class="text-base">⚽</span>
              <div>
                <strong class="text-amber-300">Zasady Ligi SMPL:</strong> Mecze rozgrywamy do <strong class="text-white">max 2 bramek</strong> (wyniki <strong class="text-white">0–2</strong>, bez 2:2). Każdą parę gracie jako <strong class="text-emerald-300">dwumecz (1 u siebie + 1 na wyjeździe)</strong> — podajesz <strong class="text-white">oba wyniki i oba screeny (SS)</strong>, a Admin zatwierdza je po otrzymaniu kompletu SS.
              </div>
            </div>

            ${
              (() => {
                if (!selectedMatch || !homeP || !awayP) {
                  return `
                    <div class="p-8 rounded-2xl bg-slate-950/80 border border-white/10 text-center space-y-3">
                      <div class="text-3xl">✅</div>
                      <div class="font-display font-black text-white text-lg uppercase">
                        ${scheduledMatches.length === 0 ? 'Brak Nierozegranych Spotkań' : 'Wszystkie Mecze Zostały Rozegrane'}
                      </div>
                      <p class="text-xs text-slate-300 max-w-md mx-auto">
                        ${
                          !isAdmin
                            ? 'Nie masz obecnie żadnych nierozegranych spotkań przypisanych do Twojego profilu w tej kolejce. Wszystkie zgłoszone przez Ciebie mecze oczekują w poczekalni na zatwierdzenie przez Administratora.'
                            : 'Wszystkie mecze w tej kolejce zostały już rozegrane lub oczekują na zatwierdzenie w Panelu Admina.'
                        }
                      </p>
                    </div>
                  `;
                }

                const compPair = (window.SMPL_DB && typeof window.SMPL_DB.resolveMatchSubmissionPair === 'function')
                  ? window.SMPL_DB.resolveMatchSubmissionPair(state.matches, selectedMatch.id)
                  : { leg1: selectedMatch, leg2: null, requiresDouble: false };
                const compMatch = compPair.leg2;
                const isDualMode = Boolean(compPair.requiresDouble && compMatch);
                const presetScores = [
                  [2, 0], [2, 1], [1, 0], [1, 1],
                  [0, 0], [0, 1], [0, 2], [1, 2]
                ];

                function renderLegCardHtml(mObj, legKey, hsRaw, asRaw, ssPreview) {
                  const hpObj = playersMap[mObj.homeId] || { name: 'Gospodarz', nick: 'Home', avatar: '' };
                  const apObj = playersMap[mObj.awayId] || { name: 'Gość', nick: 'Away', avatar: '' };
                  const hsVal = (hsRaw !== undefined && hsRaw !== null) ? Number(hsRaw) : (legKey === 'leg2' ? 1 : 2);
                  const asVal = (asRaw !== undefined && asRaw !== null) ? Number(asRaw) : (legKey === 'leg2' ? 2 : 1);
                  const isPlayerHome = Boolean(mySubmitPlayerId && mObj.homeId === mySubmitPlayerId);
                  const isPlayerAway = Boolean(mySubmitPlayerId && mObj.awayId === mySubmitPlayerId);
                  const legTag = isPlayerHome
                    ? '🏠 MECZ U SIEBIE (Gospodarz)'
                    : isPlayerAway
                    ? '✈️ MECZ NA WYJEŹDZIE (Gość)'
                    : (legKey === 'leg2' ? '✈️ MECZ #2 — REWANŻ' : '🏠 MECZ #1 — U SIEBIE');
                  const hsInputId = legKey === 'leg2' ? 'submit-return-home-score' : 'submit-home-score';
                  const asInputId = legKey === 'leg2' ? 'submit-return-away-score' : 'submit-away-score';
                  const ssNum = legKey === 'leg2' ? 'SS #2' : 'SS #1';
                  const legLabelShort = isDualMode ? (legKey === 'leg2' ? '2/2' : '1/2') : '1/1';

                  return `
                    <div class="p-4 sm:p-5 rounded-2xl bg-slate-950/85 border ${legKey === 'leg2' ? 'border-emerald-500/40' : 'border-blue-500/40'} space-y-4">
                      <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                        <span class="px-2.5 py-1 rounded-lg ${isPlayerAway || legKey === 'leg2' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'} font-display font-black text-[11px] uppercase">
                          ${legTag} (${legLabelShort})
                        </span>
                        <span class="text-[11px] font-display font-bold text-amber-300 uppercase">KOLEJKA ${mObj.round} • MAX 2 BRAMKI</span>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-7 items-center gap-4">
                        <div class="sm:col-span-3 flex flex-col items-center text-center">
                          <div class="relative">
                            <img src="${hpObj.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-400 mb-1.5" alt=""/>
                            ${mySubmitPlayerId && hpObj.id === mySubmitPlayerId ? `<span class="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-display font-black text-[9px] uppercase shadow">To Ty</span>` : ''}
                          </div>
                          <div class="font-bold text-white text-sm truncate max-w-full">${escapeHtml(hpObj.name)}</div>
                          <div class="text-[11px] text-slate-400 mb-2">@${escapeHtml(hpObj.nick)} (Gospodarz)</div>
                          <div class="flex items-center gap-2">
                            <button type="button" onclick="SMPL_APP.stepSubmitScore('home', -1, '${legKey}')" class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg">-</button>
                            <input id="${hsInputId}" type="number" min="0" max="2" value="${hsVal}" oninput="SMPL_APP.setSubmitScore('home', this.value, '${legKey}')" class="w-16 h-12 text-center rounded-xl bg-slate-900 border-2 border-blue-500/50 font-display font-black text-2xl text-white focus:outline-none"/>
                            <button type="button" onclick="SMPL_APP.stepSubmitScore('home', 1, '${legKey}')" class="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg">+</button>
                          </div>
                        </div>

                        <div class="sm:col-span-1 text-center font-display font-black text-2xl text-slate-500">:</div>

                        <div class="sm:col-span-3 flex flex-col items-center text-center">
                          <div class="relative">
                            <img src="${apObj.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-rose-400 mb-1.5" alt=""/>
                            ${mySubmitPlayerId && apObj.id === mySubmitPlayerId ? `<span class="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-display font-black text-[9px] uppercase shadow">To Ty</span>` : ''}
                          </div>
                          <div class="font-bold text-white text-sm truncate max-w-full">${escapeHtml(apObj.name)}</div>
                          <div class="text-[11px] text-slate-400 mb-2">@${escapeHtml(apObj.nick)} (Gość)</div>
                          <div class="flex items-center gap-2">
                            <button type="button" onclick="SMPL_APP.stepSubmitScore('away', -1, '${legKey}')" class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg">-</button>
                            <input id="${asInputId}" type="number" min="0" max="2" value="${asVal}" oninput="SMPL_APP.setSubmitScore('away', this.value, '${legKey}')" class="w-16 h-12 text-center rounded-xl bg-slate-900 border-2 border-rose-500/50 font-display font-black text-2xl text-white focus:outline-none"/>
                            <button type="button" onclick="SMPL_APP.stepSubmitScore('away', 1, '${legKey}')" class="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-lg">+</button>
                          </div>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                        <span class="text-[10px] text-slate-400 uppercase font-display font-bold mr-1">Szybki wynik:</span>
                        ${presetScores.map((sc) => {
                          const isSel = hsVal === sc[0] && asVal === sc[1];
                          return `<button type="button" onclick="SMPL_APP.setSubmitQuickScore('${legKey}', ${sc[0]}, ${sc[1]})" class="px-2.5 py-1 rounded-lg border text-xs font-display font-bold transition ${isSel ? 'btn-league border-transparent shadow' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/15'}">${sc[0]}:${sc[1]}</button>`;
                        }).join('')}
                      </div>

                      <div class="p-3.5 rounded-xl bg-slate-900/70 border border-dashed ${ssPreview ? 'border-emerald-500/50' : 'border-white/25'}">
                        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <label class="text-xs font-display uppercase text-white font-bold">
                            📸 Zrzut ekranu (${ssNum}) z końca meczu — WYMAGANY *
                          </label>
                          ${
                            isAdmin
                              ? `<button type="button" onclick="SMPL_APP.generateDemoMatchScreenForForm('${legKey}')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition">
                                   ⚡ Wygeneruj ${ssNum} (Admin)
                                 </button>`
                              : ''
                          }
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onchange="SMPL_APP.handleMatchScreenUpload(event, '${legKey}')"
                          class="w-full text-xs text-slate-300"
                        />
                        ${
                          ssPreview
                            ? `<div class="mt-2.5 flex items-center gap-3 p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                                 <img src="${ssPreview}" class="w-14 h-20 object-cover rounded-lg border border-white/20" alt="Podgląd ${ssNum}"/>
                                 <div class="text-xs text-emerald-300">
                                   <div class="font-bold">✅ ${ssNum} załączony!</div>
                                   <div class="text-[11px] text-slate-400">Admin zweryfikuje wynik na podstawie tego zrzutu ekranu.</div>
                                 </div>
                               </div>`
                            : `<div class="mt-1.5 text-[11px] text-amber-300/90">
                                 Wgraj screen z ekranu końcowego <em>Score! Match</em> (${ssNum}) — bez SS Administrator nie zatwierdzi wyniku.
                               </div>`
                        }
                      </div>
                    </div>
                  `;
                }

                const leg1Html = renderLegCardHtml(selectedMatch, 'leg1', formState.homeScore, formState.awayScore, formState.screenshotPreview);
                const leg2Html = isDualMode
                  ? renderLegCardHtml(compMatch, 'leg2', formState.returnHomeScore, formState.returnAwayScore, formState.returnScreenshotPreview)
                  : compMatch
                  ? `<div class="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                       <span>🤝 <strong>Drugi mecz dwumeczu (Kol. ${compMatch.round}):</strong></span>
                       <span class="font-bold ${compMatch.status === 'PENDING' ? 'text-amber-300' : 'text-emerald-300'}">${escapeHtml((playersMap[compMatch.homeId] || {}).name || '')} ${compMatch.homeScore !== null ? compMatch.homeScore + ':' + compMatch.awayScore : ''} ${escapeHtml((playersMap[compMatch.awayId] || {}).name || '')} [${compMatch.status === 'PENDING' ? '⏳ Oczekuje z SS' : compMatch.status}]</span>
                     </div>`
                  : '';

                return `
                  ${leg1Html}
                  ${leg2Html}

                  <div>
                    <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">5. Komentarz pomeczowy (opcjonalnie)</label>
                    <input
                      type="text"
                      id="submit-match-comment"
                      placeholder="Np. Dzięki za dwumecz! Rewanż bardzo wyrównany."
                      value="${escapeHtml(formState.comment || '')}"
                      oninput="SMPL_APP.setSubmitComment(this.value)"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div class="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2.5">
                    <span class="text-base">🛡️</span>
                    <div>
                      <strong>Weryfikacja Dwumeczu &amp; SS:</strong> ${
                        isDualMode
                          ? 'Wysyłasz od razu OBA wyniki dwumeczu (U siebie + Na wyjeździe) wraz z dwoma zrzutami ekranu (SS #1 i SS #2). Administrator zatwierdzi punkty w tabeli dopiero po sprawdzeniu obu screenów!'
                          : 'Wysłany wynik ze screenem (SS) trafia do poczekalni weryfikacji. Punkty dopiszą się do tabeli po zatwierdzeniu przez Administratora.'
                      }
                    </div>
                  </div>

                  <button type="submit" class="w-full btn-league py-3.5 px-6 rounded-xl font-display font-black text-sm uppercase tracking-wider shadow-xl flex items-center justify-center gap-2">
                    <span>${isDualMode ? '🚀 Wyślij OBA wyniki dwumeczu + 2× SS do weryfikacji Admina' : '🚀 Wyślij wynik i SS do weryfikacji Admina'}</span>
                  </button>
                `;
              })()
            }
          </form>
        </div>

        <!-- Poczekalnia Meczów (⏳ Oczekujące na weryfikację Admina) -->
        <div class="lg:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 class="font-display font-bold text-base uppercase text-white">
                ⏳ ${isAdmin ? 'Poczekalnia Moderacji' : 'Twoje Zgłoszone Wyniki'} (${pendingMatches.length})
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                ${
                  isAdmin
                    ? 'Oczekujące mecze i dwumecze ze screenami (SS) przed zatwierdzeniem'
                    : 'Twoje zgłoszone wyniki + SS oczekujące na zatwierdzenie przez Adminów'
                }
              </p>
            </div>
            ${
              isAdmin
                ? `<button onclick="SMPL_APP.switchTab('admin')" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition">
                     🛡️ Panel Admina
                   </button>`
                : ''
            }
          </div>

          <div class="space-y-3">
            ${
              pendingMatches.length === 0
                ? `<div class="p-6 rounded-xl bg-slate-950/60 text-center text-xs text-slate-400">
                     ${
                       isAdmin
                         ? 'Brak meczów oczekujących w tej lidze — wszystkie zgłoszenia zostały już rozpatrzone!'
                         : 'Nie masz obecnie żadnych zgłoszonych wyników oczekujących na zatwierdzenie.'
                     }
                   </div>`
                : pendingMatches
                    .map((m) => {
                      const hp = playersMap[m.homeId] || { name: 'Gospodarz' };
                      const ap = playersMap[m.awayId] || { name: 'Gość' };
                      const compM = (window.SMPL_DB && typeof window.SMPL_DB.findCompanionReturnMatch === 'function')
                        ? window.SMPL_DB.findCompanionReturnMatch(state.matches, m)
                        : null;
                      const compBadge = !m.screenshot
                        ? `<span class="text-rose-400 font-bold">⚠️ Brak SS</span>`
                        : compM && (compM.status === 'PENDING' || compM.status === 'APPROVED')
                        ? `<span class="text-emerald-300 font-bold">🤝 Dwumecz z Kol. ${compM.round} (SS ✅)</span>`
                        : compM && compM.status === 'SCHEDULED'
                        ? `<span class="text-amber-300 font-semibold">⏳ Czeka na rewanż (Kol. ${compM.round})</span>`
                        : '';
                      return `
                        <div class="p-4 rounded-xl bg-amber-950/15 border border-amber-500/40">
                          <div class="flex items-center justify-between text-[11px] text-amber-300 font-bold mb-2">
                            <span>KOLEJKA ${m.round} • ⏳ OCZEKUJE NA ADMINA</span>
                            <span>${escapeHtml(m.submittedAt || '')}</span>
                          </div>
                          <div class="flex items-center justify-between gap-2">
                            <div class="text-xs font-bold text-white truncate flex-1">${escapeHtml(hp.name)}</div>
                            <div class="px-3 py-1 rounded-lg bg-slate-950 border border-amber-400/50 font-display font-black text-base text-amber-300">
                              ${m.homeScore} : ${m.awayScore}
                            </div>
                            <div class="text-xs font-bold text-white truncate flex-1 text-right">${escapeHtml(ap.name)}</div>
                          </div>
                          <div class="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span>Zgłosił: <strong class="text-slate-200">${escapeHtml(m.submittedBy || '')}</strong></span>
                            ${compBadge}
                            ${
                              m.screenshot
                                ? `<button type="button" onclick="SMPL_APP.openScreenshotModal('${m.id}')" class="text-blue-400 hover:underline font-semibold">🖼️ Zobacz screen</button>`
                                : ''
                            }
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

  // =========================================================================
  // 6. KONTO GRACZA (LOGOWANIE + PRZYPOMNIENIE HASŁA) & REJESTRACJA DO LISTY OCZEKUJĄCYCH NA DOPISANIE DO LIGI
  // =========================================================================
  function renderRegistrationView(state, regFormState, session) {
    const registrations = state.registrations || [];
    const isAdminRegView = Boolean(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'));
    const winInfoReg = (window.SMPL_DB && typeof window.SMPL_DB.getSeasonJoinWindowInfo === 'function')
      ? window.SMPL_DB.getSeasonJoinWindowInfo(state)
      : { isOpen: false, phase: 'NOT_STARTED', allowedLeagues: [] };
    const isPlayerLoggedIn = Boolean(session && session.isPlayerAuthenticated && (session.activePlayerId || session.activeRegId));
    const activePlayer = (isPlayerLoggedIn && session.activePlayerId)
      ? state.players.find((p) => p.id === session.activePlayerId) || null
      : null;
    const activeReg = (!activePlayer && isPlayerLoggedIn && session.activeRegId)
      ? registrations.find((r) => r.id === session.activeRegId) || null
      : null;
    const notifications = (activePlayer && activePlayer.notifications) || [];
    const enabledLeaguesReg = Object.keys(state.leagues || {}).filter(
      (id) => !(state.portalSettings && Array.isArray(state.portalSettings.disabledLeagues) && state.portalSettings.disabledLeagues.includes(id))
    );
    const joinableLeaguesReg = (winInfoReg.allowedLeagues && winInfoReg.allowedLeagues.length > 0)
      ? enabledLeaguesReg.filter((id) => winInfoReg.allowedLeagues.includes(id))
      : enabledLeaguesReg;

    return `
      <!-- ZUNIFIKOWANY PASEK SZYBKIEGO LINKU DO REJESTRACJI -->
      <div class="glass-panel smpl-reg-link-strip rounded-2xl px-4 py-3 sm:px-5 mb-4 border border-emerald-400/35 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div class="min-w-0">
          <div class="text-[11px] font-display font-black uppercase text-emerald-300 tracking-wide">
            🔗 Bezpośredni link do rejestracji (FB / Messenger)
          </div>
          <div class="text-xs text-slate-300 mt-0.5 leading-relaxed">
            Wyślij znajomym <code class="px-1.5 py-0.5 rounded bg-slate-950/90 text-amber-300 font-mono-num">REJESTRACJA.html</code> — po zapisie Administracja 1 kliknięciem dopisuje ligę i pełną historię S1–S55.
          </div>
        </div>
        <button
          type="button"
          onclick="SMPL_APP.copyRegistrationLink()"
          class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider flex-shrink-0 shadow-lg"
        >
          📋 Kopiuj Link
        </button>
      </div>

      <!-- GÓRNY PANEL: LOGOWANIE NA KONTO GRACZA + OPCJA PRZYPOMNIENIA HASŁA -->
      <div class="glass-panel rounded-2xl p-4 sm:p-6 mb-5 border border-blue-500/30">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div class="lg:col-span-7">
            <span class="inline-flex flex-wrap items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] sm:text-[11px] font-display font-bold uppercase tracking-wider max-w-full">
              👤 LOGOWANIE GRACZA • STATYSTYKI &amp; TROFEA
            </span>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase mt-1.5">
              Masz już konto w lidze? Zaloguj się lub przypomnij hasło
            </h3>
            <p class="text-xs text-slate-300 mt-0.5 mb-4">
              Zaloguj się swoim indywidualnym loginem/nickiem i prywatnym hasłem. Jeśli zapomniałeś hasła, kliknij <strong>„🔑 Przypomnij hasło”</strong>, aby wysłać prośbę o tymczasowy reset do Administracji.
            </p>

            <form onsubmit="SMPL_APP.handlePlayerLoginSubmit(event)" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                id="player-login-id"
                required
                placeholder="Twój Login lub Nick w grze"
                class="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
              />
              <input
                type="password"
                id="player-login-pass"
                required
                placeholder="Twoje prywatne hasło"
                class="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
              />
              <button type="submit" class="btn-league py-2.5 px-4 rounded-xl font-display font-black text-xs uppercase">
                🔓 Zaloguj się jako Gracz
              </button>
            </form>

            <div class="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onclick="SMPL_APP.openPasswordReminderModal()"
                class="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/50 text-xs font-display font-bold transition"
              >
                🔑 Zapomniałeś hasła? Przypomnij / Wyślij prośbę do Admina
              </button>
              <button
                type="button"
                onclick="SMPL_APP.switchTab('profile')"
                class="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 text-xs font-bold transition"
              >
                🎴 Zobacz moją Kartę UT i Gablotę Trofeów →
              </button>
            </div>
          </div>

          <!-- Prawa strona: Aktywne konto gracza (tylko dla zalogowanego użytkownika) -->
          <div class="lg:col-span-5 p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            ${
              activePlayer
                ? `
                  <div class="flex items-center gap-3 pb-3 mb-3 border-b border-white/10">
                    <img src="${activePlayer.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-400" alt=""/>
                    <div class="min-w-0 flex-1">
                      <div class="text-[10px] font-display uppercase text-emerald-400 font-bold">
                        AKTYWNE KONTO ZAWODNIKA • ${activePlayer.active === false || activePlayer.leagueId === 'POOL' ? '🪑 PULA GRACZY' : `⚽ LIGA ${escapeHtml(activePlayer.leagueId)}`}
                      </div>
                      <div class="font-display font-black text-sm text-white truncate">${escapeHtml(activePlayer.name)}</div>
                      <div class="text-xs text-slate-400">@${escapeHtml(activePlayer.nick)} • Login: <code class="text-amber-300">${escapeHtml(activePlayer.username || '')}</code></div>
                    </div>
                  </div>
                  ${
                    !isAdminRegView
                      ? (winInfoReg.isOpen
                          ? `<div class="p-2.5 rounded-xl bg-emerald-950/35 border border-emerald-400/40 mb-3 flex flex-wrap items-center justify-between gap-2">
                               ${
                                 activePlayer.active === false || activePlayer.leagueId === 'POOL'
                                   ? `<select id="reg-panel-join-league" class="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-emerald-400/50 text-xs text-white font-bold">
                                        ${joinableLeaguesReg.map((lg) => `<option value="${lg}">${lg}</option>`).join('')}
                                      </select>
                                      <button type="button" onclick="SMPL_APP.handlePlayerJoinLeague(document.getElementById('reg-panel-join-league').value)" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-[11px] uppercase">
                                        ⚡ Dołącz do Ligi
                                      </button>`
                                   : `<span class="text-[11px] text-emerald-300 font-bold">🟢 Grasz w ${escapeHtml(activePlayer.leagueId)}</span>
                                      <button type="button" onclick="SMPL_APP.handlePlayerLeaveLeague()" class="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-display font-black text-[11px] uppercase">
                                        🚪 Opuść ligę
                                      </button>`
                               }
                             </div>`
                          : `<div class="text-[11px] text-slate-400 mb-3 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10">
                               ${activePlayer.active === false || activePlayer.leagueId === 'POOL' ? '⏳ Przycisk [Dołącz do ligi] otworzy się po starcie sezonu przez Admina.' : `🔒 Okno zmian składów zamknięte — grasz w ${escapeHtml(activePlayer.leagueId)}.`}
                             </div>`)
                      : ''
                  }
                  <div class="flex flex-wrap gap-2 mb-3">
                    <button type="button" onclick="SMPL_APP.openEditOwnProfileModal()" class="px-3 py-1.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-400/50 text-[11px] font-bold transition">
                      🎨 Edytuj Awatar i Bio
                    </button>
                    <button type="button" onclick="SMPL_APP.openPlayerChangePasswordModal()" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 text-[11px] font-bold transition">
                      🔑 Zmień moje hasło
                    </button>
                    <button type="button" onclick="SMPL_APP.handleGateLock()" class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/35 text-[11px] font-bold transition">
                      🚪 Wyloguj się
                    </button>
                  </div>
                  ${activePlayer.bio ? `<div class="mb-3 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-[11px] text-slate-200 italic">📝 ${escapeHtml(activePlayer.bio)}</div>` : ''}
                  <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span class="text-[11px] font-display uppercase text-slate-400 font-bold">
                      🔔 Powiadomienia konta (Mecze, Nagrody i Trofea):
                    </span>
                    <button type="button" onclick="SMPL_APP.openNotificationsCenterModal()" class="text-[11px] font-bold text-amber-300 hover:underline">
                      📬 Wszystkie (${notifications.length}) →
                    </button>
                  </div>
                  <div class="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                    ${
                      notifications.length === 0
                        ? `<div class="text-slate-500 italic">Brak nowych powiadomień.</div>`
                        : notifications
                            .slice(0, 5)
                            .map(
                              (n) => `
                                <div class="p-2 rounded-lg bg-slate-900 border ${n && n.read !== true ? 'border-amber-400/45' : 'border-white/5'} text-[11px] text-slate-200">
                                  <span class="text-amber-300 font-mono-num">[${escapeHtml((n && (n.time || n.createdAt)) || '')}]</span>
                                  ${n && n.title ? `<strong class="text-white">${escapeHtml((n.icon || '') + ' ' + n.title)}:</strong> ` : ''}${escapeHtml((n && n.text) || '')}
                                  ${n && n.read !== true ? '<span class="ml-1 px-1 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">NOWE</span>' : ''}
                                </div>
                              `
                            )
                            .join('')
                    }
                  </div>
                `
                : activeReg
                ? `
                  <div class="flex items-center gap-3 pb-3 mb-3 border-b border-white/10">
                    ${activeReg.avatar ? `<img src="${activeReg.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-400" alt=""/>` : '<div class="w-12 h-12 rounded-full bg-slate-800 border-2 border-emerald-400 flex items-center justify-center text-xl">⚡</div>'}
                    <div class="min-w-0 flex-1">
                      <div class="text-[10px] font-display uppercase text-emerald-400 font-bold">✅ KONTO ZATWIERDZONE (PULA GRACZY)</div>
                      <div class="font-display font-black text-sm text-white truncate">${escapeHtml(activeReg.name)}</div>
                      <div class="text-xs text-slate-400">@${escapeHtml(activeReg.nick)} • Login: <code class="text-amber-300">${escapeHtml(activeReg.username || '')}</code></div>
                    </div>
                  </div>
                  ${
                    winInfoReg.isOpen && joinableLeaguesReg.length > 0
                      ? `<div class="p-3 rounded-xl bg-emerald-950/35 border border-emerald-400/40 mb-3 space-y-2">
                           <div class="text-[11px] font-display font-black uppercase text-emerald-300">🟢 Start Sezonu Otwarty — Wybierz Ligę i Dołącz!</div>
                           <div class="flex flex-wrap items-center gap-2">
                             <select id="reg-pool-join-league" class="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-slate-950 border border-emerald-400/50 text-xs text-white font-bold">
                               ${joinableLeaguesReg.map((lg) => `<option value="${lg}" ${activeReg.preferredLeague === lg ? 'selected' : ''}>${escapeHtml((state.leagues[lg] && state.leagues[lg].name) || lg)} (${lg})</option>`).join('')}
                             </select>
                             <button type="button" onclick="SMPL_APP.handlePlayerJoinLeague(document.getElementById('reg-pool-join-league').value)" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg">
                               ⚡ Dołącz do Ligi
                             </button>
                           </div>
                         </div>`
                      : `<div class="p-3 rounded-xl bg-slate-900 border border-white/10 text-[11px] text-slate-300 mb-3">
                           ⏳ Twoje konto jest gotowe i zatwierdzone! Przycisk <strong>[Dołącz do Ligi]</strong> pojawi się automatycznie, gdy Administracja ogłosi początek sezonu.
                         </div>`
                  }
                  <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="SMPL_APP.openEditOwnProfileModal()" class="px-3 py-1.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-400/50 text-[11px] font-bold transition">
                      🎨 Edytuj Awatar i Bio
                    </button>
                    <button type="button" onclick="SMPL_APP.handleGateLock()" class="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/35 text-[11px] font-bold transition">
                      🚪 Wyloguj się
                    </button>
                  </div>
                  ${activeReg.bio ? `<div class="mt-2.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-[11px] text-slate-200 italic">📝 ${escapeHtml(activeReg.bio)}</div>` : ''}
                `
                : `
                  <div class="text-center py-4 space-y-2">
                    <div class="text-2xl">🔒</div>
                    <div class="text-xs font-display font-bold uppercase text-amber-300">Nie jesteś jeszcze zalogowany</div>
                    <p class="text-[11px] text-slate-400 leading-relaxed">
                      Zaloguj się swoim loginem i hasłem po lewej stronie lub wypełnij poniższy formularz rejestracji, aby dołączyć do Sezonu ${state.season || 56}.
                    </p>
                  </div>
                `
            }
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Formularz Rejestracji Konta na Listę Oczekujących do Dopisania do Ligi -->
        <div class="lg:col-span-7 glass-panel-league rounded-2xl p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-white/10">
            <div>
              <span class="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-display font-bold uppercase tracking-wider">
                🟢 KROK 1: ZAŁÓŻ KONTO GRACZA ➔ KROK 2: ADMIN DOPISUJE CIĘ DO LIGI
              </span>
              <h2 class="font-display font-black text-xl sm:text-2xl text-white mt-1.5 uppercase">
                Rejestracja Konta i Zgłoszenie na Listę do Ligi
              </h2>
              <p class="text-xs text-slate-300 mt-0.5">
                <strong>Jak to działa:</strong> Najpierw zakładasz swoje konto gracza i wybierasz preferowaną ligę. Jeśli grałeś już wcześniej w SMPL (S1–S55), zaznacz opcję powracającego gracza i wybierz swoje nazwisko z listy. Twoje zgłoszenie trafia na <strong>📋 Listę Oczekujących do Dodania do Ligi</strong>, a Administracja jednym kliknięciem dopisuje Cię do odpowiedniej aktywnej dywizji (${escapeHtml(getLeaguesSafe(state, false).map((lg) => lg.id).join(' / '))}) wraz z historią!
              </p>
            </div>
          </div>

          <form onsubmit="SMPL_APP.handleRegistrationSubmit(event)" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Imię i Nazwisko *</label>
                <input
                  type="text"
                  id="reg-name"
                  required
                  placeholder="np. Michał Kowalski"
                  value="${escapeHtml(regFormState.name || '')}"
                  oninput="SMPL_APP.updateRegField('name', this.value)"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Nick w grze Score! Match *</label>
                <input
                  type="text"
                  id="reg-nick"
                  required
                  placeholder="np. Kowal_PL99"
                  value="${escapeHtml(regFormState.nick || '')}"
                  oninput="SMPL_APP.updateRegField('nick', this.value)"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Link do profilu FB / Messenger *</label>
                <input
                  type="text"
                  id="reg-fb"
                  required
                  placeholder="https://m.me/twoj.profil"
                  value="${escapeHtml(regFormState.fbLink || '')}"
                  oninput="SMPL_APP.updateRegField('fbLink', this.value)"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Do której ligi chcesz zostać dopisany? *</label>
                ${
                  (() => {
                    const activeLeaguesForReg = getLeaguesSafe(state, false);
                    const hasL3Active = activeLeaguesForReg.some((lg) => lg.id === 'L3');
                    const extraRegOptions = activeLeaguesForReg
                      .filter((lg) => lg.id !== 'L1')
                      .map((lg) => {
                        const val = lg.id === 'L2'
                          ? 'Chce dołączyć do: 2. Liga (L2)'
                          : lg.id === 'L3'
                          ? 'Chce dołączyć do: 3. Liga (L3)'
                          : 'Chce dołączyć do: ' + (lg.shortName || lg.name) + ' (' + lg.id + ')';
                        const label = getLeagueIconSafe(lg.id) + ' Chcę dołączyć do: ' + (lg.shortName || lg.name);
                        return `<option value="${escapeHtml(val)}" ${regFormState.preference === val ? 'selected' : ''}>${escapeHtml(label)}</option>`;
                      })
                      .join('');
                    const adminDecisionLabel = hasL3Active ? 'L2 / L3' : activeLeaguesForReg.map((lg) => lg.id).join(' / ');
                    const adminDecisionVal = hasL3Active
                      ? 'Dowolna liga wg decyzji Administracji (L2/L3)'
                      : 'Dowolna liga wg decyzji Administracji (' + activeLeaguesForReg.map((lg) => lg.id).join('/') + ')';
                    return `<select
                  id="reg-pref"
                  onchange="SMPL_APP.updateRegField('preference', this.value)"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white font-semibold focus:outline-none focus:border-blue-400"
                >
                  ${extraRegOptions}
                  <option value="Powrót / Weteran — Ekstraklasa (L1) lub L2" ${regFormState.preference === 'Powrót / Weteran — Ekstraklasa (L1) lub L2' ? 'selected' : ''}>🏆 Weteran — Ekstraklasa (L1) / L2</option>
                  <option value="${escapeHtml(adminDecisionVal)}" ${regFormState.preference === adminDecisionVal ? 'selected' : ''}>⚖️ Decyzja Administracji (${escapeHtml(adminDecisionLabel)})</option>
                </select>`;
                  })()
                }
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Hasło do Twojego konta gracza *</label>
                <input
                  type="password"
                  id="reg-pass"
                  required
                  placeholder="Minimum 4 znaki (Twoje prywatne hasło)"
                  value="${escapeHtml(regFormState.password || '')}"
                  oninput="SMPL_APP.updateRegField('password', this.value)"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Uwagi / dyspozycyjność (opcjonalne)</label>
                <input
                  type="text"
                  id="reg-notes"
                  placeholder="np. Gram wieczorami po 20:00"
                  value="${escapeHtml(regFormState.notes || '')}"
                  oninput="SMPL_APP.updateRegField('notes', this.value)"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/90 border border-white/15 text-sm text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>

            ${renderClanSelectorHtml('reg', 'reg', state, regFormState)}

            <!-- Upload Zdjęcia Profilowego (Awatar) -->
            <div class="p-4 rounded-2xl bg-slate-950/80 border border-dashed border-white/25">
              <label class="block text-xs font-display uppercase text-white font-bold mb-2">
                👤 Zdjęcie profilowe / Awatar (opcjonalne)
              </label>
              <input
                type="file"
                accept="image/*"
                onchange="SMPL_APP.handleRegAvatarUpload(event)"
                class="w-full text-xs text-slate-300"
              />
              ${
                regFormState.avatarPreview
                  ? `<div class="mt-3 flex items-center gap-3">
                       <img src="${regFormState.avatarPreview}" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-400" alt="Awatar"/>
                       <span class="text-xs text-emerald-400 font-bold">✅ Awatar wgrany</span>
                     </div>`
                  : `<div class="mt-2 text-[11px] text-slate-400">Wyświetlane w tabelach, kartach UT i gablocie trofeów (bez podawania prywatnego składu z gry).</div>`
              }
            </div>

            <!-- Grałeś wcześniej w lidze (S1–S55)? Checkbox + Wybór z listy -->
            <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40">
              <label class="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="reg-played-before"
                  ${regFormState.playedBefore ? 'checked' : ''}
                  onchange="SMPL_APP.toggleRegPlayedBefore(this.checked)"
                  class="mt-0.5 w-5 h-5 rounded accent-amber-400 cursor-pointer flex-shrink-0"
                />
                <span class="text-xs sm:text-sm text-amber-100 leading-snug">
                  <strong class="text-amber-300 uppercase font-display">🏛️ Grałem już kiedyś w Score Match Lidze (Sezony 1–55)</strong><br/>
                  <span class="text-[11px] text-slate-300">Zaznacz ptaszek i wybierz z listy swoje imię i nazwisko — połączymy Twoje dawne sezony, medale i statystyki z nowym profilem!</span>
                </span>
              </label>

              <div id="reg-hist-picker-wrap" class="${regFormState.playedBefore ? '' : 'hidden'} mt-3 pt-3 border-t border-amber-400/25 space-y-2">
                <input
                  type="text"
                  id="reg-hist-filter"
                  value="${escapeHtml(regFormState.histSearch || '')}"
                  placeholder="🔍 Wpisz imię lub nazwisko, aby szybko przefiltrować listę (S1–S55)..."
                  oninput="SMPL_APP.filterHistSelect('reg-hist-select', this.value, 'reg')"
                  class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <select
                  id="reg-hist-select"
                  onchange="SMPL_APP.onRegHistSelect(this.value)"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white font-bold"
                >
                  <option value="">-- Wybierz swoje Imię i Nazwisko z archiwum S1–S55 --</option>
                  ${buildHistoricalSelectOptionsHtml(state, regFormState.linkedHistoricalName || '', '')}
                </select>
              </div>
            </div>

            <!-- Obowiązkowe Checkboxy Regulaminowe i Prawne (Świadoma, Niedomyślna Zgoda wg RODO Art. 7) -->
            <div class="space-y-2.5">
              <div class="flex items-center justify-between gap-2 text-[11px]">
                <span class="font-display font-bold uppercase text-amber-300">⚖️ Wymagane oświadczenia przed rejestracją (SMPL-REG-2026.1):</span>
                <button type="button" onclick="SMPL_APP.switchTab('legal')" class="text-emerald-300 hover:text-white underline font-bold">
                  📖 Czytaj pełny Regulamin &amp; RODO
                </button>
              </div>

              <label class="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-white/15 cursor-pointer">
                <input type="checkbox" id="reg-rules" required class="mt-1 w-4 h-4 rounded"/>
                <span class="text-xs text-slate-200 leading-relaxed">
                  <strong>Akceptuję Regulamin Rozgrywek SMPL (SMPL-REG-2026.1):</strong> tempo 4 kolejki/tydzień, Gospodarz zaprasza Gościa, zasada ochrony 48h, tajemnica składów, stopniowany taryfikator kar i 7-dniowe odwołania.
                </span>
              </label>

              <label class="flex items-start gap-3 p-3 rounded-xl bg-slate-950/90 border border-amber-400/30 cursor-pointer">
                <input type="checkbox" id="reg-legal-gdpr" required class="mt-1 w-4 h-4 rounded"/>
                <span class="text-[11px] text-slate-300 leading-relaxed">
                  <strong>Zgoda Prawna, RODO &amp; Wiek (Art. 6, 8 i 17 RODO):</strong> Oświadczam, że ukończyłem 16 lat (lub uczestniczę za zgodą opiekuna prawnego). Przyjmuję do wiadomości, że liga SMPL jest w 100% darmowa (0 zł wpisowego, brak hazardu i nagród pieniężnych, brak powiązania z First Touch Games Ltd., wyłączenie roszczeń „AS IS”, tryb DSA Notice &amp; Takedown) oraz dobrowolnie wyrażam zgodę na publikację imienia/nicku, awatara i kontaktu FB/Messenger w portalu (z prawem do natychmiastowego usunięcia RODO).
                </span>
              </label>
            </div>

            <button type="submit" class="w-full btn-league py-3.5 px-6 rounded-xl font-display font-black text-sm uppercase tracking-wider shadow-xl">
              📝 Załóż Konto i Zapisz się na Listę do Dopisania do Ligi
            </button>
          </form>
        </div>

        <!-- Lista Graczy Oczekujących na Dopisanie do Ligi przez Administrację -->
        <div class="lg:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 class="font-display font-bold text-base uppercase text-white">
                📋 Lista Graczy do Dopisania do Ligi (${registrations.length})
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Zarejestrowani gracze czekający na przydział do aktywnych lig (${escapeHtml(getLeaguesSafe(state, false).map((lg) => lg.shortName || lg.id).join(' / '))}) przez Administrację
              </p>
            </div>
            ${
              window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session)
                ? `<button onclick="SMPL_APP.switchTab('admin'); SMPL_APP.setAdminSubTab('recruitment');" class="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold">
                     Dopisz jako Admin →
                   </button>`
                : ''
            }
          </div>

          <div class="space-y-3">
            ${registrations
              .map((r) => {
                const statusBadge =
                  r.status === 'PENDING'
                    ? `<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">⏳ Czeka na dopisanie przez Admina</span>`
                    : r.status === 'APPROVED'
                    ? `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">✅ Dopisany do ligi (${r.assignedLeague})</span>`
                    : `<span class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold">❌ Odrzucony</span>`;

                return `
                  <div class="p-4 rounded-xl bg-slate-950/80 border border-white/10">
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <span class="text-[11px] text-slate-400">${escapeHtml(r.submittedAt)}</span>
                      ${statusBadge}
                    </div>
                    <div class="flex items-center gap-3">
                      <img src="${r.avatar}" class="w-12 h-12 rounded-full object-cover border border-white/20" alt=""/>
                      <div class="min-w-0 flex-1">
                        <div class="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                          <span>${escapeHtml(r.name)}</span>
                          ${renderClanBadgeSafe(r, state, false)}
                        </div>
                        <div class="text-xs text-blue-300 font-semibold">@${escapeHtml(r.nick)} • ${escapeHtml(r.preference)}</div>
                        <div class="text-[11px] text-slate-400 truncate mt-0.5">${escapeHtml(r.notes || '')}</div>
                        ${
                          r.playedBefore && r.linkedHistoricalName
                            ? `<div class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-[10px] font-bold text-amber-300">
                                 🏛️ Powrót z S1–S55: ${escapeHtml(r.linkedHistoricalName)}
                               </div>`
                            : ''
                        }
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // BRAMKA AUTORYZACJI ADMINISTRACJI (GDY KTOŚ MA LINK ADMINA, ALE NIE JEST ZALOGOWANY)
  // =========================================================================
  function renderAdminLoginAndJoinGate(state, session) {
    const isMasterGate =
      (session && session.linkMode === 'MASTER') ||
      (typeof window !== 'undefined' && window.SMPL_FORCED_MODE === 'MASTER');

    return `
      <div class="w-full max-w-5xl mx-auto glass-panel-league smpl-admin-gate-card rounded-3xl p-4 sm:p-7 my-4 sm:my-6 border-2 ${isMasterGate ? 'border-amber-400/60' : 'border-amber-500/40'} shadow-2xl">
        <div class="flex flex-wrap items-center justify-between gap-2.5 mb-5 pb-3.5 border-b border-white/10">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${isMasterGate ? 'bg-amber-400/20 border border-amber-400/60 text-amber-200' : 'bg-blue-500/20 border border-blue-400/50 text-blue-200'} font-display font-bold text-[10px] sm:text-xs uppercase tracking-wider max-w-full">
            ${isMasterGate ? '👑 KONSOLA ZAŁOŻYCIELA — MASTER ADMIN SMPL' : '🛡️ STREFA ADMINISTRACJI — WYMAGANA AUTORYZACJA'}
          </span>
          <button
            type="button"
            onclick="SMPL_APP.exitAdminGateToPublic()"
            class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 text-xs font-display font-bold uppercase transition"
          >
            ← Wróć na stronę główną
          </button>
        </div>

        <div class="max-w-3xl mx-auto text-center mb-5 sm:mb-6">
          <div class="smpl-auth-crest-stage mb-3">
            <img src="css/icon-192.png" class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-amber-400/70 shadow-xl crest-float" alt="Score Match Liga"/>
          </div>
          <h1 class="font-display font-black text-xl sm:text-3xl text-white uppercase tracking-tight">
            ${isMasterGate ? 'Master Panel Szymona Komendy' : 'Panel Administratora SMPL'}
          </h1>
          <p class="text-xs sm:text-sm text-slate-300 mt-1.5 max-w-xl mx-auto">
            ${isMasterGate
              ? 'Pełne uprawnienia Właściciela Ligi: zarząd dywizji, konfigurator Wsparcia (Donate), bezpieczeństwo, kopie bazy oraz Vanessa Gemini AI.'
              : 'Dostęp do panelu zarządzania ligą jest ściśle chroniony. Zaloguj się wyłącznie na swoje indywidualne konto Administratora SMPL.'}
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- LEWA KOLUMNA: LOGOWANIE ZATWIERDZONEGO ADMINA -->
          <div class="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 border border-white/15">
            <div class="flex items-center gap-3 pb-3 mb-4 border-b border-white/10">
              <div class="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400 flex items-center justify-center text-lg">🔑</div>
              <div>
                <h3 class="font-display font-black text-base text-white uppercase">Logowanie Administratora</h3>
                <p class="text-xs text-slate-400">Tylko dla zatwierdzonych administratorów SMPL</p>
              </div>
            </div>

            <form onsubmit="SMPL_APP.handleAdminGateLogin(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Twój Login lub Email Administratora *</label>
                <input
                  type="text"
                  id="gate-admin-user"
                  required
                  autocomplete="username"
                  placeholder="Wpisz swój indywidualny login..."
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"
                />
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1.5 font-bold">Twoje Hasło Administratora *</label>
                <input
                  type="password"
                  id="gate-admin-pass"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"
                />
              </div>

              <button type="submit" class="w-full btn-league py-3.5 rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-xl">
                🔓 Zaloguj się do Panelu Administracji
              </button>
            </form>

            <div class="mt-4 p-3 rounded-xl bg-slate-950/80 border border-white/10 text-[11px] text-slate-400 leading-relaxed">
              🛡️ Po zalogowaniu do Panelu możesz w zakładce <strong class="text-white">Ustawienia &amp; Linki</strong> w każdej chwili zmienić swój login oraz ustawić nowe, własne hasło administratora.
            </div>
          </div>

          <!-- PRAWA KOLUMNA: WNIOSEK O DOŁĄCZENIE DO ADMINISTRACJI -->
          <div class="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-500/30">
            <div class="flex items-center gap-3 pb-3 mb-4 border-b border-white/10">
              <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-lg">🛡️</div>
              <div>
                <h3 class="font-display font-black text-base text-white uppercase">Wniosek o Współadministratora</h3>
                <p class="text-xs text-slate-400">Wymaga ręcznej akceptacji Właściciela Ligi</p>
              </div>
            </div>

            <form onsubmit="SMPL_APP.handleAdminApplicationSubmit(event)" class="space-y-3.5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Imię i Nazwisko *</label>
                  <input type="text" id="apply-admin-name" required placeholder="Twoje imię i nazwisko" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
                </div>
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Wybrany Login Admina *</label>
                  <input type="text" id="apply-admin-user" required placeholder="Twój unikalny login" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Kontakt Messenger / FB *</label>
                  <input type="text" id="apply-admin-fb" required placeholder="https://m.me/twoj.profil" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
                </div>
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Sekcja / Liga do pomocy *</label>
                  <select id="apply-admin-division" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold">
                    ${getLeaguesSafe(state, false)
                      .slice()
                      .sort((a, b) => (a.id === 'L2' ? -1 : b.id === 'L2' ? 1 : (a.order || 99) - (b.order || 99)))
                      .map((lg) => `<option value="${escapeHtml(lg.shortName || lg.id)}">${getLeagueIconSafe(lg.id)} ${escapeHtml(lg.name)} — Opiekun Ligi</option>`)
                      .join('')}
                    <option value="Moderacja Wyników i Screenów">📸 Moderacja Wyników i Screenów</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Ustaw Swoje Prywatne Hasło *</label>
                <input type="password" id="apply-admin-pass" required placeholder="Minimum 6 znaków" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
              </div>

              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Dlaczego chcesz dołączyć do Administracji SMPL?</label>
                <input type="text" id="apply-admin-reason" placeholder="Krótki opis (np. weryfikacja screenów wieczorami)" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
              </div>

              <button type="submit" class="w-full py-3 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase tracking-wider shadow-xl transition">
                📨 Wyślij wniosek do akceptacji Właściciela
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 7. ROZBUDOWANY PANEL ADMINISTRATORA (DLA ZALOGOWANYCH ADMINÓW + MASTER SZYMON KOMENDA)
  // =========================================================================
  function renderAdminDashboardView(state, activeLeagueId, adminSubTab, session, uiOpts) {
    // 1. Jeśli zwykły gracz próbuje wywołać widok na linku publicznym — całkowicie zablokowane!
    if (!session || session.linkMode === 'PUBLIC') {
      return `
        <div class="glass-panel rounded-2xl p-8 text-center border border-rose-500/40">
          <div class="text-3xl mb-2">🔒</div>
          <h3 class="font-display font-black text-lg text-white uppercase">Brak dostępu — Strefa Administracji Ukryta</h3>
          <p class="text-xs text-slate-400 mt-1">Panel Administratora jest dostępny wyłącznie ze specjalnego, tajnego linku administracyjnego.</p>
        </div>
      `;
    }

    // 2. Jeśli użytkownik wszedł ze specjalnego linku Admina, ale NIE JEST ZALOGOWANY — pokazujemy Bramkę Logowania i Wniosków
    if (!(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'))) {
      return renderAdminLoginAndJoinGate(state);
    }

    const isMasterOwner = Boolean(session && window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session) && session.adminRole === 'MASTER_ADMIN');
    const myAdminAcc = (state.admins || []).find((a) => a.id === session.adminId) || null;
    const playersMap = {};
    state.players.forEach((p) => {
      playersMap[p.id] = p;
    });

    const pendingMatches = state.matches.filter((m) => m.status === 'PENDING');
    const pendingRegs = (state.registrations || []).filter((r) => r.status === 'PENDING');
    const approvedPoolRegs = (state.registrations || []).filter((r) => r && r.status === 'APPROVED_POOL');
    const nonAdminPlayers = isMasterOwner
      ? (state.players || []).filter(
          (p) =>
            p &&
            !p.isPlaceholder &&
            !p.gdprDeleted &&
            p.active !== false &&
            !(window.SMPL_DB && typeof window.SMPL_DB.findAdminForPlayer === 'function' && window.SMPL_DB.findAdminForPlayer(p, state))
        )
      : [];
    const nonAdminRegs = isMasterOwner
      ? (state.registrations || []).filter((r) => r && (r.status === 'PENDING' || r.status === 'APPROVED_POOL'))
      : [];
    const recruitmentClansList =
      window.SMPL_DB && typeof window.SMPL_DB.getClansList === 'function'
        ? window.SMPL_DB.getClansList(state)
        : (state.clans || []);
    const pendingPwdReqs = (state.passwordRequests || []).filter((r) => r.status === 'PENDING');
    const pendingAdminReqs = (state.admins || []).filter((a) => a.status === 'PENDING');
    const pendingDisputesCount = ((state.competitions && Array.isArray(state.competitions.matchDisputes)) ? state.competitions.matchDisputes : []).filter((d) => d && d.status === 'PENDING').length;
    const pendingAiQuestions = (state.aiUnansweredQueue || []).filter((q) => q.status === 'PENDING');
    const approvedAdmins = (state.admins || []).filter((a) => a.status === 'APPROVED');
    const rejectedAdmins = (state.admins || []).filter((a) => a.status === 'REJECTED');

    const opts = uiOpts || {};
    let currentTab = adminSubTab || 'moderation';
    if (currentTab === 'squads') currentTab = 'recruitment';
    if (currentTab === 'master_portal') currentTab = 'master_studio';
    if (
      !isMasterOwner &&
      (currentTab === 'master_studio' ||
        currentTab === 'master_ranks' ||
        currentTab === 'admins_approval' ||
        currentTab === 'master_leagues' ||
        currentTab === 'master_backup')
    ) {
      currentTab = 'moderation';
    }

    const activeAdminLeagues = getLeaguesSafe(state, false);
    const allAdminLeagues = getLeaguesSafe(state, true);
    const leaguePlayers = state.players.filter((p) => p.leagueId === activeLeagueId && p.active !== false);
    const hasAdminSrvToken = Boolean(session && session.serverAdminToken);
    const isHttpHost =
      typeof window !== 'undefined' &&
      window.location &&
      window.location.protocol &&
      window.location.protocol.startsWith('http') &&
      typeof fetch === 'function';

    const tabBtnClass = (tabId, activeCls, idleCls) =>
      `px-3 py-2 rounded-xl text-xs font-display font-bold uppercase transition flex items-center gap-1.5 ${
        currentTab === tabId ? (activeCls || 'btn-league shadow-md') : (idleCls || 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-white/15')
      }`;

    const urgentItems = [];
    if (pendingMatches.length > 0) {
      urgentItems.push(
        `<button type="button" onclick="SMPL_APP.setAdminSubTab('moderation')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 text-[11px] font-display font-bold transition">⏳ ${pendingMatches.length} meczów do weryfikacji →</button>`
      );
    }
    if (pendingRegs.length > 0) {
      urgentItems.push(
        `<button type="button" onclick="SMPL_APP.setAdminSubTab('recruitment');SMPL_APP.setAdminRecruitmentSubTab('pending')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/50 text-[11px] font-display font-bold transition">📝 ${pendingRegs.length} nowych zapisów →</button>`
      );
    }
    if (pendingPwdReqs.length > 0) {
      urgentItems.push(
        `<button type="button" onclick="SMPL_APP.setAdminSubTab('recruitment');SMPL_APP.setAdminRecruitmentSubTab('passwords')" class="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/35 text-blue-200 border border-blue-400/50 text-[11px] font-display font-bold transition">🔑 ${pendingPwdReqs.length} próśb o hasło →</button>`
      );
    }
    if (pendingDisputesCount > 0) {
      urgentItems.push(
        `<button type="button" onclick="SMPL_APP.setAdminSubTab('tribunal')" class="px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 border border-rose-400/50 text-[11px] font-display font-bold transition">⚖️ ${pendingDisputesCount} sporów VAR →</button>`
      );
    }
    if (pendingAiQuestions.length > 0) {
      urgentItems.push(
        `<button type="button" onclick="SMPL_APP.setAdminSubTab('ai_vanessa')" class="px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/35 text-pink-200 border border-pink-400/50 text-[11px] font-display font-bold transition">💋 ${pendingAiQuestions.length} pytań AI →</button>`
      );
    }
    if (isMasterOwner && pendingAdminReqs.length > 0) {
      urgentItems.push(
        `<button type="button" onclick="SMPL_APP.setAdminSubTab('admins_approval')" class="px-2.5 py-1 rounded-lg bg-amber-400/25 hover:bg-amber-400/40 text-amber-200 border border-amber-400/60 text-[11px] font-display font-black transition">🛡️ ${pendingAdminReqs.length} wniosków Admina →</button>`
      );
    }

    const adminHeroCls = isMasterOwner ? 'master-showcase-banner' : 'matchday-showcase-banner';
    return `
      <!-- Nagłówek i Nawigacja Panelu Administratora -->
      <div class="${adminHeroCls} rounded-3xl p-4 sm:p-6 mb-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
              ${isMasterOwner ? '👑' : '🛡️'}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-display font-bold">
                  ${isMasterOwner ? '👑 MASTER ADMIN: SZYMON KOMENDA' : `🛡️ ADMIN: ${escapeHtml(session.adminName)}`}
                </span>
                <span class="px-2 py-0.5 rounded-full bg-slate-900/80 text-slate-300 border border-white/15 text-[10px] font-display font-bold uppercase">
                  Sezon ${(state && state.season) || 56} • Tydz. ${(state.weeklyConfig && state.weeklyConfig.currentWeek) || 2}
                </span>
              </div>
              <h2 class="font-display font-black text-lg sm:text-2xl text-white uppercase mt-1 truncate">
                ${isMasterOwner ? 'Centrum Kontroli Master Admina' : 'Centrum Zarządzania — Score Match Liga'}
              </h2>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <button type="button" onclick="SMPL_APP.handleAdminLogout()" class="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-500/40 text-xs font-display font-bold uppercase transition">
              🚪 Wyloguj
            </button>
          </div>
        </div>

        ${
          urgentItems.length > 0 || (isHttpHost && !hasAdminSrvToken)
            ? `<div class="p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
                 ${
                   urgentItems.length > 0
                     ? `<div class="flex flex-wrap items-center gap-1.5">
                          <span class="text-[10px] font-display font-black uppercase text-slate-400 mr-1">🔔 Pilne:</span>
                          ${urgentItems.join('')}
                        </div>`
                     : ''
                 }
                 ${
                   isHttpHost && !hasAdminSrvToken
                     ? `<div class="text-[11px] text-rose-200 font-semibold">
                          ⚠️ Brak aktywnego tokena zapisu na serwerze — wyloguj się i zaloguj ponownie hasłem Admina, aby zapisywać zmiany na serwerze.
                        </div>`
                     : ''
                 }
               </div>`
            : ''
        }

        <!-- RZĄD 1: ZAKŁADKI ADMINISTRACYJNE -->
        <div class="space-y-2 pt-2 border-t border-white/10">
          <div class="text-[10px] font-display font-black uppercase tracking-wider text-slate-400">
            🛡️ Panel Zarządu &amp; Rozgrywek
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <button type="button" onclick="SMPL_APP.setAdminSubTab('overview')" class="${tabBtnClass('overview')}">
              <span>🧭 Pulpit</span>
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('moderation')" class="${tabBtnClass('moderation')}">
              <span>✅ Wyniki</span>
              <span class="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black">${pendingMatches.length}</span>
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('recruitment')" class="${tabBtnClass('recruitment')}">
              <span>👥 Kadra &amp; Zapisy</span>
              <span class="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-950 font-black">${pendingRegs.length + pendingPwdReqs.length}</span>
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('schedule')" class="${tabBtnClass('schedule')}">
              <span>🗓️ Terminarz &amp; Kolejki</span>
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('tribunal')" class="${tabBtnClass('tribunal')}">
              <span>⚖️ Trybunał &amp; VAR</span>
              ${pendingDisputesCount > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black animate-pulse">${pendingDisputesCount}</span>` : ''}
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('blacklist')" class="${tabBtnClass('blacklist', 'bg-rose-600 text-white font-black shadow-lg shadow-rose-900/50', 'bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 border border-rose-500/40')}">
              <span>💀 Czarna Lista</span>
              <span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black">${(state.blacklist || []).length}</span>
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('ai_vanessa')" class="${tabBtnClass('ai_vanessa', '', 'bg-pink-500/15 hover:bg-pink-500/25 text-pink-200 border border-pink-400/40')}">
              <span>💋 AI Vanessa</span>
              ${pendingAiQuestions.length > 0 ? `<span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black animate-pulse">${pendingAiQuestions.length}</span>` : ''}
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('changelog')" class="${tabBtnClass('changelog', '', 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/40')}">
              <span>📋 Ściąga</span>
            </button>
            <button type="button" onclick="SMPL_APP.setAdminSubTab('settings')" class="${tabBtnClass('settings')}">
              <span>⚙️ Ustawienia</span>
            </button>
          </div>
        </div>

        ${
          isMasterOwner
            ? `<div class="space-y-2 pt-2 border-t border-amber-400/25">
                 <div class="text-[10px] font-display font-black uppercase tracking-wider text-amber-300">
                   👑 Strefa Master Admina (Właściciel Portalu)
                 </div>
                 <div class="flex flex-wrap items-center gap-1.5">
                   <button type="button" onclick="SMPL_APP.setAdminSubTab('master_studio')" class="${tabBtnClass('master_studio', 'btn-league shadow-lg', 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 border border-amber-400/45')}">
                     <span>👑 Portal &amp; Konkursy</span>
                   </button>
                   <button type="button" onclick="SMPL_APP.setAdminSubTab('master_ranks')" class="${tabBtnClass('master_ranks', 'btn-league shadow-lg', 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 border border-amber-400/45')}">
                     <span>🎖️ Kreator Rang</span>
                   </button>
                   <button type="button" onclick="SMPL_APP.setAdminSubTab('admins_approval')" class="${tabBtnClass('admins_approval', 'btn-league shadow-lg', 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 border border-amber-400/45')}">
                     <span>🛡️ Admini &amp; Dostęp</span>
                     <span class="px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black">${pendingAdminReqs.length}</span>
                   </button>
                   <button type="button" onclick="SMPL_APP.setAdminSubTab('master_leagues')" class="${tabBtnClass('master_leagues', 'btn-league shadow-lg', 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 border border-amber-400/45')}">
                     <span>🏟️ Ligi &amp; Klany</span>
                   </button>
                   <button type="button" onclick="SMPL_APP.setAdminSubTab('master_backup')" class="${tabBtnClass('master_backup', 'btn-league shadow-lg', 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 border border-amber-400/45')}">
                     <span>💾 Kopie &amp; Baza</span>
                   </button>
                 </div>
               </div>`
            : ''
        }
      </div>

      ${
        currentTab === 'overview'
          ? renderOverviewSubTab(state, activeLeagueId, session, pendingMatches, pendingRegs, pendingPwdReqs, activeAdminLeagues)
          : ''
      }

      ${
        currentTab === 'admins_approval' && isMasterOwner
          ? `
            <!-- EKSKLUZYWNY MODUŁ TYLKO DLA SZYMONA KOMENDY: NADAWANIE ADMINA "TAK O" + ZATWIERDZANIE WNIOSKÓW -->
            <div class="space-y-6">
              <div class="glass-panel rounded-2xl p-5 sm:p-6 border-2 border-amber-400/50 bg-slate-950/90">
                <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
                  <div>
                    <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-display font-bold text-[10px] uppercase">
                      👑 TYLKO MASTER ADMIN (SZYMON KOMENDA) — NADANIE OD RĘKI BEZ WNIOSKU
                    </span>
                    <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase mt-1">
                      Nadaj Uprawnienia Administratora „TAK O”
                    </h3>
                    <p class="text-xs text-slate-300 mt-0.5">
                      Wybierz istniejącego gracza z ligi albo wpisz nową osobę — konto zostanie od razu aktywowane jako <strong>CO_ADMIN (APPROVED)</strong> i otrzymasz gotowy login + hasło do wysłania na Messenger.
                    </p>
                  </div>
                </div>

                <div class="mb-4">
                  <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">
                    1. Awansuj gracza z ligi / puli ALBO utwórz nowe konto admina
                  </label>
                  <select id="master-grant-source" onchange="SMPL_APP.masterFillGrantAdminFromSource()" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs sm:text-sm text-white font-semibold">
                    <option value="">✍️ Wpisz ręcznie nową osobę (bez powiązania lub własny login)</option>
                    ${
                      nonAdminPlayers.length > 0
                        ? `<optgroup label="Aktywni Gracze w Ligach (${nonAdminPlayers.length})">
                             ${nonAdminPlayers
                               .map((p) => `<option value="PLAYER::${escapeHtml(p.id)}">⚽ ${escapeHtml(p.name)} (@${escapeHtml(p.nick || '')} — ${escapeHtml(p.leagueId || 'SMPL')})</option>`)
                               .join('')}
                           </optgroup>`
                        : ''
                    }
                    ${
                      nonAdminRegs.length > 0
                        ? `<optgroup label="Oczekujący / Pula Graczy (${nonAdminRegs.length})">
                             ${nonAdminRegs
                               .map((r) => `<option value="REG::${escapeHtml(r.id)}">📋 ${escapeHtml(r.name)} (@${escapeHtml(r.nick || '')} — ${r.status === 'APPROVED_POOL' ? 'Pula' : 'Oczekuje'})</option>`)
                               .join('')}
                           </optgroup>`
                        : ''
                    }
                  </select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">

                  <div>
                    <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Imię / Nazwa Admina *</label>
                    <input id="master-grant-name" type="text" maxlength="80" placeholder="np. Kacper Nowak" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
                  </div>

                  <div>
                    <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Login do Panelu Admina *</label>
                    <input id="master-grant-username" type="text" maxlength="40" placeholder="np. kacper.nowak" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
                  </div>

                  <div>
                    <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Hasło startowe Admina</label>
                    <div class="flex items-center gap-2">
                      <input id="master-grant-password" type="text" maxlength="60" placeholder="Wpisz lub kliknij Losuj" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
                      <button type="button" onclick="SMPL_APP.masterGenerateGrantAdminPass()" class="px-3 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-xs font-bold flex-shrink-0" title="Wylosuj czytelne hasło">
                        🎲 Losuj
                      </button>
                    </div>
                    <p id="master-grant-pass-hint" class="text-[10px] text-slate-400 mt-1">
                      Przy awansie gracza możesz zostawić puste (zachowa obecne hasło gracza) lub ustawić nowe.
                    </p>
                  </div>

                  <div>
                    <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Sekcja / Dywizja Zarządu</label>
                    <select id="master-grant-division" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold">
                      <option value="Wszystkie Dywizje (Zarząd)">Wszystkie Dywizje (Zarząd)</option>
                      ${activeAdminLeagues
                        .map((lg) => `<option value="Opiekun ${escapeHtml(lg.name || lg.id)}">Opiekun ${escapeHtml(lg.name || lg.id)}</option>`)
                        .join('')}
                      <option value="Tabela & Terminarze">Tabela &amp; Terminarze</option>
                      <option value="Moderacja & Skargi">Moderacja &amp; Skargi</option>
                      <option value="Wsparcie Techniczne">Wsparcie Techniczne</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Kontakt Messenger / FB (opcjonalnie)</label>
                    <input id="master-grant-fb" type="text" maxlength="255" placeholder="https://m.me/..." class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
                  </div>

                  <div class="flex flex-col justify-end gap-2">
                    <label class="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                      <input id="master-grant-link-player" type="checkbox" checked class="w-4 h-4 cursor-pointer"/>
                      <span>Powiąż z kartą gracza (ranga 🛡️ ADMIN)</span>
                    </label>
                    <button type="button" onclick="SMPL_APP.masterGrantAdminSubmit()" class="btn-league w-full py-2.5 px-4 rounded-xl text-xs font-display font-black uppercase">
                      👑 Nadaj Admina Od Ręki (TAK O)
                    </button>
                  </div>
                </div>
              </div>

              <div class="glass-panel rounded-2xl p-5 sm:p-6 border-2 border-amber-400/50">
                <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-white/10">
                  <div>
                    <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-display font-bold text-[10px] uppercase">
                      👑 WIDOCZNE TYLKO NA TWOIM LINKU MASTER (SZYMON KOMENDA)
                    </span>
                    <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase mt-1">
                      Wnioski o dołączenie do Administracji SMPL (${pendingAdminReqs.length} oczekujących)
                    </h3>
                    <p class="text-xs text-slate-300 mt-0.5">
                      Osoby posiadające link dla administracji mogą wysłać prośbę o dołączenie do zespołu Adminów. Dopóki nie klikniesz <strong>[ ✅ ZATWIERDŹ DO ADMINISTRACJI ]</strong>, nie mogą się zalogować do panelu.
                    </p>
                  </div>
                </div>

                ${
                  pendingAdminReqs.length === 0
                    ? `<div class="p-8 rounded-2xl bg-slate-950/70 text-center text-slate-400 text-xs">
                         Brak oczekujących wniosków o dołączenie do administracji. Możesz przetestować wysyłanie wniosku przełączając się na „🔒 Bramkę Współadmina”.
                       </div>`
                    : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                         ${pendingAdminReqs
                           .map(
                             (req) => `
                               <div class="p-5 rounded-2xl bg-slate-950/95 border-2 border-amber-500/40 flex flex-col justify-between">
                                 <div>
                                   <div class="flex items-center justify-between gap-2 text-xs pb-2.5 mb-3 border-b border-white/10">
                                     <span class="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-display font-bold">
                                       ⏳ CHCE DOŁĄCZYĆ DO ADMINISTRACJI
                                     </span>
                                     <span class="text-slate-400">${escapeHtml(req.submittedAt || '')}</span>
                                   </div>
                                   <div class="font-display font-black text-lg text-white">${escapeHtml(req.name)}</div>
                                   <div class="text-xs text-blue-300 font-bold mt-0.5">
                                     Login: <code class="text-amber-300">${escapeHtml(req.username)}</code> • Dywizja: ${escapeHtml(req.division)}
                                   </div>
                                   <div class="text-xs text-slate-300 mt-1">
                                     Kontakt FB/Messenger: <a href="${escapeHtml(req.fbLink)}" target="_blank" class="text-blue-400 underline">${escapeHtml(req.fbLink)}</a>
                                   </div>
                                   <div class="mt-3 p-3 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 italic">
                                     „${escapeHtml(req.reason || 'Prośba o nadanie uprawnień współadministratora Score Match Liga.')}”
                                   </div>
                                 </div>

                                 <div class="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-white/10">
                                   <button onclick="SMPL_APP.masterApproveAdmin('${req.id}')" class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase shadow-lg transition">
                                     ✅ Zatwierdź Admina
                                   </button>
                                   <button onclick="SMPL_APP.masterRejectAdmin('${req.id}')" class="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs uppercase transition">
                                     ❌ Odrzuć wniosek
                                   </button>
                                 </div>
                               </div>
                             `
                           )
                           .join('')}
                       </div>`
                }
              </div>

              <!-- Lista aktualnie zatwierdzonych Administratorów -->
              <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
                <h3 class="font-display font-black text-base sm:text-lg text-white uppercase mb-3">
                  🛡️ Aktywni Administratorzy Ligi (${approvedAdmins.length})
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  ${approvedAdmins
                    .map(
                      (adm) => `
                        <div class="p-4 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-between gap-3">
                          <div>
                            <div class="font-display font-bold text-white text-sm flex items-center gap-2">
                              <span>${adm.role === 'MASTER_ADMIN' ? '👑' : '🛡️'} ${escapeHtml(adm.name)}</span>
                              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">AKTYWNY</span>
                            </div>
                            <div class="text-xs text-slate-400 mt-0.5">
                              Login: <code class="text-slate-200">${escapeHtml(adm.username)}</code> • ${escapeHtml(adm.division || adm.roleTitle)}
                            </div>
                          </div>
                          ${
                            adm.role !== 'MASTER_ADMIN'
                              ? `<button onclick="SMPL_APP.masterRejectAdmin('${adm.id}')" class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition">
                                   🚫 Odbierz dostęp
                                 </button>`
                              : `<span class="text-[11px] font-display font-bold text-amber-400">WŁAŚCICIEL</span>`
                          }
                        </div>
                      `
                    )
                    .join('')}
                </div>

                ${
                  rejectedAdmins.length > 0
                    ? `<div class="mt-5 pt-4 border-t border-white/10">
                         <div class="text-xs font-display uppercase text-slate-400 font-bold mb-2">Odrzuceni / Zablokowani (${rejectedAdmins.length}):</div>
                         <div class="flex flex-wrap gap-2">
                           ${rejectedAdmins
                             .map(
                               (ra) => `
                                 <div class="px-3 py-1.5 rounded-lg bg-slate-900 border border-rose-500/30 text-xs text-slate-300 flex items-center gap-2">
                                   <span>❌ ${escapeHtml(ra.name)} (@${escapeHtml(ra.username)})</span>
                                   <button onclick="SMPL_APP.masterApproveAdmin('${ra.id}')" class="text-emerald-400 hover:underline font-bold">Przywróć</button>
                                 </div>
                               `
                             )
                             .join('')}
                         </div>
                       </div>`
                    : ''
                }
              </div>

              ${renderPortalAccessUrlsCard(true)}
            </div>
          `
          : ''
      }

      ${
        currentTab === 'blacklist'
          ? renderBlacklistSubTab(state, session)
          : currentTab === 'tribunal'
          ? renderTribunalSubTab(state, session)
          : currentTab === 'moderation'
          ? `
            <!-- 1. CENTRUM AKCEPTACJI WYNIKÓW (KOLEJKA MODERACJI — DWUMECZ & SS) -->
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
              <div class="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-white/10">
                <div>
                  <h3 class="font-display font-black text-lg text-white uppercase">
                    1. Centrum Akceptacji Wyników — Kolejka Moderacji (${pendingMatches.length})
                  </h3>
                  <p class="text-xs text-slate-400 mt-0.5">
                    Zatwierdzaj wyniki dopiero po otrzymaniu <strong class="text-white">obu meczów dwumeczu (U siebie + Na wyjeździe)</strong> oraz weryfikacji <strong class="text-emerald-300">zrzutów ekranu (SS)</strong>.
                  </p>
                </div>
                ${
                  pendingMatches.length > 1
                    ? `<button onclick="SMPL_APP.approveAllPendingMatches()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs uppercase shadow-lg">
                         ✅ Zatwierdź wszystkie ze screenem (SS)
                       </button>`
                    : ''
                }
              </div>

              ${(() => {
                const dupList = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.detectDuplicateScreenshots === 'function')
                  ? window.SMPL_STUDIO.detectDuplicateScreenshots(state.matches || [])
                  : [];
                if (!dupList || !dupList.length) return '';
                return `
                  <div class="mb-5 p-4 rounded-2xl bg-rose-950/50 border border-rose-500/60 text-xs space-y-1.5">
                    <div class="font-display font-black text-rose-300 uppercase">🚨 Kontrola Duplikatów SS — Wykryto powtarzające się screeny (${dupList.length})!</div>
                    ${dupList.slice(0, 6).map((d) => `
                      <div class="text-rose-100">• Screen użyty ponownie w meczach: <strong>K${Number(d.roundA || 0)}</strong> oraz <strong>K${Number(d.roundB || 0)}</strong> (rozmiar sygnatury: ${Number(d.len || 0)} B)</div>
                    `).join('')}
                  </div>
                `;
              })()}

              ${
                pendingMatches.length === 0
                  ? `<div class="p-10 rounded-2xl bg-slate-950/60 border border-white/5 text-center">
                       <div class="text-3xl mb-2">🎉</div>
                       <div class="font-display font-bold text-white text-base">Kolejka Moderacji jest pusta!</div>
                       <div class="text-xs text-slate-400 mt-1">Wszystkie zgłoszone przez graczy mecze zostały już zweryfikowane i przeliczone w tabeli.</div>
                     </div>`
                  : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                       ${(() => {
                         const handledIds = {};
                         const cardsHtml = [];
                         const renderSingleLegBox = (legM, boxTitle) => {
                           const hp = playersMap[legM.homeId] || { name: 'Gospodarz', nick: 'home', avatar: '' };
                           const ap = playersMap[legM.awayId] || { name: 'Gość', nick: 'away', avatar: '' };
                           const hasSS = Boolean(legM.screenshot && String(legM.screenshot).trim().length >= 20);
                           return `
                             <div class="p-3.5 rounded-xl bg-slate-900/70 border ${hasSS ? 'border-white/15' : 'border-rose-500/50'} space-y-3">
                               <div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                 <span class="font-display font-bold uppercase text-amber-300">${boxTitle} • KOLEJKA ${legM.round}</span>
                                 <span class="px-2 py-0.5 rounded font-bold ${hasSS ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}">${hasSS ? '📸 SS Otrzymany ✅' : '⚠️ BRAK SS!'}</span>
                               </div>
                               <div class="grid grid-cols-7 items-center gap-2">
                                 <div class="col-span-3 flex items-center gap-2">
                                   <img src="${hp.avatar}" class="w-9 h-9 rounded-full object-cover border border-white/20" alt=""/>
                                   <div class="min-w-0">
                                     <div class="font-bold text-white text-xs truncate">${escapeHtml(hp.name)}</div>
                                     <div class="text-[10px] text-slate-400">Gospodarz</div>
                                   </div>
                                 </div>
                                 <div class="col-span-1 text-center">
                                   <div class="px-2 py-1 rounded-lg bg-slate-950 border border-amber-400 font-display font-black text-sm text-amber-300">${legM.homeScore}:${legM.awayScore}</div>
                                 </div>
                                 <div class="col-span-3 flex items-center justify-end gap-2 text-right">
                                   <div class="min-w-0">
                                     <div class="font-bold text-white text-xs truncate">${escapeHtml(ap.name)}</div>
                                     <div class="text-[10px] text-slate-400">Gość</div>
                                   </div>
                                   <img src="${ap.avatar}" class="w-9 h-9 rounded-full object-cover border border-white/20" alt=""/>
                                 </div>
                               </div>
                               ${
                                 hasSS
                                   ? `<div onclick="SMPL_APP.openScreenshotModal('${legM.id}')" class="cursor-pointer group relative rounded-xl overflow-hidden border border-white/15 bg-slate-950 h-36 flex items-center justify-center">
                                        <img src="${legM.screenshot}" class="w-full h-full object-contain" alt="Screen wyniku"/>
                                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                          <span class="px-3 py-1 rounded-lg bg-white text-slate-950 font-display font-bold text-xs">🔍 Powiększ SS</span>
                                        </div>
                                      </div>`
                                   : `<div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-300 font-semibold">⚠️ Brak zrzutu ekranu (SS) — nie zatwierdzaj bez SS!</div>`
                               }
                               <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                                 <span>Zgłosił: <strong class="text-slate-200">${escapeHtml(legM.submittedBy || '')}</strong></span>
                                 <div class="flex items-center gap-1.5">
                                   ${hasSS ? `<button type="button" onclick="SMPL_APP.adminVerifyMatchScreenshotAI('${legM.id}')" class="px-2.5 py-1 rounded-lg bg-purple-600/35 hover:bg-purple-600/55 text-purple-100 border border-purple-400/50 font-bold text-[11px]">🤖 AI OCR SS</button>` : ''}
                                   <button onclick="SMPL_APP.openAdminEditMatchModal('${legM.id}')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px]">✏️ Edytuj</button>
                                   <button onclick="SMPL_APP.adminRejectMatchPrompt('${legM.id}')" class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]">❌ Odrzuć</button>
                                 </div>
                               </div>
                             </div>
                           `;
                         };

                         pendingMatches.forEach((m) => {
                           if (handledIds[m.id]) return;
                           const compM = (window.SMPL_DB && typeof window.SMPL_DB.findCompanionReturnMatch === 'function')
                             ? window.SMPL_DB.findCompanionReturnMatch(state.matches, m)
                             : null;
                           const compPending = compM && !handledIds[compM.id] && compM.status === 'PENDING'
                             ? pendingMatches.find((x) => x.id === compM.id)
                             : null;
                           const lName = (state.leagues && state.leagues[m.leagueId] && state.leagues[m.leagueId].shortName) || m.leagueId;

                           if (compPending) {
                             handledIds[m.id] = true;
                             handledIds[compPending.id] = true;
                             const firstLeg = Number(m.round || 0) <= Number(compPending.round || 0) ? m : compPending;
                             const secondLeg = firstLeg.id === m.id ? compPending : m;
                             const bothSS = Boolean(firstLeg.screenshot && secondLeg.screenshot);
                             cardsHtml.push(`
                               <div class="lg:col-span-2 rounded-2xl bg-slate-950/90 border-2 ${bothSS ? 'border-emerald-500/50' : 'border-amber-500/50'} p-5 shadow-xl space-y-4">
                                 <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                                   <div class="flex items-center gap-2">
                                     <span class="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-display font-black text-xs uppercase">🤝 DWUMECZ KOMPLETNY (2/2)</span>
                                     <span class="text-xs font-bold text-white">${escapeHtml(lName)} • Kol. ${firstLeg.round} &amp; Kol. ${secondLeg.round}</span>
                                   </div>
                                   <span class="text-xs font-bold ${bothSS ? 'text-emerald-300' : 'text-rose-400'}">${bothSS ? '📸 Otrzymano 2× SS — gotowy do zatwierdzenia!' : '⚠️ Brakuje jednego z zrzutów ekranu (SS)'}</span>
                                 </div>
                                 <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   ${renderSingleLegBox(firstLeg, '🏠 1. MECZ DWUMECZU')}
                                   ${renderSingleLegBox(secondLeg, '✈️ 2. MECZ (REWANŻ)')}
                                 </div>
                                 ${
                                   bothSS
                                     ? `<button onclick="SMPL_APP.adminApproveDoubleMatch('${firstLeg.id}', '${secondLeg.id}')" class="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs sm:text-sm uppercase transition shadow-lg">
                                          ✅ ZATWIERDŹ CAŁY DWUMECZ (${firstLeg.homeScore}:${firstLeg.awayScore} i ${secondLeg.homeScore}:${secondLeg.awayScore}) + OBA SS
                                        </button>`
                                     : `<div class="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-bold text-center">⛔ Zatwierdzenie całego dwumeczu zablokowane — brakuje jednego ze screenów (SS). Odrzuć brakujący mecz lub uzupełnij w Edycji.</div>`
                                 }
                               </div>
                             `);
                             return;
                           }

                           handledIds[m.id] = true;
                           const hp = playersMap[m.homeId] || { name: 'Gospodarz', nick: 'home', avatar: '' };
                           const ap = playersMap[m.awayId] || { name: 'Gość', nick: 'away', avatar: '' };
                           const hasSS = Boolean(m.screenshot && String(m.screenshot).trim().length >= 20);
                           const compWaiting = compM && compM.status === 'SCHEDULED';
                           cardsHtml.push(`
                             <div class="rounded-2xl bg-slate-950/90 border-2 ${compWaiting ? 'border-amber-500/50' : 'border-emerald-500/40'} p-5 flex flex-col justify-between shadow-xl">
                               <div>
                                 <div class="flex flex-wrap items-center justify-between gap-2 text-xs mb-3 pb-2.5 border-b border-white/10">
                                   <span class="px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 font-display font-bold">
                                     ${escapeHtml(lName)} • KOLEJKA ${m.round}
                                   </span>
                                   <span class="text-slate-400">Zgłoszono: <strong class="text-white">${escapeHtml(m.submittedAt || 'Teraz')}</strong></span>
                                 </div>

                                 ${
                                   compWaiting
                                     ? `<div class="mb-3 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-semibold">
                                          ⚠️ Zgłoszono tylko 1 z 2 meczów dwumeczu (rewanż z Kol. ${compM.round} wciąż nierozegrany). Zalecamy poczekać na oba wyniki + 2× SS!
                                        </div>`
                                     : compM && (compM.status === 'APPROVED' || compM.status === 'WALKOVER')
                                     ? `<div class="mb-3 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                                          🤝 Rewanż (Kol. ${compM.round}: ${compM.homeScore}:${compM.awayScore}) już rozliczony [${compM.status}]
                                        </div>`
                                     : ''
                                 }

                                 <div class="grid grid-cols-7 items-center gap-2 my-4">
                                   <div class="col-span-3 flex items-center gap-2.5">
                                     <img src="${hp.avatar}" class="w-11 h-11 rounded-full object-cover border border-white/20" alt=""/>
                                     <div class="min-w-0">
                                       <div class="font-bold text-white text-sm truncate">${escapeHtml(hp.name)}</div>
                                       <div class="text-[11px] text-slate-400">@${escapeHtml(hp.nick)}</div>
                                     </div>
                                   </div>

                                   <div class="col-span-1 text-center">
                                     <div class="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-amber-400 font-display font-black text-lg text-amber-300">
                                       ${m.homeScore}:${m.awayScore}
                                     </div>
                                   </div>

                                   <div class="col-span-3 flex items-center justify-end gap-2.5 text-right">
                                     <div class="min-w-0">
                                       <div class="font-bold text-white text-sm truncate">${escapeHtml(ap.name)}</div>
                                       <div class="text-[11px] text-slate-400">@${escapeHtml(ap.nick)}</div>
                                     </div>
                                     <img src="${ap.avatar}" class="w-11 h-11 rounded-full object-cover border border-white/20" alt=""/>
                                   </div>
                                 </div>

                                 ${
                                   Number(m.homeScore) === 0 || Number(m.awayScore) === 0
                                     ? `<div class="mb-3 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                                          🧤 Po zatwierdzeniu system automatycznie dopisze +1 Czyste Konto („Żelazna Kurtyna”)!
                                        </div>`
                                     : ''
                                 }

                                 ${
                                   hasSS
                                     ? `<div onclick="SMPL_APP.openScreenshotModal('${m.id}')" class="cursor-pointer group relative rounded-xl overflow-hidden border border-white/15 mb-4 bg-slate-900 h-44 flex items-center justify-center">
                                          <img src="${m.screenshot}" class="w-full h-full object-contain" alt="Screen wyniku"/>
                                          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                            <span class="px-3 py-1.5 rounded-lg bg-white text-slate-950 font-display font-bold text-xs">🔍 Powiększ screen (SS)</span>
                                          </div>
                                        </div>`
                                     : `<div class="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-bold">⚠️ Brak zrzutu ekranu (SS) — zatwierdzenie zablokowane do czasu dostarczenia SS!</div>`
                                 }

                                 <div class="text-xs text-slate-400 mb-4">
                                   Zgłaszający: <strong class="text-slate-200">${escapeHtml(m.submittedBy || '')}</strong>
                                   ${m.comment ? ` • Notatka: <em>„${escapeHtml(m.comment)}”</em>` : ''}
                                 </div>
                               </div>

                               <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-white/10">
                                 <button onclick="SMPL_APP.adminApproveMatch('${m.id}')" ${!hasSS ? 'disabled' : ''} class="py-2.5 px-3 rounded-xl ${hasSS ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} font-display font-bold text-xs uppercase transition">
                                   ${hasSS ? '✅ ZATWIERDŹ (SS OK)' : '⛔ BRAK SS'}
                                 </button>
                                 <button onclick="SMPL_APP.openAdminEditMatchModal('${m.id}')" class="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-display font-bold text-xs uppercase transition">
                                   ✏️ EDYTUJ WYNIK
                                 </button>
                                 <button onclick="SMPL_APP.adminRejectMatchPrompt('${m.id}')" class="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-bold text-xs uppercase transition">
                                   ❌ ODRZUĆ
                                 </button>
                               </div>
                             </div>
                           `);
                         });
                         return cardsHtml.join('');
                       })()}
                     </div>`
              }
            </div>
          `
          : ''
      }

      ${
        currentTab === 'recruitment'
          ? renderRecruitmentSubTab(state, activeLeagueId, session, opts, activeAdminLeagues, leaguePlayers, pendingRegs, approvedPoolRegs, pendingPwdReqs, recruitmentClansList, isMasterOwner)
          : ''
      }

      ${
        currentTab === 'schedule'
          ? `
            <!-- 3. SYSTEM 4 KOLEJKI NA TYDZIEŃ, ARCHIWIZACJA SEZONU, GENERATOR TERMINARZA I WALKOWERY -->
            <div class="space-y-6">
              <!-- Zarządzanie Tygodniem Rozgrywkowym (4 kolejki na tydzień) + Archiwizacja Sezonu do Historii -->
              <div class="glass-panel rounded-2xl p-5 sm:p-6 border-2 border-amber-400/40">
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div class="lg:col-span-7">
                    <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-display font-bold text-[10px] uppercase">
                      ⏱️ ZARZĄDZANIE TEMPEM LIGI (4 KOLEJKI NA TYDZIEŃ)
                    </span>
                    <h3 class="font-display font-black text-lg text-white uppercase mt-1">
                      Aktywny Tydzień Rozgrywkowy: Tydzień #${(state.weeklyConfig && state.weeklyConfig.currentWeek) || 2}
                    </h3>
                    <p class="text-xs text-slate-300 mt-0.5 mb-3">
                      Przełącz aktywny tydzień (każdy tydzień to 4 kolejki) lub wygeneruj gotowy raport na grupę FB / Messenger jednym kliknięciem:
                    </p>
                    <div class="flex flex-wrap items-center gap-1.5">
                      ${(() => {
                        const rpwAdm = Math.max(1, Number((state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4));
                        let maxRoundAdm = 0;
                        activeAdminLeagues.forEach((lg) => {
                          if (lg && Number(lg.totalRounds || 0) > maxRoundAdm) maxRoundAdm = Number(lg.totalRounds || 0);
                        });
                        (state.matches || []).forEach((mt) => {
                          if (mt && Number(mt.round || 0) > maxRoundAdm) maxRoundAdm = Number(mt.round || 0);
                        });
                        const effMaxRound = maxRoundAdm > 0 ? maxRoundAdm : 15;
                        const wCnt = Math.max(1, Math.ceil(effMaxRound / rpwAdm));
                        const weekArr = [];
                        for (let wi = 1; wi <= wCnt; wi++) weekArr.push(wi);
                        return weekArr
                          .map((w) => {
                            const isCur = ((state.weeklyConfig && state.weeklyConfig.currentWeek) || 1) === w;
                            const r1 = (w - 1) * rpwAdm + 1;
                            const r2 = Math.min(effMaxRound, w * rpwAdm);
                            return `
                              <button onclick="SMPL_APP.handleSetActiveWeek(${w})" class="px-3 py-1.5 rounded-xl text-xs font-display font-bold transition ${
                                isCur ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15'
                              }">
                                Tydz. ${w} (K${r1}–${r2})
                              </button>
                            `;
                          })
                          .join('');
                      })()}
                    </div>
                  </div>

                  <div class="lg:col-span-5 flex flex-col gap-2.5">
                    
                    <button onclick="SMPL_APP.handleBroadcastRoundRelease()" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-display font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2">
                      <span>📢 Puść Kolejkę / Wyślij Powiadomienie PUSH do Graczy</span>
                    </button>
                    <button onclick="SMPL_APP.openMessengerReportModal()" class="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-display font-black text-xs uppercase shadow-lg">
                      📱 Wygeneruj i Skopiuj Raport Tygodnia na Messenger / FB
                    </button>
                    <button onclick="SMPL_APP.openNextSeasonRolloverModal()" class="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase shadow-xl">
                      🚀 Zakończ Sezon ${state.season || 56} i Wystartuj Sezon ${(state.season || 56) + 1} (1-Klik)
                    </button>
                    <button onclick="SMPL_APP.handleArchiveCurrentSeason()" class="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-display font-black text-xs uppercase shadow-lg">
                      📦 Zarchiwizuj Bieżącą Tabelę (Sezon ${state.season || 56}) do Historii
                    </button>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div class="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
                  <h3 class="font-display font-black text-lg text-white uppercase mb-2">
                    🗓️ Automatyczny Generator Terminarza (Algorytm Bergera)
                  </h3>
                  <p class="text-xs text-slate-300 leading-relaxed mb-4">
                    Generuje kompletny terminarz <strong>„Każdy z każdym” (dwumecz w każdej kolejce: u siebie + rewanż od razu pod spodem)</strong> dla wybranej ligi. Dla 16 miejsc w lidze tworzy dokładnie <strong>15 kolejek (po 16 spotkań w kolejce = 240 meczów / 30 na gracza w 4 tygodnie)</strong>, a mecze ze slotami <strong>WOLNY LOS</strong> dostają od razu 2:0 i 0:2 WO.
                  </p>
                  <div class="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/35 flex flex-wrap items-center justify-between gap-2">
                    <div class="text-[11px] text-rose-200">
                      <strong class="uppercase font-display">Reset Terminarza:</strong> Całkowite wyzerowanie meczów i kolejek przed nowym generowaniem (gracze i statystyki S1–S55 zostają).
                    </div>
                    <button onclick="SMPL_APP.adminClearSchedule('ALL')" class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-display font-black uppercase shadow-md transition">
                      🗑️ Wyzeruj Cały Terminarz (Wszystkie Ligi)
                    </button>
                  </div>

                  <div class="space-y-3">
                    ${activeAdminLeagues
                      .map((lObj) => {
                        const lid = lObj.id;
                        const pCount = state.players.filter((p) => p.leagueId === lid && p.active !== false).length;
                        const mCount = state.matches.filter((m) => m.leagueId === lid).length;
                        return `
                          <div class="p-4 rounded-xl bg-slate-950/85 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <div class="font-display font-bold text-white text-sm">${escapeHtml(lObj.name)}</div>
                              <div class="text-xs text-slate-400">Graczy: <strong>${pCount}</strong> • Meczów w bazie: <strong>${mCount}</strong></div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                              <button onclick="SMPL_APP.adminRegenerateSchedule('${lid}', true)" class="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-display font-bold uppercase">
                                🔄 Przelicz (Zachowaj wyniki)
                              </button>
                              <button onclick="SMPL_APP.adminRegenerateSchedule('${lid}', false)" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-display font-bold uppercase border border-white/10">
                                ⚡ Nowy od zera
                              </button>
                              <button onclick="SMPL_APP.adminAddByeSlot('${lid}')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white text-xs font-display font-bold uppercase border border-emerald-500/30" title="Dodaj wolne miejsce WOLNY LOS (2:0/0:2 do czasu przyjęcia gracza)">
                                🤖 + WOLNY LOS
                              </button>
                              <button onclick="SMPL_APP.adminClearSchedule('${lid}')" class="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-600 text-rose-200 hover:text-white text-xs font-display font-bold uppercase border border-rose-500/40" title="Wyzeruj terminarz tylko dla tej ligi">
                                🗑️ Wyzeruj
                              </button>
                            </div>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                </div>

                <!-- Szybkie Walkowery (2:0 WO / 0:2 WO) i Ręczne Wpisywanie Wyników -->
                <div class="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 class="font-display font-black text-lg text-white uppercase">
                      ⚡ Szybkie Walkowery (2:0 WO) i Wyniki Ręczne (${escapeHtml((state.leagues[activeLeagueId] && state.leagues[activeLeagueId].shortName) || activeLeagueId)})
                    </h3>
                    <div class="flex flex-wrap items-center gap-1">
                      ${activeAdminLeagues
                        .map(
                          (lg) => `<button type="button" onclick="SMPL_APP.setAdminLeagueQuick('${escapeHtml(lg.id)}')" class="px-2.5 py-1 rounded-lg text-[10px] font-display font-bold uppercase transition ${
                            lg.id === activeLeagueId ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15 hover:bg-slate-800'
                          }">${escapeHtml(lg.shortName || lg.id)}</button>`
                        )
                        .join('')}
                    </div>
                  </div>
                  <p class="text-xs text-slate-300 mb-4">
                    Przyznaj walkower jednym kliknięciem lub wpisz wynik ręcznie dla dowolnego meczu wybranej ligi.
                  </p>

                  <div class="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    ${state.matches
                      .filter((m) => m.leagueId === activeLeagueId && m.round <= 8)
                      .slice(0, 20)
                      .map((m) => {
                        const hp = playersMap[m.homeId];
                        const ap = playersMap[m.awayId];
                        const propsForMatch = (state.competitions && Array.isArray(state.competitions.matchProposals) ? state.competitions.matchProposals : []).filter((pr) => pr && pr.matchId === m.id);
                        const latestPr = propsForMatch[0] || null;
                        return `
                          <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div class="min-w-0">
                              <span class="font-display font-bold text-league-primary">K${m.round}:</span>
                              <span class="text-white font-semibold ml-1">${escapeHtml(hp ? hp.name : '')} vs ${escapeHtml(ap ? ap.name : '')}</span>
                              <span class="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-slate-200 font-bold">
                                ${m.homeScore !== null ? `${m.homeScore}:${m.awayScore}` : 'vs'} (${m.status})
                              </span>
                              <div class="text-[11px] mt-1 ${latestPr ? 'text-emerald-300' : 'text-slate-400'}">
                                ${
                                  latestPr
                                    ? `📅 Dowód „Kiedy Gramy?”: <strong>${escapeHtml(latestPr.proposerName || '')}</strong> zaproponował ${escapeHtml((latestPr.proposedSlots || []).join(', '))} [${escapeHtml(latestPr.status || 'PROPOSED')}${latestPr.chosenSlot ? ': ' + escapeHtml(latestPr.chosenSlot) : ''}]`
                                    : '⚠️ Brak propozycji terminu („Kiedy Gramy?”) w systemie.'
                                }
                              </div>
                            </div>
                            <div class="flex items-center gap-1.5">
                              <button onclick="SMPL_APP.adminQuickWalkover('${m.id}', 'HOME_WIN')" class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 font-bold">
                                2:0 WO
                              </button>
                              <button onclick="SMPL_APP.adminQuickWalkover('${m.id}', 'AWAY_WIN')" class="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 font-bold">
                                0:2 WO
                              </button>
                              <button onclick="SMPL_APP.openAdminEditMatchModal('${m.id}')" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white border border-white/15 font-semibold">
                                ✏️ Wynik
                              </button>
                            </div>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                </div>
              </div>

              <!-- MINI-LIGA TESTOWA UAT (5 TESTERÓW) -->
              <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-400/40 bg-emerald-950/15 mt-6">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div class="space-y-1">
                    <div class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-display font-black text-[10px] uppercase tracking-wider">
                      🧪 SANDBOX TESTERÓW UAT (5 OSÓB)
                    </div>
                    <h3 class="font-display font-black text-base sm:text-lg text-white uppercase">
                      Krótka 5-Osobowa Liga Testowa (Szymon, Kacper, Adrian, Grzegorz, Krystian)
                    </h3>
                    <p class="text-xs text-slate-300 leading-relaxed max-w-3xl">
                      Tworzy w wybranej lidze bezpieczne konta testowe <code>@uat_...</code> dla całej piątki testerów oraz pełny terminarz dwumeczów (20 spotkań, 5 kolejek dwumeczowych) do sprawdzenia zgłaszania wyników, screenów, statystyk i sporów VAR (+SS). Prawdziwe konta i archiwum pozostają nietknięte — jednym kliknięciem posprzątasz po testach!
                    </p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button type="button" onclick="SMPL_APP.handleSetupUatMiniLeague('L3', true)" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                      🚀 Uruchom Mini-Ligę w 3. Lidze (L3)
                    </button>
                    <button type="button" onclick="SMPL_APP.handleCleanupUatMiniLeague()" class="px-3.5 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-800 text-rose-200 border border-rose-500/40 font-display font-bold text-xs uppercase transition">
                      🧹 Usuń Dane Testowe UAT
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `
          : ''
      }

      ${
        currentTab === 'changelog'
          ? `
            <!-- 4. CHANGELOG DO WYSŁANIA NA MESSENGER ADMINÓW -->
            <div class="glass-panel rounded-3xl p-6 sm:p-8 border-2 border-emerald-400/50">
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 mb-5 border-b border-white/10">
                <div>
                  <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-display font-bold text-xs uppercase">
                    📋 ŚCIĄGA DLA ZARZĄDU I WSPÓŁADMINISTRATORÓW SMPL
                  </span>
                  <h3 class="font-display font-black text-xl sm:text-2xl text-white uppercase mt-2">
                    Changelog Wszystkich Zmian („Jak dla debila” — krok po kroku)
                  </h3>
                  <p class="text-xs text-slate-300 mt-1">
                    Kliknij zielony przycisk po prawej, aby skopiować cały ten tekst jednym kliknięciem i wkleić go chłopakom na grupę Administracji na Messengerze!
                  </p>
                </div>
                <button onclick="SMPL_APP.copyAdminChangelog()" class="px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-xl flex-shrink-0">
                  📋 Skopiuj Changelog na Messenger Adminów
                </button>
              </div>

              <pre id="admin-changelog-pre" class="p-5 rounded-2xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed overflow-x-auto">${escapeHtml(
                (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.ADMIN_CHANGELOG_SIMPLE) || ''
              )}</pre>
            </div>
          `
          : ''
      }

      ${
        currentTab === 'ai_vanessa'
          ? renderAiVanessaSubTab(state, session)
          : ''
      }

      ${
        (currentTab === 'master_studio' ||
          currentTab === 'master_ranks' ||
          currentTab === 'master_leagues' ||
          currentTab === 'master_backup') &&
        isMasterOwner
          ? renderMasterStudioSubTab(state, session, currentTab, opts)
          : ''
      }

      ${
        currentTab === 'settings'
          ? renderSettingsSubTab(state, activeAdminLeagues, allAdminLeagues, session, myAdminAcc, isMasterOwner, opts)
          : ''
      }
    `;
  }

  // =========================================================================
  // 8. PEŁNOEKRANOWY ETAP POWITALNY: LOGOWANIE, REJESTRACJA LUB WEJŚCIE GOŚCIA
  // =========================================================================
  function renderFullScreenAuthGate(state, gateMode = 'login', gateRegState = {}, session = {}) {
    const activeGateTab = gateMode || 'login';
    const activeGateLeagues = getLeaguesSafe(state, false);

    const avatarPreview =
      gateRegState.avatarPreview ||
      window.SMPL_MEDIA.generatePlayerAvatar('Nowy Gracz', 'Zawodnik', 95);

    return `
      <div class="smpl-auth-shell w-full max-w-3xl mx-auto my-auto py-3 sm:py-6">
        <!-- Brand Header & Herby Aktywnych Lig (Royal Compact Above-The-Fold) -->
        <div class="text-center mb-4 sm:mb-5">
          <div class="smpl-auth-crest-stage mb-2.5 sm:mb-3 max-w-full">
            <img src="css/icon-192.png" class="smpl-auth-crest-main" alt="Score Match Liga"/>
            ${activeGateLeagues
              .map((lg) => {
                const crestUrl = getLeagueCrestSafe(state, lg);
                return `<img src="${crestUrl}" class="smpl-auth-crest-medallion" alt="${escapeHtml(lg.shortName || lg.name)}"/>`;
              })
              .join('')}
          </div>

          <div class="block max-w-full">
            <div class="inline-flex flex-wrap items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/45 text-emerald-300 font-display font-black text-[10px] sm:text-[11px] uppercase tracking-wider mb-1.5 shadow-lg max-w-full text-center">
              <span class="smpl-live-beacon-dot"></span>
              <span>SCORE MATCH LIGA • SEZON ${state.season || 56} • OFICJALNY PORTAL</span>
            </div>
          </div>
          <h1 class="font-display font-black text-xl sm:text-3xl text-white uppercase tracking-tight leading-tight px-1">
            Centrum Dostępu i Kont Graczy
          </h1>
          <p class="hidden sm:block text-xs sm:text-sm text-slate-300 mt-1 max-w-xl mx-auto leading-relaxed">
            ${isClansUiEnabledSafe(state)
              ? 'Zaloguj się na swoje konto zawodnika lub zarejestruj do Score Match Ligi — wybierz klan, odbierz Kartę UT i walcz o mistrzostwo!'
              : 'Zaloguj się na swoje konto zawodnika lub zarejestruj do Score Match Ligi — odbierz Kartę UT i walcz o mistrzostwo!'}
          </p>
          <div class="hidden sm:flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
            <span class="smpl-feature-pill text-[10px] font-display font-bold text-amber-300 uppercase">🏆 Tabele &amp; Mecze Live</span>
            ${isClansUiEnabledSafe(state)
              ? '<span class="smpl-feature-pill text-[10px] font-display font-bold text-emerald-300 uppercase">🛡️ Klany &amp; Loga</span>'
              : '<span class="smpl-feature-pill text-[10px] font-display font-bold text-emerald-300 uppercase">⚔️ Ranking H2H &amp; ELO</span>'}
            <span class="smpl-feature-pill text-[10px] font-display font-bold text-blue-300 uppercase">🎴 Karty UT &amp; Złota Piłka</span>
            <span class="smpl-feature-pill text-[10px] font-display font-bold text-pink-300 uppercase">✨ Vanessa AI</span>
          </div>
          ${(function () {
            const cdCfg =
              window.SMPL_DB && typeof window.SMPL_DB.getSeasonCountdownConfig === 'function'
                ? window.SMPL_DB.getSeasonCountdownConfig(state)
                : (state && state.portalSettings && state.portalSettings.seasonCountdown) || null;
            if (!cdCfg || !cdCfg.enabled) return '';
            return `
              <div id="smpl-auth-gate-countdown" class="smpl-cd-gate-strip mt-3 max-w-xl mx-auto rounded-2xl px-3.5 py-2.5 text-left">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="smpl-live-beacon-dot flex-shrink-0"></span>
                    <div class="min-w-0">
                      <div class="font-display font-black text-[10px] sm:text-[11px] uppercase tracking-wider text-amber-300 truncate">
                        🏆 ${escapeHtml(cdCfg.title || ('WIELKI START SEZONU ' + (cdCfg.season || 56)))}
                      </div>
                      <div class="text-[10px] text-slate-300 font-semibold truncate" data-smpl-cd-gate-date>
                        Start: ${escapeHtml(cdCfg.targetDate)} • ${escapeHtml(cdCfg.targetTime)} (CET)
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 font-display font-black text-xs sm:text-sm text-white tabular-nums" data-smpl-cd-gate-clock>
                    <span class="smpl-cd-gate-chip"><b data-smpl-cd-d>--</b><small>d</small></span>
                    <span class="smpl-cd-gate-chip"><b data-smpl-cd-h>--</b><small>g</small></span>
                    <span class="smpl-cd-gate-chip"><b data-smpl-cd-m>--</b><small>m</small></span>
                    <span class="smpl-cd-gate-chip smpl-cd-gate-sec"><b data-smpl-cd-s>--</b><small>s</small></span>
                  </div>
                </div>
              </div>
            `;
          })()}
        </div>

        <!-- 3 Przyciski Wyboru Trybu Wejścia (Zawsze 1 wiersz — również na smartfonie!) -->
        <div class="smpl-auth-mode-bar glass-panel rounded-2xl p-1.5 mb-3.5 sm:mb-4 max-w-xl mx-auto grid grid-cols-3 gap-1.5 border border-white/15">
          <button
            type="button"
            onclick="SMPL_APP.setGateMode('login')"
            class="py-2.5 px-2 sm:px-4 rounded-xl font-display font-black text-[11px] sm:text-xs uppercase tracking-wide transition flex items-center justify-center gap-1.5 min-w-0 ${
              activeGateTab === 'login'
                ? 'btn-league shadow-xl'
                : 'bg-slate-900/75 hover:bg-slate-800 text-slate-300'
            }"
          >
            <span class="truncate">🔑 <span class="sm:hidden">Loguj</span><span class="hidden sm:inline">1. Zaloguj się</span></span>
          </button>
          <button
            type="button"
            onclick="SMPL_APP.setGateMode('register')"
            class="py-2.5 px-2 sm:px-4 rounded-xl font-display font-black text-[11px] sm:text-xs uppercase tracking-wide transition flex items-center justify-center gap-1.5 min-w-0 ${
              activeGateTab === 'register'
                ? 'btn-league shadow-xl'
                : 'bg-slate-900/75 hover:bg-slate-800 text-slate-300'
            }"
          >
            <span class="truncate">📝 <span class="sm:hidden">Zapisy</span><span class="hidden sm:inline">2. Rejestracja</span></span>
          </button>
          <button
            type="button"
            onclick="SMPL_APP.setGateMode('guest')"
            class="py-2.5 px-2 sm:px-4 rounded-xl font-display font-black text-[11px] sm:text-xs uppercase tracking-wide transition flex items-center justify-center gap-1.5 min-w-0 ${
              activeGateTab === 'guest'
                ? 'btn-league shadow-xl'
                : 'bg-slate-900/75 hover:bg-slate-800 text-slate-300'
            }"
          >
            <span class="truncate">👁️ <span class="sm:hidden">Gość</span><span class="hidden sm:inline">3. Tryb Gościa</span></span>
          </button>
        </div>

        <!-- MODUŁ 1: LOGOWANIE DO KONTA GRACZA -->
        ${
          activeGateTab === 'login'
            ? `
              <div class="glass-panel-league auth-card-login-pro rounded-3xl p-4 sm:p-6 max-w-xl mx-auto border border-league shadow-2xl">
                <div class="flex items-center gap-3 pb-3 mb-4 border-b border-white/10">
                  <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-lg flex-shrink-0">
                    🔑
                  </div>
                  <div class="min-w-0">
                    <h3 class="font-display font-black text-base sm:text-lg text-white uppercase leading-tight">Logowanie do Konta Gracza</h3>
                    <p class="text-[11px] sm:text-xs text-slate-300">Wpisz swój login, nick lub imię i nazwisko:</p>
                  </div>
                </div>

                <div class="space-y-3.5 mb-4">
                  <div>
                    <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">
                      👤 Twój Login lub Nick w grze *
                    </label>
                    <input
                      id="gate-login-id"
                      type="text"
                      autocomplete="username"
                      placeholder="Wpisz swój indywidualny login lub nick..."
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-sm text-white font-semibold focus:outline-none focus:border-league"
                      onkeydown="if(event.key==='Enter') SMPL_APP.handleGateLoginSubmit()"
                    />
                  </div>

                  <div>
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <label class="block text-[11px] font-display uppercase text-slate-300 font-bold">
                        🔒 Hasło do konta *
                      </label>
                      <button type="button" onclick="SMPL_APP.openPasswordReminderModal()" class="smpl-inline-touch-link text-xs text-amber-300 hover:underline font-semibold">
                        Zapomniałeś hasła?
                      </button>
                    </div>
                    <input
                      id="gate-login-pass"
                      type="password"
                      autocomplete="current-password"
                      placeholder="Wpisz swoje prywatne hasło..."
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-sm text-white font-semibold focus:outline-none focus:border-league"
                      onkeydown="if(event.key==='Enter') SMPL_APP.handleGateLoginSubmit()"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onclick="SMPL_APP.handleGateLoginSubmit()"
                  class="btn-league w-full py-3.5 px-5 rounded-2xl font-display font-black text-xs sm:text-sm uppercase tracking-wider shadow-2xl flex items-center justify-center gap-2 transition"
                >
                  <span>🚀 Zaloguj się i Przejdź do Portalu</span>
                </button>

                <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-3 mt-3.5 border-t border-white/10">
                  <button type="button" onclick="SMPL_APP.setGateMode('register')" class="smpl-inline-touch-link text-emerald-400 hover:text-white font-bold">
                    📝 Nie masz konta? Załóż w 1 min
                  </button>
                  <button type="button" onclick="SMPL_APP.handleGateGuestEnter()" class="smpl-inline-touch-link text-blue-300 hover:text-white font-bold">
                    👁️ Wejdź jako Gość →
                  </button>
                </div>
              </div>
            `
            : ''
        }

        <!-- MODUŁ 2: REJESTRACJA NOWEGO GRACZA -->
        ${
          activeGateTab === 'register'
            ? `
              <div class="glass-panel auth-card-pro rounded-3xl p-5 sm:p-8 max-w-2xl mx-auto shadow-2xl">
                <div class="reg-showcase-banner rounded-2xl p-4 sm:p-5 mb-5 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-xl flex-shrink-0">
                      📝
                    </div>
                    <div>
                      <h3 class="font-display font-black text-base sm:text-lg text-white uppercase">Rejestracja Konta Gracza — Score Match Liga</h3>
                      <p class="text-xs text-slate-200">${isClansUiEnabledSafe(state) ? 'Dołącz do ligi, wybierz lub dodaj swój klan z własnym logo i ustaw prywatne hasło:' : 'Dołącz do ligi, uzupełnij swój profil gracza i ustaw prywatne hasło:'}</p>
                    </div>
                  </div>
                </div>

                <div class="space-y-4 mb-6">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-display uppercase text-slate-300 font-bold mb-1">
                        Imię i Nazwisko *
                      </label>
                      <input
                        id="gate-reg-name"
                        type="text"
                        value="${escapeHtml(gateRegState.name || '')}"
                        oninput="SMPL_APP.updateGateField('name', this.value)"
                        placeholder="Wpisz swoje imię i nazwisko"
                        class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-display uppercase text-slate-300 font-bold mb-1">
                        Nick w grze Score! Match *
                      </label>
                      <input
                        id="gate-reg-nick"
                        type="text"
                        value="${escapeHtml(gateRegState.nick || '')}"
                        oninput="SMPL_APP.updateGateField('nick', this.value)"
                        placeholder="Twój nick w grze"
                        class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-display uppercase text-slate-300 font-bold mb-1">
                        Preferowana Liga
                      </label>
                      <select id="gate-reg-league" onchange="SMPL_APP.updateGateField('leagueId', this.value)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-bold">
                        ${activeGateLeagues
                          .map(
                            (lg) => `<option value="${escapeHtml(lg.id)}" ${(gateRegState.leagueId || 'L2') === lg.id ? 'selected' : ''}>${escapeHtml(lg.name)} (${escapeHtml(lg.id)})</option>`
                          )
                          .join('')}
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-display uppercase text-slate-300 font-bold mb-1">
                        Ustaw prywatne hasło (min. 4 znaki) *
                      </label>
                      <input
                        id="gate-reg-pass"
                        type="password"
                        value="${escapeHtml(gateRegState.password || '')}"
                        oninput="SMPL_APP.updateGateField('password', this.value)"
                        placeholder="Minimum 4 znaki (Twoje prywatne hasło)"
                        class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-display uppercase text-slate-300 font-bold mb-1">
                      Link do profilu Messenger / Facebook (do kontaktu z rywalami) *
                    </label>
                    <input
                      id="gate-reg-fb"
                      type="text"
                      value="${escapeHtml(gateRegState.fbLink || '')}"
                      oninput="SMPL_APP.updateGateField('fbLink', this.value)"
                      placeholder="https://m.me/twoj.profil"
                      class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                    />
                  </div>

                  ${renderClanSelectorHtml('gate-reg', 'gate', state, gateRegState)}

            <!-- Upload Zdjęcia Profilowego (Awatar) -->
                  <div class="p-3.5 rounded-2xl bg-slate-950 border border-white/10 flex flex-col sm:flex-row items-center gap-4">
                    <img id="gate-reg-avatar-img" src="${avatarPreview}" class="w-16 h-16 rounded-full object-cover border-2 border-league flex-shrink-0" alt=""/>
                    <div class="text-center sm:text-left flex-1">
                      <div class="text-[11px] font-display uppercase font-bold text-slate-300 mb-1">Zdjęcie profilowe / Awatar (opcjonalne)</div>
                      <p class="text-[11px] text-slate-400 mb-2">Składy z gry pozostają prywatne i nie są wymagane ani udostępniane.</p>
                      <label class="inline-block py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer border border-white/15">
                        📷 Wybierz zdjęcie
                        <input type="file" accept="image/*" class="hidden" onchange="SMPL_APP.handleGateAvatarUpload(event)"/>
                      </label>
                    </div>
                  </div>

                  <!-- Grałeś kiedyś wcześniej (S1–S55)? Checkbox + Wybór z listy -->
                  <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/40">
                    <label class="flex items-start gap-2.5 cursor-pointer">
                      <input
                        id="gate-reg-played-before"
                        type="checkbox"
                        ${gateRegState.playedBefore ? 'checked' : ''}
                        onchange="SMPL_APP.toggleGatePlayedBefore(this.checked)"
                        class="mt-0.5 w-4 h-4 rounded accent-amber-400 cursor-pointer flex-shrink-0"
                      />
                      <span class="text-xs text-amber-100 leading-snug">
                        <strong class="text-amber-300 uppercase font-display">🏛️ Grałem już wcześniej w lidze (Sezony 1–55)</strong><br/>
                        <span class="text-[11px] text-slate-300">Zaznacz ptaszek i wybierz swoje imię i nazwisko z listy, aby odzyskać pełną historię na swoim profilu!</span>
                      </span>
                    </label>
                    <div id="gate-reg-hist-picker-wrap" class="${gateRegState.playedBefore ? '' : 'hidden'} mt-3 pt-3 border-t border-amber-400/25 space-y-2">
                      <input
                        type="text"
                        id="gate-reg-hist-filter"
                        placeholder="🔍 Wpisz imię lub nazwisko, aby przefiltrować listę (S1–S55)..."
                        oninput="SMPL_APP.filterHistSelect('gate-reg-hist-select', this.value, 'gate')"
                        class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                      <select
                        id="gate-reg-hist-select"
                        onchange="SMPL_APP.onGateHistSelect(this.value)"
                        class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white font-bold"
                      >
                        <option value="">-- Wybierz swoje Imię i Nazwisko z archiwum S1–S55 --</option>
                        ${buildHistoricalSelectOptionsHtml(state, gateRegState.linkedHistoricalName || '', '')}
                      </select>
                    </div>
                  </div>

                  <!-- Zgody i Checkboxy (Świadoma, Niedomyślna Zgoda wg RODO Art. 7) -->
                  <div class="space-y-2 pt-2 text-xs text-slate-300">
                    <div class="flex items-center justify-between gap-2 pb-1">
                      <span class="text-[11px] font-bold text-amber-300">⚖️ Zaznacz oba wymagane oświadczenia:</span>
                      <button type="button" onclick="SMPL_APP.openLegalSummaryModal()" class="text-[11px] text-emerald-300 hover:text-white underline font-bold">
                        📖 Czytaj Regulamin i RODO
                      </button>
                    </div>
                    <label class="flex items-start gap-2.5 cursor-pointer">
                      <input id="gate-reg-rules-check" type="checkbox" class="mt-0.5 w-4 h-4 rounded text-emerald-500"/>
                      <span>Akceptuję <strong>Regulamin Rozgrywek SMPL (SMPL-REG-2026.1)</strong> — 4 kolejki/tydzień, Gospodarz zaprasza Gościa, reguła 48h oraz 7-dniowe odwołania.</span>
                    </label>
                    <label class="flex items-start gap-2.5 cursor-pointer">
                      <input id="gate-reg-gdpr-check" type="checkbox" class="mt-0.5 w-4 h-4 rounded text-emerald-500"/>
                      <span><strong>RODO &amp; Wiek 16+:</strong> Ukończyłem 16 lat (lub mam zgodę opiekuna). Akceptuję zasady prawne (0 zł / brak hazardu / AS IS / DSA) i wyrażam zgodę na wyświetlanie nicku, awatara i kontaktu FB w portalu (z prawem usunięcia w Art. 17 RODO).</span>
                    </label>
                  </div>
                </div>

                <button
                  onclick="SMPL_APP.handleGateRegistrationSubmit()"
                  class="btn-league w-full py-4 px-6 rounded-2xl font-display font-black text-sm uppercase tracking-wider shadow-2xl flex items-center justify-center gap-2 hover:scale-[1.01] transition"
                >
                  <span>📝 Zarejestruj Konto i Wyślij Zgłoszenie</span>
                </button>

                <div class="flex items-center justify-center gap-2 pt-4 mt-4 border-t border-white/10 text-xs">
                  <span class="text-slate-400">Masz już konto?</span>
                  <button onclick="SMPL_APP.setGateMode('login')" class="text-amber-300 hover:underline font-bold">
                    Zaloguj się tutaj →
                  </button>
                </div>
              </div>
            `
            : ''
        }

        <!-- MODUŁ 3: WEJŚCIE W TRYBIE GOŚCIA (TYLKO PODGLĄD TABEL) -->
        ${
          activeGateTab === 'guest'
            ? `
              <div class="glass-panel rounded-3xl p-6 sm:p-8 max-w-xl mx-auto border border-blue-500/40 text-center shadow-2xl">
                <div class="w-16 h-16 rounded-3xl bg-blue-500/20 border-2 border-blue-400/50 flex items-center justify-center text-3xl mx-auto mb-4">
                  👁️
                </div>
                <h3 class="font-display font-black text-xl text-white uppercase">Przeglądaj Portal jako Gość / Kibic</h3>
                <p class="text-xs sm:text-sm text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
                  Nie potrzebujesz konta, aby sprawdzić <strong>tabele ligowe na żywo</strong>, ranking <strong>„Żelazna Kurtyna” (Czyste Konta)</strong>, terminarz 30 kolejek oraz <strong>Archiwum Sezonów 1–55</strong>!
                </p>

                <div class="my-6 p-4 rounded-2xl bg-slate-950/80 border border-white/10 text-left text-xs space-y-2 text-slate-300">
                  <div class="flex items-center gap-2 text-emerald-400 font-bold">
                    <span>✓</span> <span>Dostęp do tabel aktywnych lig (${escapeHtml(activeGateLeagues.map((lg) => lg.shortName || lg.id).join(', '))})</span>
                  </div>
                  <div class="flex items-center gap-2 text-emerald-400 font-bold">
                    <span>✓</span> <span>Karty Ultimate Team (OVR) i Gabloty Trofeów</span>
                  </div>
                  <div class="flex items-center gap-2 text-emerald-400 font-bold">
                    <span>✓</span> <span>Porównywarka rywali Head-to-Head (H2H)</span>
                  </div>
                  <div class="flex items-center gap-2 text-amber-300 font-semibold">
                    <span>ℹ️</span> <span>Wpisywanie wyników meczów wymaga zalogowania na konto gracza</span>
                  </div>
                </div>

                <button
                  onclick="SMPL_APP.handleGateGuestEnter()"
                  class="btn-league w-full py-4 px-6 rounded-2xl font-display font-black text-sm uppercase tracking-wider shadow-2xl flex items-center justify-center gap-2 hover:scale-[1.01] transition"
                >
                  <span>👁️ Wejdź do Portalu jako Gość</span>
                </button>

                <button onclick="SMPL_APP.setGateMode('login')" class="text-xs text-slate-400 hover:text-white underline mt-4 block mx-auto">
                  ← Wróć do ekranu logowania gracza
                </button>
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  

  // =========================================================================
  // TRYBUNAŁ DYSCYPLINARNY SMPL & SPORY VAR / W.O. (+SS)
  // =========================================================================

  // --- CZARNA LISTA • DOŻYWOTNI BAN (ADMIN SUBTAB) ---
  function renderBlacklistSubTab(state, session) {
    const blacklist = state.blacklist || [];
    const activePlayers = (state.players || []).filter((p) => p.active !== false);

    const playerOptions = activePlayers.map((p) =>
      `<option value="${p.id}">[${p.leagueId}] ${escapeHtml(p.name)} (@${escapeHtml(p.nick)})</option>`
    ).join('');

    return `
      <div class="space-y-6">
        <!-- Baner Nagłówkowy Czarnej Listy -->
        <div class="glass-panel rounded-3xl p-5 sm:p-7 border-2 border-rose-600/70 bg-gradient-to-r from-rose-950/60 via-slate-950 to-slate-950 shadow-2xl relative overflow-hidden">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-rose-600/20 border-2 border-rose-500 flex items-center justify-center text-3xl shadow-xl shadow-rose-900/50">
                💀
              </div>
              <div>
                <span class="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-display font-black text-xs uppercase tracking-wider">
                  DOŻYWOTNI BAN • PERSONA NON GRATA
                </span>
                <h2 class="font-display font-black text-xl sm:text-3xl text-white uppercase mt-1">
                  Oficjalna Czarna Lista Score Match Ligi
                </h2>
                <p class="text-xs sm:text-sm text-rose-200/80 mt-1 max-w-2xl">
                  Rejestr osób bezwzględnie i trwale wykluczonych ze wszystkich sezonów i dywizji (${escapeHtml(getLeaguesSafe(state, false).map((lg) => lg.shortName || lg.id).join(', '))}). Osoby z tej listy mają zablokowane logowanie i rejestrację.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="px-4 py-2 rounded-xl bg-slate-900/90 border border-rose-500/40 text-xs font-display font-bold text-rose-300">
                Aktywne Dożywotnie Bany: <strong class="text-white text-sm ml-1">${blacklist.length}</strong>
              </span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Formularz Dodania do Czarnej Listy -->
          <div class="lg:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 border border-rose-500/40 bg-slate-950/90">
            <h3 class="font-display font-black text-base sm:text-lg text-white uppercase pb-3 border-b border-white/10 flex items-center gap-2">
              <span>💀 Dodaj Gracza do Czarnej Listy</span>
            </h3>
            <p class="text-xs text-slate-300 mt-2 mb-4">
              Wybierz zawodnika z obecnych kadr ligi lub wpisz nowe dane. Gracz natychmiast otrzyma status <strong>DOŻYWOTNI BAN</strong> i zostanie usunięty z aktywnych rozgrywek.
            </p>

            <form onsubmit="SMPL_APP.handleAddToBlacklist(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-display uppercase font-bold text-slate-300 mb-1">Wybierz z aktywnych graczy (opcjonalnie)</label>
                <select id="bl-select-player" onchange="SMPL_APP.fillBlacklistFromSelect(this.value)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white">
                  <option value="">-- Wybierz gracza z aktywnych lig (${escapeHtml(getLeaguesSafe(state, false).map((lg) => lg.id).join('/'))}) --</option>
                  ${playerOptions}
                </select>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-display uppercase font-bold text-slate-300 mb-1">Imię i Nazwisko *</label>
                  <input type="text" id="bl-input-name" required placeholder="np. Jan Kowalski" class="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white" />
                </div>
                <div>
                  <label class="block text-xs font-display uppercase font-bold text-slate-300 mb-1">Nick w Score! Match</label>
                  <input type="text" id="bl-input-nick" placeholder="np. lagmaster99" class="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-display uppercase font-bold text-slate-300 mb-1">Profil Facebook / Messenger (opcjonalnie)</label>
                <input type="text" id="bl-input-fb" placeholder="https://facebook.com/..." class="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white" />
              </div>

              <div>
                <label class="block text-xs font-display uppercase font-bold text-slate-300 mb-1">Kategoria Przewinienia</label>
                <select id="bl-select-category" onchange="SMPL_APP.presetBlacklistReason(this.value)" class="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white">
                  <option value="LAG_SWITCH">Lag-switching / Celowe rozłączanie meczu</option>
                  <option value="SCREEN_FORGERY">Fałszowanie zrzutów ekranu i wyników</option>
                  <option value="AGGRESSION">Agresja, wulgaryzmy i groźby wobec graczy/Zarządu</option>
                  <option value="MULTI_ACC">Multikonta / Omijanie kar dyscyplinarnych</option>
                  <option value="OTHER">Inne rażące złamanie regulaminu</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-display uppercase font-bold text-slate-300 mb-1">Szczegółowe Uzasadnienie Wyroku *</label>
                <textarea id="bl-input-reason" rows="3" required placeholder="Opisz dokładnie okoliczności bana..." class="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white"></textarea>
              </div>

              <button type="submit" class="w-full py-3 rounded-xl bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 hover:from-rose-600 hover:to-red-600 text-white font-display font-black text-xs uppercase tracking-wider shadow-xl transition flex items-center justify-center gap-2">
                <span>💀 NADAJ DOŻYWOTNI BAN I WYKLUCZ NA ZAWSZE</span>
              </button>
            </form>
          </div>

          <!-- Lista Aktualnie Wykluczonych Graczy -->
          <div class="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 bg-slate-950/90">
            <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <h3 class="font-display font-black text-base sm:text-lg text-white uppercase flex items-center gap-2">
                <span>💀 Osoby na Czarnej Liście (${blacklist.length})</span>
              </h3>
              <span class="text-[11px] text-rose-400 font-semibold">Zakaz wstępu: DOŻYWOTNI</span>
            </div>

            ${
              blacklist.length === 0
                ? `<div class="p-8 rounded-xl bg-slate-900/60 text-center text-slate-400 text-xs">
                     Brak osób na Czarnej Liście.
                   </div>`
                : `<div class="space-y-3">
                     ${blacklist.map((b) => `
                       <div class="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <div class="flex items-center gap-3 min-w-0">
                           <div class="relative shrink-0">
                             <img src="${escapeHtml(b.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}" class="w-12 h-12 rounded-full object-cover rk-ring-blacklisted" alt="Banned" />
                             <span class="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black">💀</span>
                           </div>
                           <div class="min-w-0">
                             <div class="flex items-center gap-2 flex-wrap">
                               <strong class="font-display font-black text-sm text-white rk-name-blacklisted truncate">${escapeHtml(b.name)}</strong>
                               ${b.nick ? `<span class="text-xs text-rose-300 font-bold">(@${escapeHtml(b.nick)})</span>` : ''}
                               <span class="px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] font-black uppercase">DOŻYWOTNI BAN</span>
                             </div>
                             <div class="text-[11px] text-slate-400 mt-0.5">
                               Wyrok wydał: <strong class="text-slate-200">${escapeHtml(b.bannedBy || 'Szymon Komenda')}</strong> • Data: ${escapeHtml(b.bannedAt || '')}
                             </div>
                             <div class="mt-2 p-2.5 rounded-lg bg-black/60 border border-rose-500/30 text-xs text-rose-200 italic">
                               „${escapeHtml(b.reason || 'Brak opisu.')}”
                             </div>
                             ${b.fbProfile ? `<div class="mt-1 text-[11px] text-blue-400"><a href="${escapeHtml(b.fbProfile)}" target="_blank" class="underline">Profil FB/Messenger</a></div>` : ''}
                           </div>
                         </div>

                         <div class="shrink-0 flex items-center justify-end">
                           <button onclick="SMPL_APP.handleRemoveFromBlacklist('${b.id}')" class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/20 text-xs font-bold transition" title="Zdejmij gracza z Czarnej Listy">
                             🔓 Ułaskaw
                           </button>
                         </div>
                       </div>
                     `).join('')}
                   </div>`
            }
          </div>
        </div>
      </div>
    `;
  }
  function renderTribunalSubTab(state, session) {
    const pendingDisputes = ((state.competitions && Array.isArray(state.competitions.matchDisputes)) ? state.competitions.matchDisputes : []).filter((d) => d && d.status === 'PENDING');
    const disciplinaryLog = state.disciplinaryLog || [];

    const penalizedPlayers = (state.players || []).filter(
      (p) => (Number(p.penaltyPoints) > 0 || Number(p.yellowCards) > 0 || Number(p.redCards) > 0 || p.isSuspended) && p.active !== false
    );

    const playerOptions = (state.players || [])
      .filter((p) => p.active !== false)
      .map(
        (p) =>
          `<option value="${p.id}">[${p.leagueId}] ${escapeHtml(p.name)} (@${escapeHtml(p.nick)})</option>`
      )
      .join('');

    return `
      <div class="space-y-6">
        <!-- Nagłówek Trybunału -->
        <div class="glass-panel-league rounded-2xl p-5 sm:p-6 border-l-4 border-rose-500">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div class="inline-flex items-center gap-2 mb-1.5">
                <span class="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-display font-black text-xs uppercase tracking-wider">
                  ⚖️ KOMISJA DYSCYPLINARNA &amp; SPORY VAR / W.O.
                </span>
                ${
                  pendingDisputes.length > 0
                    ? `<span class="px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black text-xs animate-pulse">
                         ${pendingDisputes.length} OTWARTYCH SPORÓW VAR
                       </span>`
                    : `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                         Czysto • 0 otwartych sporów VAR
                       </span>`
                }
              </div>
              <h2 class="font-display font-black text-xl sm:text-2xl text-white uppercase mt-1">
                Trybunał Dyscyplinarny SMPL — Spory VAR (+SS), Kary Punktowe i Kartki
              </h2>
              <p class="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Każdy spór VAR i wniosek o walkower (W.O.) zawiera obowiązkowy zrzut ekranu (SS dlaczego) do weryfikacji przez Zarząd.
                Jako Zarząd decydujecie: <strong>ile punktów ujemnych (-1, -3 pkt)</strong> odjąć w tabeli, czy przyznać <strong>żółtą (🟨)</strong> lub <strong>czerwoną (🟥) kartkę</strong>, czy przyznać W.O. bądź zawiesić zawodnika!
              </p>
            </div>

            <!-- KPI Statystyki Dyscypliny -->
            <div class="flex flex-wrap items-center gap-3">
              <div class="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-center min-w-[90px]">
                <div class="text-[10px] uppercase font-bold text-slate-400">Spory VAR</div>
                <div class="font-display font-black text-xl text-rose-400 mt-0.5">${pendingDisputes.length}</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-center min-w-[90px]">
                <div class="text-[10px] uppercase font-bold text-slate-400">Ukarani</div>
                <div class="font-display font-black text-xl text-amber-400 mt-0.5">${penalizedPlayers.length}</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-center min-w-[90px]">
                <div class="text-[10px] uppercase font-bold text-slate-400">Zawieszenia</div>
                <div class="font-display font-black text-xl text-red-500 mt-0.5">${penalizedPlayers.filter((p) => p.isSuspended).length}</div>
              </div>
              <button type="button" onclick="SMPL_APP.exportDisciplinaryLogCsv()" class="px-3.5 py-2.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 text-xs font-display font-bold uppercase transition">
                📊 Eksport CSV Logu
              </button>
            </div>
          </div>
        </div>

        <!-- 0. MODUŁ VAR / SPORY 48H & ROZŁĄCZENIA -->
        ${(() => {
          const allVarDisputes = (state.competitions && Array.isArray(state.competitions.matchDisputes)) ? state.competitions.matchDisputes : [];
          const pendingDisputes = allVarDisputes.filter((d) => d && d.status === 'PENDING');
          const resolvedDisputes = allVarDisputes.filter((d) => d && d.status !== 'PENDING');
          return `
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/35 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div>
                  <h3 class="font-display font-black text-lg text-amber-300 uppercase">
                    🚩 Kolejka Sporów VAR 48h &amp; Rozłączeń (${pendingDisputes.length} otwarte)
                  </h3>
                  <p class="text-xs text-slate-300 mt-0.5">
                    Rozpatruj zgłoszenia rozłączeń, nieobecności po 48h lub sporów o wynik i wydawaj wiążący werdykt 1 kliknięciem.
                  </p>
                </div>
              </div>
              ${
                allVarDisputes.length === 0
                  ? `<div class="p-5 rounded-xl bg-slate-950/70 border border-white/10 text-center text-xs text-slate-400">Brak zgłoszonych sporów VAR / odwołań w bieżącym sezonie.</div>`
                  : `<div class="space-y-3">
                       ${pendingDisputes.concat(resolvedDisputes.slice(0, 6)).map((dp) => `
                         <div class="p-4 rounded-xl bg-slate-950/85 border ${dp.status === 'PENDING' ? 'border-amber-400/50' : 'border-white/10'} space-y-2.5 text-xs">
                           <div class="flex flex-wrap items-center justify-between gap-2">
                             <span class="font-display font-black text-white uppercase">K${Number(dp.round || 0)} (${escapeHtml(dp.leagueId || '')}) • ${escapeHtml(dp.reasonType || 'VAR')}</span>
                             <span class="px-2 py-0.5 rounded font-bold ${dp.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'}">
                               ${escapeHtml(dp.status || 'PENDING')}${dp.decision ? ' • ' + escapeHtml(dp.decision) : ''}
                             </span>
                           </div>
                           <div class="text-slate-200"><strong>Zgłaszający:</strong> ${escapeHtml(dp.reporterName || '')} • Termin odpowiedzi 48h: <span class="text-amber-300">${escapeHtml(dp.deadlineAt || '-')}</span></div>
                           <div class="p-2.5 rounded-lg bg-slate-900 border border-white/10 text-slate-200">${escapeHtml(dp.description || '')}</div>
                           ${
                             dp.screenshot
                               ? `<div class="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-slate-900/90 border border-sky-400/35">
                                    <img src="${dp.screenshot}" alt="Dowód SS sporu VAR" class="w-20 h-14 object-cover rounded-lg border border-white/15 shrink-0"/>
                                    <div class="flex-1 min-w-0">
                                      <div class="text-[11px] font-bold text-sky-300 uppercase">📸 Dowód (SS dlaczego)</div>
                                      <div class="text-[11px] text-slate-400">Kliknij, aby powiększyć zrzut ekranu przed decyzją W.O. / VAR.</div>
                                    </div>
                                    <button type="button" onclick="SMPL_APP.openDisputeScreenshotModal('${escapeHtml(dp.id)}')" class="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/40 font-bold text-xs transition shrink-0">🔍 Powiększ SS</button>
                                  </div>`
                               : `<div class="p-2 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-200 text-[11px] font-bold">⚠️ Brak wymaganego zrzutu ekranu (SS dlaczego)!</div>`
                           }
                           ${
                             dp.status === 'PENDING'
                               ? `<div class="flex flex-wrap items-center gap-2 pt-1">
                                    <button type="button" onclick="SMPL_APP.adminResolveDispute('${escapeHtml(dp.id)}', 'WO_HOME')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 font-bold">✅ WO Gospodarz (2:0)</button>
                                    <button type="button" onclick="SMPL_APP.adminResolveDispute('${escapeHtml(dp.id)}', 'WO_AWAY')" class="px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/35 text-blue-200 border border-blue-400/40 font-bold">✅ WO Gość (0:2)</button>
                                    <button type="button" onclick="SMPL_APP.adminResolveDispute('${escapeHtml(dp.id)}', 'REPLAY')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 font-bold">🔄 Nakaż Powtórkę</button>
                                    <button type="button" onclick="SMPL_APP.adminResolveDispute('${escapeHtml(dp.id)}', 'REJECT')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/40 font-bold">❌ Odrzuć</button>
                                  </div>`
                               : `<div class="text-[11px] text-slate-400">Rozstrzygnął: ${escapeHtml(dp.resolvedBy || '')} • ${escapeHtml(dp.resolutionNote || '')}</div>`
                           }
                         </div>
                       `).join('')}
                     </div>`
              }
            </div>
          `;
        })()}

        

        <!-- 1. RĘCZNE NAKŁADANIE KAR NA DOWOLNEGO ZAWODNIKA -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
          <div class="pb-3 mb-4 border-b border-white/10">
            <h3 class="font-display font-black text-lg text-white uppercase">
              1. Ręczne Nakładanie Kar Regulaminowych (Punkty / Kartki / Walkowery)
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">
              Możesz w każdej chwili ukarać dowolnego zawodnika (np. za niestawienie się na mecz, brak gry w terminie, brak szacunku w grze)
            </p>
          </div>

          <form onsubmit="SMPL_APP.handleManualDisciplinarySubmit(event)" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div class="sm:col-span-4">
                <label class="block text-[10px] uppercase font-display font-bold text-slate-400 mb-1">Wybierz zawodnika:</label>
                <select id="manual-disc-player" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white font-bold focus:outline-none">
                  ${playerOptions}
                </select>
              </div>

              <div class="sm:col-span-3">
                <label class="block text-[10px] uppercase font-display font-bold text-rose-300 mb-1">Punkty do odjęcia (BEZ LIMITU):</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  id="manual-disc-pts"
                  value="3"
                  placeholder="Np. 3, 10, 50..."
                  class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-rose-500/50 text-xs text-rose-300 font-black focus:outline-none"
                />
              </div>

              <div class="sm:col-span-3">
                <label class="block text-[10px] uppercase font-display font-bold text-slate-400 mb-1">Kartka dyscyplinarna:</label>
                <select id="manual-disc-card" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-xs text-white font-bold focus:outline-none">
                  <option value="NONE">Brak kartki</option>
                  <option value="YELLOW">🟨 Żółta kartka (+1)</option>
                  <option value="RED">🟥 Czerwona kartka (+1)</option>
                </select>
              </div>

              <div class="sm:col-span-2 flex items-center gap-2 pb-2">
                <input type="checkbox" id="manual-disc-susp" class="w-4 h-4 rounded text-rose-600 bg-slate-900 border-white/20"/>
                <label for="manual-disc-susp" class="text-xs text-rose-300 font-bold cursor-pointer">⛔ Zawieś gracza</label>
              </div>
            </div>

            <div>
              <label class="block text-[10px] uppercase font-display font-bold text-amber-300 mb-1">Powód odjęcia punktów / kary (OBOWIĄZKOWY — każdy Admin to widzi) *:</label>
              <input
                type="text"
                id="manual-disc-reason"
                required
                placeholder="Wpisz dokładnie dlaczego odejmujesz punkty (np. Walkower bez zgłoszenia, niesportowe zachowanie)..."
                class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white focus:outline-none"
              />
            </div>

            <div class="flex items-center justify-end pt-2">
              <button type="submit" class="btn-league px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-xl flex items-center gap-2">
                <span>⚖️ Zatwierdź Karę Dyscyplinarną</span>
              </button>
            </div>
          </form>
        </div>

        <!-- 3. REJESTR ORZECZONYCH KAR I UKARANYCH ZAWODNIKÓW -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 class="font-display font-black text-lg text-white uppercase">
                3. Rejestr Kar i Wyroków Komisji Ligi (${penalizedPlayers.length} ukaranych)
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Zawodnicy z aktywnymi punktami karnymi, kartkami lub zawieszeniami widocznymi w tabeli ligowej
              </p>
            </div>
          </div>

          ${
            penalizedPlayers.length === 0
              ? `
                <div class="p-6 text-center text-xs text-slate-400">
                  Żaden zawodnik nie posiada obecnie aktywnych punktów karnych ani kartek.
                </div>
              `
              : `
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs">
                    <thead>
                      <tr class="border-b border-white/10 text-slate-400 font-display uppercase text-[10px]">
                        <th class="py-2.5 px-3">Zawodnik</th>
                        <th class="py-2.5 px-3 text-center">Liga</th>
                        <th class="py-2.5 px-3 text-center">Punkty Karne</th>
                        <th class="py-2.5 px-3 text-center">Kartki</th>
                        <th class="py-2.5 px-3 text-center">Status</th>
                        <th class="py-2.5 px-3">Kto nałożył (Admin)</th>
                        <th class="py-2.5 px-3">Powód (Dlaczego)</th>
                        <th class="py-2.5 px-3 text-right">Akcja</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                      ${penalizedPlayers
                        .map((p) => {
                          return `
                            <tr class="hover:bg-white/5 transition">
                              <td class="py-3 px-3 flex items-center gap-2.5">
                                <img src="${p.avatar}" class="w-8 h-8 rounded-full object-cover border border-white/20" alt=""/>
                                <div>
                                  <div class="font-bold text-white">${escapeHtml(p.name)}</div>
                                  <div class="text-[10px] text-slate-400">@${escapeHtml(p.nick)}</div>
                                </div>
                              </td>
                              <td class="py-3 px-3 text-center">
                                <span class="px-2 py-0.5 rounded bg-white/10 text-league-primary font-bold text-[10px] uppercase">${p.leagueId}</span>
                              </td>
                              <td class="py-3 px-3 text-center">
                                <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black">
                                  -${p.penaltyPoints || 0} PKT
                                </span>
                              </td>
                              <td class="py-3 px-3 text-center font-bold">
                                ${p.yellowCards > 0 ? `<span class="mr-1">🟨 ${p.yellowCards}</span>` : ''}
                                ${p.redCards > 0 ? `<span>🟥 ${p.redCards}</span>` : ''}
                                ${!p.yellowCards && !p.redCards ? `<span class="text-slate-500">—</span>` : ''}
                              </td>
                              <td class="py-3 px-3 text-center">
                                ${
                                  p.isSuspended
                                    ? `<span class="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-600 font-bold text-[10px]">⛔ ZAWIESZONY</span>`
                                    : `<span class="text-emerald-400 font-semibold text-[11px]">Aktywny</span>`
                                }
                              </td>
                              <td class="py-3 px-3 text-amber-300 font-bold">
                                ${escapeHtml(p.penaltyBy || 'Zarząd Ligi')}
                                ${p.penaltyAt ? `<div class="text-[10px] text-slate-400 font-normal">${escapeHtml(p.penaltyAt)}</div>` : ''}
                              </td>
                              <td class="py-3 px-3 text-slate-200 max-w-xs break-words">
                                ${escapeHtml(p.penaltyReason || 'Decyzja Komisji Dyscyplinarnej')}
                              </td>
                              <td class="py-3 px-3 text-right">
                                <button
                                  onclick="SMPL_APP.openDeductPointsModal('${p.id}')"
                                  class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 font-bold text-[11px] transition mr-1"
                                >
                                  ⚖️ Odejmij / Zmień PKT
                                </button>
                                <button
                                  onclick="SMPL_APP.handlePardonPlayer('${p.id}')"
                                  class="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-bold text-[11px] transition"
                                  title="Zdejmij wszystkie kary i przywróć czyste konto zawodnikowi"
                                >
                                  🔄 Ułaskawienie (Zdejmij karę)
                                </button>
                              </td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </div>

        <!-- 4. PEŁNA HISTORIA ODJEĆ PUNKTÓW I DECYZJI ADMINÓW (KAŻDY ADMIN TO WIDZI) -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/30">
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
            <div>
              <h3 class="font-display font-black text-lg text-white uppercase">
                4. Dziennik Odjęć Punktów i Powodów Adminów (${disciplinaryLog.length})
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Pełny, wspólny dziennik dla wszystkich Adminów i Master Admina — kto odjął punkty, komu, ile i z jakiego powodu.
              </p>
            </div>
          </div>

          ${
            disciplinaryLog.length === 0
              ? `
                <div class="p-6 text-center text-xs text-slate-400">
                  Brak zarejestrowanych odjęć punktów przez Administratorów w tym sezonie.
                </div>
              `
              : `
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs">
                    <thead>
                      <tr class="border-b border-white/10 text-slate-400 font-display uppercase text-[10px]">
                        <th class="py-2.5 px-3">Data</th>
                        <th class="py-2.5 px-3">Kto nałożył (Admin)</th>
                        <th class="py-2.5 px-3">Zawodnik</th>
                        <th class="py-2.5 px-3 text-center">Punkty</th>
                        <th class="py-2.5 px-3">Powód (Dlaczego odjęto)</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                      ${disciplinaryLog
                        .map((entry) => {
                          const ptsBadge = entry.actionType === 'PENALTY_SET'
                            ? `Ustawiono -${entry.penaltyPoints} PKT`
                            : entry.actionType === 'PARDON' || entry.actionType === 'PENALTY_CLEARED'
                            ? `Zdjęto (0 PKT)`
                            : (entry.actionType === 'CHAT_TIMEOUT' || entry.actionType === 'CHAT_BAN' || entry.actionType === 'CHAT_UNMUTE')
                            ? (entry.badgeLabel || entry.actionType)
                            : `-${entry.penaltyPoints || 0} PKT`;
                          return `
                            <tr class="hover:bg-white/5 transition">
                              <td class="py-2.5 px-3 text-slate-400 whitespace-nowrap">${escapeHtml(entry.date || '')}</td>
                              <td class="py-2.5 px-3 font-bold text-amber-300">${escapeHtml(entry.adminName || 'Zarząd SMPL')}</td>
                              <td class="py-2.5 px-3 font-bold text-white">${escapeHtml(entry.playerName || '')} <span class="text-slate-400 font-normal">(${escapeHtml(entry.leagueId || '')})</span></td>
                              <td class="py-2.5 px-3 text-center">
                                <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black whitespace-nowrap">
                                  ${escapeHtml(ptsBadge)}
                                </span>
                              </td>
                              <td class="py-2.5 px-3 text-slate-200 break-words">${escapeHtml(entry.reason || 'Brak powodu')}</td>
                            </tr>
                          `;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              `
          }
        </div>
      </div>
    `;
  }


  function renderAiVanessaSubTab(state, session) {
    const isMasterAiOwner = Boolean(session && window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session) && session.adminRole === 'MASTER_ADMIN');
    const queue = (state.aiUnansweredQueue || []).slice();
    const pendingQ = queue.filter((q) => q && q.status === 'PENDING');
    const resolvedQ = queue.filter((q) => q && q.status !== 'PENDING').slice(0, 12);
    const logs = (state.aiInteractionLog || []).slice(0, 40);
    const combinedKb = window.SMPL_AI && typeof window.SMPL_AI.getCombinedKnowledge === 'function'
      ? window.SMPL_AI.getCombinedKnowledge(state)
      : (state.aiKnowledge || []);
    const customOrLearned = (state.aiKnowledge || []).slice();
    const totalUp = combinedKb.reduce((acc, k) => acc + Number((k && k.helpfulCount) || 0), 0);
    const totalDown = combinedKb.reduce((acc, k) => acc + Number((k && k.unhelpfulCount) || 0), 0);

    const geminiConfigBodyHtml = isMasterAiOwner
      ? `
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div class="lg:col-span-7 space-y-3.5">
              <div class="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/90 border border-white/10">
                <input id="ai-gemini-enabled" type="checkbox" checked class="w-4 h-4 cursor-pointer"/>
                <label for="ai-gemini-enabled" class="text-xs font-semibold text-white cursor-pointer">
                  Włącz silnik Google Gemini AI dla wszystkich pytań graczy w dymku Vanessy
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Klucz Google Gemini API (AI Studio)</label>
                  <input id="ai-gemini-key" type="password" autocomplete="off" placeholder="AIzaSy... (wklej klucz API)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"/>
                  <div id="ai-gemini-key-hint" class="text-[11px] text-slate-400 mt-1">
                    Pozostaw puste, jeśli klucz jest już zapisany i zmieniasz tylko model.
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Model Gemini</label>
                  <select id="ai-gemini-model" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-semibold focus:outline-none focus:border-pink-400">
                    ${(
                      window.SMPL_AI && typeof window.SMPL_AI.getAvailableGeminiModels === 'function'
                        ? window.SMPL_AI.getAvailableGeminiModels()
                        : [
                            { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Zalecany)' },
                            { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
                            { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
                            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
                          ]
                    )
                      .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label)}</option>`)
                      .join('')}
                    <option value="CUSTOM">Własny kod modelu (wpisz obok)</option>
                  </select>
                  <input id="ai-gemini-custom-model" type="text" placeholder="Opcjonalnie np. gemini-2.5-pro" class="w-full mt-2 px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"/>
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Własne wytyczne dla Vanessy (opcjonalnie)</label>
                <textarea id="ai-gemini-persona" rows="2" placeholder="Np. Przypominaj o wysyłaniu screenów do niedzieli 22:00 i pisz luźnym sportowym stylem..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"></textarea>
              </div>

              <div class="flex flex-wrap items-center gap-2.5 pt-1">
                <button type="button" onclick="SMPL_APP.handleSaveAiGeminiConfig()" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase transition">
                  💾 Zapisz Konfigurację Gemini
                </button>
                <button type="button" onclick="SMPL_APP.handleTestAiGeminiConfig()" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase transition">
                  🧪 Przetestuj Połączenie na Żywo
                </button>
                <button type="button" onclick="SMPL_APP.refreshAiGeminiAdminPanel()" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-display font-bold text-xs uppercase transition">
                  🔄 Odśwież Status
                </button>
                <label class="flex items-center gap-1.5 text-[11px] text-rose-300 cursor-pointer ml-auto">
                  <input id="ai-gemini-clear-key" type="checkbox" class="w-4 h-4 cursor-pointer"/>
                  <span>Usuń zapisany klucz</span>
                </label>
              </div>

              <div id="ai-gemini-test-result" class="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-300">
                Kliknij <strong>„Przetestuj Połączenie na Żywo”</strong>, aby sprawdzić czy Twój klucz API odpowiada z Google AI Studio.
              </div>
            </div>

            <div class="lg:col-span-5 p-4 rounded-xl bg-slate-900/90 border border-amber-400/30 space-y-2.5 text-xs">
              <div class="font-display font-black text-amber-300 uppercase">
                💡 Ważne: Abonament 100 zł (Google AI Pro) vs Klucz API
              </div>
              <p class="text-slate-300 leading-relaxed">
                Płatny czat Gemini za ok. 100 zł/mies. (Google AI Pro) i <strong>Gemini API</strong> to dwa osobne systemy rozliczeń, ale na jednym koncie Google dostajesz wszystko od ręki:
              </p>
              <div class="space-y-1.5 text-[11px] text-slate-300">
                <div><strong>1. Darmowy klucz w 30 sekund:</strong> Wejdź na <code class="text-pink-300">aistudio.google.com</code> → <em>Get API key</em> → <em>Create API key</em>. Darmowy plan (Free Tier) działa od razu za 0 zł!</div>
                <div><strong>2. Bonus z planu 100 zł:</strong> Twój Google AI Pro daje <strong>\$10/mies. darmowych kredytów</strong> w <em>Google Developer Program</em>, które można przypiąć pod Google Cloud Billing dla wyższych limitów.</div>
                <div><strong>3. Test lokalny w 10 sekund:</strong> Uruchom <code class="text-pink-300">node server.js</code> albo wrzuć na hosting PHP (Hostido), wklej klucz tutaj i kliknij Test!</div>
              </div>
            </div>
          </div>
        `
      : `
          <div class="p-4 rounded-xl bg-slate-900/90 border border-amber-400/35 space-y-3 text-xs">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-display font-black text-amber-300 uppercase">
                🔒 Konfiguracja Klucza Gemini API — Wyłącznie Master Admin (Szymon Komenda)
              </div>
            </div>
            <p class="text-slate-300 leading-relaxed">
              Zapis, zmiana modelu oraz usuwanie klucza Google Gemini API są zabezpieczone po stronie serwera wyłącznie dla <strong>Master Admina</strong>. Jako Admin możesz sprawdzać status połączenia na żywo oraz uczyć Vanessę nowych odpowiedzi w sekcji poniżej.
            </p>
            <div class="flex flex-wrap items-center gap-2.5">
              <button type="button" onclick="SMPL_APP.handleTestAiGeminiConfig()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase transition">
                🧪 Przetestuj Połączenie na Żywo
              </button>
              <button type="button" onclick="SMPL_APP.refreshAiGeminiAdminPanel()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 font-display font-bold text-xs uppercase transition">
                🔄 Odśwież Status
              </button>
            </div>
            <div id="ai-gemini-test-result" class="p-3 rounded-xl bg-slate-950/90 border border-white/10 text-xs text-slate-300">
              Kliknij <strong>„Przetestuj Połączenie na Żywo”</strong>, aby sprawdzić status silnika Google Gemini AI.
            </div>
          </div>
        `;

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-pink-400/50 bg-slate-950/90">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <span class="px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-400/50 text-[11px] font-display font-bold uppercase">
                💋 SAMOUCZĄCA SIĘ ASYSTENTKA AI VANESSA
              </span>
              <h3 class="font-display font-black text-xl text-white uppercase mt-1.5">
                Centrum Nauki Vanessy i Pytań Graczy
              </h3>
              <p class="text-xs text-slate-300 mt-1">
                Gdy gracz zapyta Vanessę o coś nowego albo kliknie „👎 To nie to”, pytanie trafia tutaj. Gdy wpiszesz odpowiedź raz, Vanessa uczy się jej na stałe dla całej ligi! Dodatkowo po każdym „👍 Pomogło” sama zapamiętuje slang graczy.
              </p>
            </div>
            <button type="button" onclick="SMPL_APP.openAiAssistant()" class="px-4 py-2.5 rounded-xl bg-pink-500/20 hover:bg-amber-500/30 text-pink-300 border border-pink-400/50 font-display font-bold text-xs uppercase transition">
              💬 Przetestuj Czat z Vanessą
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div class="p-4 rounded-xl bg-slate-900/90 border border-white/10">
              <div class="text-slate-400 uppercase font-display text-[10px]">Oczekujące Pytania Graczy</div>
              <div class="font-display font-black text-2xl text-amber-300 mt-1">${pendingQ.length}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-900/90 border border-white/10">
              <div class="text-slate-400 uppercase font-display text-[10px]">Tematy w Bazie (Wbudowane + Wyuczone)</div>
              <div class="font-display font-black text-2xl text-pink-300 mt-1">${combinedKb.length} <span class="text-xs text-slate-400 font-normal">(${customOrLearned.length} wyuczonych)</span></div>
            </div>
            <div class="p-4 rounded-xl bg-slate-900/90 border border-white/10">
              <div class="text-slate-400 uppercase font-display text-[10px]">Skuteczność z Ocen Graczy</div>
              <div class="font-display font-black text-2xl text-emerald-300 mt-1">👍 ${totalUp} <span class="text-rose-300 text-sm">/ 👎 ${totalDown}</span></div>
            </div>
          </div>
        </div>

        <!-- KONFIGURACJA GOOGLE GEMINI AI (BEZPIECZNE PRZECHOWYWANIE PO STRONIE SERWERA) -->
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-blue-400/40 bg-slate-950/90">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <span class="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 text-[11px] font-display font-bold uppercase">
                ⚡ SILNIK GOOGLE GEMINI AI
              </span>
              <h4 class="font-display font-black text-lg text-white uppercase mt-1.5">
                Prawdziwa Inteligencja LLM dla Vanessy (Server-Side API)
              </h4>
              <p class="text-xs text-slate-300 mt-1">
                Klucz API zapisuje się wyłącznie na serwerze w chronionym pliku <code class="text-pink-300">data/.smpl-ai-secrets.json</code> — gracze nigdy go nie zobaczą ani w kodzie strony, ani w bazie JSON. Gdy Gemini jest wyłączone lub offline, Vanessa automatycznie wraca do lokalnej bazy wiedzy SMPL.
              </p>
            </div>
            <div id="ai-gemini-status-badge" class="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-xs font-display font-bold text-slate-300">
              ⏳ Sprawdzanie statusu serwera...
            </div>
          </div>

          ${geminiConfigBodyHtml}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- LEWA KOLUMNA: PYTANIA GRACZY DO NAUCZENIA -->
          <div class="lg:col-span-7 space-y-6">
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/40">
              <h4 class="font-display font-black text-base text-white uppercase mb-1">
                1. Pytania Graczy Czekające na Odpowiedź (${pendingQ.length})
              </h4>
              <p class="text-xs text-slate-400 mb-4">
                Wpisz krótką odpowiedź i kliknij „💾 Naucz Vanessę” — gracz dostanie powiadomienie, a następni gracze od razu otrzymają tę odpowiedź od Vanessy.
              </p>

              ${
                pendingQ.length === 0
                  ? `<div class="p-6 rounded-xl bg-slate-950/70 border border-white/10 text-center text-xs text-emerald-300 font-semibold">
                       ✅ Brak zaległych pytań — Vanessa radzi sobie ze wszystkimi pytaniami graczy!
                     </div>`
                  : `<div class="space-y-4">
                       ${pendingQ
                         .map((qi) => `
                           <div class="p-4 rounded-xl bg-slate-950/85 border border-amber-400/35 space-y-3">
                             <div class="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                               <div class="flex items-center gap-2 flex-wrap">
                                 <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold">
                                   ${qi.reason === 'THUMBS_DOWN' ? '👎 Gracz dopytał' : '❓ Nowe pytanie'} • x${Number(qi.askCount || 1)}
                                 </span>
                                 <span class="text-white font-bold">${escapeHtml(qi.playerName || 'Gracz')}</span>
                                 <span class="text-slate-400">(${escapeHtml(qi.leagueId || 'ALL')})</span>
                               </div>
                               <span class="text-slate-400">${escapeHtml(qi.lastAskedAt || qi.createdAt || '')}</span>
                             </div>
                             <div class="p-3 rounded-xl bg-slate-900 border border-white/10 text-sm text-white font-semibold">
                               „${escapeHtml(qi.question)}”
                             </div>
                             <div class="space-y-2">
                               <input
                                 id="ai-teach-kw-${qi.id}"
                                 type="text"
                                 placeholder="Opcjonalne słowa kluczowe (np. haslo, profil, zdjecie)"
                                 class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"
                               />
                               <textarea
                                 id="ai-teach-ans-${qi.id}"
                                 rows="2"
                                 placeholder="Wpisz odpowiedź, której Vanessa ma się nauczyć..."
                                 class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"
                               ></textarea>
                               <div class="flex flex-wrap items-center gap-2">
                                 <button type="button" onclick="SMPL_APP.handleAdminTeachFromQueue('${qi.id}')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs uppercase transition">
                                   💾 Zapisz i Naucz Vanessę
                                 </button>
                                 <button type="button" onclick="SMPL_APP.handleAdminDismissAiQueue('${qi.id}')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 border border-white/10 font-display font-bold text-xs uppercase transition">
                                   ✕ Odrzuć / Spam
                                 </button>
                               </div>
                             </div>
                           </div>
                         `)
                         .join('')}
                     </div>`
              }
            </div>

            <!-- HISTORIA OSTATNICH PYTAŃ GRACZY (RADAR PROBLEMÓW) -->
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
              <h4 class="font-display font-black text-base text-white uppercase mb-1">
                2. O czym gracze pytają Vanessę (${logs.length})
              </h4>
              <p class="text-xs text-slate-400 mb-3">
                Na bieżąco podglądaj pytania testerów, żeby wyłapać co sprawia im kłopot.
              </p>
              ${
                logs.length === 0
                  ? `<div class="p-4 text-xs text-slate-400 text-center">Brak jeszcze historii zapytań.</div>`
                  : `<div class="max-h-72 overflow-y-auto space-y-2 pr-1">
                       ${logs
                         .map((lg) => `
                           <div class="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs flex flex-wrap items-center justify-between gap-2">
                             <div class="min-w-0 flex-1">
                               <div class="text-white font-semibold">„${escapeHtml(lg.question)}”</div>
                               <div class="text-[11px] text-slate-400 mt-0.5">
                                 ${escapeHtml(lg.playerName || 'Gość')} • ${escapeHtml(lg.createdAt || '')} -> <strong class="text-pink-300">${escapeHtml(lg.matchedTitle || 'Przekazane do nauki')}</strong>
                               </div>
                             </div>
                             <span class="px-2 py-0.5 rounded bg-slate-900 border border-white/15 font-bold text-[11px] ${
                               lg.rating === 'UP' ? 'text-emerald-300' : lg.rating === 'DOWN' ? 'text-rose-300' : 'text-slate-300'
                             }">
                               ${lg.rating === 'UP' ? '👍 OK' : lg.rating === 'DOWN' ? '👎 Źle' : lg.matched ? '✅ Trafiono' : '❓ Nowe'}
                             </span>
                           </div>
                         `)
                         .join('')}
                     </div>`
              }
            </div>
          </div>

          <!-- PRAWA KOLUMNA: DODAJ WIEDZĘ RĘCZNIE + WYUCZONE WPISY -->
          <div class="lg:col-span-5 space-y-6">
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-pink-400/50">
              <h4 class="font-display font-black text-base text-white uppercase mb-1">
                3. Dodaj Nową Wiedzę Vanessie
              </h4>
              <p class="text-xs text-slate-400 mb-4">
                Możesz w każdej chwili nauczyć ją nowych zasad ligi, ogłoszeń lub odpowiedzi na częste pytania.
              </p>
              <div class="space-y-3">
                <div>
                  <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Tytuł / Przykładowe pytanie *</label>
                  <input id="ai-manual-title" type="text" placeholder="np. Gdzie wysłać potwierdzenie wyniku?" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold focus:outline-none focus:border-pink-400"/>
                </div>
                <div>
                  <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Słowa kluczowe (po przecinku)</label>
                  <input id="ai-manual-keywords" type="text" placeholder="np. wynik, screen, formularz, potwierdzenie" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"/>
                </div>
                <div>
                  <label class="block text-[11px] font-display uppercase text-slate-300 font-bold mb-1">Odpowiedź Vanessy *</label>
                  <textarea id="ai-manual-answer" rows="4" placeholder="Wpisz pełną, jasną odpowiedź dla graczy..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-400"></textarea>
                </div>
                <button type="button" onclick="SMPL_APP.handleAdminAddCustomAiKnowledge()" class="btn-league w-full py-3 px-4 rounded-xl font-display font-black text-xs uppercase transition">
                  💋 Zapisz Wiedzę do Mózgu Vanessy
                </button>
              </div>
            </div>

            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
              <h4 class="font-display font-black text-base text-white uppercase mb-1">
                4. Wyuczone Frazy i Wpisy Adminów (${customOrLearned.length})
              </h4>
              <p class="text-xs text-slate-400 mb-3">
                Wpisy zapamiętane automatycznie z ocen „👍” i dodane przez Administrację.
              </p>
              ${
                customOrLearned.length === 0
                  ? `<div class="p-4 text-xs text-slate-400 text-center">Vanessa korzysta na razie z bazy startowej (${window.SMPL_AI ? window.SMPL_AI.BASE_KB.length : 19} tematów) — gdy gracze zaczną klikać „👍” albo dopiszesz wiedzę powyżej, pojawi się tutaj!</div>`
                  : `<div class="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                       ${customOrLearned
                         .map((kb) => `
                           <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 text-xs space-y-1.5">
                             <div class="flex items-start justify-between gap-2">
                               <div class="font-bold text-white">${escapeHtml(kb.title || kb.id)}</div>
                               <button type="button" onclick="SMPL_APP.handleAdminDeleteAiKnowledge('${kb.id}')" class="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                                 Usuń
                               </button>
                             </div>
                             <div class="text-slate-300">${escapeHtml(kb.answer || '')}</div>
                             <div class="text-[10px] text-pink-300">
                               Wyuczone frazy (${(kb.learnedPhrases || []).length}): ${escapeHtml((kb.learnedPhrases || []).slice(-4).join(' • ') || 'brak')}
                             </div>
                           </div>
                         `)
                         .join('')}
                     </div>`
              }
            </div>

            ${
              resolvedQ.length > 0
                ? `<div class="glass-panel rounded-2xl p-4 border border-emerald-500/30 text-xs">
                     <div class="font-display font-bold uppercase text-emerald-300 mb-2">Ostatnio Nauczone (${resolvedQ.length})</div>
                     <div class="space-y-1.5">
                       ${resolvedQ.slice(0, 5).map((rq) => `
                         <div class="p-2 rounded bg-slate-950/70 border border-white/10 text-[11px] text-slate-300">
                           <strong class="text-white">${escapeHtml(rq.question)}</strong> -> ${escapeHtml(rq.resolvedBy || 'Admin')}
                         </div>
                       `).join('')}
                     </div>
                   </div>`
                : ''
            }
          </div>
        </div>
      </div>
    `;
  }

  function renderPortalAccessUrlsCard(isMasterOwner) {
    const originUrl =
      typeof window !== 'undefined' &&
      window.location &&
      window.location.origin &&
      window.location.origin !== 'null'
        ? window.location.origin
        : 'https://twoja-domena.pl';
    const urlRows = [
      { label: '1. 🌐 Adres Publiczny dla Graczy', url: originUrl + '/', cls: 'text-blue-300 border-white/10' },
      { label: '2. 📝 Strona Rejestracji Graczy', url: originUrl + '/REJESTRACJA.html', cls: 'text-emerald-300 border-emerald-500/30' },
      { label: '3. 🛡️ Adres Logowania dla Administracji', url: originUrl + '/PANEL-ADMINA.html', cls: 'text-amber-300 border-amber-500/30' }
    ];
    if (isMasterOwner) {
      urlRows.push({
        label: '4. 👑 Twój Tajny Adres Master Admina',
        url: originUrl + '/MASTER-SZYMON-KOMENDA.html',
        cls: 'text-purple-300 border-purple-500/40'
      });
    }
    return `
      <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
        <h3 class="font-display font-black text-base sm:text-lg text-white uppercase mb-1">
          🔗 Adresy Dostępowe Portalu SMPL
        </h3>
        <p class="text-xs text-slate-300 mb-4">
          Każdy adres do strefy administracyjnej wymaga indywidualnego loginu i hasła oraz akceptacji Właściciela.
        </p>
        <div class="space-y-2.5">
          ${urlRows
            .map(
              (row) => `
                <div class="p-3 rounded-xl bg-slate-950 border ${row.cls} flex flex-wrap items-center justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-display font-bold uppercase">${escapeHtml(row.label)}</div>
                    <div class="text-xs text-slate-300 mt-0.5 break-all"><code>${escapeHtml(row.url)}</code></div>
                  </div>
                  <button type="button" onclick="window.SMPL_NOTIF && window.SMPL_NOTIF.copyToClipboard('${escapeHtml(row.url).replace(/'/g, "\\'")}', 'Skopiowano adres portalu!')" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[11px] font-bold flex-shrink-0">
                    📋 Kopiuj
                  </button>
                </div>
              `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function renderOverviewSubTab(state, activeLeagueId, session, pendingMatches, pendingRegs, pendingPwdReqs, activeAdminLeagues) {
    const winAdm =
      window.SMPL_DB && typeof window.SMPL_DB.getSeasonJoinWindowInfo === 'function'
        ? window.SMPL_DB.getSeasonJoinWindowInfo(state)
        : { isOpen: false, phase: 'NOT_STARTED', allowedLeagues: [] };
    const pendingJoinRegsCount = (state.registrations || []).filter((r) => r && r.status === 'PENDING').length;
    const approvedPoolRegsCount = (state.registrations || []).filter((r) => r && r.status === 'APPROVED_POOL').length;
    const benchedPoolCount = (state.players || []).filter(
      (p) => p && !p.isPlaceholder && !p.gdprDeleted && (p.active === false || p.leagueId === 'POOL')
    ).length;
    const readyPoolTotal = approvedPoolRegsCount + benchedPoolCount;
    const myAdmPl =
      window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function' && session && session.adminId
        ? window.SMPL_DB.findPlayerForAdmin(session.adminId, state)
        : null;
    const myAdmActive = myAdmPl && myAdmPl.active !== false && /^L\d+$/i.test(String(myAdmPl.leagueId || ''));
    const cdEst =
      window.SMPL_DB && typeof window.SMPL_DB.getExcelSeason56Estimate === 'function'
        ? window.SMPL_DB.getExcelSeason56Estimate()
        : {
            s55L1Played: 138,
            s55L1Total: 240,
            s55L1Pct: 57.5,
            s55L1RemainingMatches: 102,
            s55L2RealPlayed: 128,
            s55L2RealTotal: 182,
            s55L2Pct: 70.3,
            completedRounds: 8,
            remainingRounds: 7,
            roundsPerWeek: 4,
            s55EstimatedEndDate: '2026-12-06',
            s55EstimatedEndLabel: 'Niedziela, 6 grudnia 2026',
            breakWeeks: 2,
            breakRangeLabel: '7–20 grudnia 2026 (14 dni)',
            recommendedStartDate: '2026-12-21',
            recommendedStartTime: '18:00',
            recommendedStartLabel: 'Poniedziałek, 21 grudnia 2026 • 18:00'
          };
    const cdCfg =
      window.SMPL_DB && typeof window.SMPL_DB.getSeasonCountdownConfig === 'function'
        ? window.SMPL_DB.getSeasonCountdownConfig(state)
        : {
            enabled: false,
            season: 56,
            targetDate: cdEst.recommendedStartDate,
            targetTime: cdEst.recommendedStartTime,
            breakWeeks: 2,
            title: 'WIELKI START SEZONU 56',
            subtitle: 'Ekstraklasa & 2. Liga • Nowe Karty UT, Sklepik Coins i Walka o Puchar Mistrzów!',
            ctaLabel: '📝 Zapisz się do Sezonu 56',
            ctaTab: 'register'
          };

    return `
      <div class="space-y-5">
        <!-- KOKPIT ADMINA — CO TERAZ ZROBIĆ (KROK PO KROKU • 1-KLIK) -->
        <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-amber-400/40 bg-slate-950/90">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="text-xs font-display font-black uppercase text-amber-300">
              🧭 KOKPIT ADMINA — CO TERAZ ZROBIĆ (SEZON ${(state && state.season) || 56})
            </div>
            <div class="text-[11px] text-slate-400 font-semibold">
              Kliknij kafelek zadania — przejdziesz bezpośrednio do właściwej zakładki
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="rounded-2xl p-4 bg-slate-900/90 border ${pendingMatches.length > 0 ? 'border-amber-400/60' : 'border-white/10'} flex flex-col justify-between gap-3">
              <div>
                <div class="text-[11px] font-display font-bold uppercase text-slate-400">KROK 1 • MECZE</div>
                <div class="font-display font-black text-base text-white mt-0.5">
                  ${pendingMatches.length > 0 ? `⏳ ${pendingMatches.length} wyników czeka na kliknięcie` : '✅ Brak wyników w kolejce'}
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  ${pendingMatches.length > 0 ? 'Kliknij i zatwierdź jednym guzikiem (albo sprawdź ekran).' : 'Wszystkie zgłoszone wyniki są już zatwierdzone.'}
                </div>
              </div>
              <button type="button" onclick="SMPL_APP.setAdminSubTab('moderation')" class="w-full py-2.5 px-3 rounded-xl ${pendingMatches.length > 0 ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200 font-bold'} font-display text-xs uppercase transition">
                ${pendingMatches.length > 0 ? `✅ Otwórz Kolejkę (${pendingMatches.length})` : '✅ Podgląd Wyników'}
              </button>
            </div>

            <div class="rounded-2xl p-4 bg-slate-900/90 border ${pendingRegs.length + pendingPwdReqs.length > 0 ? 'border-emerald-400/60' : 'border-white/10'} flex flex-col justify-between gap-3">
              <div>
                <div class="text-[11px] font-display font-bold uppercase text-slate-400">KROK 2 • REJESTRACJA &amp; HASŁA</div>
                <div class="font-display font-black text-base text-white mt-0.5">
                  ${pendingRegs.length + pendingPwdReqs.length > 0 ? `👥 ${pendingRegs.length} zapisów • ${pendingPwdReqs.length} haseł` : '✅ Brak zgłoszeń do rozpatrzenia'}
                </div>
                <div class="text-[11px] text-slate-400 mt-1">
                  ${pendingRegs.length + pendingPwdReqs.length > 0 ? `Przypisz nowych graczy do aktywnych lig (${escapeHtml(activeAdminLeagues.map((lg) => lg.id).join('/'))}) i zresetuj hasła.` : 'Lista zgłoszeń i próśb o hasło jest pusta.'}
                </div>
              </div>
              <button type="button" onclick="SMPL_APP.setAdminSubTab('recruitment')" class="w-full py-2.5 px-3 rounded-xl ${pendingRegs.length + pendingPwdReqs.length > 0 ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-200 font-bold'} font-display text-xs uppercase transition">
                ${pendingRegs.length + pendingPwdReqs.length > 0 ? `👥 Rozpatrz Teraz (${pendingRegs.length + pendingPwdReqs.length})` : '👥 Kadra &amp; Zapisy'}
              </button>
            </div>

            <div class="rounded-2xl p-4 bg-emerald-950/30 border border-emerald-400/50 flex flex-col justify-between gap-3">
              <div>
                <div class="text-[11px] font-display font-bold uppercase text-emerald-300">KROK 3 • AUTOMATYZACJA SEZONU</div>
                <div class="font-display font-black text-base text-white mt-0.5">
                  🚀 Koniec Sezonu ${(state && state.season) || 56} ➔ Start ${((state && state.season) || 56) + 1}
                </div>
                <div class="text-[11px] text-slate-300 mt-1">
                  Archiwum + medale + awanse/spadki + nowy terminarz w 1 kliknięciu.
                </div>
              </div>
              <button type="button" onclick="SMPL_APP.openNextSeasonRolloverModal()" class="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase shadow-lg transition">
                🚀 Wystartuj Sezon ${((state && state.season) || 56) + 1} (1-Klik)
              </button>
            </div>
          </div>
        </div>

        <!-- STUDIO WIELKIEGO ODLICZANIA DO STARTU SEZONU 56 (OBLICZONE Z EXCELA S55 + 2 TYG. PRZERWY) -->
        <div id="admin-countdown-studio-card" class="smpl-cd-admin-card glass-panel rounded-3xl p-5 sm:p-6 border ${cdCfg.enabled ? 'border-amber-400/75 bg-gradient-to-br from-amber-950/35 via-slate-950/95 to-emerald-950/30' : 'border-amber-400/40 bg-slate-950/92'} relative overflow-hidden">
          <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full ${cdCfg.enabled ? 'bg-emerald-500/20 border border-emerald-400/55 text-emerald-200' : 'bg-amber-500/15 border border-amber-400/45 text-amber-200'} font-display font-black text-[10px] uppercase tracking-wider">
                <span class="${cdCfg.enabled ? 'smpl-live-beacon-dot' : ''}"></span>
                <span>${cdCfg.enabled ? '🟢 ODLICZANIE AKTYWNE NA PORTALU (LIVE DLA GRACZY)' : '⏱️ STUDIO WIELKIEGO ODLICZANIA • SEZON ' + Number(cdCfg.season || 56)}</span>
              </div>
              <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase tracking-tight mt-2">
                🏆 Wielkie Odliczanie do Startu Sezonu ${Number(cdCfg.season || 56)}
              </h3>
              <p class="text-xs text-slate-300 mt-0.5 max-w-2xl">
                Jednym kliknięciem odpal zjawiskowy, stadionowy zegar odliczający na żywo dla wszystkich graczy (na górze portalu, na ekranie logowania oraz w pełnoekranowym Trybie Kinowym + Plakat PNG na Messengera).
              </p>
            </div>
            <div class="smpl-cd-admin-mini-clock rounded-2xl px-3.5 py-2.5 bg-slate-900/90 border border-amber-400/45 text-center shadow-lg" data-smpl-cd-admin-preview>
              <div class="text-[9px] font-display font-bold uppercase tracking-widest text-amber-300 mb-1">PODGLĄD NA ŻYWO</div>
              <div class="flex items-center gap-1.5 font-display font-black text-base sm:text-lg text-white tabular-nums">
                <span class="px-2 py-0.5 rounded-lg bg-slate-950 border border-amber-400/35"><b data-smpl-cd-d>--</b><small class="text-[9px] text-amber-300 ml-0.5">d</small></span>
                <span class="text-amber-400">:</span>
                <span class="px-2 py-0.5 rounded-lg bg-slate-950 border border-amber-400/35"><b data-smpl-cd-h>--</b><small class="text-[9px] text-amber-300 ml-0.5">g</small></span>
                <span class="text-amber-400">:</span>
                <span class="px-2 py-0.5 rounded-lg bg-slate-950 border border-amber-400/35"><b data-smpl-cd-m>--</b><small class="text-[9px] text-amber-300 ml-0.5">m</small></span>
                <span class="text-amber-400">:</span>
                <span class="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-400/50 text-emerald-200"><b data-smpl-cd-s>--</b><small class="text-[9px] text-emerald-300 ml-0.5">s</small></span>
              </div>
            </div>
          </div>

          <!-- Wyliczenie wprost z Excela S55 + 2 tygodnie przerwy międzysezonowej -->
          <div class="rounded-2xl p-3.5 sm:p-4 bg-slate-900/80 border border-emerald-400/30 mb-4">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div class="text-[11px] font-display font-black uppercase text-emerald-300 tracking-wide">
                📊 AUTOMATYCZNA KALKULACJA Z EXCELA S55 (ODSWIEŻONA WERSJA LIGI)
              </div>
              <span class="text-[10px] font-bold text-slate-400">
                Tempo regulaminowe: ${Number(cdEst.roundsPerWeek || 4)} kolejki/tydz. • Stan arkusza: ${escapeHtml(cdEst.asOfDate || '2026-11-23')}
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              <div class="rounded-xl p-2.5 bg-slate-950/90 border border-white/10">
                <div class="text-[10px] font-display font-bold uppercase text-amber-300">1. Ekstraklasa S55</div>
                <div class="font-display font-black text-white text-sm mt-0.5">${cdEst.s55L1Played} / ${cdEst.s55L1Total} (${cdEst.s55L1Pct}%)</div>
                <div class="text-[10px] text-slate-400 mt-0.5">K1–K8 (100%) • zostało ${cdEst.remainingRounds} kol. (K9–K15)</div>
              </div>
              <div class="rounded-xl p-2.5 bg-slate-950/90 border border-white/10">
                <div class="text-[10px] font-display font-bold uppercase text-sky-300">2. Liga 2 S55</div>
                <div class="font-display font-black text-white text-sm mt-0.5">${cdEst.s55L2RealPlayed} / ${cdEst.s55L2RealTotal} (${cdEst.s55L2Pct}%)</div>
                <div class="text-[10px] text-slate-400 mt-0.5">K1–K8 (100%) • wyprzedza Ekstraklasę</div>
              </div>
              <div class="rounded-xl p-2.5 bg-slate-950/90 border border-white/10">
                <div class="text-[10px] font-display font-bold uppercase text-emerald-300">3. Finisz S55 (≈ 2 tyg.)</div>
                <div class="font-display font-black text-white text-sm mt-0.5">~6 grudnia 2026</div>
                <div class="text-[10px] text-slate-400 mt-0.5">Tydz. 3 (K9–12) + Tydz. 4 (K13–15)</div>
              </div>
              <div class="rounded-xl p-2.5 bg-amber-500/15 border border-amber-400/50">
                <div class="text-[10px] font-display font-bold uppercase text-amber-200">4. + 2 Tyg. Przerwy ➔ S56</div>
                <div class="font-display font-black text-amber-300 text-sm mt-0.5">21.12.2026 • 18:00</div>
                <div class="text-[10px] text-amber-100/80 mt-0.5">Przerwa 7–20.12 (14 dni) ➔ Start!</div>
              </div>
            </div>
          </div>

          <!-- Główne Przyciski 1-Klik -->
          <div class="flex flex-wrap items-center gap-2.5 mb-4">
            ${
              cdCfg.enabled
                ? `<button type="button" onclick="SMPL_APP.adminSaveSeasonCountdown(true)" class="flex-1 min-w-[200px] py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:brightness-110 text-slate-950 font-display font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl transition">
                     💾 Zapisz Zmiany Odliczania (LIVE)
                   </button>
                   <button type="button" onclick="SMPL_APP.adminStopSeasonCountdown()" class="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-display font-black text-xs uppercase tracking-wider shadow-lg transition">
                     ⏹️ Zatrzymaj / Ukryj
                   </button>`
                : `<button type="button" onclick="SMPL_APP.adminLaunchSeasonCountdown()" class="flex-1 min-w-[230px] py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 hover:brightness-110 text-slate-950 font-display font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl transition">
                     🚀 URUCHOM WIELKIE ODLICZANIE SEZONU ${Number(cdCfg.season || 56)} (1-KLIK)
                   </button>`
            }
            <button type="button" onclick="SMPL_APP.openCountdownCinemaModal(false)" class="py-3 px-4 rounded-2xl bg-indigo-600/85 hover:bg-indigo-500 text-white font-display font-black text-xs uppercase tracking-wider border border-indigo-300/40 shadow-lg transition">
              🎬 Podgląd Kinowy
            </button>
            <button type="button" onclick="SMPL_APP.downloadCountdownPosterPng()" class="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-200 font-display font-black text-xs uppercase tracking-wider border border-amber-400/40 shadow transition">
              📸 Plakat PNG (Messenger)
            </button>
            <button type="button" onclick="SMPL_APP.openCountdownCinemaModal(true)" class="py-3 px-3.5 rounded-2xl bg-purple-600/35 hover:bg-purple-600/55 text-purple-100 font-display font-bold text-xs uppercase border border-purple-400/45 transition" title="Lokalny 10-sekundowy podgląd finału 00:00:00 i fajerwerków bez zmiany daty na serwerze">
              🎆 Test 10s
            </button>
          </div>

          <!-- Szybkie Presety Daty & Przerwy -->
          <div class="flex flex-wrap items-center gap-1.5 mb-3.5">
            <span class="text-[10px] font-display font-bold uppercase text-slate-400 mr-1">⚡ Szybkie presety:</span>
            <button type="button" onclick="SMPL_APP.adminApplyCountdownPreset('excel_2w')" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 font-display font-bold text-[10px] uppercase transition">
              📊 Excel S55 + 2 tyg. (21.12 • 18:00)
            </button>
            <button type="button" onclick="SMPL_APP.adminApplyCountdownPreset('excel_3w')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-200 font-display font-bold text-[10px] uppercase transition">
              ⏳ +1 tydz. zapasu (28.12 • 18:00)
            </button>
            <button type="button" onclick="SMPL_APP.adminApplyCountdownPreset('new_year')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/45 text-amber-200 font-display font-bold text-[10px] uppercase transition">
              🎄 Po Świętach (04.01.2027 • 18:00)
            </button>
          </div>

          <!-- Szczegóły Konfiguracji (Data, Godzina, Przerwa, Teksty) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label class="block">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Data Startu (Europe/Warsaw)</span>
              <input id="admin-cd-date" type="date" value="${escapeHtml(cdCfg.targetDate || cdEst.recommendedStartDate)}" oninput="SMPL_APP.refreshAdminCountdownPreview()" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"/>
            </label>
            <label class="block">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Godzina Startu</span>
              <input id="admin-cd-time" type="time" value="${escapeHtml(cdCfg.targetTime || '18:00')}" oninput="SMPL_APP.refreshAdminCountdownPreview()" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"/>
            </label>
            <label class="block">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Przerwa Międzysezonowa (tyg.)</span>
              <input id="admin-cd-break-weeks" type="number" min="0" max="12" value="${Number(cdCfg.breakWeeks !== undefined ? cdCfg.breakWeeks : 2)}" oninput="SMPL_APP.adminRecalcDateFromBreakWeeks()" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"/>
            </label>
            <label class="block">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Numer Sezonu</span>
              <input id="admin-cd-season" type="number" min="1" max="999" value="${Number(cdCfg.season || 56)}" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"/>
            </label>
            <label class="block sm:col-span-2">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Nagłówek Odliczania</span>
              <input id="admin-cd-title" type="text" maxlength="120" value="${escapeHtml(cdCfg.title || 'WIELKI START SEZONU 56')}" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"/>
            </label>
            <label class="block sm:col-span-2">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Podtytuł / Hasło Motywacyjne</span>
              <input id="admin-cd-subtitle" type="text" maxlength="240" value="${escapeHtml(cdCfg.subtitle || 'Ekstraklasa & 2. Liga • Nowe Karty UT, Sklepik Coins i Walka o Puchar Mistrzów!')}" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs"/>
            </label>
            <label class="block sm:col-span-2">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Tekst Przycisku Akcji (CTA)</span>
              <input id="admin-cd-cta-label" type="text" maxlength="64" value="${escapeHtml(cdCfg.ctaLabel || '📝 Zapisz się do Sezonu 56')}" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs"/>
            </label>
            <label class="block sm:col-span-2">
              <span class="text-[10px] font-display font-bold uppercase text-slate-400">Dokąd prowadzi przycisk CTA?</span>
              <select id="admin-cd-cta-tab" class="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-bold text-xs">
                <option value="register" ${cdCfg.ctaTab === 'register' ? 'selected' : ''}>📝 Zapisy do Ligi (Polecane przed startem)</option>
                <option value="standings" ${cdCfg.ctaTab === 'standings' ? 'selected' : ''}>🏆 Tabela Ligowa</option>
                <option value="profile" ${cdCfg.ctaTab === 'profile' ? 'selected' : ''}>🎴 Moja Karta UT &amp; Sklepik</option>
                <option value="archive" ${cdCfg.ctaTab === 'archive' ? 'selected' : ''}>🏛️ Archiwum S1–S55</option>
              </select>
            </label>
          </div>
          ${
            cdCfg.updatedAt
              ? `<div class="mt-3 text-[10px] text-slate-400 font-semibold">Ostatnia zmiana: ${escapeHtml(cdCfg.updatedAt)} • ${escapeHtml(cdCfg.updatedBy || 'Admin')}</div>`
              : ''
          }
        </div>

        <!-- START SEZONU DLA GRACZY + ADMIN JAKO GRACZ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="glass-panel rounded-2xl p-5 ${winAdm.isOpen ? 'bg-emerald-950/25 border-emerald-400/50' : 'bg-slate-950/85 border-white/15'} border flex flex-col justify-between gap-3">
            <div>
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[10px] font-display font-black uppercase tracking-wider ${winAdm.isOpen ? 'text-emerald-300' : 'text-amber-300'}">
                  🚪 POCZĄTEK / KONIEC SEZONU DLA GRACZY
                </span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-display font-black uppercase ${winAdm.isOpen ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50' : 'bg-slate-800 text-slate-300 border border-white/15'}">
                  ${winAdm.isOpen ? '🟢 OTWARTE' : '🔴 ZAMKNIĘTE'}
                </span>
              </div>
              <div class="font-display font-black text-sm text-white uppercase">
                ${winAdm.isOpen ? 'Gracze mogą teraz sami klikać [Dołącz / Opuść ligę]' : 'Okno samodzielnych zapisów graczy jest zamknięte'}
              </div>
              <p class="text-[11px] text-slate-300 mt-1">
                Otwórz okno przed startem sezonu, aby zatwierdzeni gracze sami wybierali ligę, albo zamknij okno na czas rozgrywek.
              </p>
              <div class="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span class="px-2 py-0.5 rounded-full bg-slate-900 border border-white/15 text-emerald-300">
                  ✅ Gotowi w Puli: ${readyPoolTotal}
                </span>
                ${
                  pendingJoinRegsCount > 0
                    ? `<span class="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200">
                         ⏳ Oczekujący PENDING: ${pendingJoinRegsCount}
                       </span>`
                    : ''
                }
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" onclick="SMPL_APP.handleSetSeasonJoinWindow(true)" class="flex-1 min-w-[140px] py-2 px-3 rounded-xl ${winAdm.isOpen ? 'bg-emerald-600/40 text-emerald-200 border border-emerald-400/50' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'} font-display text-[11px] uppercase shadow transition">
                🟢 Początek (Otwórz Dołączanie)
              </button>
              <button type="button" onclick="SMPL_APP.handleSetSeasonJoinWindow(false)" class="flex-1 min-w-[140px] py-2 px-3 rounded-xl ${!winAdm.isOpen ? 'bg-slate-800 text-slate-300 border border-white/15' : 'bg-rose-600 hover:bg-rose-500 text-white font-black'} font-display text-[11px] uppercase shadow transition">
                🔴 Koniec (Zamknij Okno)
              </button>
              ${
                pendingJoinRegsCount > 0
                  ? `<button type="button" onclick="SMPL_APP.handleApproveAllPendingToPool(true)" class="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-[11px] uppercase shadow-lg transition">
                       ⚡ Zatwierdź oczekujących (${pendingJoinRegsCount}) do Puli${!winAdm.isOpen ? ' + Otwórz Dołączanie' : ''} (1-Klik)
                     </button>`
                  : ''
              }
            </div>
          </div>

          <div class="glass-panel rounded-2xl p-5 bg-blue-950/20 border border-blue-400/40 flex flex-col justify-between gap-3">
            <div>
              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="text-[10px] font-display font-black uppercase tracking-wider text-blue-300">
                  🛡️ ADMIN JAKO GRACZ LIGI (NP. EKSTRAKLASA)
                </span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-display font-black uppercase ${myAdmActive ? 'bg-blue-500/25 text-blue-200 border border-blue-400/50' : 'bg-slate-800 text-slate-300 border border-white/15'}">
                  ${myAdmActive ? `⚽ W LIDZE ${escapeHtml(myAdmPl.leagueId)}` : '⏳ POZA TABELĄ'}
                </span>
              </div>
              <div class="font-display font-black text-sm text-white uppercase">
                ${myAdmActive ? `Grasz jako ${escapeHtml(myAdmPl.name)} pod rangą ADMIN` : 'Dołącz swoim kontem Admina do tabeli (np. L1 Ekstraklasa)'}
              </div>
              <p class="text-[11px] text-slate-300 mt-1">
                Administratorzy grający w lidze wyświetlają odznakę <strong>🛡️ Admin</strong> i mogą dopisać swoje statystyki z poprzednich sezonów (S1–S55).
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${
                myAdmActive
                  ? `<button type="button" onclick="SMPL_APP.openAssignHistoricalStatsModal('${myAdmPl.id}')" class="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-[11px] uppercase shadow transition">
                       🏛️ Moje Statystyki S1–S55
                     </button>
                     <button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('${escapeHtml(myAdmPl.leagueId)}')" class="px-3 py-2 rounded-xl bg-blue-600/35 hover:bg-blue-600/55 text-blue-100 border border-blue-400/50 font-display font-bold text-[11px] uppercase transition">
                       🔁 Zmień Ligę / Dane
                     </button>
                     <button type="button" onclick="SMPL_APP.handlePlayerLeaveLeague()" class="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 font-display font-bold text-[11px] uppercase transition">
                       🚪 Opuść ligę
                     </button>`
                  : `<button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('L1')" class="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-display font-black text-[11px] uppercase shadow-lg transition">
                       🛡️ Dołącz do Ekstraklasy (L1) jako Admin + Statystyki S1–S55
                     </button>`
              }
            </div>
          </div>
        </div>

        <!-- SZYBKIE DODAWANIE GRACZY I KOLEJNYCH LIG -->
        <div class="glass-panel rounded-2xl p-5 border border-white/15 bg-slate-950/85 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="max-w-2xl">
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              <span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40 text-[10px] font-display font-black uppercase">
                👥 KADRY LIG: ${activeAdminLeagues.map((lg) => `${escapeHtml(lg.shortName || lg.id)} (${state.players.filter((p) => p.active !== false && p.leagueId === lg.id).length})`).join(' • ')}
              </span>
            </div>
            <h3 class="font-display font-black text-base text-white uppercase">
              Szybkie Dodawanie Graczy &amp; Dywizji
            </h3>
            <p class="text-xs text-slate-300 mt-0.5">
              Dodaj zawodnika do wybranej ligi, otwórz następną dywizję albo przelicz archiwum S1–S55. (Rzadsze resety bazy przeniesiono bezpiecznie do <em>Ustawienia → Kopie</em>).
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 shrink-0">
            ${activeAdminLeagues
              .map(
                (lg) => `
                  <button type="button" onclick="SMPL_APP.openAddPlayerModal('${lg.id}')" class="px-3.5 py-2.5 rounded-xl ${getLeagueChipBtnClass(lg.id)} font-display font-black text-xs uppercase transition">
                    ➕ Dodaj do ${escapeHtml(lg.id)}
                  </button>
                `
              )
              .join('')}
            <button type="button" onclick="SMPL_APP.openAddLeagueModal()" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 font-display font-black text-xs uppercase transition shadow-lg">
              ➕ Dodaj następną ligę
            </button>
            <button type="button" onclick="SMPL_APP.adminRecalculateAllHistoricalStats()" class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white border border-amber-400/50 font-display font-black text-xs uppercase transition shadow-lg" title="Przelicza pełne statystyki wszystkich graczy z całych tabel S1–S55+">
              🔄 Przelicz S1–S55
            </button>
          </div>
        </div>

        ${
          (state.disciplinaryLog || []).length > 0
            ? `<div class="glass-panel rounded-2xl p-4 sm:p-5 border border-rose-500/40 bg-slate-950/90">
                 <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                   <div>
                     <span class="text-xs font-display font-black uppercase text-rose-300">
                       📜 OSTATNIE ODJĘCIA PUNKTÓW PRZEZ ADMINÓW
                     </span>
                     <p class="text-[11px] text-slate-400">
                       Przejrzysty rejestr decyzji dyscyplinarnych (kto, komu, ile i dlaczego).
                     </p>
                   </div>
                   <button type="button" onclick="SMPL_APP.setAdminSubTab('tribunal')" class="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 font-display font-bold text-[11px] uppercase transition">
                     ⚖️ Pełny Rejestr &amp; Odejmij PKT
                   </button>
                 </div>
                 <div class="space-y-1.5">
                   ${(state.disciplinaryLog || [])
                     .slice(0, 5)
                     .map((logItem) => {
                       const ptsLabel =
                         logItem.actionType === 'PENALTY_SET'
                           ? `ustawił -${logItem.penaltyPoints} PKT`
                           : logItem.actionType === 'PARDON' || logItem.actionType === 'PENALTY_CLEARED'
                           ? 'zdjął karę (0 PKT)'
                           : `-${logItem.penaltyPoints || 0} PKT`;
                       return `
                         <div class="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs flex flex-wrap items-center justify-between gap-2">
                           <div class="flex flex-wrap items-center gap-2 min-w-0">
                             <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[11px]">${escapeHtml(ptsLabel)}</span>
                             <span class="text-white font-bold">${escapeHtml(logItem.playerName || '')}</span>
                             <span class="text-amber-300 font-semibold">• Admin: ${escapeHtml(logItem.adminName || 'Zarząd')}</span>
                             <span class="text-slate-300 break-words">— „${escapeHtml(logItem.reason || 'Brak powodu')}”</span>
                           </div>
                           <span class="text-[10px] text-slate-400">${escapeHtml(logItem.date || '')}</span>
                         </div>
                       `;
                     })
                     .join('')}
                 </div>
               </div>`
            : ''
        }
      </div>
    `;
  }

  function renderRecruitmentSubTab(state, activeLeagueId, session, opts, activeAdminLeagues, leaguePlayers, pendingRegs, approvedPoolRegs, pendingPwdReqs, recruitmentClansList, isMasterOwner) {
    const recSub = (opts && opts.recruitmentSubTab) || 'all';
    const showAll = recSub === 'all';
    const subBtn = (id, label, countBadge) => `
      <button type="button" onclick="SMPL_APP.setAdminRecruitmentSubTab('${id}')" class="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase transition flex items-center gap-1.5 ${
        recSub === id ? 'btn-league shadow-md' : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-white/15'
      }">
        <span>${label}</span>
        ${countBadge !== null && countBadge !== undefined ? `<span class="px-1.5 py-0.2 rounded-full ${recSub === id ? 'bg-slate-950/30 text-white' : 'bg-white/10 text-slate-200'} font-black text-[10px]">${countBadge}</span>` : ''}
      </button>
    `;

    const benchedPoolPlayers = (state.players || []).filter(
      (p) => p && !p.isPlaceholder && !p.gdprDeleted && (p.active === false || p.leagueId === 'POOL')
    );
    const poolTotalCount = approvedPoolRegs.length + benchedPoolPlayers.length;
    const pendingTotal = pendingRegs.length + poolTotalCount;
    const totalRosterPlayers = state.players.filter((p) => p && !p.isPlaceholder && !p.gdprDeleted && p.active !== false && p.leagueId !== 'POOL').length;
    const curLeagueObj = state.leagues && state.leagues[activeLeagueId];

    const poolAndPendingHtml = `
      ${
        poolTotalCount > 0
          ? `<div class="glass-panel rounded-2xl p-5 sm:p-6 border-2 border-emerald-400/40 bg-slate-950/90">
               <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
                 <div>
                   <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-display font-bold text-[10px] uppercase">
                     📋 PULA AKTYWNYCH KONT (GOTOWYCH DO LOGOWANIA)
                   </span>
                   <h3 class="font-display font-black text-base text-white uppercase mt-1">
                     Konta w Puli Oczekujące na Przydział do Ligi (${poolTotalCount})
                   </h3>
                 </div>
               </div>
               <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                 ${approvedPoolRegs
                   .map(
                     (pr) => `
                       <div class="p-4 rounded-xl bg-slate-950 border border-emerald-500/35 flex flex-col justify-between gap-3">
                         <div class="flex items-start justify-between gap-2">
                           <div>
                             <div class="font-display font-bold text-sm text-white">${escapeHtml(pr.name)} <span class="text-blue-300 text-xs">(@${escapeHtml(pr.nick)})</span></div>
                             <div class="text-xs text-slate-300 mt-0.5">Login: <code class="text-amber-300">${escapeHtml(pr.username || '')}</code> • Preferencja: ${escapeHtml(pr.preferredLeague || 'L2')}</div>
                             ${pr.manualCreatedBy ? `<div class="text-[11px] text-slate-400 mt-0.5">Utworzył ręcznie: ${escapeHtml(pr.manualCreatedBy)} (${escapeHtml(pr.submittedAt || '')})</div>` : ''}
                           </div>
                           <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">AKTYWNY W PULI</span>
                         </div>
                         <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                           <select id="reg-league-${pr.id}" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white font-semibold">
                             ${activeAdminLeagues
                               .map((lg) => `<option value="${lg.id}" ${pr.preferredLeague === lg.id ? 'selected' : ''}>${escapeHtml(lg.shortName || lg.id)}</option>`)
                               .join('')}
                           </select>
                           <button type="button" onclick="SMPL_APP.adminAssignPoolReg('${pr.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                             ✅ Dopisz do Ligi
                           </button>
                           <button type="button" onclick="SMPL_APP.handleAdminSendPasswordReminder('${pr.id}')" class="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-xs font-bold">
                             🔑 Nowe Hasło / Kopiuj
                           </button>
                           <button type="button" onclick="SMPL_APP.adminRejectRegPrompt('${pr.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-xs font-bold">
                             ❌ Usuń
                           </button>
                         </div>
                       </div>
                     `
                   )
                   .join('')}
                 ${benchedPoolPlayers
                   .map((p) => {
                     const trCnt = Array.isArray(p.trophies) ? p.trophies.length : 0;
                     const histSeasons = p.historicalStats && p.historicalStats.seasons ? Number(p.historicalStats.seasons) : 0;
                     const histPts = p.historicalStats && p.historicalStats.points ? Number(p.historicalStats.points) : 0;
                     const histLabel = histSeasons > 0
                       ? `🏛️ S1–S55: ${histSeasons} sez. • ${histPts} pkt`
                       : (p.historicalArchiveName ? `🏛️ S1–S55: ${escapeHtml(p.historicalArchiveName)}` : '');
                     const avatarHtml = p.avatar
                       ? `<img src="${p.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-amber-400/70 flex-shrink-0" alt=""/>`
                       : `<div class="w-11 h-11 rounded-full bg-slate-800 border border-amber-400/50 flex items-center justify-center font-display font-black text-sm text-amber-300 flex-shrink-0">${escapeHtml((p.name || 'G').slice(0, 2).toUpperCase())}</div>`;
                     return `
                       <div class="p-4 rounded-xl bg-slate-950 border border-amber-400/40 flex flex-col justify-between gap-3">
                         <div class="flex items-start justify-between gap-2">
                           <div class="flex items-start gap-3 min-w-0">
                             ${avatarHtml}
                             <div class="min-w-0">
                               <div class="font-display font-bold text-sm text-white truncate">${escapeHtml(p.name)} <span class="text-blue-300 text-xs">(@${escapeHtml(p.nick || '')})</span></div>
                               <div class="text-xs text-slate-300 mt-0.5">Login: <code class="text-amber-300">${escapeHtml(p.username || '')}</code></div>
                               <div class="text-[11px] text-amber-200/90 mt-1 flex flex-wrap items-center gap-2">
                                 <span>🏆 Trofea: <strong>${trCnt}</strong></span>
                                 ${histLabel ? `<span>• ${histLabel}</span>` : ''}
                               </div>
                               ${p.leftLeagueAt ? `<div class="text-[10px] text-slate-400 mt-0.5">W puli od: ${escapeHtml(p.leftLeagueAt)}</div>` : ''}
                             </div>
                           </div>
                           <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold flex-shrink-0">KONTO W PULI</span>
                         </div>
                         <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                           <select id="pool-plr-league-${p.id}" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white font-semibold">
                             ${activeAdminLeagues
                               .map((lg) => `<option value="${lg.id}" ${lg.id === 'L2' ? 'selected' : ''}>${escapeHtml(lg.shortName || lg.id)}</option>`)
                               .join('')}
                           </select>
                           <button type="button" onclick="SMPL_APP.handleMovePlayerToLeague('${p.id}', document.getElementById('pool-plr-league-${p.id}').value)" class="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                             ✅ Przywróć do Ligi
                           </button>
                           <button type="button" onclick="SMPL_APP.handleAdminSendPasswordReminder('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-xs font-bold">
                             🔑 Hasło / Kopiuj
                           </button>
                           <button type="button" onclick="SMPL_APP.openEditPlayerModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/35 text-blue-200 border border-blue-400/40 text-xs font-bold">
                             ✏️ Edytuj
                           </button>
                           <button type="button" onclick="SMPL_APP.handleHardDeletePlayer('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-xs font-bold" title="Trwałe usunięcie konta z bazy">
                             🗑️ Usuń trwale
                           </button>
                         </div>
                       </div>
                     `;
                   })
                   .join('')}
               </div>
             </div>`
          : ''
      }

      <div class="glass-panel rounded-2xl p-5 sm:p-6 border-2 border-emerald-500/40">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-display font-bold text-[10px] uppercase">
              📋 ZGŁOSZENIA REJESTRACYJNE GRACZY
            </span>
            <h3 class="font-display font-black text-lg text-white uppercase mt-1">
              Lista Graczy Oczekujących na Zatwierdzenie (${pendingRegs.length})
            </h3>
            <p class="text-xs text-slate-300">
              Przypisz nowego gracza bezpośrednio do aktywnej dywizji (${escapeHtml(activeAdminLeagues.map((lg) => lg.shortName || lg.id).join(' / '))}) z historią S1–S55 albo zatwierdź do Puli Kont.
            </p>
          </div>
          ${
            pendingRegs.length > 0
              ? `<button type="button" onclick="SMPL_APP.handleApproveAllPendingToPool(true)" class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg transition">
                   ⚡ Zatwierdź wszystkich (${pendingRegs.length}) do Puli
                 </button>`
              : ''
          }
        </div>

        ${
          pendingRegs.length === 0
            ? `<div class="p-6 rounded-xl bg-slate-950/60 text-center text-xs text-slate-400">
                 Wszystkie zarejestrowane konta zostały już rozpatrzone.
               </div>`
            : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                 ${pendingRegs
                   .map((r) => {
                     const catalog = getArchiveCatalogList(state);
                     const declaredName = r.playedBefore && r.linkedHistoricalName ? String(r.linkedHistoricalName).trim() : '';
                     const declaredMatch = declaredName ? catalog.find((a) => a.name.toLowerCase() === declaredName.toLowerCase()) : null;
                     const autoMatch = !declaredMatch ? catalog.find((a) => a.name.toLowerCase() === String(r.name || '').trim().toLowerCase()) : null;
                     const preselectedName = declaredMatch ? declaredMatch.name : autoMatch ? autoMatch.name : '';
                     const archiveOptionsHtml = buildHistoricalSelectOptionsHtml(state, preselectedName, '🏛️ Z Archiwum S1–S55: ');
                     return `
                       <div class="rounded-2xl bg-slate-950/90 border-2 border-emerald-500/40 p-5 flex flex-col justify-between">
                         <div>
                           <div class="flex items-center justify-between gap-2 text-xs pb-3 mb-3 border-b border-white/10">
                             <span class="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-display font-bold">⏳ DO DOPISANIA • ${escapeHtml(r.preference)}</span>
                             <span class="text-slate-400">${escapeHtml(r.submittedAt)}</span>
                           </div>
                           <div class="flex items-start gap-4 mb-4">
                             <img src="${r.avatar}" class="w-16 h-16 rounded-full object-cover border-2 border-emerald-400 flex-shrink-0" alt=""/>
                             <div class="min-w-0 flex-1">
                               <div class="font-display font-black text-base text-white flex items-center gap-2 flex-wrap">
                                 <span>${escapeHtml(r.name)}</span>
                                 ${renderClanBadgeSafe(r, state, false)}
                               </div>
                               <div class="text-xs text-blue-300 font-bold">Nick: @${escapeHtml(r.nick)} • Login: <code class="text-amber-300">${escapeHtml(r.username || '')}</code></div>
                               <div class="text-xs text-slate-300 mt-1">Kontakt FB: <a href="${escapeHtml(r.fbLink)}" target="_blank" class="text-blue-400 underline">${escapeHtml(r.fbLink)}</a></div>
                               <div class="text-xs text-slate-400 mt-1">${escapeHtml(r.notes || '')}</div>
                               ${
                                 declaredName
                                   ? `<div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-[11px] font-bold text-amber-200">🏛️ Zaznaczono w S1–S55: <strong>${escapeHtml(declaredName)}</strong></div>`
                                   : autoMatch
                                   ? `<div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-[11px] font-bold text-emerald-200">🏛️ Auto-dopasowano S1–S55: <strong>${escapeHtml(autoMatch.name)}</strong></div>`
                                   : `<div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-800 border border-white/10 text-[10px] font-semibold text-slate-300">🆕 Nowy gracz (możesz dopisać historię)</div>`
                               }
                             </div>
                           </div>
                         </div>
                         <div class="space-y-2.5 pt-3 border-t border-white/10">
                           <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-400/40 space-y-2">
                             <label class="block text-[11px] font-display uppercase text-amber-300 font-black">🏛️ KROK 1: Historia S1–S55:</label>
                             <input type="text" placeholder="🔍 Filtruj listę S1–S55..." oninput="SMPL_APP.filterHistSelect('reg-hist-select-${r.id}', this.value)" class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"/>
                             <select id="reg-hist-select-${r.id}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white font-bold">
                               <option value="PRESET:DEBUT_S55" ${!preselectedName ? 'selected' : ''}>🆕 Nowy Gracz / Debiutant (0 sezonów)</option>
                               <option value="PRESET:VETERAN_2S">⚡ Pakiet: 2 sezony, 60 meczów, 1x 🥉</option>
                               <option value="PRESET:VETERAN_5S">🔥 Pakiet: 5 sezonów, 150 meczów, 🥈+🥉</option>
                               <option value="PRESET:CHAMPION_PAST">👑 Pakiet: Legenda SMPL (8 sez., 2x 👑)</option>
                               <optgroup label="--- ARCHIWUM S1–S55 ---">${archiveOptionsHtml}</optgroup>
                             </select>
                           </div>
                           <div class="grid ${activeAdminLeagues.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'} gap-2">
                             ${activeAdminLeagues
                               .map(
                                 (lg) => `<button type="button" onclick="SMPL_APP.adminAssignReg('${r.id}', '${lg.id}')" class="py-2.5 px-2.5 rounded-xl ${getLeagueSolidBtnClass(lg.id)} font-display font-black text-[11px] uppercase shadow-lg">➕ Dopisz do ${escapeHtml(lg.id === 'L1' ? 'L1' : lg.shortName || lg.id)}</button>`
                               )
                               .join('')}
                           </div>
                           <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                             <button type="button" onclick="SMPL_APP.adminApproveRegAccount('${r.id}')" class="py-2 px-2.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-200 border border-blue-400/50 font-display font-black text-[11px] uppercase">✅ Zatwierdź do Puli</button>
                             <button type="button" onclick="SMPL_APP.adminRejectRegPrompt('${r.id}')" class="py-2 px-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 text-rose-300 border border-rose-500/40 font-display font-bold text-xs uppercase">❌ Odrzuć zgłoszenie</button>
                           </div>
                         </div>
                       </div>
                     `;
                   })
                   .join('')}
               </div>`
        }
      </div>
    `;

    const passwordsHtml = `
      <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/40">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg text-white uppercase">
              🔑 Prośby o Przypomnienie Hasła Gracza (${pendingPwdReqs.length})
            </h3>
            <p class="text-xs text-slate-400">
              Kliknij <strong>[ 📨 Wyślij przypomnienie hasła ]</strong>, aby skopiować wiadomość na Messenger i wysłać powiadomienie.
            </p>
          </div>
        </div>
        ${
          pendingPwdReqs.length === 0
            ? `<div class="p-4 rounded-xl bg-slate-950/60 text-xs text-slate-400 text-center">Brak oczekujących próśb o hasło.</div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 ${pendingPwdReqs
                   .map(
                     (pr) => `
                       <div class="p-4 rounded-xl bg-slate-950 border border-amber-400/50 flex flex-col justify-between gap-3">
                         <div>
                           <div class="flex items-center justify-between text-xs text-amber-300 font-bold mb-1">
                             <span>🔑 PROŚBA O HASŁO</span>
                             <span>${escapeHtml(pr.requestedAt)}</span>
                           </div>
                           <div class="font-display font-black text-base text-white">${escapeHtml(pr.playerName)} (@${escapeHtml(pr.nick)})</div>
                           <div class="text-xs text-slate-300 mt-0.5">Login: <code class="text-amber-300">${escapeHtml(pr.username)}</code> • FB: <a href="${escapeHtml(pr.fbLink)}" target="_blank" class="text-blue-400 underline">${escapeHtml(pr.fbLink)}</a></div>
                           <div class="text-xs text-slate-400 italic mt-1">„${escapeHtml(pr.note || '')}”</div>
                         </div>
                         <div class="flex flex-wrap gap-2">
                           <button type="button" onclick="SMPL_APP.handleAdminSendPasswordReminder('${pr.playerId}')" class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase shadow-lg">📨 Wyślij przypomnienie hasła</button>
                           <button type="button" onclick="SMPL_APP.openAdminResetPasswordModal('${pr.playerId}')" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 text-xs font-bold">🔑 Ustaw nowe</button>
                         </div>
                       </div>
                     `
                   )
                   .join('')}
               </div>`
        }
      </div>
    `;

    const manualHtml = `
      <div class="glass-panel rounded-2xl p-5 sm:p-6 border-2 border-blue-500/40 bg-slate-950/90">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-display font-bold text-[10px] uppercase">
              ✍️ REJESTRACJA RĘCZNA (AWARYJNA)
            </span>
            <h3 class="font-display font-black text-lg text-white uppercase mt-1">
              Dodaj Konto Gracza Ręcznie &amp; Przygotuj Login + Hasło
            </h3>
            <p class="text-xs text-slate-300">
              Załóż konto od ręki bez czekania na rejestrację gracza, przypisz ligę lub Pulę Kont i wyślij gotowe dane logowania.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Imię i Nazwisko / Pseudonim *</label>
            <input id="manual-reg-name" type="text" maxlength="80" oninput="SMPL_APP.onManualRegIdentityInput()" placeholder="np. Marek Kowalczyk" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nick w Score! Match *</label>
            <input id="manual-reg-nick" type="text" maxlength="50" placeholder="np. MarekPro99" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Login do portalu *</label>
            <input id="manual-reg-username" type="text" maxlength="40" oninput="SMPL_APP.onManualRegUsernameManualEdit()" placeholder="np. marek.kowalczyk" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Hasło startowe</label>
            <div class="flex items-center gap-2">
              <input id="manual-reg-password" type="text" maxlength="60" placeholder="Wpisz lub Losuj" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
              <button type="button" onclick="SMPL_APP.manualRegGeneratePass()" class="px-3 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-xs font-bold flex-shrink-0">🎲 Losuj</button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Docelowa Liga / Pula *</label>
            <select id="manual-reg-target" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-blue-400/40 text-xs sm:text-sm text-white font-semibold">
              ${activeAdminLeagues
                .map((lg) => `<option value="${lg.id}">${getLeagueIconSafe(lg.id)} Dopisz od razu do: ${escapeHtml(lg.name || lg.id)}</option>`)
                .join('')}
              <option value="APPROVED_POOL">📋 Pula Aktywnych Kont (bez miejsca w tabeli)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Kontakt Messenger / FB</label>
            <input id="manual-reg-fb" type="text" maxlength="255" placeholder="https://m.me/... (opcjonalnie)" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
          </div>
          ${
            isClansUiEnabledSafe(state)
              ? `<div>
                   <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Klan / Drużyna</label>
                   <select id="manual-reg-clan" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold">
                     <option value="NONE">— Bez klanu —</option>
                     ${recruitmentClansList.map((c) => `<option value="${escapeHtml(c.id)}">[${escapeHtml(c.tag || '')}] ${escapeHtml(c.name)}</option>`).join('')}
                   </select>
                 </div>`
              : ''
          }
          <div>
            <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Historia S1–S55 (opcjonalnie)</label>
            <select id="manual-reg-hist" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold">
              <option value="">🆕 Nowy gracz (bez archiwum S1–S55)</option>
              ${buildHistoricalSelectOptionsHtml(state, '', '🏛️ Archiwum S1–S55: ')}
            </select>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
          <p class="text-[11px] text-slate-400">💡 Wolny slot <strong>WOLNY LOS</strong> zostanie automatycznie zastąpiony nowym graczem.</p>
          <button type="button" onclick="SMPL_APP.handleAdminManualRegisterSubmit()" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display font-black uppercase">
            ✍️ Utwórz Konto i Pokaż Login + Hasło
          </button>
        </div>
      </div>
    `;

    const rosterHtml = `
      <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
        <div class="flex flex-col gap-3 pb-4 mb-4 border-b border-white/10">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="font-display font-black text-lg text-white uppercase">
                ⚽ Kadra Zawodników — ${escapeHtml((curLeagueObj && curLeagueObj.name) || activeLeagueId)} (${leaguePlayers.length} graczy)
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Przełączaj ligę jednym kliknięciem i zarządzaj składem, przenosinami, hasłami, karami oraz terminarzem.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              ${activeAdminLeagues
                .map((lg) => {
                  const cnt = state.players.filter((p) => p.leagueId === lg.id && p.active !== false).length;
                  return `<button type="button" onclick="SMPL_APP.setAdminLeagueQuick('${escapeHtml(lg.id)}')" class="px-3 py-1.5 rounded-xl text-xs font-display font-bold uppercase transition ${
                    lg.id === activeLeagueId ? 'btn-league shadow' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/15'
                  }">${getLeagueIconSafe(lg.id)} ${escapeHtml(lg.shortName || lg.id)} (${cnt})</button>`;
                })
                .join('')}
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="SMPL_APP.openAddPlayerModal('${activeLeagueId}')" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase shadow-lg">
              ➕ Dodaj Gracza do ${escapeHtml((curLeagueObj && curLeagueObj.shortName) || activeLeagueId)}
            </button>
            <button type="button" onclick="SMPL_APP.adminAddByeSlot('${activeLeagueId}')" class="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-200 border border-emerald-400/40 font-display font-bold text-xs uppercase transition" title="Dodaj slot WOLNY LOS do wyrównania parzystości lub rezerwacji miejsca (2:0/0:2 WO)">
              🤖 + WOLNY LOS
            </button>
            <button type="button" onclick="SMPL_APP.openDraftBucketsModal()" class="px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 text-purple-100 border border-purple-400/50 font-display font-bold text-xs uppercase transition">
              🎲 Koszyki &amp; Draft Live
            </button>
            <button type="button" onclick="SMPL_APP.adminRegenerateSchedule('${activeLeagueId}', false)" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-display font-bold text-xs uppercase transition">
              🗓️ Wygeneruj Terminarz
            </button>
            <button type="button" onclick="SMPL_APP.adminClearSchedule('${activeLeagueId}')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-white border border-amber-500/40 text-xs font-display font-bold uppercase transition">
              🗑️ Wyzeruj Terminarz
            </button>
            <button type="button" onclick="SMPL_APP.handleClearSingleLeague('${activeLeagueId}')" class="px-3.5 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-500/40 text-xs font-bold transition">
              🧹 Wyczyść Ligę
            </button>
          </div>
        </div>

        ${
          leaguePlayers.length === 0
            ? `<div class="p-10 rounded-2xl bg-slate-950/70 border-2 border-dashed border-white/15 text-center text-slate-400">
                 <div class="text-4xl mb-2">⚽</div>
                 <div class="font-display font-bold text-white text-base uppercase">Liga ${escapeHtml((curLeagueObj && curLeagueObj.shortName) || activeLeagueId)} jest obecnie pusta</div>
                 <button type="button" onclick="SMPL_APP.openAddPlayerModal('${activeLeagueId}')" class="btn-league mt-4 px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                   ➕ Dodaj Pierwszego Gracza
                 </button>
               </div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                 ${leaguePlayers
                   .map((p) => {
                     const linkedAdm =
                       window.SMPL_DB && typeof window.SMPL_DB.findAdminForPlayer === 'function'
                         ? window.SMPL_DB.findAdminForPlayer(p, state)
                         : null;
                     return `
                       <div class="p-4 rounded-xl bg-slate-950/90 border border-white/10 flex flex-col justify-between gap-3 shadow-md hover:border-white/20 transition">
                         <div class="flex items-center justify-between gap-3">
                           <div class="flex items-center gap-3 min-w-0">
                             <img src="${p.avatar}" class="w-12 h-12 rounded-full object-cover border border-white/20 flex-shrink-0" alt=""/>
                             <div class="min-w-0">
                               <div class="font-bold text-white text-sm truncate flex items-center gap-1.5 flex-wrap">
                                 <span>${escapeHtml(p.name)}</span>
                                 ${linkedAdm ? `<span class="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/50 text-[10px] font-bold">${linkedAdm.role === 'MASTER_ADMIN' ? '👑 MASTER ADMIN' : '🛡️ ADMIN'}</span>` : ''}
                                 ${p.isPlaceholder ? `<span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold">WOLNE MIEJSCE</span>` : ''}
                                 ${p.penaltyPoints > 0 ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">-${p.penaltyPoints} pkt</span>` : ''}
                               </div>
                               ${p.penaltyPoints > 0 ? `<div class="mt-1 p-1.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-[10px] text-rose-200 break-words">⚖️ <strong>-${p.penaltyPoints} pkt</strong> (${escapeHtml(p.penaltyBy || 'Zarząd')}) — ${escapeHtml(p.penaltyReason || 'Decyzja Komisji Ligi')}</div>` : ''}
                               <div class="text-xs text-slate-400 truncate flex items-center gap-1.5 flex-wrap">
                                 <span>@${escapeHtml(p.nick)} • Trofea: <strong class="text-amber-300">🏆 ${(p.trophies || []).length}</strong></span>
                                 ${renderClanBadgeSafe(p, state, true)}
                               </div>
                               <div class="text-[11px] text-slate-400 mt-0.5">
                                 Login: <code class="text-blue-300">${escapeHtml(p.username || '')}</code> • Hasło: <span class="text-emerald-300 font-semibold">🔒 Zaszyfrowane</span>
                               </div>
                               ${
                                 p.historicalArchiveName || (p.historicalStats && p.historicalStats.matches > 0)
                                   ? `<div class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-[10px] font-bold text-amber-300">🏛️ S1–S55: ${escapeHtml(p.historicalArchiveName || p.name)}${p.historicalStats && p.historicalStats.seasons ? ' (' + p.historicalStats.seasons + ' sez.)' : ''}</div>`
                                   : `<div class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-[10px] text-slate-400">🆕 Brak przypisanej historii S1–S55</div>`
                               }
                             </div>
                           </div>
                         </div>

                         <div class="flex flex-wrap items-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-900/80 border border-white/5 text-[11px]">
                           <span class="text-slate-400 font-bold uppercase text-[10px]">Przenieś do:</span>
                           ${activeAdminLeagues
                             .filter((lg) => lg.id !== activeLeagueId)
                             .map((lg) => `<button type="button" onclick="SMPL_APP.handleMovePlayerToLeague('${p.id}', '${lg.id}')" class="px-2 py-0.5 rounded ${getLeagueChipBtnClass(lg.id)} font-bold">${getLeagueIconSafe(lg.id)} ${escapeHtml(lg.shortName || lg.id)}</button>`)
                             .join('')}
                           <button type="button" onclick="SMPL_APP.handleDeletePlayer('${p.id}')" class="ml-auto px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 font-bold">❌ Usuń</button>
                         </div>

                         <div class="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                           <button type="button" onclick="SMPL_APP.openAssignHistoricalStatsModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-[11px] font-bold">🏛️ Statystyki S1–S55</button>
                           <button type="button" onclick="SMPL_APP.handleAdminSendPasswordReminder('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">📨 Przypomnij hasło</button>
                           <button type="button" onclick="SMPL_APP.openAdminResetPasswordModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold">🔑 Hasło</button>
                           <button type="button" onclick="SMPL_APP.openAwardTrophyModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/35 text-blue-300 border border-blue-500/40 text-[11px] font-bold">🏆 +Trofeum</button>
                           <button type="button" onclick="SMPL_APP.openDeductPointsModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-500/40 text-[11px] font-bold">⚖️ Odejmij PKT</button>
                           <button type="button" onclick="SMPL_APP.openEditPlayerModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[11px] font-semibold">✏️ Edytuj</button>
                           ${!p.isPlaceholder ? `<button type="button" onclick="SMPL_APP.openReplacePlayerModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 text-[11px] font-bold">🔄 Zastępstwo</button>` : ''}
                           ${isMasterOwner && !p.isPlaceholder && !linkedAdm ? `<button type="button" onclick="SMPL_APP.openMasterGrantPlayerAdminModal('${p.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-300 border border-amber-400/50 text-[11px] font-bold">👑 Nadaj Admina</button>` : ''}
                         </div>
                       </div>
                     `;
                   })
                   .join('')}
               </div>`
        }
      </div>
    `;

    return `
      <div class="space-y-5">
        <div class="glass-panel rounded-2xl p-3.5 border border-white/10 flex flex-wrap items-center gap-1.5">
          ${subBtn('all', '📋 Wszystko', pendingTotal + pendingPwdReqs.length)}
          ${subBtn('pending', '⏳ Zapisy &amp; Pula', pendingTotal)}
          ${subBtn('passwords', '🔑 Prośby o Hasło', pendingPwdReqs.length)}
          ${subBtn('roster', '⚽ Kadry Lig', totalRosterPlayers)}
          ${subBtn('manual', '✍️ Ręczne Konto', null)}
        </div>
        ${showAll || recSub === 'pending' ? poolAndPendingHtml : ''}
        ${showAll || recSub === 'passwords' ? passwordsHtml : ''}
        ${showAll || recSub === 'roster' ? rosterHtml : ''}
        ${showAll || recSub === 'manual' ? manualHtml : ''}
      </div>
    `;
  }

  function renderSettingsSubTab(state, activeAdminLeagues, allAdminLeagues, session, myAdminAcc, isMasterOwner, opts) {
    const setSub = (opts && opts.settingsSubTab) || 'account';
    const subBtn = (id, label) => `
      <button type="button" onclick="SMPL_APP.setAdminSettingsSubTab('${id}')" class="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase transition ${
        setSub === id ? 'btn-league shadow-md' : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-white/15'
      }">${label}</button>
    `;

    let sectionHtml = '';
    if (setSub === 'account') {
      sectionHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/30">
            <h3 class="font-display font-black text-lg text-white uppercase mb-1">🔐 Zmień mój Login i Hasło Administratora</h3>
            <p class="text-xs text-slate-300 mb-4">Hasło zostaje bezpiecznie zahashowane na serwerze i nie jest widoczne w bazie.</p>
            <form onsubmit="SMPL_APP.handleUpdateAdminCredentials(event)" class="space-y-3.5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nowy Login Administratora *</label>
                  <input id="adm-cred-new-user" type="text" required value="${escapeHtml(myAdminAcc && myAdminAcc.username ? myAdminAcc.username : '')}" placeholder="Wpisz swój nowy login..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold"/>
                </div>
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Email kontaktowy (opcjonalnie)</label>
                  <input id="adm-cred-new-email" type="email" value="${escapeHtml(myAdminAcc && myAdminAcc.email ? myAdminAcc.email : '')}" placeholder="np. twoj@email.pl" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Obecne hasło *</label>
                  <input id="adm-cred-current-pass" type="password" required placeholder="Potwierdź obecne..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
                </div>
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nowe hasło (min. 6 zn.)</label>
                  <input id="adm-cred-new-pass" type="password" placeholder="Pozostaw puste bez zmian" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
                </div>
                <div>
                  <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Powtórz nowe hasło</label>
                  <input id="adm-cred-new-pass2" type="password" placeholder="Powtórz nowe hasło" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white"/>
                </div>
              </div>
              <div class="flex justify-end pt-1">
                <button type="submit" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display uppercase font-black shadow-lg">💾 Zapisz mój Login i Hasło</button>
              </div>
            </form>
          </div>
          <div class="lg:col-span-5">${renderPortalAccessUrlsCard(isMasterOwner)}</div>
        </div>
      `;
    } else if (setSub === 'leagues') {
      sectionHtml = `
        <div class="space-y-6">
          <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-500/30">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 class="font-display font-black text-lg text-white uppercase">🏟️ Zarządzanie Ligami (Dodaj / Włącz / Ukryj)</h3>
                <p class="text-xs text-slate-300 mt-0.5">Aktywuj kolejne ligi lub utwórz nową dywizję jednym kliknięciem.</p>
              </div>
              <button type="button" onclick="SMPL_APP.openAddLeagueModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-display font-black uppercase shadow-lg transition shrink-0">➕ Dodaj następną ligę</button>
            </div>
            <div class="space-y-2.5">
              ${allAdminLeagues
                .map((lg) => {
                  const pCnt = state.players.filter((p) => p.leagueId === lg.id && p.active !== false).length;
                  const isCore = lg.id === 'L1' || lg.id === 'L2';
                  return `
                    <div class="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-2.5">
                        <img src="${getLeagueCrestSafe(state, lg)}" class="w-8 h-9 object-contain" alt="${escapeHtml(lg.shortName)}"/>
                        <div>
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="font-display font-bold text-xs text-white">${escapeHtml(lg.name)}</span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-display font-bold uppercase ${lg.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-white/10'}">${lg.enabled ? '✅ Aktywna' : '🙈 Ukryta'}</span>
                          </div>
                          <div class="text-[11px] text-slate-400">Kod: <strong>${escapeHtml(lg.id)}</strong> • Graczy: <strong>${pCnt}</strong></div>
                        </div>
                      </div>
                      <div>
                        ${
                          isCore
                            ? `<span class="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-400/30 text-[10px] font-bold uppercase">🔒 Liga podstawowa</span>`
                            : lg.enabled
                            ? `<button type="button" onclick="SMPL_APP.handleToggleLeagueEnabled('${lg.id}', false)" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-600/40 text-slate-200 hover:text-white border border-white/15 text-[11px] font-bold transition">🙈 Ukryj ligę</button>`
                            : `<button type="button" onclick="SMPL_APP.handleToggleLeagueEnabled('${lg.id}', true)" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-display font-bold uppercase transition">🔓 Włącz ${escapeHtml(lg.id)}</button>`
                        }
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>

          <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
            <h3 class="font-display font-black text-base text-white uppercase mb-3">🛡️ Oficjalne Herby Aktywnych Lig SMPL (${activeAdminLeagues.length})</h3>
            <div class="grid ${activeAdminLeagues.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'} gap-4">
              ${activeAdminLeagues
                .map((lObj) => `
                  <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/15 text-center flex flex-col items-center">
                    <img src="${getLeagueCrestSafe(state, lObj)}" class="w-20 h-24 object-contain mb-3" alt="${escapeHtml(lObj.shortName)}"/>
                    <div class="font-display font-bold text-xs text-white mb-2">${escapeHtml(lObj.shortName)}</div>
                    <label class="w-full py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer border border-white/10">
                      📤 Zmień herb
                      <input type="file" accept="image/*" class="hidden" onchange="SMPL_APP.handleCustomCrestUpload('${lObj.id}', event)"/>
                    </label>
                  </div>
                `)
                .join('')}
            </div>
          </div>
        </div>
      `;
    } else if (setSub === 'webhooks') {
      const wh = typeof window !== 'undefined' && window._smplAdminWebhooksCache ? window._smplAdminWebhooksCache : {};
      const ev = wh.events || {};
      const evChecked = (k1, k2) => (ev[k1] !== undefined ? ev[k1] !== false : ev[k2] !== false);
      const hasTgFlag = Boolean(wh.hasTelegram || wh.hasTelegramToken || wh.telegramTokenMasked);
      sectionHtml = `
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-blue-500/35 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <h3 class="font-display font-black text-lg text-blue-300 uppercase">🔔 Powiadomienia Live: Discord &amp; Telegram Webhooks</h3>
              <p class="text-xs text-slate-400">Automatyczne komunikaty na kanał publiczny i kanał Zarządu oraz ręczny Broadcast.</p>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="SMPL_APP.adminLoadWebhooksPanel()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/15 text-[11px] font-bold">🔄 Wczytaj Konfig</button>
              <button type="button" onclick="SMPL_APP.adminTestWebhooks()" class="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 text-purple-100 border border-purple-400/40 text-[11px] font-bold">🧪 Wyślij Test</button>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 text-[11px]">
            <span class="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 ${wh.hasDiscordPublic ? 'text-emerald-300' : 'text-slate-400'}">
              Discord Public: <strong>${wh.hasDiscordPublic ? escapeHtml(wh.discordPublicMasked || 'Ustawiony') : 'Brak'}</strong>
            </span>
            <span class="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 ${wh.hasDiscordAdmin ? 'text-emerald-300' : 'text-slate-400'}">
              Discord Admin: <strong>${wh.hasDiscordAdmin ? escapeHtml(wh.discordAdminMasked || 'Ustawiony') : 'Brak'}</strong>
            </span>
            <span class="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 ${hasTgFlag ? 'text-emerald-300' : 'text-slate-400'}">
              Telegram Bot: <strong>${hasTgFlag ? escapeHtml(wh.telegramTokenMasked || 'Ustawiony') : 'Brak'}</strong>
            </span>
          </div>

          <form onsubmit="SMPL_APP.adminSaveWebhooks(event)" class="p-4 rounded-xl bg-slate-950/85 border border-white/10 space-y-3 text-xs">
            <label class="flex items-center gap-2 font-bold text-white cursor-pointer">
              <input name="enabled" type="checkbox" ${wh.enabled ? 'checked' : ''} class="w-4 h-4 rounded"/>
              <span>Włącz Webhooks Serwerowe</span>
            </label>
            <div class="flex flex-wrap items-center gap-4 pt-1 border-t border-white/10">
              <label class="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input name="matchSubmitted" type="checkbox" ${evChecked('matchSubmitted', 'onMatchApproved') ? 'checked' : ''}/> <span>Wyniki / Walkowery</span></label>
              <label class="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input name="newRegistration" type="checkbox" ${evChecked('newRegistration', 'onWalkover') ? 'checked' : ''}/> <span>Nowe rejestracje</span></label>
              <label class="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input name="roundReleased" type="checkbox" ${evChecked('roundReleased', 'onTotw') ? 'checked' : ''}/> <span>Nowe kolejki / TOTW</span></label>
              <label class="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input name="tribunalVerdict" type="checkbox" ${evChecked('tribunalVerdict', 'onDispute') ? 'checked' : ''}/> <span>Werdykty Trybunału</span></label>
              <label class="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input name="puskasOrGb" type="checkbox" ${ev.puskasOrGb !== false ? 'checked' : ''}/> <span>Złota Piłka / Puskás</span></label>
              <label class="flex items-center gap-1.5 text-slate-300 cursor-pointer"><input name="disputeSubmitted" type="checkbox" ${evChecked('disputeSubmitted', 'onDispute') ? 'checked' : ''}/> <span>Spory VAR</span></label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Discord Publiczny Webhook URL</label>
                <input name="discordPublicUrl" type="text" value="" placeholder="${escapeHtml(wh.hasDiscordPublic ? 'Zapisano: ' + (wh.discordPublicMasked || '***') + ' (zostaw puste, aby zachować)' : 'https://discord.com/api/webhooks/...')}" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
                <label class="inline-flex items-center gap-1.5 mt-1 text-[11px] text-rose-300 cursor-pointer"><input name="clearDiscordPublic" type="checkbox"/> <span>Wyczyść publiczny URL</span></label>
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Discord Admin Webhook URL</label>
                <input name="discordAdminUrl" type="text" value="" placeholder="${escapeHtml(wh.hasDiscordAdmin ? 'Zapisano: ' + (wh.discordAdminMasked || '***') + ' (zostaw puste, aby zachować)' : 'https://discord.com/api/webhooks/...')}" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
                <label class="inline-flex items-center gap-1.5 mt-1 text-[11px] text-rose-300 cursor-pointer"><input name="clearDiscordAdmin" type="checkbox"/> <span>Wyczyść admin URL</span></label>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Telegram Bot Token</label>
                <input name="telegramBotToken" type="text" value="" placeholder="${escapeHtml(hasTgFlag ? 'Zapisano: ' + (wh.telegramTokenMasked || '***') + ' (puste = bez zmian)' : '123456:ABC...')}" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Telegram Chat ID</label>
                <input name="telegramChatId" type="text" value="${escapeHtml(wh.telegramChatId || '')}" placeholder="np. -100123456789" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
              </div>
            </div>
            <label class="inline-flex items-center gap-1.5 text-[11px] text-rose-300 cursor-pointer"><input name="clearTelegram" type="checkbox"/> <span>Wyczyść Telegram</span></label>

            <div>
              <button type="submit" class="btn-league px-4 py-2 rounded-xl font-display font-black uppercase">💾 Zapisz Konfigurację Webhooków</button>
            </div>
          </form>

          <form onsubmit="SMPL_APP.adminBroadcastWebhook(event)" class="p-3.5 rounded-xl bg-slate-950/75 border border-white/10 flex flex-wrap items-center gap-2 text-xs">
            <input name="title" type="text" required placeholder="Nagłówek ogłoszenia..." class="px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white font-bold flex-1 min-w-[160px]"/>
            <input name="message" type="text" required placeholder="Treść komunikatu na Discord / Telegram..." class="px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white flex-1 min-w-[200px]"/>
            <button type="submit" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-display font-bold uppercase">📣 Wyślij Broadcast</button>
          </form>
        </div>
      `;
    } else if (setSub === 'backups') {
      const snaps = typeof window !== 'undefined' && Array.isArray(window._smplAdminSnapshotsCache) ? window._smplAdminSnapshotsCache : [];
      const maintOn = Boolean(
        state &&
          state.portalSettings &&
          state.portalSettings.maintenanceMode &&
          (typeof state.portalSettings.maintenanceMode === 'object' ? state.portalSettings.maintenanceMode.enabled : state.portalSettings.maintenanceMode)
      );
      sectionHtml = `
        <div class="space-y-6">
          <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/15 space-y-4">
            <h3 class="font-display font-black text-lg text-white uppercase">💾 Eksport Bazy, Przerwa Techniczna &amp; Snapshoty</h3>
            <div class="flex flex-wrap gap-2">
              <button type="button" onclick="SMPL_APP.exportDatabaseJson()" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-display font-bold uppercase">💾 Eksportuj Bazę JSON</button>
              <button type="button" onclick="SMPL_APP.adminRecalculateAllHistoricalStats()" class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-display font-bold uppercase">🔄 Przelicz Pełne Statystyki S1–S55</button>
              <button type="button" onclick="SMPL_APP.adminToggleMaintenanceMode(${!maintOn})" class="px-4 py-2.5 rounded-xl ${maintOn ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50'} text-xs font-display font-bold uppercase transition">${maintOn ? '🟢 Wyłącz Przerwę Techniczną' : '🚧 Włącz Przerwę Techniczną'}</button>
            </div>

            <div class="pt-4 border-t border-white/10 space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="font-display font-black text-sm text-emerald-300 uppercase">🛡️ Codzienne Kopie Zapasowe Bazy (14 Dni)</h4>
                <button type="button" onclick="SMPL_APP.adminLoadSnapshotsPanel()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/15 text-[11px] font-bold">🔄 Pobierz Listę Snapshotów</button>
              </div>
              ${
                !snaps.length
                  ? `<div class="p-3 rounded-xl bg-slate-950/75 border border-white/10 text-xs text-slate-400">Kliknij „Pobierz Listę Snapshotów”, aby wczytać zapisane kopie dzienne z serwera (<code>data/snapshots</code>).</div>`
                  : `<div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                       ${snaps
                         .map(
                           (sn) => `
                             <div class="p-2.5 rounded-xl bg-slate-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                               <div><span class="font-bold text-white">${escapeHtml(sn.name || sn)}</span>${sn.size ? `<span class="text-slate-400 ml-2">(${Math.round(Number(sn.size) / 1024)} KB)</span>` : ''}</div>
                               ${
                                 isMasterOwner
                                   ? `<button type="button" onclick="SMPL_APP.adminRestoreSnapshot('${escapeHtml(sn.name || sn).replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 font-bold">⏪ Przywróć Kopię</button>`
                                   : `<span class="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-white/10 text-[10px]">🔒 Przywracanie: tylko Master</span>`
                               }
                             </div>
                           `
                         )
                         .join('')}
                     </div>`
              }
            </div>
          </div>

          ${
            isMasterOwner
              ? `<details class="glass-panel rounded-2xl p-5 border border-rose-500/40 bg-rose-950/15">
                   <summary class="cursor-pointer font-display font-black text-sm text-rose-300 uppercase select-none">
                     ⚠️ Strefa Awaryjna (Tylko Master Admin) — Resety Bazy i Zerowanie Wyników (rozwiń ostrożnie)
                   </summary>
                   <div class="mt-4 pt-3 border-t border-rose-500/25 flex flex-wrap items-center gap-2">
                     <button type="button" onclick="SMPL_APP.handleStartFreshSeason56()" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 font-display font-bold text-xs uppercase">🔄 Wyzeruj wyniki 0:0 (Sezon ${(state && state.season) || 56})</button>
                     <button type="button" onclick="SMPL_APP.resetSeedConfirm()" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/20 font-display font-bold text-xs uppercase">📊 Przywróć dane z Excela</button>
                     <button type="button" onclick="SMPL_APP.handleClearAllTablesSeason56()" class="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-800 text-rose-200 border border-rose-500/50 font-display font-bold text-xs uppercase">⚠️ Reset całej bazy do 0</button>
                   </div>
                 </details>`
              : `<div class="glass-panel rounded-2xl p-4 border border-white/10 text-xs text-slate-400">
                   🔒 <strong>Strefa Awaryjna i Przywracanie Kopii (Snapshoty):</strong> dostępne wyłącznie dla Master Admina (Szymon Komenda) ze względów bezpieczeństwa danych ligi.
                 </div>`
          }
        </div>
      `;
    } else if (setSub === 'updates') {
      const stStudio = typeof window !== 'undefined' && window.SMPL_STUDIO ? window.SMPL_STUDIO : null;
      const latestVer = stStudio && typeof stStudio.getLatestPlayerUpdateVersion === 'function' ? stStudio.getLatestPlayerUpdateVersion(state) : 'V1.9';
      const nextMinor = stStudio && typeof stStudio.getNextUpdateVersionSuggestion === 'function' ? stStudio.getNextUpdateVersionSuggestion(state, 'minor') : 'V1.10';
      const nextMajor = stStudio && typeof stStudio.getNextUpdateVersionSuggestion === 'function' ? stStudio.getNextUpdateVersionSuggestion(state, 'major') : 'V2.0';
      const customUpdates = state && state.portalSettings && Array.isArray(state.portalSettings.playerUpdates) ? state.portalSettings.playerUpdates : [];
      sectionHtml = `
        <div id="admin-player-updates-card" class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/35 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <h3 class="font-display font-black text-lg text-amber-300 uppercase">🆕 Dziennik Zmian dla Graczy (Update V...)</h3>
              <p class="text-xs text-slate-400">Aktualna wersja: <strong class="text-emerald-300">Update ${escapeHtml(latestVer)}</strong></p>
            </div>
            <button type="button" onclick="SMPL_APP.switchTab('updates')" class="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 text-xs font-bold">👀 Zobacz Zakładkę Graczy</button>
          </div>

          <form onsubmit="SMPL_APP.adminPublishPlayerUpdate(event)" class="p-4 rounded-xl bg-slate-950/85 border border-amber-400/40 space-y-2.5 text-xs">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Numer Wersji (Update V + cyfry)</label>
                <div class="flex items-center gap-1.5">
                  <input id="admin-player-updates-version" name="version" type="text" required value="${escapeHtml(nextMinor)}" placeholder="np. V1.10" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white font-display font-bold"/>
                  <button type="button" onclick="SMPL_APP.fillNextUpdateVersion('${escapeHtml(nextMinor)}')" class="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-white/10 text-[10px] font-bold whitespace-nowrap">+0.1 (${escapeHtml(nextMinor)})</button>
                  <button type="button" onclick="SMPL_APP.fillNextUpdateVersion('${escapeHtml(nextMajor)}')" class="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-200 border border-white/10 text-[10px] font-bold whitespace-nowrap">+1.0 (${escapeHtml(nextMajor)})</button>
                </div>
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Kategoria Aktualizacji</label>
                <select name="category" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white font-semibold">
                  <option value="NOWOŚCI">✨ Nowości</option>
                  <option value="ULEPSZENIA">⚡ Ulepszenia</option>
                  <option value="TURNIEJE">🏆 Turnieje</option>
                  <option value="POPRAWKI">🛠️ Poprawki</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Tytuł Aktualizacji</label>
              <input name="title" type="text" required placeholder="Np. Nowe zasady lub poprawka" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white font-semibold"/>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Krótkie Podsumowanie (opcjonalne)</label>
              <input name="summary" type="text" placeholder="Opis dla graczy..." class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 font-bold uppercase mb-1">Lista Zmian (1 linijka = 1 punkt)</label>
              <textarea name="highlights" rows="3" required placeholder="Punkt 1&#10;Punkt 2" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white leading-relaxed"></textarea>
            </div>
            <button type="submit" class="btn-league px-4 py-2 rounded-xl font-display font-black uppercase">🚀 Opublikuj Update V... dla Graczy</button>
          </form>

          ${
            customUpdates.length
              ? `<div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                   <div class="text-[10px] text-slate-400 font-bold uppercase">Własne wpisy opublikowane z Panelu (${customUpdates.length}):</div>
                   ${customUpdates
                     .map(
                       (cu) => `
                         <div class="p-2.5 rounded-xl bg-slate-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                           <div class="min-w-0 flex-1">
                             <span class="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 font-display font-bold text-[10px] mr-1.5">Update ${escapeHtml(cu.version || '')}</span>
                             <span class="text-white font-semibold">${escapeHtml(cu.title || '')}</span>
                             <span class="text-slate-400 text-[10px] ml-1.5">(${escapeHtml(cu.date || '')})</span>
                           </div>
                           <button type="button" onclick="SMPL_APP.adminDeletePlayerUpdate('${escapeHtml(cu.id || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 font-bold text-[10px]">🗑️ Usuń</button>
                         </div>
                       `
                     )
                     .join('')}
                 </div>`
              : `<div class="text-[11px] text-slate-500">Wbudowane wydania systemowe są widoczne w zakładce graczy. Tutaj dodasz kolejne Update V...</div>`
          }
        </div>
      `;
    } else {
      sectionHtml = `
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
          <h3 class="font-display font-black text-lg text-white uppercase mb-3 pb-3 border-b border-white/10">📡 Dziennik Zdarzeń Ligi (Na Żywo)</h3>
          <div class="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            ${(state.activityLog || [])
              .map(
                (log) => `
                  <div class="p-3 rounded-xl bg-slate-950/80 border border-white/5 text-xs">
                    <div class="text-[10px] text-slate-500 font-mono-num mb-0.5">${escapeHtml(log.time)}</div>
                    <div class="text-slate-200">${escapeHtml(log.text)}</div>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="space-y-5">
        <div class="glass-panel rounded-2xl p-3.5 border border-white/10 flex flex-wrap items-center gap-1.5">
          ${subBtn('account', '🔐 Konto &amp; Linki')}
          ${subBtn('leagues', '🏟️ Ligi &amp; Herby')}
          ${subBtn('webhooks', '🔔 Webhooks Discord/TG')}
          ${subBtn('backups', '💾 Kopie &amp; Awaryjne')}
          ${subBtn('updates', '🆕 Update V...')}
          ${subBtn('logs', '📡 Dziennik Zdarzeń')}
        </div>
        ${sectionHtml}
      </div>
    `;
  }

  function renderMasterStudioSubTab(state, session, masterSubTab, uiOpts) {
    const isMaster = Boolean(session && window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session) && session.adminRole === 'MASTER_ADMIN');
    if (!isMaster) {
      return `
        <div class="glass-panel rounded-2xl p-8 text-center border border-rose-500/40">
          <div class="text-3xl mb-2">🔒</div>
          <h3 class="font-display font-black text-lg text-white uppercase">Brak dostępu — Wyłącznie dla Master Admina</h3>
        </div>
      `;
    }

    let section = 'portal';
    if (masterSubTab === 'master_ranks') section = 'ranks';
    else if (masterSubTab === 'master_leagues') section = 'leagues';
    else if (masterSubTab === 'master_backup') section = 'backup';

    const opts = uiOpts || {};
    const portalCfg = (state && state.portalSettings) || {};
    const customRanks = Array.isArray(state && state.customRanks) ? state.customRanks : [];
    const allTitles =
      window.SMPL_RANKS && typeof window.SMPL_RANKS.getAllAvailableTitles === 'function'
        ? window.SMPL_RANKS.getAllAvailableTitles(state)
        : customRanks;
    const allPlayersSorted = ((state && state.players) || [])
      .filter((p) => p && p.active !== false)
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pl'));
    const clansList =
      window.SMPL_DB && typeof window.SMPL_DB.getClansList === 'function'
        ? window.SMPL_DB.getClansList(state)
        : Array.isArray(state && state.clans)
        ? state.clans
        : [];
    const activeLeagues = getLeaguesSafe(state, false);
    const allLeagues = getLeaguesSafe(state, true);
    const pendingAdminsCount = ((state && state.admins) || []).filter((a) => a && a.status === 'PENDING').length;
    const gb = (state && state.goldenBall) || {};
    const gbVotesCount = Array.isArray(gb.votes) ? gb.votes.length : 0;
    const gbWinnerObj = gb.winnerPlayerId ? ((state && state.players) || []).find((p) => p && p.id === gb.winnerPlayerId) : null;
    const gbWinnerDisplay = (gbWinnerObj && (gbWinnerObj.name || gbWinnerObj.nick)) || gb.winnerName || '';
    const currentWeekVal = Number((state && state.weeklyConfig && state.weeklyConfig.currentWeek) || (state && state.currentWeek) || 1);
    const roundsPerWeekVal = Number((state && state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || (state && state.roundsPerWeek) || 4);

    const iconPresets = ['👑', '⚽', '🏆', '💎', '🔥', '⚡', '🌟', '🌌', '⚜️', '🎯', '🛡️', '🐐', '🐆', '☄️', '🧠', '💥', '⚔️', '🎙️', '🚀', '💀'];
    const colorPresets = ['#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#06b6d4', '#fde047'];
    const rankTemplates = [
      { label: '👑 Król Ekstraklasy', name: 'Król Ekstraklasy', icon: '👑', colorHex: '#f59e0b', styleVariant: 'METALLIC', xpBonus: 250, description: 'Elitarny monarcha najwyższej dywizji SMPL' },
      { label: '🌌 Galaktyczny Lider', name: 'Galaktyczny Lider', icon: '🌌', colorHex: '#818cf8', styleVariant: 'NEON_GLOW', xpBonus: 200, description: 'Kosmiczna forma i lider drużyny sezonu' },
      { label: '💎 Diament Zarządu', name: 'Diament Zarządu', icon: '💎', colorHex: '#06b6d4', styleVariant: 'LIQUID_GLASS', xpBonus: 200, description: 'Szczególne wyróżnienie kryształowe od Zarządu' },
      { label: '🔥 Król Finałów', name: 'Król Finałów', icon: '🔥', colorHex: '#ef4444', styleVariant: 'CHROME_OBSIDIAN', xpBonus: 300, description: 'Bezlitosny w wielkich meczach o najwyższą stawkę' },
      { label: '🦅 Orzeł Polski SM', name: 'Orzeł Polski SM', icon: '🦅', colorHex: '#10b981', styleVariant: 'HOLO_GOLD', xpBonus: 150, description: 'Reprezentant i wizytówka polskiej sceny Score! Match' },
      { label: '💜 Patron VIP', name: 'Patron VIP SMPL', icon: '💜', colorHex: '#a855f7', styleVariant: 'NEON_GLOW', xpBonus: 250, description: 'VIP wspierający rozwój i eventy Score Match Liga' }
    ];
    const rankStyles = [
      { id: 'HOLO_GOLD', label: '✨ Holograficzny Połysk (TOP)' },
      { id: 'METALLIC', label: '🥇 Szczotkowany Metal 3D' },
      { id: 'NEON_GLOW', label: '⚡ Cyber Neon Glow' },
      { id: 'LIQUID_GLASS', label: '💎 Szkło Liquid Glass' },
      { id: 'CHROME_OBSIDIAN', label: '🖤 Obsydian + Złoty Brzeg' }
    ];
    const customTitlesOnly = allTitles.filter((t) => t && t.isCustom);
    const eliteTitles = allTitles.filter((t) => !t.isCustom && t.category === 'ELITE');
    const skillTitles = allTitles.filter((t) => !t.isCustom && t.category === 'SKILL');
    const prestigeTitles = allTitles.filter((t) => !t.isCustom && (!t.category || t.category === 'PRESTIGE'));
    const selectedPlayerId = opts.masterAssignPlayerId || (allPlayersSorted[0] ? allPlayersSorted[0].id : '');
    const selectedRankId = opts.masterAssignRankId || (allTitles[0] ? allTitles[0].id : '');
    const selectedPlayerObj = allPlayersSorted.find((p) => p.id === selectedPlayerId) || allPlayersSorted[0] || null;
    const selectedTitleObj = allTitles.find((t) => t.id === selectedRankId) || allTitles[0] || null;
    const selectedPlayerCurrentHtml =
      selectedPlayerObj && window.SMPL_RANKS && typeof window.SMPL_RANKS.getPlayerRank === 'function'
        ? window.SMPL_RANKS.fullBadgesHtml(window.SMPL_RANKS.getPlayerRank(selectedPlayerObj, state), 'sm', selectedPlayerObj.id) ||
          '<span class="text-[11px] text-slate-400">Brak odznak</span>'
        : '<span class="text-[11px] text-slate-400">Wybierz zawodnika</span>';
    const selectedTitleHtml =
      selectedTitleObj && window.SMPL_RANKS && typeof window.SMPL_RANKS.titleHtml === 'function'
        ? window.SMPL_RANKS.titleHtml(selectedTitleObj)
        : '';
    const renderTitleOpt = (t) =>
      `<option value="${escapeHtml(t.id)}" ${t.id === selectedRankId ? 'selected' : ''}>${escapeHtml((t.icon || '🎖️') + ' ' + t.name + (t.isCustom ? ' [WŁASNA]' : ''))}</option>`;

    const snaps = typeof window !== 'undefined' && Array.isArray(window._smplAdminSnapshotsCache) ? window._smplAdminSnapshotsCache : [];

    let bodyHtml = '';
    if (section === 'portal') {
      bodyHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 border border-blue-500/30">
            <h4 class="font-display font-black text-base text-blue-300 uppercase mb-1">🌐 Globalne Ustawienia Portalu &amp; Komunikat Live</h4>
            <p class="text-xs text-slate-300 mb-4">Numer i nazwa sezonu, kolejka/tydzień, nagłówek strony głównej, pasek ogłoszeń oraz tryb konserwacji.</p>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Sezon Nr</label>
                <input id="master-cfg-season" type="number" min="1" max="999" value="${Number((state && state.season) || 56)}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold"/>
              </div>
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Kolejka / Tydz.</label>
                <input id="master-cfg-week" type="number" min="1" max="50" value="${currentWeekVal}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold"/>
              </div>
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Mecze / Tydz.</label>
                <input id="master-cfg-rpw" type="number" min="1" max="20" value="${roundsPerWeekVal}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold"/>
              </div>
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Nazwa Sezonu</label>
                <input id="master-cfg-season-name" type="text" value="${escapeHtml((state && state.seasonName) || 'Sezon 56')}" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold"/>
              </div>
            </div>

            <div class="space-y-3 mb-3">
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Górna Odznaka Hero Bannera</label>
                <input id="master-cfg-hero-badge" type="text" value="${escapeHtml(portalCfg.heroBadge || '⚽ SCORE MATCH LIGA (SMPL)')}" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold"/>
              </div>
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Główny Tytuł Strony (H1)</label>
                <input id="master-cfg-hero-title" type="text" value="${escapeHtml(portalCfg.heroTitle || 'SCORE MATCH LIGA — OFICJALNY PORTAL')}" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold"/>
              </div>
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Opis Portalu (Podtytuł Hero)</label>
                <textarea id="master-cfg-hero-subtitle" rows="2" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white">${escapeHtml(portalCfg.heroSubtitle || '')}</textarea>
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-amber-950/20 border border-amber-400/35 space-y-2.5 mb-3">
              <label class="flex items-center gap-2 cursor-pointer text-xs font-display font-bold text-amber-300 uppercase">
                <input id="master-cfg-announce-active" type="checkbox" ${portalCfg.announcementActive ? 'checked' : ''} class="w-4 h-4 rounded"/>
                <span>📢 Wyświetlaj Pasek Ogłoszeń nad Bannerem Głównym</span>
              </label>
              <input id="master-cfg-announce-text" type="text" value="${escapeHtml(portalCfg.announcementText || '')}" placeholder="Np. Start Sezonu 56! Gramy po 4 kolejki tygodniowo!" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-400/30 text-xs text-white font-semibold"/>
            </div>

            <div class="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/40 space-y-2.5 mb-4">
              <label class="flex items-center gap-2 cursor-pointer text-xs font-display font-bold text-rose-300 uppercase">
                <input id="master-cfg-maint-active" type="checkbox" onchange="SMPL_APP.adminToggleMaintenanceMode(this.checked)" ${portalCfg.maintenanceMode && (typeof portalCfg.maintenanceMode === 'object' ? portalCfg.maintenanceMode.enabled : portalCfg.maintenanceMode) ? 'checked' : ''} class="w-4 h-4 rounded"/>
                <span>🚧 Tryb Przerwy Technicznej (Blokuje wysyłanie wyników przez graczy)</span>
              </label>
              <input id="master-cfg-maint-msg" type="text" value="${escapeHtml((portalCfg.maintenanceMode && typeof portalCfg.maintenanceMode === 'object' ? portalCfg.maintenanceMode.message : '') || portalCfg.maintenanceMessage || '')}" placeholder="Np. Przerwa techniczna bazy SMPL..." class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-rose-500/35 text-xs text-white font-semibold"/>
            </div>

            <div class="flex justify-end">
              <button type="button" onclick="SMPL_APP.masterSavePortalSettingsSubmit()" class="btn-league px-5 py-2.5 rounded-xl text-xs font-display font-black uppercase shadow-lg">💾 Zapisz Ustawienia Globalne Portalu</button>
            </div>
          </div>

          <div class="lg:col-span-5 space-y-6">
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-purple-500/30 space-y-4">
              <div>
                <h4 class="font-display font-black text-base text-purple-300 uppercase mb-1">🏆 Kontrola Plebiscytu Złota Piłka</h4>
                <p class="text-xs text-slate-300 mb-3">
                  Status: <strong class="${gb.isOpen !== false ? 'text-emerald-300' : 'text-rose-300'}">${gb.isOpen !== false ? 'OTWARTE' : 'ZAMKNIĘTE'}</strong>
                  • Głosów: <strong class="text-white">${gbVotesCount}</strong>
                  ${gbWinnerDisplay ? ' • Zwycięzca: <strong class="text-amber-300">' + escapeHtml(gbWinnerDisplay) + '</strong>' : ''}
                </p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" onclick="SMPL_APP.masterGoldenBallAction('open')" class="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold">🟢 Otwórz Głosowanie</button>
                  <button type="button" onclick="SMPL_APP.masterGoldenBallAction('close')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[11px] font-bold">🔴 Zamknij</button>
                  <button type="button" onclick="SMPL_APP.masterGoldenBallAction('award')" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/50 text-[11px] font-bold">👑 Przyznaj Liderowi</button>
                  <button type="button" onclick="SMPL_APP.masterGoldenBallAction('clear_votes')" class="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border border-rose-400/40 text-[11px] font-bold">🧹 Wyzeruj Głosy</button>
                </div>
              </div>

              <div class="pt-4 border-t border-white/10">
                <h4 class="font-display font-bold text-sm text-amber-300 uppercase mb-2">🥇 Kontrola Typera &amp; Nagrody Puskása</h4>
                <div class="flex flex-wrap gap-2">
                  <button type="button" onclick="SMPL_APP.handleMasterCompetitionAction('typer_open')" class="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 border border-emerald-400/40 text-[11px] font-bold">🔮 Otwórz Typera</button>
                  <button type="button" onclick="SMPL_APP.handleMasterCompetitionAction('typer_close')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[11px] font-bold">🔒 Zamknij Typera</button>
                  <button type="button" onclick="SMPL_APP.handleMasterCompetitionAction('puskas_open')" class="px-2.5 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/35 text-blue-300 border border-blue-400/40 text-[11px] font-bold">🥅 Otwórz Puskása</button>
                  <button type="button" onclick="SMPL_APP.handleMasterCompetitionAction('puskas_close')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[11px] font-bold">🔒 Zamknij Puskása</button>
                  <button type="button" onclick="SMPL_APP.switchTab('competitions')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/50 text-[11px] font-bold">🏟️ Arena Konkursów</button>
                </div>
              </div>

              <div class="pt-4 border-t border-white/10 space-y-2">
                <h4 class="font-display font-bold text-sm text-emerald-300 uppercase">🚀 Przejście Sezonowe</h4>
                <div class="flex flex-wrap gap-2">
                  <button type="button" onclick="SMPL_APP.openNextSeasonRolloverModal()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase shadow-lg">🚀 Wystartuj Sezon ${((state && state.season) || 56) + 1}</button>
                  <button type="button" onclick="SMPL_APP.handleSetSeasonJoinWindow(true)" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 text-xs font-bold">🟢 Otwórz Zapisy</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${(() => {
          const allCoinsPlayers = ((state && state.players) || [])
            .filter((p) => p && !p.isPlaceholder && !p.gdprDeleted)
            .slice()
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pl'));
          const bonusMap = (state && state.competitions && state.competitions.playerShop && state.competitions.playerShop.bonusCoins) || {};
          const coinsPlOpts = allCoinsPlayers.map((p) => {
            const cInfo = window.SMPL_STUDIO && typeof window.SMPL_STUDIO.calculatePlayerCoinsBreakdown === 'function'
              ? window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, p.id)
              : { balance: 0 };
            const bVal = Number(bonusMap[p.id] || 0);
            const bTag = bVal !== 0 ? (' [bonus: ' + (bVal > 0 ? '+' : '') + bVal + ']') : '';
            const isMasterPl = Boolean(session && p.adminId && String(p.adminId) === String(session.adminId));
            return `<option value="${escapeHtml(p.id)}" ${isMasterPl ? 'selected' : ''}>${escapeHtml(p.name)}${isMasterPl ? ' [TY]' : ''} (${escapeHtml(p.leagueId || 'POOL')}) — saldo: ${cInfo.balance} Coins${bTag}</option>`;
          }).join('');
          const activeBonusChips = allCoinsPlayers
            .filter((p) => Number(bonusMap[p.id] || 0) !== 0)
            .map((p) => {
              const bVal = Number(bonusMap[p.id] || 0);
              return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-[11px] text-amber-200 font-semibold">
                <span>${escapeHtml(p.name)}: <strong class="text-white">${bVal > 0 ? '+' : ''}${bVal}</strong></span>
                <button type="button" onclick="SMPL_APP.masterResetPlayerBonusCoins('${escapeHtml(p.id)}', false)" class="text-rose-300 hover:text-white font-black" title="Wyzeruj bonus tego gracza">✕</button>
              </span>`;
            }).join('');
          return `
            <!-- SKARBIEC SMPL COINS — DOŁADOWANIE GRACZY BEZ LIMITU (TYLKO MASTER ADMIN) -->
            <div id="master-coins-vault-card" class="mt-6 glass-panel rounded-2xl p-5 sm:p-6 border-2 border-amber-400/50 bg-slate-950/90 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-display font-black text-[10px] uppercase">
                    👑 TYLKO MASTER ADMIN • ZERO LIMITU • TESTOWANIE SKLEPIKU I NAGRODY SPECJALNE
                  </span>
                  <h4 class="font-display font-black text-base sm:text-lg text-amber-300 uppercase mt-1">
                    🪙 Skarbiec SMPL Coins — Przyznawaj Coinsy Graczom Bez Limitu
                  </h4>
                  <p class="text-xs text-slate-300 mt-0.5">
                    Dodawaj dowolną liczbę SMPL Coins sobie lub wybranemu zawodnikowi (np. +5 000, +100 000 albo odejmij wpisując liczbę ujemną). Zabezpieczone wyłącznie dla Master Admina w <code>api.php</code>.
                  </p>
                </div>
                <button type="button" onclick="SMPL_APP.openCoinShopModal()" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase shadow-lg">
                  🛍️ Otwórz Sklepik Coins
                </button>
              </div>

              <form onsubmit="SMPL_APP.masterSubmitGrantCoinsForm(event, false)" class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <div class="lg:col-span-4">
                  <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">👤 Wybierz zawodnika</label>
                  <select id="master-coins-player-sel" name="playerId" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-semibold">
                    ${coinsPlOpts || '<option value="">Brak zawodników w bazie</option>'}
                  </select>
                </div>
                <div class="lg:col-span-3">
                  <label class="block text-[11px] font-display uppercase text-amber-300 mb-1 font-bold">🪙 Kwota Coins (bez limitu)</label>
                  <input id="master-coins-delta-inp" type="number" name="delta" step="1" value="5000" required placeholder="np. 10000 lub -500" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-400/45 text-xs text-amber-200 font-mono-num font-black"/>
                </div>
                <div class="lg:col-span-3">
                  <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">📝 Powód (opcjonalnie)</label>
                  <input type="text" name="reason" maxlength="140" placeholder="np. Test Sklepiku / Event SMPL" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white"/>
                </div>
                <div class="lg:col-span-2">
                  <button type="submit" class="w-full btn-league px-3.5 py-2 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                    🪙 Dodaj Coins
                  </button>
                </div>
              </form>

              <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span class="text-slate-400 font-bold uppercase text-[10px] mr-1">Szybkie doładowanie wybranego:</span>
                  <button type="button" onclick="var s=document.getElementById('master-coins-player-sel'); if(s&&s.value) SMPL_APP.masterQuickGrantCoins(s.value, 500, false);" class="px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 font-bold">+500</button>
                  <button type="button" onclick="var s=document.getElementById('master-coins-player-sel'); if(s&&s.value) SMPL_APP.masterQuickGrantCoins(s.value, 2500, false);" class="px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 font-bold">+2 500</button>
                  <button type="button" onclick="var s=document.getElementById('master-coins-player-sel'); if(s&&s.value) SMPL_APP.masterQuickGrantCoins(s.value, 10000, false);" class="px-2.5 py-1 rounded-lg bg-amber-400/25 hover:bg-amber-400/40 text-amber-100 border border-amber-400/55 font-black">+10 000</button>
                  <button type="button" onclick="var s=document.getElementById('master-coins-player-sel'); if(s&&s.value) SMPL_APP.masterQuickGrantCoins(s.value, 100000, false);" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/50 font-black">+100 000</button>
                  <button type="button" onclick="var s=document.getElementById('master-coins-player-sel'); if(s&&s.value) SMPL_APP.masterResetPlayerBonusCoins(s.value, false);" class="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 text-rose-200 border border-rose-500/40 font-bold">🧹 Wyzeruj Bonus</button>
                </div>
              </div>

              ${activeBonusChips ? `<div class="pt-2 border-t border-white/10 space-y-1.5"><div class="text-[10px] font-display font-bold uppercase text-slate-400">Gracze z aktywnym Bonusem Master Admina (kliknij ✕, aby wyzerować):</div><div class="flex flex-wrap gap-1.5">${activeBonusChips}</div></div>` : ''}
            </div>
          `;
        })()}

        ${(() => {
          const supCfg =
            window.SMPL_DB && typeof window.SMPL_DB.getSupportConfig === 'function'
              ? window.SMPL_DB.getSupportConfig(state)
              : { enabled: true, supporters: [] };
          const supList = Array.isArray(supCfg.supporters) ? supCfg.supporters : [];
          return `
            <!-- KONFIGURATOR ZAKŁADKI DOBROWOLNEGO WSPARCIA (DONATE — TYLKO MASTER ADMIN) -->
            <div id="master-support-config-card" class="mt-6 glass-panel rounded-2xl p-5 sm:p-6 border-2 border-amber-400/40 bg-slate-950/90 space-y-5">
              <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                  <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-display font-black text-[10px] uppercase">
                    🔒 TYLKO MASTER ADMIN — ZABEZPIECZONE NA SERWERZE PRZED PODMIANĄ LINKÓW
                  </span>
                  <h4 class="font-display font-black text-base sm:text-lg text-amber-300 uppercase mt-1">
                    ☕ Konfigurator Zakładki „Wesprzyj Ligę / Postaw Kawę” (Donate)
                  </h4>
                  <p class="text-xs text-slate-300 mt-0.5">
                    Wklej swój link BuyCoffee.to, Suppi.pl/Tipply, PayPal lub BLIK. Żaden gracz ani współadmin nie może zmienić tych danych (twarda blokada w <code>api.php</code>).
                  </p>
                </div>
                <button type="button" onclick="SMPL_APP.switchTab('support')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/45 text-xs font-display font-bold uppercase">
                  👁️ Podgląd Zakładki Wsparcia
                </button>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Lewa kolumna: Linki i Cel -->
                <form onsubmit="SMPL_APP.masterSaveSupportConfig(event)" class="lg:col-span-7 space-y-3">
                  <div class="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-900/80 border border-white/10">
                    <label class="inline-flex items-center gap-2 text-xs font-bold text-emerald-300 cursor-pointer">
                      <input id="master-sup-enabled" type="checkbox" ${supCfg.enabled !== false ? 'checked' : ''} class="w-4 h-4 accent-emerald-500"/>
                      <span>Pokaż zakładkę ☕ Wesprzyj Ligę w menu portalu</span>
                    </label>
                    <label class="inline-flex items-center gap-2 text-xs font-bold text-amber-200 cursor-pointer">
                      <input id="master-sup-admin-enabled" type="checkbox" ${supCfg.adminSupportEnabled !== false ? 'checked' : ''} class="w-4 h-4 accent-amber-400"/>
                      <span>Pokaż kartę Administracji Ligi</span>
                    </label>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[11px] font-display uppercase text-amber-300 mb-1 font-bold">☕ Link BuyCoffee.to (zalecane)</label>
                      <input id="master-sup-buycoffee" type="url" value="${escapeHtml(supCfg.buyCoffeeUrl || '')}" placeholder="https://buycoffee.to/twojnick" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-400/35 text-xs text-white"/>
                    </div>
                    <div>
                      <label class="block text-[11px] font-display uppercase text-emerald-300 mb-1 font-bold">⚡ Link Suppi.pl / Tipply (BLIK 0%)</label>
                      <input id="master-sup-suppi" type="url" value="${escapeHtml(supCfg.suppiUrl || '')}" placeholder="https://suppi.pl/twojnick" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-400/35 text-xs text-white"/>
                    </div>
                    <div>
                      <label class="block text-[11px] font-display uppercase text-blue-300 mb-1 font-bold">💙 Link PayPal.me / Revolut (opcjonalny)</label>
                      <input id="master-sup-paypal" type="url" value="${escapeHtml(supCfg.paypalUrl || '')}" placeholder="https://paypal.me/twojnick" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-blue-400/30 text-xs text-white"/>
                    </div>
                    <div>
                      <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">📱 Opcjonalnie: BLIK na tel. / nr konta</label>
                      <input id="master-sup-blik" type="text" maxlength="120" value="${escapeHtml(supCfg.blikInfo || '')}" placeholder="np. BLIK: 600-XXX-XXX (zostaw puste, jeśli wolisz link)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white"/>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="sm:col-span-2">
                      <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">⛽ Tytuł Paska Celu (Utrzymanie Areny)</label>
                      <input id="master-sup-goal-title" type="text" maxlength="140" value="${escapeHtml(supCfg.goalTitle || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white"/>
                    </div>
                    <div>
                      <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">📅 Okres Celu</label>
                      <input id="master-sup-goal-period" type="text" maxlength="60" value="${escapeHtml(supCfg.goalPeriod || '')}" placeholder="np. Cel na Sezon 56" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white"/>
                    </div>
                    <div>
                      <label class="block text-[11px] font-display uppercase text-amber-300 mb-1 font-bold">🎯 Kwota Celu (zł)</label>
                      <input id="master-sup-goal-amt" type="number" min="0" max="50000" value="${Number(supCfg.goalAmount || 0)}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-400/30 text-xs text-white font-mono-num font-bold"/>
                    </div>
                    <div>
                      <label class="block text-[11px] font-display uppercase text-emerald-300 mb-1 font-bold">💰 Zebrano Dotychczas (zł)</label>
                      <input id="master-sup-cur-amt" type="number" min="0" max="50000" value="${Number(supCfg.currentAmount || 0)}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-emerald-400/30 text-xs text-white font-mono-num font-bold"/>
                    </div>
                    <div>
                      <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">🛡️ Osobny link dla Adminów (opcj.)</label>
                      <input id="master-sup-admin-url" type="url" value="${escapeHtml(supCfg.adminSupportUrl || '')}" placeholder="https://..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white"/>
                    </div>
                  </div>

                  <div>
                    <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">📣 Nagłówek Zakładki Wsparcia</label>
                    <input id="master-sup-headline" type="text" maxlength="120" value="${escapeHtml(supCfg.headline || '')}" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-bold"/>
                  </div>
                  <div>
                    <label class="block text-[11px] font-display uppercase text-slate-300 mb-1 font-bold">✍️ Krótki opis (dlaczego warto wesprzeć)</label>
                    <textarea id="master-sup-intro" rows="2" maxlength="600" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white">${escapeHtml(supCfg.intro || '')}</textarea>
                  </div>

                  <div class="flex justify-end pt-1">
                    <button type="submit" class="btn-league px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                      💾 Zapisz Konfigurację Donate
                    </button>
                  </div>
                </form>

                <!-- Prawa kolumna: Ściana Mecenasów + Wskazówka Prawno-Podatkowa -->
                <div class="lg:col-span-5 space-y-4">
                  <form onsubmit="SMPL_APP.masterAddSupporter(event)" class="p-4 rounded-2xl bg-slate-900/80 border border-amber-400/30 space-y-2.5">
                    <div class="font-display font-black text-xs text-amber-300 uppercase">🏆 Dodaj Podziękowanie na Ścianę Mecenasów</div>
                    <p class="text-[11px] text-slate-400">Dodaj nick wyłącznie za zgodą wspierającego (lub wpisz „Anonimowy Kibic SMPL”).</p>
                    <div class="grid grid-cols-3 gap-2">
                      <input id="master-sup-add-name" type="text" maxlength="60" placeholder="Nick / Imię *" required class="col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
                      <select id="master-sup-add-badge" class="px-2 py-2 rounded-xl bg-slate-950 border border-amber-400/35 text-xs text-white font-bold">
                        <option value="☕">☕ Kawa</option>
                        <option value="🍕">🍕 Pizza</option>
                        <option value="🏟️">🏟️ Arena</option>
                        <option value="👑">👑 Mecenas</option>
                        <option value="💛">💛 Wsparcie</option>
                      </select>
                    </div>
                    <input id="master-sup-add-note" type="text" maxlength="160" placeholder="Opcjonalne podziękowanie np. Dzięki za paliwo na serwer!" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
                    <button type="submit" class="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-xs uppercase shadow">
                      ➕ Dodaj Podziękowanie
                    </button>
                  </form>

                  <div class="p-3.5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2 max-h-48 overflow-y-auto">
                    <div class="text-[11px] font-display font-bold uppercase text-slate-300">Aktywne wpisy na Ścianie (${supList.length}):</div>
                    ${
                      supList.length === 0
                        ? '<div class="text-[11px] text-slate-500">Brak wpisów.</div>'
                        : supList
                            .map(
                              (s) => `
                                <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-white/5 text-xs">
                                  <div class="truncate">
                                    <span>${escapeHtml(s.badge || '☕')}</span>
                                    <strong class="text-white ml-1">${escapeHtml(s.displayName)}</strong>
                                    <span class="text-[10px] text-slate-400 ml-1">${escapeHtml(s.date || '')}</span>
                                  </div>
                                  <button type="button" onclick="SMPL_APP.masterRemoveSupporter('${escapeHtml(s.id)}')" class="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] font-bold">🗑️</button>
                                </div>
                              `
                            )
                            .join('')
                    }
                  </div>

                  <div class="p-3.5 rounded-2xl bg-emerald-950/35 border border-emerald-500/35 text-[11px] text-emerald-100 leading-relaxed space-y-1">
                    <div class="font-display font-black text-emerald-300 uppercase">⚖️ Ściąga Prawno-Podatkowa dla Twórcy:</div>
                    <div>• <strong>Najbezpieczniejszy serwis w PL:</strong> załóż darmowe konto na <strong>Suppi.pl</strong> (0% prowizji + BLIK) albo <strong>BuyCoffee.to</strong> i wklej link powyżej — nie musisz podawać publicznie swojego numeru telefonu ani konta!</div>
                    <div>• <strong>Złota zasada skarbówki:</strong> NIGDY nie obiecuj rang, punktów ani przywilejów w zamian za wpłatę — wtedy jest to czysta darowizna (art. 888 k.c.), zwolniona z podatku aż do <strong>5 733 zł od jednej osoby w ciągu 5 lat</strong> (III grupa podatkowa).</div>
                  </div>
                </div>
              </div>
            </div>
          `;
        })()}
      `;
    } else if (section === 'ranks') {
      bodyHtml = `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/30">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h4 class="font-display font-black text-base text-amber-300 uppercase">🎖️ Kreator Własnych Rang &amp; Tytułów TOP</h4>
                <p class="text-xs text-slate-300 mt-0.5">Twórz rangi ze stylem (Holo / Metal / Neon / Szkło / Obsydian) i bonusem XP.</p>
              </div>
              <span id="master-rank-preview" class="smpl-title tt-custom tt-var-holo" style="border-color:#f59e0b;color:#ffffff;background:linear-gradient(135deg,#f59e0b52 0%,rgba(15,23,42,0.92) 52%,#f59e0b3a 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.45),0 4px 14px -3px #f59e0b88">
                <span class="rk-ico">👑</span><span class="rk-txt">Przykładowa Ranga</span>
              </span>
            </div>

            <div class="mb-3 p-2.5 rounded-xl bg-slate-950/75 border border-amber-400/30">
              <div class="text-[10px] font-display font-bold uppercase text-amber-300 mb-1.5">✨ Szablony 1-klik:</div>
              <div class="flex flex-wrap gap-1.5">
                ${rankTemplates
                  .map(
                    (tpl) => `<button type="button" onclick="SMPL_APP.masterApplyRankTemplate('${escapeHtml(tpl.name)}','${escapeHtml(tpl.icon)}','${escapeHtml(tpl.colorHex)}','${escapeHtml(tpl.styleVariant)}',${Number(tpl.xpBonus)},'${escapeHtml(tpl.description)}')" class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-[11px] font-bold text-slate-200 transition">${escapeHtml(tpl.label)} (+${tpl.xpBonus})</button>`
                  )
                  .join('')}
              </div>
            </div>

            <input id="master-rank-id" type="hidden" value=""/>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Nazwa Rangi *</label>
                <input id="master-rank-name" type="text" maxlength="32" oninput="SMPL_APP.masterPreviewRank()" placeholder="np. Wódz Polskiego SM" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Ikona / Emoji</label>
                <input id="master-rank-icon" type="text" maxlength="6" value="👑" oninput="SMPL_APP.masterPreviewRank()" class="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-semibold"/>
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Styl Wykończenia</label>
                <select id="master-rank-style" onchange="SMPL_APP.masterPreviewRank()" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-400/35 text-xs sm:text-sm text-white font-bold">
                  ${rankStyles.map((stOpt) => `<option value="${escapeHtml(stOpt.id)}">${escapeHtml(stOpt.label)}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 mb-3">
              ${iconPresets.map((ic) => `<button type="button" onclick="SMPL_APP.masterPickRankIcon('${ic}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs transition">${ic}</button>`).join('')}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Kolor Rangi</label>
                <div class="flex items-center gap-2">
                  <input id="master-rank-color" type="color" value="#f59e0b" oninput="SMPL_APP.masterPreviewRank()" class="w-10 h-9 rounded-lg bg-slate-950 border border-white/20 p-1 cursor-pointer"/>
                  <div class="flex flex-wrap gap-1">
                    ${colorPresets.map((hex) => `<button type="button" onclick="SMPL_APP.masterPickRankColor('${hex}')" class="w-5 h-5 rounded-full border border-white/30" style="background:${hex}"></button>`).join('')}
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Bonus XP (+pkt)</label>
                <input id="master-rank-xp" type="number" min="0" max="5000" step="10" value="150" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs sm:text-sm text-white font-bold"/>
              </div>
              <div>
                <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Opis / Tooltip</label>
                <input id="master-rank-desc" type="text" maxlength="100" placeholder="Za zasługi dla SMPL" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-2 mb-4">
              <button type="button" onclick="SMPL_APP.masterResetRankForm()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">🧹 Wyczyść</button>
              <button type="button" onclick="SMPL_APP.masterSaveCustomRankSubmit()" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase">💾 Zapisz / Dodaj Rangę</button>
            </div>

            <div class="border-t border-white/10 pt-3">
              <div class="text-xs font-display font-bold uppercase text-white mb-2">Twoje Rangi Specjalne (${customRanks.length})</div>
              ${
                customRanks.length === 0
                  ? `<div class="p-3 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-slate-400">Brak własnych rang — użyj formularza wyżej lub gotowych rang po prawej.</div>`
                  : `<div class="space-y-2 max-h-60 overflow-y-auto pr-1">
                       ${customRanks
                         .map((cr) => {
                           const badgePreview =
                             window.SMPL_RANKS && typeof window.SMPL_RANKS.titleHtml === 'function'
                               ? window.SMPL_RANKS.titleHtml(cr)
                               : `<span class="smpl-title tt-custom">${escapeHtml((cr.icon || '👑') + ' ' + cr.name)}</span>`;
                           return `
                             <div class="p-2.5 rounded-xl bg-slate-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                               <div class="flex flex-wrap items-center gap-2">
                                 ${badgePreview}
                                 <span class="text-[11px] font-bold text-emerald-300">+${Number(cr.xpBonus || 0)} XP</span>
                               </div>
                               <div class="flex items-center gap-1.5">
                                 <button type="button" onclick="SMPL_APP.masterEditCustomRank('${escapeHtml(cr.id)}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold">✏️ Edytuj</button>
                                 <button type="button" onclick="SMPL_APP.masterDeleteCustomRank('${escapeHtml(cr.id)}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[11px] font-bold">🗑️ Usuń</button>
                               </div>
                             </div>
                           `;
                         })
                         .join('')}
                     </div>`
              }
            </div>
          </div>

          <div class="lg:col-span-6 glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-400/30">
            <h4 class="font-display font-black text-base text-emerald-300 uppercase mb-1">⚡ Błyskawiczne Nadawanie Rang Graczowi (${allTitles.length})</h4>
            <p class="text-xs text-slate-300 mb-4">Wybierz zawodnika i tytuł — Twój wybór zostaje zapamiętany podczas klikania akcji.</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Wybierz Zawodnika</label>
                <select id="master-assign-player-id" onchange="SMPL_APP.masterPreviewAssignSelection()" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold">
                  ${allPlayersSorted
                    .map((p) => {
                      const extrasCount = Array.isArray(p.extraCustomRanks) ? p.extraCustomRanks.length : 0;
                      const rankInfo = (p.customRank ? p.customRank : 'auto') + (extrasCount > 0 ? ' +' + extrasCount : '');
                      return `<option value="${escapeHtml(p.id)}" ${p.id === selectedPlayerId ? 'selected' : ''}>${escapeHtml('[' + p.leagueId + '] ' + p.name + ' (' + p.nick + ') — ' + rankInfo)}</option>`;
                    })
                    .join('')}
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Wybierz Rangę / Tytuł TOP</label>
                <select id="master-assign-rank-id" onchange="SMPL_APP.masterPreviewAssignSelection()" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-semibold">
                  ${customTitlesOnly.length > 0 ? `<optgroup label="⭐ Twoje Własne Rangi (${customTitlesOnly.length})">${customTitlesOnly.map(renderTitleOpt).join('')}</optgroup>` : ''}
                  ${eliteTitles.length > 0 ? `<optgroup label="👑 Elita, Korony &amp; Legendy SMPL (${eliteTitles.length})">${eliteTitles.map(renderTitleOpt).join('')}</optgroup>` : ''}
                  ${skillTitles.length > 0 ? `<optgroup label="🎯 Styl Gry &amp; Kunszt Boiskowy (${skillTitles.length})">${skillTitles.map(renderTitleOpt).join('')}</optgroup>` : ''}
                  ${prestigeTitles.length > 0 ? `<optgroup label="🛡️ Prestiż, Weterani &amp; Społeczność (${prestigeTitles.length})">${prestigeTitles.map(renderTitleOpt).join('')}</optgroup>` : ''}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              <div class="p-3 rounded-xl bg-slate-950/75 border border-white/10">
                <div class="text-[10px] font-display font-bold uppercase text-slate-400 mb-1">Aktywne odznaki zawodnika:</div>
                <div id="master-assign-player-current" class="flex flex-wrap items-center gap-1">${selectedPlayerCurrentHtml}</div>
              </div>
              <div class="p-3 rounded-xl bg-slate-950/75 border border-white/10">
                <div class="text-[10px] font-display font-bold uppercase text-slate-400 mb-1">Podgląd wybranej rangi:</div>
                <div id="master-assign-rank-preview" class="flex flex-wrap items-center gap-1.5">${selectedTitleHtml}</div>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-1.5 mb-4">
              <span class="text-[10px] font-display uppercase text-slate-400 mr-1">TOP na 1 klik:</span>
              ${['GALACTICO', 'GOLDEN_BALL', 'CHAMPION', 'EMPEROR', 'INVINCIBLE', 'CLUTCH_KING', 'TIKI_TAKA', 'VIP', 'VETERAN_OG']
                .map((qid) => allTitles.find((t) => t.id === qid))
                .filter(Boolean)
                .map((qt) => `<button type="button" onclick="SMPL_APP.masterQuickSelectAssignRank('${escapeHtml(qt.id)}')" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-[10px] font-bold text-slate-200 transition">${escapeHtml(qt.icon + ' ' + qt.name)}</button>`)
                .join('')}
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" onclick="SMPL_APP.masterAssignRankSubmit('primary')" class="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 text-xs font-display font-bold uppercase transition">⭐ Nadaj Główny Tytuł</button>
              <button type="button" onclick="SMPL_APP.masterAssignRankSubmit('toggle_extra')" class="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/50 text-xs font-display font-bold uppercase transition">➕ Dodaj / Zdejmij Dodatkową</button>
              <button type="button" onclick="SMPL_APP.masterAssignRankSubmit('clear_all')" class="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-400/50 text-xs font-display font-bold uppercase transition">🧹 Wyczyść Rangi Gracza</button>
            </div>
          </div>
        </div>
      `;
    } else if (section === 'leagues') {
      bodyHtml = `
        <div class="space-y-6">
          <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/15 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 class="font-display font-black text-base text-white uppercase">🏟️ Edytor Lig — Nazwy, Skróty, Kolory, Opiekunowie &amp; Status (${allLeagues.length})</h4>
                <p class="text-xs text-slate-300 mt-0.5">Edytuj szczegóły dowolnej ligi, włączaj ukryte dywizje albo dodaj nową ligę.</p>
              </div>
              <button type="button" onclick="SMPL_APP.openAddLeagueModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-display font-black uppercase shadow-lg transition">➕ Dodaj następną ligę</button>
            </div>

            <div class="space-y-2.5">
              ${allLeagues
                .map((lg) => {
                  const isCore = lg.id === 'L1' || lg.id === 'L2';
                  return `
                    <div class="p-3.5 rounded-xl bg-slate-950/85 border border-white/10 space-y-2">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                          <img src="${getLeagueCrestSafe(state, lg)}" class="w-6 h-7 object-contain" alt=""/>
                          <span class="text-xs font-display font-black text-amber-300">${escapeHtml(lg.id)} — ${lg.enabled !== false ? 'AKTYWNA' : 'UKRYTA'}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          ${
                            !isCore
                              ? lg.enabled
                                ? `<button type="button" onclick="SMPL_APP.handleToggleLeagueEnabled('${lg.id}', false)" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-600/40 text-slate-200 text-[11px] font-bold">🙈 Ukryj</button>`
                                : `<button type="button" onclick="SMPL_APP.handleToggleLeagueEnabled('${lg.id}', true)" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">🔓 Włącz</button>`
                              : ''
                          }
                          <button type="button" onclick="SMPL_APP.masterSaveLeagueSubmit('${escapeHtml(lg.id)}')" class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">💾 Zapisz ${escapeHtml(lg.id)}</button>
                        </div>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input id="master-lg-name-${escapeHtml(lg.id)}" type="text" value="${escapeHtml(lg.name || '')}" placeholder="Pełna nazwa" class="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white font-semibold"/>
                        <input id="master-lg-short-${escapeHtml(lg.id)}" type="text" value="${escapeHtml(lg.shortName || '')}" placeholder="Skrót" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white font-bold"/>
                        <div class="flex items-center gap-1.5">
                          <input id="master-lg-color-${escapeHtml(lg.id)}" type="color" value="${escapeHtml(lg.primaryColor || '#F59E0B')}" class="w-9 h-8 rounded bg-slate-900 border border-white/20 p-0.5"/>
                          <input id="master-lg-admin-${escapeHtml(lg.id)}" type="text" value="${escapeHtml(lg.adminName || 'Szymon Komenda')}" placeholder="Admin ligi" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-[11px] text-white"/>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>

            <div class="pt-4 border-t border-white/10">
              <div class="text-xs font-display font-bold uppercase text-white mb-2.5">🛡️ Herby Aktywnych Lig (${activeLeagues.length})</div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${activeLeagues
                  .map(
                    (lObj) => `
                      <div class="p-3 rounded-xl bg-slate-950 border border-white/15 text-center flex flex-col items-center">
                        <img src="${getLeagueCrestSafe(state, lObj)}" class="w-12 h-14 object-contain mb-2" alt="${escapeHtml(lObj.shortName)}"/>
                        <div class="font-display font-bold text-[11px] text-white mb-1.5">${escapeHtml(lObj.shortName)}</div>
                        <label class="w-full py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-200 cursor-pointer border border-white/10">
                          📤 Zmień herb
                          <input type="file" accept="image/*" class="hidden" onchange="SMPL_APP.handleCustomCrestUpload('${lObj.id}', event)"/>
                        </label>
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          </div>

          ${
            isClansUiEnabledSafe(state)
              ? `<div class="glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-500/35">
                   <div class="mb-4">
                     <h4 class="font-display font-black text-lg text-emerald-300 uppercase">🛡️ Zarządzanie Klanami Score! Match (${clansList.length})</h4>
                     <p class="text-xs text-slate-300 mt-0.5">Dodawaj nowe klany, zmieniaj nazwy, tagi, kolory, wgrywaj logo lub usuwaj nieaktywne klany.</p>
                   </div>
                   <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                     <div class="lg:col-span-5 p-4 rounded-2xl bg-slate-950/90 border border-white/10 space-y-3">
                       <input id="master-clan-id" type="hidden" value=""/>
                       <div class="flex items-center gap-3">
                         <img id="master-clan-logo-preview" src="${escapeHtml(getClanLogoSafe({ name: 'Nowy Klan', tag: 'SMPL', primaryColor: '#10B981' }))}" class="w-12 h-12 rounded-xl object-contain bg-slate-900 border border-white/20 p-1" alt="Logo klanu"/>
                         <div class="text-xs text-slate-300">
                           <div class="font-display font-bold text-white uppercase">Edytor Klanu</div>
                           <div class="text-[11px] text-slate-400">Wypełnij dane lub kliknij „Edytuj” przy kłanie.</div>
                         </div>
                       </div>
                       <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                         <div class="sm:col-span-2">
                           <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Nazwa Klanu *</label>
                           <input id="master-clan-name" type="text" placeholder="np. Polska Husaria" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-semibold"/>
                         </div>
                         <div>
                           <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Tag (do 6 zn.)</label>
                           <input id="master-clan-tag" type="text" maxlength="6" placeholder="HUS" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-black uppercase"/>
                         </div>
                       </div>
                       <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                         <div>
                           <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Kolor Herbu</label>
                           <input id="master-clan-color" type="color" value="#10B981" class="w-12 h-9 rounded-lg bg-slate-900 border border-white/20 p-1"/>
                         </div>
                         <div>
                           <label class="block text-[11px] font-display uppercase text-slate-400 mb-1">Logo Klanu (PNG/JPG)</label>
                           <input id="master-clan-logo-file" type="file" accept="image/*" onchange="SMPL_APP.masterHandleClanLogoFile(event)" class="text-[11px] text-slate-300"/>
                         </div>
                       </div>
                       <label class="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                         <input id="master-clan-clear-logo" type="checkbox" class="w-4 h-4 rounded"/>
                         <span>Użyj generowanego herbu SVG</span>
                       </label>
                       <div class="flex flex-wrap justify-end gap-2 pt-1">
                         <button type="button" onclick="SMPL_APP.masterResetClanForm()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold">🧹 Nowy Klan</button>
                         <button type="button" onclick="SMPL_APP.masterSaveClanSubmit()" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase">💾 Zapisz Klan</button>
                       </div>
                     </div>

                     <div class="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                       ${clansList
                         .map((c) => {
                           const members = allPlayersSorted.filter((p) => p.clanId === c.id).length;
                           const logoUrl = getClanLogoSafe(c);
                           return `
                             <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex items-center justify-between gap-2">
                               <div class="flex items-center gap-2.5 min-w-0">
                                 <img src="${escapeHtml(logoUrl)}" class="w-10 h-10 rounded-lg object-contain bg-slate-900 border border-white/15 p-0.5 flex-shrink-0" alt="${escapeHtml(c.name)}"/>
                                 <div class="min-w-0">
                                   <div class="text-xs font-display font-black text-white truncate">${escapeHtml(c.name)}</div>
                                   <div class="text-[11px] text-slate-400">${c.tag ? '[' + escapeHtml(c.tag) + '] • ' : ''}Graczy: <strong class="text-emerald-300">${members}</strong></div>
                                 </div>
                               </div>
                               <div class="flex items-center gap-1 flex-shrink-0">
                                 <button type="button" onclick="SMPL_APP.masterEditClan('${escapeHtml(c.id)}')" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold">✏️</button>
                                 <button type="button" onclick="SMPL_APP.masterDeleteClan('${escapeHtml(c.id)}')" class="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[11px] font-bold">🗑️</button>
                               </div>
                             </div>
                           `;
                         })
                         .join('')}
                     </div>
                   </div>
                 </div>`
              : ''
          }
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="space-y-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-emerald-500/35 space-y-4">
              <h4 class="font-display font-black text-base text-emerald-300 uppercase">💾 Pełny Backup Bazy JSON (Eksport &amp; Import)</h4>
              <p class="text-xs text-slate-300">Pobierz kompletną kopię zapasową portalu albo przywróć zapisany wcześniej plik <code>.json</code>.</p>
              <div class="flex flex-wrap gap-2">
                <button type="button" onclick="SMPL_APP.exportDatabaseJson()" class="btn-league px-4 py-2.5 rounded-xl text-xs font-display font-black uppercase">📥 Pobierz Backup JSON</button>
                <button type="button" onclick="SMPL_APP.adminRecalculateAllHistoricalStats()" class="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-display font-bold uppercase">🔄 Przelicz S1–S55</button>
              </div>
              <div class="pt-3 border-t border-white/10">
                <div class="text-xs font-display font-bold text-white uppercase mb-1.5">📤 Import z pliku JSON</div>
                <input type="file" accept=".json,application/json" onchange="SMPL_APP.masterImportDatabaseFile(event)" class="text-xs text-slate-300"/>
              </div>
            </div>

            <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-blue-500/35 space-y-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="font-display font-black text-base text-blue-300 uppercase">🛡️ Snapshoty Serwerowe (14 Dni)</h4>
                <button type="button" onclick="SMPL_APP.adminLoadSnapshotsPanel()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-white/15 text-[11px] font-bold">🔄 Pobierz Listę</button>
              </div>
              ${
                !snaps.length
                  ? `<div class="p-4 rounded-xl bg-slate-950/75 border border-white/10 text-xs text-slate-400">Kliknij „Pobierz Listę”, aby załadować dzienne kopie z <code>data/snapshots</code>.</div>`
                  : `<div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                       ${snaps
                         .map(
                           (sn) => `
                             <div class="p-2.5 rounded-xl bg-slate-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                               <div><span class="font-bold text-white">${escapeHtml(sn.name || sn)}</span>${sn.size ? `<span class="text-slate-400 ml-2">(${Math.round(Number(sn.size) / 1024)} KB)</span>` : ''}</div>
                               <button type="button" onclick="SMPL_APP.adminRestoreSnapshot('${escapeHtml(sn.name || sn).replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 font-bold">⏪ Przywróć</button>
                             </div>
                           `
                         )
                         .join('')}
                     </div>`
              }
            </div>
          </div>

          <details class="glass-panel rounded-2xl p-5 border border-rose-500/40 bg-rose-950/15">
            <summary class="cursor-pointer font-display font-black text-sm text-rose-300 uppercase select-none">
              ⚠️ Strefa Awaryjna Bazy Danych — Zerowanie Sezonu &amp; Reset (rozwiń ostrożnie)
            </summary>
            <div class="mt-4 pt-3 border-t border-rose-500/25 flex flex-wrap items-center gap-2">
              <button type="button" onclick="SMPL_APP.handleStartFreshSeason56()" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 font-display font-bold text-xs uppercase">🔄 Wyzeruj wyniki 0:0 (Sezon ${(state && state.season) || 56})</button>
              <button type="button" onclick="SMPL_APP.resetSeedConfirm()" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/20 font-display font-bold text-xs uppercase">📊 Przywróć dane z Excela</button>
              <button type="button" onclick="SMPL_APP.handleClearAllTablesSeason56()" class="px-3.5 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-800 text-rose-200 border border-rose-500/50 font-display font-bold text-xs uppercase">⚠️ Reset całej bazy do 0</button>
            </div>
          </details>
        </div>
      `;
    }

    return `
      <div class="space-y-5">
        <div class="master-showcase-banner rounded-3xl p-4 sm:p-6">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <div class="inline-flex flex-wrap items-center gap-2 mb-1">
                <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-[10px] font-display font-black uppercase text-amber-300">👑 MASTER STUDIO • SZYMON KOMENDA</span>
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-display font-bold uppercase text-emerald-300">Sezon ${escapeHtml(String((state && state.season) || 56))} • Kolejka / Tydz. ${escapeHtml(String(currentWeekVal))}</span>
                <span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/40 text-[10px] font-display font-bold uppercase text-blue-300">Gracze: ${allPlayersSorted.length}${isClansUiEnabledSafe(state) ? ' • Klany: ' + clansList.length : ''} • Rangi TOP: ${allTitles.length}</span>
              </div>
              <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase">
                ${section === 'portal' ? '👑 Ustawienia Portalu, Sezonu i Konkursów' : section === 'ranks' ? '🎖️ Kreator i Nadawanie Rang TOP' : section === 'leagues' ? '🏟️ Edytor Lig, Herbów i Klanów' : '💾 Kopie Zapasowe, Import i Strefa Awaryjna'}
              </h3>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('L1')" class="px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/45 text-blue-200 border border-blue-400/50 text-xs font-display font-bold uppercase transition">🛡️ Graj jako Admin (L1)</button>
              <button type="button" onclick="SMPL_APP.setAdminSubTab('admins_approval')" class="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/50 text-xs font-display font-bold uppercase transition">🛡️ Wnioski (${pendingAdminsCount})</button>
              <button type="button" onclick="SMPL_APP.exportDatabaseJson()" class="btn-league px-3.5 py-2 rounded-xl text-xs font-display font-black uppercase">📥 Backup JSON</button>
            </div>
          </div>
        </div>
        ${bodyHtml}
      </div>
    `;
  }

  return {
    renderTribunalSubTab,
    renderSubmitScoreView,
    renderRegistrationView,
    renderAdminLoginAndJoinGate,
    renderAdminDashboardView,
    renderFullScreenAuthGate
  };
})();
