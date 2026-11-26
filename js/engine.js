/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Automatyczny Silnik Tabel, Czystych Kont (Żelazna Kurtyna), H2H i Terminarza
 * Zastępuje w 100% arkusze Excel — wszystkie wyliczenia odbywają się w czasie rzeczywistym.
 */

window.SMPL_ENGINE = (function () {
  /**
   * Pomocnicza funkcja wyliczająca statystyki bez trendu dla zadanego podzbioru meczów
   */
  function computeRawTable(players, approvedMatches) {
    const statsMap = {};
    players.forEach((p, idx) => {
      const resolvedAvatar =
        p.avatar ||
        (typeof window !== 'undefined' && window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
          ? window.SMPL_MEDIA.generatePlayerAvatar(p.name, p.nick, idx)
          : '');
      statsMap[p.id] = {
        player: p,
        playerId: p.id,
        name: p.name,
        nick: p.nick,
        avatar: resolvedAvatar,
        penaltyPoints: Number(p.penaltyPoints || 0),
        penaltyReason: p.penaltyReason || '',
        yellowCards: Number(p.yellowCards || 0),
        redCards: Number(p.redCards || 0),
        isSuspended: Boolean(p.isSuspended || false),
        suspensionReason: p.suspensionReason || '',
        M: 0,
        W: 0,
        R: 0,
        P: 0,
        BZ: 0,
        BS: 0,
        diff: 0,
        rawPKT: 0,
        PKT: -Math.abs(Number(p.penaltyPoints || 0)),
        cleanSheets: 0,
        history: []
      };
    });

    // Sortujemy mecze chronologicznie wg kolejki i czasu
    const sortedMatches = [...approvedMatches].sort((a, b) => {
      if (Number(a.round) !== Number(b.round)) return Number(a.round) - Number(b.round);
      return String(a.id).localeCompare(String(b.id));
    });

    sortedMatches.forEach((m) => {
      const home = statsMap[m.homeId];
      const away = statsMap[m.awayId];
      if (!home || !away) return;

      const hs = Number(m.homeScore);
      const as = Number(m.awayScore);
      if (isNaN(hs) || isNaN(as)) return;

      home.M += 1;
      away.M += 1;
      home.BZ += hs;
      home.BS += as;
      away.BZ += as;
      away.BS += hs;

      // Czyste konta ("Żelazna Kurtyna") — jeśli gracz stracił 0 bramek w zatwierdzonym meczu
      // (z wyłączeniem obustronnego walkowera 0:0)
      const isMutualWalkoverZero = m.status === 'WALKOVER' && hs === 0 && as === 0;
      if (!isMutualWalkoverZero) {
        if (as === 0) home.cleanSheets += 1;
        if (hs === 0) away.cleanSheets += 1;
      }

      if (hs > as) {
        home.W += 1;
        home.rawPKT += 3;
        away.P += 1;
        home.history.push({
          matchId: m.id,
          round: m.round,
          result: 'Z',
          score: `${hs}:${as}`,
          opponentId: away.playerId,
          opponentName: away.name,
          isHome: true,
          isWalkover: m.status === 'WALKOVER'
        });
        away.history.push({
          matchId: m.id,
          round: m.round,
          result: 'P',
          score: `${as}:${hs}`,
          opponentId: home.playerId,
          opponentName: home.name,
          isHome: false,
          isWalkover: m.status === 'WALKOVER'
        });
      } else if (hs < as) {
        away.W += 1;
        away.rawPKT += 3;
        home.P += 1;
        home.history.push({
          matchId: m.id,
          round: m.round,
          result: 'P',
          score: `${hs}:${as}`,
          opponentId: away.playerId,
          opponentName: away.name,
          isHome: true,
          isWalkover: m.status === 'WALKOVER'
        });
        away.history.push({
          matchId: m.id,
          round: m.round,
          result: 'Z',
          score: `${as}:${hs}`,
          opponentId: home.playerId,
          opponentName: home.name,
          isHome: false,
          isWalkover: m.status === 'WALKOVER'
        });
      } else {
        if (!isMutualWalkoverZero) {
          home.R += 1;
          away.R += 1;
          home.rawPKT += 1;
          away.rawPKT += 1;
          home.history.push({
            matchId: m.id,
            round: m.round,
            result: 'R',
            score: `${hs}:${as}`,
            opponentId: away.playerId,
            opponentName: away.name,
            isHome: true,
            isWalkover: false
          });
          away.history.push({
            matchId: m.id,
            round: m.round,
            result: 'R',
            score: `${as}:${hs}`,
            opponentId: home.playerId,
            opponentName: home.name,
            isHome: false,
            isWalkover: false
          });
        } else {
          home.P += 1;
          away.P += 1;
          home.history.push({
            matchId: m.id,
            round: m.round,
            result: 'P',
            score: `0:0 WO`,
            opponentId: away.playerId,
            opponentName: away.name,
            isHome: true,
            isWalkover: true
          });
          away.history.push({
            matchId: m.id,
            round: m.round,
            result: 'P',
            score: `0:0 WO`,
            opponentId: home.playerId,
            opponentName: home.name,
            isHome: false,
            isWalkover: true
          });
        }
      }
    });

    const rows = Object.values(statsMap).map((row) => {
      row.diff = row.BZ - row.BS;
      row.PKT = row.rawPKT - Math.abs(row.penaltyPoints);
      row.form = row.history.slice(-5);
      return row;
    });

    // Grupowanie graczy o tej samej liczbie punktów w celu wyliczenia małej tabeli H2H
    const byPoints = {};
    rows.forEach((r) => {
      if (!byPoints[r.PKT]) byPoints[r.PKT] = [];
      byPoints[r.PKT].push(r.playerId);
    });

    const h2hMetrics = {};
    Object.values(byPoints).forEach((tiedIds) => {
      if (tiedIds.length <= 1) return;
      const setIds = new Set(tiedIds);
      tiedIds.forEach((id) => {
        h2hMetrics[id] = { pts: 0, diff: 0, bz: 0, played: 0 };
      });
      sortedMatches.forEach((m) => {
        if (setIds.has(m.homeId) && setIds.has(m.awayId)) {
          const hs = Number(m.homeScore);
          const as = Number(m.awayScore);
          h2hMetrics[m.homeId].played += 1;
          h2hMetrics[m.awayId].played += 1;
          h2hMetrics[m.homeId].bz += hs;
          h2hMetrics[m.homeId].diff += hs - as;
          h2hMetrics[m.awayId].bz += as;
          h2hMetrics[m.awayId].diff += as - hs;
          if (hs > as) {
            h2hMetrics[m.homeId].pts += 3;
          } else if (hs < as) {
            h2hMetrics[m.awayId].pts += 3;
          } else if (!(m.status === 'WALKOVER' && hs === 0 && as === 0)) {
            h2hMetrics[m.homeId].pts += 1;
            h2hMetrics[m.awayId].pts += 1;
          }
        }
      });
    });

    // Sortowanie wg: 1. Punkty (PKT), 2. Bezpośredni mecz (H2H), 3. Bilans bramek (+/-), 4. Bramki zdobyte (BZ)
    rows.sort((a, b) => {
      if (b.PKT !== a.PKT) return b.PKT - a.PKT;

      const h2hA = h2hMetrics[a.playerId];
      const h2hB = h2hMetrics[b.playerId];
      if (h2hA && h2hB && (h2hA.played > 0 || h2hB.played > 0)) {
        if (h2hB.pts !== h2hA.pts) return h2hB.pts - h2hA.pts;
        if (h2hB.diff !== h2hA.diff) return h2hB.diff - h2hA.diff;
        if (h2hB.bz !== h2hA.bz) return h2hB.bz - h2hA.bz;
      }

      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.BZ !== a.BZ) return b.BZ - a.BZ;
      if (a.BS !== b.BS) return a.BS - b.BS;
      const orderA = (a.player && a.player.excelOrder) ? Number(a.player.excelOrder) : 999;
      const orderB = (b.player && b.player.excelOrder) ? Number(b.player.excelOrder) : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'pl');
    });

    rows.forEach((r, idx) => {
      r.position = idx + 1;
      r.h2hTieInfo = h2hMetrics[r.playerId] || null;
    });

    return rows;
  }

  /**
   * Wyznacza strefę w tabeli (Mistrzowska/Awansu, Barażowa, Spadkowa)
   */
  function resolveZone(leagueId, position, totalPlayers, state) {
    const leaguesMap = (state && state.leagues) || {};
    const m = String(leagueId || '').toUpperCase().match(/^L(\d+)$/);
    const tier = m ? Number(m[1]) : 99;
    const upperId = tier > 1 ? ('L' + (tier - 1)) : null;
    const lowerId = 'L' + (tier + 1);
    const hasLowerLeague = Boolean(leaguesMap[lowerId] && leaguesMap[lowerId].enabled !== false && (lowerId !== 'L3' || leaguesMap.L3.enabled === true));

    if (leagueId === 'L1' || tier === 1) {
      if (position === 1) {
        return { code: 'CHAMPION', label: 'Mistrz Polski SMPL', colorClass: 'zone-gold' };
      }
      if (position <= 3) {
        return { code: 'PROMOTION', label: 'Podium Ekstraklasy', colorClass: 'zone-green' };
      }
      if (position >= totalPlayers - 1) {
        return { code: 'RELEGATION', label: 'Strefa Spadkowa (Spadek do L2)', colorClass: 'zone-red' };
      }
      if (position >= totalPlayers - 3) {
        return { code: 'PLAYOFF', label: 'Strefa Barażowa o utrzymanie', colorClass: 'zone-yellow' };
      }
      return { code: 'NEUTRAL', label: 'Środek tabeli', colorClass: 'zone-neutral' };
    }

    if (leagueId === 'L2' || tier === 2) {
      if (position <= 2) {
        return { code: 'PROMOTION', label: 'Bezpośredni Awans do Ekstraklasy', colorClass: 'zone-green' };
      }
      if (position <= 5) {
        return { code: 'PLAYOFF', label: 'Strefa Barażowa o Ekstraklasę', colorClass: 'zone-yellow' };
      }
      if (hasLowerLeague) {
        if (position >= totalPlayers - 2) {
          return { code: 'RELEGATION', label: 'Strefa Spadkowa (Spadek do L3)', colorClass: 'zone-red' };
        }
        if (position >= totalPlayers - 4) {
          return { code: 'PLAYOFF_DOWN', label: 'Baraż o utrzymanie w 2. Lidze', colorClass: 'zone-yellow' };
        }
      } else if (position >= totalPlayers - 1) {
        return { code: 'PLAYOFF_DOWN', label: 'Dolna strefa tabeli (Weryfikacja L2)', colorClass: 'zone-red' };
      }
      return { code: 'NEUTRAL', label: 'Bezpieczna strefa L2', colorClass: 'zone-neutral' };
    }

    // Dywizje L3, L4, L5...
    const upperLabel = upperId === 'L2' ? '2. Ligi (L2)' : (upperId || 'wyższej ligi');
    if (position <= 2) {
      return { code: 'PROMOTION', label: 'Bezpośredni Awans do ' + upperLabel, colorClass: 'zone-green' };
    }
    if (position <= 5) {
      return { code: 'PLAYOFF', label: 'Strefa Barażowa o ' + upperLabel, colorClass: 'zone-yellow' };
    }
    if (position >= totalPlayers - 1) {
      return {
        code: 'RELEGATION',
        label: hasLowerLeague ? ('Strefa Spadkowa (Spadek do ' + lowerId + ')') : 'Strefa Spadkowa / Weryfikacja',
        colorClass: 'zone-red'
      };
    }
    return { code: 'NEUTRAL', label: 'Środek tabeli ' + leagueId, colorClass: 'zone-neutral' };
  }

  /**
   * 1. GŁÓWNA FUNKCJA TABELI LIGOWEJ NA ŻYWO
   */
  function calculateStandings(state, leagueId) {
    const players = (state.players || []).filter((p) => p.leagueId === leagueId && p.active !== false);
    const approvedMatches = (state.matches || []).filter(
      (m) => m.leagueId === leagueId && (m.status === 'APPROVED' || m.status === 'WALKOVER')
    );

    const currentRows = computeRawTable(players, approvedMatches);

    // Wyliczamy pozycje z poprzedniej kolejki, aby pokazać Trend (strzałki w górę / w dół / bez zmian)
    const playedRounds = approvedMatches
      .filter((m) => !m.isByeWalkover)
      .map((m) => Number(m.round || 1));
    const maxRound = playedRounds.length > 0 ? Math.max(...playedRounds) : 1;
    const prevMatches =
      maxRound > 1
        ? approvedMatches.filter((m) => Number(m.round) < maxRound)
        : [];
    const prevRows = prevMatches.length > 0 ? computeRawTable(players, prevMatches) : currentRows;
    const prevPosMap = {};
    prevRows.forEach((r) => {
      prevPosMap[r.playerId] = r.position;
    });

    const total = currentRows.length;
    currentRows.forEach((r) => {
      const prevPos = prevPosMap[r.playerId] || r.position;
      const delta = prevPos - r.position; // dodatnia = awans w górę
      r.prevPosition = prevPos;
      r.trendDelta = delta;
      r.trend = delta > 0 ? 'UP' : delta < 0 ? 'DOWN' : 'SAME';
      r.zone = resolveZone(leagueId, r.position, total, state);
      r.cleanSheetPct = r.M > 0 ? Number(((r.cleanSheets / r.M) * 100).toFixed(1)) : 0;
      r.goalsAgainstAvg = r.M > 0 ? Number((r.BS / r.M).toFixed(2)) : 0;
      r.goalsForAvg = r.M > 0 ? Number((r.BZ / r.M).toFixed(2)) : 0;
      r.winRate = r.M > 0 ? Number(((r.W / r.M) * 100).toFixed(1)) : 0;
    });

    return currentRows;
  }

  /**
   * 2. KLASYFIKACJA „ŻELAZNA KURTYNA / ZŁOTE RĘKAWICE” (CZYSTE KONTA)
   */
  function calculateCleanSheetsRanking(state, leagueId) {
    const standings = calculateStandings(state, leagueId).filter(
      (r) => !r.player || (!r.player.isPlaceholder && !r.player.gdprDeleted)
    );
    const ranked = [...standings].sort((a, b) => {
      if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
      if (b.cleanSheetPct !== a.cleanSheetPct) return b.cleanSheetPct - a.cleanSheetPct;
      if (a.M > 0 && b.M > 0 && a.goalsAgainstAvg !== b.goalsAgainstAvg) {
        return a.goalsAgainstAvg - b.goalsAgainstAvg;
      }
      if (b.M !== a.M) return b.M - a.M;
      return a.position - b.position;
    });

    return ranked.map((r, index) => ({
      rank: index + 1,
      playerId: r.playerId,
      name: r.name,
      nick: r.nick,
      avatar: r.avatar,
      leaguePosition: r.position,
      cleanSheets: r.cleanSheets,
      matchesPlayed: r.M,
      cleanSheetPct: r.cleanSheetPct,
      goalsConceded: r.BS,
      goalsAgainstAvg: r.goalsAgainstAvg,
      form: r.form
    }));
  }

  /**
   * 3. PORÓWNYWARKA H2H (HEAD-TO-HEAD)
   */
  function calculateH2H(state, playerAId, playerBId) {
    const allPlayers = state.players || [];
    const playerA = allPlayers.find((p) => p.id === playerAId);
    const playerB = allPlayers.find((p) => p.id === playerBId);
    if (!playerA || !playerB) return null;

    const standingsA = calculateStandings(state, playerA.leagueId);
    const standingsB =
      playerA.leagueId === playerB.leagueId
        ? standingsA
        : calculateStandings(state, playerB.leagueId);

    const statsA = standingsA.find((s) => s.playerId === playerAId) || {};
    const statsB = standingsB.find((s) => s.playerId === playerBId) || {};

    // Wszystkie mecze bezpośrednie (zatwierdzone, oczekujące i zaplanowane)
    const directMatches = (state.matches || [])
      .filter(
        (m) =>
          (m.homeId === playerAId && m.awayId === playerBId) ||
          (m.homeId === playerBId && m.awayId === playerAId)
      )
      .sort((a, b) => Number(a.round) - Number(b.round));

    let winsA = 0;
    let winsB = 0;
    let draws = 0;
    let goalsA = 0;
    let goalsB = 0;
    let playedCount = 0;

    directMatches.forEach((m) => {
      if (m.status !== 'APPROVED' && m.status !== 'WALKOVER') return;
      playedCount += 1;
      const isAHome = m.homeId === playerAId;
      const gA = isAHome ? Number(m.homeScore) : Number(m.awayScore);
      const gB = isAHome ? Number(m.awayScore) : Number(m.homeScore);
      goalsA += gA;
      goalsB += gB;
      if (gA > gB) winsA += 1;
      else if (gB > gA) winsB += 1;
      else draws += 1;
    });

    return {
      playerA,
      playerB,
      statsA,
      statsB,
      direct: {
        playedCount,
        winsA,
        winsB,
        draws,
        goalsA,
        goalsB,
        matches: directMatches
      }
    };
  }

  function isPlaceholderPlayer(pl) {
    if (!pl) return false;
    return Boolean(
      pl.id === '__BYE__' ||
      pl.isPlaceholder === true ||
      pl.gdprDeleted === true ||
      /^wolny\s*los|^wl\d+$/i.test(String(pl.name || '').trim())
    );
  }

  /**
   * 4. GENERATOR TERMINARZA „KAŻDY Z KAŻDYM” (DWUMECZ W KAŻDEJ KOLEJCE — ALGORYTM BERGERA)
   * Zgodnie z arkuszem SMPL każda kolejka zawiera od razu pełny dwumecz każdej pary (Mecz #1 + Rewanż #2).
   * Dla 16 miejsc w lidze generuje dokładnie 15 kolejek × 16 spotkań = 240 meczów (30 meczów na gracza).
   * Mecze przeciwko slotom WOLNY LOS otrzymują automatycznie walkower 2:0 i 0:2 (+3 pkt za mecz).
   */
  function generateRoundRobinSchedule(players, leagueId, existingMatches = [], preservePlayed = true) {
    const list = [...players];
    if (list.length < 2) return [];

    if (list.length % 2 !== 0) {
      list.push({ id: '__BYE__', name: 'PAUZA', isPlaceholder: true });
    }

    const n = list.length;
    const roundsCount = n - 1;
    const matchesPerRound = n / 2;
    const generated = [];

    // Mapa już rozegranych lub oczekujących meczów (pomijamy stare auto-walkowery BYE przy przeliczeniu pod nowy skład)
    const preservedMap = {};
    if (preservePlayed && existingMatches && existingMatches.length > 0) {
      existingMatches.forEach((m) => {
        if (m && m.leagueId === leagueId && m.status !== 'SCHEDULED' && !m.isByeWalkover) {
          const key = `${m.homeId}__${m.awayId}`;
          preservedMap[key] = m;
        }
      });
    }

    function createLegRecord(homeObj, awayObj, roundNum, id, companionId, legNo) {
      const key = `${homeObj.id}__${awayObj.id}`;
      if (preservedMap[key]) {
        const cloned = Object.assign({}, preservedMap[key], {
          round: roundNum,
          legNumber: legNo,
          companionMatchId: companionId
        });
        delete preservedMap[key];
        return cloned;
      }
      const homeBye = isPlaceholderPlayer(homeObj);
      const awayBye = isPlaceholderPlayer(awayObj);
      if (homeBye || awayBye) {
        let hs = 0;
        let as = 0;
        let woNote = 'Pusty dwumecz między slotami WOLNY LOS (0:0).';
        if (!homeBye && awayBye) {
          hs = 2;
          as = 0;
          woNote = 'Automatyczny walkower 2:0 WO (WOLNY LOS).';
        } else if (homeBye && !awayBye) {
          hs = 0;
          as = 2;
          woNote = 'Automatyczny walkower 0:2 WO (WOLNY LOS).';
        }
        return {
          id,
          leagueId,
          round: roundNum,
          legNumber: legNo,
          companionMatchId: companionId,
          homeId: homeObj.id,
          awayId: awayObj.id,
          homeScore: hs,
          awayScore: as,
          status: 'WALKOVER',
          isByeWalkover: true,
          screenshot: null,
          submittedBy: 'SYSTEM (WOLNY LOS)',
          submittedAt: null,
          approvedBy: 'SYSTEM SMPL',
          approvedAt: null,
          comment: woNote
        };
      }
      return {
        id,
        leagueId,
        round: roundNum,
        legNumber: legNo,
        companionMatchId: companionId,
        homeId: homeObj.id,
        awayId: awayObj.id,
        homeScore: null,
        awayScore: null,
        status: 'SCHEDULED',
        screenshot: null,
        submittedBy: null,
        submittedAt: null,
        comment: ''
      };
    }

    const rotation = [...list];
    for (let r = 0; r < roundsCount; r++) {
      const roundNum = r + 1;
      for (let i = 0; i < matchesPerRound; i++) {
        const p1 = rotation[i];
        const p2 = rotation[n - 1 - i];
        if (p1.id !== '__BYE__' && p2.id !== '__BYE__') {
          const p1Bye = isPlaceholderPlayer(p1);
          const p2Bye = isPlaceholderPlayer(p2);
          let leg1Home;
          let leg1Away;
          if (p1Bye !== p2Bye) {
            // Zgodnie z arkuszem najpierw aktywny gracz jako gospodarz (2:0), pod spodem rewanż (0:2)
            leg1Home = p1Bye ? p2 : p1;
            leg1Away = p1Bye ? p1 : p2;
          } else {
            leg1Home = (r + i) % 2 === 0 ? p1 : p2;
            leg1Away = (r + i) % 2 === 0 ? p2 : p1;
          }
          const leg1Id = `M_${leagueId}_R${roundNum}_P${i + 1}_1`;
          const leg2Id = `M_${leagueId}_R${roundNum}_P${i + 1}_2`;
          const leg1 = createLegRecord(leg1Home, leg1Away, roundNum, leg1Id, leg2Id, 1);
          const leg2 = createLegRecord(leg1Away, leg1Home, roundNum, leg2Id, leg1.id, 2);
          leg1.companionMatchId = leg2.id;
          generated.push(leg1);
          generated.push(leg2);
        }
      }
      // Obrót tablicy Bergera (element 0 stały)
      const last = rotation.pop();
      rotation.splice(1, 0, last);
    }

    return generated;
  }

  /**
   * 5. SYSTEM „4 KOLEJKI NA TYDZIEŃ” — POMOCNICZE WYLICZENIA TYGODNI ROZGRYWKOWYCH
   */
  function getWeekForRound(roundNum, roundsPerWeek) {
    const rpw = Number(roundsPerWeek || 4);
    return Math.ceil(Math.max(1, Number(roundNum || 1)) / rpw);
  }

  function getRoundsRangeForWeek(weekNum, roundsPerWeek, maxRound) {
    const rpw = Number(roundsPerWeek || 4);
    const w = Math.max(1, Number(weekNum || 1));
    const startRound = (w - 1) * rpw + 1;
    const endRound = Math.min(Number(maxRound || 15), w * rpw);
    return { weekNum: w, startRound: startRound, endRound: endRound };
  }

  /**
   * 6. KARTA ZAWODNIKA ULTIMATE TEAM (OVR 75–99) + ULUBIONY RYWAL / NEMEZIS / STYL GRY (Z EXCELA!)
   */
  function calculatePlayerUTCard(state, playerId) {
    const players = state.players || [];
    const player = players.find((p) => p.id === playerId) || players[0];
    if (!player) return null;

    const playersMap = {};
    players.forEach((p) => {
      playersMap[p.id] = p;
    });

    const standings = calculateStandings(state, player.leagueId);
    const row = standings.find((r) => r.playerId === player.id) || {
      position: 1,
      M: 0,
      W: 0,
      R: 0,
      P: 0,
      BZ: 0,
      BS: 0,
      diff: 0,
      PKT: 0,
      cleanSheets: 0,
      cleanSheetPct: 0,
      goalsForAvg: 0,
      goalsAgainstAvg: 0,
      winRate: 0,
      form: [],
      history: []
    };

    const catalog =
      typeof window !== 'undefined' &&
      window.SMPL_DB &&
      typeof window.SMPL_DB.getHistoricalPlayersCatalog === 'function'
        ? window.SMPL_DB.getHistoricalPlayersCatalog()
        : null;
    const careerFallbackList = state.careerRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.CAREER_RANKING) || [];
    const allTimeList = state.allTimeRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.ALL_TIME_RANKING) || [];
    const lookupList = catalog && catalog.length > 0 ? catalog : (careerFallbackList.length > 0 ? careerFallbackList : allTimeList);
    const archTarget = player.historicalArchiveName || player.name || '';
    const matchedFromArchive =
      (typeof window !== 'undefined' &&
        window.SMPL_DB &&
        typeof window.SMPL_DB.findArchiveEntryByName === 'function' &&
        (window.SMPL_DB.findArchiveEntryByName(archTarget) || window.SMPL_DB.findArchiveEntryByName(player.name))) ||
      lookupList.find(
        (a) =>
          a.name.toLowerCase() === String(archTarget).toLowerCase() ||
          a.name.toLowerCase() === String(player.name || '').toLowerCase()
      );
    const allTimeEntry = player.historicalStats || matchedFromArchive || {
      rank: '-',
      seasons: 1,
      matches: row.M,
      wins: row.W,
      draws: row.R,
      losses: row.P,
      gf: row.BZ,
      ga: row.BS,
      points: row.PKT,
      total: row.PKT,
      gold: 0,
      silver: 0,
      bronze: 0,
      bestPos: '#' + (row.position || 1) + ' (' + player.leagueId + ')'
    };

    const trophies = player.trophies || [];
    const formPts = (row.form || []).reduce((acc, f) => acc + (f.result === 'Z' ? 3 : f.result === 'R' ? 1 : 0), 0);

    // 6 Statystyk FIFA / EA FC Ultimate Team (68..99)
    const ata = Math.min(99, Math.max(70, Math.round(72 + (row.goalsForAvg || 1.2) * 10 + (allTimeEntry.gf > 400 ? 4 : 0))));
    const def = Math.min(99, Math.max(70, Math.round(74 + (row.cleanSheets || 0) * 4 - (row.goalsAgainstAvg || 1.0) * 4)));
    const forStat = Math.min(99, Math.max(68, Math.round(70 + formPts * 1.9)));
    const skt = Math.min(99, Math.max(70, Math.round(68 + (row.winRate || 50) * 0.3)));
    const dos = Math.min(99, Math.max(72, Math.round(71 + Math.min(25, (allTimeEntry.seasons || 1) * 0.9) + trophies.length * 1.2)));
    const men = Math.min(99, Math.max(72, Math.round(75 + (row.W * 2) - row.P + (allTimeEntry.gold || 0) * 2)));

    const ovr = Math.min(99, Math.max(76, Math.round((ata + def + forStat + skt + dos + men) / 6)));

    let cardTier = 'GOLD_PRO';
    let cardLabel = 'ZŁOTA KARTA PRO SMPL';
    if (ovr >= 89 || (allTimeEntry.gold || 0) >= 3) {
      cardTier = 'ICON_LEGEND';
      cardLabel = 'IKONA & LEGENDA SMPL';
    } else if (ovr >= 84 || row.position <= 3) {
      cardTier = 'TOTW_STAR';
      cardLabel = 'GWIAZDA LIGI (TOTW)';
    }

    // Wyliczanie Ulubionego Rywala i Nemezis z rozegranych meczów (dokładnie jak w Excelu!)
    let favoriteRival = 'Brak danych (rozegraj więcej meczów)';
    let nemesis = 'Brak danych (rozegraj więcej meczów)';
    if (row.history && row.history.length > 0) {
      const oppStats = {};
      row.history.forEach((h) => {
        if (!oppStats[h.opponentId]) {
          oppStats[h.opponentId] = { name: h.opponentName, pts: 0, gf: 0, ga: 0, games: 0 };
        }
        const os = oppStats[h.opponentId];
        os.games += 1;
        if (h.result === 'Z') os.pts += 3;
        else if (h.result === 'R') os.pts += 1;
        const parts = String(h.score || '0:0').split(':');
        os.gf += Number(parts[0] || 0);
        os.ga += Number(parts[1] || 0);
      });

      const oppArr = Object.keys(oppStats).map((k) => oppStats[k]);
      oppArr.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        return (b.gf - b.ga) - (a.gf - a.ga);
      });
      if (oppArr[0] && (oppArr[0].pts > 0 || oppArr[0].gf > 0)) {
        favoriteRival = oppArr[0].name + ' (' + oppArr[0].pts + ' pkt, bilans ' + oppArr[0].gf + ':' + oppArr[0].ga + ')';
      }

      const nemArr = oppArr.slice().sort((a, b) => {
        if (a.pts !== b.pts) return a.pts - b.pts;
        return (a.gf - a.ga) - (b.gf - b.ga);
      });
      if (nemArr[0] && nemArr[0].pts < nemArr[0].games * 3) {
        nemesis = nemArr[0].name + ' (' + nemArr[0].pts + ' pkt, bilans ' + nemArr[0].gf + ':' + nemArr[0].ga + ')';
      } else {
        nemesis = 'Brak pogromcy — komplet zwycięstw! 🔥';
      }
    }

    // Styl gry (z Excela: Catenaccio / Mur, Tiki-Taka, Królewska Dominacja, Zbalansowany)
    let playstyle = '⚖️ Taktyczny Balans SMPL';
    if (row.cleanSheetPct >= 45 || def >= 88) {
      playstyle = '🧱 Żelazne Catenaccio / Mur (Mistrz Czystych Kont)';
    } else if (row.goalsForAvg >= 2.0 || ata >= 88) {
      playstyle = '🔥 Ofensywna Tiki-Taka (Maszyna Bramkowa)';
    } else if (row.winRate >= 65) {
      playstyle = '👑 Królewska Dominacja (Kontrola Meczu)';
    } else if (men >= 86) {
      playstyle = '⚡ Zabójcza Kontra & Stalowe Nerwy';
    }

    // Seria i Komentarz Mentalny
    let streakText = 'Brak serii';
    if (row.form && row.form.length > 0) {
      const lastRes = row.form[row.form.length - 1].result;
      let count = 0;
      for (let i = row.form.length - 1; i >= 0; i--) {
        if (row.form[i].result === lastRes) count++;
        else break;
      }
      const labelMap = { Z: 'zwycięstw z rzędu 🔥', R: 'remisów z rzędu 🤝', P: 'meczów bez wygranej ⚠️' };
      streakText = count + ' ' + (labelMap[lastRes] || '');
    }

    let mentalReport = 'Solidna dyspozycja w Score Match Lidze. Kluczowe będą najbliższe 4 kolejki tygodnia.';
    if (row.position === 1) {
      mentalReport = 'Lider tabeli! Mentalność zwycięzcy — rywale grają przeciwko niemu z podwójną presją.';
    } else if (row.position <= 3) {
      mentalReport = 'Ścisła czołówka ligi. Bardzo wysoka powtarzalność i żelazna koncentracja w obronie.';
    } else if (forStat >= 84) {
      mentalReport = 'W gazie! Ostatnie kolejki pokazują wyraźny skok formy i skuteczności pod bramką.';
    }

    // Nadchodzące mecze gracza z oznaczeniem 🏠 DOM (Ty zapraszasz!) / ✈️ WYJAZD (Czekasz na zaproszenie)
    const upcomingMatches = (state.matches || [])
      .filter(
        (m) =>
          m.leagueId === player.leagueId &&
          (m.status === 'SCHEDULED' || m.status === 'PENDING') &&
          (m.homeId === player.id || m.awayId === player.id)
      )
      .sort((a, b) => Number(a.round) - Number(b.round))
      .slice(0, 6)
      .map((m) => {
        const isHome = m.homeId === player.id;
        const opp = playersMap[isHome ? m.awayId : m.homeId] || { name: 'Rywal', nick: 'SMPL' };
        return {
          matchId: m.id,
          round: m.round,
          week: getWeekForRound(m.round, (state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4),
          isHome: isHome,
          roleLabel: isHome ? '🏠 DOM (Ty zapraszasz!)' : '✈️ WYJAZD (Czekasz na zapr.)',
          opponentName: opp.name,
          opponentNick: opp.nick,
          status: m.status,
          score: m.homeScore !== null ? m.homeScore + ':' + m.awayScore : null
        };
      });

    const attrsObj = {
      ATA: ata,
      DEF: def,
      FOR: forStat,
      SKT: skt,
      DOS: dos,
      MEN: men
    };

    return {
      player: player,
      seasonRow: row,
      row: row,
      allTime: allTimeEntry,
      trophies: trophies,
      ovr: ovr,
      cardTier: cardTier,
      cardLabel: cardLabel,
      tierLabel: cardLabel,
      attributes: attrsObj,
      attrs: attrsObj,
      favoriteRival: favoriteRival,
      nemesis: nemesis,
      playstyle: playstyle,
      streakText: streakText,
      mentalReport: mentalReport,
      upcomingMatches: upcomingMatches
    };
  }

  /**
   * 7. PLEBISCYT ZŁOTA PIŁKA SCORE MATCH LIGA — RANKING GŁOSÓW NA ŻYWO
   */
  function foldGoldenBallIdentity(val) {
    return String(val || '')
      .trim()
      .toLowerCase()
      .replace(/\u0105/g, 'a')
      .replace(/\u0107/g, 'c')
      .replace(/\u0119/g, 'e')
      .replace(/\u0142/g, 'l')
      .replace(/\u0144/g, 'n')
      .replace(/\u00f3/g, 'o')
      .replace(/\u015b/g, 's')
      .replace(/\u017a/g, 'z')
      .replace(/\u017c/g, 'z')
      .replace(/\s+/g, ' ');
  }

  function clampGbMetric(val, min, max) {
    const num = Number(val);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
  }

  function calculateGoldenBallStandings(state) {
    const rawVotes = (state.goldenBall && state.goldenBall.votes) || [];
    const players = (state.players || []).filter((p) => {
      if (!p || p.active === false) return false;
      if (p.isPlaceholder || p.gdprDeleted) return false;
      if (p.isBlacklisted || p.banned || p.customRank === 'BLACKLISTED') return false;
      if (!p.leagueId || p.leagueId === 'POOL') return false;
      return true;
    });

    // Zbieramy statystyki sezonowe każdego gracza ze wszystkich aktywnych lub obsadzonych lig
    const gbLeagueIds = [];
    const seenGb = {};
    const addGbLid = (id) => {
      if (id && id !== 'POOL' && !seenGb[id]) {
        seenGb[id] = true;
        gbLeagueIds.push(id);
      }
    };
    if (state.leagues) {
      Object.keys(state.leagues).forEach((lid) => {
        const lg = state.leagues[lid];
        if (lg && lg.enabled !== false) addGbLid(lid);
      });
    }
    players.forEach((p) => { if (p && p.leagueId) addGbLid(p.leagueId); });
    if (gbLeagueIds.length === 0) ['L1', 'L2'].forEach(addGbLid);

    const allRowsMap = {};
    const divisionSizes = {};
    const maxPktByLeague = {};
    let globalMaxPkt = 12;
    let totalMatchesSum = 0;
    let activeWithMatchesCount = 0;

    gbLeagueIds.forEach((lid) => {
      const list = calculateStandings(state, lid);
      divisionSizes[lid] = Math.max(1, list.length);
      let divMax = 0;
      list.forEach((r) => {
        allRowsMap[r.playerId] = r;
        if (r.PKT > divMax) divMax = r.PKT;
        if (r.PKT > globalMaxPkt) globalMaxPkt = r.PKT;
        if (r.M > 0) {
          totalMatchesSum += r.M;
          activeWithMatchesCount += 1;
        }
      });
      maxPktByLeague[lid] = Math.max(9, divMax);
    });

    const playerById = {};
    players.forEach((p) => {
      playerById[p.id] = p;
    });

    // Scisla deduplikacja glosow: maksymalnie 1 glos od jednego glosujacego + odrzucanie autoglosow
    const seenVoterIds = new Set();
    const seenVoterPlayerIds = new Set();
    const seenLegacyVoterNames = {};
    const validVotes = [];
    const voteCounts = {};
    let filteredDuplicateVotes = 0;
    let filteredSelfVotes = 0;

    rawVotes.forEach((v) => {
      if (!v || !v.candidateId) return;
      const cand = playerById[v.candidateId];
      if (!cand) return;

      const vIdFold = foldGoldenBallIdentity(v.voterId || '');
      const vPlrFold = foldGoldenBallIdentity(v.voterPlayerId || '');
      const vNameFold = foldGoldenBallIdentity(v.voterName || '');
      const candIdFold = foldGoldenBallIdentity(cand.id);
      const candNameFold = foldGoldenBallIdentity(cand.name);

      // Blokada glosowania na samego siebie (rowniez dla historycznych wpisow)
      if (
        (vPlrFold && vPlrFold === candIdFold) ||
        (vIdFold && vIdFold === ('plr_' + candIdFold)) ||
        (!vIdFold && !vPlrFold && vNameFold && vNameFold === candNameFold)
      ) {
        filteredSelfVotes += 1;
        return;
      }

      if (vIdFold) {
        if (seenVoterIds.has(vIdFold)) {
          filteredDuplicateVotes += 1;
          return;
        }
        if (vPlrFold && seenVoterPlayerIds.has(vPlrFold)) {
          filteredDuplicateVotes += 1;
          return;
        }
        if (vNameFold && vNameFold.length >= 2 && seenLegacyVoterNames[vNameFold] === 'LEGACY') {
          filteredDuplicateVotes += 1;
          return;
        }
        seenVoterIds.add(vIdFold);
        if (vPlrFold) seenVoterPlayerIds.add(vPlrFold);
        if (vNameFold && vNameFold.length >= 2 && !seenLegacyVoterNames[vNameFold]) {
          seenLegacyVoterNames[vNameFold] = vIdFold;
        }
      } else if (vPlrFold) {
        if (seenVoterPlayerIds.has(vPlrFold)) {
          filteredDuplicateVotes += 1;
          return;
        }
        if (vNameFold && vNameFold.length >= 2 && seenLegacyVoterNames[vNameFold] === 'LEGACY') {
          filteredDuplicateVotes += 1;
          return;
        }
        seenVoterPlayerIds.add(vPlrFold);
        if (vNameFold && vNameFold.length >= 2 && !seenLegacyVoterNames[vNameFold]) {
          seenLegacyVoterNames[vNameFold] = 'plr_' + vPlrFold;
        }
      } else if (vNameFold && vNameFold.length >= 2) {
        if (seenLegacyVoterNames[vNameFold]) {
          filteredDuplicateVotes += 1;
          return;
        }
        seenLegacyVoterNames[vNameFold] = 'LEGACY';
      }

      validVotes.push(v);
      voteCounts[cand.id] = (voteCounts[cand.id] || 0) + 1;
    });

    const totalVotes = validVotes.length;
    const avgMatches = activeWithMatchesCount > 0 ? totalMatchesSum / activeWithMatchesCount : 0;
    const confidenceDenom = Math.max(4, Math.min(10, avgMatches * 0.85 || 4));
    const maxVotes = Math.max(0, ...Object.values(voteCounts));
    const voteConfidence = totalVotes > 0 ? Math.min(1, totalVotes / Math.max(3, Math.ceil(players.length * 0.35))) : 0;
    const voteShareWeight = totalVotes > 0 ? Number((0.25 * voteConfidence).toFixed(4)) : 0;
    const meritWeight = Number((1 - voteShareWeight).toFixed(4));

    const candidates = players.map((p) => {
      const sRow = allRowsMap[p.id] || {
        PKT: 0,
        BZ: 0,
        BS: 0,
        diff: 0,
        cleanSheets: 0,
        cleanSheetPct: 0,
        goalsForAvg: 0,
        goalsAgainstAvg: 0,
        winRate: 0,
        position: divisionSizes[p.leagueId] || 10,
        M: 0,
        W: 0,
        R: 0,
        P: 0,
        yellowCards: Number(p.yellowCards || 0),
        redCards: Number(p.redCards || 0),
        penaltyPoints: Number(p.penaltyPoints || 0),
        form: [],
        history: []
      };

      const mMatch = String(p.leagueId || 'L2').toUpperCase().match(/^L(\d+)$/);
      const tier = mMatch ? Number(mMatch[1]) : 3;
      const leagueWeight = Math.max(0.60, Number((1.0 - (tier - 1) * 0.13).toFixed(2)));
      const divSize = divisionSizes[p.leagueId] || 1;
      const divMaxPkt = maxPktByLeague[p.leagueId] || globalMaxPkt;

      const mp = Number(sRow.M || 0);
      const pkt = Number(sRow.PKT || 0);
      const bz = Number(sRow.BZ || 0);
      const bs = Number(sRow.BS || 0);
      const diff = Number(sRow.diff != null ? sRow.diff : bz - bs);
      const cs = Number(sRow.cleanSheets || 0);
      const pos = Number(sRow.position || divSize);
      const wins = Number(sRow.W || 0);
      const draws = Number(sRow.R || 0);

      const sampleConfidence = mp > 0 ? Math.min(1, 0.32 + 0.68 * (mp / confidenceDenom)) : 0;
      const ppg = mp > 0 ? pkt / mp : 0;
      const ppgNorm = clampGbMetric((ppg / 3) * 100, 0, 100);
      const posScore = mp > 0 ? (divSize > 1 ? clampGbMetric(100 - ((pos - 1) / (divSize - 1)) * 75, 15, 100) : 100) : 0;
      const volumeNorm = clampGbMetric((Math.max(0, pkt) / Math.max(9, divMaxPkt)) * 100, 0, 100);
      const pointsPower = Number(
        clampGbMetric((0.48 * ppgNorm + 0.30 * volumeNorm + 0.22 * posScore) * leagueWeight * sampleConfidence, 0, 100).toFixed(1)
      );

      const gzPerMatch = mp > 0 ? bz / mp : 0;
      const attackRate = clampGbMetric((gzPerMatch / 1.75) * 100, 0, 100);
      const diffPerMatch = mp > 0 ? diff / mp : 0;
      const diffRate = clampGbMetric(((diffPerMatch + 1.1) / 2.5) * 100, 0, 100);
      const attackPower = Number(
        clampGbMetric((0.62 * attackRate + 0.38 * diffRate) * (0.4 + 0.6 * leagueWeight) * sampleConfidence, 0, 100).toFixed(1)
      );

      const csPct = mp > 0 ? (cs / mp) * 100 : 0;
      const gaPerMatch = mp > 0 ? bs / mp : 2;
      const concedeScore = mp > 0 ? clampGbMetric((1 - gaPerMatch / 1.85) * 100, 0, 100) : 0;
      const defensePower = Number(
        clampGbMetric((0.58 * csPct + 0.42 * concedeScore) * (0.4 + 0.6 * leagueWeight) * sampleConfidence, 0, 100).toFixed(1)
      );

      const winPct = mp > 0 ? (wins / mp) * 100 : 0;
      const unbeatenPct = mp > 0 ? ((wins + draws) / mp) * 100 : 0;
      const recentArr = Array.isArray(sRow.form) ? sRow.form : [];
      let recentScore = winPct;
      if (recentArr.length > 0) {
        const recentPts = recentArr.reduce((acc, item) => {
          if (!item) return acc;
          if (item.result === 'Z') return acc + 3;
          if (item.result === 'R') return acc + 1;
          return acc;
        }, 0);
        recentScore = clampGbMetric((recentPts / (recentArr.length * 3)) * 100, 0, 100);
      }
      const formConsistency = Number(
        clampGbMetric((0.45 * winPct + 0.25 * unbeatenPct + 0.30 * recentScore) * sampleConfidence, 0, 100).toFixed(1)
      );

      const yc = Number(sRow.yellowCards || p.yellowCards || 0);
      const rc = Number(sRow.redCards || p.redCards || 0);
      const pen = Math.abs(Number(sRow.penaltyPoints || p.penaltyPoints || 0));
      const walkoverLosses = Array.isArray(sRow.history)
        ? sRow.history.filter((h) => h && h.isWalkover && h.result === 'P').length
        : 0;
      const disciplineRaw = clampGbMetric(100 - yc * 6 - rc * 18 - pen * 12 - walkoverLosses * 15, 0, 100);
      const fairPlayScore = Number(
        clampGbMetric(mp > 0 ? disciplineRaw * Math.min(1, 0.45 + 0.55 * sampleConfidence) : Math.max(0, disciplineRaw * 0.08 - pen * 10), 0, 100).toFixed(1)
      );

      const meritScore = Number(
        clampGbMetric(
          0.34 * pointsPower +
          0.22 * attackPower +
          0.18 * defensePower +
          0.16 * formConsistency +
          0.10 * fairPlayScore,
          0,
          100
        ).toFixed(1)
      );

      const vCount = voteCounts[p.id] || 0;
      const pct = totalVotes > 0 ? Number(((vCount / totalVotes) * 100).toFixed(1)) : 0;
      const voteNormScore = maxVotes > 0 ? Number(((vCount / maxVotes) * 100).toFixed(1)) : 0;
      const finalScore = Number(
        clampGbMetric(meritWeight * meritScore + voteShareWeight * voteNormScore, 0, 100).toFixed(1)
      );

      const aiReasons = [];
      if (mp === 0) {
        aiReasons.push('Brak zatwierdzonych meczów w tym sezonie');
      } else {
        if (pos === 1) aiReasons.push('Lider tabeli ' + (p.leagueId || ''));
        else if (pos <= 3) aiReasons.push('Podium ' + (p.leagueId || '') + ' (#' + pos + ')');
        if (ppg >= 2.2) aiReasons.push('Średnia ' + ppg.toFixed(2) + ' PKT/mecz');
        if (csPct >= 45 && cs >= 2) aiReasons.push('Szczelna obrona (' + cs + ' CK, ' + csPct.toFixed(0) + '%)');
        if (gzPerMatch >= 1.35 && bz >= 4) aiReasons.push('Wysoka skuteczność (' + gzPerMatch.toFixed(2) + ' G/mecz)');
        if (tier === 1) aiReasons.push('Premia trudności Ekstraklasy (x1.00)');
        if (yc === 0 && rc === 0 && pen === 0 && mp >= 3) aiReasons.push('Czyste konto dyscyplinarne Fair Play');
        if (!aiReasons.length) aiReasons.push(mp + ' meczów, ' + pkt + ' PKT, bilans ' + (diff >= 0 ? '+' : '') + diff);
      }

      const aiVerdict = mp === 0
        ? 'Oczekuje na pierwsze mecze sezonu (0.0/100)'
        : (meritScore >= 75
          ? 'Elitarny faworyt MVP: ' + aiReasons.slice(0, 2).join(' • ')
          : meritScore >= 52
            ? 'Mocny kandydat: ' + aiReasons.slice(0, 2).join(' • ')
            : 'Pretendent w trakcie budowy formy: ' + aiReasons[0]);

      return {
        playerId: p.id,
        name: p.name,
        nick: p.nick,
        leagueId: p.leagueId,
        avatar: p.avatar,
        votes: vCount,
        votePct: pct,
        voteNormScore: voteNormScore,
        meritScore: meritScore,
        finalScore: finalScore,
        aiBreakdown: {
          pointsPower: pointsPower,
          attackPower: attackPower,
          defensePower: defensePower,
          formConsistency: formConsistency,
          fairPlayScore: fairPlayScore,
          leagueWeight: leagueWeight,
          sampleConfidence: Number((sampleConfidence * 100).toFixed(0))
        },
        aiReasons: aiReasons,
        aiVerdict: aiVerdict,
        PKT: pkt,
        BZ: bz,
        BS: bs,
        diff: diff,
        M: mp,
        W: wins,
        R: draws,
        P: Number(sRow.P || 0),
        ppg: Number(ppg.toFixed(2)),
        cleanSheets: cs,
        cleanSheetPct: Number(csPct.toFixed(1)),
        leaguePos: sRow.position || '-',
        trophiesCount: (p.trophies || []).length
      };
    });

    // Wyliczenie rang czastkowych (Ranking Zasług SI vs Ranking Głosów Kibiców)
    const byMerit = candidates.slice().sort((a, b) => {
      if (b.meritScore !== a.meritScore) return b.meritScore - a.meritScore;
      if (b.PKT !== a.PKT) return b.PKT - a.PKT;
      if (b.BZ !== a.BZ) return b.BZ - a.BZ;
      return b.cleanSheets - a.cleanSheets;
    });
    byMerit.forEach((c, idx) => { c.meritRank = idx + 1; });

    const byVotes = candidates.slice().sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return b.meritScore - a.meritScore;
    });
    byVotes.forEach((c, idx) => { c.voteRank = idx + 1; });

    // Glowna kolejnosc: Ranking Laczny (Obliczenia SI + Ważone Głosy 1 gracz = 1 głos)
    candidates.sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.meritScore !== a.meritScore) return b.meritScore - a.meritScore;
      if (b.votes !== a.votes) return b.votes - a.votes;
      if (b.PKT !== a.PKT) return b.PKT - a.PKT;
      if (b.BZ !== a.BZ) return b.BZ - a.BZ;
      return b.cleanSheets - a.cleanSheets;
    });
    candidates.forEach((c, idx) => { c.overallRank = idx + 1; });

    return {
      totalVotes: totalVotes,
      rawVotesCount: rawVotes.length,
      filteredDuplicateVotes: filteredDuplicateVotes,
      filteredSelfVotes: filteredSelfVotes,
      meritWeightPct: Math.round(meritWeight * 100),
      voteWeightPct: Math.round(voteShareWeight * 100),
      aiTopMerit: byMerit[0] || null,
      fanLeader: totalVotes > 0 ? (byVotes[0] || null) : null,
      overallLeader: candidates[0] || null,
      candidates: candidates,
      recentVotes: validVotes.slice().reverse()
    };
  }

  /**
   * 8. GENERATOR RAPORTU LIGOWEGO NA MESSENGER / GRUPĘ FB (JAK W EXCELU — 4 KOLEJKI NA TYDZIEŃ)
   */
  function generateWeeklyMessengerReport(state, leagueId, weekNum) {
    const standings = calculateStandings(state, leagueId);
    const cleanSheets = calculateCleanSheetsRanking(state, leagueId);
    const lObj = state.leagues[leagueId] || { name: leagueId, shortName: leagueId };
    const rpw = (state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4;
    const w = weekNum || (state.weeklyConfig && state.weeklyConfig.currentWeek) || 2;
    const range = getRoundsRangeForWeek(w, rpw, lObj.totalRounds || 15);

    const p1 = standings[0];
    const p2 = standings[1];
    const p3 = standings[2];
    const topScorer = standings.slice().sort((a, b) => b.BZ - a.BZ)[0];
    const topKeeper = cleanSheets[0];
    const relPlayers = standings.slice(-3);

    const weekMatches = (state.matches || []).filter(
      (m) => m.leagueId === leagueId && m.round >= range.startRound && m.round <= range.endRound
    );
    const weekPlayed = weekMatches.filter((m) => m.status === 'APPROVED' || m.status === 'WALKOVER').length;
    const rawExts = (state && state.weeklyConfig && Array.isArray(state.weeklyConfig.extensions))
      ? state.weeklyConfig.extensions
      : [];
    const activeExt = rawExts.find((ex) => {
      if (!ex || ex.enabled === false) return false;
      const lScope = String(ex.leagueScope || 'ALL').toUpperCase();
      if (lScope !== 'ALL' && lScope !== String(leagueId || '').toUpperCase()) return false;
      const sType = String(ex.scopeType || 'WEEK').toUpperCase();
      if (sType === 'ALL_ACTIVE') return true;
      if (sType === 'WEEK') return Number(ex.weekNum) === Number(w);
      if (sType === 'ROUND') return Number(ex.roundNum) >= range.startRound && Number(ex.roundNum) <= range.endRound;
      return false;
    });

    const lines = [
      '🏆 RAPORT LIGOWY SCORE MATCH LIGA — ' + lObj.name.toUpperCase() + ' (SEZON ' + (state.season || 56) + ') 🏆',
      '📅 Tydzień Rozgrywkowy #' + w + ' (Kolejki ' + range.startRound + '–' + range.endRound + ' • koniec kolejki: zawsze Czwartek 23:59)',
      '📊 Postęp tygodnia: ' + weekPlayed + ' / ' + weekMatches.length + ' rozegranych spotkań'
    ];
    if (activeExt) {
      lines.push('⏳ UWAGA — PRZEDŁUŻONY TERMIN: do ' + (activeExt.extendedUntilDate || '') + ' godz. ' + (activeExt.extendedUntilTime || '23:59') + ' (' + (activeExt.reason || 'okoliczności wyjątkowe') + ')');
    }
    lines.push(
      '----------------------------------------',
      '🥇 1. ' + (p1 ? p1.name + ' — ' + p1.PKT + ' pkt (Bilans ' + p1.BZ + ':' + p1.BS + ')' : 'Brak'),
      '🥈 2. ' + (p2 ? p2.name + ' — ' + p2.PKT + ' pkt (Bilans ' + p2.BZ + ':' + p2.BS + ')' : 'Brak'),
      '🥉 3. ' + (p3 ? p3.name + ' — ' + p3.PKT + ' pkt (Bilans ' + p3.BZ + ':' + p3.BS + ')' : 'Brak'),
      '----------------------------------------',
      '⚽ Król Strzelców: ' + (topScorer ? topScorer.name + ' (' + topScorer.BZ + ' goli)' : 'Brak'),
      '🧤 Żelazna Kurtyna (Czyste Konta): ' + (topKeeper ? topKeeper.name + ' (' + topKeeper.cleanSheets + ' CK / ' + topKeeper.cleanSheetPct + '%)' : 'Brak'),
      '🚨 Strefa Spadkowa: ' + relPlayers.map((r) => r.position + '. ' + r.name + ' (' + r.PKT + ' pkt)').join(', '),
      '----------------------------------------',
      '🔔 Przypomnienie: Gospodarz (lewa strona w terminarzu) zaprasza Gościa! Wyniki wraz ze screenem wrzucamy bezpośrednio w portalu Score Match Liga.'
    );

    return lines.join('\n');
  }

  /**
   * 9. ZŁOTY BUT (KRÓL STRZELCÓW), FORMA / INVINCIBLES, TYPER, PUSKÁS, FAIR PLAY I LIGA KLANÓW
   */
  function getActiveLeagueIdsOrdered(state) {
    const ids = [];
    const seen = {};
    const addId = function (id) {
      if (id && !seen[id]) {
        seen[id] = true;
        ids.push(id);
      }
    };
    if (state && state.leagues) Object.keys(state.leagues).forEach(addId);
    ((state && state.players) || []).forEach(function (p) {
      if (p && p.leagueId && p.leagueId !== 'POOL') addId(p.leagueId);
    });
    if (ids.length === 0) ['L1', 'L2'].forEach(addId);
    return ids;
  }

  function buildAllStandingsMap(state) {
    const map = {};
    getActiveLeagueIdsOrdered(state).forEach(function (lid) {
      const list = calculateStandings(state, lid);
      list.forEach(function (r) {
        map[r.playerId] = r;
      });
    });
    return map;
  }

  function getLeagueGoldenShoeMultiplier(leagueId) {
    if (leagueId === 'L1') return 1.5;
    if (leagueId === 'L2') return 1.25;
    return 1.0;
  }

  function calculateGoldenBootRanking(state, leagueFilter) {
    const filter = leagueFilter || 'ALL';
    const players = ((state && state.players) || []).filter(function (p) {
      if (!p || p.active === false || p.isPlaceholder || p.gdprDeleted || p.leagueId === 'POOL') return false;
      if (filter !== 'ALL' && p.leagueId !== filter) return false;
      return true;
    });
    const standingsMap = buildAllStandingsMap(state);
    const playersMap = {};
    ((state && state.players) || []).forEach(function (p) {
      if (p && p.id) playersMap[p.id] = p;
    });

    const stats = {};
    players.forEach(function (p) {
      const row = standingsMap[p.id] || { M: 0, BZ: 0, BS: 0, PKT: 0, position: '-' };
      const mult = getLeagueGoldenShoeMultiplier(p.leagueId);
      stats[p.id] = {
        playerId: p.id,
        name: p.name,
        nick: p.nick,
        avatar: p.avatar,
        leagueId: p.leagueId,
        leaguePos: row.position || '-',
        PKT: Number(row.PKT || 0),
        M: Number(row.M || 0),
        goalsFor: Number(row.BZ || 0),
        goalsAgainst: Number(row.BS || 0),
        awayGoals: 0,
        braces: 0,
        hatTricks: 0,
        pokers: 0,
        bestMatchGoals: 0,
        bestMatchText: '',
        multiplier: mult,
        goldenShoePoints: Number((Number(row.BZ || 0) * mult).toFixed(2)),
        goalsPerMatch: Number(row.M || 0) > 0 ? Number((Number(row.BZ || 0) / Number(row.M || 0)).toFixed(2)) : 0
      };
    });

    const approved = ((state && state.matches) || []).filter(function (m) {
      if (!m || m.status !== 'APPROVED') return false;
      return m.homeScore !== null && m.awayScore !== null;
    });

    approved.forEach(function (m) {
      const hs = Number(m.homeScore);
      const as = Number(m.awayScore);
      if (isNaN(hs) || isNaN(as)) return;

      if (stats[m.homeId]) {
        const sh = stats[m.homeId];
        if (hs >= 2) sh.braces += 1;
        if (hs >= 3) sh.hatTricks += 1;
        if (hs >= 4) sh.pokers += 1;
        if (hs > sh.bestMatchGoals) {
          const oppA = playersMap[m.awayId];
          sh.bestMatchGoals = hs;
          sh.bestMatchText = hs + ':' + as + ' vs ' + (oppA ? oppA.name : 'Rywal') + ' (Kol. ' + (m.round || '?') + ')';
        }
      }
      if (stats[m.awayId]) {
        const sa = stats[m.awayId];
        sa.awayGoals += as;
        if (as >= 2) sa.braces += 1;
        if (as >= 3) sa.hatTricks += 1;
        if (as >= 4) sa.pokers += 1;
        if (as > sa.bestMatchGoals) {
          const oppH = playersMap[m.homeId];
          sa.bestMatchGoals = as;
          sa.bestMatchText = as + ':' + hs + ' vs ' + (oppH ? oppH.name : 'Rywal') + ' (Kol. ' + (m.round || '?') + ')';
        }
      }
    });

    const list = Object.keys(stats).map(function (k) { return stats[k]; });
    list.sort(function (a, b) {
      if (filter === 'ALL' && b.goldenShoePoints !== a.goldenShoePoints) {
        return b.goldenShoePoints - a.goldenShoePoints;
      }
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      if (b.hatTricks !== a.hatTricks) return b.hatTricks - a.hatTricks;
      if (b.braces !== a.braces) return b.braces - a.braces;
      if (b.goalsPerMatch !== a.goalsPerMatch) return b.goalsPerMatch - a.goalsPerMatch;
      if (b.PKT !== a.PKT) return b.PKT - a.PKT;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pl');
    });
    list.forEach(function (item, idx) {
      item.rank = idx + 1;
    });
    return list;
  }

  function calculateSeasonFormAndRecords(state) {
    const players = ((state && state.players) || []).filter(function (p) {
      return p && p.active !== false && !p.isPlaceholder && !p.gdprDeleted && p.leagueId !== 'POOL';
    });
    const playersMap = {};
    players.forEach(function (p) {
      playersMap[p.id] = p;
    });
    const standingsMap = buildAllStandingsMap(state);
    const approvedMatches = ((state && state.matches) || [])
      .filter(function (m) { return m && m.status === 'APPROVED' && m.homeScore !== null && m.awayScore !== null; })
      .sort(function (a, b) {
        if (Number(a.round || 0) !== Number(b.round || 0)) return Number(a.round || 0) - Number(b.round || 0);
        return String(a.id || '').localeCompare(String(b.id || ''));
      });

    const tracker = {};
    players.forEach(function (p) {
      const sr = standingsMap[p.id] || { PKT: 0, M: 0, BZ: 0, BS: 0, position: '-' };
      tracker[p.id] = {
        playerId: p.id,
        name: p.name,
        nick: p.nick,
        avatar: p.avatar,
        leagueId: p.leagueId,
        leaguePos: sr.position || '-',
        PKT: Number(sr.PKT || 0),
        M: Number(sr.M || 0),
        results: [],
        longestWin: 0,
        currentWin: 0,
        longestUnbeaten: 0,
        currentUnbeaten: 0,
        homeM: 0, homeW: 0, homeR: 0, homeP: 0, homeBZ: 0, homeBS: 0, homePKT: 0,
        awayM: 0, awayW: 0, awayR: 0, awayP: 0, awayBZ: 0, awayBS: 0, awayPKT: 0
      };
    });

    let biggestWin = null;
    let highestScoring = null;

    approvedMatches.forEach(function (m) {
      const hs = Number(m.homeScore);
      const as = Number(m.awayScore);
      if (isNaN(hs) || isNaN(as)) return;
      const th = tracker[m.homeId];
      const ta = tracker[m.awayId];
      const margin = Math.abs(hs - as);
      const totalG = hs + as;
      const pHome = playersMap[m.homeId];
      const pAway = playersMap[m.awayId];

      if (margin > 0 && pHome && pAway && (!biggestWin || margin > biggestWin.margin || (margin === biggestWin.margin && totalG > biggestWin.totalGoals))) {
        const winIsHome = hs > as;
        biggestWin = {
          matchId: m.id,
          leagueId: m.leagueId,
          round: m.round,
          margin: margin,
          totalGoals: totalG,
          winnerName: winIsHome ? pHome.name : pAway.name,
          loserName: winIsHome ? pAway.name : pHome.name,
          scoreText: (winIsHome ? hs + ':' + as : as + ':' + hs)
        };
      }
      if (totalG > 0 && pHome && pAway && (!highestScoring || totalG > highestScoring.totalGoals)) {
        highestScoring = {
          matchId: m.id,
          leagueId: m.leagueId,
          round: m.round,
          totalGoals: totalG,
          homeName: pHome.name,
          awayName: pAway.name,
          scoreText: hs + ':' + as
        };
      }

      if (th) {
        th.homeM += 1;
        th.homeBZ += hs;
        th.homeBS += as;
        if (hs > as) {
          th.homeW += 1; th.homePKT += 3; th.results.push({ r: 'Z', gf: hs, ga: as });
        } else if (hs === as) {
          th.homeR += 1; th.homePKT += 1; th.results.push({ r: 'R', gf: hs, ga: as });
        } else {
          th.homeP += 1; th.results.push({ r: 'P', gf: hs, ga: as });
        }
      }
      if (ta) {
        ta.awayM += 1;
        ta.awayBZ += as;
        ta.awayBS += hs;
        if (as > hs) {
          ta.awayW += 1; ta.awayPKT += 3; ta.results.push({ r: 'Z', gf: as, ga: hs });
        } else if (as === hs) {
          ta.awayR += 1; ta.awayPKT += 1; ta.results.push({ r: 'R', gf: as, ga: hs });
        } else {
          ta.awayP += 1; ta.results.push({ r: 'P', gf: as, ga: hs });
        }
      }
    });

    const enriched = Object.keys(tracker).map(function (pid) {
      const t = tracker[pid];
      let curWin = 0;
      let maxWin = 0;
      let curUnb = 0;
      let maxUnb = 0;
      t.results.forEach(function (entry) {
        if (entry.r === 'Z') {
          curWin += 1;
          curUnb += 1;
        } else if (entry.r === 'R') {
          curWin = 0;
          curUnb += 1;
        } else {
          curWin = 0;
          curUnb = 0;
        }
        if (curWin > maxWin) maxWin = curWin;
        if (curUnb > maxUnb) maxUnb = curUnb;
      });
      t.currentWin = curWin;
      t.longestWin = maxWin;
      t.currentUnbeaten = curUnb;
      t.longestUnbeaten = maxUnb;

      const last5 = t.results.slice(-5);
      let l5Pkt = 0;
      let l5Gf = 0;
      let l5Ga = 0;
      last5.forEach(function (x) {
        if (x.r === 'Z') l5Pkt += 3;
        else if (x.r === 'R') l5Pkt += 1;
        l5Gf += x.gf;
        l5Ga += x.ga;
      });
      t.last5Games = last5.length;
      t.last5Points = l5Pkt;
      t.last5Diff = l5Gf - l5Ga;
      t.last5Score = l5Gf + ':' + l5Ga;
      t.last5Badges = last5.map(function (x) { return x.r; });
      return t;
    });

    const invincibles = enriched.slice().sort(function (a, b) {
      if (b.longestUnbeaten !== a.longestUnbeaten) return b.longestUnbeaten - a.longestUnbeaten;
      if (b.currentUnbeaten !== a.currentUnbeaten) return b.currentUnbeaten - a.currentUnbeaten;
      if (b.longestWin !== a.longestWin) return b.longestWin - a.longestWin;
      return b.PKT - a.PKT;
    });

    const last5Form = enriched.slice().sort(function (a, b) {
      if (b.last5Points !== a.last5Points) return b.last5Points - a.last5Points;
      if (b.last5Diff !== a.last5Diff) return b.last5Diff - a.last5Diff;
      if (b.currentWin !== a.currentWin) return b.currentWin - a.currentWin;
      return b.PKT - a.PKT;
    });

    const homeKings = enriched.slice().sort(function (a, b) {
      if (b.homePKT !== a.homePKT) return b.homePKT - a.homePKT;
      const diffB = b.homeBZ - b.homeBS;
      const diffA = a.homeBZ - a.homeBS;
      if (diffB !== diffA) return diffB - diffA;
      return b.homeBZ - a.homeBZ;
    });

    const awayKings = enriched.slice().sort(function (a, b) {
      if (b.awayPKT !== a.awayPKT) return b.awayPKT - a.awayPKT;
      const diffB = b.awayBZ - b.awayBS;
      const diffA = a.awayBZ - a.awayBS;
      if (diffB !== diffA) return diffB - diffA;
      return b.awayBZ - a.awayBZ;
    });

    return {
      invincibles: invincibles,
      last5Form: last5Form,
      homeKings: homeKings,
      awayKings: awayKings,
      records: {
        biggestWin: biggestWin,
        highestScoring: highestScoring,
        totalApprovedMatches: approvedMatches.length
      }
    };
  }

  function scoreSingleTyperPrediction(pred, match) {
    if (!pred || !match || match.status !== 'APPROVED' || match.homeScore === null || match.awayScore === null) {
      return { settled: false, points: 0, tier: 'PENDING', label: '⏳ Oczekuje na wynik' };
    }
    const rh = Number(match.homeScore);
    const ra = Number(match.awayScore);
    const ph = Number(pred.predHome);
    const pa = Number(pred.predAway);
    if (isNaN(rh) || isNaN(ra) || isNaN(ph) || isNaN(pa)) {
      return { settled: false, points: 0, tier: 'PENDING', label: '⏳ Oczekuje na wynik' };
    }
    if (ph === rh && pa === ra) {
      return { settled: true, points: 5, tier: 'EXACT', label: '🎯 Dokładny Wynik (+5 pkt)' };
    }
    if ((ph - pa) === (rh - ra)) {
      return { settled: true, points: 3, tier: 'DIFF', label: '✅ Trafiona Różnica / Remis (+3 pkt)' };
    }
    const pSign = ph > pa ? 1 : ph < pa ? -1 : 0;
    const rSign = rh > ra ? 1 : rh < ra ? -1 : 0;
    if (pSign === rSign) {
      return { settled: true, points: 1, tier: 'OUTCOME', label: '👍 Trafiony Zwycięzca 1X2 (+1 pkt)' };
    }
    return { settled: true, points: 0, tier: 'MISS', label: '❌ Brak punktów (0 pkt)' };
  }

  function calculateTyperLeaderboard(state) {
    const comp = (state && state.competitions) || {};
    const predictions = Array.isArray(comp.typerPredictions) ? comp.typerPredictions : [];
    const players = (state && state.players) || [];
    const playersMap = {};
    players.forEach(function (p) {
      if (p && p.id) playersMap[p.id] = p;
    });
    const matchesMap = {};
    ((state && state.matches) || []).forEach(function (m) {
      if (m && m.id) matchesMap[m.id] = m;
    });

    const boardMap = {};
    const settledFeed = [];
    predictions.forEach(function (pr) {
      if (!pr || !pr.matchId) return;
      const vKey = pr.voterId || ('NAME_' + String(pr.voterName || 'Anonim').toLowerCase());
      const linkedPlayer = pr.voterPlayerId && playersMap[pr.voterPlayerId] ? playersMap[pr.voterPlayerId] : null;
      if (!boardMap[vKey]) {
        boardMap[vKey] = {
          voterId: vKey,
          voterPlayerId: (linkedPlayer && linkedPlayer.id) || pr.voterPlayerId || null,
          voterName: (linkedPlayer && linkedPlayer.name) || pr.voterName || 'Typer SMPL',
          voterNick: (linkedPlayer && linkedPlayer.nick) || pr.voterNick || '',
          avatar: (linkedPlayer && linkedPlayer.avatar) || '',
          leagueId: (linkedPlayer && linkedPlayer.leagueId) || '',
          totalPoints: 0,
          totalPreds: 0,
          settledPreds: 0,
          pendingPreds: 0,
          exactHits: 0,
          diffHits: 0,
          outcomeHits: 0,
          accuracyPct: 0
        };
      }
      const b = boardMap[vKey];
      b.totalPreds += 1;
      const match = matchesMap[pr.matchId];
      const sc = scoreSingleTyperPrediction(pr, match);
      if (sc.settled) {
        b.settledPreds += 1;
        b.totalPoints += sc.points;
        if (sc.tier === 'EXACT') b.exactHits += 1;
        else if (sc.tier === 'DIFF') b.diffHits += 1;
        else if (sc.tier === 'OUTCOME') b.outcomeHits += 1;
        const hPl = playersMap[match.homeId] || { name: 'Gospodarz' };
        const aPl = playersMap[match.awayId] || { name: 'Gość' };
        settledFeed.push({
          id: pr.id,
          voterName: b.voterName,
          matchLabel: hPl.name + ' vs ' + aPl.name,
          leagueId: match.leagueId,
          round: match.round,
          predScore: pr.predHome + ':' + pr.predAway,
          realScore: match.homeScore + ':' + match.awayScore,
          points: sc.points,
          tier: sc.tier,
          label: sc.label
        });
      } else {
        b.pendingPreds += 1;
      }
    });

    const leaderboard = Object.keys(boardMap).map(function (k) {
      const b = boardMap[k];
      const hits = b.exactHits + b.diffHits + b.outcomeHits;
      b.accuracyPct = b.settledPreds > 0 ? Number(((hits / b.settledPreds) * 100).toFixed(1)) : 0;
      return b;
    });
    leaderboard.sort(function (a, b) {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
      if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
      return b.totalPreds - a.totalPreds;
    });
    leaderboard.forEach(function (row, idx) {
      row.rank = idx + 1;
    });

    const predByMatch = {};
    predictions.forEach(function (pr) {
      if (!pr || !pr.matchId) return;
      if (!predByMatch[pr.matchId]) predByMatch[pr.matchId] = [];
      predByMatch[pr.matchId].push(pr);
    });

    const rpw = (state && state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4;
    const upcomingMatches = ((state && state.matches) || [])
      .filter(function (m) {
        return m && m.status === 'SCHEDULED' && playersMap[m.homeId] && playersMap[m.awayId];
      })
      .sort(function (a, b) {
        if (Number(a.round || 0) !== Number(b.round || 0)) return Number(a.round || 0) - Number(b.round || 0);
        return String(a.leagueId || '').localeCompare(String(b.leagueId || ''), 'pl');
      })
      .map(function (m) {
        const list = predByMatch[m.id] || [];
        return {
          match: m,
          homePlayer: playersMap[m.homeId],
          awayPlayer: playersMap[m.awayId],
          week: getWeekForRound(m.round || 1, rpw),
          predictionCount: list.length,
          predictions: list
        };
      });

    return {
      leaderboard: leaderboard,
      upcomingMatches: upcomingMatches,
      recentSettled: settledFeed.slice().reverse().slice(0, 20),
      totalPredictions: predictions.length
    };
  }

  function calculatePuskasStandings(state) {
    const comp = (state && state.competitions) || {};
    const noms = Array.isArray(comp.puskasNominations) ? comp.puskasNominations : [];
    const playersMap = {};
    ((state && state.players) || []).forEach(function (p) {
      if (p && p.id) playersMap[p.id] = p;
    });
    const matchesMap = {};
    ((state && state.matches) || []).forEach(function (m) {
      if (m && m.id) matchesMap[m.id] = m;
    });

    const list = noms.map(function (n) {
      const pl = playersMap[n.playerId] || null;
      const m = n.matchId ? matchesMap[n.matchId] : null;
      const hPl = m ? playersMap[m.homeId] : null;
      const aPl = m ? playersMap[m.awayId] : null;
      const matchSummary = m && hPl && aPl
        ? (hPl.name + ' ' + m.homeScore + ':' + m.awayScore + ' ' + aPl.name + ' (Kol. ' + (m.round || '?') + ')')
        : '';
      const votesArr = Array.isArray(n.votes) ? n.votes : [];
      return {
        id: n.id,
        playerId: n.playerId,
        playerName: (pl && pl.name) || n.playerName || 'Zawodnik SMPL',
        nick: (pl && pl.nick) || n.nick || '',
        avatar: (pl && pl.avatar) || '',
        leagueId: (pl && pl.leagueId) || n.leagueId || 'L1',
        matchId: n.matchId || '',
        matchSummary: matchSummary,
        title: n.title || 'Bramka Kolejki SMPL',
        description: n.description || '',
        clipUrl: n.clipUrl || '',
        nominatedById: n.nominatedById || '',
        nominatedByName: n.nominatedByName || 'Społeczność SMPL',
        votes: votesArr,
        votesCount: votesArr.length,
        createdAt: n.createdAt || ''
      };
    });

    list.sort(function (a, b) {
      if (b.votesCount !== a.votesCount) return b.votesCount - a.votesCount;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    list.forEach(function (item, idx) {
      item.rank = idx + 1;
    });
    return {
      nominations: list,
      totalVotes: list.reduce(function (acc, item) { return acc + item.votesCount; }, 0)
    };
  }

  function calculateFairPlayRanking(state) {
    const players = ((state && state.players) || []).filter(function (p) {
      return p && p.active !== false && !p.isPlaceholder && !p.gdprDeleted && p.leagueId !== 'POOL';
    });
    const standingsMap = buildAllStandingsMap(state);
    const woCommitted = {};
    const cleanPlayed = {};

    ((state && state.matches) || []).forEach(function (m) {
      if (!m) return;
      if (m.status === 'APPROVED') {
        cleanPlayed[m.homeId] = (cleanPlayed[m.homeId] || 0) + 1;
        cleanPlayed[m.awayId] = (cleanPlayed[m.awayId] || 0) + 1;
      } else if (m.status === 'WALKOVER') {
        const hs = Number(m.homeScore || 0);
        const as = Number(m.awayScore || 0);
        if (hs === 0 && as === 0) {
          woCommitted[m.homeId] = (woCommitted[m.homeId] || 0) + 1;
          woCommitted[m.awayId] = (woCommitted[m.awayId] || 0) + 1;
        } else if (hs < as) {
          woCommitted[m.homeId] = (woCommitted[m.homeId] || 0) + 1;
        } else if (as < hs) {
          woCommitted[m.awayId] = (woCommitted[m.awayId] || 0) + 1;
        }
      }
    });

    const list = players.map(function (p) {
      const sr = standingsMap[p.id] || { M: 0, PKT: 0, position: '-' };
      const yc = Number(p.yellowCards || 0);
      const rc = Number(p.redCards || 0);
      const pen = Math.abs(Number(p.penaltyPoints || 0));
      const wo = woCommitted[p.id] || 0;
      const cleanM = cleanPlayed[p.id] || 0;
      const fpScore = Math.max(0, 100 + cleanM * 2 - yc * 4 - rc * 12 - pen * 2 - wo * 8);
      let label = '🕊️ Wzorowy Dżentelmen';
      if (rc > 0 || pen >= 3 || wo >= 2) label = '🟥 Pod Obserwacją Trybunału';
      else if (yc > 0 || wo > 0) label = '⚠️ Drobne Upomnienia';
      else if (cleanM >= 3) label = '🕊️ Ambasador Fair Play';

      return {
        playerId: p.id,
        name: p.name,
        nick: p.nick,
        avatar: p.avatar,
        leagueId: p.leagueId,
        leaguePos: sr.position || '-',
        matchesPlayed: Number(sr.M || 0),
        cleanMatches: cleanM,
        yellowCards: yc,
        redCards: rc,
        penaltyPoints: pen,
        walkoversCommitted: wo,
        fairPlayScore: fpScore,
        ratingLabel: label
      };
    });

    list.sort(function (a, b) {
      if (b.fairPlayScore !== a.fairPlayScore) return b.fairPlayScore - a.fairPlayScore;
      if (b.cleanMatches !== a.cleanMatches) return b.cleanMatches - a.cleanMatches;
      if (a.redCards !== b.redCards) return a.redCards - b.redCards;
      if (a.yellowCards !== b.yellowCards) return a.yellowCards - b.yellowCards;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pl');
    });
    list.forEach(function (row, idx) {
      row.rank = idx + 1;
    });
    return list;
  }

  function calculateClanChampionsRanking(state) {
    const clans = ((state && state.clans) || []).filter(function (c) {
      return c && c.id && c.status !== 'REMOVED';
    });
    const players = ((state && state.players) || []).filter(function (p) {
      return p && p.active !== false && !p.isPlaceholder && !p.gdprDeleted && p.leagueId !== 'POOL';
    });
    const standingsMap = buildAllStandingsMap(state);
    const byClan = {};

    clans.forEach(function (c) {
      byClan[c.id] = {
        clanId: c.id,
        name: c.name,
        tag: c.tag || '',
        primaryColor: c.primaryColor || '#10B981',
        logo: c.logo || null,
        members: [],
        membersCount: 0,
        totalPKT: 0,
        totalMatches: 0,
        totalWins: 0,
        totalGoals: 0,
        totalCleanSheets: 0,
        totalTrophies: 0,
        avgPKTPerMember: 0,
        leaderPlayer: null
      };
    });

    players.forEach(function (p) {
      if (!p.clanId) return;
      if (!byClan[p.clanId]) {
        byClan[p.clanId] = {
          clanId: p.clanId,
          name: p.clanName || p.clanId,
          tag: p.clanTag || '',
          primaryColor: p.clanColor || '#3B82F6',
          logo: p.clanLogo || null,
          members: [],
          membersCount: 0,
          totalPKT: 0,
          totalMatches: 0,
          totalWins: 0,
          totalGoals: 0,
          totalCleanSheets: 0,
          totalTrophies: 0,
          avgPKTPerMember: 0,
          leaderPlayer: null
        };
      }
      const cEntry = byClan[p.clanId];
      const sr = standingsMap[p.id] || { M: 0, W: 0, BZ: 0, PKT: 0, cleanSheets: 0 };
      const memberItem = {
        playerId: p.id,
        name: p.name,
        nick: p.nick,
        leagueId: p.leagueId,
        PKT: Number(sr.PKT || 0),
        BZ: Number(sr.BZ || 0),
        cleanSheets: Number(sr.cleanSheets || 0)
      };
      cEntry.members.push(memberItem);
      cEntry.membersCount += 1;
      cEntry.totalPKT += Number(sr.PKT || 0);
      cEntry.totalMatches += Number(sr.M || 0);
      cEntry.totalWins += Number(sr.W || 0);
      cEntry.totalGoals += Number(sr.BZ || 0);
      cEntry.totalCleanSheets += Number(sr.cleanSheets || 0);
      cEntry.totalTrophies += (p.trophies || []).length;
    });

    const activeClans = Object.keys(byClan)
      .map(function (k) {
        const c = byClan[k];
        if (c.membersCount > 0) {
          c.avgPKTPerMember = Number((c.totalPKT / c.membersCount).toFixed(1));
          c.members.sort(function (a, b) { return b.PKT - a.PKT || b.BZ - a.BZ; });
          c.leaderPlayer = c.members[0];
        }
        return c;
      })
      .filter(function (c) { return c.membersCount > 0; });

    activeClans.sort(function (a, b) {
      if (b.totalPKT !== a.totalPKT) return b.totalPKT - a.totalPKT;
      if (b.avgPKTPerMember !== a.avgPKTPerMember) return b.avgPKTPerMember - a.avgPKTPerMember;
      if (b.totalGoals !== a.totalGoals) return b.totalGoals - a.totalGoals;
      return b.membersCount - a.membersCount;
    });
    activeClans.forEach(function (c, idx) {
      c.rank = idx + 1;
    });
    return activeClans;
  }

  function getCompetitionsOverviewSummary(state) {
    const gBoot = calculateGoldenBootRanking(state, 'ALL');
    const gBall = calculateGoldenBallStandings(state);
    const l1Clean = calculateCleanSheetsRanking(state, 'L1');
    const typer = calculateTyperLeaderboard(state);
    const puskas = calculatePuskasStandings(state);
    const formRec = calculateSeasonFormAndRecords(state);
    const fairPlay = calculateFairPlayRanking(state);
    const clans = calculateClanChampionsRanking(state);
    const cup = state && state.competitions && state.competitions.cup ? state.competitions.cup : null;
    const cupWinner = cup && cup.winnerPlayerId
      ? ((state.players || []).find(function (p) { return p && p.id === cup.winnerPlayerId; }) || null)
      : null;
    const blitz = state && state.competitions && state.competitions.blitzCup ? state.competitions.blitzCup : null;
    const blitzWinner = blitz && blitz.winnerPlayerId
      ? ((state.players || []).find(function (p) { return p && p.id === blitz.winnerPlayerId; }) || null)
      : null;
    const totwLatest = state && state.competitions && Array.isArray(state.competitions.totwHistory) && state.competitions.totwHistory[0]
      ? state.competitions.totwHistory[0]
      : null;

    return {
      goldenBootLeader: gBoot[0] || null,
      goldenBallLeader: gBall.candidates[0] || null,
      cleanSheetsL1Leader: l1Clean[0] || null,
      typerLeader: typer.leaderboard[0] || null,
      puskasLeader: puskas.nominations[0] || null,
      invincibleLeader: formRec.invincibles[0] || null,
      fairPlayLeader: fairPlay[0] || null,
      clanLeader: clans[0] || null,
      cupStatus: cup ? cup.status : 'NOT_STARTED',
      cupWinner: cupWinner,
      blitzStatus: blitz ? blitz.status : 'NOT_STARTED',
      blitzWinner: blitzWinner,
      totwLatest: totwLatest
    };
  }

  return {
    isPlaceholderPlayer: isPlaceholderPlayer,
    calculateStandings: calculateStandings,
    calculateCleanSheetsRanking: calculateCleanSheetsRanking,
    calculateH2H: calculateH2H,
    generateRoundRobinSchedule: generateRoundRobinSchedule,
    getWeekForRound: getWeekForRound,
    getRoundsRangeForWeek: getRoundsRangeForWeek,
    calculatePlayerUTCard: calculatePlayerUTCard,
    calculateGoldenBallStandings: calculateGoldenBallStandings,
    generateWeeklyMessengerReport: generateWeeklyMessengerReport,
    calculateGoldenBootRanking: calculateGoldenBootRanking,
    calculateSeasonFormAndRecords: calculateSeasonFormAndRecords,
    scoreSingleTyperPrediction: scoreSingleTyperPrediction,
    calculateTyperLeaderboard: calculateTyperLeaderboard,
    calculatePuskasStandings: calculatePuskasStandings,
    calculateFairPlayRanking: calculateFairPlayRanking,
    calculateClanChampionsRanking: calculateClanChampionsRanking,
    getCompetitionsOverviewSummary: getCompetitionsOverviewSummary
  };
})();
