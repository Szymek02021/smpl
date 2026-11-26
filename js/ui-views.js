/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Moduł Widoków UI: Tabela Główna, Żelazna Kurtyna (Czyste Konta), Terminarz 1-30, H2H
 */

window.SMPL_VIEWS = (function () {
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isClansUiEnabled(state) {
    return Boolean(
      (typeof window !== 'undefined' && window.SMPL_ENABLE_CLANS === true) ||
      (state && state.portalSettings && state.portalSettings.clansEnabled === true)
    );
  }

  function getResolvedClanForEntity(entity, state) {
    if (!entity) return null;
    const clans = (state && Array.isArray(state.clans)) ? state.clans : [];
    const byId = entity.clanId ? clans.find((c) => c && c.id === entity.clanId) : null;
    const name = entity.clanName || (byId && byId.name) || '';
    if (!name) return null;
    const tag = entity.clanTag || (byId && byId.tag) || '';
    const logoRaw = entity.clanLogo || (byId && byId.logo) || null;
    const primaryColor = (byId && byId.primaryColor) || '#10B981';
    const secondaryColor = (byId && byId.secondaryColor) || '#064E3B';
    let logo = logoRaw;
    if (!logo && window.SMPL_DB && typeof window.SMPL_DB.resolveClanLogo === 'function') {
      logo = window.SMPL_DB.resolveClanLogo({ name: name, tag: tag, primaryColor: primaryColor, secondaryColor: secondaryColor });
    } else if (!logo && window.SMPL_MEDIA && typeof window.SMPL_MEDIA.createClanEmblemSVG === 'function') {
      logo = window.SMPL_MEDIA.createClanEmblemSVG(name, tag, primaryColor, secondaryColor);
    }
    return { id: entity.clanId || (byId && byId.id) || '', name: name, tag: tag, logo: logo };
  }

  function renderClanBadgeHtml(entity, state, compact) {
    if (!isClansUiEnabled(state)) return '';
    const clan = getResolvedClanForEntity(entity, state);
    if (!clan) return '';
    const imgHtml = clan.logo
      ? `<img src="${clan.logo}" class="clan-logo-thumb" alt="${escapeHtml(clan.name)}"/>`
      : `<span>🛡️</span>`;
    const tagHtml = clan.tag
      ? `<span class="text-emerald-300 font-display font-black text-[10px]">[${escapeHtml(clan.tag)}]</span>`
      : '';
    const nameHtml = compact
      ? ''
      : `<span class="text-slate-100 font-semibold text-[11px]">${escapeHtml(clan.name)}</span>`;
    return `<span class="clan-badge-pill" title="Klan: ${escapeHtml(clan.name)}${clan.tag ? ' [' + escapeHtml(clan.tag) + ']' : ''}">${imgHtml}${tagHtml}${nameHtml}</span>`;
  }

  function renderTrendBadge(row) {
    if (row.trend === 'UP') {
      return `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold" title="Awans o ${row.trendDelta} poz. względem poprzedniej kolejki">▲ +${row.trendDelta}</span>`;
    }
    if (row.trend === 'DOWN') {
      return `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[11px] font-bold" title="Spadek o ${Math.abs(row.trendDelta)} poz. względem poprzedniej kolejki">▼ ${row.trendDelta}</span>`;
    }
    return `<span class="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-bold" title="Bez zmian względem poprzedniej kolejki">• 0</span>`;
  }

  function renderFormBadges(formArr) {
    if (!formArr || formArr.length === 0) {
      return `<span class="text-xs text-slate-500 italic">Brak meczów</span>`;
    }
    return `<div class="flex items-center justify-center gap-1">
      ${formArr
        .map(
          (item) =>
            `<span class="form-badge form-${item.result}" title="Kolejka ${item.round}: ${escapeHtml(item.score)} vs ${escapeHtml(item.opponentName)}${item.isWalkover ? ' (Walkower)' : ''}">${item.result}</span>`
        )
        .join('')}
    </div>`;
  }

  function extractCleanRoomCodes(rawText) {
    const txt = String(rawText || '');
    const found = {};
    const out = [];
    const ignoredWords = { BEZ: true, GRY: true, TYLKO: true, LITERY: true, CYFR: true, SCORE: true, MATCH: true, KODU: true, POKOJU: true };
    const rxPlain = /(?:kod(?:\s+pokoju|\s+do\s+gry|\s*\([^)]*\))?|pok[oó]j(?:\s+w\s+grze)?|Score!\s*Match)\s*[:\-]\s*([A-Za-z0-9\-]{3,14})/gi;
    let match;
    while ((match = rxPlain.exec(txt)) !== null) {
      const cleanPlain = String(match[1] || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (cleanPlain.length >= 4 && cleanPlain.length <= 12 && !ignoredWords[cleanPlain] && !found[cleanPlain]) {
        found[cleanPlain] = true;
        out.push(cleanPlain);
      }
    }
    const rxNoColon = /(?:kod(?:em)?\s+pokoju|pok[oó]j\s+w\s+grze)\s+([A-Za-z]{4,12})\b/gi;
    while ((match = rxNoColon.exec(txt)) !== null) {
      const cleanWord = String(match[1] || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (cleanWord.length >= 4 && cleanWord.length <= 12 && !ignoredWords[cleanWord] && !found[cleanWord]) {
        found[cleanWord] = true;
        out.push(cleanWord);
      }
    }
    return out.slice(0, 3);
  }

  function renderRoomCodesPillsHtml(rawText) {
    const codes = extractCleanRoomCodes(rawText);
    if (!codes.length) return '';
    return `<div class="flex flex-wrap items-center gap-1.5 mt-2">
      ${codes
        .map(
          (c) => `<button type="button" onclick="SMPL_APP.copyCleanRoomCode('${escapeHtml(c)}')" class="smpl-room-copy-chip" title="Skopiuj krótki kod słowny (bez cyfr) i wklej w Score! Match">
            📋 Kopiuj kod do gry: <span class="underline">${escapeHtml(c)}</span>
          </button>`
        )
        .join('')}
    </div>`;
  }

  // =========================================================================
  // 1. WIDOK TABELI GŁÓWNEJ LIGI (NA ŻYWO)
  // =========================================================================
  function renderStandingsView(state, leagueId) {
    const standings = window.SMPL_ENGINE.calculateStandings(state, leagueId);
    const cleanSheets = window.SMPL_ENGINE.calculateCleanSheetsRanking(state, leagueId);
    const leagueMatches = state.matches.filter((m) => m.leagueId === leagueId);
    const playedMatches = leagueMatches.filter((m) => m.status === 'APPROVED' || m.status === 'WALKOVER');
    const pendingMatches = leagueMatches.filter((m) => m.status === 'PENDING');
    const totalGoals = playedMatches.reduce((acc, m) => acc + Number(m.homeScore || 0) + Number(m.awayScore || 0), 0);
    const avgGoals = playedMatches.length > 0 ? (totalGoals / playedMatches.length).toFixed(2) : '0.00';
    const leader = standings[0];
    const topKeeper = cleanSheets[0];
    const session = window.SMPL_DB ? window.SMPL_DB.getSession() : {};
    const isAdmin = Boolean(window.SMPL_DB && window.SMPL_DB.isStrictAdminSession(session));
    const isLoggedInPlayer = Boolean(session && !session.isGuest && session.isPlayerAuthenticated && (session.activePlayerId || session.activeRegId));
    const winInfo = (window.SMPL_DB && typeof window.SMPL_DB.getSeasonJoinWindowInfo === 'function')
      ? window.SMPL_DB.getSeasonJoinWindowInfo(state)
      : { isOpen: false, phase: 'NOT_STARTED', allowedLeagues: [] };
    const myAdminPlayer = isAdmin && window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function'
      ? window.SMPL_DB.findPlayerForAdmin(session.adminId, state)
      : null;
    const myAdminActiveLg = myAdminPlayer && myAdminPlayer.active !== false && /^L\d+$/i.test(String(myAdminPlayer.leagueId || ''))
      ? myAdminPlayer.leagueId
      : null;
    const myRegularPlayer = !isAdmin && isLoggedInPlayer && session.activePlayerId
      ? (state.players || []).find((pl) => pl.id === session.activePlayerId) || null
      : null;
    const myRegularActiveLg = myRegularPlayer && myRegularPlayer.active !== false && /^L\d+$/i.test(String(myRegularPlayer.leagueId || ''))
      ? myRegularPlayer.leagueId
      : null;
    const leagueNameShort = (state.leagues[leagueId] && state.leagues[leagueId].shortName) || leagueId;
    const playerAllowedForThisLeague = !winInfo.allowedLeagues.length || winInfo.allowedLeagues.includes(leagueId);

    const seasonActionStripHtml = `
      <div class="glass-panel rounded-2xl px-4 py-3 sm:px-5 mb-5 border ${winInfo.isOpen ? 'border-emerald-400/50 bg-emerald-950/20' : 'border-white/15 bg-slate-950/75'} flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2.5 text-xs">
          <span class="px-2.5 py-1 rounded-full font-display font-black text-[10px] uppercase tracking-wider ${winInfo.isOpen ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50' : 'bg-slate-800 text-slate-300 border border-white/15'}">
            ${winInfo.isOpen ? '🟢 OKNO ZAPISÓW OTWARTE (POCZĄTEK SEZONU)' : (winInfo.phase === 'ENDED' ? '🔴 OKNO ZAMKNIĘTE (KONIEC / TRWA SEZON)' : '⏳ OKNO ZAPISÓW ZAMKNIĘTE')}
          </span>
          <span class="text-slate-300">
            ${
              isAdmin
                ? (winInfo.isOpen
                    ? 'Gracze mogą teraz sami dołączać i opuszczać ligę przyciskami.'
                    : 'Kliknij „Otwórz Start Sezonu”, aby gracze mogli używać przycisków [Dołącz / Opuść ligę].')
                : (winInfo.isOpen
                    ? 'Administracja otworzyła start sezonu — możesz dołączyć do ligi lub zmienić/opuścić skład!'
                    : 'Przyciski [Dołącz / Opuść ligę] aktywują się po zatwierdzeniu początku sezonu przez Administrację.')
            }
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${
            isAdmin
              ? `
                ${
                  myAdminActiveLg
                    ? `<button type="button" onclick="SMPL_APP.openAssignHistoricalStatsModal('${myAdminPlayer.id}')" class="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/50 text-[11px] font-display font-black uppercase transition">
                         🏛️ Moje Statystyki S1–S55
                       </button>
                       ${
                         myAdminActiveLg !== leagueId
                           ? `<button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('${leagueId}')" class="px-3 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600/45 text-blue-200 border border-blue-400/50 text-[11px] font-display font-black uppercase transition">
                                🛡️ Przenieś mnie (Admin) do ${escapeHtml(leagueNameShort)}
                              </button>`
                           : `<button type="button" onclick="SMPL_APP.handlePlayerLeaveLeague()" class="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 text-[11px] font-display font-black uppercase transition">
                                🚪 Opuść ligę (${escapeHtml(myAdminActiveLg)})
                              </button>`
                       }`
                    : `<button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('${leagueId}')" class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[11px] font-display font-black uppercase shadow-lg transition">
                         🛡️ Dołącz jako Admin do ${escapeHtml(leagueNameShort)} (+ Statystyki)
                       </button>`
                }
                <button type="button" onclick="SMPL_APP.handleSetSeasonJoinWindow(${!winInfo.isOpen})" class="px-3.5 py-2 rounded-xl ${winInfo.isOpen ? 'bg-rose-600/80 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'} text-[11px] font-display font-black uppercase shadow-lg transition">
                  ${winInfo.isOpen ? '🔴 Zamknij Okno (Koniec)' : '🟢 Zatwierdź Start (Otwórz Dołączanie)'}
                </button>
              `
              : isLoggedInPlayer
              ? (
                  winInfo.isOpen
                    ? `
                      ${
                        myRegularActiveLg === leagueId
                          ? `<button type="button" onclick="SMPL_APP.handlePlayerLeaveLeague()" class="px-3.5 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-[11px] font-display font-black uppercase shadow-lg transition">
                               🚪 Opuść ligę (${escapeHtml(leagueNameShort)})
                             </button>`
                          : playerAllowedForThisLeague
                          ? `<button type="button" onclick="SMPL_APP.handlePlayerJoinLeague('${leagueId}')" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-display font-black uppercase shadow-lg transition">
                               ⚡ ${myRegularActiveLg ? 'Przenieś się / Dołącz do ' : 'Dołącz do '} ${escapeHtml(leagueNameShort)}
                             </button>
                             ${
                               myRegularActiveLg
                                 ? `<button type="button" onclick="SMPL_APP.handlePlayerLeaveLeague()" class="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 text-[11px] font-display font-bold uppercase transition">
                                      🚪 Opuść (${escapeHtml(myRegularActiveLg)})
                                    </button>`
                                 : ''
                             }`
                          : `<span class="text-[11px] text-amber-300 font-bold">Zapisy otwarte tylko dla wybranych dywizji.</span>`
                      }
                    `
                    : `<span class="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-[11px] text-slate-400 font-bold">
                         ${myRegularActiveLg ? `✅ Grasz w ${escapeHtml(myRegularActiveLg)} (okno zamknięte)` : '🔒 Czeka na zatwierdzenie Startu Sezonu'}
                       </span>`
                )
              : (
                  winInfo.isOpen
                    ? `<button type="button" onclick="SMPL_APP.handleGateLock()" class="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-display font-black uppercase shadow-lg transition">
                         ⚡ Zaloguj się, aby kliknąć Dołącz do Ligi
                       </button>`
                    : ''
                )
          }
        </div>
      </div>
    `;

    const top3Standings = standings.slice(0, 3);
    const podiumConfigs = [
      {
        orderCls: 'order-1 md:order-2 md:-translate-y-3',
        cardCls: 'smpl-podium-gold smpl-podium-1',
        crownCls: 'smpl-crown-gold',
        crownLabel: '👑 #1 LIDER TABELI',
        avatarBorder: 'border-amber-400',
        ptsColor: 'text-amber-300'
      },
      {
        orderCls: 'order-2 md:order-1',
        cardCls: 'smpl-podium-silver smpl-podium-2',
        crownCls: 'smpl-crown-silver',
        crownLabel: '🥈 #2 WICELIDER',
        avatarBorder: 'border-slate-300',
        ptsColor: 'text-slate-100'
      },
      {
        orderCls: 'order-3 md:order-3',
        cardCls: 'smpl-podium-bronze smpl-podium-3',
        crownCls: 'smpl-crown-bronze',
        crownLabel: '🥉 #3 PODIUM',
        avatarBorder: 'border-amber-600',
        ptsColor: 'text-amber-400'
      }
    ];

    const standingsPodiumHtml = top3Standings.length > 0
      ? `
        <div id="smpl-standings-podium" class="smpl-podium-stage">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div class="flex items-center gap-2">
              <span class="smpl-live-beacon-dot"></span>
              <span class="font-display font-black text-xs sm:text-sm uppercase tracking-wider text-white">
                Podium Mistrzowskie — ${escapeHtml(leagueNameShort)} (Sezon ${state.season || 56})
              </span>
            </div>
            <span class="text-[11px] font-display font-bold uppercase text-amber-300 tracking-wider">
              🏆 TOP 3 KLASYFIKACJI GENERALNEJ
            </span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-stretch pt-1">
            ${top3Standings
              .map((row, idx) => {
                const cfg = podiumConfigs[idx];
                const pObj = row.player || (state.players || []).find((item) => item.id === (row.playerId || row.id));
                const pRank = window.SMPL_RANKS && pObj ? window.SMPL_RANKS.getPlayerRank(pObj, state) : null;
                const pAvatar =
                  window.SMPL_RANKS && pRank && !pRank.isPlaceholder
                    ? window.SMPL_RANKS.avatarWithGlassBadgeHtml(
                        row.avatar,
                        row.name,
                        `w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 ${cfg.avatarBorder} shadow-xl`,
                        pRank,
                        row.playerId,
                        'sm'
                      )
                    : `<img src="${row.avatar}" alt="${escapeHtml(row.name)}" class="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 ${cfg.avatarBorder} shadow-xl flex-shrink-0"/>`;
                const nameCls = window.SMPL_RANKS && pRank ? window.SMPL_RANKS.nameClass(pRank) : '';
                const pCos = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getPlayerCosmetics === 'function')
                  ? window.SMPL_STUDIO.getPlayerCosmetics(state, row.playerId)
                  : null;
                const pNickFx = (pCos && pCos.nickFxCss) ? (' ' + pCos.nickFxCss) : '';
                const pBadgePill = (pCos && pCos.badgeLabel)
                  ? `<span class="smpl-shop-badge-pill is-compact" style="border-color:${escapeHtml(pCos.badgeColor || '#38bdf8')};color:${escapeHtml(pCos.badgeColor || '#38bdf8')};">${escapeHtml(pCos.badgeLabel)}</span>`
                  : '';
                const diffStr = row.diff > 0 ? '+' + row.diff : String(row.diff);

                return `
                  <div onclick="SMPL_APP.openPlayerModal('${row.playerId}')" class="smpl-podium-card ${cfg.cardCls} ${cfg.orderCls} flex flex-col justify-between">
                    <div>
                      <div class="flex items-center justify-between gap-2 mb-3">
                        <span class="smpl-crown-pill ${cfg.crownCls}">
                          <span class="${idx === 0 ? 'smpl-crown-float' : ''}">${cfg.crownLabel}</span>
                        </span>
                        ${renderTrendBadge(row)}
                      </div>
                      <div class="flex items-center gap-3">
                        ${pAvatar}
                        <div class="min-w-0 flex-1">
                          <div class="font-display font-black text-base text-white truncate ${nameCls}${pNickFx}">${escapeHtml(row.name)}</div>
                          <div class="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>@${escapeHtml(row.nick)}</span>
                            ${pBadgePill}
                            ${renderClanBadgeHtml(pObj || row, state, true)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="mt-4 pt-3 border-t border-white/10">
                      <div class="grid grid-cols-4 gap-1.5 text-center font-mono-num">
                        <div class="p-1.5 rounded-lg bg-black/45 border border-white/10">
                          <div class="text-[9px] text-slate-400 uppercase font-bold">PKT</div>
                          <div class="font-display font-black text-base sm:text-lg ${cfg.ptsColor}">${row.PKT}</div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-black/45 border border-white/10">
                          <div class="text-[9px] text-slate-400 uppercase font-bold">W-R-P</div>
                          <div class="font-bold text-xs text-white mt-0.5">${row.W}-${row.R}-${row.P}</div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-black/45 border border-white/10">
                          <div class="text-[9px] text-slate-400 uppercase font-bold">+/-</div>
                          <div class="font-bold text-xs ${row.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">${diffStr}</div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-black/45 border border-white/10">
                          <div class="text-[9px] text-slate-400 uppercase font-bold">CK</div>
                          <div class="font-bold text-xs text-emerald-300 mt-0.5">🧤 ${row.cleanSheets}</div>
                        </div>
                      </div>
                      <div class="mt-2.5 flex items-center justify-between gap-2" onclick="event.stopPropagation()">
                        <span class="text-[10px] text-slate-400 uppercase font-display font-bold">Forma:</span>
                        ${renderFormBadges(row.form)}
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `
      : '';

    return `
      ${seasonActionStripHtml}
      ${
        playedMatches.length === 0
          ? `<div class="glass-panel rounded-2xl p-4 sm:px-5 mb-5 border border-amber-400/35 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
               <div class="space-y-1">
                 <div class="flex items-center gap-2">
                   <span class="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-display font-black text-[10px] uppercase">⏳ Oczekiwanie na pierwsze wyniki</span>
                   <span class="font-display font-bold text-xs sm:text-sm text-white">Tabela Sezonu ${state.season || 56} wystartuje po zatwierdzeniu 1. kolejki</span>
                 </div>
                 <p class="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                   ${
                     !isLoggedInPlayer && !isAdmin
                       ? 'Jesteś teraz w trybie Gościa — zaloguj się lub zarejestruj, aby umawiać mecze i dodawać wyniki, albo podejrzyj pełną tabelę ostatniego sezonu S55!'
                       : 'Gdy pojawią się zatwierdzone mecze, tutaj na żywo zobaczysz punkty, formę, czyste konta i podium. Możesz też zajrzeć do pełnego archiwum Sezonu 55.'
                   }
                 </p>
               </div>
               <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                 ${
                   !isLoggedInPlayer && !isAdmin
                     ? `<button type="button" onclick="SMPL_APP.handleGateLock()" class="btn-league px-3.5 py-2 rounded-xl font-display font-black text-[11px] uppercase shadow">🔑 Zaloguj / Zapisz się</button>`
                     : `<button type="button" onclick="SMPL_APP.switchTab('schedule')" class="btn-league px-3.5 py-2 rounded-xl font-display font-black text-[11px] uppercase shadow">📅 Przejdź do Meczów</button>`
                 }
                 <button type="button" onclick="SMPL_APP.switchGlobalSeason('ARCHIVE_55')" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40 font-display font-bold text-[11px] uppercase transition">
                   🏛️ Zobacz Wyniki Sezonu 55
                 </button>
               </div>
             </div>`
          : ''
      }
      <!-- KPI Statystyki Ligi na żywo -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div class="glass-panel smpl-kpi-card rounded-2xl p-4 border-l-4 border-league">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Lider Tabeli (${escapeHtml(state.leagues[leagueId].shortName)})</div>
            <span class="smpl-kpi-icon-orb text-amber-300">👑</span>
          </div>
          <div class="mt-2 flex items-center gap-3">
            ${leader ? `<img src="${leader.avatar}" class="w-10 h-10 rounded-full object-cover border border-amber-400/50 shadow" alt=""/>` : ''}
            <div class="min-w-0">
              <div class="font-display font-bold text-sm sm:text-base text-white truncate">${leader ? escapeHtml(leader.name) : 'Brak'}</div>
              <div class="text-xs text-league-primary font-bold">${leader ? `${leader.PKT} PKT • Bilans ${leader.diff >= 0 ? '+' + leader.diff : leader.diff}` : ''}</div>
            </div>
          </div>
        </div>

        <div class="glass-panel smpl-kpi-card rounded-2xl p-4 border-l-4 border-emerald-500">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Lider „Żelazna Kurtyna”</div>
            <span class="smpl-kpi-icon-orb text-emerald-300">🧤</span>
          </div>
          <div class="mt-2 flex items-center gap-3">
            ${topKeeper ? `<img src="${topKeeper.avatar}" class="w-10 h-10 rounded-full object-cover border border-emerald-400/50 shadow" alt=""/>` : ''}
            <div class="min-w-0">
              <div class="font-display font-bold text-sm sm:text-base text-white truncate">${topKeeper ? escapeHtml(topKeeper.name) : 'Brak'}</div>
              <div class="text-xs text-emerald-400 font-bold">🧤 ${topKeeper ? `${topKeeper.cleanSheets} Czystych Kont (${topKeeper.cleanSheetPct}%)` : '0 CK'}</div>
            </div>
          </div>
        </div>

        <div class="glass-panel smpl-kpi-card rounded-2xl p-4 border-l-4 border-blue-500">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Rozegrane Mecze</div>
            <span class="smpl-kpi-icon-orb text-blue-300">⚡</span>
          </div>
          <div class="mt-2 flex items-baseline justify-between">
            <div class="font-display font-black text-2xl text-white font-mono-num">${playedMatches.length} <span class="text-xs font-normal text-slate-400">/ ${leagueMatches.length}</span></div>
            ${
              pendingMatches.length > 0
                ? `<button onclick="SMPL_APP.switchTab('submit')" class="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">⏳ ${pendingMatches.length} w poczekalni</button>`
                : `<span class="text-[11px] text-emerald-400 font-semibold">100% na bieżąco</span>`
            }
          </div>
          <div class="mt-2 w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
            <div class="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full" style="width: ${Math.min(100, Math.round((playedMatches.length / Math.max(1, leagueMatches.length)) * 100))}%"></div>
          </div>
        </div>

        <div class="glass-panel smpl-kpi-card rounded-2xl p-4 border-l-4 border-amber-500">
          <div class="flex items-center justify-between gap-2">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Bramki w Tabeli (Sezon ${state.season || 56})</div>
            <span class="smpl-kpi-icon-orb text-amber-300">⚽</span>
          </div>
          <div class="mt-2 flex items-baseline justify-between">
            <div class="font-display font-black text-2xl text-amber-400 font-mono-num">⚽ ${totalGoals}</div>
            <div class="text-xs text-slate-300 font-semibold">Śr. <span class="text-white font-bold">${avgGoals}</span> / mecz</div>
          </div>
          <div class="mt-1 text-[11px] text-slate-400">Automatyczne przeliczanie H2H i bilansu</div>
        </div>
      </div>

      ${standingsPodiumHtml}

      ${(() => {
        const compSt = state && state.competitions ? state.competitions : null;
        const totwArr = compSt && Array.isArray(compSt.totwHistory) ? compSt.totwHistory : [];
        const latestTotw = totwArr[0] || null;
        const totwPlayers = latestTotw && Array.isArray(latestTotw.starters) ? latestTotw.starters.slice(0, 6) : [];
        if (!latestTotw || !totwPlayers.length) return '';
        return `
          <div class="glass-panel rounded-2xl p-4 sm:px-6 mb-6 border border-amber-400/40">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2">
                <span class="smpl-totw-badge">⚡ DRUŻYNA KOLEJKI (TOTW • TYDZIEŃ #${Number(latestTotw.week || 1)})</span>
                <span class="text-xs text-slate-300 font-semibold">${escapeHtml(latestTotw.roundRange || '')}</span>
              </div>
              <button type="button" onclick="SMPL_APP.switchTab('competitions'); SMPL_APP.setCompetitionsSubTab('totw');" class="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 text-xs font-display font-bold uppercase transition">
                🏆 Zobacz Pełny Skład TOTW
              </button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              ${totwPlayers.map((tp) => `
                <div onclick="SMPL_APP.openPlayerModal('${escapeHtml(tp.playerId)}')" class="p-2.5 rounded-xl bg-slate-950/85 border border-amber-400/30 hover:border-amber-400/50 cursor-pointer transition">
                  <div class="text-[10px] font-display font-black uppercase text-amber-300">${escapeHtml(tp.leagueId || '')} • ${Number(tp.pts || 0)} PKT</div>
                  <div class="font-bold text-xs text-white truncate mt-0.5">${escapeHtml(tp.name || '')}</div>
                  <div class="text-[10px] text-slate-400">${Number(tp.wins || 0)}W • ${Number(tp.gf || 0)}:${Number(tp.ga || 0)} • ${Number(tp.cleanSheets || 0)} CK</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      })()}

      <!-- GŁÓWNA TABELA LIGOWA -->
      <div class="glass-panel rounded-3xl overflow-hidden border border-white/15">
        <div class="standings-showcase-banner p-4 sm:px-6 sm:py-5 border-b border-white/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <h2 class="font-display font-black text-base sm:text-lg tracking-wide uppercase text-white">
                Tabela Główna — ${escapeHtml(state.leagues[leagueId].name)} (Sezon ${state.season || 56})
              </h2>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Kryteria sortowania: <span class="text-slate-200 font-semibold">1. Punkty (PKT)</span> → <span class="text-slate-200 font-semibold">2. Bezpośredni mecz (H2H)</span> → <span class="text-slate-200 font-semibold">3. Bilans (+/-)</span> → <span class="text-slate-200 font-semibold">4. Bramki zdobyte (BZ)</span>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button onclick="SMPL_APP.openMessengerReportModal()" class="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 transition flex items-center gap-1.5">
              <span>📱 Raport na FB / Messenger</span>
            </button>
            <button onclick="SMPL_APP.switchTab('profile')" class="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 transition flex items-center gap-1.5">
              <span>🎴 Karta UT &amp; Trofea</span>
            </button>
            ${
              isAdmin || isLoggedInPlayer
                ? `<button onclick="SMPL_APP.switchTab('submit')" class="btn-league px-3.5 py-2 rounded-xl text-xs font-display uppercase tracking-wider flex items-center gap-1.5">
                     <span>➕ Dodaj Wynik Meczu</span>
                   </button>`
                : ''
            }
            <button onclick="SMPL_APP.switchTab('cleansheets')" class="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition">
              🧤 Żelazna Kurtyna
            </button>
            <button type="button" onclick="SMPL_APP.downloadStandingsPosterPng('${leagueId}')" class="px-3 py-2 rounded-xl text-xs font-display font-bold uppercase bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-400/40 transition flex items-center gap-1">
              📸 Grafika Tabeli PNG
            </button>
            <button type="button" onclick="SMPL_APP.exportStandingsCsv('${leagueId}')" class="px-3 py-2 rounded-xl text-xs font-display font-bold uppercase bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 transition flex items-center gap-1">
              📊 CSV Excel
            </button>
            <button type="button" onclick="SMPL_APP.printCurrentView()" class="px-3 py-2 rounded-xl text-xs font-display font-bold uppercase bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 transition flex items-center gap-1">
              🖨️ Drukuj / PDF
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[880px] smpl-standings-table">
            <thead>
              <tr class="smpl-table-header text-[11px] font-display uppercase tracking-wider text-slate-300">
                <th class="py-3.5 pl-4 pr-2 w-12 text-center">LP</th>
                <th class="py-3.5 px-2 w-20 text-center">Trend</th>
                <th class="py-3.5 px-3">Zawodnik (Imię i Nazwisko / Nick)</th>
                <th class="py-3.5 px-2.5 text-center" title="Rozegrane mecze">M</th>
                <th class="py-3.5 px-3 text-center text-white font-black bg-white/5" title="Punkty (z uwzględnieniem kar)">PKT</th>
                <th class="py-3.5 px-2.5 text-center text-emerald-400" title="Wygrane">W</th>
                <th class="py-3.5 px-2.5 text-center text-amber-400" title="Remisy">R</th>
                <th class="py-3.5 px-2.5 text-center text-rose-400" title="Porażki">P</th>
                <th class="py-3.5 px-2.5 text-center" title="Bramki Zdobyte">BZ</th>
                <th class="py-3.5 px-2.5 text-center" title="Bramki Stracone">BS</th>
                <th class="py-3.5 px-2.5 text-center" title="Bilans Bramek">+/-</th>
                <th class="py-3.5 px-2.5 text-center" title="Czyste Konta">🧤 CK</th>
                <th class="py-3.5 pl-2 pr-4 text-center">Forma (Ostatnie 5)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 text-sm font-mono-num">
              ${
                standings.length === 0
                  ? `
                    <tr>
                      <td colspan="13" class="py-12 px-4 text-center">
                        <div class="max-w-md mx-auto space-y-3">
                          <div class="text-4xl mb-1">⚽</div>
                          <div class="font-display font-black text-lg text-white uppercase tracking-wider">
                            Tabela ${escapeHtml(state.leagues[leagueId].name)} Czeka na Dodanie Zawodników
                          </div>
                          ${
                            isAdmin
                              ? `<p class="text-xs text-slate-300 leading-relaxed">
                                   Baza tej dywizji Score Match Liga jest gotowa do rozgrywek. Jako Administratorzy możecie w każdej chwili dodać graczy ręcznie lub dopisać ich z Listy Zgłoszeń w Panelu Admina.
                                 </p>
                                 <div class="pt-2 flex flex-wrap justify-center gap-2">
                                   <button onclick="SMPL_APP.openAddPlayerModal('${leagueId}')" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                                     ➕ Dodaj Gracza do tej Ligi
                                   </button>
                                   <button onclick="SMPL_APP.resetSeedConfirm()" class="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-slate-200 hover:text-white font-display font-bold text-xs uppercase">
                                     📊 Przywróć z Arkusza Excel
                                   </button>
                                 </div>`
                              : `<p class="text-xs text-slate-300 leading-relaxed">
                                   Skład tej dywizji Score Match Liga jest kompletowany i zarządzany wyłącznie przez Administrację SMPL. Zarejestrowani zawodnicy pojawią się w tabeli po akceptacji Administratora.
                                 </p>
                                 <div class="pt-2 flex flex-wrap justify-center gap-2">
                                   <button onclick="SMPL_APP.switchTab('register')" class="px-4 py-2.5 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 font-display font-bold text-xs uppercase transition">
                                     📝 Zapisz się na Listę Oczekujących
                                   </button>
                                 </div>`
                          }
                        </div>
                      </td>
                    </tr>
                  `
                  : standings
                      .map((row) => {
                  const diffStr = row.diff > 0 ? `+${row.diff}` : `${row.diff}`;
                  const diffColor =
                    row.diff > 0 ? 'text-emerald-400 font-bold' : row.diff < 0 ? 'text-rose-400' : 'text-slate-400';
                  const posBadgeClass =
                    row.position === 1
                      ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/30'
                      : row.position === 2
                      ? 'bg-slate-200 text-slate-950 font-black shadow-md'
                      : row.position === 3
                      ? 'bg-amber-600 text-white font-black shadow-md'
                      : row.zone.code === 'PROMOTION'
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-bold'
                      : row.zone.code === 'PLAYOFF' || row.zone.code === 'PLAYOFF_DOWN'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : row.zone.code === 'RELEGATION'
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold'
                      : 'bg-slate-800/80 text-slate-300 font-semibold';
                  const posLabel =
                    row.position === 1 ? '🥇1' : row.position === 2 ? '🥈2' : row.position === 3 ? '🥉3' : row.position;

                  const pObj = row.player || (state.players || []).find((item) => item.id === (row.playerId || row.id));
                  const pRank = window.SMPL_RANKS && pObj ? window.SMPL_RANKS.getPlayerRank(pObj, state) : null;
                  const avatarHtml =
                    window.SMPL_RANKS && pRank && !pRank.isPlaceholder
                      ? window.SMPL_RANKS.avatarWithGlassBadgeHtml(
                          row.avatar,
                          row.name,
                          'w-10 h-10 rounded-full object-cover border-2 border-white/15 group-hover:border-league transition',
                          pRank,
                          row.playerId,
                          'sm'
                        )
                      : `<div class="relative flex-shrink-0"><img src="${row.avatar}" alt="${escapeHtml(row.name)}" class="w-10 h-10 rounded-full object-cover border-2 border-white/15 group-hover:border-league transition"/></div>`;
                  const rankBadgesHtml =
                    window.SMPL_RANKS && pRank && !pRank.isPlaceholder
                      ? (typeof window.SMPL_RANKS.roleBadgesHtml === 'function' ? window.SMPL_RANKS.roleBadgesHtml(pRank, 'sm') : '') +
                        window.SMPL_RANKS.glassBadgeHtml(pRank, row.playerId, 'sm') +
                        (pRank.title ? window.SMPL_RANKS.titleHtml(pRank.title, 'sm') : '') +
                        (Array.isArray(pRank.extraTitles) ? pRank.extraTitles.slice(0, 2).map((et) => window.SMPL_RANKS.titleHtml(et, 'sm')).join('') : '')
                      : '';
                  const rankNameCls = window.SMPL_RANKS && pRank ? window.SMPL_RANKS.nameClass(pRank) : '';
                  const rowCos = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getPlayerCosmetics === 'function')
                    ? window.SMPL_STUDIO.getPlayerCosmetics(state, row.playerId)
                    : null;
                  const rowNickFx = (rowCos && rowCos.nickFxCss) ? (' ' + rowCos.nickFxCss) : '';

                  return `
                    <tr class="zone-row ${row.zone.colorClass} group cursor-pointer" onclick="SMPL_APP.openPlayerModal('${row.playerId}')">
                      <td class="py-3 pl-4 pr-2 text-center">
                        <span class="inline-flex items-center justify-center min-w-[28px] px-1 h-7 rounded-lg text-xs font-display ${posBadgeClass}">
                          ${posLabel}
                        </span>
                      </td>
                      <td class="py-3 px-2 text-center">
                        ${renderTrendBadge(row)}
                      </td>
                      <td class="py-3 px-3 font-sans">
                        <div class="flex items-center gap-3">
                          ${avatarHtml}
                          <div class="min-w-0">
                            <div class="font-bold text-white group-hover:text-league-primary transition flex items-center gap-1.5 flex-wrap">
                              <span class="${rankNameCls}${rowNickFx}">${escapeHtml(row.name)}</span>
                              ${rankBadgesHtml}
                              ${window.SMPL_RANKS && typeof window.SMPL_RANKS.expansionBadgesHtml === 'function' ? window.SMPL_RANKS.expansionBadgesHtml(state, pObj || row, true) : ''}
                              ${
                                row.penaltyPoints > 0
                                  ? `<span class="px-1.5 py-0.5 rounded bg-rose-500/25 border border-rose-500/50 text-rose-300 text-[10px] font-display font-black tracking-wide" title="Punkty karne nałożone przez Komisję Ligi: -${row.penaltyPoints} PKT (${escapeHtml(row.penaltyReason || 'Decyzja dyscyplinarna')})">-${row.penaltyPoints} PKT</span>`
                                  : ''
                              }
                              ${
                                row.yellowCards > 0
                                  ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-display font-bold" title="Żółte kartki: ${row.yellowCards}">🟨 ${row.yellowCards}</span>`
                                  : ''
                              }
                              ${
                                row.redCards > 0
                                  ? `<span class="px-1.5 py-0.5 rounded bg-rose-600/30 border border-rose-500/60 text-rose-300 text-[10px] font-display font-bold" title="Czerwone kartki: ${row.redCards}">🟥 ${row.redCards}</span>`
                                  : ''
                              }
                              ${
                                row.isSuspended
                                  ? `<span class="px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-600 text-[10px] font-display font-black animate-pulse" title="Zawieszony: ${escapeHtml(row.suspensionReason || 'Decyzja Komisji Dyscyplinarnej')}">⛔ ZAWIESZONY</span>`
                                  : ''
                              }
                            </div>
                            <div class="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                              <span>@${escapeHtml(row.nick)}</span>
                              ${renderClanBadgeHtml(pObj || row, state, true)}
                              ${(() => {
                                const pS55Badge = (row.M === 0 && window.SMPL_DB && typeof window.SMPL_DB.findPlayerS55Record === 'function')
                                  ? window.SMPL_DB.findPlayerS55Record(state, pObj || row)
                                  : null;
                                if (!pS55Badge || !pS55Badge.inProgress || pS55Badge.M <= 0) return '';
                                return `<button type="button" onclick="event.stopPropagation(); SMPL_APP.setArchiveMode('SEASONS'); SMPL_APP.setArchiveSeason(55); SMPL_APP.setArchiveLeague('${pS55Badge.leagueId}'); SMPL_APP.switchTab('archive');" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-[10px] font-display font-bold text-amber-300 transition" title="Obecny dorobek gracza na półmetku Sezonu 55 (${escapeHtml(pS55Badge.leagueLabel)})">⏳ S55: ${pS55Badge.leagueId} #${pS55Badge.pos} • ${pS55Badge.PKT} pkt (${pS55Badge.M}M)</button>`;
                              })()}
                              <span class="text-[10px] text-slate-500 hidden sm:inline">• ${escapeHtml(row.zone.label)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td class="py-3 px-2.5 text-center text-slate-300 font-semibold">${row.M}</td>
                      <td class="py-3 px-3 text-center bg-white/5">
                        <span class="font-display font-black text-base text-white">${row.PKT}</span>
                      </td>
                      <td class="py-3 px-2.5 text-center text-emerald-400 font-semibold">${row.W}</td>
                      <td class="py-3 px-2.5 text-center text-amber-400 font-semibold">${row.R}</td>
                      <td class="py-3 px-2.5 text-center text-rose-400 font-semibold">${row.P}</td>
                      <td class="py-3 px-2.5 text-center text-slate-200 font-semibold">${row.BZ}</td>
                      <td class="py-3 px-2.5 text-center text-slate-400">${row.BS}</td>
                      <td class="py-3 px-2.5 text-center ${diffColor}">${diffStr}</td>
                      <td class="py-3 px-2.5 text-center">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${row.cleanSheets > 0 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'text-slate-500'}">
                          ${row.cleanSheets}
                        </span>
                      </td>
                      <td class="py-3 pl-2 pr-4 text-center" onclick="event.stopPropagation()">
                        ${renderFormBadges(row.form)}
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <!-- Legenda Stref Tabeli -->
        <div class="p-4 bg-slate-950/80 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <div class="flex flex-wrap items-center gap-4">
            ${
              leagueId === 'L1'
                ? `<div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-amber-400 inline-block"></span><span>Mistrz Polski SMPL (Poz. 1)</span></div>
                   <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span><span>Podium Ekstraklasy (Poz. 2–3)</span></div>`
                : `<div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span><span>Strefa Awansu Bezpośredniego (Poz. 1–2)</span></div>`
            }
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span><span>Strefa Barażowa</span></div>
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span><span>Strefa Spadkowa</span></div>
          </div>
          <div class="text-slate-400 text-[11px]">
            💡 Kliknij na wiersz dowolnego gracza, aby zobaczyć jego pełną kartę, historię meczów i porównanie H2H.
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 2. KLASYFIKACJA „ŻELAZNA KURTYNA / ZŁOTE RĘKAWICE” (CZYSTE KONTA)
  // =========================================================================
  function renderCleanSheetsView(state, leagueId) {
    const ranking = window.SMPL_ENGINE.calculateCleanSheetsRanking(state, leagueId);
    const top3 = ranking.slice(0, 3);
    const medals = [
      { label: 'ZŁOTE RĘKAWICE #1', border: 'border-amber-400', glow: 'smpl-podium-1', bg: 'from-amber-500/25 via-slate-900 to-slate-950', badge: 'bg-amber-400 text-slate-950', icon: '🥇🧤' },
      { label: 'SREBRNE RĘKAWICE #2', border: 'border-slate-300', glow: 'smpl-podium-2', bg: 'from-slate-400/20 via-slate-900 to-slate-950', badge: 'bg-slate-200 text-slate-950', icon: '🥈🧤' },
      { label: 'BRĄZOWE RĘKAWICE #3', border: 'border-amber-700', glow: 'smpl-podium-3', bg: 'from-amber-700/25 via-slate-900 to-slate-950', badge: 'bg-amber-600 text-white', icon: '🥉🧤' }
    ];

    return `
      <!-- Nagłówek Żelaznej Kurtyny -->
      <div class="cleansheets-showcase-banner rounded-3xl p-5 sm:p-7 mb-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div class="max-w-2xl">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-display font-bold uppercase tracking-wider">
              🧤 OFICJALNA KLASYFIKACJA DEFENSYWNA SMPL
            </span>
            <h2 class="font-display font-black text-xl sm:text-2xl text-white mt-2 uppercase tracking-wide">
              Żelazna Kurtyna / Złote Rękawice — ${escapeHtml(state.leagues[leagueId].shortName)}
            </h2>
            <p class="text-xs sm:text-sm text-slate-300 mt-1">
              Za każdy zatwierdzony mecz z <strong class="text-emerald-400">0 straconych bramek</strong> system automatycznie dopisuje <strong class="text-emerald-400">+1 Czyste Konto</strong> oraz wylicza % meczów na zero z tyłu i średnią wpuszczonych goli.
            </p>
          </div>
        </div>
      </div>

      <!-- Podium Top 3 Złote Rękawice -->
      ${
        top3.length === 0
          ? `<div class="p-8 rounded-2xl bg-slate-950/70 border border-white/10 text-center text-slate-400 mb-6">
               <div class="text-3xl mb-2">🧤</div>
               <div class="font-display font-bold text-white text-sm">Czyste konta czekają na pierwsze mecze</div>
               <p class="text-xs text-slate-400 mt-1">Gdy w zatwierdzonym meczu gracz zachowa czyste konto (0 bramek straconych), system automatycznie stworzy tutaj podium!</p>
             </div>`
          : `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
               ${top3
                 .map((item, idx) => {
                   const m = medals[idx];
                   const csP = (state.players || []).find((pl) => pl.id === item.playerId);
                   const csRk = window.SMPL_RANKS && csP ? window.SMPL_RANKS.getPlayerRank(csP, state) : null;
                   const csAv =
                     window.SMPL_RANKS && csRk && !csRk.isPlaceholder
                       ? window.SMPL_RANKS.avatarWithGlassBadgeHtml(item.avatar, item.name, `w-16 h-16 rounded-full object-cover border-2 ${m.border}`, csRk, item.playerId, 'sm')
                       : `<img src="${item.avatar}" class="w-16 h-16 rounded-full object-cover border-2 ${m.border}" alt="${escapeHtml(item.name)}"/>`;
                   return `
                     <div onclick="SMPL_APP.openPlayerModal('${item.playerId}')" class="cursor-pointer rounded-2xl p-5 bg-gradient-to-br ${m.bg} border-2 ${m.border} ${m.glow} shadow-xl hover:scale-[1.01] transition relative overflow-hidden">
                       <div class="flex items-center justify-between mb-4">
                         <span class="px-2.5 py-1 rounded-lg font-display font-black text-[11px] ${m.badge}">${m.label}</span>
                         <span class="text-2xl">${m.icon}</span>
                       </div>
                       <div class="flex items-center gap-4">
                         ${csAv}
                         <div class="min-w-0">
                           ${(() => {
                             const csCos = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getPlayerCosmetics === 'function')
                               ? window.SMPL_STUDIO.getPlayerCosmetics(state, item.playerId)
                               : null;
                             const csFx = (csCos && csCos.nickFxCss) ? (' ' + csCos.nickFxCss) : '';
                             const csBadge = (csCos && csCos.badgeLabel)
                               ? `<span class="smpl-shop-badge-pill is-compact" style="border-color:${escapeHtml(csCos.badgeColor || '#38bdf8')};color:${escapeHtml(csCos.badgeColor || '#38bdf8')};">${escapeHtml(csCos.badgeLabel)}</span>`
                               : '';
                             return `
                               <div class="font-display font-black text-base text-white truncate ${window.SMPL_RANKS && csRk ? window.SMPL_RANKS.nameClass(csRk) : ''}${csFx}">${escapeHtml(item.name)}</div>
                               ${window.SMPL_RANKS && csRk && !csRk.isPlaceholder ? `<div class="mt-1 mb-0.5 flex items-center gap-1 flex-wrap">${typeof window.SMPL_RANKS.roleBadgesHtml === 'function' ? window.SMPL_RANKS.roleBadgesHtml(csRk, 'sm') : ''}${window.SMPL_RANKS.glassBadgeHtml(csRk, item.playerId, 'sm')}${csBadge}</div>` : (csBadge ? `<div class="mt-1 mb-0.5">${csBadge}</div>` : '')}
                             `;
                           })()}
                           <div class="text-xs text-slate-400">@${escapeHtml(item.nick)} • Poz. #${item.leaguePosition} w lidze</div>
                           <div class="mt-2 flex items-baseline gap-2">
                             <span class="font-display font-black text-2xl text-emerald-400">${item.cleanSheets}</span>
                             <span class="text-xs text-slate-300 uppercase font-semibold">Czystych Kont</span>
                           </div>
                         </div>
                       </div>
                       <div class="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
                         <div>
                           <div class="text-slate-400 text-[10px]">MECZE</div>
                           <div class="font-bold text-white mt-0.5">${item.matchesPlayed}</div>
                         </div>
                         <div>
                           <div class="text-slate-400 text-[10px]">% NA ZERO</div>
                           <div class="font-bold text-emerald-400 mt-0.5">${item.cleanSheetPct}%</div>
                         </div>
                         <div>
                           <div class="text-slate-400 text-[10px]">ŚR. STRACONYCH</div>
                           <div class="font-bold text-amber-300 mt-0.5">${item.goalsAgainstAvg} / mecz</div>
                         </div>
                       </div>
                     </div>
                   `;
                 })
                 .join('')}
             </div>`
      }

      <!-- Pełna Tabela Rankingowa Czystych Kont -->
      <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div class="p-4 sm:px-6 border-b border-white/10 bg-slate-900/50 flex items-center justify-between">
          <h3 class="font-display font-bold text-sm sm:text-base uppercase tracking-wider text-white">
            Pełny Ranking „Żelazna Kurtyna” (${ranking.length} zawodników)
          </h3>
          <span class="text-xs text-emerald-400 font-semibold">100% Automatyczna Aktualizacja</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[740px]">
            <thead>
              <tr class="border-b border-white/10 bg-slate-950/70 text-[11px] font-display uppercase tracking-wider text-slate-400">
                <th class="py-3.5 pl-4 pr-2 w-16 text-center">Miejsce</th>
                <th class="py-3.5 px-3">Zawodnik</th>
                <th class="py-3.5 px-3 text-center text-emerald-400 font-black bg-emerald-500/10">🧤 Czyste Konta</th>
                <th class="py-3.5 px-3 text-center">Rozegrane Mecze</th>
                <th class="py-3.5 px-4 text-center">% Meczów na Zero z Tyłu</th>
                <th class="py-3.5 px-3 text-center">Stracone Gole (BS)</th>
                <th class="py-3.5 pl-3 pr-4 text-center">Śr. Straconych / Mecz</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 text-sm font-mono-num">
              ${
                ranking.length === 0
                  ? `
                    <tr>
                      <td colspan="7" class="py-10 text-center text-slate-400">
                        <div class="text-3xl mb-1">🧤</div>
                        <div class="font-display font-bold text-white text-sm">Brak rozegranych meczów w tej lidze</div>
                        <div class="text-xs text-slate-400 mt-1">Ranking czystych kont pojawi się automatycznie po rozegraniu pierwszych meczów w tabeli.</div>
                      </td>
                    </tr>
                  `
                  : ranking
                      .map((r) => {
                  const rankBadge =
                    r.rank === 1
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : r.rank === 2
                      ? 'bg-slate-300 text-slate-950 font-bold'
                      : r.rank === 3
                      ? 'bg-amber-700 text-white font-bold'
                      : 'bg-slate-800 text-slate-300';
                  return `
                    <tr onclick="SMPL_APP.openPlayerModal('${r.playerId}')" class="hover:bg-white/5 transition cursor-pointer">
                      <td class="py-3 pl-4 pr-2 text-center">
                        <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-display ${rankBadge}">
                          ${r.rank}
                        </span>
                      </td>
                      <td class="py-3 px-3 font-sans">
                        ${(() => {
                          const rowPl = (state.players || []).find((pl) => pl.id === r.playerId);
                          const rowRk = window.SMPL_RANKS && rowPl ? window.SMPL_RANKS.getPlayerRank(rowPl, state) : null;
                          const av =
                            window.SMPL_RANKS && rowRk && !rowRk.isPlaceholder
                              ? window.SMPL_RANKS.avatarWithGlassBadgeHtml(r.avatar, r.name, 'w-9 h-9 rounded-full object-cover border border-white/15', rowRk, r.playerId, 'sm')
                              : `<img src="${r.avatar}" class="w-9 h-9 rounded-full object-cover border border-white/15" alt=""/>`;
                          const bd = window.SMPL_RANKS && rowRk && !rowRk.isPlaceholder
                            ? (typeof window.SMPL_RANKS.roleBadgesHtml === 'function' ? window.SMPL_RANKS.roleBadgesHtml(rowRk, 'sm') : '') +
                              window.SMPL_RANKS.glassBadgeHtml(rowRk, r.playerId, 'sm')
                            : '';
                          const rowCosCs = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getPlayerCosmetics === 'function')
                            ? window.SMPL_STUDIO.getPlayerCosmetics(state, r.playerId)
                            : null;
                          const csRowFx = (rowCosCs && rowCosCs.nickFxCss) ? (' ' + rowCosCs.nickFxCss) : '';
                          const csRowBadge = (rowCosCs && rowCosCs.badgeLabel)
                            ? `<span class="smpl-shop-badge-pill is-compact" style="border-color:${escapeHtml(rowCosCs.badgeColor || '#38bdf8')};color:${escapeHtml(rowCosCs.badgeColor || '#38bdf8')};">${escapeHtml(rowCosCs.badgeLabel)}</span>`
                            : '';
                          return `
                            <div class="flex items-center gap-3">
                              ${av}
                              <div>
                                <div class="font-bold text-white flex items-center gap-1.5 flex-wrap">
                                  <span class="${window.SMPL_RANKS && rowRk ? window.SMPL_RANKS.nameClass(rowRk) : ''}${csRowFx}">${escapeHtml(r.name)}</span>
                                  ${bd}
                                  ${csRowBadge}
                                </div>
                                <div class="text-xs text-slate-400">@${escapeHtml(r.nick)}</div>
                              </div>
                            </div>
                          `;
                        })()}
                      </td>
                      <td class="py-3 px-3 text-center bg-emerald-500/5">
                        <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 font-display font-black text-emerald-300 text-base">
                          🧤 ${r.cleanSheets}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-center text-slate-200 font-semibold">${r.matchesPlayed}</td>
                      <td class="py-3 px-4">
                        <div class="flex items-center gap-2.5 max-w-[180px] mx-auto">
                          <div class="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-gradient-to-r from-emerald-500 to-teal-300 rounded-full" style="width: ${Math.min(100, r.cleanSheetPct)}%"></div>
                          </div>
                          <span class="text-xs font-bold text-emerald-400 w-12 text-right">${r.cleanSheetPct}%</span>
                        </div>
                      </td>
                      <td class="py-3 px-3 text-center text-slate-300">${r.goalsConceded}</td>
                      <td class="py-3 pl-3 pr-4 text-center">
                        <span class="px-2.5 py-1 rounded-lg bg-slate-800/90 text-amber-300 font-bold text-xs">
                          ${r.goalsAgainstAvg.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 3. MODUŁ TERMINARZA I WYNIKÓW (KOLEJKI 1–30)
  // =========================================================================
  function renderScheduleView(state, leagueId, filterState, session) {
    const leagueMatches = state.matches.filter((m) => m.leagueId === leagueId);
    const playersMap = {};
    state.players.forEach((p) => {
      playersMap[p.id] = p;
    });

    const maxRound = leagueMatches.length > 0
      ? leagueMatches.reduce((acc, m) => Math.max(acc, Number(m.round || 1)), 1)
      : ((state.leagues[leagueId] && Number(state.leagues[leagueId].totalRounds)) || 15);
    const rpw = (state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4;
    const currentLeagueWeek = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1;
    const defaultRoundForWeek = Math.min(maxRound, Math.max(1, (Number(currentLeagueWeek) - 1) * rpw + 1));
    const activeRound = filterState.round || defaultRoundForWeek;
    const activeWeek = filterState.week || null;
    const statusFilter = filterState.status || 'ALL';
    const searchQuery = (filterState.search || '').trim().toLowerCase();
    const totalWeeks = Math.max(1, Math.ceil(maxRound / rpw));

    const filteredMatches = leagueMatches
      .filter((m) => {
        if (activeWeek) {
          const wStart = (Number(activeWeek) - 1) * rpw + 1;
          const wEnd = Number(activeWeek) * rpw;
          if (Number(m.round) < wStart || Number(m.round) > wEnd) return false;
        } else if (activeRound !== 'ALL' && Number(m.round) !== Number(activeRound)) {
          return false;
        }
        if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
        if (searchQuery) {
          const hp = playersMap[m.homeId] || {};
          const ap = playersMap[m.awayId] || {};
          const hay = `${hp.name || ''} ${hp.nick || ''} ${ap.name || ''} ${ap.nick || ''}`.toLowerCase();
          if (!hay.includes(searchQuery)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const rDiff = Number(a.round || 1) - Number(b.round || 1);
        if (rDiff !== 0) return rDiff;
        const pairA = [String(a.homeId || ''), String(a.awayId || '')].sort().join('__');
        const pairB = [String(b.homeId || ''), String(b.awayId || '')].sort().join('__');
        if (pairA !== pairB) return String(a.id || '').localeCompare(String(b.id || ''));
        const legDiff = Number(a.legNumber || 1) - Number(b.legNumber || 1);
        if (legDiff !== 0) return legDiff;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

    const allLeagueExtensions = (window.SMPL_DB && typeof window.SMPL_DB.getMatchingRoundExtensions === 'function')
      ? window.SMPL_DB.getMatchingRoundExtensions(state, leagueId, null, null)
      : [];
    const activeWeekExtensions = (window.SMPL_DB && typeof window.SMPL_DB.getMatchingRoundExtensions === 'function')
      ? window.SMPL_DB.getMatchingRoundExtensions(state, leagueId, null, Number(currentLeagueWeek))
      : [];
    const currentViewExtensions = (window.SMPL_DB && typeof window.SMPL_DB.getMatchingRoundExtensions === 'function')
      ? window.SMPL_DB.getMatchingRoundExtensions(
          state,
          leagueId,
          activeWeek ? null : (activeRound === 'ALL' ? null : Number(activeRound)),
          activeWeek ? Number(activeWeek) : null
        )
      : [];
    const visibleExtensions = currentViewExtensions.length > 0 ? currentViewExtensions : activeWeekExtensions;

    const weeksButtons = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const wStart = (w - 1) * rpw + 1;
      const wEnd = Math.min(maxRound, w * rpw);
      const isSelectedWeek = Number(activeWeek) === w;
      const isCurrentActiveWeek = Number(currentLeagueWeek) === w;
      const isExtendedWeek = allLeagueExtensions.some((ex) => ex.scopeType === 'ALL_ACTIVE' || (ex.scopeType === 'WEEK' && Number(ex.weekNum) === w));
      weeksButtons.push(`
        <button type="button" onclick="SMPL_APP.setScheduleWeek(${w})" class="px-3 py-1.5 rounded-xl border text-xs font-display font-bold transition flex-shrink-0 ${
          isSelectedWeek
            ? 'btn-league border-transparent scale-105'
            : isExtendedWeek
            ? 'bg-amber-500/20 text-amber-200 border-amber-400/60'
            : isCurrentActiveWeek
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
            : 'bg-slate-950/90 text-slate-300 border-white/10 hover:border-white/30'
        }">
          📅 Tydzień ${w} (K${wStart}–K${wEnd})${isCurrentActiveWeek ? ' • AKTYWNY' : ''}${isExtendedWeek ? ' ⏳' : ''}
        </button>
      `);
    }

    const roundsButtons = [];
    for (let r = 1; r <= maxRound; r++) {
      const roundMatches = leagueMatches.filter((m) => Number(m.round) === r);
      const hasPending = roundMatches.some((m) => m.status === 'PENDING');
      const allPlayed = roundMatches.length > 0 && roundMatches.every((m) => m.status === 'APPROVED' || m.status === 'WALKOVER');
      const isSelected = !activeWeek && Number(activeRound) === r;
      const rWeek = Math.ceil(r / rpw);
      const isExtendedRound = allLeagueExtensions.some(
        (ex) => ex.scopeType === 'ALL_ACTIVE' || (ex.scopeType === 'ROUND' && Number(ex.roundNum) === r) || (ex.scopeType === 'WEEK' && Number(ex.weekNum) === rWeek)
      );

      let btnClass = 'bg-slate-900/90 text-slate-300 border-white/10 hover:border-white/30';
      if (isSelected) {
        btnClass = 'btn-league border-transparent scale-105';
      } else if (hasPending || isExtendedRound) {
        btnClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      } else if (allPlayed) {
        btnClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      }

      roundsButtons.push(`
        <button type="button" onclick="SMPL_APP.setScheduleRound(${r})" class="px-2.5 py-1.5 rounded-lg border text-xs font-display font-bold transition flex-shrink-0 ${btnClass}">
          K${r}${hasPending ? ' ⏳' : isExtendedRound ? ' 🕒' : allPlayed ? ' ✓' : ''}
        </button>
      `);
    }

    const isAdmin = Boolean(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'));
    const adminLinkedPlayer = (isAdmin && window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function')
      ? window.SMPL_DB.findPlayerForAdmin(session.adminId, state)
      : null;
    const myEffectivePlayerId = (session && !session.isGuest && session.isPlayerAuthenticated && session.activePlayerId)
      ? session.activePlayerId
      : (adminLinkedPlayer && adminLinkedPlayer.id ? adminLinkedPlayer.id : '');
    const isLoggedInPlayer = Boolean(myEffectivePlayerId);
    const compSched = (state && state.competitions) ? state.competitions : {};
    const allProposals = Array.isArray(compSched.matchProposals) ? compSched.matchProposals : [];
    const allDisputes = Array.isArray(compSched.matchDisputes) ? compSched.matchDisputes : [];
    const allFanPolls = compSched.fanPolls || {};
    const myWeekStart = (Number(currentLeagueWeek) - 1) * rpw + 1;
    const myWeekEnd = Number(currentLeagueWeek) * rpw;
    const myWeekPendingList = isLoggedInPlayer
      ? (state.matches || []).filter((m) =>
          m &&
          m.status === 'SCHEDULED' &&
          Number(m.round) >= myWeekStart &&
          Number(m.round) <= myWeekEnd &&
          (m.homeId === myEffectivePlayerId || m.awayId === myEffectivePlayerId)
        )
      : [];

    const activeDeadlineInfo = (window.SMPL_DB && typeof window.SMPL_DB.getActiveDeadlineInfo === 'function')
      ? window.SMPL_DB.getActiveDeadlineInfo(state, leagueId, activeRound !== 'ALL' ? Number(activeRound) : defaultRoundForWeek)
      : { deadlineDate: 'Czwartek', deadlineTime: '23:59', isExtended: false, isPassed: false };

    return `
      <!-- Panel sterowania terminarzem (System 4 Kolejki na Tydzień) -->
      <div class="matchday-showcase-banner rounded-3xl p-5 sm:p-6 mb-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <div class="flex flex-wrap items-center gap-2 mb-1.5" data-smpl-ext-card data-ext-date="${escapeHtml(activeDeadlineInfo.deadlineDate || '')}" data-ext-time="${escapeHtml(activeDeadlineInfo.deadlineTime || '23:59')}" data-ext-tz="Europe/Warsaw">
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-display font-bold uppercase">
                ⏱️ SYSTEM ROZGRYWEK: 4 KOLEJKI NA TYDZIEŃ (AKTYWNY TYDZIEŃ #${currentLeagueWeek})
              </span>
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/45 text-amber-200 text-[10px] font-display font-black uppercase">
                ⏰ KONIEC KOLEJKI: ${activeDeadlineInfo.isExtended ? `PRZEDŁUŻONO DO ${escapeHtml(activeDeadlineInfo.deadlineDate)} ${escapeHtml(activeDeadlineInfo.deadlineTime)}` : `ZAWSZE CZWARTEK 23:59 (${escapeHtml(activeDeadlineInfo.deadlineDate)})`}
              </span>
              <span class="px-2 py-0.5 rounded-full bg-slate-900/90 border border-white/15 text-slate-200 text-[10px] font-display font-bold" data-smpl-ext-remaining>
                ⏳ Termin: ${escapeHtml(activeDeadlineInfo.deadlineDate)} ${escapeHtml(activeDeadlineInfo.deadlineTime)}
              </span>
            </div>
            <h2 class="font-display font-black text-lg sm:text-xl text-white uppercase tracking-wide">
              Terminarz i Wyniki — ${escapeHtml(state.leagues[leagueId].name)} (Kolejki 1–${maxRound})
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              <strong>Zasada SMPL:</strong> W każdej kolejce gramy od razu <strong class="text-emerald-300">pełny dwumecz (1 u siebie + 1 na wyjeździe w tej samej kolejce)</strong> do <strong class="text-white">max 2 bramek</strong>. Kolejka kończy się <strong class="text-amber-300">zawsze w czwartek o 23:59</strong> (Admin może puścić następną wcześniej), a <strong class="text-rose-300">mecze nierozegrane trafiają do Adminów</strong> w celu podjęcia działań!
            </p>
          </div>
          <div class="smpl-schedule-toolbar grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-nowrap items-stretch gap-2 flex-shrink-0">
            <input
              type="text"
              placeholder="🔍 Szukaj gracza..."
              value="${escapeHtml(filterState.search || '')}"
              oninput="SMPL_APP.setScheduleSearch(this.value)"
              class="px-3 py-2 rounded-xl bg-slate-950/90 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 min-w-[165px]"
            />
            <select onchange="SMPL_APP.setScheduleStatus(this.value)" class="px-3 py-2 rounded-xl bg-slate-950/90 border border-white/15 text-xs text-white focus:outline-none min-w-[165px]">
              <option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>Wszystkie statusy</option>
              <option value="APPROVED" ${statusFilter === 'APPROVED' ? 'selected' : ''}>✅ Rozegrane (Zatwierdzone)</option>
              <option value="PENDING" ${statusFilter === 'PENDING' ? 'selected' : ''}>⏳ Oczekujące na Admina</option>
              <option value="SCHEDULED" ${statusFilter === 'SCHEDULED' ? 'selected' : ''}>📅 Nierozegrane</option>
              <option value="WALKOVER" ${statusFilter === 'WALKOVER' ? 'selected' : ''}>⚠️ Walkowery (WO)</option>
            </select>
            <button type="button" onclick="SMPL_APP.setScheduleRound('ALL')" class="px-3.5 py-2 rounded-xl text-xs font-bold border whitespace-nowrap ${activeRound === 'ALL' && !activeWeek ? 'btn-league' : 'bg-slate-900 border-white/15 text-slate-300'}">
              Wszystkie Kolejki
            </button>
            ${
              isAdmin
                ? `<button type="button" onclick="SMPL_APP.openReleaseRoundDialog()" class="px-3 py-2 rounded-xl text-xs font-display font-bold uppercase whitespace-nowrap bg-emerald-500/20 hover:bg-emerald-500 text-emerald-200 hover:text-slate-950 border border-emerald-400/50 transition" title="Puść nową kolejkę lub tydzień (także wcześniej przed czwartkiem 23:59)">
                     🚀 Puść Kolejkę
                   </button>
                   <button type="button" onclick="SMPL_APP.openRoundExtensionDialog({ leagueScope: '${escapeHtml(leagueId)}', roundNum: ${activeRound !== 'ALL' ? Number(activeRound) : defaultRoundForWeek}, weekNum: ${activeWeek ? Number(activeWeek) : Number(currentLeagueWeek)} })" class="px-3 py-2 rounded-xl text-xs font-display font-bold uppercase whitespace-nowrap bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-400/50 transition" title="Przedłuż termin kolejki lub tygodnia (np. Święta, wyjazdy, awaria gry)">
                     ⏳ Przedłuż Kolejkę
                   </button>`
                : ''
            }
            ${
              isAdmin && leagueMatches.length > 0
                ? `<button type="button" onclick="SMPL_APP.adminClearSchedule('${leagueId}')" class="px-3 py-2 rounded-xl text-xs font-display font-bold uppercase whitespace-nowrap bg-rose-950/60 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 transition" title="Wyzeruj całkowicie terminarz tej ligi do nowego wygenerowania">
                     🗑️ Wyzeruj
                   </button>`
                : ''
            }
          </div>
        </div>

        <!-- Pasek wyboru Tygodnia (po 4 kolejki na tydzień) -->
        <div class="mb-3">
          <div class="text-[11px] font-display uppercase text-slate-400 font-bold mb-1.5">Filtruj wg Tygodnia Rozgrywkowego (4 kolejki / tydzień):</div>
          <div class="smpl-hscroll-fade flex items-center gap-1.5 overflow-x-auto pb-1.5">
            ${weeksButtons.join('')}
          </div>
        </div>

        <!-- Pasek wyboru Kolejki 1-30 -->
        <div class="smpl-hscroll-fade flex items-center gap-1.5 overflow-x-auto pb-2 pt-1">
          ${roundsButtons.join('')}
        </div>
      </div>

      ${
        visibleExtensions.length > 0
          ? `<div class="space-y-3 mb-5">
               ${visibleExtensions
                 .map((ext) => {
                   const tagMap = {
                     HOLIDAYS: { badge: '🎄 ŚWIĘTA / OKOLICZNOŚCI WYJĄTKOWE', border: 'border-amber-400/60', pill: 'bg-amber-400/20 text-amber-200 border-amber-400/40' },
                     WEEKEND: { badge: '🐣 DŁUGI WEEKEND / WYJAZDY', border: 'border-sky-400/60', pill: 'bg-sky-400/20 text-sky-200 border-sky-400/40' },
                     TECH: { badge: '🛠️ PRZERWA TECHNICZNA / AWARIA GRY', border: 'border-rose-400/60', pill: 'bg-rose-400/20 text-rose-200 border-rose-400/40' },
                     ARREARS: { badge: '⚡ DOGRYWKA ZALEGŁOŚCI', border: 'border-purple-400/60', pill: 'bg-purple-400/20 text-purple-200 border-purple-400/40' },
                     CUSTOM: { badge: '⏳ PRZEDŁUŻONY TERMIN KOLEJKI', border: 'border-amber-400/60', pill: 'bg-amber-400/20 text-amber-200 border-amber-400/40' }
                   };
                   const tg = tagMap[String(ext.occasionTag || 'CUSTOM').toUpperCase()] || tagMap.CUSTOM;
                   const dtIsoAttr = escapeHtml((ext.extendedUntilDate || '') + 'T' + (ext.extendedUntilTime || '23:59') + ':00');
                   const humanDt = (window.SMPL_APP && typeof window.SMPL_APP.formatRoundExtensionDateLabel === 'function')
                     ? window.SMPL_APP.formatRoundExtensionDateLabel(ext.extendedUntilDate, ext.extendedUntilTime, ext.timeZone)
                     : ((ext.extendedUntilDate || '') + ' • ' + (ext.extendedUntilTime || '23:59'));
                   return `
                     <div class="smpl-round-ext-banner glass-panel rounded-2xl p-4 sm:p-5 border-2 ${tg.border} bg-slate-950/90 shadow-xl" data-smpl-ext-card data-ext-date="${escapeHtml(ext.extendedUntilDate || '')}" data-ext-time="${escapeHtml(ext.extendedUntilTime || '23:59')}" data-ext-tz="${escapeHtml(ext.timeZone || 'Europe/Warsaw')}">
                       <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                         <div class="space-y-1">
                           <div class="flex flex-wrap items-center gap-2">
                             <span class="px-2.5 py-0.5 rounded-full border text-[10px] font-display font-black uppercase ${tg.pill}">
                               ${tg.badge}
                             </span>
                             <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-display font-bold uppercase" data-smpl-ext-remaining>
                               ⏳ Liczenie czasu...
                             </span>
                           </div>
                           <div class="font-display font-black text-sm sm:text-base text-white uppercase">
                             ${escapeHtml(ext.scopeLabel || '')} — nowy termin: <time datetime="${dtIsoAttr}" class="text-amber-300 underline decoration-amber-400/50">${escapeHtml(humanDt)}</time>
                           </div>
                           <p class="text-xs text-slate-200 leading-relaxed">
                             💬 ${escapeHtml(ext.reason || '')}
                             ${ext.updatedBy ? `<span class="text-slate-400 ml-1">(ustawił Admin: ${escapeHtml(ext.updatedBy)})</span>` : ''}
                           </p>
                         </div>
                         ${
                           isAdmin
                             ? `<div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                                  <button type="button" onclick="SMPL_APP.copyRoundExtensionMessenger('${escapeHtml(ext.id)}')" class="px-3 py-1.5 rounded-xl bg-blue-600/25 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-400/40 text-[11px] font-display font-bold uppercase transition">
                                    📋 Kopiuj na Messenger
                                  </button>
                                  <button type="button" onclick="SMPL_APP.openRoundExtensionDialog({ editId: '${escapeHtml(ext.id)}' })" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-400/45 text-[11px] font-display font-bold uppercase transition">
                                    ✏️ Zmień termin
                                  </button>
                                  <button type="button" onclick="SMPL_APP.handleRemoveRoundExtension('${escapeHtml(ext.id)}')" class="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/40 text-[11px] font-display font-bold uppercase transition">
                                    ✕ Zakończ
                                  </button>
                                </div>`
                             : ''
                         }
                       </div>
                     </div>
                   `;
                 })
                 .join('')}
             </div>`
          : ''
      }

      ${
        isLoggedInPlayer
          ? `<div class="glass-panel rounded-2xl p-4 sm:px-5 mb-5 border ${myWeekPendingList.length > 0 ? 'border-amber-400/40' : 'border-emerald-400/40'} flex flex-wrap items-center justify-between gap-3">
               <div class="flex items-center gap-2.5">
                 <span class="text-xl">${myWeekPendingList.length > 0 ? '⏳' : '✅'}</span>
                 <div>
                   <div class="font-display font-black text-xs sm:text-sm uppercase text-white">
                     Wskaźnik Zaległości — Tydzień #${currentLeagueWeek} (K${myWeekStart}–K${myWeekEnd})${activeWeekExtensions.length > 0 ? ` <span class="text-amber-300">• TERMIN PRZEDŁUŻONY DO ${escapeHtml(activeWeekExtensions[0].extendedUntilDate)} ${escapeHtml(activeWeekExtensions[0].extendedUntilTime || '23:59')}</span>` : ''}
                   </div>
                   <div class="text-xs text-slate-300">
                     ${
                       myWeekPendingList.length > 0
                         ? `Pozostało Ci <strong class="text-amber-300">${myWeekPendingList.length}</strong> meczów do rozegrania w bieżącym tygodniu — zaproponuj termin „Kiedy Gramy?” rywalowi!`
                         : 'Wszystkie Twoje mecze w bieżącym tygodniu zostały rozegrane lub wysłane!'
                     }
                   </div>
                 </div>
               </div>
               <div class="flex flex-wrap items-center gap-2">
                 ${
                   myWeekPendingList.length > 0
                     ? `<button type="button" onclick="SMPL_APP.openMatchProposalModal('${escapeHtml(myWeekPendingList[0].id)}')" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 text-xs font-display font-bold uppercase transition">
                          📅 Zaproponuj termin następnego meczu
                        </button>`
                     : ''
                 }
                 <button type="button" onclick="SMPL_APP.openSmplWrappedModal('${escapeHtml(myEffectivePlayerId)}')" class="px-3 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-400/40 text-xs font-display font-bold uppercase transition">
                   🎁 Moje SMPL Wrapped
                 </button>
               </div>
             </div>`
          : ''
      }

      <!-- Lista Meczów -->
      <div class="space-y-3">
        ${
          leagueMatches.length === 0
            ? `<div class="glass-panel rounded-2xl p-8 sm:p-10 text-center border-2 border-dashed border-white/15 my-4">
                 <div class="text-4xl mb-2">🗓️</div>
                 <h3 class="font-display font-black text-lg text-white uppercase">Terminarz dla ${escapeHtml(state.leagues[leagueId].shortName)} czeka na wygenerowanie</h3>
                 ${
                   isAdmin
                     ? `<p class="text-xs text-slate-300 mt-1 max-w-lg mx-auto leading-relaxed">
                          W tej lidze nie ma jeszcze zaplanowanych meczów. Gdy dodasz zawodników do ligi, kliknij poniższy przycisk, a system sam stworzy kompletny terminarz (mecz i rewanż, po 4 kolejki na tydzień).
                        </p>
                        <div class="mt-4 flex flex-wrap justify-center gap-2.5">
                          <button onclick="SMPL_APP.adminRegenerateSchedule('${leagueId}', false)" class="btn-league px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                            🗓️ Wygeneruj Terminarz dla tej Ligi (1-Klik)
                          </button>
                          <button onclick="SMPL_APP.openAddPlayerModal('${leagueId}')" class="px-4 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-slate-200 hover:text-white font-display font-bold text-xs uppercase">
                            ➕ Dodaj Gracza
                          </button>
                          <button onclick="SMPL_APP.adminAddByeSlot('${leagueId}')" class="px-4 py-2.5 rounded-xl bg-slate-900 border border-emerald-400/35 text-emerald-300 hover:bg-emerald-500/20 font-display font-bold text-xs uppercase">
                            🤖 + WOLNY LOS
                          </button>
                        </div>`
                     : `<p class="text-xs text-slate-300 mt-1 max-w-lg mx-auto leading-relaxed">
                          Terminarz tej dywizji zostanie opublikowany wyłącznie przez Administrację SMPL po zakończeniu naboru i zatwierdzeniu składu ligi.
                        </p>`
                 }
               </div>`
            : filteredMatches.length === 0
            ? `<div class="glass-panel rounded-2xl p-8 text-center text-slate-400">
                 Brak meczów spełniających wybrane kryteria filtra.
               </div>`
            : filteredMatches
                .map((m) => {
                  const rawHome = playersMap[m.homeId] || { name: 'Gracz Gospodarz', nick: 'Home', avatar: '' };
                  const rawAway = playersMap[m.awayId] || { name: 'Gracz Gość', nick: 'Away', avatar: '' };
                  const isByeEntity = (pl) => Boolean(
                    pl && (pl.isBye || pl.isPlaceholder || pl.gdprDeleted || /^wolny\s*los|^wl\d+$/i.test(String(pl.name || '').trim()))
                  );
                  const home = Object.assign({}, rawHome, { isBye: isByeEntity(rawHome) });
                  const away = Object.assign({}, rawAway, { isBye: isByeEntity(rawAway) });
                  const isByeMatch = Boolean(home.isBye || away.isBye || m.isByeWalkover);
                  const legBadgeHtml = isByeMatch
                    ? `<span class="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 font-display font-bold text-[10px] uppercase">⚪ WOLNY LOS</span>`
                    : (Number(m.legNumber) === 2
                        ? `<span class="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/35 text-indigo-200 font-display font-bold text-[10px] uppercase">✈️ 2/2 Rewanż</span>`
                        : Number(m.legNumber) === 1
                        ? `<span class="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-400/35 text-blue-200 font-display font-bold text-[10px] uppercase">🏠 1/2 Mecz</span>`
                        : '');

                  const isOverdueForAdmin = m.status === 'SCHEDULED' && !isByeMatch &&
                    window.SMPL_DB && typeof window.SMPL_DB.isMatchUnplayedForAdminAction === 'function' &&
                    window.SMPL_DB.isMatchUnplayedForAdminAction(m, state);

                  let statusBadge = '';
                  if (m.status === 'APPROVED') {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">✅ Rozegrany</span>`;
                  } else if (m.status === 'PENDING') {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold animate-pulse">⏳ Oczekuje na akceptację Admina</span>`;
                  } else if (m.status === 'WALKOVER') {
                    statusBadge = isByeMatch
                      ? `<span class="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 text-[11px] font-bold">✅ Walkower WOLNY LOS</span>`
                      : `<span class="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-bold">⚠️ Walkower (WO)</span>`;
                  } else if (isOverdueForAdmin) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full bg-rose-500/25 text-rose-200 border border-rose-400/60 text-[11px] font-black animate-pulse">🚨 Po terminie — u Adminów</span>`;
                  } else {
                    statusBadge = `<span class="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-white/10 text-[11px] font-semibold">📅 Nierozegrany</span>`;
                  }

                  const hasScore = m.homeScore !== null && m.awayScore !== null;
                  const cleanSheetNotice =
                    (m.status === 'APPROVED' || m.status === 'WALKOVER') &&
                    !(m.status === 'WALKOVER' && Number(m.homeScore) === 0 && Number(m.awayScore) === 0) &&
                    (Number(m.homeScore) === 0 || Number(m.awayScore) === 0);

                  return `
                    <div class="smpl-match-broadcast-card rounded-2xl p-4 sm:px-6 ${m.status === 'PENDING' ? 'smpl-match-broadcast-pending' : ''}">
                      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10 text-xs">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/15 font-display font-black text-white">KOLEJKA ${m.round}</span>
                          ${legBadgeHtml}
                          ${statusBadge}
                          ${cleanSheetNotice ? `<span class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold">🧤 Czyste Konto</span>` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                          ${
                            m.screenshot
                              ? `<button onclick="SMPL_APP.openScreenshotModal('${m.id}')" class="px-3 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 font-semibold transition flex items-center gap-1">
                                   🖼️ Zobacz screen wyniku
                                 </button>`
                              : ''
                          }
                          ${
                            m.status === 'SCHEDULED' && (isAdmin || (isLoggedInPlayer && (m.homeId === session.activePlayerId || m.awayId === session.activePlayerId)))
                              ? `<button onclick="SMPL_APP.prefillMatchSubmission('${m.id}')" title="Otwórz dwumecz (Dom + Wyjazd) i wgraj SS" class="btn-league px-3 py-1 rounded-lg text-xs font-display uppercase">
                                   ➕ Wpisz wynik (+SS)
                                 </button>`
                              : ''
                          }
                          ${
                            m.status === 'SCHEDULED' && !home.isBye && !away.isBye && (isAdmin || (isLoggedInPlayer && (m.homeId === myEffectivePlayerId || m.awayId === myEffectivePlayerId)))
                              ? `<button type="button" onclick="SMPL_APP.openMessengerForPlayer('${myEffectivePlayerId && myEffectivePlayerId === m.homeId ? away.id : home.id}')" class="px-2.5 py-1 rounded-lg bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-400/40 text-xs font-bold transition flex items-center gap-1">💬 Napisz na Messengerze</button>
                                 <button type="button" onclick="SMPL_APP.openMatchProposalModal('${m.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 text-xs font-bold transition flex items-center gap-1">📅 Kiedy Gramy?</button>`
                              : ''
                          }
                          ${
                            !home.isBye && !away.isBye
                              ? `<button type="button" onclick="SMPL_APP.downloadMatchdayPosterPng('${m.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-400/30 text-[11px] font-bold transition" title="Pobierz grafikę zapowiedzi / wyniku PNG">📸 VS PNG</button>`
                              : ''
                          }
                          ${
                            !home.isBye && !away.isBye && (isAdmin || (isLoggedInPlayer && (m.homeId === session.activePlayerId || m.awayId === session.activePlayerId)))
                              ? `<button type="button" onclick="SMPL_APP.openMatchDisputeModal('${m.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 text-[11px] font-bold transition">🚩 Spór / VAR 48h</button>`
                              : ''
                          }
                          ${
                            isAdmin && isOverdueForAdmin
                              ? `<button type="button" onclick="SMPL_APP.switchTab('admin'); SMPL_APP.setAdminSubTab('moderation');" class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-display font-black uppercase shadow">
                                   ⚖️ Podejmij działanie
                                 </button>`
                              : ''
                          }
                          ${
                            isAdmin
                              ? `<button onclick="SMPL_APP.openAdminEditMatchModal('${m.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 text-[11px] font-semibold">
                                   ✏️ Edytuj / WO
                                 </button>`
                              : ''
                          }
                        </div>
                      </div>

                      <!-- Gospodarz vs Gość -->
                      <div class="grid grid-cols-1 sm:grid-cols-11 items-center gap-3">
                        <!-- Gospodarz -->
                        <div class="sm:col-span-4 flex items-center sm:justify-end gap-3">
                          <div class="sm:text-right min-w-0 flex-1">
                            <div class="font-display font-bold text-white text-sm sm:text-base truncate">${escapeHtml(home.name)}</div>
                            <div class="text-xs text-slate-400 flex items-center sm:justify-end gap-1.5 flex-wrap">
                              <span>@${escapeHtml(home.nick)} • Gospodarz</span>
                              ${renderClanBadgeHtml(home, state, true)}
                            </div>
                          </div>
                          <img src="${home.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-blue-400/40 shadow-md flex-shrink-0" alt=""/>
                        </div>

                        <!-- Wynik w centrum -->
                        <div class="sm:col-span-3 flex flex-col items-center justify-center py-1">
                          ${
                            hasScore
                              ? `<div class="smpl-score-scoreboard ${m.status === 'PENDING' ? 'border-amber-400/60' : ''}">
                                   <span class="font-display font-black text-xl sm:text-2xl font-mono-num ${Number(m.homeScore) > Number(m.awayScore) ? 'text-emerald-400' : 'text-white'}">${m.homeScore}</span>
                                   <span class="text-slate-500 font-display font-bold">:</span>
                                   <span class="font-display font-black text-xl sm:text-2xl font-mono-num ${Number(m.awayScore) > Number(m.homeScore) ? 'text-emerald-400' : 'text-white'}">${m.awayScore}</span>
                                 </div>`
                              : `<div class="smpl-vs-hexagon">
                                   VS
                                 </div>`
                          }
                          ${m.status === 'WALKOVER' ? `<span class="text-[10px] text-rose-400 font-bold mt-1">WALKOWER</span>` : ''}
                        </div>

                        <!-- Gość -->
                        <div class="sm:col-span-4 flex items-center gap-3">
                          <img src="${away.avatar}" class="w-11 h-11 rounded-full object-cover border-2 border-emerald-400/40 shadow-md flex-shrink-0" alt=""/>
                          <div class="min-w-0 flex-1">
                            <div class="font-display font-bold text-white text-sm sm:text-base truncate">${escapeHtml(away.name)}</div>
                            <div class="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                              <span>@${escapeHtml(away.nick)} • Gość</span>
                              ${renderClanBadgeHtml(away, state, true)}
                            </div>
                          </div>
                        </div>
                      </div>

                      ${
                        m.comment || m.rejectionReason
                          ? `<div class="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                               ${m.comment ? `<span>💬 ${escapeHtml(m.comment)}</span>` : ''}
                               ${m.rejectionReason ? `<span class="text-rose-400 font-semibold">⚠️ Odrzucono wcześniej: ${escapeHtml(m.rejectionReason)}</span>` : ''}
                               ${m.submittedAt ? `<span class="text-[11px] text-slate-500">Zgłoszono: ${escapeHtml(m.submittedAt)} (${escapeHtml(m.submittedBy || '')})</span>` : ''}
                             </div>`
                          : ''
                      }
                      ${(() => {
                        const matchProps = allProposals.filter((pr) => pr && pr.matchId === m.id);
                        const latestProp = matchProps[0] || null;
                        const matchDisps = allDisputes.filter((ds) => ds && ds.matchId === m.id);
                        const latestDisp = matchDisps[0] || null;
                        const poll = allFanPolls[m.id] || { homeVotes: [], drawVotes: [], awayVotes: [] };
                        const hV = Array.isArray(poll.homeVotes) ? poll.homeVotes.length : 0;
                        const dV = Array.isArray(poll.drawVotes) ? poll.drawVotes.length : 0;
                        const aV = Array.isArray(poll.awayVotes) ? poll.awayVotes.length : 0;
                        const totV = hV + dV + aV;
                        const hPct = totV > 0 ? Math.round((hV / totV) * 100) : 0;
                        const dPct = totV > 0 ? Math.round((dV / totV) * 100) : 0;
                        const aPct = totV > 0 ? Math.max(0, 100 - hPct - dPct) : 0;
                        const canAcceptProp = latestProp && latestProp.status === 'PROPOSED' && (isAdmin || (isLoggedInPlayer && latestProp.targetPlayerId === session.activePlayerId));
                        let extraHtml = '';
                        if (latestProp) {
                          extraHtml += `
                            <div class="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="px-2 py-0.5 rounded bg-slate-900 border border-white/15 font-bold ${latestProp.status === 'ACCEPTED' ? 'text-emerald-300' : latestProp.status === 'DECLINED' ? 'text-rose-300' : 'text-amber-300'}">
                                  📅 Termin („Kiedy Gramy?”): ${latestProp.status === 'ACCEPTED' ? '✅ ' + escapeHtml(latestProp.chosenSlot || '') : escapeHtml((latestProp.proposedSlots || []).join(' / '))}
                                </span>
                                <span class="text-[11px] text-slate-400">od ${escapeHtml(latestProp.proposerName || '')}</span>
                              </div>
                              ${
                                canAcceptProp
                                  ? `<div class="flex flex-wrap items-center gap-1.5">
                                       ${(latestProp.proposedSlots || []).slice(0, 3).map((sl) => `
                                         <button type="button" onclick="SMPL_APP.respondToMatchProposal('${escapeHtml(latestProp.id)}', 'ACCEPT', '${escapeHtml(sl).replace(/'/g, "\\'")}')" class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 text-[11px] font-bold">
                                           ✓ Akceptuj: ${escapeHtml(sl)}
                                         </button>
                                       `).join('')}
                                       <button type="button" onclick="SMPL_APP.openMatchProposalModal('${m.id}')" class="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-white/15 text-[11px]">🔄 Inny termin</button>
                                     </div>`
                                  : ''
                              }
                            </div>
                          `;
                        }
                        if (latestDisp) {
                          extraHtml += `
                            <div class="mt-2 pt-2 border-t border-rose-500/20 text-[11px] flex flex-wrap items-center justify-between gap-2 text-rose-200">
                              <span>🚩 Zgłoszenie VAR (${escapeHtml(latestDisp.reasonType || '')}): ${escapeHtml(latestDisp.description || '')}</span>
                              <div class="flex items-center gap-1.5 flex-wrap">
                                ${
                                  latestDisp.screenshot
                                    ? `<button type="button" onclick="SMPL_APP.openDisputeScreenshotModal('${escapeHtml(latestDisp.id)}')" class="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 border border-sky-400/40 font-bold transition">📸 Zobacz SS dlaczego</button>`
                                    : ''
                                }
                                <span class="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 font-bold">${escapeHtml(latestDisp.status || 'PENDING')}${latestDisp.decision ? ' • ' + escapeHtml(latestDisp.decision) : ''}</span>
                              </div>
                            </div>
                          `;
                        }
                        if (m.status === 'SCHEDULED' && !home.isBye && !away.isBye) {
                          extraHtml += `
                            <div class="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <span class="text-slate-400 font-semibold">🗳️ Głos Kibiców (1X2): <strong class="text-white">${totV}</strong> głosów</span>
                              <div class="flex flex-wrap items-center gap-1.5">
                                <button type="button" onclick="SMPL_APP.voteMatchFanPoll('${m.id}', 'HOME')" class="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/35 text-blue-200 border border-blue-400/40 font-bold">1 (${hPct}%)</button>
                                <button type="button" onclick="SMPL_APP.voteMatchFanPoll('${m.id}', 'DRAW')" class="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/40 font-bold">X (${dPct}%)</button>
                                <button type="button" onclick="SMPL_APP.voteMatchFanPoll('${m.id}', 'AWAY')" class="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 font-bold">2 (${aPct}%)</button>
                              </div>
                            </div>
                          `;
                        }
                        return extraHtml;
                      })()}
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    `;
  }

  // =========================================================================
  // 4. PORÓWNYWARKA H2H (HEAD-TO-HEAD)
  // =========================================================================
  function renderH2HView(state, leagueId, h2hState) {
    const h2hBannerHtml = `
      <div class="h2h-showcase-banner rounded-3xl p-5 sm:p-7 mb-6">
        <div class="text-center max-w-2xl mx-auto">
          <span class="px-3 py-1 rounded-full bg-white/10 text-amber-300 border border-amber-400/40 text-xs font-display font-bold uppercase tracking-widest">
            ⚔️ CENTRUM ANALIZ HEAD-TO-HEAD (H2H)
          </span>
          <h2 class="font-display font-black text-xl sm:text-3xl text-white mt-2.5 uppercase">
            Porównywarka Graczy &amp; Bilans Bezpośredni
          </h2>
          <p class="text-xs sm:text-sm text-slate-300 mt-1.5">
            Wybierz dwóch dowolnych zawodników SMPL, aby porównać ich formę, średnią goli, czyste konta oraz historię bezpośrednich spotkań.
          </p>
        </div>
      </div>
    `;
    const leaguePlayers = state.players.filter((p) => p.leagueId === leagueId && p.active !== false);
    const candidatePool = leaguePlayers.length >= 2 ? leaguePlayers : (state.players || []).filter((p) => p.active !== false);
    if (candidatePool.length < 2) {
      return `${h2hBannerHtml}<div class="glass-panel rounded-2xl p-8 text-center text-slate-400">Dodaj co najmniej 2 aktywnych graczy w lidze, aby włączyć porównywarkę H2H.</div>`;
    }
    const pAId =
      h2hState.playerAId && state.players.some((p) => p.id === h2hState.playerAId)
        ? h2hState.playerAId
        : candidatePool[0].id;
    const pBId =
      h2hState.playerBId && state.players.some((p) => p.id === h2hState.playerBId && p.id !== pAId)
        ? h2hState.playerBId
        : (candidatePool.find((p) => p.id !== pAId) || candidatePool[0]).id;

    const data = window.SMPL_ENGINE.calculateH2H(state, pAId, pBId);
    if (!data) {
      return `${h2hBannerHtml}<div class="glass-panel rounded-2xl p-8 text-center text-slate-400">Brak wystarczającej liczby graczy do porównania H2H.</div>`;
    }

    const { playerA, playerB, statsA, statsB, direct } = data;
    const avatarA =
      (statsA && statsA.avatar) ||
      playerA.avatar ||
      (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
        ? window.SMPL_MEDIA.generatePlayerAvatar(playerA.name, playerA.nick, 0)
        : '');
    const avatarB =
      (statsB && statsB.avatar) ||
      playerB.avatar ||
      (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
        ? window.SMPL_MEDIA.generatePlayerAvatar(playerB.name, playerB.nick, 1)
        : '');

    function renderComparisonBar(label, valA, valB, higherIsBetter = true, suffix = '') {
      const numA = parseFloat(valA) || 0;
      const numB = parseFloat(valB) || 0;
      const total = numA + numB;
      const pctA = total > 0 ? Math.round((numA / total) * 100) : 50;
      const pctB = 100 - pctA;
      const aWins = higherIsBetter ? numA > numB : numA < numB;
      const bWins = higherIsBetter ? numB > numA : numB < numA;

      return `
        <div class="py-2.5">
          <div class="flex items-center justify-between text-xs sm:text-sm mb-1.5 font-mono-num">
            <span class="font-display font-bold ${aWins ? 'text-emerald-400' : 'text-white'}">${valA}${suffix}</span>
            <span class="text-xs font-sans uppercase tracking-wider text-slate-400 font-semibold">${label}</span>
            <span class="font-display font-bold ${bWins ? 'text-emerald-400' : 'text-white'}">${valB}${suffix}</span>
          </div>
          <div class="flex items-center gap-1.5 h-2.5 rounded-full overflow-hidden bg-slate-900 p-0.5 border border-white/5">
            <div class="h-full rounded-l-full transition-all ${aWins ? 'bg-emerald-500' : 'bg-blue-500'}" style="width: ${pctA}%"></div>
            <div class="h-full rounded-r-full transition-all ${bWins ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${pctB}%"></div>
          </div>
        </div>
      `;
    }

    const optionsHtml = (selectedId) =>
      state.players
        .map(
          (p) =>
            `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>[${p.leagueId}] ${escapeHtml(p.name)} (@${escapeHtml(p.nick)})</option>`
        )
        .join('');

    return `
      ${h2hBannerHtml}

      <div class="smpl-h2h-arena rounded-3xl p-5 sm:p-6 mb-6">

        <!-- Selektory 2 Graczy -->
        <div class="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
          <!-- Karta Gracza A -->
          <div class="md:col-span-5 smpl-h2h-side-a rounded-2xl p-4">
            <label class="block text-[11px] font-display uppercase text-blue-400 mb-2 font-bold">Zawodnik #1</label>
            <select onchange="SMPL_APP.setH2HPlayer('A', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold mb-4 focus:outline-none focus:border-blue-400">
              ${optionsHtml(pAId)}
            </select>
            <div class="flex items-center gap-4">
              <img src="${avatarA}" class="w-16 h-16 rounded-full object-cover border-2 border-blue-400 shadow-lg" alt=""/>
              <div>
                <div class="font-display font-black text-lg text-white">${escapeHtml(playerA.name)}</div>
                <div class="text-xs text-blue-300 font-semibold">@${escapeHtml(playerA.nick)} • Pozycja #${statsA.position || '-'} (${playerA.leagueId})</div>
                <div class="mt-2">${renderFormBadges(statsA.form)}</div>
              </div>
            </div>
          </div>

          <!-- VS Badge -->
          <div class="md:col-span-1 flex flex-col items-center justify-center">
            <div class="btn-league smpl-vs-burst flex items-center justify-center font-display font-black text-base">
              VS
            </div>
          </div>

          <!-- Karta Gracza B -->
          <div class="md:col-span-5 smpl-h2h-side-b rounded-2xl p-4">
            <label class="block text-[11px] font-display uppercase text-rose-400 mb-2 font-bold">Zawodnik #2</label>
            <select onchange="SMPL_APP.setH2HPlayer('B', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white font-semibold mb-4 focus:outline-none focus:border-rose-400">
              ${optionsHtml(pBId)}
            </select>
            <div class="flex items-center gap-4">
              <img src="${avatarB}" class="w-16 h-16 rounded-full object-cover border-2 border-rose-400 shadow-lg" alt=""/>
              <div>
                <div class="font-display font-black text-lg text-white">${escapeHtml(playerB.name)}</div>
                <div class="text-xs text-rose-300 font-semibold">@${escapeHtml(playerB.nick)} • Pozycja #${statsB.position || '-'} (${playerB.leagueId})</div>
                <div class="mt-2">${renderFormBadges(statsB.form)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bilans bezpośredni + Porównanie statystyk -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Kolumna lewa: Paski porównawcze statystyk sezonowych -->
        <div class="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
          <h3 class="font-display font-bold text-base uppercase tracking-wider text-white mb-4 pb-3 border-b border-white/10">
            📊 Porównanie Statystyk w Tabeli (Sezon ${state.season || 56})
          </h3>
          <div class="divide-y divide-white/5">
            ${renderComparisonBar('Punkty w Tabeli (PKT)', statsA.PKT || 0, statsB.PKT || 0, true, ' pkt')}
            ${renderComparisonBar('Procent Zwycięstw', statsA.winRate || 0, statsB.winRate || 0, true, '%')}
            ${renderComparisonBar('Bramki Zdobyte (BZ)', statsA.BZ || 0, statsB.BZ || 0, true)}
            ${renderComparisonBar('Średnia Goli Zdobytych / Mecz', statsA.goalsForAvg || 0, statsB.goalsForAvg || 0, true)}
            ${renderComparisonBar('Średnia Goli Straconych / Mecz', statsA.goalsAgainstAvg || 0, statsB.goalsAgainstAvg || 0, false)}
            ${renderComparisonBar('Czyste Konta (Żelazna Kurtyna)', statsA.cleanSheets || 0, statsB.cleanSheets || 0, true, ' 🧤')}
          </div>
        </div>

        <!-- Kolumna prawa: Bezpośredni Bilans H2H i Historia Spotkań -->
        <div class="lg:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10 flex flex-col justify-between">
          <div>
            <h3 class="font-display font-bold text-base uppercase tracking-wider text-white mb-4 pb-3 border-b border-white/10">
              ⚔️ Bezpośrednie Spotkania (H2H)
            </h3>

            <div class="grid grid-cols-3 gap-3 text-center mb-5">
              <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div class="font-display font-black text-2xl text-blue-400">${direct.winsA}</div>
                <div class="text-[11px] text-slate-300 mt-1 truncate">Wygrane ${escapeHtml(playerA.name.split(' ')[0])}</div>
              </div>
              <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <div class="font-display font-black text-2xl text-amber-400">${direct.draws}</div>
                <div class="text-[11px] text-slate-300 mt-1">Remisy</div>
              </div>
              <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <div class="font-display font-black text-2xl text-rose-400">${direct.winsB}</div>
                <div class="text-[11px] text-slate-300 mt-1 truncate">Wygrane ${escapeHtml(playerB.name.split(' ')[0])}</div>
              </div>
            </div>

            <div class="text-center py-2 px-3 rounded-xl bg-slate-900/90 border border-white/10 text-xs text-slate-300 mb-4">
              Bilans bramek w meczach bezpośrednich: <strong class="text-white font-display ml-1">${direct.goalsA} : ${direct.goalsB}</strong>
            </div>

            <div class="space-y-2.5">
              ${
                direct.matches.length === 0
                  ? `<div class="text-xs text-slate-400 text-center py-6">Brak zaplanowanych meczów bezpośrednich pomiędzy tymi graczami.</div>`
                  : direct.matches
                      .map((m) => {
                        const isAHome = m.homeId === playerA.id;
                        const homeName = isAHome ? playerA.name : playerB.name;
                        const awayName = isAHome ? playerB.name : playerA.name;
                        const hasScore = m.homeScore !== null && m.awayScore !== null;
                        return `
                          <div class="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between gap-2 text-xs">
                            <div>
                              <span class="font-display font-bold text-league-primary">Kolejka ${m.round}</span>
                              <div class="text-slate-200 font-semibold mt-0.5">${escapeHtml(homeName)} vs ${escapeHtml(awayName)}</div>
                            </div>
                            <div class="flex items-center gap-2">
                              ${
                                hasScore
                                  ? `<span class="px-2.5 py-1 rounded-lg bg-white/10 font-display font-black text-white text-sm">${m.homeScore} : ${m.awayScore}</span>`
                                  : `<span class="px-2 py-1 rounded bg-slate-800 text-slate-400">Nierozegrany</span>`
                              }
                              ${
                                m.screenshot
                                  ? `<button onclick="SMPL_APP.openScreenshotModal('${m.id}')" class="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30" title="Zobacz screen">🖼️</button>`
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
      </div>

      ${(() => {
        if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.computeHistoricalH2H !== 'function') return '';
        const histH2H = window.SMPL_STUDIO.computeHistoricalH2H(
          playerA.name,
          playerB.name,
          playerA.historicalArchiveName,
          playerB.historicalArchiveName
        );
        if (!histH2H || !histH2H.sharedSeasons || !histH2H.sharedSeasons.length) return '';
        return `
          <div class="glass-panel rounded-2xl p-5 sm:p-6 mt-6 border border-amber-400/35">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
              <div>
                <h3 class="font-display font-black text-base uppercase text-amber-300">
                  🏛️ Historyczny Bilans Kariery S1–S55 (Wspólne Sezony: ${histH2H.sharedSeasons.length})
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">
                  Porównanie miejsc w tych samych sezonach archiwalnych S1–S55 (w tym bezpośrednie starcia w jednej lidze).
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs font-display font-bold">
                <span class="px-3 py-1 rounded-xl bg-blue-500/20 text-blue-200 border border-blue-400/40">${escapeHtml(playerA.name)}: ${histH2H.higherA}x wyżej</span>
                <span class="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">${escapeHtml(playerB.name)}: ${histH2H.higherB}x wyżej</span>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[620px] text-xs font-mono-num">
                <thead>
                  <tr class="border-b border-white/10 bg-slate-950/70 font-display uppercase text-slate-400 text-[11px]">
                    <th class="py-2.5 px-3">Sezon</th>
                    <th class="py-2.5 px-3">${escapeHtml(playerA.name)}</th>
                    <th class="py-2.5 px-3">${escapeHtml(playerB.name)}</th>
                    <th class="py-2.5 px-3 text-center">Ta sama liga?</th>
                    <th class="py-2.5 px-3 text-center">Lepszy w sezonie</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  ${histH2H.sharedSeasons.slice(0, 12).map((sh) => `
                    <tr class="hover:bg-white/5">
                      <td class="py-2 px-3 font-display font-black text-amber-300">S${sh.season}</td>
                      <td class="py-2 px-3 text-slate-200">${escapeHtml(sh.a.leagueId)} #${sh.a.pos} (${sh.a.PKT} pkt)</td>
                      <td class="py-2 px-3 text-slate-200">${escapeHtml(sh.b.leagueId)} #${sh.b.pos} (${sh.b.PKT} pkt)</td>
                      <td class="py-2 px-3 text-center">${sh.sameLeague ? '<span class="text-emerald-300 font-bold">TAK</span>' : '<span class="text-slate-500">Inne ligi</span>'}</td>
                      <td class="py-2 px-3 text-center font-bold ${sh.winner === 'A' ? 'text-blue-300' : sh.winner === 'B' ? 'text-emerald-300' : 'text-amber-300'}">
                        ${sh.winner === 'A' ? escapeHtml(playerA.name) : sh.winner === 'B' ? escapeHtml(playerB.name) : 'Remis'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      })()}
    `;
  }

  // =========================================================================
  // 5. KARTA ZAWODNIKA ULTIMATE TEAM (OVR 75–99) + WYSZUKIWARKA KART ARCHIWUM S1–S55
  // =========================================================================
  function filterAndSortUtCatalog(catalog, explorerState) {
    const exp = explorerState || {};
    const rawQ = String(exp.query || '').trim();
    const foldedQ = window.SMPL_ENGINE && typeof window.SMPL_ENGINE.foldArchiveSearchText === 'function'
      ? window.SMPL_ENGINE.foldArchiveSearchText(rawQ)
      : foldArchivePl(rawQ);
    const tokens = foldedQ ? foldedQ.split(' ').filter(Boolean) : [];
    const filterKey = exp.filter || 'ALL';
    const sortKey = exp.sort || 'OVR';

    const filtered = (catalog || []).filter((item) => {
      if (filterKey === 'ICONS' && item.cardTier !== 'ICON_LEGEND') return false;
      if (filterKey === 'MEDALISTS' && Number(item.medals || 0) <= 0) return false;
      if (filterKey === 'L1' && Number(item.l1Seasons || 0) <= 0 && item.activeLeagueId !== 'L1') return false;
      if (filterKey === 'ACTIVE_ACCOUNT' && !item.hasActiveAccount) return false;
      if (filterKey === 'ARCHIVE_ONLY' && !item.isArchiveOnly) return false;
      if (tokens.length > 0) {
        for (let i = 0; i < tokens.length; i++) {
          if (item.foldedSearch.indexOf(tokens[i]) === -1) return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortKey === 'TOTAL_PTS') {
        if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
        return b.ovr - a.ovr;
      }
      if (sortKey === 'GOLD') {
        if (b.gold !== a.gold) return b.gold - a.gold;
        if (b.medals !== a.medals) return b.medals - a.medals;
        return b.totalPts - a.totalPts;
      }
      if (sortKey === 'SEASONS') {
        if (b.seasons !== a.seasons) return b.seasons - a.seasons;
        return b.matches - a.matches;
      }
      if (sortKey === 'MATCHES') {
        if (b.matches !== a.matches) return b.matches - a.matches;
        return b.totalPts - a.totalPts;
      }
      if (sortKey === 'NAME') {
        return a.name.localeCompare(b.name, 'pl');
      }
      if (b.ovr !== a.ovr) return b.ovr - a.ovr;
      if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
      return b.matches - a.matches;
    });

    return filtered;
  }

  function renderUtCardsExplorerResultsHtml(state, explorerState, selectedPlayerId) {
    const catalog = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.getUnifiedUtPlayersCatalog === 'function')
      ? window.SMPL_ENGINE.getUnifiedUtPlayersCatalog(state)
      : [];
    const exp = explorerState || {};
    const hasQuery = Boolean(String(exp.query || '').trim());
    const gridExpanded = exp.gridExpanded !== false || hasQuery;
    const limit = Math.max(8, Number(exp.limit || 12));
    const filtered = filterAndSortUtCatalog(catalog, exp);
    const visibleItems = gridExpanded ? filtered.slice(0, limit) : [];

    if (!gridExpanded) {
      return `
        <div class="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span>📚 Katalog wszystkich <strong>${catalog.length}</strong> kart UT z historii S1–S${state.season || 56} jest zwinięty (wpisz imię wyżej lub rozwiń siatkę kart).</span>
          <button type="button" onclick="SMPL_APP.toggleUtExplorerGrid(true)" class="px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/45 text-amber-200 font-display font-bold uppercase text-[11px]">
            🎴 Rozwiń siatkę kart (${filtered.length})
          </button>
        </div>
      `;
    }

    if (filtered.length === 0) {
      return `
        <div class="mt-4 p-6 rounded-2xl bg-slate-950/90 border border-white/10 text-center space-y-2">
          <div class="text-2xl">🔎</div>
          <div class="font-display font-bold text-sm text-white uppercase">Nie znaleziono zawodnika dla podanego zapytania</div>
          <p class="text-xs text-slate-400">Sprawdź pisownię imienia lub nazwiska albo wyczyść aktywne filtry wyszukiwarki.</p>
          <button type="button" onclick="SMPL_APP.resetUtExplorerFilters()" class="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-display font-black text-xs uppercase">
            Wyczyść wyszukiwanie i pokaż wszystkich (${catalog.length})
          </button>
        </div>
      `;
    }

    const cardsHtml = visibleItems.map((c, idx) => {
      const safeId = escapeHtml(c.id).replace(/'/g, "\\'");
      const isSelected = String(c.id) === String(selectedPlayerId || '');
      const tierCls = c.cardTier === 'ICON_LEGEND' ? 'tier-icon' : (c.cardTier === 'TOTW_STAR' ? 'tier-totw' : '');
      const tierShort = c.cardTier === 'ICON_LEGEND' ? '👑 IKONA' : (c.cardTier === 'TOTW_STAR' ? '⚡ TOTW' : '🏅 PRO');
      const tierBadgeCls = c.cardTier === 'ICON_LEGEND'
        ? 'bg-amber-400 text-slate-950'
        : (c.cardTier === 'TOTW_STAR' ? 'bg-sky-400 text-slate-950' : 'bg-emerald-400/25 text-emerald-200 border border-emerald-400/40');
      const accountPill = c.hasActiveAccount
        ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-emerald-300 text-[10px] font-bold">🟢 Konto S${state.season || 56}${c.inPool ? ' (Pula)' : ' • ' + escapeHtml(c.activeLeagueId)}</span>`
        : `<span class="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[10px] font-bold">🏛️ Archiwum • Bez konta</span>`;
      const at = c.attrs || { ATA: 75, DEF: 75, FOR: 75, SKT: 75, DOS: 75, MEN: 75 };

      return `
        <button type="button" onclick="SMPL_APP.selectUtExplorerPlayer('${safeId}')" class="smpl-ut-mini-card ${tierCls} ${isSelected ? 'is-selected' : ''} ${idx >= 8 ? 'is-deferred' : ''}">
          <div class="w-full space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="smpl-ut-mini-ovr">
                  <span class="font-display font-black text-lg text-amber-300 leading-none">${c.ovr}</span>
                  <span class="text-[9px] font-display font-bold text-slate-300 uppercase mt-0.5">OVR</span>
                </div>
                <img src="${c.avatar}" alt="" width="40" height="40" loading="lazy" class="w-10 h-10 rounded-full object-cover border-2 border-amber-400/70 flex-shrink-0" />
                <div class="min-w-0">
                  <div class="font-display font-black text-sm text-white truncate leading-tight">${escapeHtml(c.name)}</div>
                  <div class="text-[11px] text-slate-300 truncate">${escapeHtml(c.eraSpanLabel)} • ${c.seasons} sez.</div>
                </div>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-display font-black uppercase flex-shrink-0 ${tierBadgeCls}">${tierShort}</span>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-1.5">
              ${accountPill}
              <span class="text-[10px] font-bold text-amber-300 truncate">Najwyżej: ${escapeHtml(c.bestPos)}</span>
            </div>

            <div class="smpl-ut-mini-attrs font-mono-num">
              <div><div class="text-slate-400">ATA</div><div class="font-bold text-amber-300">${at.ATA}</div></div>
              <div><div class="text-slate-400">DEF</div><div class="font-bold text-emerald-300">${at.DEF}</div></div>
              <div><div class="text-slate-400">FOR</div><div class="font-bold text-sky-300">${at.FOR}</div></div>
              <div><div class="text-slate-400">SKT</div><div class="font-bold text-amber-200">${at.SKT}</div></div>
              <div><div class="text-slate-400">DOS</div><div class="font-bold text-purple-300">${at.DOS}</div></div>
              <div><div class="text-slate-400">MEN</div><div class="font-bold text-emerald-200">${at.MEN}</div></div>
            </div>
          </div>

          <div class="w-full pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] font-mono-num">
            <span class="text-slate-300"><strong>${c.matches}</strong>M • ⚽ ${c.gf} • <span class="text-emerald-300">${c.winPct}%</span></span>
            <span class="font-bold text-white">👑${c.gold} 🥈${c.silver} 🥉${c.bronze}</span>
          </div>
        </button>
      `;
    }).join('');

    const remaining = filtered.length - visibleItems.length;
    return `
      <div class="smpl-ut-mini-grid">
        ${cardsHtml}
      </div>
      <div class="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span class="text-slate-400">Wyświetlono <strong class="text-white">${visibleItems.length}</strong> z <strong class="text-amber-300">${filtered.length}</strong> pasujących kart UT. Kliknij kartę, aby otworzyć pełny profil 3D i przebieg kariery S1–S55!</span>
        <div class="flex flex-wrap items-center gap-2">
          ${remaining > 0
            ? `<button type="button" onclick="SMPL_APP.loadMoreUtExplorerCards(24)" class="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-xs uppercase shadow">
                 ➕ Pokaż więcej kart (+${Math.min(24, remaining)})
               </button>
               ${remaining > 24
                 ? `<button type="button" onclick="SMPL_APP.loadMoreUtExplorerCards(${remaining})" class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-200 font-display font-bold text-xs uppercase">
                      Wszystkie (${filtered.length})
                    </button>`
                 : ''}`
            : ''}
          <button type="button" onclick="SMPL_APP.toggleUtExplorerGrid(false)" class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-300 font-display font-bold text-xs uppercase">
            ▲ Zwiń siatkę
          </button>
        </div>
      </div>
    `;
  }

  function renderUtCardsExplorerSectionHtml(state, explorerState, selectedPlayerId, inArchiveTab) {
    const catalog = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.getUnifiedUtPlayersCatalog === 'function')
      ? window.SMPL_ENGINE.getUnifiedUtPlayersCatalog(state)
      : [];
    const exp = Object.assign(
      { query: '', filter: 'ALL', sort: 'OVR', limit: inArchiveTab ? 24 : 8, gridExpanded: true },
      explorerState || {}
    );
    if (inArchiveTab) exp.gridExpanded = true;

    const counts = {
      ALL: catalog.length,
      ICONS: catalog.filter((c) => c.cardTier === 'ICON_LEGEND').length,
      MEDALISTS: catalog.filter((c) => c.medals > 0).length,
      L1: catalog.filter((c) => c.l1Seasons > 0 || c.activeLeagueId === 'L1').length,
      ACTIVE_ACCOUNT: catalog.filter((c) => c.hasActiveAccount).length,
      ARCHIVE_ONLY: catalog.filter((c) => c.isArchiveOnly).length
    };
    const filteredCount = filterAndSortUtCatalog(catalog, exp).length;

    const filters = [
      { id: 'ALL', label: `🌐 Wszyscy (${counts.ALL})` },
      { id: 'ICONS', label: `👑 Ikony & Legendy (${counts.ICONS})` },
      { id: 'MEDALISTS', label: `🏆 Medaliści (${counts.MEDALISTS})` },
      { id: 'L1', label: `⚡ Ekstraklasa L1 (${counts.L1})` },
      { id: 'ARCHIVE_ONLY', label: `🏛️ Archiwum / Bez konta (${counts.ARCHIVE_ONLY})` },
      { id: 'ACTIVE_ACCOUNT', label: `🟢 Konta S${state.season || 56} (${counts.ACTIVE_ACCOUNT})` }
    ];

    return `
      <section class="smpl-ut-explorer-shell" aria-labelledby="smpl-ut-explorer-heading">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div class="inline-flex flex-wrap items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/45 text-amber-200 text-[11px] font-display font-black uppercase tracking-wider">
              <span>🎴 BAZA WSZYSTKICH KART UT S1–S${state.season || 56}</span>
              <span>•</span>
              <span class="text-emerald-300">${catalog.length} ZAWODNIKÓW (Z KONTEM I BEZ KONTA!)</span>
            </div>
            <h2 id="smpl-ut-explorer-heading" class="font-display font-black text-xl sm:text-2xl text-white uppercase mt-2">
              🔍 Wyszukiwarka Kart Ultimate Team i Karier z Archiwum
            </h2>
            <p class="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Wyszukaj <strong>dowolnego zawodnika z całej historii Score Match Liga (Sezony 1–55)</strong> — nawet jeśli nie gra obecnie i nie posiada założonego konta! Zobaczysz jego dokładną Kartę UT 3D, OVR, medale, przebieg kariery w dywizjach L1–L9 oraz wszystkie historyczne tabele.
            </p>
          </div>
          <div id="smpl-ut-explorer-status" role="status" aria-live="polite" class="px-3.5 py-2 rounded-xl bg-slate-950/90 border border-emerald-400/40 text-xs font-bold text-emerald-300 self-start lg:self-center whitespace-nowrap">
            🎯 Wyniki: ${filteredCount} / ${catalog.length} graczy
          </div>
        </div>

        <search aria-label="Wyszukiwarka kart Ultimate Team i historii kariery graczy">
          <form id="smpl-ut-explorer-form" action="#profile" method="GET" onsubmit="return SMPL_APP.handleUtExplorerSubmit(event)" class="smpl-ut-search-form">
            <div class="smpl-ut-field-group">
              <label for="smpl-ut-explorer-q" class="smpl-ut-field-label">Imię, nazwisko, nick lub sezon (np. Michał Wu, Chmielowski, Paziak, S42):</label>
              <input
                type="search"
                id="smpl-ut-explorer-q"
                name="q"
                value="${escapeHtml(exp.query || '')}"
                placeholder="Wpisz imię lub nazwisko dowolnego gracza z historii..."
                autocomplete="off"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                enterkeyhint="search"
                oninput="SMPL_APP.handleUtExplorerInput(this.value)"
                onkeydown="SMPL_APP.handleUtExplorerKeydown(event)"
                class="smpl-ut-search-input"
              />
            </div>

            <div class="smpl-ut-field-group">
              <label for="smpl-ut-explorer-sort" class="smpl-ut-field-label">Sortuj karty według:</label>
              <select id="smpl-ut-explorer-sort" name="sort" onchange="SMPL_APP.setUtExplorerSort(this.value)" class="smpl-ut-sort-select">
                <option value="OVR" ${exp.sort === 'OVR' ? 'selected' : ''}>⭐ Ocena OVR (Najwyższa)</option>
                <option value="TOTAL_PTS" ${exp.sort === 'TOTAL_PTS' ? 'selected' : ''}>🏆 Punkty Kariery (Total)</option>
                <option value="GOLD" ${exp.sort === 'GOLD' ? 'selected' : ''}>👑 Złote Medale &amp; Podium</option>
                <option value="SEASONS" ${exp.sort === 'SEASONS' ? 'selected' : ''}>📚 Liczba Sezonów (S1–S55)</option>
                <option value="MATCHES" ${exp.sort === 'MATCHES' ? 'selected' : ''}>⚽ Rozegrane Mecze</option>
                <option value="NAME" ${exp.sort === 'NAME' ? 'selected' : ''}>🔤 Alfabetycznie (A–Z)</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <button type="submit" class="btn-league px-4 py-3 rounded-xl font-display font-black text-xs uppercase whitespace-nowrap min-h-[48px]">
                🎴 Otwórz #1
              </button>
              ${exp.query || exp.filter !== 'ALL'
                ? `<button type="button" onclick="SMPL_APP.resetUtExplorerFilters()" class="px-3.5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-slate-200 font-display font-bold text-xs uppercase min-h-[48px]">
                     ✕ Reset
                   </button>`
                : ''}
            </div>
          </form>

          <div class="smpl-ut-filter-bar" role="group" aria-label="Filtry kategorii zawodników">
            ${filters.map((f) => `
              <button type="button" aria-pressed="${exp.filter === f.id ? 'true' : 'false'}" onclick="SMPL_APP.setUtExplorerFilter('${f.id}')" class="smpl-ut-filter-pill ${exp.filter === f.id ? 'is-active' : ''}">
                <span>${f.label}</span>
              </button>
            `).join('')}
          </div>
        </search>

        <div id="smpl-ut-explorer-results-mount">
          ${renderUtCardsExplorerResultsHtml(state, exp, selectedPlayerId)}
        </div>
      </section>
    `;
  }

  function renderDeepArchiveCareerDossierHtml(state, utData, catalog, compareTargetId) {
    const cd = utData.careerDossier || {};
    const p = utData.player;
    const allTime = utData.allTime || {};
    const recs = cd.seasonRecords || [];
    const divs = cd.divisionsBreakdown || [];
    const bs = cd.bestSeason;
    const hgs = cd.highestGoalSeason;
    const bds = cd.bestDefenseSeason;

    if (recs.length === 0 && Number(allTime.matches || 0) <= 0) {
      return '';
    }

    const safeLookupName = escapeHtml(p.historicalArchiveName || p.name).replace(/'/g, "\\'");

    // Optional 1v1 UT & Historical Career Comparison inside the dossier
    const defaultCompareCandidate = (catalog || []).find((c) => c.id !== p.id) || null;
    const effCompareId = compareTargetId && (catalog || []).some((c) => c.id === compareTargetId && c.id !== p.id)
      ? compareTargetId
      : (defaultCompareCandidate ? defaultCompareCandidate.id : '');
    const cmpUt = effCompareId && window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculatePlayerUTCard === 'function'
      ? window.SMPL_ENGINE.calculatePlayerUTCard(state, effCompareId)
      : null;
    const sharedHist = (cmpUt && window.SMPL_STUDIO && typeof window.SMPL_STUDIO.computeHistoricalH2H === 'function')
      ? window.SMPL_STUDIO.computeHistoricalH2H(
          p.name,
          cmpUt.player.name,
          p.historicalArchiveName || p.name,
          cmpUt.player.historicalArchiveName || cmpUt.player.name
        )
      : null;

    const compareHtml = cmpUt
      ? (() => {
          const aAt = utData.allTime || {};
          const bAt = cmpUt.allTime || {};
          const cmpRows = [
            { lbl: 'Ocena Karty OVR', a: utData.ovr, b: cmpUt.ovr },
            { lbl: '⚡ ATA / 🧱 DEF', a: utData.attributes.ATA + ' / ' + utData.attributes.DEF, b: cmpUt.attributes.ATA + ' / ' + cmpUt.attributes.DEF, numA: utData.attributes.ATA + utData.attributes.DEF, numB: cmpUt.attributes.ATA + cmpUt.attributes.DEF },
            { lbl: '📚 Sezony (w tym L1)', a: (aAt.seasons || 0) + ' (' + (aAt.l1Seasons || 0) + ' L1)', b: (bAt.seasons || 0) + ' (' + (bAt.l1Seasons || 0) + ' L1)', numA: aAt.seasons || 0, numB: bAt.seasons || 0 },
            { lbl: '⚽ Mecze & Gole', a: (aAt.matches || 0) + 'M • ' + (aAt.gf || 0) + ' goli', b: (bAt.matches || 0) + 'M • ' + (bAt.gf || 0) + ' goli', numA: aAt.gf || 0, numB: bAt.gf || 0 },
            { lbl: '🎯 Skuteczność Win%', a: (aAt.winPct || 0) + '%', b: (bAt.winPct || 0) + '%', numA: aAt.winPct || 0, numB: bAt.winPct || 0 },
            { lbl: '👑 Medale (Zł/Sr/Br)', a: '👑' + (aAt.gold || 0) + ' 🥈' + (aAt.silver || 0) + ' 🥉' + (aAt.bronze || 0), b: '👑' + (bAt.gold || 0) + ' 🥈' + (bAt.silver || 0) + ' 🥉' + (bAt.bronze || 0), numA: (aAt.gold || 0) * 100 + (aAt.medals || 0), numB: (bAt.gold || 0) * 100 + (bAt.medals || 0) },
            { lbl: '🏆 Punkty Kariery', a: aAt.total || aAt.points || 0, b: bAt.total || bAt.points || 0 }
          ];
          return `
            <div class="glass-panel rounded-2xl p-5 sm:p-6 mb-6 border border-cyan-400/35">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 mb-4 border-b border-white/10">
                <div>
                  <span class="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[10px] font-display font-black uppercase">
                    ⚔️ PORÓWNYWARKA KART UT &amp; KARIER S1–S55 (NAWET BEZ KONTA!)
                  </span>
                  <h3 class="font-display font-black text-base sm:text-lg text-white uppercase mt-1">
                    ${escapeHtml(p.name)} (${utData.ovr} OVR) vs ${escapeHtml(cmpUt.player.name)} (${cmpUt.ovr} OVR)
                  </h3>
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                  <label for="smpl-ut-compare-select" class="text-[11px] font-display font-bold uppercase text-slate-300">Porównaj z:</label>
                  <select id="smpl-ut-compare-select" onchange="SMPL_APP.setUtCareerComparePlayer(this.value)" class="px-3 py-2 rounded-xl bg-slate-950 border border-cyan-400/50 text-xs text-white font-bold max-w-xs">
                    ${(catalog || [])
                      .filter((c) => c.id !== p.id)
                      .map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === effCompareId ? 'selected' : ''}>[${c.ovr} OVR] ${escapeHtml(c.name)} (${c.seasons} sez. • ${c.hasActiveAccount ? 'Konto' : 'Archiwum'})</option>`)
                      .join('')}
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-2 text-xs font-mono-num">
                  ${cmpRows.map((cr) => {
                    const nA = cr.numA != null ? Number(cr.numA) : Number(cr.a || 0);
                    const nB = cr.numB != null ? Number(cr.numB) : Number(cr.b || 0);
                    return `
                      <div class="p-2.5 rounded-xl bg-slate-950/85 border border-white/10 grid grid-cols-3 items-center gap-2">
                        <span class="font-bold ${nA > nB ? 'text-emerald-300' : 'text-white'}">${escapeHtml(String(cr.a))}</span>
                        <span class="text-[10px] font-sans uppercase text-slate-400 text-center font-bold">${cr.lbl}</span>
                        <span class="font-bold text-right ${nB > nA ? 'text-emerald-300' : 'text-white'}">${escapeHtml(String(cr.b))}</span>
                      </div>
                    `;
                  }).join('')}
                </div>

                <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10 flex flex-col justify-between">
                  <div>
                    <div class="font-display font-black text-xs uppercase text-amber-300 mb-2">
                      🏛️ Wspólne Sezony w Archiwum S1–S55 (${sharedHist && sharedHist.sharedSeasons ? sharedHist.sharedSeasons.length : 0})
                    </div>
                    ${
                      sharedHist && sharedHist.sharedSeasons && sharedHist.sharedSeasons.length > 0
                        ? `
                          <div class="flex flex-wrap gap-2 mb-3 text-xs font-bold">
                            <span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">${escapeHtml(p.name)}: ${sharedHist.higherA}x wyżej</span>
                            <span class="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-200 border border-sky-400/40">${escapeHtml(cmpUt.player.name)}: ${sharedHist.higherB}x wyżej</span>
                          </div>
                          <div class="max-h-44 overflow-y-auto space-y-1.5 text-[11px] font-mono-num pr-1">
                            ${sharedHist.sharedSeasons.slice(0, 10).map((sh) => `
                              <div class="p-2 rounded-lg bg-slate-900/90 border border-white/5 flex items-center justify-between gap-2">
                                <span class="font-display font-black text-amber-300">S${sh.season}</span>
                                <span class="text-slate-200">${escapeHtml(sh.a.leagueId)} #${sh.a.pos} (${sh.a.PKT}p) vs ${escapeHtml(sh.b.leagueId)} #${sh.b.pos} (${sh.b.PKT}p)</span>
                                <span class="text-[10px] font-bold ${sh.sameLeague ? 'text-emerald-300' : 'text-slate-400'}">${sh.sameLeague ? 'Ta sama liga!' : 'Różne ligi'}</span>
                              </div>
                            `).join('')}
                          </div>
                        `
                        : `<p class="text-xs text-slate-400 py-4">Ci zawodnicy grali w innych sezonach historycznych (brak wspólnych edycji w S1–S55), ale powyżej widzisz pełne porównanie ich kart UT i dorobku!</p>`
                    }
                  </div>
                  <div class="mt-3 pt-2.5 border-t border-white/10 flex justify-end">
                    <button type="button" onclick="SMPL_APP.selectUtExplorerPlayer('${escapeHtml(cmpUt.player.id).replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/45 text-cyan-200 font-display font-bold text-[11px] uppercase">
                      🎴 Przełącz na Kartę: ${escapeHtml(cmpUt.player.name)} →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          `;
        })()
      : '';

    return `
      <!-- SZCZEGÓŁOWY PRZEKRÓJ KARIERY W ARCHIWUM S1–S55 -->
      <section class="glass-panel rounded-2xl p-5 sm:p-6 mb-6 border border-amber-400/35" aria-labelledby="smpl-ut-career-dossier-heading">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-4 border-b border-white/10">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/45 text-amber-300 text-[10px] font-display font-black uppercase">
              🏛️ KSIĘGA KARIERY ZAWODNIKA • ARCHIWUM S1–S55
            </span>
            <h3 id="smpl-ut-career-dossier-heading" class="font-display font-black text-lg sm:text-xl text-white uppercase mt-1">
              📊 Jak przebiegała kariera: ${escapeHtml(p.name)} (${escapeHtml(cd.eraSpanLabel || '')})
            </h3>
          </div>
          <button type="button" onclick="SMPL_APP.openArchivePlayerCareer('${safeLookupName}')" class="px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/45 text-amber-200 font-display font-bold text-xs uppercase transition">
            📚 Otwórz w Tabelach Archiwum →
          </button>
        </div>

        <!-- 6 Kart Analitycznych Kariery -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          <div class="p-3.5 rounded-xl bg-slate-950/90 border border-white/10">
            <div class="text-[10px] font-display uppercase text-slate-400 font-bold">⏳ Lata / Era w SMPL</div>
            <div class="font-display font-black text-base text-white mt-0.5">${escapeHtml(cd.eraSpanLabel || '-')}</div>
            <div class="text-[11px] text-emerald-300 mt-0.5">${allTime.seasons || recs.length} sez. łącznie • ${allTime.l1Seasons || 0} sez. w Ekstraklasie (L1)</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-950/90 border border-amber-400/35">
            <div class="text-[10px] font-display uppercase text-amber-300 font-bold">🌟 Życiowy Sezon (Peak)</div>
            <div class="font-display font-black text-base text-amber-300 mt-0.5">
              ${bs ? `Sezon ${bs.seasonNumber} • ${escapeHtml(bs.leagueLabel)} (#${bs.pos})` : escapeHtml(allTime.bestPos || '-')}
            </div>
            <div class="text-[11px] text-slate-300 mt-0.5">
              ${bs ? `${bs.PKT} PKT • ${bs.M}M (${bs.W}W-${bs.R}R-${bs.P}P) • Bramki ${bs.BZ}:${bs.BS}` : 'Dane z rankingu wszech czasów'}
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-950/90 border border-white/10">
            <div class="text-[10px] font-display uppercase text-slate-400 font-bold">⚽ Rekord Strzelecki w Sezonie</div>
            <div class="font-display font-black text-base text-amber-200 mt-0.5">
              ${hgs ? `⚽ ${hgs.BZ} bramek (Sezon ${hgs.seasonNumber})` : `⚽ ${allTime.gf || 0} goli w karierze`}
            </div>
            <div class="text-[11px] text-slate-300 mt-0.5">
              ${hgs ? `${escapeHtml(hgs.leagueLabel)} • #${hgs.pos} miejsce (${hgs.M} meczów)` : `Średnio ${cd.avgGoalsPerMatch} gola / mecz`}
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-950/90 border border-white/10">
            <div class="text-[10px] font-display uppercase text-slate-400 font-bold">🧱 Najlepsza Defensywa Sezonu</div>
            <div class="font-display font-black text-base text-emerald-300 mt-0.5">
              ${bds ? `${bds.BS} straconych w ${bds.M}M (S${bds.seasonNumber})` : `Śr. ${cd.avgConcededPerMatch} str. / mecz`}
            </div>
            <div class="text-[11px] text-slate-300 mt-0.5">
              ${bds ? `${escapeHtml(bds.leagueLabel)} • śr. ${(bds.BS / bds.M).toFixed(2)} gola/mecz` : `Łączny bilans bramek: ${allTime.gf || 0}:${allTime.ga || 0}`}
            </div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-950/90 border border-white/10">
            <div class="text-[10px] font-display uppercase text-slate-400 font-bold">📐 Średnie Karierowe na Mecz</div>
            <div class="font-display font-black text-base text-sky-300 mt-0.5">${cd.avgPtsPerMatch} PKT / mecz</div>
            <div class="text-[11px] text-slate-300 mt-0.5">⚽ ${cd.avgGoalsPerMatch} strz./M • 🛡️ ${cd.avgConcededPerMatch} strac./M • Win ${allTime.winPct || 0}%</div>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-950/90 border border-white/10">
            <div class="text-[10px] font-display uppercase text-slate-400 font-bold">🏅 Pozycja w Historii SMPL</div>
            <div class="font-display font-black text-base text-white mt-0.5">
              Kariera L1–L9: <span class="text-amber-300">${cd.careerRank ? '#' + cd.careerRank : '-'}</span>
            </div>
            <div class="text-[11px] text-slate-300 mt-0.5">
              All-Time Ekstraklasa: <strong class="text-emerald-300">${cd.l1Rank ? '#' + cd.l1Rank : 'poza L1'}</strong> • Medale: 👑${allTime.gold || 0} 🥈${allTime.silver || 0} 🥉${allTime.bronze || 0}
            </div>
          </div>
        </div>

        ${
          divs.length > 0
            ? `
              <!-- Podział Kariery na Poszczególne Ligi L1–L9 -->
              <div class="mb-5">
                <div class="text-xs font-display font-black uppercase text-cyan-300 mb-2.5">
                  🏟️ Szczebel po Szczeblu — Występy w Poszczególnych Dywizjach (L1–L9):
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono-num text-xs">
                  ${divs.map((dv) => `
                    <div class="p-3 rounded-xl bg-slate-950/85 border ${dv.leagueId === 'L1' ? 'border-amber-400/45' : 'border-white/10'} flex items-center justify-between gap-2">
                      <div>
                        <div class="font-display font-black text-white">${escapeHtml(dv.leagueLabel)}</div>
                        <div class="text-[11px] text-slate-400">${dv.seasons} sez. • ${dv.matches}M (${dv.wins}W-${dv.draws}R-${dv.losses}P)</div>
                      </div>
                      <div class="text-right">
                        <div class="font-display font-black text-amber-300">${dv.pkt} PKT</div>
                        <div class="text-[10px] text-emerald-300">Najw. #${dv.bestPos}${dv.titles > 0 ? ` • 👑${dv.titles}x` : (dv.podiums > 0 ? ` • 🏅${dv.podiums}x` : '')}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `
            : ''
        }

        ${
          recs.length > 0
            ? `
              <!-- Responsywna Tabela Sezon po Sezonie (zgodna z responsive-table: sticky + @container mobile cards) -->
              <div>
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <h4 id="smpl-ut-career-table-heading" class="text-xs sm:text-sm font-display font-black uppercase text-amber-300">
                    📜 Wszystkie Zapisane Sezony Zawodnika (${recs.length} sezonów — kliknij wiersz, aby otworzyć pełną tabelę sezonu)
                  </h4>
                  <span class="text-[11px] text-slate-400">Kompletne dane z oficjalnych tabel S1–S55</span>
                </div>
                <div tabindex="0" role="region" aria-labelledby="smpl-ut-career-table-heading" class="smpl-career-table-region">
                  <table class="smpl-career-resp-table font-mono-num">
                    <thead>
                      <tr>
                        <th scope="col">Sezon</th>
                        <th scope="col">Dywizja</th>
                        <th scope="col">Miejsce</th>
                        <th scope="col">Mecze</th>
                        <th scope="col">Bilans W-R-P</th>
                        <th scope="col">Bramki</th>
                        <th scope="col">Punkty</th>
                        <th scope="col">Tytuł / Uwagi</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recs.map((rc) => {
                        const posBadge = rc.inProgress
                          ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-300 font-bold">⏳ #${rc.pos}</span>`
                          : rc.pos === 1
                          ? `<span class="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-black">👑 #1</span>`
                          : rc.pos === 2
                          ? `<span class="px-1.5 py-0.5 rounded bg-slate-300/20 text-slate-200 font-black">🥈 #2</span>`
                          : rc.pos === 3
                          ? `<span class="px-1.5 py-0.5 rounded bg-amber-700/25 text-amber-400 font-black">🥉 #3</span>`
                          : `<span class="text-slate-200 font-bold">#${rc.pos}</span>`;
                        return `
                          <tr onclick="SMPL_APP.setArchiveMode('SEASONS'); SMPL_APP.setArchiveSeason(${rc.seasonNumber}); SMPL_APP.setArchiveLeague('${rc.leagueId}'); SMPL_APP.switchTab('archive');" class="cursor-pointer transition">
                            <th scope="row">Sezon ${rc.seasonNumber}${rc.inProgress ? ' <span class="text-[10px] text-amber-300 font-normal">(w trakcie)</span>' : ''}</th>
                            <td class="font-sans font-bold text-white">${escapeHtml(rc.leagueLabel)}</td>
                            <td>${posBadge}</td>
                            <td class="text-slate-300">${rc.M}</td>
                            <td><span class="text-emerald-400 font-bold">${rc.W}W</span>-<span class="text-amber-300">${rc.R}R</span>-<span class="text-rose-400">${rc.P}P</span></td>
                            <td class="text-slate-200">${rc.BZ}:${rc.BS} <span class="${rc.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}">(${rc.diff >= 0 ? '+' + rc.diff : rc.diff})</span></td>
                            <td class="font-display font-black text-amber-300">${rc.PKT} PKT</td>
                            <td class="font-sans text-xs text-amber-200 font-semibold">${escapeHtml(rc.note || (rc.pos === 1 && !rc.inProgress ? 'Mistrz dywizji' : '—'))}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `
            : ''
        }
      </section>

      ${compareHtml}
    `;
  }

  function renderPlayerProfileUTView(state, profileState, session) {
    const isAdmin = Boolean(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'));
    const winInfo = (window.SMPL_DB && typeof window.SMPL_DB.getSeasonJoinWindowInfo === 'function')
      ? window.SMPL_DB.getSeasonJoinWindowInfo(state)
      : { isOpen: false, phase: 'NOT_STARTED', allowedLeagues: [] };
    const myAdminPlayer = isAdmin && window.SMPL_DB && typeof window.SMPL_DB.findPlayerForAdmin === 'function'
      ? window.SMPL_DB.findPlayerForAdmin(session.adminId, state)
      : null;

    const unifiedCatalog = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.getUnifiedUtPlayersCatalog === 'function')
      ? window.SMPL_ENGINE.getUnifiedUtPlayersCatalog(state)
      : [];

    const reqId = profileState && profileState.playerId ? String(profileState.playerId) : '';
    const hasReqInActive = reqId && state.players.some((p) => p.id === reqId);
    const hasReqInArchive = reqId && reqId.indexOf('ARCH::') === 0;

    const selectedId =
      (hasReqInActive || hasReqInArchive)
        ? reqId
        : (session && session.activePlayerId && state.players.some((p) => p.id === session.activePlayerId))
        ? session.activePlayerId
        : (myAdminPlayer && myAdminPlayer.id)
        || (state.players[0] && state.players[0].id)
        || (unifiedCatalog[0] && unifiedCatalog[0].id)
        || null;

    const utData = selectedId ? window.SMPL_ENGINE.calculatePlayerUTCard(state, selectedId) : null;
    if (!utData) {
      const enabledLeagues = Object.keys(state.leagues || {}).filter(
        (id) => !(state.portalSettings && Array.isArray(state.portalSettings.disabledLeagues) && state.portalSettings.disabledLeagues.includes(id))
      );
      const joinableLeagues = (winInfo.allowedLeagues && winInfo.allowedLeagues.length > 0)
        ? enabledLeagues.filter((id) => winInfo.allowedLeagues.includes(id))
        : enabledLeagues;
      const isApprovedPoolUser = Boolean(!isAdmin && session && !session.isGuest && session.isPlayerAuthenticated && session.activeRegId);
      const poolReg = isApprovedPoolUser
        ? ((state.registrations || []).find((r) => r && r.id === session.activeRegId) || null)
        : null;
      const poolAvatar = (poolReg && poolReg.avatar) || (poolReg && window.SMPL_MEDIA ? window.SMPL_MEDIA.generatePlayerAvatar(poolReg.name, poolReg.nick, 8) : '');
      const poolBio = poolReg && poolReg.bio ? String(poolReg.bio).trim() : '';

      return `
        <div class="glass-panel-league rounded-3xl p-8 text-center space-y-4">
          ${
            isApprovedPoolUser && poolAvatar
              ? `<div class="flex flex-col items-center gap-2">
                   <img src="${poolAvatar}" class="w-20 h-20 rounded-full object-cover border-4 border-emerald-400 shadow-xl" alt="${escapeHtml((poolReg && poolReg.name) || 'Zawodnik')}"/>
                   <div class="text-xs text-slate-300 font-bold">${escapeHtml((poolReg && poolReg.name) || '')} <span class="text-amber-300">@${escapeHtml((poolReg && poolReg.nick) || '')}</span></div>
                   ${poolBio ? `<div class="max-w-md px-3.5 py-2 rounded-xl bg-slate-950/80 border border-white/15 text-xs text-slate-200 italic">📝 „${escapeHtml(poolBio)}”</div>` : ''}
                 </div>`
              : `<div class="text-4xl">🎴</div>`
          }
          <h3 class="font-display font-black text-xl text-white uppercase">
            ${isApprovedPoolUser ? 'Twoje Konto Jest Zatwierdzone w Puli Graczy!' : `Brak Zarejestrowanych Zawodników w Sezonie ${state.season || 56}`}
          </h3>
          <p class="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            ${
              isApprovedPoolUser
                ? (winInfo.isOpen
                    ? 'Administracja otworzyła start sezonu! Wybierz dywizję poniżej i kliknij Dołącz do Ligi, aby odblokować swoją kartę Ultimate Team.'
                    : 'Czekasz w puli na zatwierdzenie początku sezonu przez Administrację — gdy okno się otworzy, pojawi się tutaj przycisk Dołącz do Ligi.')
                : 'Tabele nowego sezonu są gotowe na start! Karty Ultimate Team pojawią się automatycznie po zapisaniu graczy i przypisaniu ich do lig.'
            }
          </p>
          ${
            isApprovedPoolUser && winInfo.isOpen && joinableLeagues.length > 0
              ? `<div class="inline-flex flex-wrap items-center justify-center gap-2.5 p-3 rounded-2xl bg-emerald-950/35 border border-emerald-400/40">
                   <select id="profile-pool-join-league" class="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-400/50 text-xs text-white font-bold">
                     ${joinableLeagues.map((lg) => `<option value="${lg}">${escapeHtml((state.leagues[lg] && state.leagues[lg].name) || lg)} (${lg})</option>`).join('')}
                   </select>
                   <button type="button" onclick="SMPL_APP.handlePlayerJoinLeague(document.getElementById('profile-pool-join-league').value)" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg">
                     ⚡ Dołącz do Ligi
                   </button>
                 </div>`
              : ''
          }
          <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
            ${
              isApprovedPoolUser
                ? `<button type="button" onclick="SMPL_APP.openEditOwnProfileModal()" class="px-4 py-2.5 rounded-xl bg-blue-600/35 hover:bg-blue-600/50 text-blue-100 border border-blue-400/50 font-display font-black text-xs uppercase shadow-lg">🎨 Edytuj Awatar i Bio</button>`
                : ''
            }
            ${
              isAdmin
                ? `<button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('L1')" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-display font-black text-xs uppercase shadow-lg">🛡️ Dołącz jako Admin do Ekstraklasy (L1) + Statystyki</button>`
                : (!isApprovedPoolUser ? `<button onclick="SMPL_APP.switchTab('register')" class="btn-league px-5 py-2.5 rounded-xl font-display font-black text-xs uppercase">📝 Zarejestruj się do Ligi</button>` : '')
            }
            <button onclick="SMPL_APP.switchTab('archive')" class="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 font-display font-bold text-xs uppercase">🏛️ Archiwum S1–S55</button>
          </div>
          <div class="max-w-xl mx-auto text-left">
            ${window.SMPL_SECURITY && typeof window.SMPL_SECURITY.renderProfileTrustCardHtml === 'function' ? window.SMPL_SECURITY.renderProfileTrustCardHtml() : ''}
          </div>
        </div>
      `;
    }

    const p = utData.player;
    const isArchOnly = Boolean(utData.isArchiveOnly || p.isArchiveVirtual);
    const cd = utData.careerDossier || {};
    const row = utData.seasonRow;
    const utAvatar = (row && row.avatar) || p.avatar || (window.SMPL_MEDIA ? window.SMPL_MEDIA.generatePlayerAvatar(p.name, p.nick, Math.max(0, ((row && row.position) || 1) - 1)) : '');
    const allTime = utData.allTime;
    const attr = utData.attributes;
    const trophies = utData.trophies || [];
    const isLoggedInPlayer = Boolean(session && !session.isGuest && session.isPlayerAuthenticated && (session.activePlayerId || session.activeRegId));
    const isOwnAdminPlayer = Boolean(!isArchOnly && myAdminPlayer && myAdminPlayer.id === p.id);
    const isOwnProfile = Boolean(!isArchOnly && ((session && session.isPlayerAuthenticated && session.activePlayerId === p.id) || isOwnAdminPlayer));
    const isPlayerInPool = Boolean(!isArchOnly && (p.active === false || p.leagueId === 'POOL'));
    const enabledLeagues = Object.keys(state.leagues || {}).filter(
      (id) => !(state.portalSettings && Array.isArray(state.portalSettings.disabledLeagues) && state.portalSettings.disabledLeagues.includes(id))
    );
    const utCosmetics = (!isArchOnly && window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getPlayerCosmetics === 'function')
      ? window.SMPL_STUDIO.getPlayerCosmetics(state, p.id)
      : { frameCss: '', bgCss: '', customTitle: '' };
    const utCoinsInfo = (!isArchOnly && window.SMPL_STUDIO && typeof window.SMPL_STUDIO.calculatePlayerCoinsBreakdown === 'function')
      ? window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, p.id)
      : { earned: 0, spent: 0, balance: 0 };
    const utAchievements = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.calculatePlayerAchievements === 'function')
      ? window.SMPL_STUDIO.calculatePlayerAchievements(state, p.id)
      : { unlockedCount: 0, totalCount: 0, items: [] };
    const utTrajectory = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.computePlayerCareerTrajectory === 'function')
      ? window.SMPL_STUDIO.computePlayerCareerTrajectory(p.name, p.historicalArchiveName || p.name)
      : { points: [], summary: null };
    const joinableLeagues = (winInfo.allowedLeagues && winInfo.allowedLeagues.length > 0)
      ? enabledLeagues.filter((id) => winInfo.allowedLeagues.includes(id))
      : enabledLeagues;

    const activeAccountOptions = state.players
      .filter((item) => item.active !== false || item.id === p.id)
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}" ${item.id === p.id ? 'selected' : ''}>[${item.active === false || item.leagueId === 'POOL' ? 'PULA' : item.leagueId}] ${escapeHtml(item.name)} (@${escapeHtml(item.nick)})</option>`
      )
      .join('');
    const archiveOnlyOptions = unifiedCatalog
      .filter((c) => c.isArchiveOnly)
      .map(
        (c) =>
          `<option value="${escapeHtml(c.id)}" ${c.id === p.id ? 'selected' : ''}>[🏛️ ${c.ovr} OVR] ${escapeHtml(c.name)} (${c.seasons} sez. • bez konta)</option>`
      )
      .join('');
    const playerOptions = `
      ${activeAccountOptions ? `<optgroup label="🟢 Aktywne Konta Sezonu ${state.season || 56}">${activeAccountOptions}</optgroup>` : ''}
      ${archiveOnlyOptions ? `<optgroup label="🏛️ Archiwum S1–S55 (Gracze bez aktywnego konta)">${archiveOnlyOptions}</optgroup>` : ''}
    `;

    const cardBgClass =
      utData.cardTier === 'ICON_LEGEND'
        ? 'from-amber-400/30 via-yellow-900/40 to-slate-950 border-amber-400 shadow-amber-500/20'
        : utData.cardTier === 'TOTW_STAR'
        ? 'from-blue-500/30 via-indigo-950/50 to-slate-950 border-blue-400 shadow-blue-500/20'
        : 'from-amber-600/25 via-slate-900 to-slate-950 border-amber-500/60 shadow-amber-500/10';

    const ownPoolReg = (!isAdmin && session && !session.isGuest && session.isPlayerAuthenticated && !session.activePlayerId && session.activeRegId)
      ? ((state.registrations || []).find((r) => r && r.id === session.activeRegId) || null)
      : null;
    const ownPoolBannerHtml = ownPoolReg
      ? (() => {
          const opAvatar = ownPoolReg.avatar || (window.SMPL_MEDIA ? window.SMPL_MEDIA.generatePlayerAvatar(ownPoolReg.name, ownPoolReg.nick, 8) : '');
          const opBio = ownPoolReg.bio ? String(ownPoolReg.bio).trim() : '';
          const opS55 = (window.SMPL_DB && typeof window.SMPL_DB.findPlayerS55Record === 'function')
            ? window.SMPL_DB.findPlayerS55Record(state, ownPoolReg)
            : null;
          return `
            <div class="glass-panel-league rounded-2xl p-4 sm:p-5 mb-6 border border-emerald-400/40 bg-emerald-950/35 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="flex items-center gap-3.5 min-w-0">
                ${opAvatar ? `<img src="${opAvatar}" class="w-14 h-14 rounded-full object-cover border-2 border-emerald-400 flex-shrink-0" alt="${escapeHtml(ownPoolReg.name)}"/>` : ''}
                <div class="min-w-0">
                  <div class="text-[10px] font-display font-black uppercase text-emerald-300">✅ TWOJE KONTO W PULI GRACZY (${escapeHtml(ownPoolReg.status === 'APPROVED_POOL' ? 'GOTOWE DO LIGI' : 'OCZEKUJĄCE')})</div>
                  <div class="font-display font-black text-base text-white truncate">${escapeHtml(ownPoolReg.name)} <span class="text-amber-300 text-xs">@${escapeHtml(ownPoolReg.nick)}</span></div>
                  ${
                    opS55 && opS55.M > 0
                      ? `<div class="mt-1.5 inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-[11px] font-semibold text-amber-200">
                           <span>⏳ Twój obecny wynik w S55 (${escapeHtml(opS55.leagueLabel)}):</span>
                           <strong class="text-white">#${opS55.pos} • ${opS55.PKT} pkt</strong>
                           <span class="text-slate-300">(${opS55.M}M: ${opS55.W}W-${opS55.R}R-${opS55.P}P • ${opS55.BZ}:${opS55.BS} • 🧤 ${opS55.cs})</span>
                         </div>`
                      : ''
                  }
                  ${
                    opBio
                      ? `<div class="text-xs text-slate-200 italic mt-0.5 break-words">📝 „${escapeHtml(opBio)}”</div>`
                      : `<div class="text-[11px] text-slate-400 mt-0.5">Nie ustawiłeś jeszcze swojego Bio — kliknij przycisk obok, aby spersonalizować awatar i opis!</div>`
                  }
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                <button type="button" onclick="SMPL_APP.openEditOwnProfileModal()" class="px-3.5 py-2 rounded-xl bg-blue-600/35 hover:bg-blue-600/50 text-blue-100 border border-blue-400/50 font-display font-black text-xs uppercase shadow">
                  🎨 Edytuj Awatar i Bio
                </button>
                ${
                  ownPoolReg.status === 'APPROVED_POOL' && winInfo.isOpen && joinableLeagues.length > 0
                    ? `<select id="profile-pool-join-league-top" class="px-2.5 py-2 rounded-xl bg-slate-950 border border-emerald-400/50 text-xs text-white font-bold">
                         ${joinableLeagues.map((lg) => `<option value="${lg}">${lg}</option>`).join('')}
                       </select>
                       <button type="button" onclick="SMPL_APP.handlePlayerJoinLeague(document.getElementById('profile-pool-join-league-top').value)" class="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg">
                         ⚡ Dołącz do ligi
                       </button>`
                    : ''
                }
              </div>
            </div>
          `;
        })()
      : '';

    const safePidJs = escapeHtml(p.id).replace(/'/g, "\\'");
    const safeArchNameJs = escapeHtml(p.historicalArchiveName || p.name).replace(/'/g, "\\'");
    const archiveHeritageBannerHtml = isArchOnly
      ? `
        <div class="glass-panel rounded-2xl p-4 sm:p-5 mb-6 border border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-slate-950/90 to-emerald-950/35 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/45 text-amber-200 text-[10px] font-display font-black uppercase tracking-wider">
              <span>🏛️ KARTA HISTORYCZNA Z ARCHIWUM S1–S55</span>
              <span>•</span>
              <span class="text-emerald-300">GRACZ BEZ AKTYWNEGO KONTA W SEZONIE ${state.season || 56}</span>
            </div>
            <div class="font-display font-black text-base sm:text-lg text-white mt-1">
              ${escapeHtml(p.name)} — pełna historia kariery (${escapeHtml(cd.eraSpanLabel || 'S1–S55')} • ${allTime.seasons || 1} sez. • ${allTime.matches || 0} meczów)
            </div>
            <p class="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Ta Karta Ultimate Team (<strong>${utData.ovr} OVR</strong>) i księga kariery zostały wygenerowane automatycznie z oficjalnych archiwów ligowych S1–S55. Możesz sprawdzić każdy sezon tego gracza nawet wtedy, gdy nie posiada konta w obecnym sezonie!
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button type="button" onclick="SMPL_APP.openArchivePlayerCareer('${safeArchNameJs}')" class="px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 border border-amber-400/50 text-amber-200 font-display font-black text-xs uppercase">
              📜 Tabele Sezonów →
            </button>
            ${!isLoggedInPlayer && !isAdmin
              ? `<button type="button" onclick="SMPL_APP.switchTab('register')" class="btn-league px-3.5 py-2 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                   📝 To Ty? Załóż konto i połącz historię!
                 </button>`
              : ''}
          </div>
        </div>
      `
      : '';

    return `
      ${ownPoolBannerHtml}
      ${renderUtCardsExplorerSectionHtml(state, profileState && profileState.explorer, p.id, false)}
      <div id="smpl-ut-active-card-anchor"></div>
      ${archiveHeritageBannerHtml}
      ${window.SMPL_RANKS ? window.SMPL_RANKS.profileRankPanelHtml(p, state) : ''}
      <!-- Pasek wyboru zawodnika i nagłówek Karty UT -->
      <div class="glass-panel-league rounded-2xl p-5 sm:p-6 mb-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span class="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-display font-bold uppercase tracking-wider">
              🎴 ${isArchOnly ? 'ARCHIWALNA KARTA ZAWODNIKA ULTIMATE TEAM (S1–S55)' : 'KARTA ZAWODNIKA ULTIMATE TEAM ⚡ &amp; GABLOTA TROFEÓW'}
            </span>
            <h2 class="font-display font-black text-xl sm:text-2xl text-white uppercase mt-2">
              ${escapeHtml(p.name)} — Karta UT (${utData.ovr} OVR), Kariera (S1–S55) i Trofea
            </h2>
            <p class="text-xs text-slate-300 mt-1">
              System automatycznie przelicza ocenę ogólną <strong>OVR (75–99)</strong>, wylicza <strong>Styl Gry</strong>, <strong>Szczyt Kariery</strong> oraz zbiera wszystkie medale i puchary na profilu każdego zawodnika w historii SMPL!
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <div>
              <label for="smpl-profile-quick-select" class="block text-[10px] font-display uppercase text-slate-400 font-bold mb-1">Szybki wybór z listy (${unifiedCatalog.length} graczy):</label>
              <select id="smpl-profile-quick-select" onchange="SMPL_APP.setProfilePlayer(this.value)" class="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs sm:text-sm text-white font-bold focus:outline-none max-w-[290px]">
                ${playerOptions}
              </select>
            </div>
            ${!isArchOnly
              ? `<button type="button" onclick="SMPL_APP.openMessengerForPlayer('${safePidJs}')" class="px-3.5 py-2.5 rounded-xl bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-400/40 font-display font-black text-xs uppercase self-end transition flex items-center gap-1.5 shadow">💬 Napisz na Messengerze</button>`
              : ''}
            ${
              isOwnAdminPlayer
                ? `
                  ${
                    isPlayerInPool
                      ? `<button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('L1')" class="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase self-end shadow-lg transition">
                           ⚡ Dołącz ponownie jako Admin
                         </button>`
                      : `<button type="button" onclick="SMPL_APP.openAdminJoinAsPlayerModal('${escapeHtml(p.leagueId)}')" class="px-3.5 py-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/45 text-blue-200 border border-blue-400/50 font-display font-black text-xs uppercase self-end transition shadow">
                           🛡️ Zmień Ligę (Admin)
                         </button>
                         <button type="button" onclick="SMPL_APP.handlePlayerLeaveLeague()" class="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 font-display font-black text-xs uppercase self-end transition shadow">
                           🚪 Opuść ligę (${escapeHtml(p.leagueId)})
                         </button>`
                  }
                `
                : (isOwnProfile && !isAdmin)
                ? (
                    winInfo.isOpen
                      ? (
                          isPlayerInPool
                            ? (joinableLeagues.length > 0
                                ? `<div class="flex items-center gap-1.5 self-end">
                                     <select id="profile-player-join-league" class="px-2.5 py-2.5 rounded-xl bg-slate-950 border border-emerald-400/50 text-xs text-white font-bold">
                                       ${joinableLeagues.map((lg) => `<option value="${lg}">${lg}</option>`).join('')}
                                     </select>
                                     <button type="button" onclick="SMPL_APP.handlePlayerJoinLeague(document.getElementById('profile-player-join-league').value)" class="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase shadow-lg transition">
                                       ⚡ Dołącz do ligi
                                     </button>
                                   </div>`
                                : '')
                            : `<button type="button" onclick="SMPL_APP.handlePlayerLeaveLeague()" class="px-3.5 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-display font-black text-xs uppercase self-end shadow-lg transition">
                                 🚪 Opuść ligę (${escapeHtml(p.leagueId)})
                               </button>`
                        )
                      : `<span class="px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-[11px] text-slate-400 font-bold self-end">
                           ${isPlayerInPool ? '⏳ Czeka na start sezonu' : '🔒 Okno zmian zamknięte'}
                         </span>`
                  )
                : ''
            }
            ${
              isOwnProfile
                ? `<button type="button" onclick="SMPL_APP.openEditOwnProfileModal()" class="px-3.5 py-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/45 text-blue-100 border border-blue-400/50 font-display font-black text-xs uppercase self-end transition shadow">
                     🎨 Edytuj Awatar i Bio
                   </button>
                   <button type="button" onclick="SMPL_APP.openCoinShopModal()" class="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 font-display font-black text-xs uppercase self-end transition shadow">
                     🪙 Sklepik Coins (${utCoinsInfo.balance})
                   </button>
                   <button type="button" onclick="SMPL_APP.openVacationModeModal()" class="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-200 border border-blue-400/40 font-display font-black text-xs uppercase self-end transition shadow">
                     ✈️ Urlop
                   </button>`
                : ''
            }
            ${!isArchOnly
              ? `<button type="button" onclick="SMPL_APP.openSmplWrappedModal('${safePidJs}')" class="px-3.5 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 text-purple-200 border border-purple-400/50 font-display font-black text-xs uppercase self-end transition shadow">
                   🎁 SMPL Wrapped
                 </button>`
              : ''}
            <button type="button" onclick="SMPL_APP.downloadUtCardPosterPng('${safePidJs}')" class="px-3.5 py-2.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 font-display font-black text-xs uppercase self-end transition shadow">
              📸 Karta UT PNG
            </button>
            ${
              isOwnProfile && !isOwnAdminPlayer
                ? `<button onclick="SMPL_APP.openPlayerChangePasswordModal()" class="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 font-display font-black text-xs uppercase self-end transition shadow">
                     🔑 Zmień moje hasło
                   </button>`
                : ''
            }
            ${
              isAdmin && !isArchOnly
                ? `<button onclick="SMPL_APP.openAssignHistoricalStatsModal('${safePidJs}')" class="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-xs uppercase self-end shadow-lg">
                     🏛️ ${isOwnAdminPlayer ? 'Moje Statystyki S1–S55 (Admin)' : 'Dopisz statystyki z poprzednich lat (1 Klik)'}
                   </button>
                   <button onclick="SMPL_APP.openAwardTrophyModal('${safePidJs}')" class="btn-league px-3.5 py-2.5 rounded-xl text-xs font-display uppercase self-end">
                     🏆 Nadaj Trofeum
                   </button>
                   ${session && session.adminRole === 'MASTER_ADMIN'
                     ? `<button type="button" onclick="SMPL_APP.openMasterGrantCoinsModal('${safePidJs}')" class="px-3.5 py-2.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/50 font-display font-black text-xs uppercase self-end shadow">
                          👑 +Coins
                        </button>`
                     : ''}`
                : ''
            }
          </div>
        </div>
      </div>

      <!-- Główna siatka: Karta FIFA/EA FC Ultimate Team (lewa) + Gablota Trofeów i Raport Skautingowy (prawa) -->
      ${
        isOwnProfile && Array.isArray(p.notifications) && p.notifications.filter((n) => n && n.read !== true).length > 0
          ? `<div class="mb-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/50 flex flex-wrap items-center justify-between gap-2">
               <div class="text-xs text-amber-100 font-semibold">
                 🔔 Masz <strong class="text-amber-300">${p.notifications.filter((n) => n && n.read !== true).length}</strong> nieprzeczytanych powiadomień (wyniki meczów, nagrody, komunikaty ligi).
               </div>
               <button type="button" onclick="SMPL_APP.openNotificationsCenterModal()" class="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-[11px] uppercase shadow">
                 📬 Otwórz Powiadomienia
               </button>
             </div>`
          : ''
      }
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <!-- LEWA KOLUMNA: ZŁOTA KARTA ULTIMATE TEAM -->
        <div class="lg:col-span-5 smpl-ut-3d-wrap w-full max-w-[460px] mx-auto lg:max-w-none">
          <div class="ut-card-foil-surface smpl-ut-card-holo rounded-3xl p-4 sm:p-6 ${cardBgClass} ${utCosmetics.bgCss || ''} ${utCosmetics.frameCss || ''} border-2 shadow-2xl relative overflow-hidden" onpointermove="SMPL_APP.handleUtCardTilt(event, this)" onpointerleave="SMPL_APP.resetUtCardTilt(this)">
            <div class="smpl-ut-prism-sheen"></div>
            <div class="smpl-ut-card-head grid grid-cols-[minmax(66px,1fr)_auto_minmax(66px,1fr)] items-start gap-2 sm:gap-3 mb-4">
              <div class="smpl-ut-ovr-crest text-center justify-self-start">
                <div class="font-display font-black text-3xl sm:text-5xl text-amber-300 leading-none">${utData.ovr}</div>
                <div class="text-[10px] sm:text-[11px] font-display font-black uppercase text-white tracking-widest mt-1">OVR</div>
                <div class="mt-1.5 sm:mt-2 px-1.5 sm:px-2 py-0.5 rounded bg-black/50 border border-white/15 text-[10px] font-display font-bold text-emerald-300 whitespace-nowrap">
                  ${isArchOnly ? `🏛️ ${escapeHtml(cd.peakLeagueId || p.leagueId)}` : `#${row.position} ${escapeHtml(p.leagueId)}`}
                </div>
              </div>

              <div class="flex flex-col items-center justify-self-center">
                <div class="relative flex flex-col items-center">
                  ${(() => {
                    const utRk = window.SMPL_RANKS ? window.SMPL_RANKS.getPlayerRank(p, state) : null;
                    if (window.SMPL_RANKS && utRk && !utRk.isPlaceholder) {
                      return window.SMPL_RANKS.avatarWithGlassBadgeHtml(
                        utAvatar,
                        p.name,
                        'w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-amber-400 shadow-xl',
                        utRk,
                        p.id,
                        'ut'
                      );
                    }
                    return `<img src="${utAvatar}" class="w-20 h-20 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-amber-400 shadow-xl" alt="${escapeHtml(p.name)}"/>`;
                  })()}
                  <span class="mt-2 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-display font-black text-[10px] uppercase whitespace-nowrap shadow">
                    ${escapeHtml(utData.cardLabel)}
                  </span>
                  ${
                    isOwnProfile
                      ? `<button type="button" onclick="SMPL_APP.openEditOwnProfileModal()" class="mt-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/90 hover:bg-blue-600/55 text-blue-200 border border-blue-400/50 font-display font-bold text-[10px] uppercase whitespace-nowrap transition shadow">
                           📷 Zmień Awatar &amp; Bio
                         </button>`
                      : ''
                  }
                </div>
              </div>

              <div class="text-right justify-self-end">
                <div class="text-xs font-display font-bold text-amber-300 whitespace-nowrap">🇵🇱 POL</div>
                <div class="text-[10px] sm:text-[11px] text-slate-300 font-semibold mt-1 leading-tight">SMPL Liga</div>
                <div class="text-[11px] text-emerald-400 font-bold mt-1 whitespace-nowrap">🏆 ${trophies.length}x</div>
              </div>
            </div>

            <div class="text-center border-y border-white/15 py-3 my-3">
              ${(() => {
                const utRk2 = window.SMPL_RANKS ? window.SMPL_RANKS.getPlayerRank(p, state) : null;
                const canSeeLogin = Boolean(isAdmin || isOwnProfile);
                const playerBio = p.bio ? String(p.bio).trim() : '';
                return `
                  <div class="font-display font-black text-xl sm:text-2xl text-white uppercase tracking-wide ${window.SMPL_RANKS && utRk2 ? window.SMPL_RANKS.nameClass(utRk2) : ''} ${utCosmetics.nickFxCss || ''}">${escapeHtml(p.name)}</div>
                  <div class="text-xs text-amber-300 font-semibold">@${escapeHtml(p.nick)}${canSeeLogin && p.username ? ` • Login: <code class="text-white">${escapeHtml(p.username)}</code>` : ''}</div>
                  ${renderClanBadgeHtml(p, state, false) ? `<div class="mt-2 flex items-center justify-center">${renderClanBadgeHtml(p, state, false)}</div>` : ''}
                  ${window.SMPL_RANKS && utRk2 && !utRk2.isPlaceholder ? `<div class="mt-2 flex items-center justify-center gap-1.5 flex-wrap">${window.SMPL_RANKS.fullBadgesHtml(utRk2, '', p.id)}</div>` : ''}
                  ${window.SMPL_RANKS && typeof window.SMPL_RANKS.expansionBadgesHtml === 'function' ? `<div class="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">${window.SMPL_RANKS.expansionBadgesHtml(state, p, false)}</div>` : ''}
                  ${
                    playerBio
                      ? `<div class="mt-3 px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-slate-100 italic leading-relaxed break-words">📝 „${escapeHtml(playerBio)}”</div>`
                      : (isOwnProfile
                          ? `<button type="button" onclick="SMPL_APP.openEditOwnProfileModal('bio')" class="mt-3 w-full px-3 py-2 rounded-xl bg-black/40 hover:bg-slate-800 border border-dashed border-blue-400/40 text-[11px] text-blue-200 transition">📝 Dodaj własne Bio (np. styl gry, cel na sezon ${state.season || 56})...</button>`
                          : '')
                  }
                `;
              })()}
            </div>

            <!-- 6 Statystyk Karty UT (ATA, DEF, FOR, SKT, DOS, MEN) -->
            <div class="grid grid-cols-2 gap-3 my-4 font-mono-num">
              <div class="smpl-ut-stat-tile">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-display text-slate-300 font-bold">⚡ ATA (Atak)</span>
                  <span class="font-display font-black text-lg text-amber-300">${attr.ATA}</span>
                </div>
                <div class="smpl-ut-stat-track"><div class="smpl-ut-stat-fill" style="width:${Math.min(100, Math.max(15, Number(attr.ATA || 50)))}%"></div></div>
              </div>
              <div class="smpl-ut-stat-tile">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-display text-slate-300 font-bold">🧱 DEF (Obrona)</span>
                  <span class="font-display font-black text-lg text-emerald-400">${attr.DEF}</span>
                </div>
                <div class="smpl-ut-stat-track"><div class="smpl-ut-stat-fill" style="width:${Math.min(100, Math.max(15, Number(attr.DEF || 50)))}%"></div></div>
              </div>
              <div class="smpl-ut-stat-tile">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-display text-slate-300 font-bold">🔥 FOR (Forma)</span>
                  <span class="font-display font-black text-lg text-blue-300">${attr.FOR}</span>
                </div>
                <div class="smpl-ut-stat-track"><div class="smpl-ut-stat-fill" style="width:${Math.min(100, Math.max(15, Number(attr.FOR || 50)))}%"></div></div>
              </div>
              <div class="smpl-ut-stat-tile">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-display text-slate-300 font-bold">🎯 SKT (Skut.)</span>
                  <span class="font-display font-black text-lg text-amber-300">${attr.SKT}</span>
                </div>
                <div class="smpl-ut-stat-track"><div class="smpl-ut-stat-fill" style="width:${Math.min(100, Math.max(15, Number(attr.SKT || 50)))}%"></div></div>
              </div>
              <div class="smpl-ut-stat-tile">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-display text-slate-300 font-bold">🏛️ DOS (Dośw.)</span>
                  <span class="font-display font-black text-lg text-purple-300">${attr.DOS}</span>
                </div>
                <div class="smpl-ut-stat-track"><div class="smpl-ut-stat-fill" style="width:${Math.min(100, Math.max(15, Number(attr.DOS || 50)))}%"></div></div>
              </div>
              <div class="smpl-ut-stat-tile">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-display text-slate-300 font-bold">🧠 MEN (Mental)</span>
                  <span class="font-display font-black text-lg text-emerald-300">${attr.MEN}</span>
                </div>
                <div class="smpl-ut-stat-track"><div class="smpl-ut-stat-fill" style="width:${Math.min(100, Math.max(15, Number(attr.MEN || 50)))}%"></div></div>
              </div>
            </div>

            <!-- Podsumowanie Aktualnej Tabeli vs All-Time na dole karty -->
            <div class="grid grid-cols-4 gap-2 pt-3 border-t border-white/15 text-center text-xs">
              ${isArchOnly || Number(row.M || 0) === 0
                ? `
                  <div>
                    <div class="text-[10px] text-slate-400">SEZONY</div>
                    <div class="font-display font-black text-white text-sm">${allTime.seasons || 1}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">WIN %</div>
                    <div class="font-display font-black text-emerald-400 text-sm">${allTime.winPct || 0}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">GOLE HIST.</div>
                    <div class="font-display font-black text-emerald-300 text-sm">⚽ ${allTime.gf || 0}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">ALL-TIME</div>
                    <div class="font-display font-black text-amber-300 text-sm">#${allTime.rank}</div>
                  </div>
                `
                : `
                  <div>
                    <div class="text-[10px] text-slate-400">PKT S${state.season || 56}</div>
                    <div class="font-display font-black text-white text-sm">${row.PKT}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">WIN %</div>
                    <div class="font-display font-black text-emerald-400 text-sm">${row.winRate}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">CZYSTE KONTA</div>
                    <div class="font-display font-black text-emerald-300 text-sm">🧤 ${row.cleanSheets}</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-slate-400">ALL-TIME</div>
                    <div class="font-display font-black text-amber-300 text-sm">#${allTime.rank}</div>
                  </div>
                `}
            </div>
          </div>

          ${window.SMPL_SECURITY && typeof window.SMPL_SECURITY.renderProfileTrustCardHtml === 'function' ? window.SMPL_SECURITY.renderProfileTrustCardHtml() : ''}

          <!-- Raport Mentalny, Ulubiony Rywal i Nemezis / Analiza Kariery -->
          <div class="glass-panel rounded-2xl p-5 mt-5 border border-white/10 space-y-3 text-xs">
            <h3 class="font-display font-black text-sm uppercase text-amber-300 tracking-wider border-b border-white/10 pb-2">
              📊 ${isArchOnly ? 'Raport Skautingowy z Archiwum S1–S55' : 'Raport Analityczny z Arkusza SMPL'}
            </h3>
            <div class="flex items-start justify-between gap-2">
              <span class="text-slate-400">⚡ Styl Gry:</span>
              <span class="font-bold text-white text-right">${escapeHtml(utData.playstyle)}</span>
            </div>
            <div class="flex items-start justify-between gap-2">
              <span class="text-slate-400">${isArchOnly || Number(row.M || 0) === 0 ? '🌟 Szczyt Kariery:' : '👑 Ulubiony Rywal:'}</span>
              <span class="font-bold text-emerald-400 text-right">${escapeHtml(utData.favoriteRival)}</span>
            </div>
            <div class="flex items-start justify-between gap-2">
              <span class="text-slate-400">${isArchOnly || Number(row.M || 0) === 0 ? '⚽ Rekord / Bilans:' : '💀 Nemezis (Trudny Rywal):'}</span>
              <span class="font-bold text-rose-400 text-right">${escapeHtml(utData.nemesis)}</span>
            </div>
            <div class="flex items-start justify-between gap-2">
              <span class="text-slate-400">${isArchOnly || Number(row.M || 0) === 0 ? '⏳ Przebieg Kariery:' : '🔥 Aktualna Seria:'}</span>
              <span class="font-bold text-amber-300 text-right">${escapeHtml(utData.streakText)}</span>
            </div>
            <div class="p-3 rounded-xl bg-slate-950/90 border border-white/10 text-slate-200 italic">
              💬 „${escapeHtml(utData.mentalReport)}”
            </div>
          </div>
        </div>

        <!-- PRAWA KOLUMNA: GABLOTA TROFEÓW, STATYSTYKI WSZECH CZASÓW I TERMINARZ DOM/WYJAZD -->
        <div class="lg:col-span-7 space-y-6">
          <!-- 1. KOMPAKTOWA GABLOTA TROFEÓW SEZONOWYCH Z SUWAKIEM (TYLKO KONKRETNE SEZONY, ZERO DUPLIKATÓW) -->
          <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-amber-400/30">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-white/10">
              <div>
                <h3 id="smpl-trophy-vault-heading" class="font-display font-black text-sm sm:text-base text-white uppercase flex items-center gap-2">
                  <span>🏆 Gablota Trofeów Sezonowych (${trophies.length})</span>
                </h3>
                <p class="text-[11px] text-slate-400">
                  Wyłącznie konkretne sezony S1–S${state.season || 56} — zero zbiorczych duplikatów (przewiń suwakiem poniżej)
                </p>
              </div>
              <div class="flex items-center gap-1.5 text-[11px] font-display font-bold">
                <span class="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40">👑 ${allTime.gold || 0}x</span>
                <span class="px-2 py-0.5 rounded-lg bg-slate-300/20 text-slate-200 border border-slate-300/40">🥈 ${allTime.silver || 0}x</span>
                <span class="px-2 py-0.5 rounded-lg bg-amber-700/30 text-amber-400 border border-amber-600/40">🥉 ${allTime.bronze || 0}x</span>
              </div>
            </div>

            ${
              trophies.length > 4
                ? `
                  <div class="smpl-trophy-slider-bar">
                    <label for="smpl-trophy-vault-range" class="text-[10px] font-display font-black uppercase text-amber-300 whitespace-nowrap">🎚️ Suwak (${trophies.length}):</label>
                    <button type="button" onclick="SMPL_APP.stepTrophyVaultScroll(-130)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 text-[10px] font-black" aria-label="Przewiń trofea w górę">▲</button>
                    <input
                      type="range"
                      id="smpl-trophy-vault-range"
                      min="0"
                      max="100"
                      value="0"
                      oninput="SMPL_APP.handleTrophyVaultSlider(this.value)"
                      class="smpl-trophy-range-input"
                    />
                    <button type="button" onclick="SMPL_APP.stepTrophyVaultScroll(130)" class="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 text-[10px] font-black" aria-label="Przewiń trofea w dół">▼</button>
                    <span id="smpl-trophy-vault-pct" class="text-[10px] font-mono-num text-slate-300 w-9 text-right">0%</span>
                  </div>
                `
                : ''
            }

            ${
              trophies.length === 0
                ? `<div class="py-5 px-3 rounded-xl bg-slate-950/75 border border-white/10 text-center text-xs text-slate-400">
                     Brak trofeów podium (miejsca 1–3) lub nagród indywidualnych w rozegranych sezonach.
                   </div>`
                : `<div
                     id="smpl-trophy-vault-scroller"
                     tabindex="0"
                     role="region"
                     aria-labelledby="smpl-trophy-vault-heading"
                     onscroll="SMPL_APP.handleTrophyVaultScroll(this)"
                     class="smpl-trophy-vault-scroller"
                   >
                     <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                       ${trophies
                         .map((t) => {
                           const borderCls =
                             t.rarity === 'LEGENDARY'
                               ? 'border-amber-400 bg-gradient-to-r from-amber-500/20 to-slate-950'
                               : t.rarity === 'GOLD'
                               ? 'border-yellow-500/50 bg-slate-950/90'
                               : 'border-white/15 bg-slate-950/75';
                           return `
                             <div class="p-2.5 rounded-xl border ${borderCls} flex items-center gap-2.5 shadow">
                               <div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
                                 ${t.icon || '🏆'}
                               </div>
                               <div class="min-w-0">
                                 <div class="font-display font-bold text-xs text-white leading-snug">${escapeHtml(t.title)}</div>
                                 <div class="text-[10px] text-amber-300 font-bold mt-0.5">${escapeHtml(t.season)}</div>
                               </div>
                             </div>
                           `;
                         })
                         .join('')}
                     </div>
                   </div>`
            }
          </div>

          ${(() => {
            const pS55 = (window.SMPL_DB && typeof window.SMPL_DB.findPlayerS55Record === 'function')
              ? window.SMPL_DB.findPlayerS55Record(state, p)
              : null;
            const s55M = (pS55 && pS55.inProgress) ? Number(pS55.M || 0) : 0;
            const s55W = (pS55 && pS55.inProgress) ? Number(pS55.W || 0) : 0;
            const s55R = (pS55 && pS55.inProgress) ? Number(pS55.R || 0) : 0;
            const s55P = (pS55 && pS55.inProgress) ? Number(pS55.P || 0) : 0;
            const s55BZ = (pS55 && pS55.inProgress) ? Number(pS55.BZ || 0) : 0;
            const totHistM = (allTime.matches || 0) + s55M + row.M;
            const totHistW = (allTime.wins || 0) + s55W + row.W;
            const totHistR = (allTime.draws || 0) + s55R + row.R;
            const totHistP = (allTime.losses || 0) + s55P + row.P;
            const totHistGF = (allTime.gf || 0) + s55BZ + row.BZ;

            const s55CardHtml = (pS55 && pS55.M > 0)
              ? `
                <!-- 1B. OBECNE WYNIKI W SEZONIE 55 (PÓŁMETEK — AUTO-PODPIĘTE DO KONTA) -->
                <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/40 bg-amber-500/5">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-amber-400/20">
                    <div>
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-display font-black uppercase tracking-wider text-amber-300">
                        ⏳ SEZON 55 W TRAKCIE (PÓŁMETEK) • AUTO-PODPIĘTE DO KONTA
                      </span>
                      <h3 class="font-display font-black text-base text-white uppercase mt-1.5">
                        📊 Obecny Wynik w Sezonie 55 — ${escapeHtml(pS55.leagueLabel)}
                      </h3>
                    </div>
                    <button type="button" onclick="SMPL_APP.setArchiveMode('SEASONS'); SMPL_APP.setArchiveSeason(55); SMPL_APP.setArchiveLeague('${pS55.leagueId}'); SMPL_APP.switchTab('archive');" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-display font-bold text-[11px] uppercase transition">
                      Tabela S55 →
                    </button>
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div class="p-2.5 rounded-xl bg-slate-950/90 border border-amber-400/30">
                      <div class="text-[10px] text-slate-400 uppercase">Pozycja &amp; Punkty</div>
                      <div class="font-display font-black text-lg text-amber-300 mt-0.5">#${pS55.pos} <span class="text-white">• ${pS55.PKT} pkt</span></div>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-950/90 border border-white/10">
                      <div class="text-[10px] text-slate-400 uppercase">Mecze (W-R-P)</div>
                      <div class="font-display font-black text-sm text-emerald-300 mt-1">${pS55.M}M • ${pS55.W}-${pS55.R}-${pS55.P}</div>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-950/90 border border-white/10">
                      <div class="text-[10px] text-slate-400 uppercase">Bramki (+/-)</div>
                      <div class="font-display font-black text-sm text-white mt-1">${pS55.BZ}:${pS55.BS} <span class="${pS55.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}">(${pS55.diff >= 0 ? '+' + pS55.diff : pS55.diff})</span></div>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-950/90 border border-white/10">
                      <div class="text-[10px] text-slate-400 uppercase">Czyste Konta</div>
                      <div class="font-display font-black text-lg text-emerald-300 mt-0.5">🧤 ${pS55.cs}/${pS55.csMatches}</div>
                    </div>
                  </div>
                  ${pS55.note ? `<div class="mt-2.5 text-xs text-amber-200/95 font-semibold">${escapeHtml(pS55.note)}</div>` : ''}
                </div>
              `
              : '';

            return `
              ${s55CardHtml}
              <!-- 2. DOROBEK WSZECH CZASÓW (ALL-TIME S1–S55) -->
              <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
                <div class="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-white/10">
                  <h3 class="font-display font-black text-base text-white uppercase">
                    🏛️ Dorobek Historyczny w Score Match Liga (Cała Historia S1–S55)
                  </h3>
                  <div class="flex flex-wrap items-center gap-1.5">
                    ${s55M > 0 ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-bold text-emerald-300">+${s55M}M / +${s55BZ} goli z S55</span>` : ''}
                    ${
                      p.historicalArchiveName
                        ? `<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold text-amber-300">
                             🏛️ Połączono z archiwum: ${escapeHtml(p.historicalArchiveName)}
                           </span>`
                        : ''
                    }
                  </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div class="text-[10px] text-slate-400 uppercase">Ukończone Sezony</div>
                    <div class="font-display font-black text-xl text-white mt-0.5">${allTime.seasons || 1}</div>
                  </div>
                  <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div class="text-[10px] text-slate-400 uppercase">Mecze w Historii</div>
                    <div class="font-display font-black text-xl text-blue-400 mt-0.5">${totHistM}</div>
                  </div>
                  <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div class="text-[10px] text-slate-400 uppercase">Gole w Historii</div>
                    <div class="font-display font-black text-xl text-amber-400 mt-0.5">⚽ ${totHistGF}</div>
                  </div>
                  <div class="p-3 rounded-xl bg-slate-950 border border-white/10">
                    <div class="text-[10px] text-slate-400 uppercase">Punkty All-Time</div>
                    <div class="font-display font-black text-xl text-emerald-400 mt-0.5">${(allTime.total || 0) + row.PKT}</div>
                  </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5 text-center text-xs">
                  <div class="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                    <div class="text-[10px] text-slate-400 uppercase">Bilans W-R-P</div>
                    <div class="font-bold text-white mt-0.5">${totHistW}-${totHistR}-${totHistP}</div>
                  </div>
                  <div class="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                    <div class="text-[10px] text-slate-400 uppercase">Skuteczność</div>
                    <div class="font-bold text-emerald-300 mt-0.5">${
                      totHistM > 0
                        ? ((totHistW / totHistM) * 100).toFixed(1)
                        : '0.0'
                    }%</div>
                  </div>
                  <div class="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                    <div class="text-[10px] text-slate-400 uppercase">Najlepsza pozycja</div>
                    <div class="font-bold text-amber-300 truncate mt-0.5">${escapeHtml(allTime.bestPos || '-')}</div>
                  </div>
                  <div class="p-2.5 rounded-xl bg-slate-950/70 border border-white/5">
                    <div class="text-[10px] text-slate-400 uppercase">Medale (S1–S54)</div>
                    <div class="font-bold text-white mt-0.5">👑${allTime.gold || 0} 🥈${allTime.silver || 0} 🥉${allTime.bronze || 0}</div>
                  </div>
                </div>
                ${renderPlayerSeasonsHistorySnippet(state, p.name, p.historicalArchiveName)}
              </div>
            `;
          })()}

          ${!isArchOnly
            ? `
              <!-- 3. INDYWIDUALNY TERMINARZ GRACZA (🏠 DOM — TY ZAPRASZASZ vs ✈️ WYJAZD) -->
              <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
                <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
                  <div>
                    <h3 class="font-display font-black text-base text-white uppercase">
                      📅 Twoje Najbliższe Mecze (4 Kolejki na Tydzień)
                    </h3>
                    <p class="text-xs text-slate-400">
                      Pamiętaj: gdy masz <strong>🏠 DOM</strong>, to Ty wysyłasz zaproszenie do meczu rywalowi!
                    </p>
                  </div>
                </div>
                <div class="space-y-2">
                  ${
                    utData.upcomingMatches.length === 0
                      ? `<div class="text-xs text-slate-400 py-4 text-center">Wszystkie zaplanowane mecze zostały rozegrane!</div>`
                      : utData.upcomingMatches
                          .map(
                            (um) => `
                              <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div class="flex items-center gap-2.5">
                                  <span class="px-2 py-0.5 rounded bg-white/10 font-display font-bold text-white">K${um.round} (Tydz. ${um.week})</span>
                                  <span class="px-2 py-0.5 rounded font-bold ${
                                    um.isHome
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                  }">${um.roleLabel}</span>
                                  <span class="text-white font-bold">vs ${escapeHtml(um.opponentName)} (@${escapeHtml(um.opponentNick)})</span>
                                </div>
                                <div>
                                  ${
                                    um.status === 'PENDING'
                                      ? `<span class="text-amber-300 font-bold">⏳ Czeka na Admina (${um.score})</span>`
                                      : `<button onclick="SMPL_APP.prefillMatchSubmission('${um.matchId}')" class="btn-league px-2.5 py-1 rounded-lg text-[11px] font-display uppercase">➕ Wpisz wynik</button>`
                                  }
                                </div>
                              </div>
                            `
                          )
                          .join('')
                  }
                </div>
              </div>
            `
            : ''}
        </div>
      </div>

      ${renderDeepArchiveCareerDossierHtml(state, utData, unifiedCatalog, profileState && profileState.comparePlayerId)}

      <!-- KAMIENIE MILOWE & TRAJEKTORIA KARIERY S1-S55 -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div class="lg:col-span-6 glass-panel rounded-2xl p-5 border border-white/10">
          <div class="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
            <h3 class="font-display font-black text-sm sm:text-base uppercase text-amber-300">
              🏅 Kamienie Milowe &amp; Odznaki (${utAchievements.unlockedCount}/${utAchievements.totalCount})
            </h3>
            <span class="text-[11px] font-display uppercase tracking-wider text-amber-200/80">Hardcore Wyzwania SMPL</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            ${(utAchievements.items || []).map((ac) => {
              const pct = Math.max(0, Math.min(100, Number(ac.pct != null ? ac.pct : (ac.done ? 100 : 0))));
              const isMythic = ac.tier === 'MYTHIC';
              const isLegend = ac.tier === 'LEGEND';
              const tierLabel = isMythic ? 'MITYCZNY' : (isLegend ? 'LEGENDA' : (ac.tier === 'ELITA' ? 'ELITA' : (ac.tier === 'WETERAN' ? 'WETERAN' : 'SEZON')));
              const tierCls = isMythic
                ? 'bg-purple-500/20 text-purple-300 border-purple-400/40'
                : isLegend
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                : ac.tier === 'ELITA'
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                : ac.tier === 'WETERAN'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                : 'bg-slate-800/80 text-slate-300 border-white/15';
              const barBg = ac.done
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : isMythic
                ? 'linear-gradient(90deg, #9333ea, #c084fc)'
                : isLegend
                ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                : 'linear-gradient(90deg, #0284c7, #38bdf8)';
              return `
                <div class="p-2.5 rounded-xl border flex flex-col justify-between ${ac.done ? (isMythic ? 'bg-purple-500/15 border-purple-400/55 text-white' : 'bg-amber-500/15 border-amber-400/50 text-white') : 'bg-slate-950/75 border-white/10 text-slate-400'}">
                  <div>
                    <div class="flex items-center justify-between gap-1 text-[11px] font-display font-bold leading-tight">
                      <span>${ac.icon} ${escapeHtml(ac.title)}</span>
                      <span>${ac.done ? '✅' : '🔒'}</span>
                    </div>
                    <div class="mt-1">
                      <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-display font-black uppercase tracking-wider border ${tierCls}">${tierLabel}</span>
                    </div>
                    <div class="text-[10px] mt-1 leading-snug ${ac.done ? 'text-slate-200' : 'text-slate-400'}">${escapeHtml(ac.desc)}</div>
                  </div>
                  <div class="mt-2">
                    <div class="flex items-center justify-between gap-1 text-[10px] font-mono-num ${ac.done ? 'text-emerald-300 font-bold' : 'text-slate-300'}">
                      <span class="truncate">${escapeHtml(ac.progress || '')}</span>
                      <span class="shrink-0">${pct}%</span>
                    </div>
                    <div class="w-full h-1.5 rounded-full bg-slate-800/90 overflow-hidden mt-1">
                      <div class="h-full rounded-full" style="width: ${pct}%; background: ${barBg};"></div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="lg:col-span-6 glass-panel rounded-2xl p-5 border border-white/10">
          <div class="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-white/10">
            <h3 class="font-display font-black text-sm sm:text-base uppercase text-blue-300">
              📈 Trajektoria Kariery S1–S55 (${utTrajectory.points.length} sezonów)
            </h3>
            <span class="text-xs text-slate-400">Wszystkie ligi L1–L9</span>
          </div>
          ${
            utTrajectory.points.length > 0 && window.SMPL_STUDIO && typeof window.SMPL_STUDIO.renderCareerTrajectorySvg === 'function'
              ? `<div class="smpl-career-chart-wrap p-3">
                   ${window.SMPL_STUDIO.renderCareerTrajectorySvg(utTrajectory.points)}
                 </div>
                 <div class="text-[11px] text-slate-400 mt-2">
                   Kliknij „Archiwum S1–S55 → Kariera Zawodnika”, aby przejrzeć pełną tabelę wszystkich ${utTrajectory.points.length} historycznych sezonów.
                 </div>`
              : `<div class="p-6 text-center text-xs text-slate-400">Brak archiwalnych sezonów S1–S55 powiązanych z tym profilem (debiutant lub profil wymaga powiązania historycznego w Panelu Admina).</div>`
          }
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 6. PLEBISCYT ZŁOTA PIŁKA SMPL (GŁOSOWANIE GRACZY NA MVP SEZONU 55)
  // =========================================================================
  function renderGoldenBallView(state, gbFormState, session) {
    const gbData = window.SMPL_ENGINE.calculateGoldenBallStandings(state);
    const top3 = gbData.candidates.slice(0, 3);
    const isAdmin = Boolean(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'));
    const voteStatus = (window.SMPL_DB && typeof window.SMPL_DB.getGoldenBallVoteStatus === 'function')
      ? window.SMPL_DB.getGoldenBallVoteStatus(session)
      : {
          isLoggedIn: Boolean(session && !session.isGuest && (session.isPlayerAuthenticated || isAdmin)),
          isAdmin: isAdmin,
          isOpen: !(state.goldenBall && state.goldenBall.isOpen === false),
          actor: { actorName: (gbFormState && gbFormState.voterName) || '' },
          myVote: null,
          hasVoted: false,
          blockedSelfPlayerId: (!isAdmin && session && session.activePlayerId) ? session.activePlayerId : null,
          canVote: true
        };
    const isLoggedIn = Boolean(voteStatus.isLoggedIn);
    const winnerId = state.goldenBall && state.goldenBall.winnerPlayerId;
    const winnerPlayer = winnerId ? state.players.find((p) => p.id === winnerId) : null;

    const eligibleOptionsList = gbData.candidates
      .slice()
      .sort((a, b) => (b.meritScore !== a.meritScore ? b.meritScore - a.meritScore : b.PKT - a.PKT))
      .filter((c) => !voteStatus.blockedSelfPlayerId || c.playerId !== voteStatus.blockedSelfPlayerId);

    const selectedCandId = eligibleOptionsList.some((c) => c.playerId === (gbFormState && gbFormState.candidateId))
      ? gbFormState.candidateId
      : (eligibleOptionsList[0] ? eligibleOptionsList[0].playerId : '');

    const candidateOptions = eligibleOptionsList
      .map(
        (c) =>
          `<option value="${c.playerId}" ${selectedCandId === c.playerId ? 'selected' : ''}>[${c.leagueId}] ${escapeHtml(c.name)} (@${escapeHtml(c.nick)}) • SI ${c.meritScore}/100 • ${c.PKT} PKT</option>`
      )
      .join('');

    const voterDisplayName = (voteStatus.actor && voteStatus.actor.actorName) || (gbFormState && gbFormState.voterName) || '';
    const blockedCount = Number(gbData.filteredDuplicateVotes || 0) + Number(gbData.filteredSelfVotes || 0);
    const aiTop = gbData.aiTopMerit || null;
    const fanTop = gbData.fanLeader || null;
    const overallTop = gbData.overallLeader || null;
    const topBd = (aiTop && aiTop.aiBreakdown) || { pointsPower: 0, attackPower: 0, defensePower: 0, formConsistency: 0, fairPlayScore: 0 };

    return `
      <!-- Banner Plebiscytu Złota Piłka SMPL -->
      <div class="goldenball-showcase-banner rounded-3xl p-5 sm:p-7 mb-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span class="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-display font-black text-xs uppercase tracking-widest">
              🏆⚽ OFICJALNY PLEBISCYT SCORE MATCH LIGA (SEZON ${(state.goldenBall && state.goldenBall.season) || state.season || 56})
            </span>
            <h2 class="font-display font-black text-2xl sm:text-3xl text-white uppercase mt-2">
              Złota Piłka — Ranking SI & Społeczności
            </h2>
            <p class="text-xs sm:text-sm text-slate-200 mt-1 max-w-3xl">
              Nowe, sprawiedliwe zasady Złotej Piłki (Sezon ${(state.goldenBall && state.goldenBall.season) || state.season || 56}): ranking łączy <strong>analitykę boiskową SI (${gbData.meritWeightPct}%)</strong> z <strong>głosami graczy (${gbData.voteWeightPct}%)</strong>. Obowiązuje ścisły limit: <strong>1 gracz = 1 głos</strong> oraz <strong>zakaz głosowania na siebie</strong>!
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div class="px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-amber-400/40 text-center">
              <div class="text-[10px] font-display uppercase text-slate-400">Ważnych głosów (1/1)</div>
              <div class="font-display font-black text-2xl text-amber-300">${gbData.totalVotes}</div>
              ${blockedCount > 0 ? `<div class="text-[10px] text-emerald-400 font-bold">🛡️ Odrzucono ${blockedCount} dupl./auto</div>` : ''}
            </div>
            ${
              isAdmin
                ? `<button onclick="SMPL_APP.handleAdminAwardGoldenBall()" class="btn-league px-4 py-3 rounded-2xl text-xs font-display font-black uppercase shadow-xl">
                     👑 Wręcz Złotą Piłkę Liderowi (#1)
                   </button>`
                : ''
            }
          </div>
        </div>
        ${
          winnerPlayer
            ? `<div class="mt-4 p-3.5 rounded-2xl bg-amber-400/20 border border-amber-400 text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-2">
                 <span>👑 OFICJALNY LAUREAT ZŁOTEJ PIŁKI SCORE MATCH LIGA: <strong>${escapeHtml(winnerPlayer.name)} (@${escapeHtml(winnerPlayer.nick)})</strong>! Trofeum zostało dopisane do Gabloty Gracza.</span>
               </div>`
            : ''
        }
      </div>

      <!-- Werdykt SI & Matematyczna Analityka Zasług Boiskowych -->
      <div class="glass-panel rounded-3xl p-5 sm:p-6 mb-6 border border-sky-500/40 bg-slate-950/90">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 pb-3 border-b border-white/10">
          <div>
            <div class="text-[11px] font-display uppercase tracking-widest text-sky-300 font-bold">🤖 Analityka Boiskowa SI • Kto Najbardziej Zasługuje na Złotą Piłkę?</div>
            <h3 class="font-display font-black text-lg text-white mt-0.5">Model Oceny Zasług MVP (0–100 pkt)</h3>
            <p class="text-[11px] text-slate-400">Wagi obliczeń: Dominacja i Liga (34%) • Atak BZ/M (22%) • Obrona & CK (18%) • Forma (16%) • Fair Play (10%). Poziom L1 ma pełny mnożnik ×1.00.</p>
          </div>
          <button
            type="button"
            onclick="SMPL_APP.handleGoldenBallAiAnalysis()"
            class="px-4 py-2.5 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/40 text-sky-300 font-display font-black text-xs uppercase shadow-lg transition shrink-0"
          >
            ${gbFormState && gbFormState.aiAnalysisLoading ? '⏳ Vanessa analizuje statystyki...' : '🤖 Poproś Vanessę AI o pełny werdykt'}
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-2xl bg-slate-950/85 border border-amber-400/40">
            <div class="text-[10px] font-display uppercase text-amber-300 font-bold">👑 Lider Łączny Złotej Piłki</div>
            ${
              overallTop
                ? `<div class="flex items-center justify-between gap-2 mt-2">
                     <div>
                       <div class="font-display font-black text-base text-white">${escapeHtml(overallTop.name)}</div>
                       <div class="text-[11px] text-slate-400">${overallTop.leagueId} Poz. #${overallTop.leaguePos} • ${overallTop.PKT} PKT</div>
                     </div>
                     <div class="text-right">
                       <div class="font-display font-black text-2xl text-amber-300 font-mono-num">${overallTop.finalScore}</div>
                       <div class="text-[10px] text-slate-400">SI ${overallTop.meritScore} • ${overallTop.votes} gł.</div>
                     </div>
                   </div>`
                : '<div class="text-xs text-slate-400 mt-2">Brak aktywnych kandydatów w sezonie.</div>'
            }
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/85 border border-sky-500/40">
            <div class="text-[10px] font-display uppercase text-sky-300 font-bold">🧠 #1 Najlepsze Statystyki (SI)</div>
            ${
              aiTop
                ? `<div class="flex items-center justify-between gap-2 mt-2">
                     <div>
                       <div class="font-display font-black text-base text-white">${escapeHtml(aiTop.name)}</div>
                       <div class="text-[11px] text-emerald-400 font-bold">${aiTop.M}M • ${aiTop.ppg} PKT/M • ${aiTop.cleanSheets} CK</div>
                     </div>
                     <div class="text-right">
                       <div class="font-display font-black text-2xl text-sky-300 font-mono-num">${aiTop.meritScore}</div>
                       <div class="text-[10px] text-slate-400">/ 100 SI</div>
                     </div>
                   </div>
                   <div class="mt-2.5 grid grid-cols-5 gap-1 text-center text-[10px]">
                     <div class="p-1 rounded bg-slate-900"><div class="text-slate-400">PKT</div><div class="font-bold text-amber-300">${topBd.pointsPower}</div></div>
                     <div class="p-1 rounded bg-slate-900"><div class="text-slate-400">ATA</div><div class="font-bold text-rose-300">${topBd.attackPower}</div></div>
                     <div class="p-1 rounded bg-slate-900"><div class="text-slate-400">DEF</div><div class="font-bold text-sky-300">${topBd.defensePower}</div></div>
                     <div class="p-1 rounded bg-slate-900"><div class="text-slate-400">FOR</div><div class="font-bold text-emerald-300">${topBd.formConsistency}</div></div>
                     <div class="p-1 rounded bg-slate-900"><div class="text-slate-400">FP</div><div class="font-bold text-white">${topBd.fairPlayScore}</div></div>
                   </div>`
                : '<div class="text-xs text-slate-400 mt-2">Oczekiwanie na pierwsze mecze.</div>'
            }
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/85 border border-emerald-400/40">
            <div class="text-[10px] font-display uppercase text-emerald-300 font-bold">🗳️ Lider Głosów Kibiców (1/1)</div>
            ${
              fanTop
                ? `<div class="flex items-center justify-between gap-2 mt-2">
                     <div>
                       <div class="font-display font-black text-base text-white">${escapeHtml(fanTop.name)}</div>
                       <div class="text-[11px] text-slate-400">${fanTop.leagueId} • SI ${fanTop.meritScore}/100</div>
                     </div>
                     <div class="text-right">
                       <div class="font-display font-black text-2xl text-emerald-300 font-mono-num">${fanTop.votes}</div>
                       <div class="text-[10px] text-slate-400">${fanTop.votePct}% ważnych</div>
                     </div>
                   </div>`
                : '<div class="text-xs text-slate-400 mt-2">Brak ważnych głosów społeczności — głosuj poniżej!</div>'
            }
          </div>
        </div>

        ${
          gbFormState && gbFormState.aiAnalysisText
            ? `<div id="gb-ai-report-box" class="mt-4 p-4 rounded-2xl bg-slate-950/95 border border-sky-500/40 text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                 <div class="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-white/10">
                   <span class="font-display font-black text-xs uppercase text-sky-300">💋 Werdykt Analityczny — ${escapeHtml(gbFormState.aiAnalysisSource || 'Silnik Analityczny SMPL')}</span>
                 </div>
                 ${escapeHtml(gbFormState.aiAnalysisText)}
               </div>`
            : ''
        }
      </div>

      <!-- Podium Top 3 Złotej Piłki (Ranking Łączny) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        ${top3
          .map((c, idx) => {
            const labels = ['👑 #1 FAWORYT ZŁOTEJ PIŁKI', '🥈 #2 DRUGIE MIEJSCE', '🥉 #3 TRZECIE MIEJSCE'];
            const borders = ['border-amber-400', 'border-slate-300', 'border-amber-700'];
            const podCards = ['smpl-podium-card smpl-podium-gold smpl-podium-1', 'smpl-podium-card smpl-podium-silver smpl-podium-2', 'smpl-podium-card smpl-podium-bronze smpl-podium-3'];
            const crownBadges = ['smpl-crown-pill smpl-crown-gold', 'smpl-crown-pill smpl-crown-silver', 'smpl-crown-pill smpl-crown-bronze'];
            return `
              <div onclick="SMPL_APP.openPlayerProfileTab('${c.playerId}')" class="${podCards[idx]} p-5">
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span class="${crownBadges[idx]}">${labels[idx]}</span>
                  <span class="font-display font-black text-xl text-amber-300 font-mono-num">${c.finalScore} pkt</span>
                </div>
                <div class="flex items-center gap-3.5">
                  <img src="${c.avatar}" class="w-16 h-16 rounded-full object-cover border-2 ${borders[idx]} shadow-xl" alt=""/>
                  <div>
                    <div class="font-display font-black text-base text-white">${escapeHtml(c.name)}</div>
                    <div class="text-xs text-slate-300">@${escapeHtml(c.nick)} • ${c.leagueId} (Poz. #${c.leaguePos})</div>
                    <div class="text-xs text-sky-300 font-bold mt-1">🤖 SI: ${c.meritScore}/100 • 🗳️ ${c.votes} gł. (${c.votePct}%)</div>
                    <div class="text-[11px] text-emerald-400 font-bold mt-0.5">${c.PKT} PKT • ⚽ ${c.BZ} Goli • 🧤 ${c.cleanSheets} CK</div>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>

      <!-- Formularz oddania głosu + Ranking i ostatnie głosy -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Formularz głosowania -->
        <div class="lg:col-span-5 glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/40">
          <h3 class="font-display font-black text-lg text-white uppercase mb-1">
            🗳️ Twój Głos (Limit: 1 Gracz = 1 Głos)
          </h3>
          <p class="text-xs text-slate-400 mb-4">
            Każdy zalogowany zawodnik może oddać <strong>tylko 1 głos</strong> w sezonie i nie może głosować na samego siebie.
          </p>

          ${
            !isLoggedIn
              ? `<div class="p-4 rounded-xl bg-slate-950/90 border border-amber-400/30 text-center space-y-3">
                   <div class="text-2xl">🔒</div>
                   <div class="text-xs font-bold text-amber-300 uppercase">Tryb Gościa — Głosowanie Zablokowane</div>
                   <p class="text-xs text-slate-300 leading-relaxed">
                     Aby wyeliminować wielokrotne głosy i autogłosy, głosować mogą wyłącznie zalogowani zawodnicy SMPL (1 gracz = 1 głos) oraz Administracja.
                   </p>
                   <button type="button" onclick="SMPL_APP.handleGateLock()" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase">
                     🔑 Zaloguj się jako Zawodnik
                   </button>
                 </div>`
              : (!voteStatus.isOpen && !isAdmin)
                ? `<div class="p-4 rounded-xl bg-slate-950/90 border border-rose-400/40 text-center space-y-2">
                     <div class="text-2xl">⏸️</div>
                     <div class="text-xs font-bold text-rose-300 uppercase">Głosowanie Zamknięte przez Zarząd</div>
                     <p class="text-xs text-slate-300">Plebiscyt zakończony — trwa weryfikacja wyników SI i głosów.</p>
                   </div>`
                : voteStatus.hasVoted
                  ? `<div class="p-4 rounded-xl bg-emerald-950/35 border border-emerald-400/40 space-y-2">
                       <div class="flex items-center gap-2 text-xs font-display font-black uppercase text-emerald-300">
                         <span>✅ Twój jedyny głos (1/1) został już oddany</span>
                       </div>
                       <div class="text-sm font-bold text-white">Wybrany kandydat: <span class="text-amber-300">${escapeHtml((voteStatus.myVote && voteStatus.myVote.candidateName) || 'Zawodnik SMPL')}</span></div>
                       ${voteStatus.myVote && voteStatus.myVote.comment ? `<div class="text-xs text-slate-300 italic">„${escapeHtml(voteStatus.myVote.comment)}”</div>` : ''}
                       <div class="text-[11px] text-slate-400 pt-1 border-t border-white/10">Zasada fair play SMPL: każdy gracz może oddać tylko jeden głos w tej edycji.</div>
                     </div>`
                  : `<form onsubmit="SMPL_APP.handleGoldenBallVoteSubmit(event)" class="space-y-4">
                       <div>
                         <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Twój Profil Głosującego (Zablokowany) *</label>
                         <input
                           type="text"
                           id="gb-voter-name"
                           required
                           readonly
                           value="${escapeHtml(voterDisplayName)}"
                           class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-sm text-slate-200 opacity-80"
                         />
                       </div>

                       <div>
                         <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">Wybierz Kandydata do Złotej Piłki SMPL *</label>
                         <select id="gb-candidate-id" class="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-amber-400/60 text-sm text-white font-bold">
                           ${candidateOptions}
                         </select>
                         ${voteStatus.blockedSelfPlayerId ? `<div class="text-[10px] text-slate-400 mt-1">ℹ️ Twoje własne konto zostało ukryte na liście (zakaz głosowania na siebie).</div>` : ''}
                       </div>

                       <div>
                         <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Uzasadnienie głosu (Komentarz)</label>
                         <input
                           type="text"
                           id="gb-vote-comment"
                           maxlength="240"
                           placeholder="np. Dominacja w Ekstraklasie i wysoka skuteczność!"
                           class="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                         />
                       </div>

                       <button type="submit" class="w-full btn-league py-3.5 rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-xl">
                         🏆 Zatwierdź Swój Jedyny Głos (1/1)
                       </button>
                     </form>`
          }

          <!-- Ostatnie głosy społeczności -->
          <div class="mt-6 pt-4 border-t border-white/10">
            <div class="text-xs font-display uppercase text-slate-400 font-bold mb-2.5">💬 Zweryfikowane głosy graczy (1 gracz = 1 głos):</div>
            <div class="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              ${
                gbData.recentVotes.length
                  ? gbData.recentVotes
                      .map(
                        (v) => `
                          <div class="p-3 rounded-xl bg-slate-950/90 border border-white/10 text-xs">
                            <div class="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                              <span>🗳️ ${escapeHtml(v.voterName)} ➔ <strong>${escapeHtml(v.candidateName)}</strong></span>
                              <span class="text-slate-500">${escapeHtml(v.createdAt)}</span>
                            </div>
                            <div class="text-slate-300 italic mt-1">„${escapeHtml(v.comment)}”</div>
                          </div>
                        `
                      )
                      .join('')
                  : '<div class="text-xs text-slate-500 italic">Brak ważnych głosów — ranking opiera się teraz w 100% na obliczeniach boiskowych SI.</div>'
              }
            </div>
          </div>
        </div>

        <!-- Pełna lista rankingowa Złotej Piłki -->
        <div class="lg:col-span-7 glass-panel rounded-2xl p-5 sm:p-6 border border-white/10">
          <h3 class="font-display font-black text-lg text-white uppercase mb-1">
            📊 Ranking Łączny SI & Głosów — Złota Piłka Score Match Liga
          </h3>
          <p class="text-[11px] text-slate-400 mb-4 pb-3 border-b border-white/10">
            Wagi aktywne: <strong>${gbData.meritWeightPct}% Analiza Boiskowa SI</strong> + <strong>${gbData.voteWeightPct}% Głosy Kibiców</strong> (max 1 głos od gracza).
          </p>
          <div class="space-y-3 max-h-[540px] overflow-y-auto pr-1">
            ${gbData.candidates.slice(0, 20).map((c, idx) => `
              <div onclick="SMPL_APP.openPlayerProfileTab('${c.playerId}')" class="cursor-pointer p-3.5 rounded-xl bg-slate-950/85 border border-white/10 hover:border-amber-400/50 transition">
                <div class="flex items-center justify-between gap-3 mb-1.5">
                  <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-xs ${idx === 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'}">${idx + 1}</span>
                    <img src="${c.avatar}" class="w-9 h-9 rounded-full object-cover border border-white/20" alt=""/>
                    <div>
                      <div class="font-bold text-white text-sm">${escapeHtml(c.name)} <span class="text-xs text-slate-400">(@${escapeHtml(c.nick)} • ${c.leagueId} #${c.leaguePos})</span></div>
                      <div class="text-[11px] text-slate-400">${c.M}M • ${c.PKT} PKT (${c.ppg}/M) • ⚽ ${c.BZ} Goli • 🧤 ${c.cleanSheets} CK • 🏆 ${c.trophiesCount}</div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="font-display font-black text-base text-amber-300">${c.finalScore} pkt</div>
                    <div class="text-[11px] text-sky-300 font-bold">SI: ${c.meritScore} • 🗳️ ${c.votes} gł.</div>
                  </div>
                </div>
                <div class="text-[10px] text-slate-300 mb-2">🤖 ${escapeHtml(c.aiVerdict)}</div>
                <div class="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full" style="width: ${Math.max(3, c.finalScore)}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // 7. ZAKŁADKA ARCHIWUM SEZONÓW (S1–S55) & RANKING WSZECH CZASÓW (ALL-TIME Z EXCELA)
  // =========================================================================
  const ARCHIVE_LEAGUE_LABELS = {
    L1: '🏆 Ekstraklasa',
    L2: '🥈 2. Liga',
    L3: '🥉 3. Liga',
    L4: '4. Liga',
    L5: '5. Liga',
    L6: '6. Liga',
    L7: '7. Liga',
    L8: '8. Liga',
    L9: '9. Liga',
    L10: '10. Liga'
  };

  const ARCHIVE_UI_CANON_MAP = {
    'piort pastuszak': 'Piotr Pastuszak',
    'piote pastuszak': 'Piotr Pastuszak',
    'sebastain niezborala': 'Sebastian Niezbora\u0142a',
    'mak herdus': 'Maks Herdu\u015B',
    'maciej maciejewski': 'Maciek Maciejewski',
    'kuba paszkiewicz': 'Jakub Paszkiewicz',
    'michal pelka': 'Micha\u0142 Pe\u0142ka',
    'lukasz papik': '\u0141ukasz Papik'
  };

  function foldArchivePlRaw(str) {
    const map = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
    return String(str || '').trim().toLowerCase().replace(/[ąćęłńóśźż]/g, function (ch) {
      return map[ch] || ch;
    }).replace(/\s+/g, ' ').trim();
  }

  function canonicalizeArchivePlName(str) {
    if (window.SMPL_DB && typeof window.SMPL_DB.canonicalArchiveName === 'function') {
      return window.SMPL_DB.canonicalArchiveName(str);
    }
    const clean = String(str || '').replace(/\s+/g, ' ').trim();
    const fk = foldArchivePlRaw(clean);
    return ARCHIVE_UI_CANON_MAP[fk] || clean;
  }

  function foldArchivePl(str) {
    return foldArchivePlRaw(canonicalizeArchivePlName(str));
  }

  function collectPlayerSeasonsFromArchive(state, playerName, archiveAlias) {
    const targets = [];
    const cleanPrimary = String(playerName || '').trim().toLowerCase();
    const cleanAlias = String(archiveAlias || '').trim().toLowerCase();
    if (cleanPrimary) targets.push(cleanPrimary);
    if (cleanAlias && targets.indexOf(cleanAlias) === -1) targets.push(cleanAlias);
    if (targets.length === 0) return [];

    const foldedTargets = targets.map(foldArchivePl);
    const seasonsList = state.historicalSeasons || [];
    const records = [];
    const seen = {};

    seasonsList.forEach((s) => {
      if (!s.leagues) return;
      Object.keys(s.leagues).forEach((lid) => {
        const rows = s.leagues[lid] || [];
        const match = rows.find((r) => {
          const rn = String(r.name || '').trim().toLowerCase();
          if (!rn) return false;
          if (targets.indexOf(rn) !== -1) return true;
          return foldedTargets.indexOf(foldArchivePl(rn)) !== -1;
        });
        const dedupeKey = s.seasonNumber + '_' + lid;
        if (match && Number(match.M || 0) > 0 && !seen[dedupeKey]) {
          seen[dedupeKey] = true;
          records.push({
            seasonNumber: s.seasonNumber,
            inProgress: Boolean(s.inProgress),
            leagueId: lid,
            leagueLabel: ARCHIVE_LEAGUE_LABELS[lid] || lid,
            pos: match.pos,
            M: match.M,
            W: match.W,
            R: match.R,
            P: match.P,
            BZ: match.BZ,
            BS: match.BS,
            diff: match.diff,
            PKT: match.PKT,
            note: match.note || ''
          });
        }
      });
    });
    return records.sort((a, b) => Number(b.seasonNumber) - Number(a.seasonNumber));
  }

  function renderPlayerSeasonsHistorySnippet(state, playerName, archiveAlias) {
    const lookupName = archiveAlias || playerName;
    const recs = collectPlayerSeasonsFromArchive(state, playerName, archiveAlias);
    if (!recs.length) return '';
    const safeJs = escapeHtml(lookupName).replace(/'/g, "\\'");
    return `
      <div class="mt-4 pt-4 border-t border-white/10">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div class="text-xs font-display font-bold uppercase text-amber-300">
            📜 Pełna Historia Sezon po Sezonie (S1–S55 • ${recs.length} zapisanych sezonów)
          </div>
          <button type="button" onclick="SMPL_APP.openArchivePlayerCareer('${safeJs}')" class="text-[11px] text-blue-300 hover:text-white underline font-semibold">
            Pełna oś kariery w Archiwum →
          </button>
        </div>
        <div class="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/90">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="sticky top-0 bg-slate-950 border-b border-white/15 text-[10px] font-display uppercase text-slate-400">
              <tr>
                <th class="py-2 px-2.5">Sezon</th>
                <th class="py-2 px-2">Liga</th>
                <th class="py-2 px-2 text-center">Poz.</th>
                <th class="py-2 px-2 text-center">M</th>
                <th class="py-2 px-2 text-center text-emerald-400">W</th>
                <th class="py-2 px-2 text-center text-amber-300">R</th>
                <th class="py-2 px-2 text-center text-rose-400">P</th>
                <th class="py-2 px-2 text-center">Bramki</th>
                <th class="py-2 px-2.5 text-center font-bold text-white">PKT</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              ${recs
                .map((rc) => {
                  const posBadge = rc.inProgress
                    ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-300 font-bold">⏳ #' + rc.pos + '</span>'
                    : rc.pos === 1
                    ? '<span class="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-black">👑 #1</span>'
                    : rc.pos === 2
                    ? '<span class="px-1.5 py-0.5 rounded bg-slate-300/20 text-slate-200 font-black">🥈 #2</span>'
                    : rc.pos === 3
                    ? '<span class="px-1.5 py-0.5 rounded bg-amber-700/25 text-amber-400 font-black">🥉 #3</span>'
                    : '<span class="text-slate-300 font-bold">#' + rc.pos + '</span>';
                  return `
                    <tr onclick="SMPL_APP.setArchiveMode('SEASONS'); SMPL_APP.setArchiveSeason(${rc.seasonNumber}); SMPL_APP.setArchiveLeague('${rc.leagueId}'); SMPL_APP.switchTab('archive');" class="hover:bg-white/5 cursor-pointer transition">
                      <td class="py-2 px-2.5 font-display font-bold text-white">S${rc.seasonNumber}${rc.inProgress ? ' <span class="text-[9px] text-amber-300 font-semibold">(w trakcie)</span>' : ''}</td>
                      <td class="py-2 px-2 text-slate-300 font-semibold">${escapeHtml(rc.leagueId)}</td>
                      <td class="py-2 px-2 text-center">${posBadge}</td>
                      <td class="py-2 px-2 text-center text-slate-300">${rc.M}</td>
                      <td class="py-2 px-2 text-center text-emerald-400 font-bold">${rc.W}</td>
                      <td class="py-2 px-2 text-center text-amber-300">${rc.R}</td>
                      <td class="py-2 px-2 text-center text-rose-400">${rc.P}</td>
                      <td class="py-2 px-2 text-center text-slate-300">${rc.BZ}:${rc.BS}</td>
                      <td class="py-2 px-2.5 text-center font-display font-black text-emerald-300">${rc.PKT}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderArchivePointsRankingCard(opts) {
    const rows = opts.rows || [];
    const searchVal = opts.searchVal || '';
    return `
      <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
        <div class="p-4 sm:px-6 border-b border-white/10 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 class="font-display font-black text-base sm:text-lg text-white uppercase">
              ${escapeHtml(opts.title)}
            </h3>
            <p class="text-xs text-slate-400">
              ${escapeHtml(opts.subtitle)}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="SMPL_APP.exportArchiveRankingCsv('${escapeHtml(opts.exportKey || 'ALL_TIME')}')" class="px-3 py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 text-xs font-display font-bold uppercase transition">📊 CSV Excel</button>
            <input type="text" placeholder="🔍 Szukaj gracza..." value="${escapeHtml(searchVal)}" oninput="SMPL_APP.setArchiveSearch(this.value)" class="px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white" />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr class="border-b border-white/10 bg-slate-950/80 text-[11px] font-display uppercase tracking-wider text-slate-400">
                <th class="py-3.5 pl-4 pr-2 text-center w-14">Poz.</th>
                <th class="py-3.5 px-3">Zawodnik</th>
                <th class="py-3.5 px-2 text-center">Sezony</th>
                <th class="py-3.5 px-2 text-center">Mecze</th>
                <th class="py-3.5 px-2 text-center text-emerald-400">W</th>
                <th class="py-3.5 px-2 text-center text-amber-400">R</th>
                <th class="py-3.5 px-2 text-center text-rose-400">P</th>
                <th class="py-3.5 px-2 text-center">Bramki</th>
                <th class="py-3.5 px-2 text-center">Win %</th>
                <th class="py-3.5 px-2 text-center">PKT Meczowe</th>
                <th class="py-3.5 px-3 text-center">Medale (👑 / 🥈 / 🥉)</th>
                <th class="py-3.5 pl-2 pr-4 text-center text-amber-300 font-black bg-amber-400/10">TOTAL PKT</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 text-sm font-mono-num">
              ${rows.map((r) => {
                const badgeCls = r.rank === 1 ? 'bg-amber-400 text-slate-950 font-black' : r.rank === 2 ? 'bg-slate-300 text-slate-950 font-bold' : r.rank === 3 ? 'bg-amber-700 text-white font-bold' : 'bg-slate-800 text-slate-300';
                const safeJsName = escapeHtml(r.name).replace(/'/g, "\\'");
                return `
                  <tr onclick="SMPL_APP.openArchivePlayerCareer('${safeJsName}')" class="hover:bg-white/5 transition cursor-pointer">
                    <td class="py-3 pl-4 pr-2 text-center"><span class="inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-display ${badgeCls}">${r.rank}</span></td>
                    <td class="py-3 px-3 font-sans">
                      <div class="flex items-center justify-between gap-2">
                        <div>
                          <div class="font-bold text-white hover:text-amber-300 transition">${escapeHtml(r.name)}</div>
                          <div class="text-[11px] text-slate-400">Najwyżej: ${escapeHtml(r.bestPos || '-')}</div>
                        </div>
                        <button type="button" onclick="event.stopPropagation(); SMPL_APP.openArchiveUtCard('${safeJsName}')" class="px-2 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400 text-amber-200 hover:text-slate-950 border border-amber-400/45 text-[10px] font-display font-black uppercase flex-shrink-0 transition">
                          🎴 Karta UT
                        </button>
                      </div>
                    </td>
                    <td class="py-3 px-2 text-center text-slate-300 font-bold">${r.seasons}</td>
                    <td class="py-3 px-2 text-center text-slate-200">${r.matches}</td>
                    <td class="py-3 px-2 text-center text-emerald-400 font-semibold">${r.wins}</td>
                    <td class="py-3 px-2 text-center text-amber-400">${r.draws}</td>
                    <td class="py-3 px-2 text-center text-rose-400">${r.losses}</td>
                    <td class="py-3 px-2 text-center text-slate-300">${r.gf}:${r.ga} (${r.gd >= 0 ? '+' + r.gd : r.gd})</td>
                    <td class="py-3 px-2 text-center text-blue-300 font-semibold">${r.winPct}%</td>
                    <td class="py-3 px-2 text-center font-bold text-white">${r.points}</td>
                    <td class="py-3 px-3 text-center">
                      <div class="inline-flex items-center gap-2 text-xs font-bold">
                        <span class="text-amber-300">👑 ${r.gold}</span>
                        <span class="text-slate-300">🥈 ${r.silver}</span>
                        <span class="text-amber-600">🥉 ${r.bronze}</span>
                      </div>
                    </td>
                    <td class="py-3 pl-2 pr-4 text-center bg-amber-400/5 font-display font-black text-base text-amber-300">${r.total}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderArchiveView(state, archiveState, session) {
    const mode = (archiveState && archiveState.mode) || 'SEASONS'; // 'SEASONS' | 'ALL_TIME' | 'CAREER' | 'GENERAL' | 'FIVE_SEASONS' | 'PLAYER_HISTORY'
    const allTimeList = state.allTimeRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.ALL_TIME_RANKING) || [];
    const careerList = state.careerRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.CAREER_RANKING) || [];
    const generalList = state.generalRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.GENERAL_RANKING) || [];
    const fiveSeasonList = state.fiveSeasonRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.FIVE_SEASON_RANKING) || [];
    const seasonsList = state.historicalSeasons || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.HISTORICAL_SEASONS) || [];
    const selectedSeasonNum = (archiveState && archiveState.seasonNumber) || (seasonsList[0] ? seasonsList[0].seasonNumber : 54);
    const seasonGroup = (archiveState && archiveState.seasonGroup) || 'ALL';
    const searchQ = ((archiveState && archiveState.search) || '').trim().toLowerCase();
    const selectedPlayerCareer = (archiveState && archiveState.playerName) || '';
    const isAdmin = Boolean(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'));
    const isLoggedInPlayer = Boolean(session && !session.isGuest && session.isPlayerAuthenticated && session.activePlayerId);

    const filteredAllTime = allTimeList.filter((item) => !searchQ || String(item.name || '').toLowerCase().includes(searchQ));
    const filteredCareer = careerList.filter((item) => !searchQ || String(item.name || '').toLowerCase().includes(searchQ));
    const filteredGeneral = generalList.filter((item) => !searchQ || String(item.name || '').toLowerCase().includes(searchQ));
    const filteredFive = fiveSeasonList.filter((item) => !searchQ || String(item.name || '').toLowerCase().includes(searchQ));

    const activeSeasonObj = seasonsList.find((s) => Number(s.seasonNumber) === Number(selectedSeasonNum)) || seasonsList[0];
    const availableLeagues = activeSeasonObj && activeSeasonObj.leagues
      ? Object.keys(activeSeasonObj.leagues).sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')))
      : ['L1', 'L2', 'L3'];
    const rawSelectedLeague = (archiveState && archiveState.leagueId) || 'L1';
    const selectedLeague = availableLeagues.includes(rawSelectedLeague) ? rawSelectedLeague : (availableLeagues[0] || 'L1');

    const filteredSeasonsList = seasonsList.filter((s) => {
      const n = Number(s.seasonNumber);
      if (seasonGroup === '45_55') return n >= 45;
      if (seasonGroup === '30_44') return n >= 30 && n <= 44;
      if (seasonGroup === '15_29') return n >= 15 && n <= 29;
      if (seasonGroup === '1_14') return n <= 14;
      return true;
    });

    const totalTablesCount = seasonsList.reduce((sum, s) => sum + (s.leagues ? Object.keys(s.leagues).length : 0), 0);

    const allCareerNamesMap = {};
    seasonsList.forEach((s) => {
      if (!s.leagues) return;
      Object.values(s.leagues).forEach((rows) => {
        (rows || []).forEach((r) => {
          const nm = canonicalizeArchivePlName(r.name);
          if (nm && !/^wolny\s*los|^wl\d+$|brak danych/i.test(nm) && nm !== '-' && nm !== '—' && nm !== '...') {
            allCareerNamesMap[nm] = (allCareerNamesMap[nm] || 0) + (Number(r.M || 0) > 0 ? 1 : 0);
          }
        });
      });
    });
    const allCareerPlayers = Object.keys(allCareerNamesMap)
      .filter((nm) => allCareerNamesMap[nm] > 0)
      .sort((a, b) => a.localeCompare(b, 'pl'));
    const activeCareerName = selectedPlayerCareer || (allTimeList[0] ? allTimeList[0].name : allCareerPlayers[0] || 'Michał Wu');
    const careerRecords = mode === 'PLAYER_HISTORY' ? collectPlayerSeasonsFromArchive(state, activeCareerName) : [];
    const utCatalogInArch = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.getUnifiedUtPlayersCatalog === 'function')
      ? window.SMPL_ENGINE.getUnifiedUtPlayersCatalog(state)
      : [];

    return `
      <div class="archive-showcase-banner rounded-3xl p-5 sm:p-7 mb-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span class="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-display font-bold uppercase tracking-widest">
              🏛️ CAŁA HISTORIA SCORE MATCH LIGA • ${seasonsList.length} SEZONÓW • ${totalTablesCount} TABEL LIGOWYCH (L1–L9)
            </span>
            <h2 class="font-display font-black text-2xl sm:text-3xl text-white uppercase mt-2">
              Historia Ligi, Tabele Wszystkich Sezonów &amp; Rankingi Wszech Czasów
            </h2>
            <p class="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Kompletna księga historii Score Match Liga od <strong>Sezonu 1</strong> po dziś — wszystkie dywizje od <strong>Ekstraklasy (L1) do 9. Ligi</strong>, Wyszukiwarka Kart UT (${utCatalogInArch.length} graczy także bez konta!), All-Time (${allTimeList.length}), Pełna Kariera L1–L9 (${careerList.length}) oraz historia każdego zawodnika.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button onclick="SMPL_APP.setArchiveMode('UT_SEARCH')" class="px-3.5 py-2.5 rounded-xl font-display font-black text-xs uppercase transition ${mode === 'UT_SEARCH' ? 'btn-league shadow-lg' : 'bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 border border-amber-400/50'}">
              🎴 Wyszukiwarka Kart UT (${utCatalogInArch.length})
            </button>
            <button onclick="SMPL_APP.setArchiveMode('SEASONS')" class="px-3.5 py-2.5 rounded-xl font-display font-bold text-xs uppercase transition ${mode === 'SEASONS' ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15'}">
              📚 Tabele S1–S55 (${seasonsList.length})
            </button>
            <button onclick="SMPL_APP.setArchiveMode('ALL_TIME')" class="px-3.5 py-2.5 rounded-xl font-display font-bold text-xs uppercase transition ${mode === 'ALL_TIME' ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15'}">
              👑 All-Time Ekstraklasa (${allTimeList.length})
            </button>
            <button onclick="SMPL_APP.setArchiveMode('CAREER')" class="px-3.5 py-2.5 rounded-xl font-display font-bold text-xs uppercase transition ${mode === 'CAREER' ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15'}">
              🏆 Pełna Kariera L1–L9 (${careerList.length})
            </button>
            <button onclick="SMPL_APP.setArchiveMode('GENERAL')" class="px-3.5 py-2.5 rounded-xl font-display font-bold text-xs uppercase transition ${mode === 'GENERAL' ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15'}">
              📈 Ranking Ogólny (${generalList.length})
            </button>
            <button onclick="SMPL_APP.setArchiveMode('FIVE_SEASONS')" class="px-3.5 py-2.5 rounded-xl font-display font-bold text-xs uppercase transition ${mode === 'FIVE_SEASONS' ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15'}">
              🔥 5 Sezonów (${fiveSeasonList.length})
            </button>
            <button onclick="SMPL_APP.setArchiveMode('PLAYER_HISTORY')" class="px-3.5 py-2.5 rounded-xl font-display font-bold text-xs uppercase transition ${mode === 'PLAYER_HISTORY' ? 'btn-league' : 'bg-slate-900 text-slate-300 border border-white/15'}">
              🔎 Kariera Zawodnika
            </button>
            <button type="button" onclick="SMPL_APP.setArchiveMode('RECORDS')" class="px-3.5 py-2.5 rounded-xl font-display font-bold text-xs uppercase transition ${mode === 'RECORDS' ? 'btn-league' : 'bg-slate-900 text-amber-200 border border-amber-400/30'}">
              ⚡ Rekordy S1–S55
            </button>
            ${
              isAdmin
                ? `<button onclick="SMPL_APP.handleArchiveCurrentSeason()" class="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-black text-xs uppercase shadow-xl">
                     📦 Zarchiwizuj Sezon ${state.season || 56}
                   </button>`
                : ''
            }
          </div>
        </div>
      </div>

      ${
        mode === 'UT_SEARCH'
          ? renderUtCardsExplorerSectionHtml(state, archiveState && archiveState.utExplorer, '', true)
          : mode === 'ALL_TIME'
          ? renderArchivePointsRankingCard({
              title: `👑 Oficjalny Ranking Wszech Czasów Ekstraklasy (${filteredAllTime.length} Legend L1)`,
              subtitle: 'Przeliczone wyłącznie ze wszystkich pełnych tabel 1. Ligi (Ekstraklasa L1, S1–S54). Kliknij zawodnika, aby otworzyć pełną karierę L1–L9.',
              rows: filteredAllTime,
              searchVal: archiveState ? archiveState.search || '' : '',
              exportKey: 'ALL_TIME'
            })
          : mode === 'CAREER'
          ? renderArchivePointsRankingCard({
              title: `🏆 Pełny Ranking Kariery — Wszystkie Ligi L1–L9 (${filteredCareer.length} Zawodników)`,
              subtitle: 'Pełne statystyki historyczne przeliczone ze wszystkich rozegranych sezonów (1.–9. Liga, S1–S54). Kliknij zawodnika, aby zobaczyć historię sezon po sezonie.',
              rows: filteredCareer,
              searchVal: archiveState ? archiveState.search || '' : '',
              exportKey: 'CAREER'
            })
          : mode === 'RECORDS'
          ? (() => {
              const recs = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.computeAllTimeSeasonRecords === 'function')
                ? window.SMPL_STUDIO.computeAllTimeSeasonRecords()
                : { bestPointsL1: [], bestGoals: [], bestDefense: [], bestDiff: [], bestWins: [], invincibles: [] };
              const renderRecBlock = (recTitle, recRows, valLabel, valGetter) => `
                <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
                  <div class="p-4 border-b border-white/10 bg-slate-900/60">
                    <h4 class="font-display font-black text-sm text-amber-300 uppercase">${escapeHtml(recTitle)}</h4>
                  </div>
                  <div class="divide-y divide-white/5 text-xs font-mono-num">
                    ${(recRows || []).map((rr, rIdx) => `
                      <div onclick="SMPL_APP.openArchivePlayerCareer('${escapeHtml(rr.name).replace(/'/g, "\\'")}')" class="p-3 hover:bg-white/5 cursor-pointer flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <span class="font-display font-black text-amber-300 mr-1.5">#${rIdx + 1}</span>
                          <span class="font-sans font-bold text-white">${escapeHtml(rr.name)}</span>
                          <span class="text-slate-400 ml-1">(S${rr.seasonNumber} • ${escapeHtml(rr.leagueId)})</span>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-white/10 font-bold text-emerald-300 flex-shrink-0">${escapeHtml(valGetter(rr))} ${escapeHtml(valLabel)}</span>
                      </div>
                    `).join('') || '<div class="p-4 text-slate-400">Brak danych historycznych.</div>'}
                  </div>
                </div>
              `;
              return `
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  ${renderRecBlock('👑 Rekord Punktów w Sezonie Ekstraklasy (L1)', recs.bestPointsL1, 'PKT', (r) => r.PKT)}
                  ${renderRecBlock('⚽ Najlepszy Atak Pojedynczego Sezonu (BZ)', recs.bestGoals, 'goli', (r) => r.BZ)}
                  ${renderRecBlock('🧱 Żelazna Obrona Sezonu (min. 20 meczów)', recs.bestDefense, 'BS', (r) => r.BS + ' str.')}
                  ${renderRecBlock('📈 Najlepszy Bilans Bramek (+/-)', recs.bestDiff, '', (r) => (r.diff >= 0 ? '+' : '') + r.diff)}
                  ${renderRecBlock('🔥 Najwięcej Zwycięstw w Sezonie', recs.bestWins, 'W', (r) => r.W)}
                  ${renderRecBlock('🛡️ Historyczni Niepokonani (0 Porażek, 14+ M)', recs.invincibles, 'M', (r) => r.M + ' (' + r.PKT + ' pkt)')}
                </div>
              `;
            })()
          : mode === 'GENERAL'
          ? `
            <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
              <div class="p-4 sm:px-6 border-b border-white/10 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 class="font-display font-black text-base sm:text-lg text-white uppercase">
                    📈 Ranking Ogólny Wszystkich Lig Score Match Liga (${filteredGeneral.length} Zawodników)
                  </h3>
                  <p class="text-xs text-slate-400">Historyczna klasyfikacja punktowa ze wszystkich dywizji (L1–L9). Kliknij gracza, aby zobaczyć jego sezony.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" onclick="SMPL_APP.exportArchiveRankingCsv('GENERAL')" class="px-3 py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 text-xs font-display font-bold uppercase transition">📊 CSV Excel</button>
                  <input type="text" placeholder="🔍 Szukaj gracza..." value="${escapeHtml(archiveState ? archiveState.search || '' : '')}" oninput="SMPL_APP.setArchiveSearch(this.value)" class="px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white" />
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[740px]">
                  <thead>
                    <tr class="border-b border-white/10 bg-slate-950/80 text-[11px] font-display uppercase text-slate-400">
                      <th class="py-3 pl-4 pr-2 w-14 text-center">Poz.</th>
                      <th class="py-3 px-3">Zawodnik</th>
                      <th class="py-3 px-2 text-center">S1</th>
                      <th class="py-3 px-2 text-center">S5</th>
                      <th class="py-3 px-2 text-center">S10</th>
                      <th class="py-3 px-2 text-center">S13</th>
                      <th class="py-3 px-2 text-center">S14</th>
                      <th class="py-3 px-2 text-center">Strata do #1</th>
                      <th class="py-3 pl-2 pr-4 text-center text-amber-300 font-black bg-amber-400/10">SUMA PKT</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 text-sm font-mono-num">
                    ${filteredGeneral.map((r) => {
                      const safeJsName = escapeHtml(r.name).replace(/'/g, "\\'");
                      return `
                        <tr onclick="SMPL_APP.openArchivePlayerCareer('${safeJsName}')" class="hover:bg-white/5 transition cursor-pointer">
                          <td class="py-2.5 pl-4 pr-2 text-center font-display font-bold text-white">#${r.rank}</td>
                          <td class="py-2.5 px-3 font-sans font-bold text-white hover:text-amber-300">${escapeHtml(r.name)}</td>
                          <td class="py-2.5 px-2 text-center text-slate-400">${r.s1 || 0}</td>
                          <td class="py-2.5 px-2 text-center text-slate-400">${r.s5 || 0}</td>
                          <td class="py-2.5 px-2 text-center text-slate-400">${r.s10 || 0}</td>
                          <td class="py-2.5 px-2 text-center text-slate-400">${r.s13 || 0}</td>
                          <td class="py-2.5 px-2 text-center text-slate-400">${r.s14 || 0}</td>
                          <td class="py-2.5 px-2 text-center text-rose-400">${r.diffToLeader}</td>
                          <td class="py-2.5 pl-2 pr-4 text-center bg-amber-400/5 font-display font-black text-amber-300">${r.totalScore}</td>
                        </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `
          : mode === 'FIVE_SEASONS'
          ? `
            <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
              <div class="p-4 sm:px-6 border-b border-white/10 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 class="font-display font-black text-base sm:text-lg text-white uppercase">
                    🔥 Ranking Ostatnich 5 Sezonów Ekstraklasy (${filteredFive.length} Zawodników)
                  </h3>
                  <p class="text-xs text-slate-400">Ostatnie 5 ukończonych sezonów Ekstraklasy (S50–S54) — przeliczone z pełnych tabel.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" onclick="SMPL_APP.exportArchiveRankingCsv('FIVE_SEASONS')" class="px-3 py-2 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-400/40 text-xs font-display font-bold uppercase transition">📊 CSV Excel</button>
                  <input type="text" placeholder="🔍 Szukaj gracza..." value="${escapeHtml(archiveState ? archiveState.search || '' : '')}" oninput="SMPL_APP.setArchiveSearch(this.value)" class="px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white" />
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[860px]">
                  <thead>
                    <tr class="border-b border-white/10 bg-slate-950/80 text-[11px] font-display uppercase text-slate-400">
                      <th class="py-3 pl-4 pr-2 text-center w-14">Poz.</th>
                      <th class="py-3 px-3">Zawodnik</th>
                      <th class="py-3 px-2 text-center">Sez.</th>
                      <th class="py-3 px-2 text-center">M</th>
                      <th class="py-3 px-2 text-center text-emerald-400">W</th>
                      <th class="py-3 px-2 text-center text-amber-400">R</th>
                      <th class="py-3 px-2 text-center text-rose-400">P</th>
                      <th class="py-3 px-2 text-center">Bramki</th>
                      <th class="py-3 px-2 text-center">Win %</th>
                      <th class="py-3 px-3 text-center">Medale</th>
                      <th class="py-3 pl-2 pr-4 text-center text-amber-300 font-black bg-amber-400/10">TOTAL PKT</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5 text-sm font-mono-num">
                    ${filteredFive.map((r) => {
                      const safeJsName = escapeHtml(r.name).replace(/'/g, "\\'");
                      return `
                        <tr onclick="SMPL_APP.openArchivePlayerCareer('${safeJsName}')" class="hover:bg-white/5 transition cursor-pointer">
                          <td class="py-3 pl-4 pr-2 text-center font-display font-bold text-white">#${r.rank}</td>
                          <td class="py-3 px-3 font-sans font-bold text-white hover:text-amber-300">${escapeHtml(r.name)} <span class="text-[11px] text-slate-400 font-normal">(${escapeHtml(r.bestPos)})</span></td>
                          <td class="py-3 px-2 text-center text-slate-300">${r.seasons}</td>
                          <td class="py-3 px-2 text-center text-slate-200">${r.matches}</td>
                          <td class="py-3 px-2 text-center text-emerald-400">${r.wins}</td>
                          <td class="py-3 px-2 text-center text-amber-400">${r.draws}</td>
                          <td class="py-3 px-2 text-center text-rose-400">${r.losses}</td>
                          <td class="py-3 px-2 text-center text-slate-300">${r.gf}:${r.ga} (${r.gd >= 0 ? '+' + r.gd : r.gd})</td>
                          <td class="py-3 px-2 text-center text-blue-300">${r.winPct}%</td>
                          <td class="py-3 px-3 text-center text-xs font-bold">👑 ${r.gold} 🥈 ${r.silver} 🥉 ${r.bronze}</td>
                          <td class="py-3 pl-2 pr-4 text-center bg-amber-400/5 font-display font-black text-amber-300">${r.total}</td>
                        </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `
          : mode === 'PLAYER_HISTORY'
          ? `
            <div class="space-y-6">
              <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 class="font-display font-black text-lg text-white uppercase">🔎 Historia Kariery Zawodnika (Sezony 1–55)</h3>
                  <p class="text-xs text-slate-400">Wybierz dowolnego spośród ${allCareerPlayers.length} graczy w historii Score Match Liga, aby prześledzić jego występy we wszystkich ligach (L1–L9).</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <select onchange="SMPL_APP.openArchivePlayerCareer(this.value)" class="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs sm:text-sm text-white font-bold max-w-xs">
                    ${allCareerPlayers.map((nm) => `<option value="${escapeHtml(nm)}" ${nm.toLowerCase() === activeCareerName.toLowerCase() ? 'selected' : ''}>${escapeHtml(nm)} (${allCareerNamesMap[nm]} sez.)</option>`).join('')}
                  </select>
                  <button type="button" onclick="SMPL_APP.openArchiveUtCard('${escapeHtml(activeCareerName).replace(/'/g, "\\'")}')" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-lg">
                    🎴 Zobacz Kartę UT 3D i Trofea →
                  </button>
                </div>
              </div>

              ${(() => {
                if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.computePlayerCareerTrajectory !== 'function' || typeof window.SMPL_STUDIO.renderCareerTrajectorySvg !== 'function') return '';
                const archTraj = window.SMPL_STUDIO.computePlayerCareerTrajectory(activeCareerName, activeCareerName);
                if (!archTraj || !archTraj.points || archTraj.points.length === 0) return '';
                return `
                  <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10">
                    <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                      <h4 class="font-display font-black text-sm sm:text-base uppercase text-blue-300">
                        📈 Trajektoria Kariery — ${escapeHtml(activeCareerName)} (Wszystkie Ligi L1–L9)
                      </h4>
                      <span class="text-xs text-slate-400">${archTraj.points.length} sezonów w historii SMPL</span>
                    </div>
                    ${window.SMPL_STUDIO.renderCareerTrajectorySvg(archTraj.points)}
                  </div>
                `;
              })()}

              <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
                <div class="p-4 sm:px-6 border-b border-white/10 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 class="font-display font-black text-lg text-white uppercase">📜 ${escapeHtml(activeCareerName)} — Zapisane Sezony (${careerRecords.length})</h4>
                    <p class="text-xs text-slate-400">Kliknij dowolny sezon poniżej, aby otworzyć pełną tabelę tamtej edycji.</p>
                  </div>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse min-w-[740px]">
                    <thead>
                      <tr class="border-b border-white/10 bg-slate-950/80 text-[11px] font-display uppercase text-slate-400">
                        <th class="py-3 pl-4 pr-2">Sezon</th>
                        <th class="py-3 px-3">Dywizja</th>
                        <th class="py-3 px-2 text-center">Miejsce</th>
                        <th class="py-3 px-2 text-center">M</th>
                        <th class="py-3 px-2 text-center text-white font-black">PKT</th>
                        <th class="py-3 px-2 text-center text-emerald-400">W</th>
                        <th class="py-3 px-2 text-center text-amber-400">R</th>
                        <th class="py-3 px-2 text-center text-rose-400">P</th>
                        <th class="py-3 px-2 text-center">BZ:BS</th>
                        <th class="py-3 pl-2 pr-4">Uwagi / Tytuł</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5 text-sm font-mono-num">
                      ${careerRecords.length === 0
                        ? `<tr><td colspan="10" class="py-8 text-center text-slate-400 text-xs">Brak rozegranych meczów w archiwum dla tego gracza.</td></tr>`
                        : careerRecords.map((rc) => `
                            <tr onclick="SMPL_APP.setArchiveMode('SEASONS'); SMPL_APP.setArchiveSeason(${rc.seasonNumber}); SMPL_APP.setArchiveLeague('${rc.leagueId}');" class="hover:bg-white/5 cursor-pointer transition">
                              <td class="py-2.5 pl-4 pr-2 font-display font-black text-amber-300">Sezon ${rc.seasonNumber}${rc.inProgress ? ' <span class="ml-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-[9px] text-amber-200 uppercase">W trakcie</span>' : ''}</td>
                              <td class="py-2.5 px-3 font-sans font-bold text-white">${escapeHtml(rc.leagueLabel)}</td>
                              <td class="py-2.5 px-2 text-center font-display font-bold ${rc.pos === 1 ? 'text-amber-300' : rc.pos <= 3 ? 'text-emerald-300' : 'text-white'}">#${rc.pos}</td>
                              <td class="py-2.5 px-2 text-center text-slate-300">${rc.M}</td>
                              <td class="py-2.5 px-2 text-center font-display font-black text-amber-300">${rc.PKT}</td>
                              <td class="py-2.5 px-2 text-center text-emerald-400">${rc.W}</td>
                              <td class="py-2.5 px-2 text-center text-amber-400">${rc.R}</td>
                              <td class="py-2.5 px-2 text-center text-rose-400">${rc.P}</td>
                              <td class="py-2.5 px-2 text-center text-slate-300">${rc.BZ}:${rc.BS}</td>
                              <td class="py-2.5 pl-2 pr-4 font-sans text-xs font-bold text-amber-300">${escapeHtml(rc.note)}</td>
                            </tr>`).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `
          : `
            <div class="space-y-6">
              <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-xs font-display uppercase text-slate-400 font-bold mr-1">Zakres lat/sezonów:</span>
                    ${[
                      { id: 'ALL', label: `Wszystkie (${seasonsList.length})` },
                      { id: '45_55', label: 'Najnowsze (S45–S55)' },
                      { id: '30_44', label: 'Złota Era (S30–S44)' },
                      { id: '15_29', label: 'S15–S29' },
                      { id: '1_14', label: 'Początki (S1–S14)' }
                    ].map((g) => `<button onclick="SMPL_APP.setArchiveSeasonGroup('${g.id}')" class="px-2.5 py-1 rounded-lg text-[11px] font-display font-bold transition ${seasonGroup === g.id ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-300 border border-white/10'}">${g.label}</button>`).join('')}
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400 font-bold">Szybki wybór:</span>
                    <select onchange="SMPL_APP.setArchiveSeason(Number(this.value))" class="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-400/50 text-xs text-white font-bold">
                      ${seasonsList.map((s) => `<option value="${s.seasonNumber}" ${Number(selectedSeasonNum) === Number(s.seasonNumber) ? 'selected' : ''}>Sezon ${s.seasonNumber}${s.inProgress ? ' (Półmetek)' : ''} (${Object.keys(s.leagues || {}).length} lig)</option>`).join('')}
                    </select>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-1.5 max-h-36 overflow-y-auto pr-1 pt-2 border-t border-white/10">
                  ${filteredSeasonsList
                    .map(
                      (s) => `
                        <button onclick="SMPL_APP.setArchiveSeason(${s.seasonNumber})" class="px-2.5 py-1 rounded-lg text-xs font-display font-bold transition ${
                          Number(selectedSeasonNum) === Number(s.seasonNumber)
                            ? 'btn-league'
                            : 'bg-slate-900 text-slate-300 border border-white/15 hover:bg-slate-800'
                        }">
                          S${s.seasonNumber}${s.inProgress ? ' ⏳' : ''}
                        </button>
                      `
                    )
                    .join('')}
                </div>

                <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                  <span class="text-xs font-display uppercase text-slate-400 font-bold mr-1">Dywizje w Sezonie ${selectedSeasonNum}:</span>
                  ${availableLeagues
                    .map(
                      (lid) => `
                        <button onclick="SMPL_APP.setArchiveLeague('${lid}')" class="px-3 py-1.5 rounded-xl text-xs font-display font-bold transition ${
                          selectedLeague === lid ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-900 text-slate-300 border border-white/15 hover:bg-slate-800'
                        }">
                          ${ARCHIVE_LEAGUE_LABELS[lid] || lid}
                        </button>
                      `
                    )
                    .join('')}
                </div>
              </div>

              ${
                activeSeasonObj
                  ? `
                    <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
                      <div class="p-4 sm:px-6 border-b border-white/10 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
                        <div class="space-y-1.5">
                          ${
                            activeSeasonObj.inProgress
                              ? `<div class="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-[10px] sm:text-[11px] font-display font-bold uppercase tracking-wider text-amber-300">
                                   <span>⏳ SEZON W TRAKCIE (PÓŁMETEK)</span>
                                   <span class="text-slate-400">•</span>
                                   <span class="text-emerald-300">Medale i Ranking All-Time naliczą się po 30. kolejce</span>
                                 </div>`
                              : ''
                          }
                          <h3 class="font-display font-black text-lg text-white uppercase">
                            📚 ${escapeHtml(activeSeasonObj.yearLabel)} — ${escapeHtml(ARCHIVE_LEAGUE_LABELS[selectedLeague] || selectedLeague)}
                          </h3>
                          <p class="text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                            <span>${activeSeasonObj.inProgress ? 'Lider Ekstraklasy' : 'Mistrz Ekstraklasy'}: <strong class="text-amber-300">${escapeHtml(activeSeasonObj.championL1 || '—')}</strong></span>
                            ${activeSeasonObj.championL2 && activeSeasonObj.championL2 !== '—' ? `<span>• ${activeSeasonObj.inProgress ? 'Lider 2. Ligi' : 'Mistrz 2. Ligi'}: <strong class="text-blue-300">${escapeHtml(activeSeasonObj.championL2)}</strong></span>` : ''}
                            ${activeSeasonObj.championL3 && activeSeasonObj.championL3 !== '—' ? `<span>• ${activeSeasonObj.inProgress ? 'Lider 3. Ligi' : 'Mistrz 3. Ligi'}: <strong class="text-emerald-300">${escapeHtml(activeSeasonObj.championL3)}</strong></span>` : ''}
                          </p>
                          ${
                            activeSeasonObj.progressSummary && activeSeasonObj.progressSummary[selectedLeague]
                              ? `<p class="text-[11px] sm:text-xs text-emerald-300/95 font-medium pt-0.5">📊 ${escapeHtml(activeSeasonObj.progressSummary[selectedLeague])}</p>`
                              : ''
                          }
                        </div>
                        <span class="text-[11px] text-slate-400">Kliknij zawodnika, aby zobaczyć całą jego karierę (S1–S55)</span>
                      </div>

                      <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse min-w-[740px]">
                          <thead>
                            <tr class="border-b border-white/10 bg-slate-950/80 text-[11px] font-display uppercase text-slate-400">
                              <th class="py-3 pl-4 pr-2 w-14 text-center">Poz.</th>
                              <th class="py-3 px-3">Zawodnik</th>
                              <th class="py-3 px-2 text-center">M</th>
                              <th class="py-3 px-2 text-center text-white font-black">PKT</th>
                              <th class="py-3 px-2 text-center text-emerald-400">W</th>
                              <th class="py-3 px-2 text-center text-amber-400">R</th>
                              <th class="py-3 px-2 text-center text-rose-400">P</th>
                              <th class="py-3 px-2 text-center">BZ:BS</th>
                              <th class="py-3 px-2 text-center">+/-</th>
                              <th class="py-3 pl-2 pr-4">Uwagi / Tytuł</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-white/5 text-sm font-mono-num">
                            ${((activeSeasonObj.leagues && activeSeasonObj.leagues[selectedLeague]) || [])
                              .map(
                                (r) => {
                                  const safeJsName = escapeHtml(r.name).replace(/'/g, "\\'");
                                  return `
                                    <tr onclick="SMPL_APP.openArchivePlayerCareer('${safeJsName}')" class="hover:bg-white/5 cursor-pointer transition">
                                      <td class="py-3 pl-4 pr-2 text-center font-display font-bold text-white">#${r.pos}</td>
                                      <td class="py-3 px-3 font-sans font-bold text-white hover:text-amber-300">
                                        <div class="flex items-center justify-between gap-2">
                                          <span>${escapeHtml(r.name)}</span>
                                          ${!/^wolny\s*los|^wl\d+$|brak danych/i.test(String(r.name || ''))
                                            ? `<button type="button" onclick="event.stopPropagation(); SMPL_APP.openArchiveUtCard('${safeJsName}')" class="px-2 py-0.5 rounded-lg bg-amber-400/15 hover:bg-amber-400 text-amber-200 hover:text-slate-950 border border-amber-400/40 text-[10px] font-display font-black uppercase flex-shrink-0 transition">🎴 UT</button>`
                                            : ''}
                                        </div>
                                      </td>
                                      <td class="py-3 px-2 text-center text-slate-300">${r.M}</td>
                                      <td class="py-3 px-2 text-center font-display font-black text-amber-300">${r.PKT}</td>
                                      <td class="py-3 px-2 text-center text-emerald-400">${r.W}</td>
                                      <td class="py-3 px-2 text-center text-amber-400">${r.R}</td>
                                      <td class="py-3 px-2 text-center text-rose-400">${r.P}</td>
                                      <td class="py-3 px-2 text-center text-slate-300">${r.BZ}:${r.BS}</td>
                                      <td class="py-3 px-2 text-center ${r.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${r.diff >= 0 ? '+' + r.diff : r.diff}</td>
                                      <td class="py-3 pl-2 pr-4 font-sans text-xs font-bold text-amber-300">${escapeHtml(r.note || '')}</td>
                                    </tr>
                                  `;
                                }
                              )
                              .join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  `
                  : ''
              }
            </div>
          `
      }
    `;
  }
  // =========================================================================
  // 8. ZAKŁADKA: REGULAMIN DLA GRACZY & TARCZA PRAWNA / RODO / DSA
  // =========================================================================
  function renderLegalPlayersGuideSectionHtml() {
    const activeLeaguesForRules = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(null, false)
      : [{ id: 'L1', shortName: 'Ekstraklasa (L1)' }, { id: 'L2', shortName: '2. Liga (L2)' }];
    const activeIdsForRules = activeLeaguesForRules.map((l) => l.id);
    const hasL3ForRules = activeIdsForRules.indexOf('L3') !== -1;
    const activeLeagueLabelsRules = activeLeaguesForRules.map((l) => escapeHtml(l.shortName || l.name || l.id)).join(', ');
    const zonesRuleText = hasL3ForRules
      ? '<strong>L1:</strong> 1 Mistrz, 1–3 Podium, 2 nad spadkiem Baraże, 2 ostatnie Spadek. <strong>L2:</strong> 1–2 Awans, 3–5 Baraże w górę, 2 nad spadkiem Baraże o utrzymanie, 3 ostatnie Spadek. <strong>L3+:</strong> 1–2 Awans wyżej, 3–5 Baraże, 2 ostatnie Weryfikacja.'
      : '<strong>L1 (Ekstraklasa):</strong> 1 Mistrz Polski, 1–3 Podium, 2 nad spadkiem Baraże, 2 ostatnie Spadek do L2. <strong>L2 (2. Liga):</strong> 1–2 Bezpośredni Awans do L1, 3–5 Baraże o L1, 2 ostatnie Weryfikacja składu L2.';
    return `
      <!-- Część 1: Regulamin Rozgrywek dla Graczy (Uczciwy, Przejrzysty i Zautomatyzowany) -->
      ${window.SMPL_SECURITY && typeof window.SMPL_SECURITY.renderProfileTrustCardHtml === 'function' ? `<div class="mb-4">${window.SMPL_SECURITY.renderProfileTrustCardHtml()}</div>` : ''}
      <div class="glass-panel-league rounded-3xl p-6 sm:p-8 border border-white/15">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-display font-bold uppercase tracking-widest">
            🎮 CZĘŚĆ I • REGULAMIN ROZGRYWEK DLA GRACZY (FAIR PLAY)
          </span>
          <span class="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-white/10 text-[11px] font-bold text-slate-300">
            Wersja SMPL-REG-2026.1
          </span>
        </div>
        <h2 class="font-display font-black text-2xl sm:text-3xl text-white uppercase mt-2">
          Zasady Gry, Umawiania Meczów i Ochrony Aktywnych Graczy
        </h2>
        <p class="text-xs sm:text-sm text-slate-300 mt-1">
          Zasady stworzone tak, aby liga działała sprawnie, uczciwie i chroniła rzetelnych graczy przed brakiem kontaktu rywali:
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-xs">
          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-amber-300 uppercase mb-1.5">§1. ⏱️ Tempo, Max 2 Bramki &amp; Dwumecz</div>
            <p class="text-slate-300 leading-relaxed">
              W lidze gramy do <strong class="text-white">max 2 bramek</strong> w meczu (wyniki <strong class="text-white">0–2</strong>, bez 2:2). Każda para rozgrywa <strong class="text-emerald-300">dwumecz: 1 mecz u siebie + 1 na wyjeździe</strong>. Kolejka kończy się <strong class="text-amber-300">zawsze w czwartek o 23:59</strong> (ok. 4 kolejki na tydzień, aktywne ligi: ${activeLeagueLabelsRules}; Admin ma możliwość wcześniejszego puszczenia następnej kolejki lub przedłużenia terminu). Po zamknięciu kolejki wszystkie nierozegrane mecze trafiają bezpośrednio do Adminów w celu podjęcia działań.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-emerald-400 uppercase mb-1.5">§2. 🏠 Gospodarz Zaprasza &amp; Messenger</div>
            <p class="text-slate-300 leading-relaxed">
              Gracz po <strong>lewej stronie pary jest Gospodarzem (🏠 DOM)</strong> — inicjuje rozmowę wyłącznie na <strong>Messengerze</strong> (przycisk przy meczu w Terminarzu lub link FB w profilu), proponuje <strong>min. 2–3 terminy</strong> i wysyła zaproszenie do pokoju w grze <em>Score! Match</em>. Na umówioną godzinę obowiązuje <strong>15-minutowy margines oczekiwania</strong>.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-blue-300 uppercase mb-1.5">§3. 🛡️ Reguła 48h &amp; Obowiązkowy SS do Sporu / W.O.</div>
            <p class="text-slate-300 leading-relaxed">
              Aktywny gracz nigdy nie traci punktów przez „ducha”. Jeśli rywal <strong>nie odpisuje na Messengerze przez 48h</strong> od Twoich propozycji lub nie stawił się mimo 15 min czekania — zgłoś <strong>Spór VAR / W.O.</strong> przy meczu i <strong>obowiązkowo załącz SS dlaczego</strong> (screen rozmowy z datami) dla Admina (<strong>2:0 WO dla Ciebie</strong>). Brak kontaktu obu stron grozi <strong>0:0 WO</strong> i/lub <strong>-3 PKT</strong>.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-amber-300 uppercase mb-1.5">§4. 📸 Oba Wyniki Dwumeczu &amp; Obowiązkowe SS</div>
            <p class="text-slate-300 leading-relaxed">
              Po rozegraniu obu spotkań (<strong class="text-white">1 u siebie + 1 na wyjeździe</strong>, do max 2 bramek) zgłaszasz w <strong>„➕ Dodaj Wynik”</strong> <strong class="text-white">oba wyniki oraz oba screeny (SS)</strong>. Admini zatwierdzają wyniki dopiero po otrzymaniu kompletu SS. Rage quit / rozłączenie zgłaszasz w VAR z <strong>obowiązkowym SS dlaczego</strong> = <strong>2:0 WO</strong> dla poszkodowanego.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-emerald-400 uppercase mb-1.5">§5. 📊 Tabela, H2H, Czyste Konta &amp; Wolny Los</div>
            <p class="text-slate-300 leading-relaxed">
              Punktacja: <strong>3/1/0 PKT</strong>. Kolejność w tabeli: <strong>1. PKT</strong> ➔ <strong>2. Mała tabela H2H</strong> ➔ <strong>3. Bilans (+/-)</strong> ➔ <strong>4. BZ</strong> ➔ <strong>5. Mniej BS</strong>. „Wolny Los” daje automatyczne <strong>2:0 (+3 PKT)</strong>. Czyste Konta nie liczą się z obustronnego walkowera 0:0 WO.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-blue-300 uppercase mb-1.5">§6. ↕️ Strefy Awansu, Baraży i Spadków</div>
            <p class="text-slate-300 leading-relaxed">
              ${zonesRuleText}
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-purple-300 uppercase mb-1.5">§7. 🤫 Tajemnica Składów &amp; Złota Piłka</div>
            <p class="text-slate-300 leading-relaxed">
              Składy i taktyki w <em>Score! Match</em> są <strong>tajne</strong> (nikt nie ujawnia formacji przed meczem). Zakazane są multikonta, oddawanie meczów (<em>win-trading</em>), przerabianie screenów i głosowanie na samego siebie w plebiscycie <strong>Złota Piłka</strong>.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950/90 border border-white/10">
            <div class="font-display font-black text-sm text-rose-400 uppercase mb-1.5">§8–§9. ⚖️ Taryfikator Kar, Ochrona Kontaktu &amp; 7-Dniowe Odwołania</div>
            <p class="text-slate-300 leading-relaxed">
              Link FB/Messenger służy <strong>wyłącznie do umawiania meczów i kontaktu ligowego</strong> (zero spamu/nękania). Stopniowanie sankcji: <strong>1) Ostrzeżenie / Żółta kartka</strong> ➔ <strong>2) Walkower / -3 PKT</strong> ➔ <strong>3) Czerwona kartka / Zawieszenie w lidze</strong> ➔ <strong>4) Czarna Lista</strong> (oszustwa, przerobione SS, multikonta, groźby). Każda kara punktowa i walkower ma podany powód oraz dowód SS w Trybunale/Terminarzu, a każdy gracz ma prawo złożyć <strong>umotywowane odwołanie w ciągu 7 dni</strong> na Messengerze do Głównego Administratora.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  function renderLegalShieldSectionHtml() {
    return `
      <!-- Część 2: Pełne Zabezpieczenie Prawne Organizatorów, RODO i DSA (Ochrona przed pozwami) -->
      <div class="glass-panel rounded-3xl p-6 sm:p-8 border-2 border-amber-400/40">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-xs font-display font-bold uppercase tracking-widest">
            🛡️ CZĘŚĆ II • TARCZA PRAWNA ORGANIZATORÓW, RODO I DSA
          </span>
          <span class="px-2.5 py-1 rounded-lg bg-slate-950 border border-white/10 text-[11px] font-bold text-amber-300">
            Obowiązuje od 13.11.2026 r.
          </span>
        </div>
        <h3 class="font-display font-black text-xl sm:text-2xl text-white uppercase mt-2">
          Ochrona przed Roszczeniami, Prawa Autorskie (Fair Use), Antyhazard, RODO i DSA
        </h3>
        <p class="text-xs text-slate-300 mt-1 mb-5">
          Wiążące klauzule prawne regulujące niekomercyjny charakter ligi, odpowiedzialność cywilnoprawną, moderację listy wykluczeń oraz pełną zgodność z RODO i Aktem o Usługach Cyfrowych (DSA):
        </p>

        <div class="space-y-4 text-xs leading-relaxed text-slate-200">
          <div class="p-4 rounded-2xl bg-slate-950 border border-white/10">
            <div class="font-display font-bold text-amber-300 uppercase mb-1">
              §10. Status Niekomercyjny &amp; Brak Relacji Odpłatnej (Brak działalności gospodarczej)
            </div>
            <p class="text-slate-300">
              1. Serwis „Score Match Liga (SMPL)” jest prywatną, w 100% <strong>niekomercyjną i hobbystyczną inicjatywą społeczności fanowskiej (fan-made non-profit)</strong>.<br/>
              2. Organizacja rozgrywek i udostępnianie portalu nie stanowią działalności gospodarczej (Prawo przedsiębiorców) ani odpłatnej umowy konsumenckiej B2C. Korzystanie z serwisu jest dobrowolne i całkowicie bezpłatne.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-white/10">
            <div class="font-display font-bold text-amber-300 uppercase mb-1">
              §11. Klauzula Prawnoautorska i Fair Use (Niezależność od First Touch Games Ltd.)
            </div>
            <p class="text-slate-300">
              1. Nazwa gry <em>Score! Match</em>, elementy graficzne interfejsu na zrzutach ekranu wgrywanych przez graczy i powiązane znaki towarowe należą wyłącznie do <strong>First Touch Games Ltd.</strong> i są używane wyłącznie informacyjnie i dokumentacyjnie (dozwolony użytek / <em>Fair Use</em>, art. 29 Prawa autorskiego).<br/>
              2. Administracja SMPL nie jest powiązana z First Touch Games Ltd., nie ingeruje w kod gry ani nie sprzedaje kont lub przedmiotów. Na pisemne wezwanie uprawnionego sporne materiały usuwane są niezwłocznie.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-white/10">
            <div class="font-display font-bold text-emerald-400 uppercase mb-1">
              §12. Klauzula Antyhazardowa (Zgodność z Ustawą o grach hazardowych)
            </div>
            <p class="text-slate-300">
              1. Rozgrywki SMPL stanowią wyłącznie <strong>darmową rywalizację zręcznościowo-taktyczną (Skill-Based E-Sport)</strong>.<br/>
              2. Wpisowe wynosi <strong>0,00 PLN</strong> — brak jakichkolwiek opłat, abonamentów, składek lub nagród pieniężnych i rzeczowych o wartości majątkowej.<br/>
              3. Portal nie organizuje gier losowych, zakładów wzajemnych ani loterii w rozumieniu <em>Ustawy z dnia 19 listopada 2009 r. o grach hazardowych</em>. Trofea, tytuły i karty UT są wyłącznie wirtualnymi odznakami prestiżowymi.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-white/10">
            <div class="font-display font-bold text-blue-300 uppercase mb-1">
              §13. Ochrona Małoletnich i Zdolność do Zgody (Art. 8 RODO)
            </div>
            <p class="text-slate-300">
              1. Rejestrując konto, uczestnik oświadcza, że ukończył <strong>16 lat</strong> albo zakłada konto i bierze udział w rozgrywkach za wyraźną wiedzą i zgodą rodzica lub opiekuna prawnego (Art. 8 RODO).<br/>
              2. Na zgłoszenie rodzica/opiekuna prawnego o braku zgody konto osoby niepełnoletniej zostanie niezwłocznie usunięte i zanonimizowane.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-white/10">
            <div class="font-display font-bold text-rose-300 uppercase mb-1">
              §14. Wyłączenie Odpowiedzialności („AS IS”, Brak Roszczeń o Wyniki, Siła Wyższa)
            </div>
            <p class="text-slate-300">
              1. Portal działa nieodpłatnie w formule <strong>„tak jak jest” (AS IS)</strong>. Administracja nie gwarantuje nieprzerwanej dostępności hostingu ani braku błędów zewnętrznych i nie odpowiada za działanie serwerów gry <em>Score! Match</em> (First Touch Games Ltd.), łącza internetowego, aktualizacje przeglądarek czy utratę sesji.<br/>
              2. Z uwagi na nieodpłatny, hobbystyczny charakter ligi uczestnikowi nie przysługują roszczenia odszkodowawcze za utratę wirtualnych punktów, miejsca w tabeli, rangi, awansu czy przerwanie/reset sezonu w wyniku awarii, nadużyć lub Siły Wyższej (z wyłączeniem winy umyślnej w granicach bezwzględnie obowiązującego prawa).
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-amber-400/30">
            <div class="font-display font-bold text-amber-300 uppercase mb-1">
              §15. Czarna Lista, Moderacja i Ochrona przed Zarzutem Naruszenia Dóbr Osobistych (Art. 23–24 KC / Art. 212 KK)
            </div>
            <p class="text-slate-300">
              1. Organizatorzy prywatnej społeczności turniejowej mają prawo odmówić udziału lub wykluczyć uczestnika naruszającego regulamin bądź bezpieczeństwo portalu.<br/>
              2. Wpisy na Liście Wykluczeń (<em>Czarna Lista</em>) i w <em>Trybunale</em> stanowią wyłącznie <strong>wewnątrzorganizacyjne decyzje porządkowe</strong> opisujące obiektywne fakty regulaminowe (np. naruszenie zasad screenów, multikonto, naruszenie zasad komunikacji), oparte na przechowywanym materiale dowodowym — nie stanowią ocennych obelg ani oskarżeń o przestępstwa.<br/>
              3. Każda osoba ma zagwarantowane: prawo <strong>7-dniowego odwołania</strong> (§9), natychmiastowe sprostowanie w razie błędu oraz niezależne prawo do <strong>anonimizacji danych osobowych (Art. 17 RODO)</strong>.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-white/10">
            <div class="font-display font-bold text-purple-300 uppercase mb-1">
              §16. Treści Użytkowników, Art. 14 UŚUDE oraz Akt o Usługach Cyfrowych (DSA UE 2022/2065 — Notice &amp; Takedown)
            </div>
            <p class="text-slate-300">
              1. Uczestnik ponosi pełną odpowiedzialność prawną za wgrywane awatary, zrzuty ekranu i wiadomości (zakaz naruszania cudzych praw autorskich, publikacji danych/wizerunku osób trzecich bez zgody, mowy nienawiści i gróźb).<br/>
              2. Zgodnie z art. 14 UŚUDE oraz unijnym Aktem o Usługach Cyfrowych (DSA) Administracja nie ponosi odpowiedzialności za treści użytkowników do momentu uzyskania wiarygodnego zgłoszenia. Każde zgłoszenie naruszenia prawa lub dóbr osobistych rozpatrywane jest niezwłocznie w procedurze <strong>Notice &amp; Takedown</strong>.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-blue-500/30">
            <div class="font-display font-bold text-blue-300 uppercase mb-1">
              §17. Pełna Polityka Prywatności &amp; Klauzula Informacyjna RODO (UE 2016/679)
            </div>
            <p class="text-slate-300">
              1. <strong>Administrator Danych:</strong> Zarząd SMPL (Główny Administrator projektu: Szymon Komenda; kontakt przez Messenger lub kanał administracyjny).<br/>
              2. <strong>Minimalizacja (Art. 5 RODO) &amp; Bezpieczeństwo:</strong> Zbieramy wyłącznie imię/pseudonim, nick z gry, opcjonalny awatar, dobrowolny link kontaktowy FB/Messenger (wyłącznie do umawiania meczów) oraz jednokierunkowy skrót hasła (<code>smplh1$</code>). Brak PESEL, telefonów, adresów i danych kart. Pamięć <code>localStorage</code>/PWA służy wyłącznie technicznie do sesji (zero cookies reklamowych i śledzących).<br/>
              3. <strong>Podstawy prawne:</strong> Art. 6 ust. 1 lit. a RODO (świadoma, niedomyślna zgoda przy rejestracji z możliwością cofnięcia) oraz Art. 6 ust. 1 lit. f RODO (prawnie uzasadniony interes: integralność tabel sportowych, rozpatrywanie odwołań, bezpieczeństwo przed multikontami i nieautoryzowanym zapisem).<br/>
              4. <strong>Twoje prawa (Art. 15–21 RODO) &amp; Samoanominizacja (Art. 17 RODO):</strong> Masz prawo dostępu, sprostowania, cofnięcia zgody, skargi do Prezesa UODO (<code>uodo.gov.pl</code>) oraz natychmiastowego usunięcia danych identyfikujących (zamiana profilu na <em>„Gracz Zanonimizowany (RODO)”</em> z pozostawieniem wyłącznie anonimowych statystyk meczowych wg motywu 26 RODO).
            </p>
            <div class="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
              <span class="text-[11px] text-slate-400">Chcesz usunąć lub zanonimizować swoje dane z portalu zgodnie z Art. 17 RODO?</span>
              <button type="button" onclick="SMPL_APP.openGdprDeleteModal()" class="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-bold text-xs transition">
                🗑️ Zgłoś żądanie RODO (Usuń / Zanonimizuj konto)
              </button>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-amber-400/35">
            <div class="font-display font-bold text-amber-300 uppercase mb-1">
              §18. Dobrowolne Wsparcie Twórcy i Administracji („Donate / Postaw Kawę” — Art. 888 k.c.)
            </div>
            <p class="text-slate-300">
              1. <strong>100% Dobrowolność i Brak Wpisowego (0 zł):</strong> Udział we wszystkich rozgrywkach, turniejach, rankingach, plebiscytach oraz dostęp do aplikacji PWA i Vanessy AI jest całkowicie bezpłatny. Wszelkie wpłaty wspierające („Donate / Postaw Kawę”) są w 100% dobrowolne i nie stanowią warunku gry ani opłaty członkowskiej.<br/>
              2. <strong>Charakter Prawny (Darowizna — Art. 888 Kodeksu cywilnego):</strong> Każda wpłata stanowi dobrowolną, jednostronną, bezinteresowną i bezzwrotną darowiznę na rzecz wskazanej osoby prywatnej (Twórcy portalu lub Administracji) na pokrycie kosztów utrzymania serwera, domeny, narzędzi AI oraz docenienie społecznej pracy nad rozwojem ligi.<br/>
              3. <strong>Bezwzględny Zakaz Pay-to-Win (Brak Świadczenia Wzajemnego &amp; Antyhazard):</strong> Wpłata NIE jest zakupem usługi, towaru, punktów, miejsca w lidze, rangi, immunitetu ani jakiejkolwiek przewagi sportowej czy administracyjnej. Wsparcie nie ma żadnego wpływu na decyzje sędziowskie, Trybunał, tabele, losowania ani awanse (zgodnie z Ustawą z dnia 19 listopada 2009 r. o grach hazardowych). Ewentualne wpisanie pseudonimu na Honorowej Ścianie Podziękowań (za zgodą RODO) lub przekazanie symbolicznych pamiątek graficznych (np. tapet fanowskich, dyplomu podziękowania, herbu) ma charakter wyłącznie dobrowolnego, nieodpłatnego gestu wdzięczności Twórcy i NIE stanowi sprzedaży cyfrowej ani umowy wzajemnej.<br/>
              4. <strong>Brak Pośrednictwa Płatniczego i Ochrona Danych:</strong> Portal SMPL nie przyjmuje bezpośrednio płatności, nie prowadzi sklepu internetowego i nie gromadzi danych bankowych, numerów kart ani danych płatniczych. Wpłata realizowana jest dobrowolnie bezpośrednio u zewnętrznego operatora wybranego przez wspierającego (np. BuyCoffee.to, Suppi.pl, PayPal, bankowość BLIK).<br/>
              5. <strong>Ochrona Małoletnich (Art. 14–20 k.c.) &amp; Kwestie Podatkowe:</strong> Dobrowolnej darowizny mogą dokonywać wyłącznie osoby pełnoletnie (18+) lub osoby małoletnie za wyraźną zgodą rodzica/opiekuna prawnego. Darowizny między osobami niespokrewnionymi podlegają przepisom Ustawy o podatku od spadków i darowizn (III grupa podatkowa — aktualna kwota wolna od podatku wynosi 5 733 zł łącznie od jednej osoby w okresie 5 lat).
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-950 border border-white/10">
            <div class="font-display font-bold text-slate-200 uppercase mb-1">
              §19. Prawo Właściwe, Polubowne Spory &amp; Nota Organizacyjna
            </div>
            <p class="text-slate-300">
              1. Prawem właściwym jest prawo polskie. Spory i zgłoszenia prawne/RODO rozpatruje się w pierwszej kolejności polubownie przez Zarząd Ligi (odpowiedź niezwłocznie, maks. 14 dni).<br/>
              2. Dokument stanowi kompletny wzorzec regulaminowy niekomercyjnej ligi fanowskiej (w razie wprowadzenia w przyszłości wpisowego, sponsorów komercyjnych lub nagród pieniężnych wymagana jest aktualizacja z udziałem profesjonalnego pełnomocnika).
            </p>
          </div>
        </div>
      </div>
    `;
  }

  function renderLegalAndRulesView(state, session, legalSubTab) {
    const mode = legalSubTab === 'PLAYERS' || legalSubTab === 'LEGAL' ? legalSubTab : 'ALL';
    const playersHtml = mode === 'ALL' || mode === 'PLAYERS' ? renderLegalPlayersGuideSectionHtml() : '';
    const legalHtml = mode === 'ALL' || mode === 'LEGAL' ? renderLegalShieldSectionHtml() : '';

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-white/15 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="SMPL_APP.setLegalSubTab('ALL')" class="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase transition ${
              mode === 'ALL' ? 'btn-league shadow-lg' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/15'
            }">📜 Wszystko (Pełny Pakiet)</button>
            <button type="button" onclick="SMPL_APP.setLegalSubTab('PLAYERS')" class="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase transition ${
              mode === 'PLAYERS' ? 'btn-league shadow-lg' : 'bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30'
            }">🎮 Regulamin dla Graczy</button>
            <button type="button" onclick="SMPL_APP.setLegalSubTab('LEGAL')" class="px-3.5 py-2 rounded-xl text-xs font-display font-bold uppercase transition ${
              mode === 'LEGAL' ? 'btn-league shadow-lg' : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40'
            }">🛡️ Tarcza Prawna &amp; RODO</button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="SMPL_APP.openOnboardingTutorialModal({ isAutoFirstTime: false })" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-400/45 font-display font-bold text-xs uppercase transition">
              🎬 Poradnik Świeżaka (Wideo A–Z)
            </button>
            <button type="button" onclick="SMPL_APP.openLegalReportOrAppeal()" class="px-3.5 py-2 rounded-xl bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 font-display font-bold text-xs uppercase transition">
              💬 Odwołanie / Zgłoszenie DSA
            </button>
            <button type="button" onclick="SMPL_APP.openGdprDeleteModal()" class="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/40 font-display font-bold text-xs uppercase transition">
              🗑️ Żądanie RODO
            </button>
            <button type="button" onclick="if(window.print)window.print()" class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/15 font-bold text-xs transition">
              🖨️ Drukuj / PDF
            </button>
          </div>
        </div>

        ${playersHtml}
        ${legalHtml}
      </div>
    `;
  }

  function renderLegalSummaryModalHtml() {
    return `
      <div class="p-5 sm:p-6 space-y-4">
        <div class="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <span class="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-display font-bold uppercase tracking-wider">
              ⚖️ SMPL-REG-2026.1 • PRZED REJESTRACJĄ
            </span>
            <h3 class="font-display font-black text-lg text-white uppercase mt-1.5">
              Regulamin dla Graczy, Klauzula Prawna i RODO
            </h3>
          </div>
          <button type="button" onclick="SMPL_APP.closeModal()" class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/15 text-xs font-bold">
            ✕ Zamknij
          </button>
        </div>

        <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div class="p-3.5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-1.5">
            <div class="font-display font-bold text-emerald-300 uppercase">🎮 1. Zasady dla Graczy (Fair Play)</div>
            <p>• <strong>Tempo i koniec kolejki:</strong> 4 kolejki tygodniowo — <strong>kolejka kończy się zawsze w czwartek o 23:59</strong> (Administracja może puścić kolejną wcześniej lub przedłużyć termin w razie Świąt). Mecze nierozegrane po zamknięciu kolejki trafiają automatycznie do Adminów w celu podjęcia działań. Gospodarz (lewa strona pary) zaprasza Gościa przez Messenger.</p>
            <p>• <strong>Ochrona aktywnego gracza (48h):</strong> Gdy rywal milczy 48h na 2–3 konkretne propozycje lub nie stawi się po 15 min — zgłoś Spór VAR / W.O. w Terminarzu i obowiązkowo załącz SS dlaczego (walkower <strong>2:0 WO</strong> na Twoją korzyść).</p>
            <p>• <strong>Wyniki i Kary:</strong> Screen końcowy w zakładce Wynik; tajemnica składów; 4-stopniowy taryfikator kar z obowiązkiem podania powodu i <strong>7 dni na odwołanie</strong> przez Messenger do Głównego Administratora.</p>
          </div>

          <div class="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-400/40 space-y-1.5">
            <div class="font-display font-bold text-amber-300 uppercase">🛡️ 2. Ochrona Prawna, RODO (Art. 6, 8, 17) &amp; DSA</div>
            <p>• <strong>0,00 zł / Brak hazardu:</strong> Prywatny, hobbystyczny turniej <em>fan-made</em> (Skill-Based). Brak opłat i nagród pieniężnych; pełna niezależność od <em>First Touch Games Ltd.</em> (Fair Use).</p>
            <p>• <strong>Wiek (Art. 8 RODO):</strong> Rejestrując konto potwierdzasz ukończenie <strong>16 lat</strong> (lub wyraźną zgodę rodzica/opiekuna prawnego).</p>
            <p>• <strong>Twoje dane i wyłączenie roszczeń:</strong> Publikujemy wyłącznie nick/imię, opcjonalny awatar i kontakt FB/Messenger do umawiania meczów; hasło jest szyfrowane skrótem <code>smplh1$</code>. Brak odpowiedzialności za serwery gry/sieć i utratę wirtualnych punktów (AS IS). W każdej chwili możesz zażądać natychmiastowej anonimizacji wg Art. 17 RODO.</p>
            <p>• <strong>Czarna Lista &amp; DSA:</strong> Wpisy wykluczeń dotyczą wyłącznie obiektywnych naruszeń regulaminu opartych na dowodach (z prawem 7-dniowego odwołania); zgłoszenia treści bezprawnych działają w trybie <em>Notice &amp; Takedown</em>.</p>
          </div>
        </div>

        <div class="pt-2 flex flex-wrap items-center justify-end gap-2">
          <button type="button" onclick="SMPL_APP.closeModal()" class="btn-league px-4 py-2 rounded-xl font-display font-bold text-xs uppercase">
            Rozumiem — Wróć do Formularza
          </button>
        </div>
      </div>
    `;
  }

  

  // --- WIDOK PUBLICZNY CZARNEJ LISTY (DOŻYWOTNI BAN) ---
  function renderPublicBlacklistView(state) {
    const blacklist = state.blacklist || [];

    return `
      <div class="space-y-6">
        <div class="blacklist-showcase-banner rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 font-display font-black text-xs uppercase tracking-wider mb-2">
                ⚖️ REJESTR KAR I WYKLUCZEŃ — SCORE MATCH LIGA
              </div>
              <h2 class="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight">
                💀 Oficjalna Czarna Lista Score Match Ligi
              </h2>
              <p class="text-xs sm:text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
                W Score Match Lidze obowiązuje bezwzględny szacunek, uczciwość oraz zasady fair play. Osoby znajdujące się w poniższym rejestrze dopuściły się <strong>rażących oszustw meczowych (lag-switching), fałszowania zrzutów ekranu, tworzenia multikont lub agresji</strong> i decyzją Zarządu Ligi (Szymon Komenda) otrzymały <strong>DOŻYWOTNI ZAKAZ WSTĘPU</strong> do jakichkolwiek rozgrywek ligowych i pucharowych.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <div class="px-4 py-3 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-center">
                <div class="text-[10px] font-display uppercase tracking-widest text-rose-300">Wykluczonych na zawsze</div>
                <div class="font-display font-black text-2xl text-white mt-0.5">${blacklist.length}</div>
              </div>
              <button onclick="SMPL_APP.switchTab('standings')" class="btn-league px-4 py-3 rounded-2xl font-display font-bold text-xs uppercase shadow-xl">
                🏆 Wróć do Tabeli
              </button>
            </div>
          </div>
        </div>

        <div class="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-rose-500/30 flex items-start gap-3">
          <div class="text-2xl mt-0.5">⚠️</div>
          <div class="text-xs text-slate-300 leading-relaxed">
            <strong class="text-white">OSTRZEŻENIE DLA WSZYSTKICH UCZESTNIKÓW:</strong> Żaden zarejestrowany gracz ligowy nie ma prawa rozgrywać meczów rankingowych z osobami z Czarnej Listy. Próba ominięcia bana poprzez podstawianie innych kont lub podszywanie się skutkuje natychmiastowym walkowerem i zawieszeniem w prawach zawodnika.
          </div>
        </div>

        ${
          blacklist.length === 0
            ? `<div class="glass-panel rounded-2xl p-12 text-center text-slate-400">
                 <div class="text-4xl mb-2">🕊️</div>
                 <h3 class="font-display font-bold text-base text-white">Czarna Lista jest obecnie pusta</h3>
                 <p class="text-xs text-slate-400 mt-1">Wszyscy zawodnicy przestrzegają zasad fair play i kultury ligowej.</p>
               </div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                 ${blacklist.map((b) => `
                   <div class="glass-panel rounded-2xl p-5 border-2 border-rose-600/40 bg-gradient-to-br from-rose-950/30 via-slate-950 to-slate-950 flex flex-col justify-between">
                     <div>
                       <div class="flex items-center gap-3.5 pb-3 mb-3 border-b border-white/10">
                         <div class="relative">
                           <img src="${escapeHtml(b.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}" class="w-14 h-14 rounded-full object-cover rk-ring-blacklisted" alt="Banned Player" />
                           <span class="absolute -top-1 -right-1 bg-red-600 text-white text-[11px] w-6 h-6 rounded-full flex items-center justify-center font-black">💀</span>
                         </div>
                         <div class="min-w-0">
                           <div class="flex items-center gap-2 flex-wrap">
                             <h4 class="font-display font-black text-base text-white rk-name-blacklisted truncate">${escapeHtml(b.name)}</h4>
                             ${b.nick ? `<span class="text-xs text-rose-300 font-bold">(@${escapeHtml(b.nick)})</span>` : ''}
                           </div>
                           <div class="inline-block mt-1">
                             <span class="smpl-rank rk-blacklisted rk-sm"><span class="rk-ico">💀</span><span class="rk-txt">CZARNA LISTA • DOŻYWOTNI BAN</span></span>
                           </div>
                         </div>
                       </div>

                       <div class="space-y-2 text-xs">
                         <div class="text-slate-400">
                           Data wyroku: <strong class="text-slate-200">${escapeHtml(b.bannedAt || 'Nieznana')}</strong> • Wyrok wydał: <strong class="text-amber-300">${escapeHtml(b.bannedBy || 'Szymon Komenda')}</strong>
                         </div>
                         <div class="p-3 rounded-xl bg-black/60 border border-rose-500/30 text-rose-200 italic leading-relaxed">
                           „${escapeHtml(b.reason || 'Rażące złamanie regulaminu ligi.')}”
                         </div>
                         <div class="text-[11px] font-display font-bold text-rose-400 uppercase tracking-wide">
                           🚫 Zakres: ${escapeHtml(b.scope || 'DOŻYWOTNI ZAKAZ WSTĘPU DO WSZYSTKICH SEZONÓW')}
                         </div>
                       </div>
                     </div>

                     <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
                       <span class="text-slate-500">Decyzja: Ostateczna</span>
                       <span class="font-display font-black text-rose-500 uppercase tracking-wider">STAN: PERSONA NON GRATA</span>
                     </div>
                   </div>
                 `).join('')}
               </div>`
        }
      </div>
    `;
  }

  // =========================================================================
  // 12. ARENA KONKURSÓW PIŁKARSKICH SMPL (ZŁOTY BUT, PUCHAR LIGI KO, TYPER, PUSKÁS, FORMA, FAIR PLAY & KLANY)
  // =========================================================================
  function getCompetitionsSafeState(state) {
    if (state && state.competitions && typeof state.competitions === 'object') {
      return state.competitions;
    }
    return {
      season: (state && state.season) || 56,
      cup: { id: 'CUP_DEFAULT', name: 'Puchar Ligi SMPL', size: 8, status: 'NOT_STARTED', rounds: [], winnerPlayerId: null },
      typerOpen: true,
      typerPredictions: [],
      puskasOpen: true,
      puskasWinnerNominationId: null,
      puskasNominations: [],
      awardedHonors: {}
    };
  }

  function renderGoldenBootTabHtml(state, compState, comp, isAdmin) {
    const lgFilter = (compState && compState.goldenBootLeague) || 'ALL';
    const ranking = window.SMPL_ENGINE.calculateGoldenBootRanking(state, lgFilter);
    const activeLeagues = window.SMPL_DB && typeof window.SMPL_DB.getLeaguesList === 'function'
      ? window.SMPL_DB.getLeaguesList(state, false)
      : Object.keys(state.leagues || {}).map((id) => state.leagues[id]).filter((l) => l && l.enabled !== false);
    const top3 = ranking.slice(0, 3);
    const medals = [
      { label: '🥇 #1 ZŁOTY BUT SMPL', border: 'border-amber-400', glow: 'smpl-podium-1', bg: 'from-amber-500/20 to-slate-950', badge: 'bg-amber-400 text-slate-950' },
      { label: '🥈 #2 SREBRNY BUT', border: 'border-slate-300', glow: 'smpl-podium-2', bg: 'from-slate-500/20 to-slate-950', badge: 'bg-slate-200 text-slate-950' },
      { label: '🥉 #3 BRĄZOWY BUT', border: 'border-amber-700', glow: 'smpl-podium-3', bg: 'from-amber-700/25 to-slate-950', badge: 'bg-amber-600 text-white' }
    ];
    const honor = comp.awardedHonors && comp.awardedHonors.goldenBoot;

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-amber-400/35 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase flex items-center gap-2">
              <span>👟 Złoty But (Król Strzelców — European Golden Shoe)</span>
            </h3>
            <p class="text-xs text-slate-300 mt-1">
              W klasyfikacji ogólnej <strong class="text-amber-300">Cała SMPL</strong> gole mnożone są jak w Europie przez prestiż ligi (L1: <strong class="text-amber-300">×1.5</strong>, L2: <strong class="text-blue-300">×1.25</strong>, L3+: <strong class="text-emerald-300">×1.0</strong>). Ponieważ gramy do <strong class="text-white">max 2 bramek</strong>, w ramach jednej ligi decyduje liczba goli, <strong class="text-emerald-300">dublety (2 gole)</strong> i średnia na mecz.
            </p>
            ${honor ? `<div class="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold text-amber-200">👑 Oficjalny Złoty But Sezonu: ${escapeHtml(honor.playerName)} (${honor.goals} goli)</div>` : ''}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="SMPL_APP.setGoldenBootLeague('ALL')" class="px-3 py-1.5 rounded-xl text-xs font-display font-bold uppercase transition ${lgFilter === 'ALL' ? 'btn-league shadow-lg' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10'}">🌍 Cała SMPL</button>
            ${activeLeagues.map((lg) => `
              <button type="button" onclick="SMPL_APP.setGoldenBootLeague('${escapeHtml(lg.id)}')" class="px-3 py-1.5 rounded-xl text-xs font-display font-bold uppercase transition ${lgFilter === lg.id ? 'btn-league shadow-lg' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10'}">${escapeHtml(lg.shortName || lg.id)}</button>
            `).join('')}
            ${isAdmin && ranking.length > 0 ? `<button type="button" onclick="SMPL_APP.handleAdminAwardCompetition('golden_boot')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-xs font-display font-black uppercase">👑 Wręcz Złoty But (#1)</button>` : ''}
          </div>
        </div>

        ${
          top3.length === 0
            ? `<div class="p-8 rounded-2xl bg-slate-950/80 border border-white/10 text-center text-slate-400">
                 <div class="text-3xl mb-2">👟</div>
                 <div class="font-display font-bold text-white text-sm">Brak aktywnych strzelców w wybranej kategorii</div>
                 <p class="text-xs text-slate-400 mt-1">Gdy pojawią się zatwierdzone wyniki meczów, tabela Króla Strzelców wypełni się automatycznie.</p>
               </div>`
            : `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                 ${top3.map((item, idx) => {
                   const m = medals[idx];
                   return `
                     <div onclick="SMPL_APP.openPlayerModal('${item.playerId}')" class="cursor-pointer rounded-2xl p-5 bg-gradient-to-br ${m.bg} border-2 ${m.border} ${m.glow} shadow-xl hover:scale-[1.01] transition">
                       <div class="flex items-center justify-between mb-3">
                         <span class="px-2.5 py-1 rounded-lg font-display font-black text-[11px] ${m.badge}">${m.label}</span>
                         <span class="px-2 py-0.5 rounded bg-slate-950/90 border border-white/15 text-[11px] font-bold text-amber-300">${escapeHtml(item.leagueId)} • ×${item.multiplier}</span>
                       </div>
                       <div class="flex items-center gap-3.5">
                         <img src="${item.avatar}" class="w-16 h-16 rounded-full object-cover border-2 ${m.border}" alt="${escapeHtml(item.name)}"/>
                         <div class="min-w-0">
                           <div class="font-display font-black text-base text-white truncate">${escapeHtml(item.name)}</div>
                           <div class="text-xs text-slate-400">@${escapeHtml(item.nick)} • Poz. #${item.leaguePos}</div>
                           <div class="mt-2 flex items-baseline gap-2">
                             <span class="font-display font-black text-2xl text-amber-400">⚽ ${item.goalsFor}</span>
                             <span class="text-xs text-slate-300 font-semibold">Goli (${item.goldenShoePoints} pkt ZB)</span>
                           </div>
                         </div>
                       </div>
                       <div class="mt-4 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
                         <div><div class="text-[10px] text-slate-400">ŚR. / MECZ</div><div class="font-bold text-white">${item.goalsPerMatch}</div></div>
                         <div><div class="text-[10px] text-slate-400">DUBLETY (2G)</div><div class="font-bold text-amber-300">⚡ ${item.braces}</div></div>
                         <div><div class="text-[10px] text-slate-400">WYJAZD</div><div class="font-bold text-emerald-400">✈️ ${item.awayGoals}</div></div>
                       </div>
                     </div>
                   `;
                 }).join('')}
               </div>`
        }

        <div class="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <div class="p-4 sm:px-6 border-b border-white/10 bg-slate-900/50 flex items-center justify-between">
            <h4 class="font-display font-bold text-sm uppercase tracking-wider text-white">Klasyfikacja Strzelców (${ranking.length} zawodników)</h4>
            <span class="text-xs text-amber-300 font-semibold">⚽ Max 2 bramki/mecz • Dublety + Współczynnik Ligi</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse min-w-[740px]">
              <thead>
                <tr class="border-b border-white/10 bg-slate-950/70 text-[11px] font-display uppercase tracking-wider text-slate-400">
                  <th class="py-3 pl-4 pr-2 text-center w-14">Poz.</th>
                  <th class="py-3 px-3">Strzelec</th>
                  <th class="py-3 px-3 text-center">Liga</th>
                  <th class="py-3 px-3 text-center bg-amber-500/10 text-amber-300 font-black">⚽ Gole (BZ)</th>
                  <th class="py-3 px-3 text-center">👟 Golden Shoe Pkt</th>
                  <th class="py-3 px-3 text-center">Mecze / Śr.</th>
                  <th class="py-3 px-3 text-center">⚡ Dublety (2 gole)</th>
                  <th class="py-3 px-3">🔥 Najlepszy Występ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/5 text-xs sm:text-sm font-mono-num">
                ${ranking.map((r) => `
                  <tr onclick="SMPL_APP.openPlayerModal('${r.playerId}')" class="cursor-pointer hover:bg-white/5 transition">
                    <td class="py-3 pl-4 pr-2 text-center font-display font-black text-amber-300">#${r.rank}</td>
                    <td class="py-3 px-3">
                      <div class="flex items-center gap-2.5">
                        <img src="${r.avatar}" class="w-8 h-8 rounded-full object-cover border border-white/20" alt=""/>
                        <div>
                          <div class="font-bold text-white">${escapeHtml(r.name)}</div>
                          <div class="text-[11px] text-slate-400">@${escapeHtml(r.nick)}</div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3 px-3 text-center"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-xs font-bold">${escapeHtml(r.leagueId)} (×${r.multiplier})</span></td>
                    <td class="py-3 px-3 text-center bg-amber-500/10 font-display font-black text-base text-amber-300">${r.goalsFor}</td>
                    <td class="py-3 px-3 text-center font-bold text-emerald-300">${r.goldenShoePoints}</td>
                    <td class="py-3 px-3 text-center text-slate-300">${r.M} (${r.goalsPerMatch}/m)</td>
                    <td class="py-3 px-3 text-center text-amber-300 font-bold">⚡ ${r.braces}</td>
                    <td class="py-3 px-3 text-xs text-slate-300">${r.bestMatchText ? escapeHtml(r.bestMatchText) : '<span class="text-slate-500">—</span>'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  function renderLeagueCupTabHtml(state, comp, isAdmin) {
    const cup = comp.cup || { status: 'NOT_STARTED', rounds: [], winnerPlayerId: null };
    const playersMap = {};
    (state.players || []).forEach((p) => { if (p && p.id) playersMap[p.id] = p; });
    const cupWinner = cup.winnerPlayerId && playersMap[cup.winnerPlayerId] ? playersMap[cup.winnerPlayerId] : null;
    const honor = comp.awardedHonors && comp.awardedHonors.cupWinner;

    function resolveSlot(pid) {
      if (pid === 'BYE') return { name: 'WOLNY LOS (BYE)', nick: 'Automatyczny awans', avatar: '', isBye: true, isTbd: false };
      if (!pid || !playersMap[pid]) return { name: 'Oczekuje na rywala...', nick: 'Zwycięzca poprzedniej rundy', avatar: '', isBye: false, isTbd: true };
      const p = playersMap[pid];
      return { name: p.name, nick: '@' + (p.nick || 'SMPL') + ' • ' + (p.leagueId || ''), avatar: p.avatar || '', isBye: false, isTbd: false };
    }

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-amber-400/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase">🏆 Puchar Ligi SMPL — Turniej Pucharowy (Knockout)</h3>
            <p class="text-xs text-slate-300 mt-1">
              Prawdziwy system pucharowy jak FA Cup / Puchar Polski łączący zawodników ze wszystkich aktywnych lig! Przegrany odpada, przy remisie decydują rzuty karne, a triumfator Wielkiego Finału zgarnia legendarny puchar do Gabloty.
            </p>
            ${cupWinner ? `<div class="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400 text-amber-200 text-xs font-bold">👑 TRIUMFATOR PUCHARU LIGI SMPL: ${escapeHtml(cupWinner.name)} (@${escapeHtml(cupWinner.nick)})${honor ? ' • 🏆 Trofeum wręczone' : ''}</div>` : ''}
          </div>
          ${
            isAdmin
              ? `<form onsubmit="SMPL_APP.handleGenerateCupBracket(event)" class="flex flex-wrap items-center gap-2">
                   <select id="cup-draw-size" class="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold">
                     <option value="4" ${cup.size === 4 ? 'selected' : ''}>Drabinka 4 graczy (1/2)</option>
                     <option value="8" ${cup.size === 8 || !cup.size ? 'selected' : ''}>Drabinka 8 graczy (1/4)</option>
                     <option value="16" ${cup.size === 16 ? 'selected' : ''}>Drabinka 16 graczy (1/8)</option>
                   </select>
                   <select id="cup-draw-mode" class="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold">
                     <option value="TOP_RANKED" ${cup.mode === 'TOP_RANKED' ? 'selected' : ''}>Rozstawienie wg Tabeli</option>
                     <option value="RANDOM_DRAW" ${cup.mode === 'RANDOM_DRAW' ? 'selected' : ''}>Otwarte Losowanie Pucharu</option>
                   </select>
                   <button type="submit" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase shadow-lg">🎲 Rozlosuj Puchar</button>
                   ${cup.winnerPlayerId ? `<button type="button" onclick="SMPL_APP.handleAdminAwardCompetition('cup')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-amber-200 text-xs font-display font-black uppercase">👑 Wręcz Puchar Zwycięzcy</button>` : ''}
                   ${cup.rounds && cup.rounds.length > 0 ? `<button type="button" onclick="SMPL_APP.handleClearCupBracket()" class="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-xs font-bold">🧹 Reset</button>` : ''}
                 </form>`
              : ''
          }
        </div>

        ${
          !cup.rounds || cup.rounds.length === 0
            ? `<div class="p-8 rounded-2xl bg-slate-950/80 border border-white/10 text-center space-y-2">
                 <div class="text-4xl">🏆⚔️</div>
                 <div class="font-display font-black text-base text-white uppercase">Drabinka Pucharu Ligi czeka na losowanie</div>
                 <p class="text-xs text-slate-400 max-w-xl mx-auto">Gdy w ligach znajdzie się min. 2 aktywnych zawodników, Administracja może jednym kliknięciem rozlosować drabinkę 1/8, 1/4 lub Półfinałów Pucharu Ligi SMPL.</p>
               </div>`
            : `<div class="overflow-x-auto pb-2">
                 <div class="flex gap-4 min-w-[740px]">
                   ${cup.rounds.map((rd) => `
                     <div class="flex-1 space-y-3">
                       <div class="px-3 py-2 rounded-xl bg-slate-900 border border-amber-400/30 text-center font-display font-black text-xs uppercase text-amber-300 tracking-wider">
                         ${escapeHtml(rd.name)}
                       </div>
                       <div class="space-y-3">
                         ${(rd.matches || []).map((cm) => {
                           const hInfo = resolveSlot(cm.homeId);
                           const aInfo = resolveSlot(cm.awayId);
                           const canRecord = isAdmin && cm.homeId && cm.awayId && cm.homeId !== 'BYE' && cm.awayId !== 'BYE';
                           const hWin = cm.winnerId && cm.winnerId === cm.homeId;
                           const aWin = cm.winnerId && cm.winnerId === cm.awayId;
                           const penMarkH = cm.penaltyWinnerId === cm.homeId ? ' (k.)' : '';
                           const penMarkA = cm.penaltyWinnerId === cm.awayId ? ' (k.)' : '';
                           return `
                             <div class="p-3 rounded-2xl bg-slate-950/90 border ${cm.status === 'FINISHED' ? 'border-emerald-500/40' : 'border-white/15'} space-y-2 shadow-lg">
                               <div class="flex items-center justify-between gap-2 p-2 rounded-xl ${hWin ? 'bg-amber-400/15 border border-amber-400/40' : 'bg-slate-900/70'}">
                                 <div class="flex items-center gap-2 min-w-0">
                                   ${hInfo.avatar ? `<img src="${hInfo.avatar}" class="w-7 h-7 rounded-full object-cover border border-white/20" alt=""/>` : `<span class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs">${hInfo.isBye ? '⏩' : '❓'}</span>`}
                                   <div class="min-w-0">
                                     <div class="font-bold text-xs truncate ${hWin ? 'text-amber-300' : hInfo.isBye || hInfo.isTbd ? 'text-slate-400 italic' : 'text-white'}">${escapeHtml(hInfo.name)}</div>
                                     <div class="text-[10px] text-slate-400 truncate">${escapeHtml(hInfo.nick)}</div>
                                   </div>
                                 </div>
                                 <span class="font-display font-black text-sm ${hWin ? 'text-amber-300' : 'text-slate-300'}">${cm.homeScore !== null && cm.homeScore !== undefined ? cm.homeScore + penMarkH : '-'}</span>
                               </div>

                               <div class="flex items-center justify-between gap-2 p-2 rounded-xl ${aWin ? 'bg-amber-400/15 border border-amber-400/40' : 'bg-slate-900/70'}">
                                 <div class="flex items-center gap-2 min-w-0">
                                   ${aInfo.avatar ? `<img src="${aInfo.avatar}" class="w-7 h-7 rounded-full object-cover border border-white/20" alt=""/>` : `<span class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs">${aInfo.isBye ? '⏩' : '❓'}</span>`}
                                   <div class="min-w-0">
                                     <div class="font-bold text-xs truncate ${aWin ? 'text-amber-300' : aInfo.isBye || aInfo.isTbd ? 'text-slate-400 italic' : 'text-white'}">${escapeHtml(aInfo.name)}</div>
                                     <div class="text-[10px] text-slate-400 truncate">${escapeHtml(aInfo.nick)}</div>
                                   </div>
                                 </div>
                                 <span class="font-display font-black text-sm ${aWin ? 'text-amber-300' : 'text-slate-300'}">${cm.awayScore !== null && cm.awayScore !== undefined ? cm.awayScore + penMarkA : '-'}</span>
                               </div>

                               ${
                                 cm.status === 'BYE'
                                   ? `<div class="text-[10px] text-center text-emerald-400 font-bold uppercase">Wolny Los — automatyczny awans</div>`
                                   : canRecord
                                   ? `<button type="button" onclick="SMPL_APP.openCupMatchModal('${escapeHtml(cm.id)}')" class="w-full py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/35 border border-blue-400/40 text-blue-200 text-[11px] font-display font-bold uppercase transition">
                                        ${cm.status === 'FINISHED' ? '✏️ Popraw Wynik Pucharu' : '⚽ Wpisz Wynik Meczu'}
                                      </button>`
                                   : ''
                               }
                             </div>
                           `;
                         }).join('')}
                       </div>
                     </div>
                   `).join('')}
                 </div>
               </div>`
        }
      </div>
    `;
  }

  function renderTyperTabHtml(state, comp, session, isAdmin) {
    const typerData = window.SMPL_ENGINE.calculateTyperLeaderboard(state);
    const isLogged = Boolean(session && !session.isGuest && (session.isPlayerAuthenticated || isAdmin));
    let myActorId = '';
    if (isAdmin && session) myActorId = 'ADM_' + String(session.adminId || 'ADM');
    else if (session && session.activePlayerId) myActorId = 'PLR_' + String(session.activePlayerId);
    else if (session && session.activeRegId) myActorId = 'REG_' + String(session.activeRegId);

    const honor = comp.awardedHonors && comp.awardedHonors.typerChampion;

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-purple-500/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase">🔮 Typer Kolejki SMPL (Liga Ekspertów 1X2 & Dokładny Wynik)</h3>
            <p class="text-xs text-slate-300 mt-1">
              Typuj wyniki nadchodzących meczów ligowych zanim zostaną rozegrane! Punktacja automatyczna po zatwierdzeniu meczu:
              <strong class="text-amber-300">🎯 Dokładny wynik = +5 PKT</strong> •
              <strong class="text-emerald-300">✅ Zwycięzca + różnica (lub inny remis) = +3 PKT</strong> •
              <strong class="text-blue-300">👍 Zwycięzca 1X2 = +1 PKT</strong>.
            </p>
            ${honor ? `<div class="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-[11px] font-bold text-purple-200">🔮 Mistrz Typera: ${escapeHtml(honor.playerName)} (${honor.points} pkt)</div>` : ''}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs font-bold ${comp.typerOpen !== false ? 'text-emerald-300' : 'text-rose-300'}">
              ${comp.typerOpen !== false ? '🟢 Typowanie OTWARTE' : '🔴 Typowanie ZAMKNIĘTE'}
            </span>
            ${isAdmin && typerData.leaderboard.length > 0 && typerData.leaderboard[0].voterPlayerId ? `<button type="button" onclick="SMPL_APP.handleAdminAwardCompetition('typer')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-amber-200 text-xs font-display font-black uppercase">👑 Wręcz Mistrza Typera (#1)</button>` : ''}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-6 glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
            <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h4 class="font-display font-black text-sm sm:text-base text-white uppercase">⚽ Nadchodzące Mecze do Wytypowania (${typerData.upcomingMatches.length})</h4>
            </div>
            ${
              !isLogged
                ? `<div class="p-4 rounded-xl bg-slate-950 border border-amber-400/30 text-center space-y-2">
                     <div class="text-2xl">🔒</div>
                     <div class="text-xs font-bold text-amber-300 uppercase">Zaloguj się, aby typować mecze i walczyć o Trofeum Typera!</div>
                     <button type="button" onclick="SMPL_APP.handleGateLock()" class="btn-league px-4 py-2 rounded-xl font-display font-black text-xs uppercase">🔑 Zaloguj się</button>
                   </div>`
                : ''
            }
            ${
              typerData.upcomingMatches.length === 0
                ? `<div class="p-6 rounded-xl bg-slate-950/70 border border-white/10 text-center text-xs text-slate-400">
                     Brak zaplanowanych meczów ze statusem SCHEDULED do wytypowania. Wygeneruj terminarz kolejki, aby otworzyć zakłady Typera!
                   </div>`
                : `<div class="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                     ${typerData.upcomingMatches.slice(0, 24).map((item) => {
                       const m = item.match;
                       const myPred = myActorId ? (item.predictions || []).find((pr) => pr && pr.voterId === myActorId) : null;
                       const phVal = myPred ? myPred.predHome : '';
                       const paVal = myPred ? myPred.predAway : '';
                       return `
                         <form onsubmit="SMPL_APP.handleTyperPredictionSubmit(event, '${escapeHtml(m.id)}')" class="p-3.5 rounded-2xl bg-slate-950/85 border ${myPred ? 'border-emerald-500/40' : 'border-white/10'} space-y-2.5">
                           <div class="flex items-center justify-between text-[11px] text-slate-400">
                             <span class="font-bold text-amber-300">${escapeHtml(m.leagueId)} • Kolejka ${m.round} (Tydz. ${item.week})</span>
                             <span>👥 Typów społeczności: <strong class="text-white">${item.predictionCount}</strong></span>
                           </div>
                           <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                             <div class="text-xs font-bold text-white flex-1 truncate">
                               ${escapeHtml(item.homePlayer.name)} <span class="text-slate-400">vs</span> ${escapeHtml(item.awayPlayer.name)}
                             </div>
                             ${
                               isLogged && (comp.typerOpen !== false || isAdmin)
                                 ? `<div class="flex items-center gap-1.5 flex-shrink-0">
                                      <input id="typer-home-${escapeHtml(m.id)}" type="number" min="0" max="2" required value="${phVal}" placeholder="0" class="w-12 px-2 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-center font-display font-black text-white text-sm"/>
                                      <span class="font-bold text-slate-400">:</span>
                                      <input id="typer-away-${escapeHtml(m.id)}" type="number" min="0" max="2" required value="${paVal}" placeholder="0" class="w-12 px-2 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-center font-display font-black text-white text-sm"/>
                                      <button type="submit" class="px-3 py-1.5 rounded-lg ${myPred ? 'bg-emerald-600 hover:bg-emerald-500' : 'btn-league'} text-white text-[11px] font-display font-black uppercase">${myPred ? 'Zmień' : 'Typuj'}</button>
                                    </div>`
                                 : ''
                             }
                           </div>
                           ${myPred ? `<div class="text-[11px] text-emerald-400 font-semibold">✅ Twój zapisany typ: <strong>${myPred.predHome}:${myPred.predAway}</strong></div>` : ''}
                         </form>
                       `;
                     }).join('')}
                   </div>`
            }
          </div>

          <div class="lg:col-span-6 space-y-5">
            <div class="glass-panel rounded-2xl p-5 border border-white/10">
              <h4 class="font-display font-black text-sm sm:text-base text-white uppercase pb-2.5 mb-3 border-b border-white/10">
                🏆 Ranking Typerów Na Żywo (${typerData.leaderboard.length})
              </h4>
              ${
                typerData.leaderboard.length === 0
                  ? `<div class="p-6 text-center text-xs text-slate-400">Nikt jeszcze nie oddał typu w tym sezonie. Bądź pierwszy!</div>`
                  : `<div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                       ${typerData.leaderboard.map((row) => `
                         <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex items-center justify-between gap-3">
                           <div class="flex items-center gap-3 min-w-0">
                             <span class="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-xs ${row.rank === 1 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'}">#${row.rank}</span>
                             ${row.avatar ? `<img src="${row.avatar}" class="w-8 h-8 rounded-full object-cover border border-white/20" alt=""/>` : ''}
                             <div class="min-w-0">
                               <div class="font-bold text-white text-xs sm:text-sm truncate">${escapeHtml(row.voterName)}</div>
                               <div class="text-[11px] text-slate-400">Rozlicz.: ${row.settledPreds} (Ocz.: ${row.pendingPreds}) • 🎯 ${row.exactHits} • ✅ ${row.diffHits} • 👍 ${row.outcomeHits}</div>
                             </div>
                           </div>
                           <div class="text-right flex-shrink-0">
                             <div class="font-display font-black text-base text-amber-300">${row.totalPoints} PKT</div>
                             <div class="text-[10px] text-emerald-400 font-bold">Skut.: ${row.accuracyPct}%</div>
                           </div>
                         </div>
                       `).join('')}
                     </div>`
              }
            </div>

            ${
              typerData.recentSettled.length > 0
                ? `<div class="glass-panel rounded-2xl p-5 border border-white/10">
                     <h4 class="font-display font-black text-xs uppercase text-slate-300 mb-2.5">📊 Ostatnio Rozliczone Kupony:</h4>
                     <div class="space-y-2 max-h-60 overflow-y-auto pr-1 text-xs">
                       ${typerData.recentSettled.map((rs) => `
                         <div class="p-2.5 rounded-xl bg-slate-950/90 border border-white/10 flex items-center justify-between gap-2">
                           <div>
                             <span class="font-bold text-white">${escapeHtml(rs.voterName)}</span>:
                             <span class="text-slate-300">${escapeHtml(rs.matchLabel)}</span>
                             <span class="text-slate-400">(typ ${escapeHtml(rs.predScore)} • wynik ${escapeHtml(rs.realScore)})</span>
                           </div>
                           <span class="font-bold ${rs.points >= 5 ? 'text-amber-300' : rs.points > 0 ? 'text-emerald-400' : 'text-slate-500'}">+${rs.points} pkt</span>
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

  function renderPuskasTabHtml(state, comp, session, isAdmin) {
    const pData = window.SMPL_ENGINE.calculatePuskasStandings(state);
    const isLogged = Boolean(session && !session.isGuest && (session.isPlayerAuthenticated || isAdmin));
    let myActorId = '';
    if (isAdmin && session) myActorId = 'ADM_' + String(session.adminId || 'ADM');
    else if (session && session.activePlayerId) myActorId = 'PLR_' + String(session.activePlayerId);
    else if (session && session.activeRegId) myActorId = 'REG_' + String(session.activeRegId);

    const activePlayers = (state.players || []).filter((p) => p && p.active !== false && !p.isPlaceholder && p.leagueId !== 'POOL');
    const playersMap = {};
    (state.players || []).forEach((p) => { if (p && p.id) playersMap[p.id] = p; });
    const approvedMatches = (state.matches || []).filter((m) => m && m.status === 'APPROVED').slice().reverse().slice(0, 40);
    const honor = comp.awardedHonors && comp.awardedHonors.puskasWinner;

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-4 sm:p-5 border border-blue-400/35 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase">🥅 Nagroda Puskása SMPL (Najpiękniejszy Gol Sezonu)</h3>
            <p class="text-xs text-slate-300 mt-1">
              Nominuj kosmiczne wolne, przewrotki, loby i comebacki z meczów Score! Match! Głosuj na najpiękniejszą bramkę sezonu — zwycięzca zgarnia kryształową statuetkę Puskása do Gabloty Trofeów!
            </p>
            ${honor ? `<div class="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400 text-[11px] font-bold text-amber-200">🥅 Laureat Nagrody Puskása: ${escapeHtml(honor.playerName)} („${escapeHtml(honor.title)}”)</div>` : ''}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/15 text-xs font-bold text-blue-300">🗳️ Głosów: ${pData.totalVotes}</span>
            ${isAdmin && pData.nominations.length > 0 ? `<button type="button" onclick="SMPL_APP.handleAdminAwardCompetition('puskas')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-amber-200 text-xs font-display font-black uppercase">👑 Wręcz Nagrodę Puskása (#1)</button>` : ''}
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div class="lg:col-span-5 glass-panel rounded-2xl p-5 border border-white/10">
            <h4 class="font-display font-black text-base text-white uppercase mb-1">🎬 Zgłoś Bramkę do Puskása</h4>
            <p class="text-xs text-slate-400 mb-4">Możesz podpiąć zatwierdzony mecz lub wkleić link do powtórki / screena.</p>
            ${
              !isLogged
                ? `<div class="p-4 rounded-xl bg-slate-950 border border-amber-400/30 text-center space-y-2">
                     <div class="text-2xl">🔒</div>
                     <div class="text-xs font-bold text-amber-300 uppercase">Zaloguj się, aby nominować bramki i głosować</div>
                     <button type="button" onclick="SMPL_APP.handleGateLock()" class="btn-league px-4 py-2 rounded-xl font-display font-black text-xs uppercase">🔑 Zaloguj się</button>
                   </div>`
                : `<form onsubmit="SMPL_APP.handlePuskasNominateSubmit(event)" class="space-y-3">
                     <div>
                       <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Strzelec Bramki *</label>
                       <select id="puskas-player-id" required class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold">
                         ${activePlayers.map((p) => `<option value="${escapeHtml(p.id)}">[${escapeHtml(p.leagueId)}] ${escapeHtml(p.name)} (@${escapeHtml(p.nick)})</option>`).join('')}
                       </select>
                     </div>
                     <div>
                       <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Zatwierdzony Mecz (opcjonalnie)</label>
                       <select id="puskas-match-id" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white">
                         <option value="">— Bez powiązania z konkretnym meczem —</option>
                         ${approvedMatches.map((m) => {
                           const hp = playersMap[m.homeId];
                           const ap = playersMap[m.awayId];
                           return `<option value="${escapeHtml(m.id)}">[${escapeHtml(m.leagueId)} K.${m.round}] ${escapeHtml(hp ? hp.name : m.homeId)} ${m.homeScore}:${m.awayScore} ${escapeHtml(ap ? ap.name : m.awayId)}</option>`;
                         }).join('')}
                       </select>
                     </div>
                     <div>
                       <label class="block text-xs font-display uppercase text-amber-300 mb-1 font-bold">Nazwa / Tytuł Bramki *</label>
                       <input id="puskas-title" type="text" required minlength="4" maxlength="100" placeholder="np. Bomba z 30m w okienko w 89. minucie" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
                     </div>
                     <div>
                       <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Opis Akcji (opcjonalnie)</label>
                       <input id="puskas-desc" type="text" maxlength="240" placeholder="np. Podcinka nad bramkarzem po kontrze 3 podaniami" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
                     </div>
                     <div>
                       <label class="block text-xs font-display uppercase text-slate-300 mb-1 font-bold">Link do Powtórki / Screena https:// (opcjonalnie)</label>
                       <input id="puskas-clip" type="url" placeholder="https://..." class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"/>
                     </div>
                     <button type="submit" class="w-full btn-league py-3 rounded-xl font-display font-black text-xs uppercase shadow-lg">🥅 Dodaj Nominację do Puskása</button>
                   </form>`
            }
          </div>

          <div class="lg:col-span-7 glass-panel rounded-2xl p-5 border border-white/10">
            <h4 class="font-display font-black text-base text-white uppercase pb-3 mb-4 border-b border-white/10">
              ⭐ Nominowane Bramki & Głosowanie (${pData.nominations.length})
            </h4>
            ${
              pData.nominations.length === 0
                ? `<div class="p-8 text-center text-xs text-slate-400">Brak zgłoszonych bramek w Nagrodzie Puskása. Zgłoś pierwszą akcję z formularza obok!</div>`
                : `<div class="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                     ${pData.nominations.map((nom) => {
                       const hasVoted = myActorId && (nom.votes || []).indexOf(myActorId) >= 0;
                       return `
                         <div class="p-4 rounded-2xl bg-slate-950/90 border ${nom.rank === 1 ? 'border-amber-400/60' : 'border-white/10'} space-y-2">
                           <div class="flex items-start justify-between gap-3">
                             <div class="flex items-center gap-3 min-w-0">
                               <span class="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-xs flex-shrink-0 ${nom.rank === 1 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}">#${nom.rank}</span>
                               ${nom.avatar ? `<img src="${nom.avatar}" class="w-9 h-9 rounded-full object-cover border border-white/20" alt=""/>` : ''}
                               <div class="min-w-0">
                                 <div class="font-display font-black text-sm text-white truncate">${escapeHtml(nom.title)}</div>
                                 <div class="text-xs text-amber-300 font-bold">${escapeHtml(nom.playerName)} <span class="text-slate-400">(@${escapeHtml(nom.nick)} • ${escapeHtml(nom.leagueId)})</span></div>
                               </div>
                             </div>
                             <div class="flex items-center gap-2 flex-shrink-0">
                               <span class="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/15 font-display font-black text-xs text-amber-300">🔥 ${nom.votesCount} gł.</span>
                               ${isLogged ? `<button type="button" onclick="SMPL_APP.handlePuskasVote('${escapeHtml(nom.id)}')" class="px-3 py-1.5 rounded-xl text-[11px] font-display font-black uppercase transition ${hasVoted ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'btn-league'}">${hasVoted ? '✅ Głos oddany' : '⚽ Zagłosuj'}</button>` : ''}
                             </div>
                           </div>
                           ${nom.description ? `<p class="text-xs text-slate-300 italic">„${escapeHtml(nom.description)}”</p>` : ''}
                           <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                             <span>${nom.matchSummary ? '⚽ Mecz: ' + escapeHtml(nom.matchSummary) : 'Zgłosił: ' + escapeHtml(nom.nominatedByName)}</span>
                             <div class="flex items-center gap-2">
                               ${nom.clipUrl ? `<a href="${escapeHtml(nom.clipUrl)}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-white underline font-bold">🎥 Zobacz powtórkę</a>` : ''}
                               ${session && session.linkMode === 'MASTER' && isAdmin ? `<button type="button" onclick="SMPL_APP.handleMasterCompetitionAction('puskas_delete:${escapeHtml(nom.id)}')" class="text-rose-400 hover:text-rose-300 font-bold">🗑️ Usuń</button>` : ''}
                             </div>
                           </div>
                         </div>
                       `;
                     }).join('')}
                   </div>`
            }
          </div>
        </div>
      </div>
    `;
  }

  function renderFormAndRecordsTabHtml(state, comp, isAdmin) {
    const data = window.SMPL_ENGINE.calculateSeasonFormAndRecords(state);
    const invTop = data.invincibles.slice(0, 6);
    const hotTop = data.last5Form.slice(0, 6);
    const homeTop = data.homeKings.slice(0, 5);
    const awayTop = data.awayKings.slice(0, 5);
    const rec = data.records || {};
    const honor = comp.awardedHonors && comp.awardedHonors.mvpForm;

    return `
      <div class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="glass-panel rounded-2xl p-5 border border-rose-500/35">
            <div class="text-xs font-display font-black uppercase text-rose-400 mb-1">💥 Największy Pogrom Sezonu</div>
            ${
              rec.biggestWin
                ? `<div class="font-display font-black text-xl text-white">${escapeHtml(rec.biggestWin.winnerName)} ${escapeHtml(rec.biggestWin.scoreText)} ${escapeHtml(rec.biggestWin.loserName)}</div>
                   <div class="text-xs text-slate-400 mt-1">${escapeHtml(rec.biggestWin.leagueId)} • Kolejka ${rec.biggestWin.round} • Przewaga +${rec.biggestWin.margin} goli</div>`
                : `<div class="text-xs text-slate-400">Brak zatwierdzonych meczów z różnicą bramek.</div>`
            }
          </div>
          <div class="glass-panel rounded-2xl p-5 border border-amber-400/35">
            <div class="text-xs font-display font-black uppercase text-amber-300 mb-1">🎆 Mecz-Thriller (Najwięcej Bramkowych Emocji)</div>
            ${
              rec.highestScoring
                ? `<div class="font-display font-black text-xl text-white">${escapeHtml(rec.highestScoring.homeName)} ${escapeHtml(rec.highestScoring.scoreText)} ${escapeHtml(rec.highestScoring.awayName)}</div>
                   <div class="text-xs text-slate-400 mt-1">${escapeHtml(rec.highestScoring.leagueId)} • Kolejka ${rec.highestScoring.round} • Łącznie ${rec.highestScoring.totalGoals} bramek w meczu</div>`
                : `<div class="text-xs text-slate-400">Brak zatwierdzonych spotkań bramkowych.</div>`
            }
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="glass-panel rounded-2xl p-5 border border-emerald-500/35 space-y-3">
            <div class="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div>
                <h4 class="font-display font-black text-base text-white uppercase">🛡️ Klub Niepokonanych (Invincibles)</h4>
                <p class="text-[11px] text-slate-400">Najdłuższa seria meczów bez porażki oraz passy zwycięstw z rzędu</p>
              </div>
              ${isAdmin && invTop.length > 0 ? `<button type="button" onclick="SMPL_APP.handleAdminAwardCompetition('mvp_form')" class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-amber-200 text-[11px] font-bold">👑 Wręcz MVP (#1)</button>` : ''}
            </div>
            ${honor ? `<div class="text-[11px] text-amber-300 font-bold">🏅 Wyróżniony Invincible: ${escapeHtml(honor.playerName)} (${honor.streak} meczów bez porażki)</div>` : ''}
            <div class="space-y-2.5">
              ${invTop.length === 0 ? `<div class="text-xs text-slate-400">Brak danych z rozegranych meczów.</div>` : invTop.map((r, idx) => `
                <div onclick="SMPL_APP.openPlayerModal('${r.playerId}')" class="cursor-pointer p-3 rounded-xl bg-slate-950/85 border border-white/10 hover:border-amber-400/50 flex items-center justify-between gap-3 transition">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="w-6 h-6 rounded bg-slate-800 flex items-center justify-center font-display font-black text-xs text-emerald-400">#${idx + 1}</span>
                    <img src="${r.avatar}" class="w-8 h-8 rounded-full object-cover border border-white/20" alt=""/>
                    <div class="min-w-0">
                      <div class="font-bold text-white text-xs sm:text-sm truncate">${escapeHtml(r.name)} <span class="text-slate-400">(${escapeHtml(r.leagueId)})</span></div>
                      <div class="text-[11px] text-slate-400">Aktualnie bez porażki: ${r.currentUnbeaten} • Seria wygranych: ${r.currentWin} (max ${r.longestWin})</div>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div class="font-display font-black text-base text-emerald-400">${r.longestUnbeaten} meczów</div>
                    <div class="text-[10px] text-slate-400">REKORD BEZ PORAŻKI</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="glass-panel rounded-2xl p-5 border border-amber-400/35 space-y-3">
            <div class="pb-2 border-b border-white/10">
              <h4 class="font-display font-black text-base text-white uppercase">🔥 Gorąca Forma Kolejki (Last 5 MVP)</h4>
              <p class="text-[11px] text-slate-400">Kto aktualnie jest w najlepszej dyspozycji w ostatnich 5 meczach</p>
            </div>
            <div class="space-y-2.5">
              ${hotTop.length === 0 ? `<div class="text-xs text-slate-400">Brak rozegranych spotkań.</div>` : hotTop.map((r, idx) => `
                <div onclick="SMPL_APP.openPlayerModal('${r.playerId}')" class="cursor-pointer p-3 rounded-xl bg-slate-950/85 border border-white/10 hover:border-amber-400/50 flex items-center justify-between gap-3 transition">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="w-6 h-6 rounded bg-slate-800 flex items-center justify-center font-display font-black text-xs text-amber-300">#${idx + 1}</span>
                    <img src="${r.avatar}" class="w-8 h-8 rounded-full object-cover border border-white/20" alt=""/>
                    <div class="min-w-0">
                      <div class="font-bold text-white text-xs sm:text-sm truncate">${escapeHtml(r.name)} <span class="text-slate-400">(${escapeHtml(r.leagueId)})</span></div>
                      <div class="flex items-center gap-1 mt-0.5">
                        ${(r.last5Badges || []).map((b) => `<span class="w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${b === 'Z' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : b === 'R' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'}">${b}</span>`).join('')}
                        <span class="text-[11px] text-slate-400 ml-1">Bramki: ${escapeHtml(r.last5Score)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div class="font-display font-black text-base text-amber-300">${r.last5Points} PKT</div>
                    <div class="text-[10px] text-slate-400">OST. ${r.last5Games} MECZÓW</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="glass-panel rounded-2xl p-5 border border-white/10 space-y-2.5">
            <h4 class="font-display font-black text-sm uppercase text-blue-300 pb-2 border-b border-white/10">🏠 Twierdza Domowa (Najlepsi Gospodarze)</h4>
            ${homeTop.map((r, idx) => `
              <div class="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-xs">
                <span class="font-bold text-white">#${idx + 1} ${escapeHtml(r.name)} <span class="text-slate-400">(${r.homeW}-${r.homeR}-${r.homeP}, ${r.homeBZ}:${r.homeBS})</span></span>
                <span class="font-display font-black text-blue-300">${r.homePKT} pkt u siebie</span>
              </div>
            `).join('') || '<div class="text-xs text-slate-400">Brak meczów domowych.</div>'}
          </div>
          <div class="glass-panel rounded-2xl p-5 border border-white/10 space-y-2.5">
            <h4 class="font-display font-black text-sm uppercase text-purple-300 pb-2 border-b border-white/10">✈️ Król Wyjazdów (Koszmar Gospodarzy)</h4>
            ${awayTop.map((r, idx) => `
              <div class="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between text-xs">
                <span class="font-bold text-white">#${idx + 1} ${escapeHtml(r.name)} <span class="text-slate-400">(${r.awayW}-${r.awayR}-${r.awayP}, ${r.awayBZ}:${r.awayBS})</span></span>
                <span class="font-display font-black text-purple-300">${r.awayPKT} pkt na wyjeździe</span>
              </div>
            `).join('') || '<div class="text-xs text-slate-400">Brak meczów wyjazdowych.</div>'}
          </div>
        </div>
      </div>
    `;
  }

  function renderFairPlayAndClansTabHtml(state, comp, isAdmin) {
    const fpList = window.SMPL_ENGINE.calculateFairPlayRanking(state);
    const clansOn = isClansUiEnabled(state);
    const clansList = clansOn ? window.SMPL_ENGINE.calculateClanChampionsRanking(state) : [];
    const fpHonor = comp.awardedHonors && comp.awardedHonors.fairPlay;
    const clanHonor = comp.awardedHonors && comp.awardedHonors.clanChampion;

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-5 border border-emerald-500/35 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h3 class="font-display font-black text-lg text-white uppercase">🕊️ Puchar Fair Play & Dżentelmenów SMPL</h3>
              <p class="text-xs text-slate-300 mt-1">
                Start: <strong class="text-white">100 pkt</strong> • Czysty mecz: <strong class="text-emerald-300">+2</strong> • Żółta kartka: <strong class="text-amber-300">-4</strong> • Czerwona kartka: <strong class="text-rose-400">-12</strong> • Kara punktowa / Walkower: <strong class="text-rose-400">-2 / -8</strong>.
              </p>
              ${fpHonor ? `<div class="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[11px] font-bold text-emerald-200">🕊️ Laureat Fair Play: ${escapeHtml(fpHonor.playerName)} (${fpHonor.score} pkt)</div>` : ''}
            </div>
            ${isAdmin && fpList.length > 0 ? `<button type="button" onclick="SMPL_APP.handleAdminAwardCompetition('fair_play')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-amber-200 text-xs font-display font-black uppercase">👑 Wręcz Puchar Fair Play (#1)</button>` : ''}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            ${fpList.slice(0, 12).map((row) => `
              <div onclick="SMPL_APP.openPlayerModal('${row.playerId}')" class="cursor-pointer p-3.5 rounded-xl bg-slate-950/85 border ${row.rank <= 3 ? 'border-emerald-400/45' : 'border-white/10'} hover:border-amber-400/50 transition">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="font-display font-black text-xs text-emerald-300">#${row.rank} • ${escapeHtml(row.ratingLabel)}</span>
                  <span class="font-display font-black text-sm text-white">${row.fairPlayScore} pkt</span>
                </div>
                <div class="flex items-center gap-2.5">
                  <img src="${row.avatar}" class="w-9 h-9 rounded-full object-cover border border-white/20" alt=""/>
                  <div class="min-w-0">
                    <div class="font-bold text-white text-xs sm:text-sm truncate">${escapeHtml(row.name)} <span class="text-slate-400">(${escapeHtml(row.leagueId)})</span></div>
                    <div class="text-[11px] text-slate-400">Mecze: ${row.cleanMatches} • 🟨 ${row.yellowCards} • 🟥 ${row.redCards} • WO: ${row.walkoversCommitted}</div>
                  </div>
                </div>
              </div>
            `).join('') || '<div class="text-xs text-slate-400">Brak aktywnych graczy do klasyfikacji Fair Play.</div>'}
          </div>
        </div>

        ${
          clansOn
            ? `<div class="glass-panel rounded-2xl p-5 border border-purple-500/40 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h3 class="font-display font-black text-lg text-white uppercase">⚔️ Drużynowa Liga Mistrzów Klanów SMPL</h3>
              <p class="text-xs text-slate-300 mt-1">
                Klasyfikacja drużynowa sumująca punkty, gole i czyste konta wszystkich członków danego klanu we wszystkich ligach!
              </p>
              ${clanHonor ? `<div class="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-[11px] font-bold text-purple-200">⚔️ Mistrzowski Klan Sezonu: ${escapeHtml(clanHonor.clanName)}</div>` : ''}
            </div>
            ${isAdmin && clansList.length > 0 ? `<button type="button" onclick="SMPL_APP.handleAdminAwardCompetition('clan_champions')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400 text-amber-200 text-xs font-display font-black uppercase">👑 Nagrodź Mistrzowski Klan (#1)</button>` : ''}
          </div>
          ${
            clansList.length === 0
              ? `<div class="p-6 text-center text-xs text-slate-400">Żaden aktywny gracz w lidze nie należy jeszcze do klanu. Przypisz klan w edycji gracza lub podczas rejestracji!</div>`
              : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                   ${clansList.map((cl) => `
                     <div class="p-4 rounded-2xl bg-slate-950/90 border ${cl.rank === 1 ? 'border-amber-400/60' : 'border-white/10'} space-y-3">
                       <div class="flex items-center justify-between gap-3">
                         <div class="flex items-center gap-3 min-w-0">
                           <span class="w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-sm ${cl.rank === 1 ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}">#${cl.rank}</span>
                           ${cl.logo ? `<img src="${cl.logo}" class="w-10 h-10 rounded-xl object-contain border border-white/15 bg-slate-900 p-0.5" alt=""/>` : ''}
                           <div class="min-w-0">
                             <div class="font-display font-black text-base text-white truncate">${escapeHtml(cl.name)} ${cl.tag ? `<span class="text-emerald-300 text-xs">[${escapeHtml(cl.tag)}]</span>` : ''}</div>
                             <div class="text-xs text-slate-400">Zawodników w lidze: <strong class="text-white">${cl.membersCount}</strong> • Lider: <strong class="text-amber-300">${escapeHtml(cl.leaderPlayer ? cl.leaderPlayer.name : '-')}</strong></div>
                           </div>
                         </div>
                         <div class="text-right flex-shrink-0">
                           <div class="font-display font-black text-xl text-amber-300">${cl.totalPKT} PKT</div>
                           <div class="text-[11px] text-emerald-400 font-bold">Śr. ${cl.avgPKTPerMember} pkt / gracz</div>
                         </div>
                       </div>
                       <div class="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-white/10">
                         <div><div class="text-[10px] text-slate-400">GOLE KLANU</div><div class="font-bold text-white">⚽ ${cl.totalGoals}</div></div>
                         <div><div class="text-[10px] text-slate-400">CZYSTE KONTA</div><div class="font-bold text-emerald-400">🧤 ${cl.totalCleanSheets}</div></div>
                         <div><div class="text-[10px] text-slate-400">TROFEA</div><div class="font-bold text-amber-300">🏆 ${cl.totalTrophies}</div></div>
                       </div>
                     </div>
                   `).join('')}
                 </div>`
          }
        </div>`
            : ''
        }
      </div>
    `;
  }

  function renderTotwTabHtml(state, comp, isAdmin) {
    const rpw = (state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4;
    const curWeek = (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1;
    const liveCandidates = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.computeWeeklyTotwCandidates === 'function')
      ? window.SMPL_STUDIO.computeWeeklyTotwCandidates(state, curWeek)
      : { week: curWeek, roundRange: 'K?', starters: [], allCandidates: [] };
    const hist = Array.isArray(comp.totwHistory) ? comp.totwHistory : [];
    const latest = hist[0] || null;
    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/40">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
            <div>
              <h3 class="font-display font-black text-lg sm:text-xl text-amber-300 uppercase">
                ⚡ Drużyna Kolejki / Szóstka Tygodnia (TOTW — In-Form)
              </h3>
              <p class="text-xs text-slate-300 mt-0.5">
                Automatyczny dobór gwiazd tygodnia na podstawie punktów, bilansu bramek i czystych kont w tygodniowym oknie (${escapeHtml(liveCandidates.roundRange || '')}).
              </p>
            </div>
            ${
              isAdmin
                ? `<div class="flex items-center gap-2">
                     <input id="totw-week-input" type="number" min="1" max="20" value="${curWeek}" class="w-16 px-2.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white font-bold text-center"/>
                     <button type="button" onclick="SMPL_APP.adminAwardTotwWeek(document.getElementById('totw-week-input').value)" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase">
                       ⚡ Zatwierdź TOTW Tygodnia
                     </button>
                   </div>`
                : ''
            }
          </div>

          <div class="text-xs font-display uppercase font-bold text-slate-300 mb-3">
            📊 Bieżąca Prognoza Live na Tydzień #${curWeek} (po ${rpw} kolejki/tydzień):
          </div>
          ${
            liveCandidates.starters.length === 0
              ? `<div class="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-950/70 border border-white/10">Brak zatwierdzonych meczów w Tygodniu #${curWeek}, aby wyłonić kandydatów do Szóstki Tygodnia.</div>`
              : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                   ${liveCandidates.starters.map((st, idx) => `
                     <div onclick="SMPL_APP.openPlayerModal('${escapeHtml(st.playerId)}')" class="p-4 rounded-2xl bg-slate-950/85 border ${idx === 0 ? 'border-amber-400' : 'border-white/15'} hover:border-amber-400/50 cursor-pointer transition">
                       <div class="flex items-center justify-between gap-2">
                         <span class="smpl-totw-badge">#${idx + 1} IN-FORM • ${escapeHtml(st.leagueId || '')}</span>
                         <span class="font-display font-black text-amber-300 text-sm">${Number(st.pts || 0)} PKT</span>
                       </div>
                       <div class="font-display font-black text-base text-white mt-2 truncate">${escapeHtml(st.name || '')}</div>
                       <div class="text-xs text-slate-400 mt-1">Mecze: ${Number(st.played || 0)} • Wygrane: ${Number(st.wins || 0)} • Gole: ${Number(st.gf || 0)}:${Number(st.ga || 0)} • CK: ${Number(st.cleanSheets || 0)}</div>
                     </div>
                   `).join('')}
                 </div>`
          }
        </div>

        ${
          latest
            ? `<div class="glass-panel rounded-2xl p-5 border border-white/10">
                 <h4 class="font-display font-black text-sm uppercase text-white mb-3">🏆 Oficjalna Archiwum Drużyn Kolejki (${hist.length})</h4>
                 <div class="space-y-3">
                   ${hist.slice(0, 6).map((h) => `
                     <div class="p-3.5 rounded-xl bg-slate-950/80 border border-white/10">
                       <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                         <span class="font-display font-bold text-xs text-amber-300 uppercase">Tydzień #${Number(h.week || 1)} (${escapeHtml(h.roundRange || '')})</span>
                         <span class="text-[11px] text-slate-400">Zatwierdził: ${escapeHtml(h.awardedBy || 'Admin')} • ${escapeHtml(h.createdAt || '')}</span>
                       </div>
                       <div class="flex flex-wrap gap-2">
                         ${(h.starters || []).map((s) => `
                           <button type="button" onclick="SMPL_APP.openPlayerModal('${escapeHtml(s.playerId)}')" class="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-xs text-white font-bold">
                             ⚡ ${escapeHtml(s.name || '')} (${escapeHtml(s.leagueId || '')} • ${Number(s.pts || 0)} pkt)
                           </button>
                         `).join('')}
                       </div>
                     </div>
                   `).join('')}
                 </div>
               </div>`
            : ''
        }
      </div>
    `;
  }

  function renderPlayoffsTabHtml(state, comp, isAdmin) {
    const po = comp.playoffs || { status: 'NOT_STARTED', ties: [] };
    const ties = Array.isArray(po.ties) ? po.ties : [];
    const playersMap = {};
    (state.players || []).forEach((pl) => { if (pl) playersMap[pl.id] = pl; });
    return `
      <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/15 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase">🥊 Baraże o Awans i Utrzymanie (Dwumecze)</h3>
            <p class="text-xs text-slate-300 mt-0.5">
              Zwycięzcy par barażowych automatycznie zajmują wyższą dywizję przy starcie kolejnego sezonu!
            </p>
          </div>
          ${
            isAdmin
              ? `<button type="button" onclick="SMPL_APP.adminGeneratePlayoffTies()" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase">
                   🎲 Wylosuj Pary Barażowe z Tabel
                 </button>`
              : ''
          }
        </div>
        ${
          ties.length === 0
            ? `<div class="p-8 text-center text-xs text-slate-400 rounded-xl bg-slate-950/70 border border-white/10">Pary barażowe nie zostały jeszcze wygenerowane przez Administrację (zwykle pod koniec sezonu).</div>`
            : `<div class="space-y-4">
                 ${ties.map((t) => {
                   const winnerPl = t.winnerPlayerId ? playersMap[t.winnerPlayerId] : null;
                   return `
                     <div class="p-4 rounded-2xl bg-slate-950/85 border ${t.status === 'DONE' ? 'border-emerald-500/40' : 'border-amber-400/35'} space-y-3">
                       <div class="flex flex-wrap items-center justify-between gap-2">
                         <span class="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-display font-black text-amber-300 uppercase">
                           ${escapeHtml(t.upperLeagueId || '')} (#${Number(t.upperPos || 0)}) vs ${escapeHtml(t.lowerLeagueId || '')} (#${Number(t.lowerPos || 0)})
                         </span>
                         <span class="text-xs font-bold ${t.status === 'DONE' ? 'text-emerald-300' : 'text-amber-200'}">
                           ${winnerPl ? '✅ Awans / Utrzymanie: ' + escapeHtml(winnerPl.name) : escapeHtml(t.status || 'SCHEDULED')}
                         </span>
                       </div>
                       <div class="grid grid-cols-1 md:grid-cols-3 items-center gap-3 text-center">
                         <div class="p-3 rounded-xl bg-slate-900 border border-white/10">
                           <div class="text-[10px] text-slate-400 uppercase font-bold">Wyższa Liga (${escapeHtml(t.upperLeagueId || '')})</div>
                           <div class="font-display font-black text-white text-sm mt-0.5">${escapeHtml(t.upperPlayerName || '')}</div>
                         </div>
                         <div class="p-3 rounded-xl bg-black/50 border border-white/10 font-mono-num">
                           <div class="text-xs text-slate-300">Mecz 1: <strong class="text-white">${t.leg1HomeScore !== null && t.leg1HomeScore !== undefined ? (t.leg1HomeScore + ':' + t.leg1AwayScore) : '— : —'}</strong></div>
                           <div class="text-xs text-slate-300 mt-1">Rewanż: <strong class="text-white">${t.leg2HomeScore !== null && t.leg2HomeScore !== undefined ? (t.leg2HomeScore + ':' + t.leg2AwayScore) : '— : —'}</strong></div>
                         </div>
                         <div class="p-3 rounded-xl bg-slate-900 border border-white/10">
                           <div class="text-[10px] text-slate-400 uppercase font-bold">Niższa Liga (${escapeHtml(t.lowerLeagueId || '')})</div>
                           <div class="font-display font-black text-white text-sm mt-0.5">${escapeHtml(t.lowerPlayerName || '')}</div>
                         </div>
                       </div>
                       ${
                         isAdmin
                           ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
                                <form onsubmit="SMPL_APP.adminSubmitPlayoffLeg(event, '${escapeHtml(t.id)}', 1)" class="flex flex-wrap items-center gap-2">
                                  <span class="font-bold text-slate-300">Mecz 1:</span>
                                  <input name="hs" type="number" min="0" max="3" required value="${t.leg1HomeScore !== null && t.leg1HomeScore !== undefined ? t.leg1HomeScore : ''}" class="w-12 px-2 py-1 rounded bg-slate-900 border border-white/15 text-center text-white font-bold"/>
                                  <span class="text-slate-400">:</span>
                                  <input name="as" type="number" min="0" max="3" required value="${t.leg1AwayScore !== null && t.leg1AwayScore !== undefined ? t.leg1AwayScore : ''}" class="w-12 px-2 py-1 rounded bg-slate-900 border border-white/15 text-center text-white font-bold"/>
                                  <button type="submit" class="px-3 py-1 rounded bg-blue-600/35 hover:bg-blue-600/50 text-blue-200 border border-blue-400/40 font-bold uppercase">Zapisz M1</button>
                                </form>
                                <form onsubmit="SMPL_APP.adminSubmitPlayoffLeg(event, '${escapeHtml(t.id)}', 2)" class="flex flex-wrap items-center gap-2">
                                  <span class="font-bold text-slate-300">Rewanż:</span>
                                  <input name="hs" type="number" min="0" max="3" required value="${t.leg2HomeScore !== null && t.leg2HomeScore !== undefined ? t.leg2HomeScore : ''}" class="w-12 px-2 py-1 rounded bg-slate-900 border border-white/15 text-center text-white font-bold"/>
                                  <span class="text-slate-400">:</span>
                                  <input name="as" type="number" min="0" max="3" required value="${t.leg2AwayScore !== null && t.leg2AwayScore !== undefined ? t.leg2AwayScore : ''}" class="w-12 px-2 py-1 rounded bg-slate-900 border border-white/15 text-center text-white font-bold"/>
                                  <select name="pen" class="px-2 py-1 rounded bg-slate-900 border border-white/15 text-white text-[11px]">
                                    <option value="">Karne (opcj.)</option>
                                    <option value="${escapeHtml(t.upperPlayerId)}">${escapeHtml(t.upperPlayerName)}</option>
                                    <option value="${escapeHtml(t.lowerPlayerId)}">${escapeHtml(t.lowerPlayerName)}</option>
                                  </select>
                                  <button type="submit" class="px-3 py-1 rounded bg-emerald-600/35 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-400/40 font-bold uppercase">Zapisz M2</button>
                                </form>
                              </div>`
                           : ''
                       }
                     </div>
                   `;
                 }).join('')}
               </div>`
        }
      </div>
    `;
  }

  function renderSupercupTabHtml(state, comp, isAdmin) {
    const sc = comp.supercup || { status: 'NOT_STARTED' };
    const playersMap = {};
    (state.players || []).forEach((pl) => { if (pl) playersMap[pl.id] = pl; });
    const hp = sc.homePlayerId ? playersMap[sc.homePlayerId] : null;
    const ap = sc.awayPlayerId ? playersMap[sc.awayPlayerId] : null;
    const wp = sc.winnerPlayerId ? playersMap[sc.winnerPlayerId] : null;
    return `
      <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-amber-400/40 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg sm:text-xl text-amber-300 uppercase">🌟 Superpuchar Mistrzów SMPL</h3>
            <p class="text-xs text-slate-300 mt-0.5">Starcie o miano absolutnego hegemona: Mistrz Ekstraklasy (L1) vs Triumfator Pucharu Ligi!</p>
          </div>
          ${
            isAdmin
              ? `<button type="button" onclick="SMPL_APP.adminGenerateSupercupBracket()" class="btn-league px-4 py-2 rounded-xl text-xs font-display font-black uppercase">
                   🌟 Zestaw Parę Superpucharu
                 </button>`
              : ''
          }
        </div>
        ${
          !hp || !ap
            ? `<div class="p-8 text-center text-xs text-slate-400 rounded-xl bg-slate-950/70 border border-white/10">Finał Superpucharu nie został jeszcze zestawiony przez Administrację.</div>`
            : `<div class="p-5 rounded-2xl bg-slate-950/85 border border-amber-400/35 space-y-4">
                 <div class="grid grid-cols-1 md:grid-cols-3 items-center gap-4 text-center">
                   <div class="p-4 rounded-xl bg-slate-900 border border-white/10">
                     <div class="text-[10px] text-amber-300 uppercase font-bold">Mistrz / Finalista 1</div>
                     <div class="font-display font-black text-base text-white mt-1">${escapeHtml(hp.name)}</div>
                   </div>
                   <div class="p-4 rounded-xl bg-black/60 border border-amber-400/40">
                     <div class="font-display font-black text-3xl text-amber-300 font-mono-num">
                       ${sc.homeScore !== null && sc.homeScore !== undefined ? (sc.homeScore + ' : ' + sc.awayScore) : 'VS'}
                     </div>
                     <div class="text-xs text-emerald-300 font-bold mt-1">
                       ${wp ? '🏆 Zwycięzca: ' + escapeHtml(wp.name) : 'Mecz zaplanowany'}
                     </div>
                   </div>
                   <div class="p-4 rounded-xl bg-slate-900 border border-white/10">
                     <div class="text-[10px] text-emerald-300 uppercase font-bold">Puchar Ligi / Finalista 2</div>
                     <div class="font-display font-black text-base text-white mt-1">${escapeHtml(ap.name)}</div>
                   </div>
                 </div>
                 ${
                   isAdmin
                     ? `<form onsubmit="SMPL_APP.adminSubmitSupercupMatch(event)" class="flex flex-wrap items-center justify-center gap-2.5 pt-3 border-t border-white/10 text-xs">
                          <span class="font-bold text-slate-300">Wpisz wynik Finału:</span>
                          <input name="hs" type="number" min="0" max="3" required value="${sc.homeScore !== null && sc.homeScore !== undefined ? sc.homeScore : ''}" class="w-14 px-2.5 py-1.5 rounded bg-slate-900 border border-white/15 text-center text-white font-bold"/>
                          <span class="text-slate-400 font-bold">:</span>
                          <input name="as" type="number" min="0" max="3" required value="${sc.awayScore !== null && sc.awayScore !== undefined ? sc.awayScore : ''}" class="w-14 px-2.5 py-1.5 rounded bg-slate-900 border border-white/15 text-center text-white font-bold"/>
                          <select name="pen" class="px-2.5 py-1.5 rounded bg-slate-900 border border-white/15 text-white">
                            <option value="">Karne (w razie remisu)</option>
                            <option value="${escapeHtml(hp.id)}">${escapeHtml(hp.name)}</option>
                            <option value="${escapeHtml(ap.id)}">${escapeHtml(ap.name)}</option>
                          </select>
                          <button type="submit" class="btn-league px-4 py-1.5 rounded-xl font-display font-black uppercase">🏆 Zatwierdź Finał</button>
                        </form>`
                     : ''
                 }
               </div>`
        }
      </div>
    `;
  }

  function renderBlitzTabHtml(state, comp, isAdmin) {
    const blitz = comp.blitzCup || null;
    const playersMap = {};
    (state.players || []).forEach((pl) => { if (pl) playersMap[pl.id] = pl; });
    const winnerPl = blitz && blitz.winnerPlayerId ? playersMap[blitz.winnerPlayerId] : null;
    return `
      <div class="glass-panel rounded-2xl p-5 sm:p-6 border border-white/15 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div>
            <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase">⚡ Weekendowy Blitz Cup (Szybki KO 4/8/16)</h3>
            <p class="text-xs text-slate-300 mt-0.5">Ekspresowa drabinka pucharowa na jeden wieczór lub weekend — niezależna od tabeli ligowej!</p>
          </div>
          ${
            isAdmin
              ? `<form onsubmit="SMPL_APP.adminGenerateBlitzBracket(event)" class="flex flex-wrap items-center gap-2 text-xs">
                   <input name="name" type="text" value="Weekendowy Blitz Cup SMPL" class="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-bold"/>
                   <select name="size" class="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-bold">
                     <option value="4">4 graczy</option>
                     <option value="8" selected>8 graczy</option>
                     <option value="16">16 graczy</option>
                   </select>
                   <button type="submit" class="btn-league px-4 py-2 rounded-xl font-display font-black uppercase">⚡ Rozlosuj Blitz</button>
                 </form>`
              : ''
          }
        </div>
        ${
          !blitz || !Array.isArray(blitz.rounds)
            ? `<div class="p-8 text-center text-xs text-slate-400 rounded-xl bg-slate-950/70 border border-white/10">Aktualnie nie trwa żaden turniej Weekendowy Blitz Cup.</div>`
            : `<div class="space-y-4">
                 <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-amber-400/35">
                   <span class="font-display font-black text-sm text-amber-300">${escapeHtml(blitz.name || 'Blitz Cup')} (${Number(blitz.size || 8)} graczy)</span>
                   <span class="text-xs font-bold ${winnerPl ? 'text-emerald-300' : 'text-amber-200'}">
                     ${winnerPl ? '🏆 Zwycięzca: ' + escapeHtml(winnerPl.name) : escapeHtml(blitz.status || 'IN_PROGRESS')}
                   </span>
                 </div>
                 <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                   ${blitz.rounds.map((rnd) => `
                     <div class="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2.5">
                       <div class="font-display font-black text-xs uppercase text-amber-300 pb-2 border-b border-white/10">${escapeHtml(rnd.roundName || ('Runda ' + rnd.roundNumber))}</div>
                       ${(rnd.matches || []).map((bm) => {
                         const bhp = bm.homePlayerId ? playersMap[bm.homePlayerId] : null;
                         const bap = bm.awayPlayerId ? playersMap[bm.awayPlayerId] : null;
                         return `
                           <div class="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs space-y-2">
                             <div class="flex items-center justify-between gap-2 font-bold">
                               <span class="${bm.winnerId === bm.homePlayerId ? 'text-emerald-300' : 'text-white'} truncate">${bhp ? escapeHtml(bhp.name) : 'TBD'}</span>
                               <span class="font-mono-num text-amber-300 flex-shrink-0">${bm.homeScore !== null && bm.homeScore !== undefined ? (bm.homeScore + ':' + bm.awayScore) : 'VS'}</span>
                               <span class="${bm.winnerId === bm.awayPlayerId ? 'text-emerald-300' : 'text-white'} truncate">${bap ? escapeHtml(bap.name) : 'TBD'}</span>
                             </div>
                             ${
                               isAdmin && bhp && bap && bm.status !== 'DONE'
                                 ? `<form onsubmit="SMPL_APP.adminSubmitBlitzMatch(event, '${escapeHtml(bm.id)}')" class="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/10">
                                      <input name="hs" type="number" min="0" max="3" required placeholder="0" class="w-10 px-1.5 py-1 rounded bg-slate-950 border border-white/15 text-center text-white font-bold"/>
                                      <span>:</span>
                                      <input name="as" type="number" min="0" max="3" required placeholder="0" class="w-10 px-1.5 py-1 rounded bg-slate-950 border border-white/15 text-center text-white font-bold"/>
                                      <select name="pen" class="px-1.5 py-1 rounded bg-slate-950 border border-white/15 text-white text-[10px]">
                                        <option value="">Karne</option>
                                        <option value="${escapeHtml(bhp.id)}">${escapeHtml(bhp.name)}</option>
                                        <option value="${escapeHtml(bap.id)}">${escapeHtml(bap.name)}</option>
                                      </select>
                                      <button type="submit" class="px-2 py-1 rounded bg-emerald-600/35 text-emerald-200 border border-emerald-400/40 font-bold uppercase text-[10px]">OK</button>
                                    </form>`
                                 : ''
                             }
                           </div>
                         `;
                       }).join('')}
                     </div>
                   `).join('')}
                 </div>
               </div>`
        }
      </div>
    `;
  }

  function renderSmplTvAndNewsletterTabHtml(state, comp, session, isAdmin) {
    const tv = comp.smplTV || { liveStream: { isLive: false }, clips: [] };
    const live = tv.liveStream || { isLive: false };
    const clips = Array.isArray(tv.clips) ? tv.clips : [];
    const news = comp.newsletter || { current: null, archive: [] };
    const curNews = news.current || null;
    const isLogged = Boolean(isAdmin || (session && !session.isGuest && session.isPlayerAuthenticated));
    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-6 glass-panel rounded-2xl p-5 border border-white/15 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <h3 class="font-display font-black text-base sm:text-lg text-white uppercase">📺 SMPL TV — Streamy Live &amp; Klipy</h3>
            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${live.isLive ? 'bg-rose-500/25 text-rose-200 border border-rose-500/50' : 'bg-slate-900 text-slate-400 border border-white/10'}">
              ${live.isLive ? '🔴 NA ŻYWO' : '⚪ Offline'}
            </span>
          </div>
          ${
            live.isLive && live.url
              ? `<div class="p-4 rounded-xl bg-rose-950/35 border border-rose-500/40 flex flex-wrap items-center justify-between gap-3">
                   <div>
                     <div class="text-xs font-display font-black text-rose-300 uppercase">🔴 TRANSMISJA TRWA • ${escapeHtml(live.streamerName || 'SMPL TV')}</div>
                     <div class="text-sm font-bold text-white mt-0.5">${escapeHtml(live.title || 'Mecz Ligi SMPL na żywo')}</div>
                   </div>
                   <div class="flex items-center gap-2">
                     <a href="${escapeHtml(live.url)}" target="_blank" rel="noopener noreferrer" class="btn-league px-3.5 py-2 rounded-xl text-xs font-display font-black uppercase">▶ Oglądaj Stream</a>
                     ${isAdmin ? `<button type="button" onclick="SMPL_APP.adminEndSmplTvLive()" class="px-3 py-2 rounded-xl bg-slate-900 text-slate-200 border border-white/15 text-xs font-bold">Zakończ</button>` : ''}
                   </div>
                 </div>`
              : ''
          }
          ${
            isAdmin
              ? `<form onsubmit="SMPL_APP.adminSaveSmplTvLive(event)" class="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2 text-xs">
                   <div class="font-display font-bold uppercase text-amber-300">🎙️ Uruchom Transmisję SMPL TV (Admin)</div>
                   <input name="title" type="text" required placeholder="Tytuł transmisji (np. Hit L1: Lider vs Wicelider)" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
                   <input name="url" type="url" required placeholder="https://twitch.tv/... lub https://youtube.com/..." class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
                   <button type="submit" class="btn-league px-4 py-2 rounded-xl font-display font-black uppercase">🔴 Włącz Stream LIVE</button>
                 </form>`
              : ''
          }
          ${
            isLogged
              ? `<form onsubmit="SMPL_APP.handleAddSmplTvClip(event)" class="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2 text-xs">
                   <div class="font-display font-bold uppercase text-blue-300">🎬 Dodaj Klip / Powtórkę Brama (https://)</div>
                   <input name="title" type="text" required minlength="4" maxlength="100" placeholder="Tytuł klipu (min. 4 znaki)" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
                   <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     <input name="url" type="url" required placeholder="https://..." class="px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"/>
                     <select name="tag" class="px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white font-bold">
                       <option value="HIGHLIGHT">⚡ Skrót Meczu</option>
                       <option value="GOAL">⚽ Bramka Tygodnia</option>
                       <option value="SAVE">🧤 Parada Bramkarza</option>
                       <option value="LIVE_VOD">📺 Zapis Live</option>
                     </select>
                   </div>
                   <button type="submit" class="px-4 py-2 rounded-xl bg-blue-600/35 hover:bg-blue-600/50 text-blue-100 border border-blue-400/40 font-display font-black uppercase">➕ Opublikuj Klip w SMPL TV</button>
                 </form>`
              : ''
          }
          <div class="space-y-2">
            ${clips.length === 0
              ? `<div class="text-xs text-slate-400 text-center py-4">Brak dodanych klipów w SMPL TV. Dodaj pierwszy skrót meczu!</div>`
              : clips.slice(0, 12).map((cl) => `
                  <div class="p-3 rounded-xl bg-slate-950/85 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div class="min-w-0">
                      <span class="px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[10px] font-bold mr-1.5">${escapeHtml(cl.tag || 'CLIP')}</span>
                      <span class="font-bold text-white">${escapeHtml(cl.title || '')}</span>
                      <div class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(cl.playerName || '')} • ${escapeHtml(cl.createdAt || '')}</div>
                    </div>
                    <a href="${escapeHtml(cl.url)}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/35 font-bold flex-shrink-0">▶ Otwórz</a>
                  </div>
                `).join('')
            }
          </div>
        </div>

        <div class="lg:col-span-6 glass-panel rounded-2xl p-5 border border-amber-400/35 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <h3 class="font-display font-black text-base sm:text-lg text-amber-300 uppercase">📰 Gazeta Ligi SMPL — Przegląd Kolejki</h3>
            ${
              isAdmin
                ? `<div class="flex flex-wrap items-center gap-1.5">
                     <button type="button" onclick="SMPL_APP.adminGenerateOfflineNewsletter()" class="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 text-emerald-200 border border-emerald-400/40 text-xs font-display font-bold uppercase">⚡ Generuj Offline</button>
                     <button type="button" onclick="SMPL_APP.adminGenerateAiNewsletter()" class="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 text-purple-200 border border-purple-400/40 text-xs font-display font-bold uppercase">🤖 Generuj AI</button>
                   </div>`
                : ''
            }
          </div>
          ${
            curNews
              ? `<div class="p-4 rounded-xl bg-slate-950/85 border border-amber-400/30 space-y-2">
                   <div class="flex flex-wrap items-center justify-between gap-2">
                     <span class="font-display font-black text-sm text-white">${escapeHtml(curNews.title || 'Wydanie Ligi SMPL')}</span>
                     <span class="text-[11px] text-amber-300 font-bold">Tydzień #${Number(curNews.week || 1)} ${curNews.isAiGenerated ? '• AI Redakcja' : '• Statystyki Live'}</span>
                   </div>
                   <div class="text-xs text-slate-200 whitespace-pre-line leading-relaxed">${escapeHtml(curNews.content || '')}</div>
                   <div class="text-[10px] text-slate-500 pt-2 border-t border-white/5">Opublikował: ${escapeHtml(curNews.authorName || 'Redakcja')} • ${escapeHtml(curNews.createdAt || '')}</div>
                 </div>`
              : `<div class="p-6 text-center text-xs text-slate-400 rounded-xl bg-slate-950/70 border border-white/10">Wydanie Gazety Ligi SMPL w tym sezonie jeszcze się nie ukazało. Administracja może je wygenerować jednym kliknięciem!</div>`
          }
          ${
            isAdmin
              ? `<form onsubmit="SMPL_APP.adminPublishNewsletter(event)" class="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2 text-xs">
                   <div class="font-display font-bold uppercase text-slate-300">✍️ Ręczna Publikacja / Edycja Wydania</div>
                   <input id="news-title-input" name="title" type="text" required value="${escapeHtml(curNews ? curNews.title : ('Gazeta Ligi SMPL — Tydzień #' + ((state.weeklyConfig && state.weeklyConfig.currentWeek) || 1)))}" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white font-bold"/>
                   <textarea id="news-content-input" name="content" rows="5" required placeholder="Treść wydania Gazety Ligi SMPL..." class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/15 text-white"></textarea>
                   <button type="submit" class="btn-league px-4 py-2 rounded-xl font-display font-black uppercase">📰 Opublikuj Wydanie</button>
                 </form>`
              : ''
          }
        </div>
      </div>
    `;
  }

  function renderCompetitionsView(state, compState, session) {
    const activeSubTab = (compState && compState.subTab) || 'golden_boot';
    const isAdmin = Boolean(window.SMPL_DB ? window.SMPL_DB.isStrictAdminSession(session) : (session && session.isAdminAuthenticated && session.linkMode !== 'PUBLIC'));
    const comp = getCompetitionsSafeState(state);
    const overview = window.SMPL_ENGINE.getCompetitionsOverviewSummary(state);
    const clansOn = isClansUiEnabled(state);

    const subTabs = [
      { id: 'golden_boot', label: '👟 Złoty But (Strzelcy)' },
      { id: 'cup', label: '🏆 Puchar Ligi SMPL (KO)' },
      { id: 'typer', label: '🔮 Typer Kolejki (' + ((comp.typerPredictions || []).length) + ')' },
      { id: 'puskas', label: '🥅 Nagroda Puskása (' + ((comp.puskasNominations || []).length) + ')' },
      { id: 'totw', label: '⚡ Drużyna Kolejki TOTW' },
      { id: 'playoffs', label: '🥊 Baraże' },
      { id: 'supercup', label: '🌟 Superpuchar' },
      { id: 'blitz', label: '⚡ Blitz Cup' },
      { id: 'smpl_tv', label: '📺 SMPL TV & Gazeta' },
      { id: 'form_mvp', label: '🔥 Forma, Invincibles & Rekordy' },
      { id: 'fairplay_clans', label: clansOn ? '🕊️ Fair Play & Liga Klanów' : '🕊️ Klasyfikacja Fair Play' }
    ];

    let innerHtml = '';
    if (activeSubTab === 'golden_boot') innerHtml = renderGoldenBootTabHtml(state, compState, comp, isAdmin);
    else if (activeSubTab === 'cup') innerHtml = renderLeagueCupTabHtml(state, comp, isAdmin);
    else if (activeSubTab === 'typer') innerHtml = renderTyperTabHtml(state, comp, session, isAdmin);
    else if (activeSubTab === 'puskas') innerHtml = renderPuskasTabHtml(state, comp, session, isAdmin);
    else if (activeSubTab === 'totw') innerHtml = renderTotwTabHtml(state, comp, isAdmin);
    else if (activeSubTab === 'playoffs') innerHtml = renderPlayoffsTabHtml(state, comp, isAdmin);
    else if (activeSubTab === 'supercup') innerHtml = renderSupercupTabHtml(state, comp, isAdmin);
    else if (activeSubTab === 'blitz') innerHtml = renderBlitzTabHtml(state, comp, isAdmin);
    else if (activeSubTab === 'smpl_tv') innerHtml = renderSmplTvAndNewsletterTabHtml(state, comp, session, isAdmin);
    else if (activeSubTab === 'form_mvp') innerHtml = renderFormAndRecordsTabHtml(state, comp, isAdmin);
    else innerHtml = renderFairPlayAndClansTabHtml(state, comp, isAdmin);

    return `
      <!-- Gala Showcase Banner Konkursów Piłkarskich SMPL -->
      <div class="competitions-showcase-banner rounded-3xl p-5 sm:p-7 mb-6">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="max-w-2xl">
            <div class="inline-flex flex-wrap items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-display font-black text-[10px] sm:text-xs uppercase tracking-wider max-w-full">
              <span>🏟️ GALA &amp; PUCHARY SMPL • SEZON ${(state && state.season) || 56}</span>
            </div>
            <h2 class="font-display font-black text-xl sm:text-3xl text-white uppercase mt-2">
              Konkursy Piłkarskie &amp; Puchar Ligi SMPL
            </h2>
            <p class="text-xs sm:text-sm text-slate-200 mt-1">
              Komplet prawdziwych futbolowych trofeów obok tabeli ligowej: <strong class="text-amber-300">Złoty But</strong>, <strong class="text-emerald-300">Puchar Ligi (Knockout)</strong>, <strong class="text-purple-300">Typer Kolejki</strong>, <strong class="text-blue-300">Nagroda Puskása</strong>, <strong class="text-amber-200">Klub Invincibles</strong>${clansOn ? `, <strong class="text-emerald-200">Fair Play</strong> oraz <strong class="text-white">Liga Mistrzów Klanów</strong>!` : ` oraz <strong class="text-emerald-200">Puchar Fair Play</strong>!`}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="SMPL_APP.switchTab('goldenball')" class="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-xs font-display font-black uppercase transition">🏆 Złota Piłka</button>
            <button type="button" onclick="SMPL_APP.switchTab('cleansheets')" class="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-xs font-display font-black uppercase transition">🧤 Żelazna Kurtyna</button>
          </div>
        </div>

        <!-- Pasek Liderów Wszystkich Konkursów -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2.5 mt-5">
          <button type="button" onclick="SMPL_APP.setCompetitionsSubTab('golden_boot')" class="text-left p-2.5 rounded-xl bg-slate-950/85 border border-amber-400/35 hover:border-amber-400/50 transition">
            <div class="text-[10px] font-display uppercase text-amber-300 font-bold">👟 Złoty But</div>
            <div class="text-xs font-bold text-white truncate mt-0.5">${escapeHtml(overview.goldenBootLeader ? overview.goldenBootLeader.name : 'Brak danych')}</div>
            <div class="text-[10px] text-slate-400">${overview.goldenBootLeader ? overview.goldenBootLeader.goalsFor + ' goli' : 'Czeka na mecze'}</div>
          </button>
          <button type="button" onclick="SMPL_APP.setCompetitionsSubTab('cup')" class="text-left p-2.5 rounded-xl bg-slate-950/85 border border-white/15 hover:border-amber-400/50 transition">
            <div class="text-[10px] font-display uppercase text-amber-200 font-bold">🏆 Puchar Ligi</div>
            <div class="text-xs font-bold text-white truncate mt-0.5">${escapeHtml(overview.cupWinner ? overview.cupWinner.name : overview.cupStatus === 'ACTIVE' ? 'W trakcie KO' : 'Przed losowaniem')}</div>
            <div class="text-[10px] text-slate-400">${overview.cupWinner ? 'Triumfator' : 'Drabinka Knockout'}</div>
          </button>
          <button type="button" onclick="SMPL_APP.setCompetitionsSubTab('typer')" class="text-left p-2.5 rounded-xl bg-slate-950/85 border border-purple-400/40 hover:border-purple-400/50 transition">
            <div class="text-[10px] font-display uppercase text-purple-300 font-bold">🔮 Lider Typera</div>
            <div class="text-xs font-bold text-white truncate mt-0.5">${escapeHtml(overview.typerLeader ? overview.typerLeader.voterName : 'Brak typów')}</div>
            <div class="text-[10px] text-slate-400">${overview.typerLeader ? overview.typerLeader.totalPoints + ' pkt' : 'Typuj mecze!'}</div>
          </button>
          <button type="button" onclick="SMPL_APP.setCompetitionsSubTab('puskas')" class="text-left p-2.5 rounded-xl bg-slate-950/85 border border-blue-400/35 hover:border-white/20 transition">
            <div class="text-[10px] font-display uppercase text-blue-300 font-bold">🥅 Nagroda Puskása</div>
            <div class="text-xs font-bold text-white truncate mt-0.5">${escapeHtml(overview.puskasLeader ? overview.puskasLeader.playerName : 'Brak nominacji')}</div>
            <div class="text-[10px] text-slate-400">${overview.puskasLeader ? overview.puskasLeader.votesCount + ' głosów' : 'Zgłoś bramkę'}</div>
          </button>
          <button type="button" onclick="SMPL_APP.setCompetitionsSubTab('form_mvp')" class="text-left p-2.5 rounded-xl bg-slate-950/85 border border-emerald-400/35 hover:border-white/20 transition">
            <div class="text-[10px] font-display uppercase text-emerald-300 font-bold">🛡️ Invincible</div>
            <div class="text-xs font-bold text-white truncate mt-0.5">${escapeHtml(overview.invincibleLeader ? overview.invincibleLeader.name : 'Brak danych')}</div>
            <div class="text-[10px] text-slate-400">${overview.invincibleLeader ? overview.invincibleLeader.longestUnbeaten + ' bez porażki' : 'Seria sezonu'}</div>
          </button>
          <button type="button" onclick="SMPL_APP.setCompetitionsSubTab('fairplay_clans')" class="text-left p-2.5 rounded-xl bg-slate-950/85 border border-white/15 hover:border-white/20 transition">
            <div class="text-[10px] font-display uppercase text-emerald-200 font-bold">${clansOn ? '🕊️ Fair Play / Klany' : '🕊️ Puchar Fair Play'}</div>
            <div class="text-xs font-bold text-white truncate mt-0.5">${escapeHtml(clansOn && overview.clanLeader ? overview.clanLeader.name : (overview.fairPlayLeader ? overview.fairPlayLeader.name : 'Brak danych'))}</div>
            <div class="text-[10px] text-slate-400">${clansOn && overview.clanLeader ? overview.clanLeader.totalPKT + ' pkt klanu' : (overview.fairPlayLeader ? overview.fairPlayLeader.fairPlayScore + ' pkt FP' : 'Respect SMPL')}</div>
          </button>
        </div>
      </div>

      <!-- Nawigacja Wewnętrzna Areny Konkursów -->
      <div class="flex flex-wrap items-center gap-2 mb-6">
        ${subTabs.map((st) => {
          const isAct = activeSubTab === st.id;
          return `<button type="button" onclick="SMPL_APP.setCompetitionsSubTab('${st.id}')" class="px-3.5 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition ${isAct ? 'btn-league shadow-lg' : 'bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-white/10'}">${st.label}</button>`;
        }).join('')}
      </div>

      ${innerHtml}
    `;
  }

  function renderUpdatesChangelogView(state, session, filterState) {
    const studio = typeof window !== 'undefined' && window.SMPL_STUDIO ? window.SMPL_STUDIO : null;
    const allUpdates = studio && typeof studio.getMergedPlayerUpdates === 'function'
      ? studio.getMergedPlayerUpdates(state)
      : [];
    const latestVer = allUpdates.length ? allUpdates[0].version : 'V1.0';
    const fs = filterState && typeof filterState === 'object' ? filterState : {};
    const activeCat = String(fs.category || 'ALL').toUpperCase();
    const rawSearch = String(fs.search || '').trim();
    const searchLower = rawSearch.toLowerCase();

    const isStrictAdmin = Boolean(window.SMPL_DB && typeof window.SMPL_DB.isStrictAdminSession === 'function' && window.SMPL_DB.isStrictAdminSession(session));

    const filtered = allUpdates.filter((u) => {
      if (!u) return false;
      if (activeCat !== 'ALL' && String(u.category || 'NOWOŚCI').toUpperCase() !== activeCat) return false;
      if (searchLower) {
        const hay = [
          'Update ' + (u.version || ''),
          u.version || '',
          u.title || '',
          u.summary || '',
          (u.highlights || []).join(' ')
        ].join(' ').toLowerCase();
        if (hay.indexOf(searchLower) === -1) return false;
      }
      return true;
    });

    const catStyle = (cat) => {
      const c = String(cat || 'NOWOŚCI').toUpperCase();
      if (c === 'TURNIEJE') return { cls: 'bg-purple-500/20 text-purple-200 border-purple-400/45', icon: '🏆', label: 'Turnieje' };
      if (c === 'ULEPSZENIA') return { cls: 'bg-amber-500/20 text-amber-200 border-amber-400/45', icon: '⚡', label: 'Ulepszenia' };
      if (c === 'POPRAWKI') return { cls: 'bg-rose-500/20 text-rose-200 border-rose-400/45', icon: '🛠️', label: 'Poprawki' };
      return { cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/45', icon: '✨', label: 'Nowości' };
    };

    const categories = [
      { id: 'ALL', label: 'Wszystkie (' + allUpdates.length + ')' },
      { id: 'NOWOŚCI', label: '✨ Nowości' },
      { id: 'ULEPSZENIA', label: '⚡ Ulepszenia' },
      { id: 'TURNIEJE', label: '🏆 Turnieje' },
      { id: 'POPRAWKI', label: '🛠️ Poprawki' }
    ];

    return `
      <div class="space-y-6">
        <div class="glass-panel rounded-3xl p-5 sm:p-7 border border-emerald-400/30 bg-gradient-to-br from-emerald-950/30 to-slate-950 shadow-2xl">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="space-y-2 max-w-3xl">
              <div class="inline-flex flex-wrap items-center gap-2">
                <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs font-display font-black uppercase tracking-wider">
                  🔥 Aktualna wersja: Update ${escapeHtml(latestVer)}
                </span>
                <span class="px-2.5 py-1 rounded-full bg-slate-900/90 border border-white/15 text-slate-300 text-[11px] font-bold">
                  📦 Wpisów zmian: ${allUpdates.length}
                </span>
              </div>
              <h2 class="font-display font-black text-2xl sm:text-3xl text-white uppercase tracking-tight">
                🆕 Co Nowego dla Graczy — Dziennik Zmian
              </h2>
              <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tutaj w jednym miejscu sprawdzisz wszystko, co dodaliśmy i ulepszyliśmy na portalu Score Match Liga.
                Od teraz każda zmiana na stronie jest zapisywana chronologicznie jako kolejny <strong class="text-amber-300">Update V + cyfry</strong> (${escapeHtml(latestVer)}, itd.).
              </p>
            </div>
            ${
              isStrictAdmin
                ? `<div class="flex flex-col items-start gap-2 flex-shrink-0">
                     <button type="button" onclick="SMPL_APP.openAdminUpdatePublisher()" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-lg">
                       ➕ Dodaj Nowy Update V...
                     </button>
                     <span class="text-[10px] text-slate-400">Publikacja w Panelu Admina → Ustawienia</span>
                   </div>`
                : ''
            }
          </div>

          <div class="mt-5 pt-4 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-1.5">
              ${categories.map((cat) => {
                const isAct = activeCat === cat.id;
                return `<button type="button" onclick="SMPL_APP.setUpdatesFilterCategory('${cat.id}')" class="px-3 py-1.5 rounded-xl font-display font-bold text-[11px] uppercase tracking-wider transition ${isAct ? 'btn-league shadow' : 'bg-slate-900/85 hover:bg-slate-800 text-slate-300 border border-white/10'}">${escapeHtml(cat.label)}</button>`;
              }).join('')}
            </div>
            <div class="relative w-full sm:w-auto flex-shrink-0" style="min-width: 240px;">
              <input
                id="smpl-updates-search"
                type="text"
                value="${escapeHtml(rawSearch)}"
                oninput="SMPL_APP.setUpdatesSearchQuery(this.value)"
                placeholder="Szukaj np. V1.0, Sklepik, Baraże..."
                class="w-full px-3.5 py-2 rounded-xl bg-slate-950/90 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        </div>

        ${
          !filtered.length
            ? `<div class="glass-panel rounded-2xl p-8 border border-white/10 text-center space-y-2">
                 <div class="text-3xl">🔍</div>
                 <div class="font-display font-bold text-base text-white">Brak wpisów spełniających kryteria</div>
                 <div class="text-xs text-slate-400">Zmień kategorię lub wyczyść frazę wyszukiwania, aby zobaczyć pełną historię aktualizacji.</div>
               </div>`
            : `<div class="space-y-4">
                 ${filtered.map((upd, idx) => {
                   const st = catStyle(upd.category);
                   const isNewest = idx === 0 && activeCat === 'ALL' && !searchLower;
                   return `
                     <article class="glass-panel rounded-2xl p-5 sm:p-6 border ${isNewest ? 'border-amber-400/50 bg-gradient-to-br from-slate-900/95 via-slate-950 to-amber-950/20 shadow-xl' : 'border-white/10 bg-slate-950/85'} transition">
                       <div class="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-white/10">
                         <div class="flex flex-wrap items-center gap-2">
                           <span class="px-3 py-1 rounded-xl ${isNewest ? 'bg-amber-400 text-slate-950' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/45'} font-display font-black text-xs sm:text-sm uppercase tracking-wider shadow">
                             Update ${escapeHtml(upd.version)}
                           </span>
                           ${
                             isNewest
                               ? `<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">NAJNOWSZY</span>`
                               : ''
                           }
                           <span class="px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${st.cls}">
                             ${st.icon} ${escapeHtml(st.label)}
                           </span>
                         </div>
                         <div class="flex items-center gap-2 text-[11px] text-slate-400 font-mono-num">
                           <span>📅 ${escapeHtml(upd.date || '')}</span>
                           ${upd.author ? `<span>• ✍️ ${escapeHtml(upd.author)}</span>` : ''}
                         </div>
                       </div>

                       <h3 class="font-display font-black text-base sm:text-lg text-white mb-2">
                         ${escapeHtml(upd.title || ('Update ' + upd.version))}
                       </h3>

                       ${
                         upd.summary
                           ? `<p class="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">${escapeHtml(upd.summary)}</p>`
                           : ''
                       }

                       ${
                         Array.isArray(upd.highlights) && upd.highlights.length
                           ? `<ul class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-200">
                                ${upd.highlights.map((hl) => `
                                  <li class="flex items-start gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-white/5">
                                    <span class="text-emerald-400 font-black mt-0.5 flex-shrink-0">✔</span>
                                    <span class="leading-relaxed">${escapeHtml(hl)}</span>
                                  </li>
                                `).join('')}
                              </ul>`
                           : ''
                       }
                     </article>
                   `;
                 }).join('')}
               </div>`
        }
      </div>
    `;
  }

  // =========================================================================
  // 10. ZAKŁADKA: DOBROWOLNE WSPARCIE TWÓRCY I ADMINISTRACJI (DONATE — ART. 888 K.C.)
  // =========================================================================
  function renderSupportDonateView(state, session, supportUiState) {
    const cfg =
      window.SMPL_DB && typeof window.SMPL_DB.getSupportConfig === 'function'
        ? window.SMPL_DB.getSupportConfig(state)
        : {
            enabled: true,
            headline: 'Postaw Kawę Twórcy & Dorzuć Paliwa Arenie SMPL',
            intro: 'Portal Score Match Liga powstał z czystej pasji — bez reklam, bez wpisowego (0 zł) i bez Pay-to-Win.',
            goalTitle: 'Utrzymanie Areny SMPL (Hosting Hostido + Domena + Vanessa AI + Rozwój)',
            goalPeriod: 'Cel na Sezon 56',
            goalAmount: 150,
            currentAmount: 0,
            creatorLabel: 'Szymon Komenda — Twórca Portalu, Kodu & Serwera',
            buyCoffeeUrl: 'https://buycoffee.to/smpl',
            suppiUrl: '',
            paypalUrl: '',
            blikInfo: '',
            adminSupportEnabled: true,
            adminLabel: 'Zarząd & Administracja Ligi SMPL (Moderacja, Tabele, Turnieje)',
            adminSupportUrl: '',
            adminSupportNote: '',
            supporters: []
          };

    const isMaster = Boolean(
      session &&
        window.SMPL_DB &&
        window.SMPL_DB.isStrictAdminSession(session) &&
        session.adminRole === 'MASTER_ADMIN'
    );
    const activePlayer =
      session && session.activePlayerId && Array.isArray(state && state.players)
        ? state.players.find((p) => p && p.id === session.activePlayerId)
        : null;
    const senderLabel = activePlayer
      ? '@' + (activePlayer.nick || activePlayer.name)
      : session && session.adminName
      ? session.adminName
      : 'Kibic SMPL';

    const tiers = [
      {
        id: 'espresso',
        icon: '☕',
        title: 'Mała Czarna',
        amount: '5 zł',
        tagline: 'Szybki strzał kofeiny przed ligową kolejką!',
        badge: ''
      },
      {
        id: 'pizza',
        icon: '🍕',
        title: 'Pizza na Nocny Kod',
        amount: '15 zł',
        tagline: 'Paliwo pod kolejne funkcje, grafiki i ulepszenia portalu!',
        badge: '⭐ NAJPOPULARNIEJSZE'
      },
      {
        id: 'stadium',
        icon: '🏟️',
        title: 'Paliwo dla Areny',
        amount: '30 zł',
        tagline: 'Realna dorzutka na szybki serwer Hostido NVMe i Vanessę AI!',
        badge: ''
      },
      {
        id: 'crown',
        icon: '👑',
        title: 'Złoty Mecenas Sezonu',
        amount: '50+ zł',
        tagline: 'Legendarne wsparcie dla Twórcy i całej Administracji SMPL!',
        badge: '🔥 LEGENDARNE'
      }
    ];

    const selectedId = (supportUiState && supportUiState.selectedTier) || 'pizza';
    const activeTier = tiers.find((t) => t.id === selectedId) || tiers[1];
    const suggestedTitle = `Darowizna dobrowolna SMPL — ${activeTier.title} (${senderLabel})`;

    const goalAmt = Number(cfg.goalAmount || 0);
    const curAmt = Number(cfg.currentAmount || 0);
    const rawPct = goalAmt > 0 ? Math.round((curAmt / goalAmt) * 100) : 0;
    const barPct = Math.min(100, Math.max(0, rawPct));

    const hasCreatorChannels = Boolean(cfg.buyCoffeeUrl || cfg.suppiUrl || cfg.paypalUrl || cfg.blikInfo);
    const supporters = Array.isArray(cfg.supporters) ? cfg.supporters : [];

    const jsSafeStr = (s) =>
      String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/\r?\n/g, ' ');

    return `
      <div class="space-y-6">
        <!-- 1. Broadcast Hero Banner: Autentyczne, nienachalne zaproszenie do wsparcia -->
        <section class="smpl-support-hero rounded-3xl p-5 sm:p-8 border border-amber-400/40 relative overflow-hidden">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div class="max-w-3xl space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-200 font-display font-black text-[10px] sm:text-[11px] uppercase tracking-widest">
                  ☕ 100% DOBROWOLNE WSPARCIE
                </span>
                <span class="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 font-display font-bold text-[10px] sm:text-[11px] uppercase">
                  ⚖️ 0 ZŁ WPISOWEGO • ZERO PAY-TO-WIN
                </span>
                <span class="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-200 font-display font-bold text-[10px] sm:text-[11px] uppercase">
                  🛡️ ZGODNE Z ART. 888 K.C.
                </span>
              </div>
              <h2 class="font-display font-black text-2xl sm:text-4xl text-white uppercase tracking-tight leading-tight">
                ${escapeHtml(cfg.headline)}
              </h2>
              <p class="text-xs sm:text-sm text-slate-200 leading-relaxed">
                ${escapeHtml(cfg.intro)}
              </p>
              <div class="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-amber-200/95 font-semibold">
                <span>💛 Nikogo do niczego nie zmuszamy — liga zawsze była i będzie w 100% darmowa dla każdego!</span>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row lg:flex-col items-stretch gap-2.5 flex-shrink-0">
              ${
                isMaster
                  ? `<button type="button" onclick="SMPL_APP.openMasterSupportConfig()" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-lg">
                       ⚙️ Edytuj Linki &amp; Cel (Master)
                     </button>`
                  : ''
              }
              <button type="button" onclick="SMPL_APP.switchTab('legal')" class="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/15 font-display font-bold text-xs uppercase tracking-wider transition">
                ⚖️ Regulamin &amp; §18 Darowizny
              </button>
            </div>
          </div>

          ${
            goalAmt > 0
              ? `
                <!-- Pasek Celu Utrzymania Areny -->
                <div class="mt-6 pt-5 border-t border-white/10">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2">
                      <span class="text-base">⛽</span>
                      <span class="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wide">${escapeHtml(cfg.goalTitle)}</span>
                      ${cfg.goalPeriod ? `<span class="px-2 py-0.5 rounded-full bg-white/10 text-amber-300 text-[10px] font-bold uppercase">${escapeHtml(cfg.goalPeriod)}</span>` : ''}
                    </div>
                    <div class="font-mono-num text-xs sm:text-sm font-black ${rawPct >= 100 ? 'text-emerald-300' : 'text-amber-300'}">
                      ${curAmt} zł / ${goalAmt} zł (${rawPct}%)${rawPct >= 100 ? ' 🎉 CEL OSIĄGNIĘTY!' : ''}
                    </div>
                  </div>
                  <div class="w-full h-3 rounded-full bg-slate-950/90 border border-white/15 overflow-hidden p-0.5">
                    <div class="h-full rounded-full transition-all duration-500" style="width:${barPct}%;background:linear-gradient(90deg,#f59e0b 0%,#fbbf24 50%,#10b981 100%);box-shadow:0 0 14px rgba(251,191,36,0.55);"></div>
                  </div>

                  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
                    <div class="p-3 rounded-2xl bg-slate-950/75 border border-white/10">
                      <div class="text-base mb-0.5">🖥️</div>
                      <div class="font-display font-bold text-xs text-white uppercase">Hosting &amp; Domena</div>
                      <div class="text-[11px] text-slate-400 mt-0.5">Szybki serwer Hostido NVMe, SSL i kopie bazy 24/7.</div>
                    </div>
                    <div class="p-3 rounded-2xl bg-slate-950/75 border border-white/10">
                      <div class="text-base mb-0.5">🤖</div>
                      <div class="font-display font-bold text-xs text-white uppercase">Vanessa Gemini AI</div>
                      <div class="text-[11px] text-slate-400 mt-0.5">Silnik AI asystentki ligi i automatyczna analiza SS.</div>
                    </div>
                    <div class="p-3 rounded-2xl bg-slate-950/75 border border-white/10">
                      <div class="text-base mb-0.5">💻</div>
                      <div class="font-display font-bold text-xs text-white uppercase">Rozwój &amp; Apka PWA</div>
                      <div class="text-[11px] text-slate-400 mt-0.5">Nowe aktualizacje, Karty UT, grafiki i spoty dla ligi.</div>
                    </div>
                    <div class="p-3 rounded-2xl bg-slate-950/75 border border-white/10">
                      <div class="text-base mb-0.5">🛡️</div>
                      <div class="font-display font-bold text-xs text-white uppercase">Praca Administracji</div>
                      <div class="text-[11px] text-slate-400 mt-0.5">Podziękowanie za codzienną moderację, tabele i turnieje.</div>
                    </div>
                  </div>
                </div>
              `
              : ''
          }
        </section>

        <!-- 2. Interaktywny Wybór Kawy / Cegiełki -->
        <section class="glass-panel rounded-3xl p-5 sm:p-6 border border-white/15 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase">
                ☕ Wybierz Symboliczną Kawę lub Cegiełkę
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Kliknij dowolny kafelek, aby wygenerować gotowy, bezpieczny tytuł dobrowolnej darowizny (każda kwota — nawet 5 zł — ogromnie cieszy!).
              </p>
            </div>
            <span class="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[11px] font-bold">
              Wybrano: ${activeTier.icon} ${escapeHtml(activeTier.title)} (${escapeHtml(activeTier.amount)})
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            ${tiers
              .map((t) => {
                const isSel = t.id === activeTier.id;
                return `
                  <button
                    type="button"
                    onclick="SMPL_APP.selectSupportTier('${t.id}')"
                    class="smpl-support-tier-card text-left p-4 rounded-2xl border relative flex flex-col justify-between gap-2.5 ${
                      isSel
                        ? 'smpl-support-tier-active bg-gradient-to-br from-amber-500/20 via-slate-900/95 to-emerald-500/10 border-amber-400'
                        : 'bg-slate-950/85 hover:bg-slate-900 border-white/15'
                    }"
                  >
                    ${
                      t.badge
                        ? `<span class="inline-block self-start px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-display font-black text-[9px] uppercase tracking-wider shadow">${escapeHtml(t.badge)}</span>`
                        : '<span class="h-4"></span>'
                    }
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-3xl">${t.icon}</span>
                      <span class="font-display font-black text-xl ${isSel ? 'text-amber-300' : 'text-white'} font-mono-num">${escapeHtml(t.amount)}</span>
                    </div>
                    <div>
                      <div class="font-display font-black text-sm text-white uppercase">${escapeHtml(t.title)}</div>
                      <div class="text-[11px] text-slate-300 mt-1 leading-relaxed">${escapeHtml(t.tagline)}</div>
                    </div>
                  </button>
                `;
              })
              .join('')}
          </div>

          <!-- Gotowy tytuł darowizny do skopiowania -->
          <div class="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[10px] font-display font-bold uppercase text-amber-300 tracking-wider">📝 Sugerowany, bezpieczny tytuł przelewu / kawy:</div>
              <div class="text-xs sm:text-sm font-mono-num text-white truncate mt-0.5">${escapeHtml(suggestedTitle)}</div>
            </div>
            <button
              type="button"
              onclick="SMPL_APP.copySupportText('${jsSafeStr(suggestedTitle)}', 'Skopiowano tytuł darowizny!')"
              class="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-black text-xs uppercase tracking-wider shadow flex-shrink-0 transition"
            >
              📋 Kopiuj Tytuł
            </button>
          </div>
        </section>

        <!-- 2b. Ekskluzywna Galeria Podglądu: Symboliczne Pamiątki Graficzne w Podziękowaniu za Kawę -->
        <section class="glass-panel rounded-3xl p-5 sm:p-6 border border-amber-400/35 bg-gradient-to-br from-amber-950/20 via-slate-950/90 to-slate-950 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/45 text-amber-300 font-display font-black text-[10px] uppercase tracking-wider">
                🎁 PREZENT PODZIĘKOWANIA • PEŁNA JAKOŚĆ HD W ZAŁĄCZNIKU
              </span>
              <h3 class="font-display font-black text-lg sm:text-xl text-white uppercase mt-1">
                ✨ Symboliczne Pamiątki Graficzne dla Wspierających (Sezon 56)
              </h3>
              <p class="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Jako wyraz wdzięczności za postawioną kawę przygotowaliśmy <strong>4 kolekcjonerskie pamiątki w pełnej jakości HD</strong> do pobrania w podziękowaniu (wyłącznie symboliczny gest od Twórcy — nie jest to sklep ani sprzedaż cyfrowa).
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="rounded-2xl bg-slate-950 border border-amber-400/30 overflow-hidden flex flex-col">
              <div class="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                <img src="img/vip-preview-phone.jpg" alt="Podgląd Tapety na Telefon SMPL" loading="lazy" class="w-full h-full object-cover object-center opacity-90 select-none pointer-events-none" />
                <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/85 border border-amber-400/50 text-amber-300 font-display font-black text-[9px] uppercase">📱 9:16 TELEFON</span>
                <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-slate-200 font-bold text-[9px] uppercase">PODGLĄD</span>
              </div>
              <div class="p-3 space-y-0.5">
                <div class="font-display font-black text-xs text-white uppercase">Tapeta na Telefon VIP</div>
                <div class="text-[11px] text-slate-400">Noc Mistrzów S56 — ciemna góra pod zegarek ekranu blokady.</div>
              </div>
            </div>

            <div class="rounded-2xl bg-slate-950 border border-amber-400/30 overflow-hidden flex flex-col">
              <div class="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                <img src="img/vip-preview-pc.jpg" alt="Podgląd Tapety na Komputer SMPL" loading="lazy" class="w-full h-full object-cover object-center opacity-90 select-none pointer-events-none" />
                <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/85 border border-amber-400/50 text-amber-300 font-display font-black text-[9px] uppercase">🖥️ 16:9 PULPIT</span>
                <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-slate-200 font-bold text-[9px] uppercase">PODGLĄD</span>
              </div>
              <div class="p-3 space-y-0.5">
                <div class="font-display font-black text-xs text-white uppercase">Tapeta na Komputer HD</div>
                <div class="text-[11px] text-slate-400">Arena Mistrzów SMPL — złoty puchar i stadion w klimacie UCL.</div>
              </div>
            </div>

            <div class="rounded-2xl bg-slate-950 border border-amber-400/30 overflow-hidden flex flex-col">
              <div class="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                <img src="img/vip-preview-cert.jpg" alt="Podgląd Certyfikatu Mecenasa SMPL" loading="lazy" class="w-full h-full object-cover object-center opacity-90 select-none pointer-events-none" />
                <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/85 border border-amber-400/50 text-amber-300 font-display font-black text-[9px] uppercase">🏆 DYPLOM S56</span>
                <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-slate-200 font-bold text-[9px] uppercase">PODGLĄD</span>
              </div>
              <div class="p-3 space-y-0.5">
                <div class="font-display font-black text-xs text-white uppercase">Certyfikat Mecenasa</div>
                <div class="text-[11px] text-slate-400">Kolekcjonerskie podziękowanie społeczności ze złotą pieczęcią.</div>
              </div>
            </div>

            <div class="rounded-2xl bg-slate-950 border border-amber-400/30 overflow-hidden flex flex-col">
              <div class="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                <img src="img/vip-preview-crest.jpg" alt="Podgląd Złotego Herbu Mecenasa SMPL" loading="lazy" class="w-full h-full object-cover object-center opacity-90 select-none pointer-events-none" />
                <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/85 border border-amber-400/50 text-amber-300 font-display font-black text-[9px] uppercase">🎴 1:1 AWATAR</span>
                <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-slate-200 font-bold text-[9px] uppercase">PODGLĄD</span>
              </div>
              <div class="p-3 space-y-0.5">
                <div class="font-display font-black text-xs text-white uppercase">Złoty Herb „MECENAS”</div>
                <div class="text-[11px] text-slate-400">Luksusowy herb 1:1 na profil w portalu, FB lub Messengerze.</div>
              </div>
            </div>
          </div>
          ${
            cfg.buyCoffeeUrl
              ? `<div class="pt-1 flex flex-wrap items-center justify-between gap-3">
                   <span class="text-[11px] text-amber-200/90 font-semibold">☕ Wszystkie 4 pliki HD czekają w załączniku podziękowania po wsparciu na BuyCoffee.to!</span>
                   <a href="${escapeHtml(cfg.buyCoffeeUrl)}" target="_blank" rel="noopener noreferrer" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-lg inline-flex items-center gap-2">
                     ☕ Postaw Kawę na BuyCoffee.to ↗
                   </a>
                 </div>`
              : ''
          }
        </section>

        <!-- 3. Kanały Wsparcia: Twórca Portalu vs Administracja Ligi -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Karta Twórcy Portalu -->
          <div class="${cfg.adminSupportEnabled ? 'lg:col-span-7' : 'lg:col-span-12'} glass-panel rounded-3xl p-5 sm:p-6 border border-amber-400/35 space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-display font-black text-[10px] uppercase">👑 TWÓRCA PORTALU &amp; SERWERA</span>
                <h3 class="font-display font-black text-lg text-white uppercase mt-1">${escapeHtml(cfg.creatorLabel)}</h3>
                <p class="text-xs text-slate-300 mt-1 leading-relaxed">
                  Wybierz najwygodniejszą dla siebie, bezpieczną metodę zewnętrzną. Portal SMPL nie prosi o żadne dane karty ani banku.
                </p>
              </div>
            </div>

            ${
              hasCreatorChannels
                ? `
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    ${
                      cfg.buyCoffeeUrl
                        ? `<a href="${escapeHtml(cfg.buyCoffeeUrl)}" target="_blank" rel="noopener noreferrer" class="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg transition flex items-center justify-between gap-3">
                             <div>
                               <div class="font-display font-black text-sm uppercase">☕ BuyCoffee.to</div>
                               <div class="text-[11px] font-semibold opacity-90">Szybka kawa BLIK / karta (bez rejestracji)</div>
                             </div>
                             <span class="text-xl font-black">↗</span>
                           </a>`
                        : ''
                    }
                    ${
                      cfg.suppiUrl
                        ? `<a href="${escapeHtml(cfg.suppiUrl)}" target="_blank" rel="noopener noreferrer" class="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-lg transition flex items-center justify-between gap-3">
                             <div>
                               <div class="font-display font-black text-sm uppercase">⚡ Suppi / Tipply</div>
                               <div class="text-[11px] font-semibold opacity-90">Błyskawiczny BLIK • 0% prowizji dla twórcy</div>
                             </div>
                             <span class="text-xl font-black">↗</span>
                           </a>`
                        : ''
                    }
                    ${
                      cfg.paypalUrl
                        ? `<a href="${escapeHtml(cfg.paypalUrl)}" target="_blank" rel="noopener noreferrer" class="p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-lg transition flex items-center justify-between gap-3">
                             <div>
                               <div class="font-display font-black text-sm uppercase">💙 PayPal / Revolut</div>
                               <div class="text-[11px] text-blue-100">Wsparcie z Polski i z zagranicy</div>
                             </div>
                             <span class="text-xl font-black">↗</span>
                           </a>`
                        : ''
                    }
                    ${
                      cfg.blikInfo
                        ? `<div class="p-4 rounded-2xl bg-slate-950 border border-emerald-400/40 flex flex-col justify-between gap-2">
                             <div class="flex items-center justify-between gap-2">
                               <span class="font-display font-black text-xs text-emerald-300 uppercase">📱 BLIK / Przelew Bezpośredni</span>
                               <button type="button" onclick="SMPL_APP.copySupportText('${jsSafeStr(cfg.blikInfo)}', 'Skopiowano dane do wpłaty!')" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/40 text-[10px] font-bold uppercase">📋 Kopiuj</button>
                             </div>
                             <div class="font-mono-num text-sm font-black text-white break-all">${escapeHtml(cfg.blikInfo)}</div>
                           </div>`
                        : ''
                    }
                  </div>
                `
                : `
                  <div class="p-5 rounded-2xl bg-slate-950/90 border border-amber-400/30 space-y-3">
                    <div class="flex items-start gap-3">
                      <span class="text-2xl">🚀</span>
                      <div>
                        <div class="font-display font-bold text-sm text-amber-300 uppercase">Szybkie linki (BuyCoffee / Suppi / BLIK) są w trakcie podpinania!</div>
                        <p class="text-xs text-slate-300 mt-1 leading-relaxed">
                          Jeśli chcesz postawić kawę już teraz i dorzucić cegiełkę na serwer Hostido oraz rozwój portalu — kliknij poniżej, aby napisać bezpośrednio do Szymona Komendy na Messengerze.
                        </p>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <a href="https://m.me/szymon.komenda" target="_blank" rel="noopener noreferrer" class="btn-league px-4 py-2.5 rounded-xl font-display font-black text-xs uppercase shadow-lg inline-flex items-center gap-2">
                        💬 Napisz do Szymona na Messenger
                      </a>
                      ${
                        isMaster
                          ? `<button type="button" onclick="SMPL_APP.openMasterSupportConfig()" class="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-400/50 font-display font-bold text-xs uppercase">
                               ⚙️ Wklej Link BuyCoffee / Suppi / BLIK Teraz
                             </button>`
                          : ''
                      }
                    </div>
                  </div>
                `
            }
          </div>

          ${
            cfg.adminSupportEnabled
              ? `
                <!-- Karta Administracji & Zarządu Ligi -->
                <div class="lg:col-span-5 glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-400/30 space-y-4 flex flex-col justify-between">
                  <div class="space-y-3">
                    <div>
                      <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-display font-black text-[10px] uppercase">🛡️ ZARZĄD &amp; ADMINISTRACJA LIGI</span>
                      <h3 class="font-display font-black text-lg text-white uppercase mt-1">${escapeHtml(cfg.adminLabel)}</h3>
                    </div>
                    <p class="text-xs text-slate-300 leading-relaxed">
                      ${escapeHtml(cfg.adminSupportNote || 'Administracja Score Match Liga poświęca swój wolny czas na codzienne zatwierdzanie meczów, pilnowanie zasad Fair Play, obsługę zgłoszeń i organizację konkursów — całkowicie społecznie.')}
                    </p>
                    <div class="p-3 rounded-2xl bg-slate-950/80 border border-white/10 text-[11px] text-slate-300 space-y-1">
                      <div>✅ Codzienna weryfikacja screenów (SS) i aktualizacja tabel</div>
                      <div>✅ Organizacja Pucharu Ligi, Baraży, Superpucharu i Złotej Piłki</div>
                      <div>✅ Prowadzenie Trybunału Fair Play i pomoc nowym graczom</div>
                    </div>
                  </div>

                  <div class="pt-2">
                    ${
                      cfg.adminSupportUrl
                        ? `<a href="${escapeHtml(cfg.adminSupportUrl)}" target="_blank" rel="noopener noreferrer" class="w-full p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-display font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition">
                             🛡️ Wesprzyj Administrację Ligi SMPL ↗
                           </a>`
                        : `<div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/30 text-[11px] text-emerald-200 leading-relaxed">
                             💚 <strong>Wspólny cel społeczności:</strong> każda kawa postawiona przez kanały obok wspiera cały projekt — serwer, rozwój portalu i ekipę Administracji SMPL!
                           </div>`
                    }
                  </div>
                </div>
              `
              : ''
          }
        </div>

        <!-- 4. Honorowa Ściana Mecenasów & Podziękowań -->
        <section class="glass-panel rounded-3xl p-5 sm:p-6 border border-amber-400/25 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="font-display font-black text-lg sm:text-xl text-amber-300 uppercase">
                🏆 Honorowa Ściana Podziękowań &amp; Mecenasów SMPL
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">
                Dziękujemy każdemu, kto dorzucił swoją cegiełkę! Wpis na tablicy ma charakter wyłącznie symbolicznego podziękowania (za dobrowolną zgodą RODO — możesz też pozostać w 100% anonimowy).
              </p>
            </div>
            <span class="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-200 text-xs font-mono-num font-bold">
              ❤️ Podziękowań: ${supporters.length}
            </span>
          </div>

          ${
            supporters.length === 0
              ? `<div class="p-6 rounded-2xl bg-slate-950/75 border border-dashed border-amber-400/35 text-center space-y-1.5">
                   <div class="text-3xl">☕✨</div>
                   <div class="font-display font-bold text-sm text-white uppercase">Tablica Sezonu ${Number((state && state.season) || 56)} czeka na pierwsze podziękowania!</div>
                   <div class="text-xs text-slate-400 max-w-xl mx-auto">
                     Jeśli postawisz kawę i zechcesz, możemy dopisać Twój nick (lub „Anonimowy Kibic”) jako honorowe podziękowanie od Twórcy i Administracji.
                   </div>
                 </div>`
              : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                   ${supporters
                     .map(
                       (sup) => `
                         <div class="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-950/90 to-slate-950 border border-amber-400/30 flex items-start gap-3">
                           <div class="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-xl flex-shrink-0">
                             ${escapeHtml(sup.badge || '☕')}
                           </div>
                           <div class="min-w-0 flex-1">
                             <div class="flex items-center justify-between gap-2">
                               <div class="font-display font-black text-sm text-white truncate">${escapeHtml(sup.displayName || 'Anonimowy Kibic SMPL')}</div>
                               ${sup.date ? `<span class="text-[10px] text-slate-400 font-mono-num flex-shrink-0">${escapeHtml(sup.date)}</span>` : ''}
                             </div>
                             ${sup.note ? `<div class="text-xs text-slate-300 mt-1 leading-relaxed">${escapeHtml(sup.note)}</div>` : '<div class="text-[11px] text-amber-200/80 mt-0.5">Dziękujemy za wsparcie areny SMPL!</div>'}
                           </div>
                         </div>
                       `
                     )
                     .join('')}
                 </div>`
          }
        </section>

        <!-- 5. Pełna Tarcza Prawna & Podatkowa Dobrowolnego Wsparcia -->
        <section class="glass-panel rounded-3xl p-5 sm:p-6 border border-white/15 bg-slate-950/90 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-display font-black text-sm sm:text-base text-slate-100 uppercase flex items-center gap-2">
              <span>🛡️</span> Klauzula Prawna, Podatkowa i Ochrony Graczy (Pełne Zabezpieczenie)
            </h3>
            <span class="px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/10 text-[10px] font-bold text-slate-300 uppercase">Art. 888 k.c. • §18 Regulaminu</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            <div class="p-3 rounded-xl bg-slate-900/70 border border-white/5">
              <strong class="text-emerald-300">1. 100% Dobrowolność &amp; Zero Wpisowego (0 zł):</strong><br/>
              Udział w Score Match Liga Polska jest i zawsze pozostanie całkowicie bezpłatny. Nikt nie ma obowiązku dokonywania jakichkolwiek wpłat, a brak wsparcia nie powoduje żadnych ograniczeń w grze ani w funkcjach portalu.
            </div>
            <div class="p-3 rounded-xl bg-slate-900/70 border border-white/5">
              <strong class="text-amber-300">2. Brak Pay-to-Win &amp; Ustawa o Grach Hazardowych:</strong><br/>
              Darowizna jest w pełni jednostronna i bezinteresowna — NIE stanowi opłaty za udział, zakupu towaru, usługi, punktów, rangi ani przewagi sportowej. Nie wpływa na wyniki, tabele, losowania ani orzeczenia Administracji i Trybunału. Pamiątki graficzne (tapety, certyfikat, herb) są wyłącznie symbolicznym, nieodpłatnym podziękowaniem.
            </div>
            <div class="p-3 rounded-xl bg-slate-900/70 border border-white/5">
              <strong class="text-blue-300">3. Brak Pośrednictwa Płatniczego &amp; RODO:</strong><br/>
              Portal SMPL nie pobiera płatności i nie przechowuje danych kart ani rachunków bankowych. Wpłata następuje bezpośrednio w wybranym zewnętrznym serwisie (np. BuyCoffee.to / Suppi / bank). Publikacja nicku na Ścianie Podziękowań odbywa się wyłącznie za zgodą wspierającego i może być w każdej chwili usunięta.
            </div>
            <div class="p-3 rounded-xl bg-slate-900/70 border border-white/5">
              <strong class="text-rose-300">4. Ochrona Małoletnich &amp; Kwestie Podatkowe (Art. 888 k.c.):</strong><br/>
              Darowizna ma charakter bezzwrotny i mogą jej dokonywać wyłącznie osoby pełnoletnie (18+) lub małoletni za zgodą rodzica/opiekuna prawnego. Darowizny prywatne w III grupie podatkowej korzystają ze zwolnienia z podatku do 5 733 zł łącznie od jednej osoby w okresie 5 lat (Ustawa o podatku od spadków i darowizn).
            </div>
          </div>
        </section>
      </div>
    `;
  }

  return {
    escapeHtml,
    isClansUiEnabled,
    renderClanBadgeHtml,
    renderTrendBadge,
    renderFormBadges,
    renderStandingsView,
    renderCleanSheetsView,
    renderScheduleView,
    renderH2HView,
    renderPlayerProfileUTView,
    filterAndSortUtCatalog,
    renderUtCardsExplorerResultsHtml,
    renderGoldenBallView,
    renderCompetitionsView,
    renderArchiveView,
    renderLegalAndRulesView,
    renderLegalSummaryModalHtml,
    renderPublicBlacklistView,
    renderUpdatesChangelogView,
    renderSupportDonateView
  };
})();
