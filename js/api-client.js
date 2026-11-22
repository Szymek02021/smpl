/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Warstwa Komunikacji Full-Stack REST API + Autoryzacja Linków Specjalnych i Zarządzanie Administracją
 */

window.SMPL_DB = (function () {
  const STORAGE_KEY = 'SMPL_SEZON_56_FULLSTACK_DB_V2';
  const SESSION_KEY = 'SMPL_SEZON_56_AUTH_SESSION_V2';
  const TARGET_VERSION = '56.2.0';
  let state = null;
  let backendOnline = false;
  const seenRemoteMessageIds = {};
  const seenRemoteNotifIds = {};
  const seenPendingAdminNotifIds = {};
  let serverAdminTokenCache = null;
  let serverAdminTokenPromise = null;
  let serverPlayerTokenCache = null;
  let serverPlayerTokenPromise = null;
  let lastServerRejectToastAt = 0;
  let localMutationEpoch = 0;
  let activeServerWritesCount = 0;
  let lastServerWriteStartedAt = 0;

  function seedSeenMessageIds(targetState) {
    if (!targetState) return;
    (targetState.chatMessages || []).forEach((m) => {
      if (m && m.id) seenRemoteMessageIds[m.id] = true;
    });
    (targetState.directMessages || []).forEach((d) => {
      if (d && d.id) seenRemoteMessageIds[d.id] = true;
    });
    const sess = typeof getSession === 'function' ? getSession() : null;
    const isAdmin = typeof isStrictAdminSession === 'function' ? isStrictAdminSession(sess) : false;
    const viewerPid = sess && !sess.isGuest ? (sess.activePlayerId || null) : null;
    if (viewerPid && Array.isArray(targetState.players)) {
      const vp = targetState.players.find((p) => p && p.id === viewerPid);
      if (vp && Array.isArray(vp.notifications)) {
        vp.notifications.forEach((n) => {
          if (n && n.id) seenRemoteNotifIds[n.id] = true;
        });
      }
    }
    if (isAdmin && Array.isArray(targetState.matches)) {
      targetState.matches.forEach((m) => {
        if (m && m.id && m.status === 'PENDING') seenPendingAdminNotifIds[m.id] = true;
      });
    }
  }

  function pushPlayerNotification(playerOrId, { idPrefix = 'NOTIF', type = 'INFO', icon = '🔔', title = '', text = '', meta = null }) {
    if (!state || !Array.isArray(state.players)) return null;
    const pid = typeof playerOrId === 'string' ? playerOrId : (playerOrId && playerOrId.id);
    const pl = typeof playerOrId === 'object' && playerOrId
      ? playerOrId
      : state.players.find((p) => p && p.id === pid);
    if (!pl || isByeSlotPlayer(pl) || pl.gdprDeleted) return null;
    if (!Array.isArray(pl.notifications)) pl.notifications = [];
    const stamp = typeof nowFormatted === 'function' ? nowFormatted() : new Date().toISOString().slice(0, 16).replace('T', ' ');
    const entry = {
      id: `${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: String(type || 'INFO'),
      icon: String(icon || '🔔'),
      title: String(title || '').trim(),
      text: String(text || '').trim(),
      time: stamp,
      createdAt: stamp,
      timestamp: Date.now(),
      read: false
    };
    if (meta) entry.meta = meta;
    pl.notifications.unshift(entry);
    if (pl.notifications.length > 50) pl.notifications = pl.notifications.slice(0, 50);
    return entry;
  }

  const NOTIF_LOCAL_PREFS_PREFIX = 'SMPL_NOTIF_LOCAL_PREFS_V1_';

  function getNotifKey(n) {
    if (n && n.id) return 'id:' + String(n.id);
    return 'fb:' + String((n && n.time) || '') + '|' + String((n && n.text) || '');
  }

  function getNotifServerId(n) {
    if (n && n.id) return String(n.id);
    return String((n && n.time) || '') + '|' + String((n && n.text) || '');
  }

  function loadLocalNotifPrefs(playerId) {
    const empty = { read: {}, cleared: {} };
    if (!playerId || typeof localStorage === 'undefined') return empty;
    try {
      const raw = localStorage.getItem(NOTIF_LOCAL_PREFS_PREFIX + String(playerId));
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      return {
        read: (parsed && parsed.read && typeof parsed.read === 'object') ? parsed.read : {},
        cleared: (parsed && parsed.cleared && typeof parsed.cleared === 'object') ? parsed.cleared : {}
      };
    } catch (e) {
      return empty;
    }
  }

  function trimNotifPrefMap(obj, limit) {
    const keys = Object.keys(obj || {});
    if (keys.length <= limit) return obj;
    const trimmed = {};
    keys.slice(keys.length - limit).forEach((k) => { trimmed[k] = obj[k]; });
    return trimmed;
  }

  function saveLocalNotifPrefs(playerId, prefs) {
    if (!playerId || typeof localStorage === 'undefined' || !prefs) return;
    try {
      const safe = {
        read: trimNotifPrefMap(prefs.read, 250),
        cleared: trimNotifPrefMap(prefs.cleared, 250)
      };
      localStorage.setItem(NOTIF_LOCAL_PREFS_PREFIX + String(playerId), JSON.stringify(safe));
    } catch (e) {}
  }

  function recordLocalNotifState(playerId, items, mode) {
    if (!playerId || !Array.isArray(items) || items.length === 0) return;
    const prefs = loadLocalNotifPrefs(playerId);
    const nowTs = Date.now();
    items.forEach((n) => {
      if (!n) return;
      const k = getNotifKey(n);
      prefs.read[k] = nowTs;
      if (mode === 'clear') prefs.cleared[k] = nowTs;
    });
    saveLocalNotifPrefs(playerId, prefs);
  }

  function applyLocalNotifPrefsToPlayer(pl) {
    if (!pl || !pl.id || !Array.isArray(pl.notifications) || pl.notifications.length === 0) return;
    const prefs = loadLocalNotifPrefs(pl.id);
    const hasCleared = Object.keys(prefs.cleared).length > 0;
    const hasRead = Object.keys(prefs.read).length > 0;
    if (!hasCleared && !hasRead) return;
    const nextList = [];
    pl.notifications.forEach((n) => {
      if (!n) return;
      const k = getNotifKey(n);
      const fbKey = 'fb:' + String(n.time || '') + '|' + String(n.text || '');
      if (hasCleared && (prefs.cleared[k] || (!n.id && prefs.cleared[fbKey]))) {
        return;
      }
      if (hasRead && (prefs.read[k] || (!n.id && prefs.read[fbKey]))) {
        n.read = true;
      }
      if (n.id) seenRemoteNotifIds[n.id] = true;
      nextList.push(n);
    });
    pl.notifications = nextList;
  }

  function applyLocalNotifPrefsToState(targetState) {
    if (!targetState || !Array.isArray(targetState.players)) return targetState;
    targetState.players.forEach(applyLocalNotifPrefsToPlayer);
    return targetState;
  }

  function resolveNotifActor(playerId) {
    const sess = getSession();
    let pid = playerId || (sess && sess.activePlayerId) || null;
    const isAdminCtx = Boolean(sess && sess.linkMode !== 'PUBLIC' && sess.isAuthenticated);
    if (!pid && isAdminCtx && sess.adminId) {
      const admPl = findPlayerForAdmin(sess.adminId, state);
      if (admPl && admPl.id) pid = admPl.id;
    }
    const useAdminToken = Boolean(isAdminCtx && typeof resolveAdminRequestToken === 'function' && resolveAdminRequestToken());
    const hasPlayerAuth = Boolean(sess && sess.isPlayerAuthenticated && !sess.isGuest);
    return { sess, pid, useAdminToken, hasPlayerAuth };
  }

  function markAllNotificationsRead(playerId) {
    if (!state || !Array.isArray(state.players)) return 0;
    const actor = resolveNotifActor(playerId);
    if (!actor.pid) return 0;
    const pl = state.players.find((p) => p && p.id === actor.pid);
    if (!pl || !Array.isArray(pl.notifications)) return 0;
    let changedCount = 0;
    const touched = [];
    const readIds = [];
    let allHaveIds = true;
    pl.notifications.forEach((n) => {
      if (!n) return;
      touched.push(n);
      if (n.id) {
        readIds.push(String(n.id));
        seenRemoteNotifIds[n.id] = true;
      } else {
        allHaveIds = false;
      }
      if (n.read !== true) {
        n.read = true;
        changedCount++;
      }
    });
    if (changedCount > 0 || touched.length > 0) {
      recordLocalNotifState(actor.pid, touched, 'read');
    }
    if (changedCount > 0) {
      localMutationEpoch += 1;
      lastServerEtag = '';
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      if (actor.useAdminToken || actor.hasPlayerAuth) {
        sendCompetitionActionToServer(
          { op: 'notif_mark_read', playerId: actor.pid, readIds: allHaveIds ? readIds : [] },
          actor.useAdminToken,
          { silentAuthError: true }
        );
      }
    }
    return changedCount;
  }

  function clearPlayerNotifications(playerId, onlyRead) {
    if (!state || !Array.isArray(state.players)) return 0;
    const actor = resolveNotifActor(playerId);
    if (!actor.pid) return 0;
    const pl = state.players.find((p) => p && p.id === actor.pid);
    if (!pl || !Array.isArray(pl.notifications)) return 0;
    const removedItems = [];
    const keptItems = [];
    pl.notifications.forEach((n) => {
      if (!n) return;
      if (onlyRead && n.read !== true) {
        keptItems.push(n);
      } else {
        removedItems.push(n);
      }
    });
    const removed = removedItems.length;
    if (removed > 0) {
      pl.notifications = keptItems;
      recordLocalNotifState(actor.pid, removedItems, 'clear');
      localMutationEpoch += 1;
      lastServerEtag = '';
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      if (actor.useAdminToken || actor.hasPlayerAuth) {
        const clearedIds = removedItems.map(getNotifServerId).filter(Boolean);
        sendCompetitionActionToServer(
          { op: 'notif_clear', playerId: actor.pid, onlyRead: Boolean(onlyRead), clearedIds: clearedIds },
          actor.useAdminToken,
          { silentAuthError: true }
        );
      }
    }
    return removed;
  }

  function processIncomingChatNotifications(newState, prevChatIdsMap, prevDmIdsMap) {
    if (!newState || !window.SMPL_NOTIF) return;
    const sess = getSession();
    const isAdmin = isStrictAdminSession(sess);
    const viewerId = isAdmin ? (sess.adminId || 'ADM_MASTER') : (sess ? sess.activePlayerId : null);
    const viewerPlayer = !isAdmin && viewerId
      ? (newState.players || []).find((p) => p.id === viewerId)
      : null;

    const chanNames = {
      OFFTOPIC: 'Czat Ogólny / Offtopic',
      ANNOUNCEMENTS: 'Komunikaty Zarządu',
      ADMIN_STAFF: 'Pokój Administracji (Ukryty)'
    };
    getLeaguesList(newState, true).forEach((lg) => {
      chanNames[lg.id] = 'Czat ' + (lg.shortName || lg.name || lg.id);
    });

    const incomingChat = (newState.chatMessages || []).filter((m) => {
      if (!m || !m.id) return false;
      if (seenRemoteMessageIds[m.id] || prevChatIdsMap[m.id]) return false;
      seenRemoteMessageIds[m.id] = true;
      if (viewerId && m.senderId === viewerId) return false;
      if (m.channel === 'ADMIN_STAFF' && !isAdmin) return false;
      if (m.isFlagged && !isAdmin) return false;
      if (!isAdmin && viewerPlayer && isLeagueChannelId(m.channel, newState)) {
        if (m.channel !== viewerPlayer.leagueId) return false;
      }
      if (!isAdmin && (!sess || sess.isGuest) && isLeagueChannelId(m.channel, newState)) {
        return false;
      }
      return true;
    });

    incomingChat.slice(-3).forEach((m) => {
      const chName = chanNames[m.channel] || m.channel || 'Czat';
      const isMentioned = Boolean(viewerId && Array.isArray(m.mentions) && m.mentions.includes(viewerId));
      if (isMentioned && typeof window.SMPL_NOTIF.notifyMention === 'function') {
        window.SMPL_NOTIF.notifyMention(m.senderName || 'Zawodnik', chName, m.text || '');
      } else if (typeof window.SMPL_NOTIF.notifyChatMessage === 'function') {
        window.SMPL_NOTIF.notifyChatMessage(m.senderName || 'Zawodnik', chName, m.text || '');
      }
    });

    if (sess && !sess.isGuest && viewerId) {
      const incomingDms = (newState.directMessages || []).filter((dm) => {
        if (!dm || !dm.id) return false;
        if (seenRemoteMessageIds[dm.id] || prevDmIdsMap[dm.id]) return false;
        seenRemoteMessageIds[dm.id] = true;
        return dm.recipientId === viewerId && !dm.read && dm.senderId !== viewerId;
      });
      incomingDms.slice(-2).forEach((dm) => {
        if (typeof window.SMPL_NOTIF.notifyDirectMessage === 'function') {
          window.SMPL_NOTIF.notifyDirectMessage(dm.senderName || 'Gracz SMPL', dm.text || '');
        }
      });
    }
  }

  function processIncomingPlayerNotifications(newState, prevNotifIdsMap, prevPendingMatchIdsMap) {
    if (!newState || !window.SMPL_NOTIF) return;
    const sess = getSession();
    const isAdmin = isStrictAdminSession(sess);
    const viewerPid = sess && !sess.isGuest ? (sess.activePlayerId || null) : null;
    if (viewerPid && Array.isArray(newState.players)) {
      const vp = newState.players.find((p) => p && p.id === viewerPid);
      if (vp && Array.isArray(vp.notifications)) {
        const freshNotifs = vp.notifications
          .filter((n) => n && n.id && n.read !== true && !prevNotifIdsMap[n.id] && !seenRemoteNotifIds[n.id])
          .slice(0, 3)
          .reverse();
        freshNotifs.forEach((n) => {
          seenRemoteNotifIds[n.id] = true;
          if (typeof window.SMPL_NOTIF.notifyPlayerEvent === 'function') {
            window.SMPL_NOTIF.notifyPlayerEvent(n);
          } else if (typeof window.SMPL_NOTIF.sendLocalNotification === 'function') {
            window.SMPL_NOTIF.sendLocalNotification((n.icon || '🔔') + ' ' + (n.title || 'Nowe powiadomienie SMPL'), {
              body: n.text || '',
              tag: 'smpl-ev-' + n.id
            });
          }
        });
      }
    }
    if (isAdmin && Array.isArray(newState.matches)) {
      const playersMap = {};
      (newState.players || []).forEach((p) => { if (p && p.id) playersMap[p.id] = p; });
      const freshPending = newState.matches.filter(
        (m) => m && m.id && m.status === 'PENDING' && !prevPendingMatchIdsMap[m.id] && !seenPendingAdminNotifIds[m.id]
      );
      freshPending.slice(-2).forEach((m) => {
        seenPendingAdminNotifIds[m.id] = true;
        const hp = playersMap[m.homeId];
        const ap = playersMap[m.awayId];
        if (typeof window.SMPL_NOTIF.sendLocalNotification === 'function') {
          window.SMPL_NOTIF.sendLocalNotification(`⏳ Nowy wynik do akceptacji (${m.leagueId})`, {
            body: `${hp ? hp.name : 'Gospodarz'} ${m.homeScore}:${m.awayScore} ${ap ? ap.name : 'Gość'} (Kol. ${m.round})`,
            tag: 'adm-pending-' + m.id,
            toastType: 'info'
          });
        }
      });
    }
  }

  function nowFormatted() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function addLog(type, text) {
    if (!state.activityLog) state.activityLog = [];
    state.activityLog.unshift({
      id: 'LOG_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      time: nowFormatted(),
      type,
      text
    });
    if (state.activityLog.length > 80) {
      state.activityLog = state.activityLog.slice(0, 80);
    }
  }

  let activeApiEndpoint = './api.php';
  let lastServerEtag = '';
  let lastServerArchiveSnapshot = null;
  const SERVER_ARCHIVE_TOP_KEYS = [
    'historicalSeasons',
    'allTimeRanking',
    'generalRanking',
    'fiveSeasonRanking',
    'careerRanking',
    'archiveRecalcVersion'
  ];
  const SERVER_ARCHIVE_PLAYER_KEYS = ['trophies', 'historicalStats', 'historicalArchiveName', 'playedBefore'];

  function captureServerArchiveSnapshot(rawRemote) {
    if (!rawRemote || typeof rawRemote !== 'object') return;
    const fields = {};
    let hasAny = false;
    SERVER_ARCHIVE_TOP_KEYS.forEach((k) => {
      if (Object.prototype.hasOwnProperty.call(rawRemote, k)) {
        try {
          fields[k] = JSON.parse(JSON.stringify(rawRemote[k]));
          hasAny = true;
        } catch (_eSnap) {}
      }
    });
    const playersById = {};
    if (Array.isArray(rawRemote.players)) {
      rawRemote.players.forEach((p) => {
        if (!p || !p.id) return;
        const pSnap = {};
        SERVER_ARCHIVE_PLAYER_KEYS.forEach((pk) => {
          if (Object.prototype.hasOwnProperty.call(p, pk)) {
            try {
              pSnap[pk] = JSON.parse(JSON.stringify(p[pk]));
            } catch (_ePSnap) {}
          }
        });
        playersById[String(p.id)] = pSnap;
      });
    }
    if (hasAny) {
      lastServerArchiveSnapshot = { fields: fields, playersById: playersById };
    }
  }

  function applyServerArchiveSnapshotForPublicWrite(wireObj) {
    if (!wireObj || !lastServerArchiveSnapshot) return wireObj;
    const snap = lastServerArchiveSnapshot;
    if (snap.fields) {
      Object.keys(snap.fields).forEach((k) => {
        wireObj[k] = snap.fields[k];
      });
    }
    if (snap.playersById && Array.isArray(wireObj.players)) {
      wireObj.players = wireObj.players.map((p) => {
        if (!p || !p.id) return p;
        const pSnap = snap.playersById[String(p.id)];
        if (!pSnap) return p;
        const copyP = Object.assign({}, p);
        SERVER_ARCHIVE_PLAYER_KEYS.forEach((pk) => {
          if (Object.prototype.hasOwnProperty.call(pSnap, pk)) {
            copyP[pk] = pSnap[pk];
          } else {
            delete copyP[pk];
          }
        });
        return copyP;
      });
    }
    return wireObj;
  }

  function isHttpProtocol() {
    return !!(
      window.location &&
      window.location.protocol &&
      window.location.protocol.startsWith('http') &&
      typeof fetch === 'function'
    );
  }

  function isValidDatabasePayload(parsed) {
    return !!(
      parsed &&
      parsed.version === TARGET_VERSION &&
      Array.isArray(parsed.players) &&
      Array.isArray(parsed.matches) &&
      parsed.allTimeRanking &&
      parsed.historicalSeasons
    );
  }

  function emitServerRejected(res) {
    if (!res) return Promise.resolve();
    return res.json()
      .catch(() => null)
      .then((errData) => {
        const msg = (errData && errData.error) ? String(errData.error) : '';
        if (errData && (errData.code === 'ADMIN_AUTH_REQUIRED' || errData.code === 'ADMIN_TOKEN_EXPIRED')) {
          serverAdminTokenCache = null;
          try {
            const rawSess = localStorage.getItem(SESSION_KEY);
            if (rawSess) {
              const pSess = JSON.parse(rawSess);
              if (pSess) {
                pSess.serverAdminToken = null;
                localStorage.setItem(SESSION_KEY, JSON.stringify(pSess));
              }
            }
          } catch (e) {}
        }
        if (Date.now() - lastServerRejectToastAt > 2500) {
          lastServerRejectToastAt = Date.now();
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            try {
              window.dispatchEvent(new CustomEvent('smpl:server-rejected', { detail: { status: res.status, message: msg } }));
            } catch (e) {}
          }
        }
        pullFromServer(null, true);
      });
  }

  function slimMessageAvatar(av) {
    if (typeof av !== 'string') return '';
    if (av.length > 512 && av.indexOf('data:image/') === 0) return '';
    return av;
  }

  function persistStateToLocalStorage(st) {
    if (!st) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
      return;
    } catch (e) {
      // Fallback przy QuotaExceededError (np. Safari/iOS 2.5-5MB): odchudź TYLKO kopię cache w localStorage (bez modyfikacji stanu w RAM/na serwerze)
      try {
        const slimCopy = Object.assign({}, st);
        if (Array.isArray(st.directMessages)) {
          slimCopy.directMessages = st.directMessages.map((dm) =>
            dm && typeof dm === 'object'
              ? Object.assign({}, dm, { senderAvatar: slimMessageAvatar(dm.senderAvatar), recipientAvatar: slimMessageAvatar(dm.recipientAvatar) })
              : dm
          );
        }
        if (Array.isArray(st.chatMessages)) {
          slimCopy.chatMessages = st.chatMessages.map((cm) =>
            cm && typeof cm === 'object'
              ? Object.assign({}, cm, { senderAvatar: slimMessageAvatar(cm.senderAvatar) })
              : cm
          );
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(slimCopy));
          return;
        } catch (e2) {
          if (Array.isArray(st.matches)) {
            slimCopy.matches = st.matches.map((m) =>
              m && typeof m === 'object' && m.status === 'APPROVED'
                ? Object.assign({}, m, { screenshot: null, screenshots: [] })
                : m
            );
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(slimCopy));
        }
      } catch (e3) {
        console.warn('LocalStorage quota warning:', e3);
      }
    }
  }

  function syncToBackend(extraWireFlags) {
    if (!state) return;
    state.updatedAt = Date.now();
    localMutationEpoch += 1;
    lastServerEtag = '';
    persistStateToLocalStorage(state);

    if (isHttpProtocol()) {
      const sessForToken = getSession();
      const admToken = isStrictAdminSession(sessForToken)
        ? (serverAdminTokenCache || sessForToken.serverAdminToken || '')
        : '';
      const headers = { 'Content-Type': 'application/json' };
      if (admToken) {
        headers['X-SMPL-Admin-Token'] = admToken;
      }
      const hasExtra = extraWireFlags && typeof extraWireFlags === 'object' && Object.keys(extraWireFlags).length > 0;
      let payloadStr = '';
      if (admToken || hasExtra || lastServerArchiveSnapshot) {
        try {
          const wireObj = Object.assign({}, state, hasExtra ? extraWireFlags : {}, admToken ? { _adminToken: admToken } : {});
          if (!admToken && lastServerArchiveSnapshot) {
            applyServerArchiveSnapshotForPublicWrite(wireObj);
          }
          payloadStr = JSON.stringify(wireObj);
        } catch (e) {
          payloadStr = JSON.stringify(state);
        }
      } else {
        payloadStr = JSON.stringify(state);
      }
      activeServerWritesCount += 1;
      lastServerWriteStartedAt = Date.now();
      const doneWrite = () => {
        activeServerWritesCount = Math.max(0, activeServerWritesCount - 1);
      };
      fetch(activeApiEndpoint, {
        method: 'POST',
        headers: headers,
        body: payloadStr
      })
        .then((res) => {
          if (res && res.ok) {
            backendOnline = true;
            if (admToken) captureServerArchiveSnapshot(state);
            doneWrite();
            return;
          }
          if (res && (res.status === 401 || res.status === 403)) {
            doneWrite();
            return emitServerRejected(res);
          }
          // Fallback jeśli serwer obsługuje /api/state zamiast api.php
          return fetch('./api/state', {
            method: 'POST',
            headers: headers,
            body: payloadStr
          }).then((res2) => {
            doneWrite();
            if (res2 && res2.ok) {
              activeApiEndpoint = './api/state';
              backendOnline = true;
              return;
            }
            if (res2 && (res2.status === 401 || res2.status === 403)) {
              return emitServerRejected(res2);
            }
          });
        })
        .catch(() => {
          doneWrite();
          backendOnline = false;
        });
    }
  }

  function pullFromServer(onUpdatedCallback, forceApply) {
    if (!isHttpProtocol()) return Promise.resolve(false);

    const pullEpoch = localMutationEpoch;
    const etagQuery = !forceApply && lastServerEtag ? ('&etag=' + encodeURIComponent(lastServerEtag)) : '';
    const cacheBuster = '?t=' + Date.now() + etagQuery;
    return fetch(activeApiEndpoint + cacheBuster, { method: 'GET', cache: 'no-store' })
      .then((res) => {
        if (!res || !res.ok) {
          return fetch('./api/state' + cacheBuster, { method: 'GET', cache: 'no-store' }).then((r2) => {
            if (r2 && r2.ok) activeApiEndpoint = './api/state';
            return r2;
          });
        }
        return res;
      })
      .then((res) => {
        if (!res || !res.ok) return null;
        try {
          const hEtag = res.headers && typeof res.headers.get === 'function' ? res.headers.get('ETag') : '';
          if (hEtag) lastServerEtag = String(hEtag).replace(/"/g, '').trim();
        } catch (_eH) {}
        return res.json();
      })
      .then((remoteData) => {
        if (!remoteData) return;
        if (remoteData.unchanged === true) {
          backendOnline = true;
          if (remoteData.etag) lastServerEtag = String(remoteData.etag);
          return;
        }

        // Jeśli serwer działa (PHP lub Node.js), ale plik bazy jest jeszcze pusty lub ze starszej wersji:
        // automatycznie wysyłamy początkową bazę Sezonu 56 na serwer!
        if (remoteData.empty === true || remoteData.version !== TARGET_VERSION) {
          backendOnline = true;
          syncToBackend();
          if (typeof onUpdatedCallback === 'function') onUpdatedCallback(true);
          return;
        }

        if (!forceApply && localMutationEpoch !== pullEpoch) {
          return;
        }

        if (isValidDatabasePayload(remoteData)) {
          const prevUpdated = state ? state.updatedAt : 0;
          const prevPlayersCount = state && Array.isArray(state.players) ? state.players.length : -1;
          const prevMatchesCount = state && Array.isArray(state.matches) ? state.matches.length : -1;
          const prevRegsCount = state && Array.isArray(state.registrations) ? state.registrations.length : -1;
          const prevChatCount = state && Array.isArray(state.chatMessages) ? state.chatMessages.length : -1;
          const prevDmCount = state && Array.isArray(state.directMessages) ? state.directMessages.length : -1;
          const prevAiQueueCount = state && Array.isArray(state.aiUnansweredQueue) ? state.aiUnansweredQueue.length : -1;
          const prevAiKnowledgeCount = state && Array.isArray(state.aiKnowledge) ? state.aiKnowledge.length : -1;
          const prevJoinOpen = state && state.portalSettings ? Boolean(state.portalSettings.seasonJoinOpen) : null;
          const prevMaintOn = Boolean(state && state.portalSettings && state.portalSettings.maintenanceMode && state.portalSettings.maintenanceMode.enabled);
          const prevChatIdsMap = {};
          const prevDmIdsMap = {};
          const prevNotifIdsMap = {};
          const prevPendingMatchIdsMap = {};
          if (state && Array.isArray(state.chatMessages)) {
            state.chatMessages.forEach((m) => { if (m && m.id) prevChatIdsMap[m.id] = true; });
          }
          if (state && Array.isArray(state.directMessages)) {
            state.directMessages.forEach((d) => { if (d && d.id) prevDmIdsMap[d.id] = true; });
          }
          const sessBeforePull = getSession();
          const viewerIdBefore = sessBeforePull && !sessBeforePull.isGuest ? (sessBeforePull.activePlayerId || null) : null;
          if (state && viewerIdBefore && Array.isArray(state.players)) {
            const vpBefore = state.players.find((p) => p && p.id === viewerIdBefore);
            if (vpBefore && Array.isArray(vpBefore.notifications)) {
              vpBefore.notifications.forEach((n) => { if (n && n.id) prevNotifIdsMap[n.id] = true; });
            }
          }
          if (state && Array.isArray(state.matches)) {
            state.matches.forEach((m) => { if (m && m.id && m.status === 'PENDING') prevPendingMatchIdsMap[m.id] = true; });
          }

          backendOnline = true;
          captureServerArchiveSnapshot(remoteData);
          state = enrichFromArchive(remoteData);
          processIncomingPlayerNotifications(state, prevNotifIdsMap, prevPendingMatchIdsMap);
          seedSeenMessageIds(state);
          persistStateToLocalStorage(state);
          if (typeof onUpdatedCallback === 'function') onUpdatedCallback(true);
          const nowJoinOpen = state && state.portalSettings ? Boolean(state.portalSettings.seasonJoinOpen) : null;
          const nowMaintOn = Boolean(state && state.portalSettings && state.portalSettings.maintenanceMode && state.portalSettings.maintenanceMode.enabled);
          const changed =
            prevUpdated !== state.updatedAt ||
            prevJoinOpen !== nowJoinOpen ||
            prevMaintOn !== nowMaintOn ||
            prevPlayersCount !== (state.players || []).length ||
            prevMatchesCount !== (state.matches || []).length ||
            prevRegsCount !== (state.registrations || []).length ||
            prevChatCount !== (state.chatMessages || []).length ||
            prevDmCount !== (state.directMessages || []).length ||
            prevAiQueueCount !== (state.aiUnansweredQueue || []).length ||
            prevAiKnowledgeCount !== (state.aiKnowledge || []).length;
          if (changed && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            try {
              window.dispatchEvent(new CustomEvent('smpl:db-synced', { detail: { updatedAt: state.updatedAt || Date.now() } }));
            } catch (e) {}
          }
        }
      })
      .catch(() => {
        backendOnline = false;
      });
  }

  function getLeagueNumber(leagueId) {
    const m = /^L(\d+)$/i.exec(String(leagueId || '').trim());
    return m ? Number(m[1]) : 99;
  }

  function getDefaultLeaguePreset(leagueId) {
    const lid = String(leagueId || '').toUpperCase().trim() || 'L3';
    const num = getLeagueNumber(lid);
    const presets = {
      L1: {
        id: 'L1',
        enabled: true,
        order: 1,
        name: 'Ekstraklasa Score Match Liga',
        shortName: 'EKSTRAKLASA',
        subtitle: 'Najwyższa Klasa Rozgrywkowa • Królewskie Złoto & Bordo • 4 kolejki/tydz.',
        primaryColor: '#D4AF37',
        secondaryColor: '#6B0F1A',
        adminName: 'Szymon Komenda & Zarząd Główny SMPL',
        totalRounds: 15
      },
      L2: {
        id: 'L2',
        enabled: true,
        order: 2,
        name: '2. Liga Score Match Liga (L2)',
        shortName: '2. LIGA (L2)',
        subtitle: 'Oficjalny Drugi Poziom Rozgrywkowy • Metaliczne Srebro & Granat • 4 kolejki/tydz.',
        primaryColor: '#C0C0C0',
        secondaryColor: '#1E3A8A',
        adminName: 'Szymon Komenda (Główny Admin L2)',
        totalRounds: 15
      },
      L3: {
        id: 'L3',
        enabled: false,
        order: 3,
        name: '3. Liga Score Match Liga (L3)',
        shortName: '3. LIGA (L3)',
        subtitle: 'Trzeci Poziom Rozgrywkowy i Awans • Miedziany Brąz & Ciemne Żelazo • 4 kolejki/tydz.',
        primaryColor: '#CD7F32',
        secondaryColor: '#27272A',
        adminName: 'Komisja Ligi L3 & Szymon Komenda',
        totalRounds: 15
      },
      L4: {
        id: 'L4',
        enabled: true,
        order: 4,
        name: '4. Liga Score Match Liga (L4)',
        shortName: '4. LIGA (L4)',
        subtitle: 'Czwarty Poziom Rozgrywkowy • Szmaragdowy Start & Ciemny Las • 4 kolejki/tydz.',
        primaryColor: '#10B981',
        secondaryColor: '#064E3B',
        adminName: 'Szymon Komenda & Komisja Ligi',
        totalRounds: 15
      },
      L5: {
        id: 'L5',
        enabled: true,
        order: 5,
        name: '5. Liga Score Match Liga (L5)',
        shortName: '5. LIGA (L5)',
        subtitle: 'Piąty Poziom Rozgrywkowy • Neonowy Fiolet & Ametyst • 4 kolejki/tydz.',
        primaryColor: '#8B5CF6',
        secondaryColor: '#3B0764',
        adminName: 'Szymon Komenda & Komisja Ligi',
        totalRounds: 15
      }
    };
    if (presets[lid]) return JSON.parse(JSON.stringify(presets[lid]));
    return {
      id: lid,
      enabled: true,
      order: num,
      name: num + '. Liga Score Match Liga (' + lid + ')',
      shortName: num + '. LIGA (' + lid + ')',
      subtitle: 'Dywizja ' + lid + ' Rozgrywek SMPL • Nowa Dywizja • 4 kolejki/tydz.',
      primaryColor: num % 2 === 0 ? '#38BDF8' : '#F43F5E',
      secondaryColor: num % 2 === 0 ? '#0C4A6E' : '#4C0519',
      adminName: 'Szymon Komenda & Zarząd SMPL',
      totalRounds: 15
    };
  }

  function ensureSingleLeagueExists(targetState, leagueId, forceEnable) {
    if (!targetState) return null;
    if (!targetState.leagues || typeof targetState.leagues !== 'object' || Array.isArray(targetState.leagues)) {
      targetState.leagues = {};
    }
    const lid = String(leagueId || '').toUpperCase().trim();
    if (!lid) return null;
    if (!targetState.leagues[lid]) {
      targetState.leagues[lid] = getDefaultLeaguePreset(lid);
    }
    if (typeof targetState.leagues[lid].order === 'undefined') {
      targetState.leagues[lid].order = getLeagueNumber(lid);
    }
    if (typeof targetState.leagues[lid].enabled === 'undefined') {
      targetState.leagues[lid].enabled = lid !== 'L3';
    }
    if (forceEnable === true) {
      targetState.leagues[lid].enabled = true;
    }
    if (!targetState.customCrests || typeof targetState.customCrests !== 'object' || Array.isArray(targetState.customCrests)) targetState.customCrests = {};
    if (typeof targetState.customCrests[lid] === 'undefined') {
      targetState.customCrests[lid] = null;
    }
    return targetState.leagues[lid];
  }

  function ensureLeaguesStructure(targetState) {
    if (!targetState) return targetState;
    if (!targetState.leagues || typeof targetState.leagues !== 'object' || Array.isArray(targetState.leagues)) {
      targetState.leagues = {};
    }
    ensureSingleLeagueExists(targetState, 'L1');
    ensureSingleLeagueExists(targetState, 'L2');
    ensureSingleLeagueExists(targetState, 'L3');
    Object.keys(targetState.leagues).forEach((lid) => {
      const lg = targetState.leagues[lid];
      if (!lg) return;
      if (!lg.id) lg.id = lid;
      if (typeof lg.order === 'undefined') lg.order = getLeagueNumber(lid);
      if (typeof lg.enabled === 'undefined') lg.enabled = lid !== 'L3';
    });
    // Jeśli w istniejącej bazie są aktywni gracze w L3 lub wyższej lidze, nie ukrywaj jej przypadkiem bez flagi
    (targetState.players || []).forEach((p) => {
      if (p && p.leagueId && !targetState.leagues[p.leagueId]) {
        ensureSingleLeagueExists(targetState, p.leagueId, true);
      }
    });
    if (!targetState.customCrests) targetState.customCrests = { L1: null, L2: null, L3: null };
    Object.keys(targetState.leagues).forEach((lid) => {
      if (typeof targetState.customCrests[lid] === 'undefined') {
        targetState.customCrests[lid] = null;
      }
    });
    return targetState;
  }

  function isLeagueEnabled(leagueId, targetState) {
    const st = targetState || state || {};
    const lid = String(leagueId || '').toUpperCase().trim();
    if (!lid) return false;
    const lg = st.leagues && st.leagues[lid];
    if (!lg) return lid === 'L1' || lid === 'L2';
    if (typeof lg.enabled === 'undefined') return lid !== 'L3';
    return lg.enabled !== false;
  }

  function getLeaguesList(targetState, includeDisabled) {
    const st = targetState || state || {};
    const leaguesMap = (st && st.leagues) || {};
    const keys = Object.keys(leaguesMap);
    if (keys.indexOf('L1') === -1) keys.push('L1');
    if (keys.indexOf('L2') === -1) keys.push('L2');
    const seen = {};
    const list = [];
    keys.forEach((rawKey) => {
      const lid = String(rawKey || '').toUpperCase().trim();
      if (!lid || seen[lid]) return;
      seen[lid] = true;
      const lg = leaguesMap[lid] || getDefaultLeaguePreset(lid);
      const enabled = typeof lg.enabled === 'undefined' ? lid !== 'L3' : lg.enabled !== false;
      if (!includeDisabled && !enabled) return;
      list.push({
        id: lg.id || lid,
        enabled: enabled,
        order: typeof lg.order === 'number' ? lg.order : getLeagueNumber(lid),
        name: lg.name || (lid + ' Liga SMPL'),
        shortName: lg.shortName || lid,
        subtitle: lg.subtitle || ('Rozgrywki ' + (lg.name || lid) + ' • 4 kolejki/tydz.'),
        primaryColor: lg.primaryColor || '#3B82F6',
        secondaryColor: lg.secondaryColor || '#1E3A8A',
        adminName: lg.adminName || 'Szymon Komenda & Zarząd SMPL',
        totalRounds: Number(lg.totalRounds || 15)
      });
    });
    list.sort((a, b) => a.order - b.order);
    return list;
  }

  function getActiveLeagueIds(targetState) {
    return getLeaguesList(targetState, false).map((lg) => lg.id);
  }

  function getNextLeagueSuggestion(targetState) {
    const st = targetState || state || {};
    const allLeagues = getLeaguesList(st, true);
    const l3 = allLeagues.find((l) => l.id === 'L3');
    if (!l3 || !l3.enabled) {
      const preset = getDefaultLeaguePreset('L3');
      preset.isReactivation = true;
      return preset;
    }
    const disabledExtra = allLeagues.find((l) => !l.enabled);
    if (disabledExtra) {
      const clone = JSON.parse(JSON.stringify(disabledExtra));
      clone.isReactivation = true;
      return clone;
    }
    const maxNum = allLeagues.reduce((acc, l) => Math.max(acc, getLeagueNumber(l.id)), 3);
    const nextId = 'L' + (maxNum + 1);
    const preset = getDefaultLeaguePreset(nextId);
    preset.isReactivation = false;
    return preset;
  }

  function isLeagueChannelId(channel, targetState) {
    const ch = String(channel || '').trim();
    if (!ch) return false;
    if (/^L\d{1,2}$/i.test(ch)) return true;
    const st = targetState || state || {};
    return Boolean(st.leagues && st.leagues[ch]);
  }

  const DEFAULT_CLAN_PRESETS = [
    { id: 'CLAN_ORLY_PL', name: 'Orły Polska', tag: 'ORLY', primaryColor: '#DC2626', secondaryColor: '#7F1D1D', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' },
    { id: 'CLAN_HUSSARS', name: 'Husaria Polska', tag: 'HUS', primaryColor: '#D4AF37', secondaryColor: '#6B0F1A', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' },
    { id: 'CLAN_WILKI', name: 'Wataha Wilków', tag: 'WILK', primaryColor: '#10B981', secondaryColor: '#064E3B', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' },
    { id: 'CLAN_TYTANI', name: 'Tytani Arena', tag: 'TYTN', primaryColor: '#3B82F6', secondaryColor: '#1E3A8A', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' },
    { id: 'CLAN_LEGENDY', name: 'Polskie Legendy', tag: 'PLG', primaryColor: '#F59E0B', secondaryColor: '#451A03', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' },
    { id: 'CLAN_SMOKI', name: 'Czerwone Smoki', tag: 'SMOK', primaryColor: '#EF4444', secondaryColor: '#450A0A', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' },
    { id: 'CLAN_INFINITY', name: 'Infinity Stars PL', tag: 'INF', primaryColor: '#A855F7', secondaryColor: '#3B0764', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' },
    { id: 'CLAN_REKINY', name: 'Białe Rekiny', tag: 'SHRK', primaryColor: '#06B6D4', secondaryColor: '#083344', logo: null, status: 'ACTIVE', createdBy: 'SYSTEM' }
  ];

  function deriveClanTag(name, rawTag) {
    const t = String(rawTag || '').trim().toUpperCase().replace(/[^A-Z0-9ĄĆĘŁŃÓŚŹŻ]/g, '');
    if (t.length >= 2) return t.slice(0, 6);
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return words.map(function (w) { return w.charAt(0); }).join('').toUpperCase().slice(0, 6);
    }
    return String(name || 'KLAN').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'SMPL';
  }

  function resolveClanLogo(clanObj) {
    if (!clanObj) return '';
    const customLogo = clanObj.logo || clanObj.clanLogo || '';
    if (customLogo && String(customLogo).indexOf('data:image/') === 0) return String(customLogo);
    const name = clanObj.name || clanObj.clanName || '';
    if (!name) return '';
    const tag = clanObj.tag || clanObj.clanTag || deriveClanTag(name, '');
    if (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.createClanEmblemSVG === 'function') {
      return window.SMPL_MEDIA.createClanEmblemSVG(name, tag, clanObj.primaryColor || '#10B981', clanObj.secondaryColor || '#064E3B');
    }
    return '';
  }

  function ensureClansStructure(targetState) {
    if (!targetState) return [];
    if (!Array.isArray(targetState.clans)) {
      targetState.clans = DEFAULT_CLAN_PRESETS.map(function (c) {
        return {
          id: c.id,
          name: c.name,
          tag: c.tag,
          primaryColor: c.primaryColor,
          secondaryColor: c.secondaryColor,
          logo: c.logo || null,
          status: c.status || 'ACTIVE',
          createdBy: c.createdBy || 'SYSTEM',
          createdAt: c.createdAt || '2026-11-12 00:00'
        };
      });
    } else if (targetState.clans.length === 0) {
      DEFAULT_CLAN_PRESETS.forEach(function (c) {
        targetState.clans.push({
          id: c.id,
          name: c.name,
          tag: c.tag,
          primaryColor: c.primaryColor,
          secondaryColor: c.secondaryColor,
          logo: c.logo || null,
          status: c.status || 'ACTIVE',
          createdBy: c.createdBy || 'SYSTEM',
          createdAt: '2026-11-12 00:00'
        });
      });
    }
    return targetState.clans;
  }

  function getClansList(targetState) {
    const st = targetState || state || {};
    const list = Array.isArray(st.clans) ? st.clans.slice() : DEFAULT_CLAN_PRESETS.slice();
    return list
      .filter(function (c) { return c && c.id && c.name && c.status !== 'REMOVED'; })
      .sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'pl');
      });
  }

  function getClanById(clanId, targetState) {
    if (!clanId) return null;
    const st = targetState || state || {};
    const list = Array.isArray(st.clans) ? st.clans : [];
    const cid = String(clanId).trim();
    return list.find(function (c) { return c && c.id === cid; }) || null;
  }

  function registerOrFindClan({ name, tag, primaryColor, logo, createdBy }) {
    ensureClansStructure(state);
    const cleanName = String(name || '').trim().slice(0, 60);
    if (cleanName.length < 2) {
      throw new Error('Podaj nazwę nowego klanu (minimum 2 znaki).');
    }
    const foldedTarget = foldPlChars(cleanName);
    const existing = state.clans.find(function (c) {
      return c && foldPlChars(c.name) === foldedTarget;
    });
    const safeTag = deriveClanTag(cleanName, tag);
    const safeColor = /^#[0-9A-Fa-f]{6}$/.test(String(primaryColor || '')) ? String(primaryColor) : '#10B981';
    const uploadedLogo = logo && String(logo).indexOf('data:image/') === 0 && String(logo).length <= 170000
      ? String(logo)
      : null;

    if (existing) {
      return existing;
    }

    const fallbackSvgLogo = resolveClanLogo({
      name: cleanName,
      tag: safeTag,
      primaryColor: safeColor,
      secondaryColor: '#0F172A'
    });
    const safeLogo = uploadedLogo || (fallbackSvgLogo && String(fallbackSvgLogo).length <= 170000 ? fallbackSvgLogo : null);

    const newClan = {
      id: 'CLAN_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      name: cleanName,
      tag: safeTag,
      primaryColor: safeColor,
      secondaryColor: '#0F172A',
      logo: safeLogo,
      status: 'ACTIVE',
      createdBy: String(createdBy || 'Gracz SMPL').trim().slice(0, 60),
      createdAt: nowFormatted()
    };
    state.clans.push(newClan);
    return newClan;
  }

  function resolvePlayerClanPayload({ clanId, newClanName, newClanTag, newClanColor, newClanLogo, createdBy }) {
    ensureClansStructure(state);
    if (clanId === '__NEW__' || (!clanId && newClanName && String(newClanName).trim())) {
      const createdClan = registerOrFindClan({
        name: newClanName,
        tag: newClanTag,
        primaryColor: newClanColor,
        logo: newClanLogo,
        createdBy: createdBy
      });
      return {
        clanId: createdClan.id,
        clanName: createdClan.name,
        clanTag: createdClan.tag,
        clanLogo: createdClan.logo || null,
        isNewClan: true
      };
    }
    if (clanId && clanId !== 'NONE') {
      const found = getClanById(clanId, state);
      if (found) {
        return {
          clanId: found.id,
          clanName: found.name,
          clanTag: found.tag || deriveClanTag(found.name, ''),
          clanLogo: found.logo || resolveClanLogo(found) || null,
          isNewClan: false
        };
      }
    }
    return {
      clanId: null,
      clanName: '',
      clanTag: '',
      clanLogo: null,
      isNewClan: false
    };
  }

  function findPlayerS55Record(customState, playerOrReg) {
    if (!playerOrReg) return null;
    const st = customState || state || {};
    const seasonsList = (Array.isArray(st.historicalSeasons) && st.historicalSeasons.length > 0)
      ? st.historicalSeasons
      : ((window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.HISTORICAL_SEASONS) || []);
    const s55 = seasonsList.find(function (s) { return s && Number(s.seasonNumber) === 55; });
    if (!s55 || !s55.leagues) return null;

    const candidates = [];
    const pushCand = function (raw) {
      if (!raw || typeof raw !== 'string') return;
      const fk = canonicalArchiveFold(raw);
      if (fk && candidates.indexOf(fk) === -1) candidates.push(fk);
    };
    if (typeof playerOrReg === 'string') {
      pushCand(playerOrReg);
    } else {
      pushCand(playerOrReg.historicalArchiveName);
      pushCand(playerOrReg.name);
      pushCand(playerOrReg.nick);
    }
    if (candidates.length === 0) return null;

    const leagueIds = ['L1', 'L2', 'L3'];
    for (let li = 0; li < leagueIds.length; li++) {
      const lid = leagueIds[li];
      const rows = s55.leagues[lid];
      if (!Array.isArray(rows)) continue;
      for (let ri = 0; ri < rows.length; ri++) {
        const r = rows[ri];
        if (!r || !r.name || isIgnoredArchiveName(r.name)) continue;
        const rfk = canonicalArchiveFold(r.name);
        if (candidates.indexOf(rfk) !== -1) {
          let csVal = typeof r.cs === 'number' ? r.cs : null;
          let csMVal = typeof r.csMatches === 'number' ? r.csMatches : null;
          if (csVal === null && r.note) {
            const mCs = String(r.note).match(/CS:\s*(\d+)\/(\d+)/i);
            if (mCs) {
              csVal = Number(mCs[1]);
              csMVal = Number(mCs[2]);
            }
          }
          return {
            seasonNumber: 55,
            inProgress: Boolean(s55.inProgress),
            leagueId: lid,
            leagueLabel: lid === 'L1' ? '🏆 Ekstraklasa (L1)' : (lid === 'L2' ? '🥈 2. Liga (L2)' : '🥉 3. Liga (L3)'),
            pos: Number(r.pos || (ri + 1)),
            name: String(r.name),
            M: Number(r.M || 0),
            W: Number(r.W || 0),
            R: Number(r.R || 0),
            P: Number(r.P || 0),
            BZ: Number(r.BZ || 0),
            BS: Number(r.BS || 0),
            diff: Number(r.diff != null ? r.diff : (Number(r.BZ || 0) - Number(r.BS || 0))),
            PKT: Number(r.PKT || 0),
            cs: csVal != null ? csVal : 0,
            csMatches: csMVal != null ? csMVal : Number(r.M || 0),
            note: String(r.note || ''),
            progressLabel: (s55.progressSummary && s55.progressSummary[lid]) || ''
          };
        }
      }
    }
    return null;
  }

  function syncAllPlayersHistoricalStatsInMemory(targetState, includeUnlinkedByName) {
    if (!targetState || !Array.isArray(targetState.players)) return 0;
    const archData = window.SMPL_ARCHIVE_DATA || {};
    const archiveTrophiesMap = archData.PLAYER_TROPHIES_MAP || {};
    const trophiesByFold = {};
    Object.keys(archiveTrophiesMap).forEach(function (k) {
      trophiesByFold[canonicalArchiveFold(k)] = archiveTrophiesMap[k];
    });

    const catalog = getHistoricalPlayersCatalog(targetState);
    const catByFold = {};
    catalog.forEach(function (entry) {
      if (!entry || !entry.name) return;
      catByFold[canonicalArchiveFold(entry.name)] = entry;
    });

    let updatedCount = 0;
    targetState.players.forEach(function (p) {
      if (!p || p.isPlaceholder === true || /^wolny\s*los/i.test(p.name || '')) return;
      const explicitLink = p.historicalArchiveName && String(p.historicalArchiveName).trim()
        ? String(p.historicalArchiveName).trim()
        : '';
      const s55Match = findPlayerS55Record(targetState, p);
      const isExplicitDebut = !explicitLink &&
        !s55Match &&
        p.playedBefore === false &&
        p.historicalStats &&
        p.historicalStats.bestPos === 'Debiutant w Lidze';
      if (isExplicitDebut) return;

      const hasPriorStats = Boolean(p.historicalStats && Number(p.historicalStats.matches || 0) > 0);
      const shouldSync = Boolean(explicitLink || s55Match || hasPriorStats || p.playedBefore === true || (includeUnlinkedByName && p.playedBefore !== false));
      if (!shouldSync) return;

      const lookupRaw = explicitLink || (s55Match ? s55Match.name : '') || p.name || '';
      const fk = canonicalArchiveFold(lookupRaw);
      if (!fk) return;
      const matched = catByFold[fk];
      if (!matched || Number(matched.matches || 0) <= 0) return;

      const prevHs = p.historicalStats || {};
      const statsChanged =
        p.historicalArchiveName !== matched.name ||
        Number(prevHs.seasons || 0) !== Number(matched.seasons || 0) ||
        Number(prevHs.matches || 0) !== Number(matched.matches || 0) ||
        Number(prevHs.points || 0) !== Number(matched.points || 0) ||
        Number(prevHs.total || 0) !== Number(matched.total || 0) ||
        Number(prevHs.gold || 0) !== Number(matched.gold || 0) ||
        Number(prevHs.silver || 0) !== Number(matched.silver || 0) ||
        Number(prevHs.bronze || 0) !== Number(matched.bronze || 0);

      p.historicalArchiveName = matched.name;
      p.playedBefore = true;
      p.historicalStats = JSON.parse(JSON.stringify(matched));

      if (!Array.isArray(p.trophies)) p.trophies = [];
      const mappedTr = trophiesByFold[fk] || archiveTrophiesMap[matched.name] || null;
      if (Array.isArray(mappedTr)) {
        mappedTr.forEach(function (mt) {
          if (!p.trophies.some(function (t) {
            return (mt.id && t.id === mt.id) || (t.title === mt.title && t.season === mt.season);
          })) {
            p.trophies.unshift(JSON.parse(JSON.stringify(mt)));
          }
        });
      }

      const hadSummaryHistTrophy = p.trophies.some(function (t) {
        return t && t.id && String(t.id).indexOf('TR_HIST_') === 0;
      });
      if (hadSummaryHistTrophy) {
        p.trophies = p.trophies.filter(function (t) {
          return !(t && t.id && String(t.id).indexOf('TR_HIST_') === 0);
        });
        if (!Array.isArray(mappedTr) || mappedTr.length === 0) {
          if (matched.gold > 0) {
            p.trophies.unshift({
              id: 'TR_HIST_GOLD_' + matched.seasons + '_' + p.id,
              icon: '\uD83D\uDC51',
              title: matched.gold + 'x Mistrz Score Match Liga (Archiwum S1\u2013S55)',
              season: 'Sezony 1\u201355 (' + matched.seasons + ' sez.)',
              rarity: 'LEGENDARY'
            });
          }
          if (matched.silver > 0) {
            p.trophies.unshift({
              id: 'TR_HIST_SILVER_' + matched.seasons + '_' + p.id,
              icon: '\uD83E\uDD48',
              title: matched.silver + 'x Wicemistrz Score Match Liga (Archiwum S1\u2013S55)',
              season: 'Sezony 1\u201355',
              rarity: 'GOLD'
            });
          }
          if (matched.bronze > 0) {
            p.trophies.unshift({
              id: 'TR_HIST_BRONZE_' + matched.seasons + '_' + p.id,
              icon: '\uD83E\uDD49',
              title: matched.bronze + 'x Br\u0105zowy Medalista Score Match Liga (Archiwum S1\u2013S55)',
              season: 'Sezony 1\u201355',
              rarity: 'SILVER'
            });
          }
        }
      }

      if (statsChanged) updatedCount += 1;
    });

    return updatedCount;
  }

  function reconcileHistoricalStateInternal(targetState, options) {
    if (!targetState) return { updatedPlayers: 0 };
    const opts = options && typeof options === 'object' ? options : {};
    const archData = window.SMPL_ARCHIVE_DATA;
    if (!archData) return { updatedPlayers: 0 };

    const archVer = archData.ARCHIVE_RECALC_VERSION || '2026-11-22-S55-GSHEETS-V4';
    const archSeasons = archData.HISTORICAL_SEASONS || [];
    const archGen = archData.GENERAL_RANKING || [];
    const arch5 = archData.FIVE_SEASON_RANKING || [];
    const archAT = archData.ALL_TIME_RANKING || [];
    const archCareer = archData.CAREER_RANKING || [];

    const force = Boolean(opts.force);
    const needsRecalc = force || targetState.archiveRecalcVersion !== archVer;

    if (needsRecalc || !Array.isArray(targetState.historicalSeasons) || targetState.historicalSeasons.length < archSeasons.length) {
      const extra = (targetState.historicalSeasons || []).filter(function (s) {
        return s && Number(s.seasonNumber) > 55;
      });
      extra.forEach(function (s) {
        if (!s || !s.leagues) return;
        Object.keys(s.leagues).forEach(function (lid) {
          (s.leagues[lid] || []).forEach(function (row) {
            if (row && row.name) row.name = canonicalArchiveName(row.name);
          });
        });
      });
      targetState.historicalSeasons = extra.concat(JSON.parse(JSON.stringify(archSeasons)));
    }

    if (needsRecalc || !Array.isArray(targetState.generalRanking) || targetState.generalRanking.length < archGen.length) {
      targetState.generalRanking = JSON.parse(JSON.stringify(archGen));
    }

    const extraFinished = (targetState.historicalSeasons || []).some(function (s) {
      if (!s || s.inProgress === true || Number(s.seasonNumber) <= 55 || !s.leagues) return false;
      return Object.keys(s.leagues).some(function (lid) {
        return (s.leagues[lid] || []).some(function (r) { return Number(r && r.M) > 0; });
      });
    });

    if (extraFinished && needsRecalc) {
      targetState.allTimeRanking = computeArchiveRankingFromSeasons(targetState.historicalSeasons, 0, 9999, true);
      targetState.careerRanking = computeArchiveRankingFromSeasons(targetState.historicalSeasons, 0, 9999, false);
      const finishedL1Nums = (targetState.historicalSeasons || [])
        .filter(function (s) {
          return s && s.inProgress !== true && s.leagues && Array.isArray(s.leagues.L1) && s.leagues.L1.some(function (r) { return Number(r && r.M) > 0; });
        })
        .map(function (s) { return Number(s.seasonNumber || 0); })
        .sort(function (a, b) { return b - a; });
      if (finishedL1Nums.length >= 5) {
        const winStart = finishedL1Nums[4];
        const winEnd = finishedL1Nums[0];
        targetState.fiveSeasonRanking = computeArchiveRankingFromSeasons(targetState.historicalSeasons, winStart, winEnd, true);
      } else {
        targetState.fiveSeasonRanking = JSON.parse(JSON.stringify(arch5));
      }
    } else {
      if (needsRecalc || !Array.isArray(targetState.fiveSeasonRanking) || targetState.fiveSeasonRanking.length === 0) {
        targetState.fiveSeasonRanking = JSON.parse(JSON.stringify(arch5));
      }
      if (needsRecalc || !Array.isArray(targetState.allTimeRanking) || targetState.allTimeRanking.length === 0) {
        targetState.allTimeRanking = JSON.parse(JSON.stringify(archAT));
      }
      if (needsRecalc || !Array.isArray(targetState.careerRanking) || targetState.careerRanking.length === 0) {
        targetState.careerRanking = JSON.parse(JSON.stringify(archCareer));
      }
    }

    let updatedPlayers = 0;
    if (needsRecalc) {
      __histCatalogCacheKey = '';
      __histCatalogCache = null;
      updatedPlayers = syncAllPlayersHistoricalStatsInMemory(targetState, Boolean(opts.includeUnlinkedByName));
      targetState.archiveRecalcVersion = archVer;
    }

    const s55LinkedCount = (targetState.players || []).filter(function (pl) {
      return pl && !pl.isPlaceholder && Boolean(findPlayerS55Record(targetState, pl));
    }).length;

    return {
      updatedPlayers: updatedPlayers,
      s55LinkedCount: s55LinkedCount,
      allTimeCount: (targetState.allTimeRanking || []).length,
      careerCount: (targetState.careerRanking || []).length,
      fiveSeasonCount: (targetState.fiveSeasonRanking || []).length
    };
  }

  function adminRecalculateAllHistoricalStats(adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const res = reconcileHistoricalStateInternal(state, {
      force: true,
      includeUnlinkedByName: true
    });
    __histCatalogCacheKey = '';
    __histCatalogCache = null;
    addLog(
      'ARCHIVE_FULL_RECALC',
      `\uD83D\uDD04 Admin ${adminName} przeliczy\u0142 pe\u0142ne statystyki historyczne wszystkich zawodnik\u00F3w (S1\u2013S55+, wszystkie ligi L1\u2013L9): ${res.careerCount} graczy w Karierze, ${res.allTimeCount} w Ekstraklasie All-Time, zaktualizowano ${res.updatedPlayers} profili (podpi\u0119to bie\u017C\u0105ce wyniki S55 dla ${res.s55LinkedCount || 0} dopisanych kont).`
    );
    syncToBackend();
    return res;
  }

  function reconcileOrphanedRegistrations(targetState) {
    if (!targetState || !Array.isArray(targetState.registrations)) return;
    const players = Array.isArray(targetState.players) ? targetState.players : [];
    const realPlayers = players.filter((p) => p && !p.isPlaceholder && !p.gdprDeleted);
    targetState.registrations.forEach((r) => {
      if (!r || (r.status !== 'APPROVED' && r.status !== 'ASSIGNED')) return;
      const rPid = String(r.assignedPlayerId || '').trim();
      const rUser = String(r.username || '').trim().toLowerCase();
      const rNick = String(r.nick || '').trim().toLowerCase();
      const matched = realPlayers.find(
        (p) =>
          (rPid && String(p.id || '') === rPid) ||
          (rUser && p.username && String(p.username).trim().toLowerCase() === rUser) ||
          (rNick && p.nick && String(p.nick).trim().toLowerCase() === rNick)
      );
      if (!matched) {
        r.status = 'APPROVED_POOL';
        r.assignedLeague = null;
        r.assignedPlayerId = null;
      }
    });
  }

  function enrichFromArchive(targetState) {
    if (!targetState) return targetState;
    ensureLeaguesStructure(targetState);
    ensureClansStructure(targetState);
    if (window.SMPL_ARCHIVE_DATA) {
      reconcileHistoricalStateInternal(targetState, { force: false, includeUnlinkedByName: false });
    }
    reconcileOrphanedRegistrations(targetState);
    if (!Array.isArray(targetState.blacklist)) {
      const seedBl = window.SMPL_SEED_DATA && window.SMPL_SEED_DATA.blacklist;
      targetState.blacklist = Array.isArray(seedBl) ? seedBl : [];
    }
    if (!targetState.chatMessages) targetState.chatMessages = [];
    if (!targetState.directMessages) targetState.directMessages = [];
    if (!targetState.moderationIncidents) targetState.moderationIncidents = [];
    if (!targetState.disciplinaryLog) targetState.disciplinaryLog = [];
    if (!Array.isArray(targetState.aiKnowledge)) targetState.aiKnowledge = [];
    if (!Array.isArray(targetState.customRanks)) targetState.customRanks = [];
    if (!targetState.portalSettings || typeof targetState.portalSettings !== 'object' || Array.isArray(targetState.portalSettings)) {
      targetState.portalSettings = {};
    }
    if (!Array.isArray(targetState.aiUnansweredQueue)) targetState.aiUnansweredQueue = [];
    if (!Array.isArray(targetState.aiInteractionLog)) targetState.aiInteractionLog = [];
    applyLocalNotifPrefsToState(targetState);
    return targetState;
  }

  function isBackendOnline() {
    return backendOnline;
  }

  function init() {
    try {
      const rawSess = localStorage.getItem(SESSION_KEY);
      if (rawSess) {
        const parsedSess = JSON.parse(rawSess);
        if (parsedSess && parsedSess.serverAdminToken && !serverAdminTokenCache) {
          serverAdminTokenCache = parsedSess.serverAdminToken;
        }
      }
    } catch (e) {}

    let loadedFromLocal = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidDatabasePayload(parsed)) {
          state = enrichFromArchive(parsed);
          loadedFromLocal = true;
        }
      }
    } catch (e) {}

    if (!loadedFromLocal) {
      state = enrichFromArchive(window.SMPL_SEED.buildInitialDatabase());
      state.version = TARGET_VERSION;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
    }
    seedSeenMessageIds(state);

    // Jeśli uruchomiono na serwerze WWW (PHP / Node.js / cPanel / DirectAdmin), pobierz aktualną wspólną bazę z serwera
    if (isHttpProtocol()) {
      pullFromServer(() => {
        if (window.SMPL_APP && typeof window.SMPL_APP.refreshViewFromServer === 'function') {
          window.SMPL_APP.refreshViewFromServer();
        }
      });
    }

    return state;
  }

  function getState() {
    if (!state) {
      state = window.SMPL_SEED.buildInitialDatabase();
      state.version = TARGET_VERSION;
    }
    return enrichFromArchive(state);
  }

  // --- BEZPIECZNE HASHOWANIE HASEŁ (SOLONY HASH DETEMINISTYCZNY ES6) ---
  function hashSecret(plain) {
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

  function verifySecret(record, plainInput) {
    const clean = String(plainInput || '').trim();
    if (!clean || !record) return false;
    if (record.passwordHash && String(record.passwordHash).indexOf('smplh1$') === 0) {
      return record.passwordHash === hashSecret(clean);
    }
    if (record.passwordHash) {
      return String(record.passwordHash) === clean;
    }
    if (record.password) {
      return String(record.password) === clean;
    }
    return false;
  }

  // --- WYKRYWANIE SPECJALNEGO LINKU DOSTĘPOWEGO (TYLKO OTWARCIE BRAMKI LOGOWANIA ADMINA) ---
  let promotedForcedModeFrom = undefined;
  let hasPromotedForcedMode = false;

  function restorePromotedForcedMode(forceMode) {
    if (typeof window === 'undefined') return;
    if (typeof forceMode === 'string') {
      window.SMPL_FORCED_MODE = forceMode;
      hasPromotedForcedMode = false;
      promotedForcedModeFrom = undefined;
    } else if (hasPromotedForcedMode) {
      window.SMPL_FORCED_MODE = promotedForcedModeFrom !== undefined ? promotedForcedModeFrom : '';
      hasPromotedForcedMode = false;
      promotedForcedModeFrom = undefined;
    }
  }

  function detectLinkMode() {
    if (window.SMPL_FORCED_MODE) {
      return window.SMPL_FORCED_MODE; // 'PUBLIC' | 'ADMIN_LINK' | 'MASTER'
    }
    const hash = (window.location.hash || '').toLowerCase();

    if (hash.indexOf('master-szymon') !== -1) {
      return 'MASTER';
    }

    if (hash.indexOf('panel-admina') !== -1 || hash.indexOf('admin') !== -1) {
      return 'ADMIN_LINK';
    }

    try {
      const rawSess = localStorage.getItem(SESSION_KEY);
      if (rawSess) {
        const saved = JSON.parse(rawSess);
        if (
          saved &&
          saved.isAdminAuthenticated === true &&
          (saved.adminRole === 'MASTER_ADMIN' || saved.adminRole === 'CO_ADMIN') &&
          saved.adminId
        ) {
          if (saved.linkMode === 'MASTER' || saved.linkMode === 'ADMIN_LINK') {
            return saved.linkMode;
          }
          return saved.adminRole === 'MASTER_ADMIN' ? 'MASTER' : 'ADMIN_LINK';
        }
      }
    } catch (e) {}

    return 'PUBLIC';
  }

  function clearAdminFieldsOnSession(sess) {
    if (!sess) return sess;
    sess.isAdminAuthenticated = false;
    sess.adminId = null;
    sess.adminName = null;
    sess.adminRole = null;
    sess.adminTitle = null;
    sess.serverAdminToken = null;
    return sess;
  }

  function clearAdminAuthState(sess, forceMode) {
    const oldToken = serverAdminTokenCache || (sess && sess.serverAdminToken);
    serverAdminTokenCache = null;
    if (oldToken) revokeServerAdminToken(oldToken);
    clearAdminFieldsOnSession(sess);
    restorePromotedForcedMode(forceMode);
    if (sess) {
      sess.linkMode = typeof forceMode === 'string' ? forceMode : detectLinkMode();
    }
    return sess;
  }

  function isStrictAdminSession(sessOverride) {
    const sess = sessOverride || getSession();
    if (!sess || sess.isAdminAuthenticated !== true) return false;
    if (sess.linkMode === 'PUBLIC') return false;
    if (!sess.adminId || !sess.adminRole) return false;
    if (state && Array.isArray(state.admins)) {
      const matched = state.admins.find((a) => a && a.id === sess.adminId);
      if (!matched || (matched.status !== undefined && matched.status !== 'APPROVED')) {
        return false;
      }
    }
    return true;
  }

  function requestServerAdminToken(loginStr, passwordStr, syncAfter) {
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      if (syncAfter) syncToBackend();
      return Promise.resolve(null);
    }
    const baseEp = activeApiEndpoint === './api/state' ? './api/state' : './api.php';
    const altEp = baseEp === './api.php' ? './api/state' : './api.php';
    const bodyStr = JSON.stringify({ login: loginStr, password: passwordStr });

    function postAuth(ep) {
      const sep = ep.indexOf('?') === -1 ? '?' : '&';
      return fetch(ep + sep + 'action=admin_auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr
      });
    }

    try {
      serverAdminTokenPromise = postAuth(baseEp)
        .then((res) => {
          if (res && (res.status === 404 || res.status === 405 || res.status === 501)) {
            return postAuth(altEp);
          }
          return res;
        })
        .catch(() => postAuth(altEp))
        .then((res) => (res && res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.ok && data.token) {
            serverAdminTokenCache = String(data.token);
            try {
              const raw = localStorage.getItem(SESSION_KEY);
              const parsed = raw ? JSON.parse(raw) : null;
              if (parsed && parsed.isAdminAuthenticated) {
                parsed.serverAdminToken = serverAdminTokenCache;
                localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
              }
            } catch (e) {}
          }
          if (syncAfter) syncToBackend();
          if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.syncPushSubscriptionContext === 'function') {
            window.SMPL_NOTIF.syncPushSubscriptionContext();
          }
          return serverAdminTokenCache;
        })
        .catch(() => {
          if (syncAfter) syncToBackend();
          return null;
        });
      return serverAdminTokenPromise;
    } catch (e) {
      if (syncAfter) syncToBackend();
      return Promise.resolve(null);
    }
  }

  function revokeServerAdminToken(tokenToRevoke) {
    if (!tokenToRevoke || !isHttpProtocol() || typeof fetch !== 'function') return;
    try {
      fetch(getAiActionUrl('admin_logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SMPL-Admin-Token': tokenToRevoke
        },
        body: JSON.stringify({ token: tokenToRevoke, _adminToken: tokenToRevoke })
      }).catch(() => {});
    } catch (e) {}
  }

  function clearPlayerTokenCache(sess) {
    serverPlayerTokenCache = null;
    serverPlayerTokenPromise = null;
    if (sess) {
      sess.serverPlayerToken = null;
      sess.activeRegId = null;
    }
  }

  function requestServerPlayerToken(identifier, password) {
    if (!isHttpProtocol() || typeof fetch !== 'function' || !identifier || !password) {
      return Promise.resolve(null);
    }
    const baseEp = activeApiEndpoint === './api/state' ? './api/state' : './api.php';
    const altEp = baseEp === './api.php' ? './api/state' : './api.php';
    const bodyStr = JSON.stringify({ identifier: String(identifier), password: String(password) });

    function postAuth(ep) {
      const sep = ep.indexOf('?') === -1 ? '?' : '&';
      return fetch(ep + sep + 'action=player_auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr
      });
    }

    try {
      serverPlayerTokenPromise = postAuth(baseEp)
        .then((res) => {
          if (res && (res.status === 404 || res.status === 405 || res.status === 501)) {
            return postAuth(altEp);
          }
          return res;
        })
        .catch(() => postAuth(altEp))
        .then((res) => (res && res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.ok && data.token) {
            serverPlayerTokenCache = String(data.token);
            try {
              const raw = localStorage.getItem(SESSION_KEY);
              const parsed = raw ? JSON.parse(raw) : null;
              if (parsed && parsed.isPlayerAuthenticated) {
                parsed.serverPlayerToken = serverPlayerTokenCache;
                localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
              }
            } catch (e) {}
            if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.syncPushSubscriptionContext === 'function') {
              window.SMPL_NOTIF.syncPushSubscriptionContext();
            }
            return serverPlayerTokenCache;
          }
          return null;
        })
        .catch(() => null);
      return serverPlayerTokenPromise;
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function sendPlayerLeagueMembershipToServer(op, leagueId, localCreatedPlayerId, rollbackFn, onServerResult) {
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      if (typeof onServerResult === 'function') {
        onServerResult(null, { ok: true, offline: true, op: op, leagueId: leagueId || '' });
      }
      return;
    }

    localMutationEpoch += 1;
    activeServerWritesCount += 1;
    lastServerWriteStartedAt = Date.now();
    const finishWrite = () => {
      activeServerWritesCount = Math.max(0, activeServerWritesCount - 1);
    };

    const waitTok = serverPlayerTokenPromise ? serverPlayerTokenPromise : Promise.resolve(null);
    const baseEp = activeApiEndpoint === './api/state' ? './api/state' : './api.php';
    const altEp = baseEp === './api.php' ? './api/state' : './api.php';

    waitTok
      .then(() => {
        const sessNow = getSession();
        const tok = serverPlayerTokenCache || (sessNow && sessNow.serverPlayerToken) || '';
        if (!tok) {
          finishWrite();
          if (typeof rollbackFn === 'function') rollbackFn();
          const tokErr = 'Twoja sesja logowania wygasła (brak tokena serwera). Kliknij [Wyloguj się] i zaloguj się ponownie swoim loginem i hasłem, a następnie kliknij Dołącz do Ligi.';
          if (typeof onServerResult === 'function') {
            onServerResult(tokErr, { status: 401, rejected: true, tokenMissing: true });
          } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            try {
              window.dispatchEvent(new CustomEvent('smpl:server-rejected', { detail: { status: 401, message: tokErr } }));
            } catch (e) {}
          }
          return null;
        }
        const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
        headers['X-SMPL-Player-Token'] = tok;
        const bodyStr = JSON.stringify({ op: op, leagueId: leagueId || '', _playerToken: tok });

        function postTo(ep) {
          const sep = ep.indexOf('?') === -1 ? '?' : '&';
          return fetch(ep + sep + 'action=player_league_membership', {
            method: 'POST',
            headers: headers,
            body: bodyStr
          });
        }

        function handleResp(res, canFallback) {
          if (!res) {
            finishWrite();
            backendOnline = false;
            if (typeof onServerResult === 'function') {
              onServerResult(null, { ok: true, offline: true, op: op, leagueId: leagueId || '' });
            }
            return Promise.resolve();
          }
          if (canFallback && (res.status === 404 || res.status === 405 || res.status === 501)) {
            return postTo(altEp).then((r2) => handleResp(r2, false));
          }
          return res
            .json()
            .catch(() => null)
            .then((data) => {
              finishWrite();
              if (res.ok && data && data.ok) {
                backendOnline = true;
                if (data.state && Array.isArray(data.state.players)) {
                  captureServerArchiveSnapshot(data.state);
state = enrichFromArchive(data.state);
                }
                const sNow = getSession();
                if (op === 'join' && data.playerId && sNow) {
                  if (localCreatedPlayerId && data.playerId !== localCreatedPlayerId && state && Array.isArray(state.players) && !data.state) {
                    const locP = state.players.find((p) => p && p.id === localCreatedPlayerId);
                    if (locP) locP.id = data.playerId;
                  }
                  sNow.activePlayerId = data.playerId;
                  sNow.activeRegId = null;
                  saveSession(sNow);
                }
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                } catch (e) {}
                if (typeof onServerResult === 'function') {
                  onServerResult(null, data);
                }
                return;
              }

              if (typeof rollbackFn === 'function') rollbackFn();
              let errMsg = (data && data.error) ? String(data.error) : ('Błąd serwera HTTP ' + res.status);
              if (res.status === 401) {
                serverPlayerTokenCache = null;
                try {
                  const rawS = localStorage.getItem(SESSION_KEY);
                  if (rawS) {
                    const pS = JSON.parse(rawS);
                    if (pS) {
                      pS.serverPlayerToken = null;
                      localStorage.setItem(SESSION_KEY, JSON.stringify(pS));
                    }
                  }
                } catch (e) {}
                if (errMsg.indexOf('Wyloguj') === -1 && errMsg.indexOf('Zaloguj') === -1) {
                  errMsg = errMsg + ' Kliknij [Wyloguj się] i zaloguj się ponownie hasłem.';
                }
              }
              if (res.status === 400 || res.status === 401 || res.status === 403) {
                pullFromServer(null, true);
              }
              if (typeof onServerResult === 'function') {
                onServerResult(errMsg, { status: res.status, rejected: true, data: data });
              } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                try {
                  window.dispatchEvent(new CustomEvent('smpl:server-rejected', { detail: { status: res.status, message: errMsg } }));
                } catch (e) {}
              }
            });
        }

        return postTo(baseEp)
          .then((res) => handleResp(res, true))
          .catch(() => {
            return postTo(altEp)
              .then((r2) => handleResp(r2, false))
              .catch(() => {
                finishWrite();
                backendOnline = false;
                if (typeof onServerResult === 'function') {
                  onServerResult(null, { ok: true, offline: true, op: op, leagueId: leagueId || '' });
                }
              });
          });
      })
      .catch(() => {
        finishWrite();
        backendOnline = false;
        if (typeof onServerResult === 'function') {
          onServerResult(null, { ok: true, offline: true, op: op, leagueId: leagueId || '' });
        }
      });
  }

  // --- SESJA I AUTORYZACJA (BEZ ŻADNEGO AUTO-LOGOWANIA) ---
  function getSession() {
    let linkMode = detectLinkMode();
    let saved = null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {}

    const baseSession = saved || {
      isAdminAuthenticated: false,
      adminId: null,
      adminName: null,
      adminRole: null, // 'MASTER_ADMIN' | 'CO_ADMIN'
      adminTitle: null,
      serverAdminToken: null,
      serverPlayerToken: null,
      activePlayerId: null,
      activeRegId: null
    };

    const isStoredAdminRole =
      baseSession.isAdminAuthenticated === true &&
      (baseSession.adminRole === 'MASTER_ADMIN' || baseSession.adminRole === 'CO_ADMIN') &&
      Boolean(baseSession.adminId);

    if (isStoredAdminRole && linkMode === 'PUBLIC' && window.SMPL_FORCED_MODE !== 'PUBLIC') {
      linkMode =
        baseSession.linkMode === 'MASTER' || baseSession.linkMode === 'ADMIN_LINK'
          ? baseSession.linkMode
          : baseSession.adminRole === 'MASTER_ADMIN'
            ? 'MASTER'
            : 'ADMIN_LINK';
    }

    const hasValidAdminState =
      Boolean(baseSession.isAdminAuthenticated === true) &&
      linkMode !== 'PUBLIC' &&
      Boolean(baseSession.adminId) &&
      Boolean(baseSession.adminRole) &&
      (!state ||
        !Array.isArray(state.admins) ||
        state.admins.some(
          (a) => a && a.id === baseSession.adminId && (a.status === undefined || a.status === 'APPROVED')
        ));

    if (!hasValidAdminState) {
      clearAdminFieldsOnSession(baseSession);
    } else {
      if (baseSession.serverAdminToken && !serverAdminTokenCache) {
        serverAdminTokenCache = baseSession.serverAdminToken;
      }
      if (!baseSession.activePlayerId && state && Array.isArray(state.players)) {
        const linkedAdmPlayer = findPlayerForAdmin(baseSession.adminId, state);
        if (linkedAdmPlayer && !linkedAdmPlayer.isPlaceholder) {
          baseSession.activePlayerId = linkedAdmPlayer.id;
        }
      }
    }

    baseSession.linkMode = linkMode;
    return baseSession;
  }

  function saveSession(sessionObj) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionObj));
    } catch (e) {}
    return sessionObj;
  }

  function grantAdminSession(adminMatch, loginInput, cleanPass, logType, logText) {
    if (!adminMatch.passwordHash || String(adminMatch.passwordHash).indexOf('smplh1$') !== 0 || adminMatch.password) {
      adminMatch.passwordHash = hashSecret(cleanPass);
      delete adminMatch.password;
    }

    const targetMode = adminMatch.role === 'MASTER_ADMIN' ? 'MASTER' : 'ADMIN_LINK';
    if (typeof window !== 'undefined') {
      if (!hasPromotedForcedMode && window.SMPL_FORCED_MODE !== targetMode) {
        promotedForcedModeFrom = window.SMPL_FORCED_MODE;
        hasPromotedForcedMode = true;
      }
      window.SMPL_FORCED_MODE = targetMode;
    }

    const session = getSession();
    clearPlayerTokenCache(session);
    session.isAdminAuthenticated = true;
    session.isPlayerAuthenticated = false;
    session.isGateUnlocked = true;
    session.isGuest = false;
    session.adminId = adminMatch.id;
    session.adminName = adminMatch.name;
    session.adminRole = adminMatch.role || 'CO_ADMIN';
    session.adminTitle = adminMatch.roleTitle || 'Administrator SMPL';
    session.linkMode = targetMode;
    const linkedAdmPlayer = findPlayerForAdmin(adminMatch, state);
    session.activePlayerId = (linkedAdmPlayer && !linkedAdmPlayer.isPlaceholder) ? linkedAdmPlayer.id : null;
    saveSession(session);

    addLog(logType, logText);
    const shouldDeferSync = isHttpProtocol() && activeApiEndpoint.indexOf('api.php') !== -1 && !serverAdminTokenCache;
    if (isHttpProtocol()) {
      requestServerAdminToken(loginInput, cleanPass, shouldDeferSync);
    }
    if (!shouldDeferSync) {
      syncToBackend();
    }
    return session;
  }

  function authenticateAdmin(loginInput, passwordInput) {
    const q = (loginInput || '').trim().toLowerCase();
    const pass = (passwordInput || '').trim();

    if (!q || !pass) {
      return {
        ok: false,
        error: 'Podaj swój indywidualny login administratora oraz hasło.'
      };
    }

    const adminMatch = (state.admins || []).find(
      (a) =>
        (a.username && a.username.toLowerCase() === q) ||
        (a.email && a.email.toLowerCase() === q)
    );

    if (!adminMatch || !verifySecret(adminMatch, pass)) {
      return {
        ok: false,
        error: 'Nieprawidłowy login lub hasło administratora!'
      };
    }

    if (adminMatch.status === 'PENDING') {
      return {
        ok: false,
        error: '⏳ Twój wniosek o dołączenie do Administracji SMPL oczekuje jeszcze na zatwierdzenie przez Głównego Administratora (Szymona Komendę)!'
      };
    }

    if (adminMatch.status === 'REJECTED' || adminMatch.status !== 'APPROVED') {
      return {
        ok: false,
        error: '⛔ Twój dostęp do Panelu Administratora został odrzucony lub cofnięty przez Głównego Administratora.'
      };
    }

    const session = grantAdminSession(
      adminMatch,
      q,
      pass,
      'ADMIN_LOGIN',
      `🔐 Zalogowano do Panelu Administracji: ${adminMatch.name} (${adminMatch.roleTitle}).`
    );

    return { ok: true, admin: adminMatch, session };
  }

  function logoutAdmin() {
    const session = getSession();
    clearAdminAuthState(session);
    session.isGateUnlocked = Boolean(session.isPlayerAuthenticated || session.isGuest);
    saveSession(session);
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.syncPushSubscriptionContext === 'function') {
      window.SMPL_NOTIF.syncPushSubscriptionContext();
    }
  }

  // --- WNIOSKI O DOŁĄCZENIE DO ADMINISTRACJI (ZATWIERDZANE PRZEZ SZYMONA KOMENDĘ) ---
  function submitAdminApplication({ name, username, email, fbLink, division, password, reason }) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    if (!cleanUser || cleanUser.length < 3) {
      throw new Error('Login musi mieć co najmniej 3 znaki.');
    }
    if (!cleanPass || cleanPass.length < 6) {
      throw new Error('Hasło do konta administratora musi mieć co najmniej 6 znaków.');
    }
    const exists = (state.admins || []).some(
      (a) =>
        (a.username && a.username.toLowerCase() === cleanUser) ||
        (a.name && a.name.toLowerCase() === (name || '').trim().toLowerCase())
    );
    if (exists) {
      throw new Error('Konto lub wniosek o takim loginie już istnieje w systemie.');
    }

    const newAdminReq = {
      id: 'ADM_REQ_' + Date.now(),
      name: name.trim(),
      username: cleanUser,
      email: (email || `${cleanUser}@smpl.pl`).trim(),
      fbLink: (fbLink || 'https://m.me/smpl').trim(),
      division: division || '2. Liga (L2)',
      roleTitle: `Współadministrator — ${division || '2. Liga (L2)'}`,
      passwordHash: hashSecret(cleanPass),
      role: 'CO_ADMIN',
      status: 'PENDING',
      reason: (reason || 'Chęć pomocy w prowadzeniu rozgrywek i weryfikacji wyników Score Match Ligi.').trim(),
      submittedAt: nowFormatted()
    };

    state.admins.push(newAdminReq);
    addLog(
      'ADMIN_APPLY',
      `🛡️ Nowy wniosek o dołączenie do Administracji SMPL: ${newAdminReq.name} — oczekuje na akceptację Właściciela Ligi.`
    );
    syncToBackend();
    return newAdminReq;
  }

  function generateReadablePassword(prefix = 'SMPL') {
    const cleanPfx = String(prefix || 'SMPL').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'SMPL';
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const c1 = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    const c2 = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    return cleanPfx + digits + c1 + c2;
  }

  function collectUsedUsernamesSet(includeAdmins = true) {
    const used = Object.create(null);
    const realPlayers = (state && Array.isArray(state.players) ? state.players : []).filter(
      (p) => p && !p.isPlaceholder && !p.gdprDeleted
    );
    realPlayers.forEach((p) => {
      if (p.username) {
        used[String(p.username).trim().toLowerCase()] = true;
      }
    });
    (state && Array.isArray(state.registrations) ? state.registrations : []).forEach((r) => {
      if (!r || !r.username) return;
      const st = String(r.status || '');
      if (st === 'PENDING' || st === 'APPROVED_POOL') {
        used[String(r.username).trim().toLowerCase()] = true;
      } else if ((st === 'APPROVED' || st === 'ASSIGNED') && r.assignedPlayerId) {
        const exists = realPlayers.some((p) => String(p.id || '') === String(r.assignedPlayerId));
        if (exists) {
          used[String(r.username).trim().toLowerCase()] = true;
        }
      }
    });
    if (includeAdmins) {
      (state && Array.isArray(state.admins) ? state.admins : []).forEach((a) => {
        if (a && a.username) {
          used[String(a.username).trim().toLowerCase()] = true;
        }
      });
    }
    return used;
  }

  function isEntityBlacklisted(name, nick, fbLink) {
    const nFold = foldPlChars(name || '');
    const kFold = foldPlChars(nick || '');
    const fbLow = String(fbLink || '').trim().toLowerCase();
    return (state && Array.isArray(state.blacklist) ? state.blacklist : []).some((b) => {
      if (!b) return false;
      if (nFold && b.name && foldPlChars(b.name) === nFold) return true;
      if (kFold && b.nick && foldPlChars(b.nick) === kFold) return true;
      if (fbLow && b.fbLink && String(b.fbLink).trim().toLowerCase() === fbLow) return true;
      return false;
    });
  }

  function sendAtomicAdminAction(actionName, wirePayload, rollbackFn, offlineResult, onServerResult) {
    if (!isHttpProtocol()) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
      if (typeof onServerResult === 'function') {
        onServerResult(null, Object.assign({ ok: true, offline: true }, offlineResult || {}));
      }
      return;
    }

    localMutationEpoch += 1;
    activeServerWritesCount += 1;
    lastServerWriteStartedAt = Date.now();
    const finishWrite = () => {
      activeServerWritesCount = Math.max(0, activeServerWritesCount - 1);
    };

    const baseEp = activeApiEndpoint === './api/state' ? './api/state' : './api.php';
    const altEp = baseEp === './api.php' ? './api/state' : './api.php';
    const waitAdmTok = serverAdminTokenPromise ? serverAdminTokenPromise : Promise.resolve(null);

    waitAdmTok
      .then(() => {
        const tok = resolveAdminRequestToken();
        const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
        if (tok) headers['X-SMPL-Admin-Token'] = tok;
        const wireObj = Object.assign({}, wirePayload || {});
        if (tok) wireObj._adminToken = tok;
        const bodyStr = JSON.stringify(wireObj);

        function postTo(ep) {
          const sep = ep.indexOf('?') === -1 ? '?' : '&';
          return fetch(ep + sep + 'action=' + encodeURIComponent(actionName), {
            method: 'POST',
            headers: headers,
            body: bodyStr
          });
        }

        function handleResponse(res, canFallback) {
          if (!res) {
            finishWrite();
            backendOnline = false;
            if (typeof onServerResult === 'function') {
              onServerResult(null, Object.assign({ ok: true, offline: true }, offlineResult || {}));
            }
            return;
          }
          if (res.status === 404 || res.status === 405 || res.status === 501) {
            if (canFallback) {
              return postTo(altEp).then((r2) => handleResponse(r2, false));
            }
            finishWrite();
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (e) {}
            syncToBackend();
            if (typeof onServerResult === 'function') {
              onServerResult(null, Object.assign({ ok: true, fallbackSync: true }, offlineResult || {}));
            }
            return;
          }
          return res
            .json()
            .catch(() => null)
            .then((data) => {
              finishWrite();
              if (res.ok && data && data.ok) {
                backendOnline = true;
                if (data.state && Array.isArray(data.state.players)) {
                  captureServerArchiveSnapshot(data.state);
state = enrichFromArchive(data.state);
                  try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                  } catch (e) {}
                }
                if (typeof onServerResult === 'function') {
                  onServerResult(null, Object.assign({}, offlineResult || {}, data));
                }
                return;
              }
              const errMsg = (data && data.error) ? String(data.error) : ('Błąd serwera HTTP ' + res.status);
              const isAuthExpired = res.status === 401 || (data && (data.code === 'ADMIN_TOKEN_EXPIRED' || data.code === 'ADMIN_AUTH_REQUIRED'));
              if (isAuthExpired) {
                serverAdminTokenCache = null;
                try {
                  const rawS = localStorage.getItem(SESSION_KEY);
                  if (rawS) {
                    const pS = JSON.parse(rawS);
                    if (pS) {
                      pS.serverAdminToken = null;
                      localStorage.setItem(SESSION_KEY, JSON.stringify(pS));
                    }
                  }
                } catch (e) {}
              }
              if (typeof rollbackFn === 'function') rollbackFn();
              if (res.status === 400 || res.status === 401 || res.status === 403) {
                pullFromServer(null, true);
              }
              if (typeof onServerResult === 'function') {
                onServerResult(errMsg, { status: res.status, rejected: true, authExpired: isAuthExpired, data: data });
              }
            });
        }

        return postTo(baseEp)
          .then((res) => handleResponse(res, true))
          .catch(() => {
            return postTo(altEp)
              .then((r2) => handleResponse(r2, false))
              .catch(() => {
                finishWrite();
                backendOnline = false;
                if (typeof onServerResult === 'function') {
                  onServerResult(null, Object.assign({ ok: true, offline: true }, offlineResult || {}));
                }
              });
          });
      })
      .catch(() => {
        finishWrite();
        backendOnline = false;
        if (typeof onServerResult === 'function') {
          onServerResult(null, Object.assign({ ok: true, offline: true }, offlineResult || {}));
        }
      });
  }

  function masterGrantAdminDirect(options, onServerResult) {
    const __sess = assertMasterAdminAuthenticated();
    const opts = options && typeof options === 'object' ? options : {};
    if (!Array.isArray(state.admins)) state.admins = [];
    if (!Array.isArray(state.players)) state.players = [];
    if (!Array.isArray(state.registrations)) state.registrations = [];

    const sourcePlayerId = String(opts.sourcePlayerId || '').trim();
    const sourceRegId = String(opts.sourceRegId || '').trim();
    const linkPlayer = opts.linkPlayer !== undefined ? Boolean(opts.linkPlayer) : true;
    const srcPlayer = sourcePlayerId ? state.players.find((p) => p && !p.isPlaceholder && String(p.id) === sourcePlayerId) : null;
    if (sourcePlayerId && !srcPlayer) throw new Error('Nie znaleziono wskazanego gracza.');
    const srcReg = sourceRegId ? state.registrations.find((r) => r && String(r.id) === sourceRegId) : null;
    if (sourceRegId && !srcReg) throw new Error('Nie znaleziono wskazanego zgłoszenia.');

    const cleanName = String((opts.name && String(opts.name).trim()) || (srcPlayer && srcPlayer.name) || (srcReg && srcReg.name) || '').trim();
    if (cleanName.length < 2) throw new Error('Podaj imię / nazwę nowego Administratora (minimum 2 znaki).');

    const srcNick = (srcPlayer && srcPlayer.nick) || (srcReg && srcReg.nick) || '';
    if (isEntityBlacklisted(cleanName, srcNick, opts.fbLink || '')) {
      throw new Error('⛔ Kandydat widnieje na Czarnej Liście SMPL i nie może otrzymać uprawnień Administratora.');
    }

    const baseUserCandidate = (opts.username && String(opts.username).trim())
      || (srcPlayer && srcPlayer.username)
      || (srcReg && srcReg.username)
      || toCleanUsername(cleanName);
    const rawUsername = String(baseUserCandidate).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(rawUsername)) {
      throw new Error('Login administratora musi mieć 3–40 znaków (małe litery, cyfry, kropka, myślnik lub podkreślnik).');
    }

    const rawPassInput = opts.password !== undefined ? String(opts.password).trim() : '';
    const existingSrcHash = (srcPlayer && srcPlayer.passwordHash && /^smplh1\$[a-f0-9]{8,64}$/i.test(srcPlayer.passwordHash))
      ? srcPlayer.passwordHash
      : ((srcReg && srcReg.passwordHash && /^smplh1\$[a-f0-9]{8,64}$/i.test(srcReg.passwordHash)) ? srcReg.passwordHash : '');

    let finalPassHash = '';
    let tempPassword = '';
    let usedExistingPassword = false;
    if (rawPassInput) {
      if (rawPassInput.length < 4) throw new Error('Hasło administratora musi mieć minimum 4 znaki.');
      tempPassword = rawPassInput;
      finalPassHash = hashSecret(tempPassword);
    } else if (existingSrcHash && (opts.useExistingPassword !== false)) {
      finalPassHash = existingSrcHash;
      usedExistingPassword = true;
    } else {
      throw new Error('Podaj hasło dla nowego Administratora (min. 4 znaki) lub kliknij Losuj.');
    }

    const masterName = opts.masterName || __sess.adminName || 'Szymon Komenda';
    const division = String(opts.division || 'Wszystkie Dywizje (Zarząd)').trim() || 'Wszystkie Dywizje (Zarząd)';
    const roleTitle = String(opts.roleTitle || ('Współadministrator — ' + division)).trim();
    const cleanFb = String((opts.fbLink && String(opts.fbLink).trim()) || (srcPlayer && (srcPlayer.fbLink || srcPlayer.fb)) || (srcReg && srcReg.fbLink) || 'https://m.me/smpl').trim();
    const cleanEmail = String((opts.email && String(opts.email).trim()) || (rawUsername + '@smpl.pl')).trim().toLowerCase();
    const cleanAvatar = String((opts.avatar !== undefined ? opts.avatar : '') || (srcPlayer && srcPlayer.avatar) || (srcReg && srcReg.avatar) || '');

    const tsMs = Date.now();
    const nowFmt = nowFormatted();
    const existingAdm = state.admins.find((a) => a && String(a.username || '').trim().toLowerCase() === rawUsername);
    if (existingAdm) {
      const isSameLinkedPlayer = Boolean(srcPlayer && srcPlayer.adminId && String(srcPlayer.adminId) === String(existingAdm.id));
      const canReactivate = existingAdm.role !== 'MASTER_ADMIN' && (existingAdm.status !== 'APPROVED' || isSameLinkedPlayer);
      if (!canReactivate) {
        throw new Error(`Login administratora "${rawUsername}" jest już zajęty przez aktywnego admina.`);
      }
    }

    const prevSnap = {
      admins: JSON.stringify(state.admins),
      players: JSON.stringify(state.players),
      activityLog: JSON.stringify(state.activityLog || []),
      updatedAt: state.updatedAt || 0
    };

    const admId = existingAdm ? existingAdm.id : ('ADM_DIRECT_' + tsMs);
    const admRecord = {
      id: admId,
      name: cleanName,
      username: rawUsername,
      email: cleanEmail,
      fbLink: cleanFb,
      division: division,
      roleTitle: roleTitle,
      passwordHash: finalPassHash,
      role: 'CO_ADMIN',
      status: 'APPROVED',
      grantedDirectly: true,
      approvedBy: masterName,
      approvedAt: nowFmt,
      submittedAt: (existingAdm && existingAdm.submittedAt) || nowFmt,
      avatar: cleanAvatar
    };

    if (existingAdm) {
      Object.assign(existingAdm, admRecord);
    } else {
      state.admins.push(admRecord);
    }

    let linkedPlayerId = null;
    if (linkPlayer && srcPlayer) {
      srcPlayer.isAdminPlayer = true;
      srcPlayer.adminId = admRecord.id;
      srcPlayer.adminRole = 'CO_ADMIN';
      if (!Array.isArray(srcPlayer.notifications)) srcPlayer.notifications = [];
      srcPlayer.notifications.unshift({
        id: 'NOTIF_ADM_' + tsMs,
        time: nowFmt,
        text: `👑 Master Admin ${masterName} nadał Ci uprawnienia Administratora SMPL (login: ${rawUsername})!`
      });
      linkedPlayerId = srcPlayer.id;
    }

    addLog(
      'ADMIN_GRANT_DIRECT',
      `👑 Master Admin ${masterName} nadał uprawnienia Administratora ("TAK O") dla: ${cleanName} (@${rawUsername}, sekcja: ${division}).`
    );

    const messengerText = [
      `👑 UPRAWNIENIA ADMINISTRATORA SMPL — DANE LOGOWANIA`,
      `Cześć ${cleanName}! Master Admin ${masterName} nadał Ci bezpośredni dostęp Administratora (${division}):`,
      `👤 Twój Login: ${rawUsername}`,
      `🔒 Hasło: ${usedExistingPassword ? '(Twoje dotychczasowe hasło konta gracza)' : tempPassword}`,
      `🛡️ Logowanie: wejdź na stronę główną lub PANEL-ADMINA.html i zaloguj się powyższymi danymi.`,
      `Pozdrawiamy, ${masterName} (Master Admin SMPL)`
    ].join('\n');

    const rollbackFn = () => {
      try {
        state.admins = JSON.parse(prevSnap.admins);
        state.players = JSON.parse(prevSnap.players);
        state.activityLog = JSON.parse(prevSnap.activityLog);
        state.updatedAt = prevSnap.updatedAt;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
    };

    const resultObj = {
      admin: admRecord,
      linkedPlayerId: linkedPlayerId,
      username: rawUsername,
      tempPassword: tempPassword,
      usedExistingPassword: usedExistingPassword,
      messengerText: messengerText
    };

    sendAtomicAdminAction(
      'master_grant_admin',
      {
        id: admRecord.id,
        sourcePlayerId: sourcePlayerId,
        sourceRegId: sourceRegId,
        linkPlayer: linkPlayer,
        name: cleanName,
        username: rawUsername,
        passwordHash: usedExistingPassword ? '' : finalPassHash,
        useExistingPassword: usedExistingPassword,
        division: division,
        roleTitle: roleTitle,
        fbLink: cleanFb,
        email: cleanEmail,
        avatar: cleanAvatar
      },
      rollbackFn,
      resultObj,
      onServerResult
    );

    return resultObj;
  }

  function approveAdminApplication(adminId, masterName = 'Szymon Komenda') {
    const __sess = assertAdminAuthenticated();
    if (__sess.adminRole !== 'MASTER_ADMIN') {
      throw new Error('Odmowa dostępu: Tylko Główny Właściciel Ligi może zatwierdzać dostęp do Administracji!');
    }
    const adm = (state.admins || []).find((a) => a.id === adminId);
    if (!adm) throw new Error('Nie znaleziono wniosku administratora.');

    adm.status = 'APPROVED';
    adm.approvedBy = masterName;
    adm.approvedAt = nowFormatted();

    addLog(
      'ADMIN_APPROVE',
      `👑 Główny Admin ${masterName} zatwierdził dostęp do Administracji dla: ${adm.name} (sekcja: ${adm.division}).`
    );
    syncToBackend();
    return adm;
  }

  function rejectOrRevokeAdmin(adminId, reason = 'Decyzja Głównego Administratora', masterName = 'Szymon Komenda') {
    const __sess = assertAdminAuthenticated();
    if (__sess.adminRole !== 'MASTER_ADMIN') {
      throw new Error('Odmowa dostępu: Tylko Główny Właściciel Ligi może odbierać uprawnienia Administracji!');
    }
    const adm = (state.admins || []).find((a) => a.id === adminId);
    if (!adm) throw new Error('Nie znaleziono konta administratora.');
    if (adm.role === 'MASTER_ADMIN') throw new Error('Nie można odebrać uprawnień Głównemu Właścicielowi (Master Admin)!');

    adm.status = 'REJECTED';
    adm.rejectionReason = reason;
    adm.reviewedBy = masterName;
    adm.reviewedAt = nowFormatted();

    // Zdejmij powiązanie rangi Admina z profilu zawodnika, aby cofnięty admin nie zachował odznaki 🛡️ ADMIN
    const revNameLow = adm.name ? String(adm.name).trim().toLowerCase() : '';
    const revUserLow = adm.username ? String(adm.username).trim().toLowerCase() : '';
    (state.players || []).forEach((pl) => {
      if (!pl) return;
      const pNameLow = pl.name ? String(pl.name).trim().toLowerCase() : '';
      const pUserLow = pl.username ? String(pl.username).trim().toLowerCase() : '';
      const matchesRevoked =
        (pl.adminId && String(pl.adminId) === String(adm.id)) ||
        (pl.isAdminPlayer && ((revUserLow && pUserLow === revUserLow) || (revNameLow && pNameLow === revNameLow)));
      if (matchesRevoked) {
        pl.isAdminPlayer = false;
        delete pl.adminId;
        delete pl.adminRole;
      }
    });

    addLog(
      'ADMIN_REVOKE',
      `🚫 Główny Admin ${masterName} odrzucił/odebrał uprawnienia administratora dla: ${adm.name}.`
    );
    syncToBackend();
    return adm;
  }

  // --- OPERACJE MECZOWE (GRACZ I ADMIN) ---
  function isValidLeagueGoalPair(homeScore, awayScore, allowWalkover = false) {
    if (homeScore === null || homeScore === undefined || homeScore === '' || awayScore === null || awayScore === undefined || awayScore === '') {
      return false;
    }
    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) return false;
    // W Score! Match gra się zawsze do max 2 bramek — także walkowery (2:0 / 0:2 / 0:0 WO)
    if (allowWalkover) {
      if ((hs === 2 && as === 0) || (hs === 0 && as === 2) || (hs === 0 && as === 0)) return true;
    }
    if (hs > 2 || as > 2) return false;
    if (hs === 2 && as === 2) return false;
    return true;
  }

  function findCompanionReturnMatch(matchesList, primaryMatch) {
    if (!Array.isArray(matchesList) || !primaryMatch) return null;
    const candidates = matchesList.filter((m) => (
      m &&
      m.id !== primaryMatch.id &&
      m.leagueId === primaryMatch.leagueId &&
      m.homeId === primaryMatch.awayId &&
      m.awayId === primaryMatch.homeId
    ));
    if (candidates.length === 0) return null;
    const sched = candidates.find((m) => m.status === 'SCHEDULED');
    if (sched) return sched;
    const pend = candidates.find((m) => m.status === 'PENDING');
    if (pend) return pend;
    return candidates[0];
  }

  function resolveMatchSubmissionPair(matchesList, selectedMatchId) {
    if (!Array.isArray(matchesList) || !selectedMatchId) return { leg1: null, leg2: null, requiresDouble: false };
    const selected = matchesList.find((m) => m && m.id === selectedMatchId);
    if (!selected) return { leg1: null, leg2: null, requiresDouble: false };
    const companion = findCompanionReturnMatch(matchesList, selected);
    if (!companion) return { leg1: selected, leg2: null, requiresDouble: false };
    const requiresDouble = Boolean(selected.status === 'SCHEDULED' && companion.status === 'SCHEDULED');
    return { leg1: selected, leg2: companion, requiresDouble };
  }

  function applySingleMatchSubmissionFields(match, { homeScore, awayScore, screenshot, submittedBy, comment, requireScreenshot, pairId, legNumber, companionMatchId }) {
    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!isValidLeagueGoalPair(hs, as, false)) {
      throw new Error('⚽ W lidze Score! Match mecz rozgrywa się do max 2 bramek (dozwolone wyniki 0–2, bez 2:2; np. 2:0, 2:1, 1:0, 1:1, 0:0). Walkowery 2:0 / 0:2 WO przyznaje wyłącznie Administrator.');
    }
    if (requireScreenshot && (!screenshot || String(screenshot).trim().length < 20)) {
      throw new Error('📸 Aby zgłosić wynik do zatwierdzenia, musisz dołączyć zrzut ekranu (SS) z końca meczu!');
    }

    const homeP = state.players.find((p) => p.id === match.homeId);
    const awayP = state.players.find((p) => p.id === match.awayId);

    if ((homeP && (homeP.isBlacklisted || homeP.banned)) || (awayP && (awayP.isBlacklisted || awayP.banned))) {
      throw new Error('⛔ Mecz zablokowany: Jeden z zawodników znajduje się na Czarnej Liście Score Match Ligi z dożywotnim banem!');
    }

    match.homeScore = hs;
    match.awayScore = as;
    match.status = 'PENDING';
    match.submittedBy = submittedBy || (homeP ? homeP.name : 'Gracz SMPL');
    match.submittedAt = nowFormatted();
    match.comment = comment || '';
    match.rejectionReason = null;
    if (pairId) match.doubleMatchPairId = pairId;
    if (legNumber) match.legNumber = legNumber;
    if (companionMatchId) match.companionMatchId = companionMatchId;

    if (screenshot) {
      match.screenshot = screenshot;
    } else if (homeP && awayP) {
      match.screenshot = window.SMPL_MEDIA.generateMatchScreenshot({
        homeName: homeP.name,
        awayName: awayP.name,
        homeNick: homeP.nick,
        awayNick: awayP.nick,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        round: match.round,
        leagueName: (state.leagues && state.leagues[match.leagueId] && state.leagues[match.leagueId].shortName) || match.leagueId || 'SMPL'
      });
    }
    return { match, homeP, awayP };
  }

  function submitMatchResult({ matchId, homeScore, awayScore, screenshot, submittedBy, comment, requireScreenshot }) {
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) throw new Error('Nie znaleziono meczu.');

    const sess = getSession();
    const effectiveIsAdmin = isStrictAdminSession(sess);
    const effectivePlayerId = sess ? sess.activePlayerId : null;

    if (!effectiveIsAdmin) {
      const mMode = getMaintenanceMode();
      if (mMode && mMode.enabled) {
        throw new Error('🚧 ' + (mMode.message || 'Trwa przerwa techniczna — wysyłanie wyników chwilowo wstrzymane.'));
      }
      if (sess.isGuest || !sess.isPlayerAuthenticated || !effectivePlayerId) {
        throw new Error('⛔ Odmowa dostępu: Musisz być zalogowany na swoje konto gracza, aby zgłosić wynik meczu.');
      }
      if (match.homeId !== effectivePlayerId && match.awayId !== effectivePlayerId) {
        throw new Error('⛔ Bezpieczeństwo SMPL: Nie masz uprawnień do zarządzania wynikiem meczu innego zawodnika!');
      }
      if (match.status === 'PENDING') {
        throw new Error('Wynik tego meczu został już zgłoszony i oczekuje na weryfikację Administratora.');
      }
      if (match.status === 'APPROVED' || match.status === 'WALKOVER') {
        throw new Error('Mecz został już rozegrany i zatwierdzony w oficjalnej tabeli.');
      }
    }

    const res = applySingleMatchSubmissionFields(match, {
      homeScore,
      awayScore,
      screenshot,
      submittedBy,
      comment,
      requireScreenshot: Boolean(requireScreenshot)
    });

    addLog(
      'MATCH_SUBMIT',
      `Zgłoszono wynik meczu Kolejki ${match.round} (${match.leagueId}): ${res.homeP ? res.homeP.name : ''} ${match.homeScore}:${match.awayScore} ${res.awayP ? res.awayP.name : ''} — oczekuje na akceptację Admina po weryfikacji SS.`
    );

    const submitTitle = `Rywal zgłosił wynik (Kol. ${match.round})`;
    const submitBody = `${match.submittedBy || 'Rywal'} wstawił wynik ${match.leagueId}: ${res.homeP ? res.homeP.name : 'Gospodarz'} ${match.homeScore}:${match.awayScore} ${res.awayP ? res.awayP.name : 'Gość'}. Czeka na zatwierdzenie Admina.`;
    [match.homeId, match.awayId].forEach((pid) => {
      if (!pid || (!effectiveIsAdmin && pid === effectivePlayerId)) return;
      pushPlayerNotification(pid, {
        idPrefix: 'NOTIF_MSUB',
        type: 'MATCH_SUBMITTED',
        icon: '📤',
        title: submitTitle,
        text: submitBody
      });
    });

    syncToBackend();
    return match;
  }

  function submitDoubleMatchResult({
    primaryMatchId,
    primaryHomeScore,
    primaryAwayScore,
    primaryScreenshot,
    returnMatchId,
    returnHomeScore,
    returnAwayScore,
    returnScreenshot,
    submittedBy,
    comment,
    requireScreenshots
  }) {
    const m1 = state.matches.find((m) => m.id === primaryMatchId);
    const m2 = state.matches.find((m) => m.id === returnMatchId);
    if (!m1 || !m2) throw new Error('Nie znaleziono obu meczów dwumeczu (U siebie + Na wyjeździe).');
    if (m1.id === m2.id || m1.leagueId !== m2.leagueId || m1.homeId !== m2.awayId || m1.awayId !== m2.homeId) {
      throw new Error('Wybrane mecze nie tworzą pary dwumeczu (1 u siebie + 1 na wyjeździe).');
    }

    const sess = getSession();
    const effectiveIsAdmin = isStrictAdminSession(sess);
    const effectivePlayerId = sess ? sess.activePlayerId : null;
    const mustRequireSS = requireScreenshots !== undefined ? Boolean(requireScreenshots) : !effectiveIsAdmin;

    if (!effectiveIsAdmin) {
      const mMode = getMaintenanceMode();
      if (mMode && mMode.enabled) {
        throw new Error('🚧 ' + (mMode.message || 'Trwa przerwa techniczna — wysyłanie wyników chwilowo wstrzymane.'));
      }
      if (sess.isGuest || !sess.isPlayerAuthenticated || !effectivePlayerId) {
        throw new Error('⛔ Odmowa dostępu: Zaloguj się na konto gracza, aby zgłosić dwumecz.');
      }
      if ((m1.homeId !== effectivePlayerId && m1.awayId !== effectivePlayerId) || (m2.homeId !== effectivePlayerId && m2.awayId !== effectivePlayerId)) {
        throw new Error('⛔ Bezpieczeństwo SMPL: Możesz zgłaszać dwumecz wyłącznie ze swoim udziałem!');
      }
      if (m1.status !== 'SCHEDULED' || m2.status !== 'SCHEDULED') {
        throw new Error('⏳ Jeden lub oba mecze tego dwumeczu zostały już zgłoszone lub zatwierdzone.');
      }
    }

    if (!isValidLeagueGoalPair(primaryHomeScore, primaryAwayScore, false) || !isValidLeagueGoalPair(returnHomeScore, returnAwayScore, false)) {
      throw new Error('⚽ W lidze Score! Match oba mecze rozgrywa się do max 2 bramek (dozwolone wyniki 0–2, bez 2:2).');
    }
    if (mustRequireSS) {
      if (!primaryScreenshot || String(primaryScreenshot).trim().length < 20) {
        throw new Error('📸 Dołącz zrzut ekranu (SS #1) z pierwszego meczu (U siebie)!');
      }
      if (!returnScreenshot || String(returnScreenshot).trim().length < 20) {
        throw new Error('📸 Dołącz zrzut ekranu (SS #2) z drugiego meczu (Na wyjeździe / Rewanż)!');
      }
    }

    const pairId = 'DM_' + Date.now() + '_' + Math.floor(Math.random() * 900 + 100);
    const r1 = applySingleMatchSubmissionFields(m1, {
      homeScore: primaryHomeScore,
      awayScore: primaryAwayScore,
      screenshot: primaryScreenshot,
      submittedBy,
      comment,
      requireScreenshot: mustRequireSS,
      pairId,
      legNumber: 1,
      companionMatchId: m2.id
    });
    applySingleMatchSubmissionFields(m2, {
      homeScore: returnHomeScore,
      awayScore: returnAwayScore,
      screenshot: returnScreenshot,
      submittedBy,
      comment,
      requireScreenshot: mustRequireSS,
      pairId,
      legNumber: 2,
      companionMatchId: m1.id
    });

    addLog(
      'MATCH_DOUBLE_SUBMIT',
      `Zgłoszono DWUMECZ (${m1.leagueId}): ${r1.homeP ? r1.homeP.name : ''} vs ${r1.awayP ? r1.awayP.name : ''} • Kol. ${m1.round}: ${m1.homeScore}:${m1.awayScore} | Kol. ${m2.round} (rewanż): ${m2.homeScore}:${m2.awayScore} (2× SS) — oczekuje na zatwierdzenie Admina.`
    );

    const dblBody = `${m1.submittedBy || 'Rywal'} wstawił dwumecz (${m1.leagueId}, Kol. ${m1.round}): ${r1.homeP ? r1.homeP.name : ''} vs ${r1.awayP ? r1.awayP.name : ''} (${m1.homeScore}:${m1.awayScore} oraz ${m2.homeScore}:${m2.awayScore}). Oczekuje na akceptację Admina.`;
    [m1.homeId, m1.awayId].forEach((pid) => {
      if (!pid || (!effectiveIsAdmin && pid === effectivePlayerId)) return;
      pushPlayerNotification(pid, {
        idPrefix: 'NOTIF_DMSUB',
        type: 'MATCH_SUBMITTED',
        icon: '📤',
        title: `Rywal wstawił dwumecz (Kol. ${m1.round})`,
        text: dblBody
      });
    });

    syncToBackend();
    return { primaryMatch: m1, returnMatch: m2, pairId };
  }

  function approveMatch(matchId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) throw new Error('Nie znaleziono meczu.');
    if (match.status !== 'WALKOVER' && (!match.screenshot || String(match.screenshot).trim().length < 20)) {
      throw new Error('📸 Nie można zatwierdzić wyniku bez otrzymanego zrzutu ekranu (SS) z meczu!');
    }

    match.status = 'APPROVED';
    match.approvedBy = adminName;
    match.approvedAt = nowFormatted();
    match.rejectionReason = null;

    const homeP = state.players.find((p) => p.id === match.homeId);
    const awayP = state.players.find((p) => p.id === match.awayId);

    addLog(
      'MATCH_APPROVE',
      `✅ Admin ${adminName} zatwierdził wynik Kolejki ${match.round} (${match.leagueId}): ${homeP ? homeP.name : ''} ${match.homeScore}:${match.awayScore} ${awayP ? awayP.name : ''}. Tabela i Czyste Konta zaktualizowane!`
    );

    const appText = `Admin ${adminName} zatwierdził wynik Kolejki ${match.round} (${match.leagueId}): ${homeP ? homeP.name : 'Gospodarz'} ${match.homeScore}:${match.awayScore} ${awayP ? awayP.name : 'Gość'}. Punkty i SMPL Coins doliczone!`;
    [match.homeId, match.awayId].forEach((pid) => {
      if (!pid) return;
      pushPlayerNotification(pid, {
        idPrefix: 'NOTIF_MAPP',
        type: 'MATCH_APPROVED',
        icon: '✅',
        title: `Admin zatwierdził wynik (Kol. ${match.round})`,
        text: appText
      });
    });

    syncToBackend();
    return match;
  }

  function approveDoubleMatch(primaryMatchId, returnMatchId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const m1 = state.matches.find((m) => m.id === primaryMatchId);
    const m2 = state.matches.find((m) => m.id === returnMatchId);
    if (!m1 || !m2) throw new Error('Nie znaleziono obu spotkań dwumeczu.');
    if (!m1.screenshot || String(m1.screenshot).trim().length < 20 || !m2.screenshot || String(m2.screenshot).trim().length < 20) {
      throw new Error('📸 Zatwierdzenie całego dwumeczu wymaga otrzymania OBU zrzutów ekranu (SS #1 i SS #2)!');
    }
    if (m1.status !== 'PENDING' || m2.status !== 'PENDING') {
      throw new Error('⏳ Oba mecze dwumeczu muszą być zgłoszone (status OCZEKUJĄCY), aby zatwierdzić je razem!');
    }

    const nowTs = nowFormatted();
    [m1, m2].forEach((m) => {
      m.status = 'APPROVED';
      m.approvedBy = adminName;
      m.approvedAt = nowTs;
      m.rejectionReason = null;
    });

    const homeP = state.players.find((p) => p.id === m1.homeId);
    const awayP = state.players.find((p) => p.id === m1.awayId);
    addLog(
      'MATCH_DOUBLE_APPROVE',
      `✅ Admin ${adminName} zweryfikował oba SS i zatwierdził cały DWUMECZ (${m1.leagueId}): ${homeP ? homeP.name : ''} vs ${awayP ? awayP.name : ''} (${m1.homeScore}:${m1.awayScore} & ${m2.homeScore}:${m2.awayScore}).`
    );

    const dblAppText = `Admin ${adminName} zatwierdził cały dwumecz (${m1.leagueId}, Kol. ${m1.round}): ${homeP ? homeP.name : ''} vs ${awayP ? awayP.name : ''} (${m1.homeScore}:${m1.awayScore} i ${m2.homeScore}:${m2.awayScore}). Tabela i Coins zaktualizowane!`;
    [m1.homeId, m1.awayId].forEach((pid) => {
      if (!pid) return;
      pushPlayerNotification(pid, {
        idPrefix: 'NOTIF_DMAPP',
        type: 'MATCH_APPROVED',
        icon: '✅',
        title: `Admin zatwierdził dwumecz (Kol. ${m1.round})`,
        text: dblAppText
      });
    });

    syncToBackend();
    return { primaryMatch: m1, returnMatch: m2 };
  }

  function editMatchByAdmin(matchId, { homeScore, awayScore, status, comment, screenshot }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) throw new Error('Nie znaleziono meczu.');

    const homeP = state.players.find((p) => p.id === match.homeId);
    const awayP = state.players.find((p) => p.id === match.awayId);
    const nextStatus = status || 'APPROVED';
    const isWoEdit = nextStatus === 'WALKOVER';
    if (nextStatus !== 'SCHEDULED' && !isValidLeagueGoalPair(homeScore, awayScore, isWoEdit)) {
      throw new Error('⚽ W lidze Score! Match mecz rozgrywa się zawsze do max 2 bramek (0–2, bez 2:2; walkowery to 2:0 / 0:2 / 0:0 WO).');
    }

    match.homeScore = Number(homeScore);
    match.awayScore = Number(awayScore);
    match.status = nextStatus;
    match.approvedBy = adminName;
    match.approvedAt = nowFormatted();
    if (!match.submittedAt) match.submittedAt = nowFormatted();
    if (!match.submittedBy) match.submittedBy = adminName;
    if (comment !== undefined) match.comment = comment;

    if (screenshot) {
      match.screenshot = screenshot;
    } else if (!match.screenshot && homeP && awayP && match.status === 'APPROVED') {
      match.screenshot = window.SMPL_MEDIA.generateMatchScreenshot({
        homeName: homeP.name,
        awayName: awayP.name,
        homeNick: homeP.nick,
        awayNick: awayP.nick,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        round: match.round,
        leagueName: (state.leagues && state.leagues[match.leagueId] && state.leagues[match.leagueId].shortName) || match.leagueId || 'SMPL'
      });
    }

    addLog(
      'ADMIN_EDIT',
      `✏️ Admin ${adminName} zaktualizował wynik meczu Kolejki ${match.round} (${match.leagueId}): ${homeP ? homeP.name : ''} ${match.homeScore}:${match.awayScore} ${awayP ? awayP.name : ''} [${match.status}].`
    );

    const editText = `Admin ${adminName} zapisał wynik Kolejki ${match.round} (${match.leagueId}): ${homeP ? homeP.name : ''} ${match.homeScore}:${match.awayScore} ${awayP ? awayP.name : ''} [${match.status}].`;
    [match.homeId, match.awayId].forEach((pid) => {
      if (!pid) return;
      pushPlayerNotification(pid, {
        idPrefix: 'NOTIF_MEDIT',
        type: match.status === 'APPROVED' ? 'MATCH_APPROVED' : 'INFO',
        icon: '✏️',
        title: `Admin zaktualizował wynik (Kol. ${match.round})`,
        text: editText
      });
    });

    syncToBackend();
    return match;
  }

  function rejectMatch(matchId, reason, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) throw new Error('Nie znaleziono meczu.');

    const homeP = state.players.find((p) => p.id === match.homeId);
    const awayP = state.players.find((p) => p.id === match.awayId);
    const oldScore = `${match.homeScore}:${match.awayScore}`;

    match.status = 'SCHEDULED';
    match.homeScore = null;
    match.awayScore = null;
    match.rejectionReason = reason || 'Brak wyraźnego screena końcowego lub błędny wynik.';
    match.rejectedBy = adminName;
    match.rejectedAt = nowFormatted();

    addLog(
      'MATCH_REJECT',
      `❌ Admin ${adminName} odrzucił zgłoszenie wyniku (${oldScore}) w meczu ${homeP ? homeP.name : ''} vs ${awayP ? awayP.name : ''}. Powód: ${match.rejectionReason}`
    );

    const rejText = `Admin ${adminName} odrzucił wynik (${oldScore}) z Kol. ${match.round}: ${match.rejectionReason}. Prześlijcie wynik ponownie z wyraźnym screenem.`;
    [match.homeId, match.awayId].forEach((pid) => {
      if (!pid) return;
      pushPlayerNotification(pid, {
        idPrefix: 'NOTIF_MREJ',
        type: 'MATCH_REJECTED',
        icon: '❌',
        title: `Odrzucono wynik meczu (Kol. ${match.round})`,
        text: rejText
      });
    });

    syncToBackend();
    return match;
  }

  function setWalkover(matchId, walkoverType, adminName = 'Szymon Komenda', customComment = '', evidenceScreenshot = '') {
    assertAdminAuthenticated();
    const match = state.matches.find((m) => m.id === matchId);
    if (!match) throw new Error('Nie znaleziono meczu.');

    const homeP = state.players.find((p) => p.id === match.homeId);
    const awayP = state.players.find((p) => p.id === match.awayId);
    const cleanNote = String(customComment || '').replace(/<[^>]*>/g, '').trim().slice(0, 280);
    const cleanEvSs = String(evidenceScreenshot || '').trim();
    if (cleanEvSs && /^data:image\//i.test(cleanEvSs)) {
      match.screenshot = cleanEvSs;
    }

    if (walkoverType === 'HOME_WIN') {
      match.homeScore = 2;
      match.awayScore = 0;
      match.comment = cleanNote || 'Walkower 2:0 WO na korzyść Gospodarza.';
    } else if (walkoverType === 'AWAY_WIN') {
      match.homeScore = 0;
      match.awayScore = 2;
      match.comment = cleanNote || 'Walkower 0:2 WO na korzyść Gościa.';
    } else {
      match.homeScore = 0;
      match.awayScore = 0;
      match.comment = cleanNote || 'Walkower obustronny 0:0 WO (brak punktów dla obu stron).';
    }

    match.status = 'WALKOVER';
    match.submittedBy = `${adminName} (Walkower)`;
    match.submittedAt = nowFormatted();
    match.approvedBy = adminName;

    addLog(
      'WALKOVER',
      `⚠️ Admin ${adminName} przyznał WALKOWER (${match.homeScore}:${match.awayScore} WO) w meczu Kolejki ${match.round}: ${homeP ? homeP.name : ''} vs ${awayP ? awayP.name : ''}.`
    );

    const woText = `Admin ${adminName} przyznał walkower (${match.homeScore}:${match.awayScore} WO) w Kol. ${match.round}: ${homeP ? homeP.name : ''} vs ${awayP ? awayP.name : ''}.${cleanNote ? ' ' + cleanNote : ''}`;
    [match.homeId, match.awayId].forEach((pid) => {
      if (!pid) return;
      pushPlayerNotification(pid, {
        idPrefix: 'NOTIF_MWO',
        type: 'WALKOVER',
        icon: '⚠️',
        title: `Walkower w Kolejce ${match.round}`,
        text: woText
      });
    });

    syncToBackend();
    return match;
  }

  // --- REJESTRACJA KONT GRACZY (LISTA OCZEKUJĄCYCH DO DOPISANIA DO LIGI PRZEZ ADMINA) ---
  function toCleanUsername(str) {
    return String(str || 'gracz')
      .toLowerCase()
      .replace(/ł/g, 'l')
      .replace(/ą/g, 'a')
      .replace(/ę/g, 'e')
      .replace(/ś/g, 's')
      .replace(/ć/g, 'c')
      .replace(/ń/g, 'n')
      .replace(/ó/g, 'o')
      .replace(/ź/g, 'z')
      .replace(/ż/g, 'z')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.|\.$/g, '');
  }

  function foldPlChars(str) {
    const map = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
    return String(str || '').trim().toLowerCase().replace(/[ąćęłńóśźż]/g, function (ch) {
      return map[ch] || ch;
    }).replace(/\s+/g, ' ').trim();
  }

  const ARCHIVE_CANON_BY_FOLD = {
    'piort pastuszak': 'Piotr Pastuszak',
    'piote pastuszak': 'Piotr Pastuszak',
    'piotr pastuszak': 'Piotr Pastuszak',
    'sebastain niezborala': 'Sebastian Niezbora\u0142a',
    'sebastian niezborala': 'Sebastian Niezbora\u0142a',
    'mak herdus': 'Maks Herdu\u015B',
    'maks herdus': 'Maks Herdu\u015B',
    'maciej maciejewski': 'Maciek Maciejewski',
    'maciek maciejewski': 'Maciek Maciejewski',
    'kuba paszkiewicz': 'Jakub Paszkiewicz',
    'jakub paszkiewicz': 'Jakub Paszkiewicz',
    'michal pelka': 'Micha\u0142 Pe\u0142ka',
    'lukasz papik': '\u0141ukasz Papik',
    'lukasz dwojak': '\u0141ukasz Dwojak',
    'lukasz jawor': '\u0141ukasz Jawor',
    'lukasz dzwirski': '\u0141ukasz D\u017Awirski',
    'janusz wojcik': 'Janusz W\u00F3jcik',
    'patryk wozniczka': 'Patryk Wo\u017Aniczka',
    'pawel kuzmicki': 'Pawe\u0142 Ku\u017Amicki',
    'pawel sokolowski': 'Pawe\u0142 Soko\u0142owski',
    'tomasz falat': 'Tomasz Fa\u0142at'
  };

  function canonicalArchiveName(rawName) {
    const clean = String(rawName || '')
      .replace(/[\uD800-\uDFFF\u2600-\u27BF\uFE0F\u200D]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return '';
    const fk = foldPlChars(clean);
    return ARCHIVE_CANON_BY_FOLD[fk] || clean;
  }

  function canonicalArchiveFold(rawName) {
    return foldPlChars(canonicalArchiveName(rawName));
  }

  const POS_PTS_L1 = [0, 30, 24, 18, 15, 14, 12, 11, 10, 9, 8, 7, 7, 6, 0, 0, 0];

  function isIgnoredArchiveName(name) {
    const clean = String(name || '').trim();
    if (!clean || clean === '-' || clean === '—' || clean === '...') return true;
    if (/^wolny\s*los|^wl\d+$|brak danych/i.test(clean)) return true;
    return false;
  }

  function formatArchiveBestPos(posNum, lid, l1Only) {
    if (!posNum || posNum >= 999) return l1Only ? '#1\u2013#16 SMPL' : 'Uczestnik SMPL';
    if (l1Only) {
      if (posNum === 1) return 'Z\u0142oto \uD83D\uDC51';
      if (posNum === 2) return 'Srebro \uD83E\uDD48';
      if (posNum === 3) return 'Br\u0105z \uD83E\uDD49';
      return '#' + posNum;
    }
    const suffix = lid ? ' (' + lid + ')' : '';
    if (posNum === 1) return 'Z\u0142oto \uD83D\uDC51' + suffix;
    if (posNum === 2) return 'Srebro \uD83E\uDD48' + suffix;
    if (posNum === 3) return 'Br\u0105z \uD83E\uDD49' + suffix;
    return '#' + posNum + suffix;
  }

  function computeArchiveRankingFromSeasons(seasonsList, minSeason, maxSeason, l1Only) {
    const aggMap = {};
    const plRegex = /[\u0105\u0107\u0119\u0142\u0144\u00F3\u015B\u017A\u017C\u0104\u0106\u0118\u0141\u0143\u00D3\u015A\u0179\u017B]/;
    (seasonsList || []).forEach(function (s) {
      if (!s || !s.leagues) return;
      if (s.inProgress === true || /w\s+trakcie|przedsezon|p[o\u00F3][l\u0142]metek/i.test(String(s.yearLabel || ''))) return;
      const sn = Number(s.seasonNumber || 0);
      if (minSeason && sn < minSeason) return;
      if (maxSeason && sn > maxSeason) return;
      Object.keys(s.leagues).forEach(function (lid) {
        if (l1Only && lid !== 'L1') return;
        const rows = s.leagues[lid] || [];
        const tw = getLeagueNumber(lid);
        rows.forEach(function (r) {
          const canon = canonicalArchiveName(r && r.name);
          if (isIgnoredArchiveName(canon)) return;
          const m = Number(r.M || 0);
          if (m <= 0) return;
          const fk = foldPlChars(canon);
          if (!aggMap[fk]) {
            aggMap[fk] = {
              foldKey: fk,
              name: canon,
              seenSeasons: {},
              seasons: 0,
              matches: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              gf: 0,
              ga: 0,
              points: 0,
              posPts: 0,
              gold: 0,
              silver: 0,
              bronze: 0,
              bestTier: 99,
              bestPosNum: 999,
              bestLid: lid,
              l1Seasons: 0,
              l1Points: 0,
              l1BestPos: 999,
              seasonNumbers: []
            };
          }
          const a = aggMap[fk];
          if (plRegex.test(canon) && !plRegex.test(a.name)) {
            a.name = canon;
          }
          const sKey = sn + '_' + lid;
          if (!a.seenSeasons[sKey]) {
            a.seenSeasons[sKey] = true;
            a.seasons += 1;
            if (a.seasonNumbers.indexOf(sn) === -1) a.seasonNumbers.push(sn);
            a.matches += m;
            a.wins += Number(r.W || 0);
            a.draws += Number(r.R || 0);
            a.losses += Number(r.P || 0);
            a.gf += Number(r.BZ || 0);
            a.ga += Number(r.BS || 0);
            const pkt = Number(r.PKT || 0);
            a.points += pkt;
            const posNum = Number(r.pos || 99);
            if (posNum === 1) a.gold += 1;
            else if (posNum === 2) a.silver += 1;
            else if (posNum === 3) a.bronze += 1;
            if (tw < a.bestTier || (tw === a.bestTier && posNum > 0 && posNum < a.bestPosNum)) {
              a.bestTier = tw;
              a.bestPosNum = posNum;
              a.bestLid = lid;
            }
            if (lid === 'L1') {
              a.posPts += (posNum >= 1 && posNum <= 16 ? (POS_PTS_L1[posNum] || 0) : 0);
              a.l1Seasons += 1;
              a.l1Points += pkt;
              if (posNum > 0 && posNum < a.l1BestPos) a.l1BestPos = posNum;
            } else {
              if (posNum === 1) a.posPts += 20;
              else if (posNum === 2) a.posPts += 12;
              else if (posNum === 3) a.posPts += 8;
            }
          }
        });
      });
    });

    const list = Object.keys(aggMap).map(function (fk) {
      const a = aggMap[fk];
      const gd = a.gf - a.ga;
      const total = a.points + a.posPts;
      const winPct = a.matches > 0 ? Number(((a.wins / a.matches) * 100).toFixed(1)) : 0;
      const out = {
        foldKey: fk,
        name: a.name,
        bestPos: formatArchiveBestPos(a.bestPosNum, a.bestLid, l1Only),
        matches: a.matches,
        wins: a.wins,
        draws: a.draws,
        losses: a.losses,
        gf: a.gf,
        ga: a.ga,
        gd: gd,
        winPct: winPct,
        points: a.points,
        pts: a.points,
        posPts: a.posPts,
        total: total,
        seasons: a.seasons,
        medals: a.gold + a.silver + a.bronze,
        gold: a.gold,
        silver: a.silver,
        bronze: a.bronze,
        seasonNumbers: a.seasonNumbers.slice().sort(function (x, y) { return x - y; })
      };
      if (!l1Only) {
        out.l1Seasons = a.l1Seasons;
        out.l1Points = a.l1Points;
        out.l1BestPos = a.l1BestPos < 999 ? '#' + a.l1BestPos : null;
      }
      return out;
    });

    list.sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      if (b.points !== a.points) return b.points - a.points;
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return String(a.name).localeCompare(String(b.name), 'pl');
    });

    list.forEach(function (item, idx) {
      item.rank = idx + 1;
      item.pos = idx + 1;
    });
    return list;
  }

  let __histCatalogCacheKey = '';
  let __histCatalogCache = null;

  function getHistoricalPlayersCatalog(customState) {
    const st = customState || state || {};
    const useCache = !customState || customState === state;
    const allTimeList = st.allTimeRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.ALL_TIME_RANKING) || [];
    const careerList = st.careerRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.CAREER_RANKING) || [];
    const generalList = st.generalRanking || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.GENERAL_RANKING) || [];
    const seasonsList = st.historicalSeasons || (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.HISTORICAL_SEASONS) || [];

    const cacheKey = [
      allTimeList.length,
      careerList.length,
      generalList.length,
      seasonsList.length,
      st.archiveRecalcVersion || '',
      st.season || 56
    ].join('|');
    if (useCache && __histCatalogCache && __histCatalogCacheKey === cacheKey) {
      return __histCatalogCache;
    }

    const allTimeByFold = {};
    allTimeList.forEach(function (a) {
      if (!a || isIgnoredArchiveName(a.name)) return;
      const canon = canonicalArchiveName(a.name);
      const fk = foldPlChars(canon);
      allTimeByFold[fk] = Object.assign({}, a, { name: canon });
    });

    const computedCareer = seasonsList.length > 0
      ? computeArchiveRankingFromSeasons(seasonsList, 0, 9999, false)
      : careerList.map(function (c, idx) {
          return Object.assign({}, c, {
            name: canonicalArchiveName(c.name),
            foldKey: canonicalArchiveFold(c.name),
            rank: c.rank || idx + 1,
            seasonNumbers: c.seasonNumbers || []
          });
        });

    const catalogByFold = {};

    computedCareer.forEach(function (c) {
      const fk = c.foldKey || canonicalArchiveFold(c.name);
      if (!fk || c.matches <= 0) return;
      const atMatch = allTimeByFold[fk] || null;
      const careerRank = Number(c.rank || c.pos || 0);
      const entry = {
        name: c.name,
        rank: atMatch ? (atMatch.rank || atMatch.pos || '-') : (careerRank > 0 ? careerRank + ' (L1\u2013L9)' : '-'),
        careerRank: careerRank || null,
        seasons: Number(c.seasons || 1),
        matches: Number(c.matches || 0),
        wins: Number(c.wins || 0),
        draws: Number(c.draws || 0),
        losses: Number(c.losses || 0),
        gf: Number(c.gf || 0),
        ga: Number(c.ga || 0),
        gd: Number(c.gd !== undefined ? c.gd : Number(c.gf || 0) - Number(c.ga || 0)),
        winPct: Number(c.winPct || 0),
        points: Number(c.points || c.pts || 0),
        posPts: Number(c.posPts || 0),
        total: Number(c.total || c.points || 0),
        gold: Number(c.gold || 0),
        silver: Number(c.silver || 0),
        bronze: Number(c.bronze || 0),
        medals: Number(c.gold || 0) + Number(c.silver || 0) + Number(c.bronze || 0),
        bestPos: c.bestPos || 'Uczestnik SMPL',
        l1Stats: atMatch
          ? {
              rank: atMatch.rank || atMatch.pos || '-',
              seasons: Number(atMatch.seasons || 0),
              matches: Number(atMatch.matches || 0),
              points: Number(atMatch.points || atMatch.pts || 0),
              total: Number(atMatch.total || 0),
              gold: Number(atMatch.gold || 0),
              silver: Number(atMatch.silver || 0),
              bronze: Number(atMatch.bronze || 0),
              bestPos: atMatch.bestPos || ''
            }
          : null,
        inAllTime: Boolean(atMatch),
        seasonNumbers: Array.isArray(c.seasonNumbers) ? c.seasonNumbers.slice() : []
      };
      catalogByFold[fk] = entry;
    });

    allTimeList.forEach(function (a) {
      if (!a || isIgnoredArchiveName(a.name)) return;
      const canon = canonicalArchiveName(a.name);
      const fk = foldPlChars(canon);
      if (catalogByFold[fk]) return;
      catalogByFold[fk] = {
        name: canon,
        rank: a.rank || a.pos || '-',
        careerRank: a.rank || a.pos || null,
        seasons: Number(a.seasons || 1),
        matches: Number(a.matches || 0),
        wins: Number(a.wins || 0),
        draws: Number(a.draws || 0),
        losses: Number(a.losses || 0),
        gf: Number(a.gf || 0),
        ga: Number(a.ga || 0),
        gd: Number(a.gd !== undefined ? a.gd : Number(a.gf || 0) - Number(a.ga || 0)),
        winPct: Number(a.winPct || 0),
        points: Number(a.points || a.pts || 0),
        posPts: Number(a.posPts || 0),
        total: Number(a.total || a.points || 0),
        gold: Number(a.gold || 0),
        silver: Number(a.silver || 0),
        bronze: Number(a.bronze || 0),
        medals: Number(a.gold || 0) + Number(a.silver || 0) + Number(a.bronze || 0),
        bestPos: a.bestPos || '#1\u2013#16 SMPL',
        inAllTime: true,
        seasonNumbers: []
      };
    });

    generalList.forEach(function (g) {
      if (!g || isIgnoredArchiveName(g.name)) return;
      const canon = canonicalArchiveName(g.name);
      const fk = foldPlChars(canon);
      if (catalogByFold[fk]) return;
      catalogByFold[fk] = {
        name: canon,
        rank: '-',
        careerRank: null,
        seasons: 1,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        winPct: 0,
        points: 0,
        posPts: 0,
        total: 0,
        generalScore: Number(g.totalScore || 0),
        gold: 0,
        silver: 0,
        bronze: 0,
        medals: 0,
        bestPos: 'Ranking Generalny #' + (g.rank || g.pos || '-'),
        inAllTime: false,
        seasonNumbers: []
      };
    });

    const list = Object.keys(catalogByFold).map(function (fk) {
      return catalogByFold[fk];
    });
    list.sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), 'pl');
    });

    if (useCache) {
      __histCatalogCacheKey = cacheKey;
      __histCatalogCache = list;
    }
    return list;
  }

  function findArchiveEntryByName(archiveName, customState) {
    const canon = canonicalArchiveName(archiveName);
    if (!canon) return null;
    const clean = canon.toLowerCase();
    const folded = foldPlChars(canon);
    const catalog = getHistoricalPlayersCatalog(customState);
    const exact = catalog.find(function (a) {
      return a.name.toLowerCase() === clean;
    });
    if (exact) return exact;
    return catalog.find(function (a) {
      return foldPlChars(a.name) === folded;
    }) || null;
  }

  function rollbackOptimisticRegistration(regId, createdClanId) {
    if (!state) return;
    if (Array.isArray(state.registrations)) {
      state.registrations = state.registrations.filter(function (r) { return !r || r.id !== regId; });
    }
    if (createdClanId && Array.isArray(state.clans)) {
      const usedElsewhere = (state.players || []).some(function (p) { return p && p.clanId === createdClanId; }) ||
        (state.registrations || []).some(function (r) { return r && r.clanId === createdClanId; });
      if (!usedElsewhere) {
        state.clans = state.clans.filter(function (c) { return !c || c.id !== createdClanId; });
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function sendPlayerRegistrationToServer(wirePayload, regId, createdClanId, onServerResult) {
    if (!isHttpProtocol()) return;
    const baseEp = activeApiEndpoint === './api/state' ? './api/state' : './api.php';
    const altEp = baseEp === './api.php' ? './api/state' : './api.php';
    const bodyStr = JSON.stringify(wirePayload);

    function postTo(ep) {
      return fetch(ep + '?action=player_register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr
      });
    }

    function handleResponse(res, canFallback) {
      if (!res) {
        backendOnline = false;
        if (typeof onServerResult === 'function') onServerResult(null, { offline: true, registration: wirePayload });
        return Promise.resolve();
      }
      if (canFallback && (res.status === 404 || res.status === 405 || res.status === 501)) {
        return postTo(altEp).then(function (r2) { return handleResponse(r2, false); });
      }
      return res.json()
        .catch(function () { return null; })
        .then(function (data) {
          if (res.ok && data && data.ok) {
            backendOnline = true;
            if (data.state && Array.isArray(data.state.players)) {
              captureServerArchiveSnapshot(data.state);
state = enrichFromArchive(data.state);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
              } catch (e) {}
            }
            if (typeof onServerResult === 'function') onServerResult(null, data);
            return;
          }
          const errMsg = (data && data.error) ? String(data.error) : ('Błąd serwera HTTP ' + res.status);
          rollbackOptimisticRegistration(regId, createdClanId);
          if (res.status === 401 || res.status === 403 || res.status === 400) {
            pullFromServer();
          }
          if (typeof onServerResult === 'function') onServerResult(errMsg, { status: res.status, rejected: true, data: data });
        });
    }

    postTo(baseEp)
      .then(function (res) { return handleResponse(res, true); })
      .catch(function () {
        return postTo(altEp)
          .then(function (r2) { return handleResponse(r2, false); })
          .catch(function () {
            backendOnline = false;
            if (typeof onServerResult === 'function') onServerResult(null, { offline: true, registration: wirePayload });
          });
      });
  }

  function submitRegistration({
    name,
    nick,
    username,
    fbLink,
    preference,
    preferredLeague,
    password,
    avatar,
    bio,
    notes,
    playedBefore,
    linkedHistoricalName,
    clanId,
    newClanName,
    newClanTag,
    newClanColor,
    newClanLogo,
    acceptedRules,
    acceptedLegalGDPR,
    onServerResult
  }) {
    if (acceptedRules === false) {
      throw new Error('Musisz zaakceptować Regulamin Rozgrywek SMPL (SMPL-REG-2026.1).');
    }
    if (acceptedLegalGDPR === false) {
      throw new Error('Musisz zaakceptować Klauzulę Prawną, RODO oraz potwierdzić wymóg wieku 16+ (lub zgodę opiekuna).');
    }
    const cleanName = String(name || '').trim();
    const cleanNick = String(nick || '').trim();
    const cleanFb = String(fbLink || '').trim();
    if (cleanName.length < 2) {
      throw new Error('Podaj imię i nazwisko lub pseudonim (minimum 2 znaki).');
    }
    if (cleanNick.length < 2) {
      throw new Error('Podaj swój nick w grze Score! Match (minimum 2 znaki).');
    }
    if (cleanFb.length < 3) {
      throw new Error('Podaj kontakt Facebook / Messenger.');
    }

    const idx = state.players.length + state.registrations.length + 10;
    const finalAvatar = avatar || window.SMPL_MEDIA.generatePlayerAvatar(cleanName, cleanNick, idx);

    // Sprawdzenie czy kandydat nie jest na Czarnej Liście
    const blCheck = (state.blacklist || []).some(function (b) {
      return (b.name && cleanName && b.name.toLowerCase() === cleanName.toLowerCase()) ||
             (b.nick && cleanNick && b.nick.toLowerCase() === cleanNick.toLowerCase());
    });
    if (blCheck) {
      throw new Error('⛔ ODRAZU ODRZUCONO: Twoje dane widnieją na Czarnej Liście Score Match Ligi z dożywotnim zakazem gry!');
    }

    const cleanLogin = username ? username.trim().toLowerCase() : toCleanUsername(cleanName);
    const cleanPass = String(password || '').trim();
    if (!cleanPass || cleanPass.length < 4) {
      throw new Error('Hasło musi mieć co najmniej 4 znaki.');
    }

    const prevClanIdsMap = {};
    ensureClansStructure(state);
    (state.clans || []).forEach(function (c) { if (c && c.id) prevClanIdsMap[c.id] = true; });

    const clanInfo = resolvePlayerClanPayload({
      clanId: clanId,
      newClanName: newClanName,
      newClanTag: newClanTag,
      newClanColor: newClanColor,
      newClanLogo: newClanLogo,
      createdBy: cleanName || 'Gracz SMPL'
    });
    const createdNewClanId = clanInfo.clanId && !prevClanIdsMap[clanInfo.clanId] ? clanInfo.clanId : null;

    const hasPlayedBefore = Boolean(playedBefore);
    const cleanLinkedName = hasPlayedBefore && linkedHistoricalName ? String(linkedHistoricalName).trim() : '';
    const passHash = hashSecret(cleanPass);
    const cleanBio = sanitizeProfileBio(bio || '');
    const cleanNotes = notes || 'Konto założone przez gracza — oczekuje na dopisanie do wybranej ligi przez Administrację.';

    const newReg = {
      id: 'REG_S55_' + Date.now(),
      name: cleanName,
      nick: cleanNick,
      username: cleanLogin,
      fbLink: cleanFb,
      preference: preference || 'Chce dołączyć do: 2. Liga (L2)',
      preferredLeague: preferredLeague || 'L2',
      passwordHash: passHash,
      acceptedRules: true,
      acceptedLegalGDPR: true,
      acceptedRulesVersion: 'SMPL-REG-2026.1',
      acceptedAt: nowFormatted(),
      status: 'PENDING',
      submittedAt: nowFormatted(),
      notes: cleanNotes,
      avatar: finalAvatar,
      bio: cleanBio,
      playedBefore: hasPlayedBefore,
      linkedHistoricalName: cleanLinkedName,
      clanId: clanInfo.clanId,
      clanName: clanInfo.clanName,
      clanTag: clanInfo.clanTag,
      clanLogo: clanInfo.clanLogo
    };

    state.registrations.unshift(newReg);
    const clanLogLabel = clanInfo.clanName ? ` [klan: ${clanInfo.clanName}${clanInfo.clanTag ? ' [' + clanInfo.clanTag + ']' : ''}]` : '';
    addLog(
      'REGISTRATION',
      `📝 Gracz ${newReg.name} (@${newReg.nick}, login: ${newReg.username}) założył konto i trafił na Listę do Dopisania do Ligi (${newReg.preference})${clanLogLabel}${cleanLinkedName ? ` [historia S1–S55: ${cleanLinkedName}]` : ''}.`
    );

    if (isHttpProtocol()) {
      state.updatedAt = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
      const wirePayload = {
        id: newReg.id,
        name: newReg.name,
        nick: newReg.nick,
        username: newReg.username,
        fbLink: newReg.fbLink,
        preference: newReg.preference,
        preferredLeague: newReg.preferredLeague,
        passwordHash: passHash,
        acceptedRules: true,
        acceptedLegalGDPR: true,
        acceptedRulesVersion: newReg.acceptedRulesVersion,
        avatar: finalAvatar,
        bio: cleanBio,
        notes: cleanNotes,
        playedBefore: hasPlayedBefore,
        linkedHistoricalName: cleanLinkedName,
        clanId: clanId || clanInfo.clanId || '',
        clanName: clanInfo.clanName || '',
        clanTag: clanInfo.clanTag || '',
        newClanName: newClanName || '',
        newClanTag: newClanTag || '',
        newClanColor: newClanColor || '#10B981',
        newClanLogo: newClanLogo || ''
      };
      sendPlayerRegistrationToServer(wirePayload, newReg.id, createdNewClanId, onServerResult);
    } else {
      syncToBackend();
    }
    return newReg;
  }

  function assignHistoricalStatsToPlayer(playerId, payload, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const player = (state.players || []).find((p) => p.id === playerId);
    if (!player) throw new Error('Nie znaleziono gracza.');

    const archiveTrophiesMap = (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.PLAYER_TROPHIES_MAP) || {};

    let statsObj = null;
    let sourceLabel = '';
    let matchedArchiveEntry = null;

    if (payload && payload.archiveName && payload.archiveName !== 'NONE') {
      const foundArch = findArchiveEntryByName(payload.archiveName);
      if (foundArch) {
        matchedArchiveEntry = foundArch;
        statsObj = JSON.parse(JSON.stringify(foundArch));
        player.historicalArchiveName = foundArch.name;
        player.playedBefore = true;
        sourceLabel = `Archiwum S1–S55 (${foundArch.name}: ${foundArch.seasons} sez., ${foundArch.matches}M, ${foundArch.total} pkt)`;

        if (!player.trophies) player.trophies = [];
        const mappedTr = archiveTrophiesMap[foundArch.name];
        if (mappedTr && Array.isArray(mappedTr)) {
          mappedTr.forEach((mt) => {
            if (!player.trophies.some((existing) => existing.title === mt.title && existing.season === mt.season)) {
              player.trophies.unshift(JSON.parse(JSON.stringify(mt)));
            }
          });
        }
      }
    } else if (payload && payload.preset) {
      if (payload.preset === 'CHAMPION_PAST') {
        statsObj = {
          rank: '-',
          name: player.name,
          seasons: 8,
          matches: 240,
          wins: 145,
          draws: 35,
          losses: 60,
          gf: 420,
          ga: 230,
          gd: 190,
          winPct: 60.4,
          points: 470,
          gold: 2,
          silver: 2,
          bronze: 1,
          bestPos: '👑 #1 Mistrz SMPL',
          total: 580
        };
        sourceLabel = 'Pakiet: Były Mistrz / Legenda (8 sezonów, 2x 👑 Złoto, 580 pkt All-Time)';
      } else if (payload.preset === 'VETERAN_5S') {
        statsObj = {
          rank: '-',
          name: player.name,
          seasons: 5,
          matches: 150,
          wins: 78,
          draws: 24,
          losses: 48,
          gf: 245,
          ga: 180,
          gd: 65,
          winPct: 52.0,
          points: 258,
          gold: 0,
          silver: 1,
          bronze: 1,
          bestPos: '🥈 #2 Wicemistrz',
          total: 295
        };
        sourceLabel = 'Pakiet: Doświadczony Weteran (5 sezonów, 150 meczów, 🥈+🥉)';
      } else if (payload.preset === 'VETERAN_2S') {
        statsObj = {
          rank: '-',
          name: player.name,
          seasons: 2,
          matches: 60,
          wins: 29,
          draws: 11,
          losses: 20,
          gf: 96,
          ga: 78,
          gd: 18,
          winPct: 48.3,
          points: 98,
          gold: 0,
          silver: 0,
          bronze: 1,
          bestPos: '🥉 #3 Podium',
          total: 110
        };
        sourceLabel = 'Pakiet: Gracz z poprzednich lat (2 sezony, 60 meczów, 🥉)';
      } else if (payload.preset === 'DEBUT_S55') {
        delete player.historicalArchiveName;
        player.playedBefore = false;
        statsObj = {
          rank: '-',
          name: player.name,
          seasons: 1,
          matches: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          winPct: 0,
          points: 0,
          gold: 0,
          silver: 0,
          bronze: 0,
          bestPos: 'Debiutant w Lidze',
          total: 0
        };
        sourceLabel = 'Debiutant w Lidze (Czysta karta historyczna)';
      }
    } else if (payload && payload.custom) {
      const c = payload.custom;
      const m = Math.max(0, Number(c.matches || 0));
      const w = Math.max(0, Number(c.wins || 0));
      const d = Math.max(0, Number(c.draws || 0));
      const l = Math.max(0, Number(c.losses || 0));
      const gf = Math.max(0, Number(c.gf || 0));
      const ga = Math.max(0, Number(c.ga || 0));
      const pts = Number(c.points !== undefined ? c.points : w * 3 + d);
      const gold = Math.max(0, Number(c.gold || 0));
      const silver = Math.max(0, Number(c.silver || 0));
      const bronze = Math.max(0, Number(c.bronze || 0));
      const total = Number(c.total !== undefined && c.total !== '' ? c.total : pts + gold * 30 + silver * 20 + bronze * 10);

      statsObj = {
        rank: '-',
        name: player.name,
        seasons: Math.max(1, Number(c.seasons || 1)),
        matches: m,
        wins: w,
        draws: d,
        losses: l,
        gf: gf,
        ga: ga,
        gd: gf - ga,
        winPct: m > 0 ? Number(((w / m) * 100).toFixed(1)) : 0,
        points: pts,
        gold: gold,
        silver: silver,
        bronze: bronze,
        bestPos: c.bestPos || (gold > 0 ? '👑 #1 Mistrz' : silver > 0 ? '🥈 #2 Wicemistrz' : '#1–#10 SMPL'),
        total: total
      };
      sourceLabel = `Statystyki z poprzednich lat (${statsObj.seasons} sez., ${statsObj.matches} meczów, ${statsObj.total} pkt All-Time)`;
    }

    if (!statsObj) {
      throw new Error('Wybierz profil historyczny lub pakiet statystyk do dopisania.');
    }

    player.historicalStats = statsObj;

    // Odśwież automatyczne medale z archiwum (bez duplikatów przy zmianie przypisania)
    if (!player.trophies) player.trophies = [];
    player.trophies = player.trophies.filter(function (t) {
      return !(t && t.id && String(t.id).indexOf('TR_HIST_') === 0);
    });
    if (statsObj.gold > 0) {
      player.trophies.unshift({
        id: 'TR_HIST_GOLD_' + Date.now(),
        icon: '👑',
        title: `${statsObj.gold}x Mistrz Score Match Liga (Archiwum S1–S55)`,
        season: `Sezony 1–55 (${statsObj.seasons} sez.)`,
        rarity: 'LEGENDARY'
      });
    }
    if (statsObj.silver > 0) {
      player.trophies.unshift({
        id: 'TR_HIST_SILVER_' + Date.now(),
        icon: '🥈',
        title: `${statsObj.silver}x Wicemistrz Score Match Liga (Archiwum S1–S55)`,
        season: `Sezony 1–55`,
        rarity: 'GOLD'
      });
    }
    if (statsObj.bronze > 0) {
      player.trophies.unshift({
        id: 'TR_HIST_BRONZE_' + Date.now(),
        icon: '🥉',
        title: `${statsObj.bronze}x Brązowy Medalista Score Match Liga (Archiwum S1–S55)`,
        season: `Sezony 1–55`,
        rarity: 'SILVER'
      });
    }

    // Zaktualizuj Ranking Pełnej Kariery (L1–L9) bez zaśmiecania Ekstraklasy All-Time graczami z niższych lig
    if (!state.careerRanking) state.careerRanking = [];
    if (statsObj.total > 0 || statsObj.matches > 0) {
      const lookupName = (matchedArchiveEntry && matchedArchiveEntry.name) || player.name;
      const existingCareerIdx = state.careerRanking.findIndex(
        (a) => canonicalArchiveFold(a.name) === canonicalArchiveFold(lookupName) || canonicalArchiveFold(a.name) === canonicalArchiveFold(player.name)
      );
      const careerRow = Object.assign({}, statsObj, { name: lookupName });
      if (existingCareerIdx >= 0) {
        state.careerRanking[existingCareerIdx] = careerRow;
      } else {
        state.careerRanking.push(careerRow);
      }
      state.careerRanking.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
      state.careerRanking.forEach((item, idx) => {
        item.rank = idx + 1;
        item.pos = idx + 1;
        if (canonicalArchiveFold(item.name) === canonicalArchiveFold(lookupName)) {
          statsObj.careerRank = item.rank;
          if (!(matchedArchiveEntry && matchedArchiveEntry.inAllTime)) {
            statsObj.rank = item.rank + ' (L1\u2013L9)';
          }
        }
      });
    }
    __histCatalogCacheKey = '';
    __histCatalogCache = null;

    if (!player.notifications) player.notifications = [];
    player.notifications.unshift({
      id: 'NOTIF_HIST_' + Date.now(),
      time: nowFormatted(),
      text: `🏛️ Admin ${adminName} dopisał do Twojego konta i profilu historię S1–S55: ${sourceLabel}!`
    });

    addLog(
      'HISTORICAL_STATS_ASSIGN',
      `🏛️ Admin ${adminName} jednym kliknięciem dopisał graczowi ${player.name} historię S1–S55: ${sourceLabel}.`
    );

    if (!(payload && payload._skipSync)) {
      syncToBackend();
    }
    return { player, historicalStats: statsObj, sourceLabel };
  }

  function assignRegistration(regId, targetLeagueId, adminName = 'Szymon Komenda', historicalOption = null) {
    assertAdminAuthenticated();
    const reg = state.registrations.find((r) => r.id === regId);
    if (!reg) throw new Error('Nie znaleziono zgłoszenia na liście oczekujących.');

    reg.status = 'ASSIGNED';
    reg.assignedLeague = targetLeagueId;
    reg.reviewedBy = adminName;
    reg.reviewedAt = nowFormatted();
    ensureSingleLeagueExists(state, targetLeagueId, true);

    const linkedHistName = reg.playedBefore && reg.linkedHistoricalName ? String(reg.linkedHistoricalName).trim() : '';
    const archiveMap = (window.SMPL_ARCHIVE_DATA && window.SMPL_ARCHIVE_DATA.PLAYER_TROPHIES_MAP) || {};
    const rawArchiveTrophies =
      (linkedHistName && archiveMap[linkedHistName]) || archiveMap[reg.name] || null;
    const existingTrophies = rawArchiveTrophies ? JSON.parse(JSON.stringify(rawArchiveTrophies)) : [];
    existingTrophies.push({
      id: 'tr_join_' + Date.now(),
      icon: '🚀',
      title: 'Oficjalnie Dopisany do ' + (state.leagues[targetLeagueId].name || targetLeagueId),
      season: 'Sezon ' + (state.season || 56),
      rarity: 'GOLD'
    });

    const leagueName = state.leagues[targetLeagueId].name || targetLeagueId;

    // Najpierw sprawdź, czy konto gracza już istnieje w state.players (np. w Puli POOL) — reaktywuj bez duplikatu!
    const regUserLow = String(reg.username || '').trim().toLowerCase();
    const regNickLow = String(reg.nick || '').trim().toLowerCase();
    const existingPlayer = (state.players || []).find(
      (p) =>
        p &&
        !p.isPlaceholder &&
        !p.gdprDeleted &&
        ((reg.assignedPlayerId && p.id === reg.assignedPlayerId) ||
          (regUserLow && p.username && String(p.username).trim().toLowerCase() === regUserLow) ||
          (regNickLow && p.nick && String(p.nick).trim().toLowerCase() === regNickLow))
    );

    // Sprawdzamy, czy w wybranej lidze (np. L2 lub L3 z arkusza Excel) jest wolne miejsce "WOLNY LOS"
    // Jeśli tak — podmieniamy ten slot w miejscu (zachowując jego ID i miejsce w terminarzu 30 kolejek!)
    const placeholderSlot = !existingPlayer
      ? (state.players || []).find(
          (p) =>
            p.leagueId === targetLeagueId &&
            p.active !== false &&
            (p.isPlaceholder === true || /^wolny los/i.test(p.name || ''))
        )
      : null;

    let targetPlayer = null;
    let replacedSlotLabel = null;

    if (existingPlayer) {
      existingPlayer.leagueId = targetLeagueId;
      existingPlayer.active = true;
      existingPlayer.leftLeagueAt = null;
      existingPlayer.excelOrder = (state.players || []).filter(
        (p) => p && p.leagueId === targetLeagueId && p.active !== false && !p.isPlaceholder
      ).length;
      if (!existingPlayer.username && reg.username) existingPlayer.username = reg.username;
      if (!existingPlayer.passwordHash && reg.passwordHash) {
        existingPlayer.passwordHash = String(reg.passwordHash).indexOf('smplh1$') === 0
          ? reg.passwordHash
          : hashSecret(reg.passwordHash);
      }
      if (!existingPlayer.fb && reg.fbLink) existingPlayer.fb = reg.fbLink;
      if (!existingPlayer.fbLink && reg.fbLink) existingPlayer.fbLink = reg.fbLink;
      if (!existingPlayer.avatar && reg.avatar) existingPlayer.avatar = reg.avatar;
      if (!existingPlayer.bio && reg.bio) existingPlayer.bio = sanitizeProfileBio(reg.bio);
      if (linkedHistName && !existingPlayer.historicalArchiveName) {
        existingPlayer.historicalArchiveName = linkedHistName;
        existingPlayer.playedBefore = true;
      }
      if (!Array.isArray(existingPlayer.trophies) || existingPlayer.trophies.length === 0) {
        existingPlayer.trophies = existingTrophies;
      }
      if (!Array.isArray(existingPlayer.notifications)) existingPlayer.notifications = [];
      existingPlayer.notifications.unshift({
        id: 'NOTIF_ASSIGN_' + Date.now(),
        time: nowFormatted(),
        text: `🎉 Administrator ${adminName} przywrócił / dopisał Twoje konto do ligi: ${leagueName}!`
      });
      targetPlayer = existingPlayer;
    } else if (placeholderSlot) {
      replacedSlotLabel = placeholderSlot.name;
      placeholderSlot.name = reg.name;
      placeholderSlot.nick = reg.nick;
      placeholderSlot.username = reg.username || toCleanUsername(reg.name);
      placeholderSlot.passwordHash = reg.passwordHash && String(reg.passwordHash).indexOf('smplh1$') === 0
        ? reg.passwordHash
        : hashSecret(reg.passwordHash || ('SMPL' + Math.floor(1000 + Math.random() * 9000)));
      delete placeholderSlot.password;
      delete placeholderSlot.squadScreenshot;
      placeholderSlot.fb = reg.fbLink;
      placeholderSlot.fbLink = reg.fbLink;
      placeholderSlot.playedBefore = Boolean(reg.playedBefore);
      if (linkedHistName) placeholderSlot.historicalArchiveName = linkedHistName;
      placeholderSlot.clanId = reg.clanId || null;
      placeholderSlot.clanName = reg.clanName || '';
      placeholderSlot.clanTag = reg.clanTag || '';
      placeholderSlot.clanLogo = reg.clanLogo || null;
      placeholderSlot.isPlaceholder = false;
      placeholderSlot.replacedPlaceholderName = replacedSlotLabel;
      placeholderSlot.avatar =
        reg.avatar ||
        window.SMPL_MEDIA.generatePlayerAvatar(reg.name, reg.nick, placeholderSlot.excelOrder || 10);
      placeholderSlot.bio = sanitizeProfileBio(reg.bio || '');
      placeholderSlot.penaltyPoints = 0;
      placeholderSlot.penaltyReason = '';
      placeholderSlot.joinedSeason = 56;
      placeholderSlot.active = true;
      placeholderSlot.trophies = existingTrophies;
      placeholderSlot.notifications = [
        {
          id: 'NOTIF_ASSIGN_' + Date.now(),
          time: nowFormatted(),
          text: `🎉 Administrator ${adminName} dopisał Twoje konto do ligi: ${leagueName}${replacedSlotLabel ? ` (w miejsce: ${replacedSlotLabel} — przejmujesz pełny terminarz!)` : ''}!`
        }
      ];
      syncByeMatchesForSlot(placeholderSlot, true);
      targetPlayer = placeholderSlot;
    } else {
      const leaguePlayersCount = (state.players || []).filter((p) => p.leagueId === targetLeagueId).length;
      const newPlayerId = `${targetLeagueId}_P_${Date.now().toString().slice(-4)}`;
      targetPlayer = {
        id: newPlayerId,
        name: reg.name,
        nick: reg.nick,
        username: reg.username || toCleanUsername(reg.name),
        passwordHash: reg.passwordHash && String(reg.passwordHash).indexOf('smplh1$') === 0
          ? reg.passwordHash
          : hashSecret(reg.passwordHash || ('SMPL' + Math.floor(1000 + Math.random() * 9000))),
        fb: reg.fbLink,
        fbLink: reg.fbLink,
        playedBefore: Boolean(reg.playedBefore),
        leagueId: targetLeagueId,
        excelOrder: leaguePlayersCount + 1,
        isPlaceholder: false,
        clanId: reg.clanId || null,
        clanName: reg.clanName || '',
        clanTag: reg.clanTag || '',
        clanLogo: reg.clanLogo || null,
        avatar: reg.avatar || window.SMPL_MEDIA.generatePlayerAvatar(reg.name, reg.nick, state.players.length + 5),
        bio: sanitizeProfileBio(reg.bio || ''),
        penaltyPoints: 0,
        penaltyReason: '',
        joinedSeason: 56,
        active: true,
        trophies: existingTrophies,
        notifications: [
          {
            id: 'NOTIF_ASSIGN_' + Date.now(),
            time: nowFormatted(),
            text: `🎉 Administrator ${adminName} dopisał Twoje konto do ligi: ${leagueName}!`
          }
        ]
      };
      if (linkedHistName) targetPlayer.historicalArchiveName = linkedHistName;
      state.players.push(targetPlayer);
    }

    reg.status = 'ASSIGNED';
    reg.assignedLeague = targetLeagueId;
    reg.assignedPlayerId = targetPlayer.id;

    // Dopisz historię S1–S55 wybraną przez Admina, wskazaną przy rejestracji lub dopasowaną po nazwisku
    let assignedHistInfo = null;
    if (typeof historicalOption === 'string' && historicalOption && historicalOption !== 'NONE') {
      if (historicalOption.startsWith('PRESET:')) {
        assignedHistInfo = assignHistoricalStatsToPlayer(
          targetPlayer.id,
          { preset: historicalOption.replace('PRESET:', '') },
          adminName
        );
      } else {
        assignedHistInfo = assignHistoricalStatsToPlayer(
          targetPlayer.id,
          { archiveName: historicalOption },
          adminName
        );
      }
    } else {
      const candidateArch =
        (linkedHistName && findArchiveEntryByName(linkedHistName)) ||
        findArchiveEntryByName(reg.name);
      if (candidateArch) {
        assignedHistInfo = assignHistoricalStatsToPlayer(
          targetPlayer.id,
          { archiveName: candidateArch.name },
          adminName
        );
      }
    }

    addLog(
      'RECRUIT_APPROVE',
      `🎉 Admin ${adminName} dopisał gracza ${reg.name} (@${reg.nick}) z listy oczekujących do: ${leagueName}${replacedSlotLabel ? ` (w miejsce ${replacedSlotLabel})` : ''}${assignedHistInfo ? ' wraz z historią S1–S55!' : '!'}`
    );

    syncToBackend();
    return {
      registration: reg,
      player: targetPlayer,
      replacedSlotLabel: replacedSlotLabel,
      assignedHistInfo: assignedHistInfo
    };
  }

  function rejectRegistration(regId, reason, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const reg = state.registrations.find((r) => r.id === regId);
    if (!reg) throw new Error('Nie znaleziono zgłoszenia.');

    reg.status = 'REJECTED';
    reg.rejectionReason = reason || 'Komplet miejsc w wybranej lidze lub niepełne dane zgłoszenia.';
    reg.reviewedBy = adminName;
    reg.reviewedAt = nowFormatted();

    addLog(
      'RECRUIT_REJECT',
      `❌ Admin ${adminName} odrzucił zgłoszenie kandydata ${reg.name} (@${reg.nick}). Powód: ${reg.rejectionReason}`
    );

    syncToBackend();
    return reg;
  }

  // --- FUNKCJE SEZONOWEGO OKNA ZAPISÓW, ADMINA-GRACZA ORAZ KANDYDATÓW Z LISTY ---
  function findAdminForPlayer(player, targetState) {
    if (!player || player.isPlaceholder) return null;
    const st = targetState || state || {};
    const admins = Array.isArray(st.admins) ? st.admins : [];
    const pNameLow = player.name ? String(player.name).trim().toLowerCase() : '';
    const pUserLow = player.username ? String(player.username).trim().toLowerCase() : '';

    if (player.adminId) {
      const byId = admins.find(
        (a) => a && a.id === player.adminId && (a.status === undefined || a.status === 'APPROVED' || a.role === 'MASTER_ADMIN')
      );
      if (byId) return byId;
    }

    return admins.find((a) => {
      if (!a || (a.status !== 'APPROVED' && a.role !== 'MASTER_ADMIN' && a.status !== undefined)) return false;
      const aNameLow = a.name ? String(a.name).trim().toLowerCase() : '';
      const aUserLow = a.username ? String(a.username).trim().toLowerCase() : '';
      if (aUserLow && pUserLow && aUserLow === pUserLow) return true;
      if (aNameLow && pNameLow && aNameLow === pNameLow) return true;
      return false;
    }) || null;
  }

  function findPlayerForAdmin(adminIdOrObj, targetState) {
    const st = targetState || state || {};
    const admins = Array.isArray(st.admins) ? st.admins : [];
    const players = Array.isArray(st.players) ? st.players : [];
    const adm = typeof adminIdOrObj === 'string'
      ? admins.find((a) => a && a.id === adminIdOrObj)
      : adminIdOrObj;
    if (!adm) return null;

    const aId = adm.id;
    const aNameLow = adm.name ? String(adm.name).trim().toLowerCase() : '';
    const aUserLow = adm.username ? String(adm.username).trim().toLowerCase() : '';

    const matchesAdmin = (p) => {
      if (!p || p.isPlaceholder || p.gdprDeleted) return false;
      if (p.adminId && aId && p.adminId === aId) return true;
      const pUserLow = p.username ? String(p.username).trim().toLowerCase() : '';
      const pNameLow = p.name ? String(p.name).trim().toLowerCase() : '';
      if (aUserLow && pUserLow && aUserLow === pUserLow) return true;
      if (aNameLow && pNameLow && aNameLow === pNameLow) return true;
      return false;
    };

    const activeMatch = players.find((p) => p.active !== false && /^L\d+$/i.test(String(p.leagueId || '')) && matchesAdmin(p));
    if (activeMatch) return activeMatch;
    return players.find(matchesAdmin) || null;
  }

  function getSeasonJoinWindowInfo(targetState) {
    const st = targetState || state || {};
    const ps = (st.portalSettings && typeof st.portalSettings === 'object') ? st.portalSettings : {};
    const isOpen = Boolean(ps.seasonJoinOpen);
    return {
      isOpen: isOpen,
      phase: String(ps.seasonWindowPhase || (isOpen ? 'OPEN' : 'NOT_STARTED')),
      updatedBy: String(ps.seasonJoinUpdatedBy || ''),
      updatedAt: String(ps.seasonJoinUpdatedAt || ''),
      allowedLeagues: Array.isArray(ps.seasonJoinAllowedLeagues) ? ps.seasonJoinAllowedLeagues.slice() : []
    };
  }

  function setSeasonJoinWindow(isOpen, options = {}, adminName = 'Szymon Komenda', onServerResult) {
    assertAdminAuthenticated();
    if (!state.portalSettings || typeof state.portalSettings !== 'object' || Array.isArray(state.portalSettings)) {
      state.portalSettings = {};
    }
    const prevPsSnapshot = JSON.parse(JSON.stringify(state.portalSettings));
    const prevLogLen = Array.isArray(state.activityLog) ? state.activityLog.length : 0;
    const openFlag = Boolean(isOpen);
    const phase = options && options.phase
      ? String(options.phase)
      : (openFlag ? 'OPEN' : 'ENDED');
    localMutationEpoch += 1;
    state.portalSettings.seasonJoinOpen = openFlag;
    state.portalSettings.seasonWindowPhase = phase;
    state.portalSettings.seasonJoinUpdatedBy = adminName;
    state.portalSettings.seasonJoinUpdatedAt = nowFormatted();
    if (options && Array.isArray(options.allowedLeagues)) {
      state.portalSettings.seasonJoinAllowedLeagues = options.allowedLeagues.filter((id) => /^L\d{1,2}$/i.test(String(id)));
    } else if (state.portalSettings.seasonJoinAllowedLeagues === undefined) {
      state.portalSettings.seasonJoinAllowedLeagues = [];
    }

    addLog(
      openFlag ? 'SEASON_WINDOW_OPEN' : 'SEASON_WINDOW_CLOSE',
      openFlag
        ? `🟢 Admin ${adminName} zatwierdził POCZĄTEK SEZONU — przyciski [Dołącz do ligi / Opuść ligę] są OTWARTE dla graczy.`
        : `🔴 Admin ${adminName} zatwierdził KONIEC / ZAMKNIĘCIE okna zapisów — dołączanie/opuszczanie dla graczy zostało ZABLOKOWANE.`
    );

    const rollbackFn = () => {
      state.portalSettings = prevPsSnapshot;
      if (Array.isArray(state.activityLog) && state.activityLog.length > prevLogLen) {
        state.activityLog.shift();
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    };

    const offlineOut = getSeasonJoinWindowInfo(state);
    sendAtomicAdminAction(
      'admin_set_season_window',
      {
        seasonJoinOpen: openFlag,
        seasonWindowPhase: phase,
        allowedLeagues: Array.isArray(state.portalSettings.seasonJoinAllowedLeagues)
          ? state.portalSettings.seasonJoinAllowedLeagues.slice()
          : []
      },
      rollbackFn,
      offlineOut,
      onServerResult
    );
    return offlineOut;
  }

  function approveRegistrationAccount(regId, adminName = 'Szymon Komenda', onServerResult) {
    assertAdminAuthenticated();
    const reg = (state.registrations || []).find((r) => r.id === regId);
    if (!reg) throw new Error('Nie znaleziono zgłoszenia rekrutacyjnego.');

    const prevStatus = reg.status;
    const prevReviewedBy = reg.reviewedBy;
    const prevReviewedAt = reg.reviewedAt;
    const prevLogLen = Array.isArray(state.activityLog) ? state.activityLog.length : 0;

    localMutationEpoch += 1;
    reg.status = 'APPROVED_POOL';
    reg.reviewedBy = adminName;
    reg.reviewedAt = nowFormatted();

    addLog(
      'REG_APPROVED_POOL',
      `✅ Admin ${adminName} zatwierdził konto gracza ${reg.name} (@${reg.nick}) do puli — gracz może kliknąć [Dołącz do ligi] po starcie sezonu lub zostać dopisany ręcznie.`
    );

    const rollbackFn = () => {
      reg.status = prevStatus;
      if (prevReviewedBy === undefined) delete reg.reviewedBy; else reg.reviewedBy = prevReviewedBy;
      if (prevReviewedAt === undefined) delete reg.reviewedAt; else reg.reviewedAt = prevReviewedAt;
      if (Array.isArray(state.activityLog) && state.activityLog.length > prevLogLen) {
        state.activityLog.shift();
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    };

    sendAtomicAdminAction(
      'admin_approve_pool',
      { regId: reg.id },
      rollbackFn,
      { registration: reg, approvedCount: 1 },
      onServerResult
    );
    return reg;
  }

  function approveAllPendingToPool(adminName = 'Szymon Komenda', onServerResult) {
    assertAdminAuthenticated();
    const pendingList = (state.registrations || []).filter((r) => {
      if (!r || r.status !== 'PENDING') return false;
      if (typeof isUserBlacklisted === 'function' && isUserBlacklisted(r.name, r.nick)) return false;
      return true;
    });
    const snapshots = pendingList.map((r) => ({
      reg: r,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt
    }));
    const prevLogLen = Array.isArray(state.activityLog) ? state.activityLog.length : 0;

    if (snapshots.length === 0) {
      if (typeof onServerResult === 'function') {
        onServerResult(null, { ok: true, approvedCount: 0, registrations: state.registrations || [] });
      }
      return { ok: true, approvedCount: 0 };
    }

    localMutationEpoch += 1;
    const nowStr = nowFormatted();
    snapshots.forEach((snap) => {
      snap.reg.status = 'APPROVED_POOL';
      snap.reg.reviewedBy = adminName;
      snap.reg.reviewedAt = nowStr;
    });

    addLog(
      'REG_APPROVED_POOL',
      `✅ Admin ${adminName} zatwierdził wszystkie oczekujące konta (${snapshots.length}) do Puli Graczy — mogą teraz kliknąć [Dołącz do ligi].`
    );

    const rollbackFn = () => {
      snapshots.forEach((snap) => {
        snap.reg.status = snap.status;
        if (snap.reviewedBy === undefined) delete snap.reg.reviewedBy; else snap.reg.reviewedBy = snap.reviewedBy;
        if (snap.reviewedAt === undefined) delete snap.reg.reviewedAt; else snap.reg.reviewedAt = snap.reviewedAt;
      });
      if (Array.isArray(state.activityLog) && state.activityLog.length > prevLogLen) {
        state.activityLog.shift();
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    };

    sendAtomicAdminAction(
      'admin_approve_pool',
      { approveAllPending: true },
      rollbackFn,
      { approvedCount: snapshots.length, registrations: state.registrations || [] },
      onServerResult
    );
    return { ok: true, approvedCount: snapshots.length };
  }

  function adminJoinOrLeaveLeague(options = {}, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const sess = getSession();
    const op = String((options && options.op) || 'join').trim().toLowerCase();
    const requestedAdmId = options && options.adminId ? String(options.adminId) : sess.adminId;
    const adm = (state.admins || []).find((a) => a && a.id === requestedAdmId);
    if (!adm || (adm.status !== 'APPROVED' && adm.role !== 'MASTER_ADMIN' && adm.status !== undefined)) {
      throw new Error('Nie znaleziono zatwierdzonego konta administratora.');
    }

    if (op === 'leave') {
      const existingPl = findPlayerForAdmin(adm, state);
      if (!existingPl || (existingPl.active === false && existingPl.leagueId === 'POOL')) {
        throw new Error(`Administrator ${adm.name} nie występuje obecnie w żadnej aktywnej lidze.`);
      }
      const prevLg = existingPl.leagueId;
      existingPl.active = false;
      existingPl.leagueId = 'POOL';
      existingPl.leftLeagueAt = nowFormatted();
      addLog(
        'ADMIN_LEAVE_LEAGUE',
        `🚪 Admin ${adm.name} opuścił tabelę ligi ${prevLg} (zachowano profil, rolę Admina i statystyki historyczne).`
      );
      syncToBackend();
      return { ok: true, op: 'leave', player: existingPl };
    }

    const leagueId = String((options && options.leagueId) || 'L1').trim().toUpperCase();
    ensureSingleLeagueExists(state, leagueId, true);

    let player = findPlayerForAdmin(adm, state);
    const clanInfo = options && options.clanId
      ? resolvePlayerClanPayload({ clanId: options.clanId }, adm.name)
      : {
          clanId: player && player.clanId ? player.clanId : null,
          clanName: player && player.clanName ? player.clanName : null,
          clanTag: player && player.clanTag ? player.clanTag : null,
          clanColor: player && player.clanColor ? player.clanColor : null,
          clanLogo: player && player.clanLogo ? player.clanLogo : null
        };

    const desiredNick = String((options && options.nick) || (player && player.nick) || adm.username || adm.name).trim();
    const fallbackAvatar = (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function')
      ? window.SMPL_MEDIA.generatePlayerAvatar(adm.name || 'Admin', desiredNick || 'ADM', 1)
      : '';

    if (player) {
      player.leagueId = leagueId;
      player.active = true;
      player.leftLeagueAt = null;
      player.joinedViaButtonAt = nowFormatted();
      player.nick = desiredNick || player.nick;
      player.isAdminPlayer = true;
      player.adminId = adm.id;
      player.adminRole = adm.role || 'CO_ADMIN';
      if (!player.passwordHash && adm.passwordHash) player.passwordHash = adm.passwordHash;
      if (!player.username && adm.username) player.username = adm.username;
      if (clanInfo.clanId) {
        player.clanId = clanInfo.clanId;
        player.clanName = clanInfo.clanName;
        player.clanTag = clanInfo.clanTag;
        player.clanColor = clanInfo.clanColor;
        player.clanLogo = clanInfo.clanLogo;
      }
      if (!Array.isArray(player.notifications)) player.notifications = [];
      player.notifications.unshift({
        id: 'NOTIF_' + Date.now(),
        time: nowFormatted(),
        text: `🛡️ Dołączyłeś do ligi ${leagueId} jako Administrator-Zawodnik pod rangą ADMIN!`
      });
    } else {
      const sameLgPlayers = state.players.filter((p) => p.leagueId === leagueId);
      const nextExcelOrder = sameLgPlayers.reduce((mx, p) => Math.max(mx, p.excelOrder || 0), 0) + 1;
      player = {
        id: 'PLR_ADM_' + adm.id + '_' + Date.now(),
        name: adm.name,
        nick: desiredNick,
        username: adm.username || desiredNick.toLowerCase().replace(/[^a-z0-9]/g, ''),
        passwordHash: adm.passwordHash || '',
        fb: (options && options.fbLink) || adm.fbLink || 'https://m.me/',
        fbLink: (options && options.fbLink) || adm.fbLink || 'https://m.me/',
        leagueId: leagueId,
        active: true,
        isAdminPlayer: true,
        adminId: adm.id,
        adminRole: adm.role || 'CO_ADMIN',
        excelOrder: nextExcelOrder,
        joinedSeason: state.season || 56,
        joinedViaButtonAt: nowFormatted(),
        clanId: clanInfo.clanId,
        clanName: clanInfo.clanName,
        clanTag: clanInfo.clanTag,
        clanColor: clanInfo.clanColor,
        clanLogo: clanInfo.clanLogo,
        avatar: adm.avatar || fallbackAvatar,
        bio: sanitizeProfileBio(adm.bio || ''),
        penaltyPoints: 0,
        penaltyReason: '',
        yellowCards: 0,
        redCards: 0,
        isSuspended: false,
        customRank: null,
        trophies: [],
        notifications: [
          {
            id: 'NOTIF_' + Date.now(),
            time: nowFormatted(),
            text: `🛡️ Witaj w lidze ${leagueId}! Występujesz jako Administrator pod rangą ADMIN.`
          }
        ]
      };
      state.players.push(player);
    }

    let histAssigned = null;
    if (options && options.historicalPayload) {
      histAssigned = assignHistoricalStatsToPlayer(player.id, options.historicalPayload, adminName);
    } else if (!player.historicalStats) {
      const autoArch = findArchiveEntryByName(adm.name);
      if (autoArch) {
        histAssigned = assignHistoricalStatsToPlayer(player.id, { archiveName: autoArch.name }, adminName);
      }
    }

    if (sess && sess.adminId === adm.id) {
      sess.activePlayerId = player.id;
      saveSession(sess);
    }

    addLog(
      'ADMIN_JOIN_LEAGUE',
      `🛡️ Admin ${adm.name} (${adm.role === 'MASTER_ADMIN' ? 'Master Admin' : 'Admin'}) dołączył do ligi ${leagueId} jako zawodnik pod rangą ADMIN.`
    );
    syncToBackend();
    return { ok: true, op: 'join', player: player, histAssigned: histAssigned };
  }

  function playerJoinLeague(leagueId, options = {}, onServerResult) {
    let opts = options;
    let serverCb = onServerResult;
    if (typeof options === 'function') {
      serverCb = options;
      opts = {};
    }
    const sess = getSession();
    if (isStrictAdminSession(sess)) {
      const admRes = adminJoinOrLeaveLeague(
        Object.assign({}, opts || {}, { op: 'join', leagueId: leagueId }),
        sess.adminName || 'Admin'
      );
      if (typeof serverCb === 'function') {
        serverCb(null, Object.assign({ offline: true }, admRes || {}));
      }
      return admRes;
    }

    if (!sess || !sess.isPlayerAuthenticated || sess.isGuest) {
      throw new Error('Zaloguj się na swoje konto zawodnika, aby dołączyć do ligi.');
    }
    const winInfo = getSeasonJoinWindowInfo(state);
    if (!winInfo.isOpen) {
      throw new Error('⏳ Zapisy do ligi (Dołącz / Opuść) są obecnie ZAMKNIĘTE — poczekaj, aż Szymon Komenda lub Administracja zatwierdzi początek sezonu!');
    }

    const cleanLgId = String(leagueId || '').trim().toUpperCase();
    if (!/^L\d{1,2}$/.test(cleanLgId) || !isLeagueEnabled(cleanLgId, state)) {
      throw new Error('Wybrana liga nie jest obecnie otwarta lub jest wyłączona.');
    }
    if (winInfo.allowedLeagues.length > 0 && !winInfo.allowedLeagues.includes(cleanLgId)) {
      throw new Error('Administracja otworzyła samodzielne zapisy tylko dla wybranych lig.');
    }

    let player = sess.activePlayerId
      ? (state.players || []).find((p) => p.id === sess.activePlayerId && !p.isPlaceholder && !p.gdprDeleted)
      : null;

    if (player) {
      if (isUserBlacklisted(player.name, player.nick) || player.isBlacklisted || player.banned || player.customRank === 'BLACKLISTED') {
        throw new Error('⛔ Konto znajduje się na Czarnej Liście SMPL.');
      }
      const prevLg = player.leagueId;
      const prevActive = player.active;
      const prevLeftAt = player.leftLeagueAt;
      const prevJoinedAt = player.joinedViaButtonAt;
      const prevNotifHadArr = Array.isArray(player.notifications);
      const prevNotifLen = prevNotifHadArr ? player.notifications.length : 0;
      const prevLogLen = Array.isArray(state.activityLog) ? state.activityLog.length : 0;

      localMutationEpoch += 1;
      player.leagueId = cleanLgId;
      player.active = true;
      player.leftLeagueAt = null;
      player.joinedViaButtonAt = nowFormatted();
      if (!Array.isArray(player.notifications)) player.notifications = [];
      player.notifications.unshift({
        id: 'NOTIF_' + Date.now(),
        time: nowFormatted(),
        text: `⚡ Dołączyłeś do ligi ${cleanLgId} na start sezonu!`
      });
      addLog('PLAYER_JOIN_LEAGUE', `⚡ Zawodnik ${player.name} (@${player.nick}) dołączył do ligi ${cleanLgId}.`);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

      const rollbackPlayerFn = () => {
        player.leagueId = prevLg;
        player.active = prevActive;
        if (prevLeftAt === undefined) delete player.leftLeagueAt; else player.leftLeagueAt = prevLeftAt;
        if (prevJoinedAt === undefined) delete player.joinedViaButtonAt; else player.joinedViaButtonAt = prevJoinedAt;
        if (prevNotifHadArr && Array.isArray(player.notifications) && player.notifications.length > prevNotifLen) {
          player.notifications.shift();
        }
        if (Array.isArray(state.activityLog) && state.activityLog.length > prevLogLen) {
          state.activityLog.shift();
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      };

      const resOut = { ok: true, op: 'join', leagueId: cleanLgId, player: player };
      if (isHttpProtocol()) {
        sendPlayerLeagueMembershipToServer('join', cleanLgId, null, rollbackPlayerFn, serverCb);
      } else {
        syncToBackend();
        if (typeof serverCb === 'function') serverCb(null, Object.assign({ offline: true }, resOut));
      }
      return resOut;
    }

    if (sess.activeRegId) {
      const reg = (state.registrations || []).find((r) => r.id === sess.activeRegId);
      if (!reg) throw new Error('Nie znaleziono Twojego zgłoszenia konta.');
      if (reg.status !== 'APPROVED_POOL') {
        throw new Error('⏳ Twoje konto oczekuje jeszcze na akceptację Administracji zanim klikniesz Dołącz do ligi.');
      }
      if (isUserBlacklisted(reg.name, reg.nick)) {
        throw new Error('⛔ Konto znajduje się na Czarnej Liście SMPL.');
      }
      const prevRegStatus = reg.status;
      const prevAssignedLg = reg.assignedLeague;
      const prevAssignedPid = reg.assignedPlayerId;
      const prevSessPid = sess.activePlayerId;
      const prevSessRegId = sess.activeRegId;
      const prevLogLen = Array.isArray(state.activityLog) ? state.activityLog.length : 0;

      const sameLgPlayers = state.players.filter((p) => p.leagueId === cleanLgId);
      const nextExcelOrder = sameLgPlayers.reduce((mx, p) => Math.max(mx, p.excelOrder || 0), 0) + 1;
      const newId = 'PLR_' + Date.now() + '_' + Math.floor(Math.random() * 900 + 100);
      player = {
        id: newId,
        name: reg.name,
        nick: reg.nick,
        username: reg.username,
        passwordHash: reg.passwordHash,
        fb: reg.fbLink || '',
        fbLink: reg.fbLink || '',
        leagueId: cleanLgId,
        active: true,
        excelOrder: nextExcelOrder,
        joinedSeason: state.season || 56,
        joinedViaButtonAt: nowFormatted(),
        clanId: reg.clanId || null,
        clanName: reg.clanName || null,
        clanTag: reg.clanTag || null,
        clanColor: reg.clanColor || null,
        clanLogo: reg.clanLogo || null,
        avatar: reg.avatar || '',
        bio: sanitizeProfileBio(reg.bio || ''),
        playedBefore: Boolean(reg.playedBefore),
        historicalArchiveName: reg.linkedHistoricalName || null,
        penaltyPoints: 0,
        penaltyReason: '',
        yellowCards: 0,
        redCards: 0,
        isSuspended: false,
        customRank: null,
        trophies: [],
        notifications: [
          {
            id: 'NOTIF_' + Date.now(),
            time: nowFormatted(),
            text: `⚡ Dołączyłeś do ligi ${cleanLgId} na start sezonu!`
          }
        ]
      };
      localMutationEpoch += 1;
      state.players.push(player);
      reg.status = 'ASSIGNED';
      reg.assignedLeague = cleanLgId;
      reg.assignedPlayerId = newId;
      if (reg.playedBefore && reg.linkedHistoricalName) {
        try {
          const histMatch = findArchiveEntryByName(reg.linkedHistoricalName);
          if (histMatch) {
            player.historicalStats = histMatch;
            player.historicalArchiveName = histMatch.name;
          }
        } catch (e) {}
      }
      sess.activePlayerId = newId;
      sess.activeRegId = null;
      saveSession(sess);

      addLog('PLAYER_JOIN_LEAGUE', `⚡ Zatwierdzony gracz ${player.name} (@${player.nick}) dołączył do ligi ${cleanLgId}.`);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

      const rollbackRegFn = () => {
        if (Array.isArray(state.players)) {
          state.players = state.players.filter((p) => p && p.id !== newId);
        }
        reg.status = prevRegStatus;
        if (prevAssignedLg === undefined) delete reg.assignedLeague; else reg.assignedLeague = prevAssignedLg;
        if (prevAssignedPid === undefined) delete reg.assignedPlayerId; else reg.assignedPlayerId = prevAssignedPid;
        const curS = getSession();
        curS.activePlayerId = prevSessPid;
        curS.activeRegId = prevSessRegId;
        saveSession(curS);
        if (Array.isArray(state.activityLog) && state.activityLog.length > prevLogLen) {
          state.activityLog.shift();
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      };

      const resRegOut = { ok: true, op: 'join', leagueId: cleanLgId, player: player };
      if (isHttpProtocol()) {
        sendPlayerLeagueMembershipToServer('join', cleanLgId, newId, rollbackRegFn, serverCb);
      } else {
        syncToBackend();
        if (typeof serverCb === 'function') serverCb(null, Object.assign({ offline: true }, resRegOut));
      }
      return resRegOut;
    }

    throw new Error('Brak aktywnego profilu gracza — zaloguj się ponownie lub skontaktuj z Administracją.');
  }

  function playerLeaveLeague(onServerResult) {
    const sess = getSession();
    if (isStrictAdminSession(sess)) {
      const admRes = adminJoinOrLeaveLeague({ op: 'leave' }, sess.adminName || 'Admin');
      if (typeof onServerResult === 'function') {
        onServerResult(null, Object.assign({ offline: true }, admRes || {}));
      }
      return admRes;
    }
    if (!sess || !sess.isPlayerAuthenticated || !sess.activePlayerId) {
      throw new Error('Zaloguj się jako aktywny zawodnik, aby opuścić ligę.');
    }
    const winInfo = getSeasonJoinWindowInfo(state);
    if (!winInfo.isOpen) {
      throw new Error('🔒 Okno zmian składów zostało ZAMKNIĘTE przez Administrację — nie możesz teraz samodzielnie opuścić ligi.');
    }
    const player = (state.players || []).find((p) => p.id === sess.activePlayerId && !p.isPlaceholder);
    if (!player || (player.active === false && player.leagueId === 'POOL')) {
      throw new Error('Nie jesteś obecnie przypisany do żadnej aktywnej tabeli ligowej.');
    }
    const prevLg = player.leagueId;
    const prevActive = player.active;
    const prevLeftAt = player.leftLeagueAt;
    const prevNotifHadArr = Array.isArray(player.notifications);
    const prevNotifLen = prevNotifHadArr ? player.notifications.length : 0;
    const prevLogLen = Array.isArray(state.activityLog) ? state.activityLog.length : 0;

    localMutationEpoch += 1;
    player.active = false;
    player.leagueId = 'POOL';
    player.leftLeagueAt = nowFormatted();
    if (!Array.isArray(player.notifications)) player.notifications = [];
    player.notifications.unshift({
      id: 'NOTIF_' + Date.now(),
      time: nowFormatted(),
      text: `🚪 Opuściłeś ligę ${prevLg} w otwartym oknie startowym. Możesz ponownie kliknąć [Dołącz do ligi], dopóki Admin nie zamknie zapisów.`
    });

    addLog('PLAYER_LEAVE_LEAGUE', `🚪 Zawodnik ${player.name} (@${player.nick}) opuścił ligę ${prevLg} (okno otwarte).`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const rollbackLeaveFn = () => {
      player.active = prevActive;
      player.leagueId = prevLg;
      if (prevLeftAt === undefined) delete player.leftLeagueAt; else player.leftLeagueAt = prevLeftAt;
      if (prevNotifHadArr && Array.isArray(player.notifications) && player.notifications.length > prevNotifLen) {
        player.notifications.shift();
      }
      if (Array.isArray(state.activityLog) && state.activityLog.length > prevLogLen) {
        state.activityLog.shift();
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    };

    const resLeaveOut = { ok: true, op: 'leave', player: player };
    if (isHttpProtocol()) {
      sendPlayerLeagueMembershipToServer('leave', 'POOL', null, rollbackLeaveFn, onServerResult);
    } else {
      syncToBackend();
      if (typeof onServerResult === 'function') onServerResult(null, Object.assign({ offline: true }, resLeaveOut));
    }
    return resLeaveOut;
  }

  function getAddPlayerCandidates(targetState) {
    const st = targetState || state || {};
    const out = [];
    const activePlayers = (st.players || []).filter((p) => p && !p.isPlaceholder && !p.gdprDeleted);

    // 1. Oczekujące i zatwierdzone bez ligi rejestracje (po rejestracji)
    (st.registrations || []).forEach((r) => {
      if (!r || (r.status !== 'PENDING' && r.status !== 'APPROVED_POOL')) return;
      out.push({
        kind: r.status === 'PENDING' ? 'REG_PENDING' : 'REG_POOL',
        refId: r.id,
        name: r.name || 'Rejestracja',
        nick: r.nick || '',
        username: r.username || '',
        preferredLeague: r.preferredLeague || '',
        linkedHistoricalName: r.linkedHistoricalName || '',
        clanName: r.clanName || '',
        badge: r.status === 'PENDING' ? '⏳ PO REJESTRACJI' : '✅ ZATWIERDZONY (BEZ LIGI)',
        meta: `${r.preference || ''}${r.linkedHistoricalName ? ' • Historia: ' + r.linkedHistoricalName : ''}`,
        searchBlob: `${r.name || ''} ${r.nick || ''} ${r.username || ''} ${r.clanName || ''} ${r.linkedHistoricalName || ''}`.toLowerCase()
      });
    });

    // 2. Zatwierdzeni Administratorzy (którzy mogą zagrać np. w Ekstraklasie)
    (st.admins || []).forEach((a) => {
      if (!a || (a.status !== 'APPROVED' && a.role !== 'MASTER_ADMIN' && a.status !== undefined)) return;
      const linkedPl = findPlayerForAdmin(a, st);
      const activeLg = linkedPl && linkedPl.active !== false && /^L\d+$/i.test(String(linkedPl.leagueId || ''))
        ? linkedPl.leagueId
        : null;
      out.push({
        kind: 'ADMIN',
        refId: a.id,
        name: a.name || 'Admin',
        nick: (linkedPl && linkedPl.nick) || a.username || a.name,
        username: a.username || '',
        currentLeagueId: activeLg,
        badge: a.role === 'MASTER_ADMIN' ? '👑 MASTER ADMIN' : '🛡️ ADMIN',
        meta: activeLg ? `Już gra w lidze ${activeLg} (przenieś/aktualizuj)` : 'Administrator gotowy do gry pod rangą ADMIN',
        searchBlob: `${a.name || ''} ${a.username || ''} admin mistrz ekstraklasa`.toLowerCase()
      });
    });

    // 3. Gracze z Puli (opuścili ligę) lub aktywni w innych ligach
    activePlayers.forEach((p) => {
      const isInPool = p.active === false || p.leagueId === 'POOL';
      out.push({
        kind: isInPool ? 'PLAYER_POOL' : 'PLAYER_OTHER',
        refId: p.id,
        name: p.name,
        nick: p.nick || '',
        username: p.username || '',
        currentLeagueId: isInPool ? null : p.leagueId,
        clanName: p.clanName || '',
        badge: isInPool ? '🪑 Z PULI (OPUŚCIŁ LIGĘ)' : `🔁 W LIDZE ${p.leagueId}`,
        meta: isInPool
          ? `Powrót do ligi${p.historicalStats ? ' • Sezony: ' + p.historicalStats.seasons : ''}`
          : `Aktualnie przypisany do ${p.leagueId} (kliknij, aby przenieść tutaj)`,
        searchBlob: `${p.name || ''} ${p.nick || ''} ${p.username || ''} ${p.clanName || ''} ${p.leagueId || ''}`.toLowerCase()
      });
    });

    // 4. Pełny Katalog Historyczny S1–S55
    const catalog = getHistoricalPlayersCatalog();
    const activeNamesMap = {};
    activePlayers.forEach((p) => {
      if (p.active !== false && p.leagueId !== 'POOL' && p.name) {
        activeNamesMap[String(p.name).trim().toLowerCase()] = p.leagueId;
      }
      if (p.historicalArchiveName) {
        activeNamesMap[String(p.historicalArchiveName).trim().toLowerCase()] = p.leagueId;
      }
    });

    catalog.forEach((a) => {
      if (!a || !a.name) return;
      const key = String(a.name).trim().toLowerCase();
      const existingLg = activeNamesMap[key] || null;
      out.push({
        kind: 'ARCHIVE',
        refId: a.name,
        archiveName: a.name,
        name: a.name,
        nick: '',
        currentLeagueId: existingLg,
        badge: '🏛️ ARCHIWUM S1–S55',
        meta: `${a.seasons || 1} sez. • ${a.matches || 0}M • ${a.total || a.points || 0} pkt All-Time${a.gold ? ' • 👑x' + a.gold : ''}${existingLg ? ' [Gra w ' + existingLg + ']' : ''}`,
        searchBlob: `${a.name} archiwum s1 s55 historia`.toLowerCase()
      });
    });

    return out;
  }

  function adminAddCandidateToLeague(opts = {}, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const kind = String((opts && opts.kind) || '').toUpperCase();
    const leagueId = String((opts && opts.leagueId) || 'L2').trim().toUpperCase();
    const autoHist = !(opts && opts.autoHistory === false);
    ensureSingleLeagueExists(state, leagueId, true);

    if (kind === 'REG_PENDING' || kind === 'REG_POOL') {
      const reg = (state.registrations || []).find((r) => r.id === opts.refId);
      const histChoice = opts.histChoice || (autoHist && reg && reg.linkedHistoricalName ? reg.linkedHistoricalName : null);
      const res = assignRegistration(opts.refId, leagueId, adminName, histChoice);
      return { ok: true, kind, player: res.player, message: `Dopisano ${res.player.name} do ${leagueId}` };
    }

    if (kind === 'ADMIN') {
      const adm = (state.admins || []).find((a) => a.id === opts.refId);
      if (!adm) throw new Error('Nie znaleziono konta Admina.');
      const archAuto = autoHist ? findArchiveEntryByName(adm.name) : null;
      const res = adminJoinOrLeaveLeague(
        {
          op: 'join',
          adminId: adm.id,
          leagueId,
          clanId: opts.clanId || '',
          historicalPayload: archAuto ? { archiveName: archAuto.name } : undefined
        },
        adminName
      );
      return { ok: true, kind, player: res.player, message: `Admin ${res.player.name} dodany do ${leagueId} pod rangą ADMIN` };
    }

    if (kind === 'PLAYER_POOL' || kind === 'PLAYER_OTHER') {
      const pl = (state.players || []).find((p) => p.id === opts.refId);
      if (!pl) throw new Error('Nie znaleziono zawodnika na liście.');
      const prevLg = pl.leagueId;
      pl.leagueId = leagueId;
      pl.active = true;
      pl.leftLeagueAt = null;
      if (opts.clanId) {
        const clanInfo = resolvePlayerClanPayload({ clanId: opts.clanId }, pl.name);
        if (clanInfo.clanId) {
          pl.clanId = clanInfo.clanId;
          pl.clanName = clanInfo.clanName;
          pl.clanTag = clanInfo.clanTag;
          pl.clanLogo = clanInfo.clanLogo;
        }
      }
      if (autoHist && !pl.historicalStats) {
        const archMatch = findArchiveEntryByName(pl.historicalArchiveName || pl.name);
        if (archMatch) {
          assignHistoricalStatsToPlayer(pl.id, { archiveName: archMatch.name }, adminName);
        }
      }
      addLog('ADMIN_CANDIDATE_ADD', `🔁 Admin ${adminName} przypisał gracza ${pl.name} (${prevLg || 'POOL'} ➔ ${leagueId}).`);
      syncToBackend();
      return { ok: true, kind, player: pl, message: `Przypisano ${pl.name} do ${leagueId}` };
    }

    if (kind === 'ARCHIVE') {
      const archName = String(opts.archiveName || opts.refId || '').trim();
      const archEntry = findArchiveEntryByName(archName);
      if (!archEntry) throw new Error('Nie znaleziono gracza w archiwum S1–S55.');
      const cleanNick = String(opts.nick || archEntry.name.replace(/\s+/g, '_')).trim();
      const created = addDirectPlayer(
        {
          name: archEntry.name,
          nick: cleanNick,
          fb: opts.fb || 'https://m.me/',
          leagueId: leagueId,
          password: opts.password || '',
          clanId: opts.clanId || ''
        },
        adminName
      );
      let histRes = null;
      if (autoHist) {
        histRes = assignHistoricalStatsToPlayer(created.id, { archiveName: archEntry.name }, adminName);
      }
      return {
        ok: true,
        kind,
        player: created,
        histRes,
        message: `Dodano z archiwum ${archEntry.name} do ${leagueId}${histRes ? ' (+ historia S1–S55)' : ''}`
      };
    }

    throw new Error('Nieznany typ kandydata do dodania.');
  }

  // --- LOGOWANIE GRACZA ORAZ SYSTEM PRZYPOMNIENIA HASŁA (GRACZ + ADMIN) ---
  function loginPlayer(identifier, password) {
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanId || !cleanPass) {
      return { ok: false, error: 'Podaj swój login/nick/imię oraz hasło.' };
    }

    // 0. SPRAWDZENIE CZARNEJ LISTY (DOŻYWOTNI BAN)
    const isBlEntry = (state.blacklist || []).some(function (b) {
      return (b.name && b.name.toLowerCase() === cleanId) ||
             (b.nick && b.nick.toLowerCase() === cleanId);
    });
    const foundCandidate = (state.players || []).find(function (p) {
      return (p.username && p.username.toLowerCase() === cleanId) ||
             (p.nick && p.nick.toLowerCase() === cleanId) ||
             (p.name && p.name.toLowerCase() === cleanId);
    });
    const isCandidateBl = !!(
      foundCandidate && (
        foundCandidate.isBlacklisted ||
        foundCandidate.banned ||
        foundCandidate.customRank === 'BLACKLISTED' ||
        (state.blacklist || []).some(function (b) {
          return (b.name && foundCandidate.name && b.name.toLowerCase() === foundCandidate.name.toLowerCase()) ||
                 (b.nick && foundCandidate.nick && b.nick.toLowerCase() === foundCandidate.nick.toLowerCase());
        })
      )
    );

    if (isBlEntry || isCandidateBl) {
      return {
        ok: false,
        isBlacklisted: true,
        error: '⛔ DOŻYWOTNI BAN: Twoje konto znajduje się na Oficjalnej Czarnej Liście Score Match Ligi. Decyzją Zarządu (Szymon Komenda) masz DOŻYWOTNI ZAKAZ WSTĘPU do jakichkolwiek rozgrywek ligowych.'
      };
    }

    // 1. Sprawdź czy to Administrator / Master Admin (WYŁĄCZNIE indywidualny login lub email + weryfikacja hasła)
    const adminMatch = (state.admins || []).find(
      (a) =>
        (a.username && a.username.toLowerCase() === cleanId) ||
        (a.email && a.email.toLowerCase() === cleanId)
    );

    if (adminMatch) {
      if (!verifySecret(adminMatch, cleanPass)) {
        return { ok: false, error: 'Nieprawidłowy login lub hasło.' };
      }

      if (adminMatch.status === 'PENDING') {
        return { ok: false, error: 'Twój wniosek do administracji oczekuje jeszcze na zatwierdzenie przez Szymona Komendę.' };
      }

      if (adminMatch.status === 'REJECTED' || adminMatch.status !== 'APPROVED') {
        return { ok: false, error: '⛔ Dostęp tego konta administratora został odrzucony lub cofnięty.' };
      }

      grantAdminSession(
        adminMatch,
        cleanId,
        cleanPass,
        'ADMIN_LOGIN',
        `👑 Administrator ${adminMatch.name} zalogował się na swoje konto.`
      );
      return { ok: true, type: 'ADMIN', admin: adminMatch, isMaster: adminMatch.role === 'MASTER_ADMIN' };
    }

    const found = (state.players || []).find(
      (p) =>
        (p.active !== false || p.leagueId === 'POOL') &&
        !p.isPlaceholder &&
        !p.gdprDeleted &&
        ((p.username && p.username.toLowerCase() === cleanId) ||
          (p.nick && p.nick.toLowerCase() === cleanId) ||
          (p.name && p.name.toLowerCase() === cleanId))
    );

    if (!found) {
      const approvedReg = (state.registrations || []).find(
        (r) =>
          (r.status === 'APPROVED_POOL' || r.status === 'APPROVED' || r.status === 'ASSIGNED') &&
          ((r.username && r.username.toLowerCase() === cleanId) ||
            (r.nick && r.nick.toLowerCase() === cleanId) ||
            (r.name && r.name.toLowerCase() === cleanId))
      );
      if (approvedReg) {
        if (!verifySecret(approvedReg, cleanPass)) {
          return {
            ok: false,
            error: 'Nieprawidłowy login lub hasło. Skorzystaj z przycisku „🔑 Zapomniałeś hasła? Przypomnij” poniżej.'
          };
        }
        if (approvedReg.status === 'APPROVED' || approvedReg.status === 'ASSIGNED') {
          approvedReg.status = 'APPROVED_POOL';
          approvedReg.assignedLeague = null;
          approvedReg.assignedPlayerId = null;
        }
        const session = getSession();
        clearAdminAuthState(session, 'PUBLIC');
        session.activePlayerId = null;
        session.activeRegId = approvedReg.id;
        session.isPlayerAuthenticated = true;
        session.isGateUnlocked = true;
        session.isGuest = false;
        saveSession(session);
        requestServerPlayerToken(cleanId, cleanPass);
        addLog('PLAYER_LOGIN', `👤 Zatwierdzony gracz ${approvedReg.name} (@${approvedReg.nick}) zalogował się (Pula / Wybór ligi).`);
        if (!isHttpProtocol()) {
          syncToBackend();
        } else {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
        }
        return { ok: true, type: 'APPROVED_POOL', registration: approvedReg };
      }

      const pendingReg = (state.registrations || []).find(
        (r) =>
          r.status === 'PENDING' &&
          ((r.username && r.username.toLowerCase() === cleanId) ||
            (r.nick && r.nick.toLowerCase() === cleanId) ||
            (r.name && r.name.toLowerCase() === cleanId))
      );
      if (pendingReg) {
        return {
          ok: false,
          error: `⏳ Twoje konto (${pendingReg.name}) zostało zarejestrowane i znajduje się na Liście do Dopisania do Ligi! Poczekaj, aż Administrator przypisze Cię do dywizji (L1/L2/L3) lub zatwierdzi konto.`
        };
      }
      return { ok: false, error: 'Nieprawidłowy login lub hasło.' };
    }

    if (!verifySecret(found, cleanPass)) {
      return {
        ok: false,
        error: 'Nieprawidłowy login lub hasło. Skorzystaj z przycisku „🔑 Zapomniałeś hasła? Przypomnij” poniżej.'
      };
    }

    if (!found.passwordHash || String(found.passwordHash).indexOf('smplh1$') !== 0 || found.password) {
      found.passwordHash = hashSecret(cleanPass);
      delete found.password;
    }

    const session = getSession();
    clearAdminAuthState(session, 'PUBLIC');
    session.activePlayerId = found.id;
    session.activeRegId = null;
    session.isPlayerAuthenticated = true;
    session.isGateUnlocked = true;
    session.isGuest = false;
    saveSession(session);
    requestServerPlayerToken(cleanId, cleanPass);

    addLog('PLAYER_LOGIN', `👤 Gracz ${found.name} (@${found.nick}) zalogował się na swoje konto zawodnika.`);
    if (!isHttpProtocol()) {
      syncToBackend();
    } else {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
    return { ok: true, type: 'ACTIVE_PLAYER', player: found };
  }

  function unlockGateAsGuest() {
    const session = getSession();
    clearAdminAuthState(session, 'PUBLIC');
    clearPlayerTokenCache(session);
    session.isPlayerAuthenticated = false;
    session.activePlayerId = null;
    session.activeRegId = null;
    session.isGateUnlocked = true;
    session.isGuest = true;
    saveSession(session);
    addLog('GUEST_ENTER', '👁️ Użytkownik wszedł do portalu w trybie gościa (podgląd tabel).');
    return session;
  }

  function lockGate() {
    const session = getSession();
    clearAdminAuthState(session);
    clearPlayerTokenCache(session);
    session.isGateUnlocked = false;
    session.isPlayerAuthenticated = false;
    session.isGuest = false;
    session.activePlayerId = null;
    session.activeRegId = null;
    saveSession(session);
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.syncPushSubscriptionContext === 'function') {
      window.SMPL_NOTIF.syncPushSubscriptionContext();
    }
    return session;
  }

  function requestPasswordReminder(arg1, arg2) {
    let identifier = '';
    let fbVerify = '';
    if (arg1 && typeof arg1 === 'object') {
      identifier = arg1.identifier || '';
      fbVerify = arg1.fbVerify || '';
    } else {
      identifier = arg1 || '';
      fbVerify = arg2 || '';
    }
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean) {
      throw new Error('Wpisz swój Login konta lub Nick w grze.');
    }

    const player =
      (state.players || []).find(
        (p) =>
          p &&
          !p.isPlaceholder &&
          !p.gdprDeleted &&
          ((p.username && p.username.toLowerCase() === clean) ||
            (p.nick && p.nick.toLowerCase() === clean) ||
            (p.name && p.name.toLowerCase() === clean))
      ) ||
      (state.registrations || []).find(
        (r) =>
          r &&
          r.status !== 'REJECTED' &&
          ((r.username && r.username.toLowerCase() === clean) ||
            (r.nick && r.nick.toLowerCase() === clean) ||
            (r.name && r.name.toLowerCase() === clean))
      );

    if (!player) {
      throw new Error('Jeśli konto istnieje i pasuje do zgłoszenia, Administracja skontaktuje się z Tobą po weryfikacji.');
    }

    if (!state.passwordRequests) state.passwordRequests = [];

    const reqObj = {
      id: 'PWD_REQ_' + Date.now(),
      playerId: player.id,
      playerName: player.name,
      nick: player.nick,
      playerNick: player.nick,
      username: player.username || toCleanUsername(player.name),
      fbLink: player.fb || player.fbLink || fbVerify || 'https://m.me/smpl',
      status: 'PENDING',
      requestedAt: nowFormatted(),
      note: 'Gracz poprosił o zresetowanie i wysłanie nowego hasła tymczasowego przez Administrację na Messengerze.'
    };

    state.passwordRequests.unshift(reqObj);
    addLog(
      'PASSWORD_REMINDER_REQ',
      `🔑 Gracz ${player.name} (@${player.nick}) wysłał prośbę o reset hasła — zgłoszenie trafiło do Panelu Admina.`
    );
    syncToBackend();

    return {
      player: player,
      request: reqObj,
      infoMessage: 'Zgłoszenie resetu hasła zostało przekazane do Administracji. Skontaktuj się z Adminem na Messengerze, aby otrzymać nowe hasło tymczasowe.'
    };
  }

  function adminSendPasswordReminder(playerOrRegId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const player = (state.players || []).find((p) => p && p.id === playerOrRegId) || null;
    const reg = !player ? ((state.registrations || []).find((r) => r && r.id === playerOrRegId) || null) : null;
    const target = player || reg;
    if (!target) throw new Error('Nie znaleziono gracza ani konta w puli.');
    if (!target.fbLink) target.fbLink = target.fb || 'https://m.me/smpl';

    const loginStr = target.username || toCleanUsername(target.name);
    const tempPass = generateReadablePassword('SMPL');
    target.passwordHash = hashSecret(tempPass);
    delete target.password;

    const leagueName = player
      ? ((state.leagues[player.leagueId] && state.leagues[player.leagueId].name) || player.leagueId)
      : ('Pula Graczy SMPL (' + (reg.preferredLeague || 'L2') + ')');

    const messengerText = [
      `🔑 NOWE HASŁO TYMCZASOWE — SCORE MATCH LIGA`,
      `Cześć ${target.name}! Przesyłamy nowe dane dostępowe do Twojego konta zawodnika w ${leagueName}:`,
      `👤 Twój Login: ${loginStr} (lub @${target.nick})`,
      `🔒 Hasło tymczasowe: ${tempPass}`,
      `⚽ Zaloguj się na portalu Score Match Liga, aby dodawać wyniki meczów i sprawdzać swoją Kartę UT.`,
      `Pozdrawiamy, Zarząd Score Match Liga (${adminName})`
    ].join('\n');

    if (player) {
      if (!player.notifications) player.notifications = [];
      player.notifications.unshift({
        id: 'NOTIF_PWD_' + Date.now(),
        time: nowFormatted(),
        text: `🔑 Admin ${adminName} wygenerował dla Ciebie nowe hasło tymczasowe i wysłał wiadomość na Messengerze.`
      });
    } else if (reg && reg.assignedPlayerId) {
      const linkedPl = (state.players || []).find((p) => p && p.id === reg.assignedPlayerId);
      if (linkedPl) {
        linkedPl.passwordHash = target.passwordHash;
        delete linkedPl.password;
      }
    }

    if (state.passwordRequests) {
      state.passwordRequests.forEach((r) => {
        if (r.playerId === target.id && r.status === 'PENDING') {
          r.status = 'SENT';
          r.sentBy = adminName;
          r.sentAt = nowFormatted();
        }
      });
    }

    addLog(
      'ADMIN_PWD_SEND',
      `📨 Admin ${adminName} wygenerował nowe hasło tymczasowe dla gracza ${target.name} (@${target.nick}, login: ${loginStr}).`
    );
    syncToBackend();

    return {
      player: target,
      username: loginStr,
      tempPassword: tempPass,
      messengerText: messengerText,
      reminderText: messengerText
    };
  }

  function adminResetPlayerPassword(playerOrRegId, newPassword, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const player = (state.players || []).find((p) => p && p.id === playerOrRegId) || null;
    const reg = !player ? ((state.registrations || []).find((r) => r && r.id === playerOrRegId) || null) : null;
    const target = player || reg;
    if (!target) throw new Error('Nie znaleziono gracza ani konta w puli.');
    if (!newPassword || String(newPassword).trim().length < 4) {
      throw new Error('Nowe hasło musi mieć minimum 4 znaki.');
    }

    const cleanNewPass = String(newPassword).trim();
    const loginStr = target.username || toCleanUsername(target.name);
    target.passwordHash = hashSecret(cleanNewPass);
    delete target.password;
    if (player) {
      if (!player.notifications) player.notifications = [];
      player.notifications.unshift({
        id: 'NOTIF_PWDRESET_' + Date.now(),
        time: nowFormatted(),
        text: `🔑 Admin ${adminName} ustawił dla Twojego konta nowe hasło dostępowe.`
      });
    } else if (reg && reg.assignedPlayerId) {
      const linkedPl = (state.players || []).find((p) => p && p.id === reg.assignedPlayerId);
      if (linkedPl) {
        linkedPl.passwordHash = target.passwordHash;
        delete linkedPl.password;
      }
    }

    addLog(
      'ADMIN_PWD_RESET',
      `🔑 Admin ${adminName} zmienił hasło dostępowe dla gracza ${target.name} (@${target.nick}, login: ${loginStr}).`
    );
    syncToBackend();
    return target;
  }

  function updateMyAdminCredentials({ currentPassword, newUsername, newEmail, newPassword }) {
    const sess = assertAdminAuthenticated();
    const adm = (state.admins || []).find((a) => a.id === sess.adminId);
    if (!adm) {
      throw new Error('Nie znaleziono aktywnego konta administratora w bazie.');
    }
    if (!verifySecret(adm, currentPassword)) {
      throw new Error('Obecne hasło jest nieprawidłowe!');
    }

    const cleanUser = String(newUsername || adm.username || '').trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3 || !/^[a-z0-9._-]+$/.test(cleanUser)) {
      throw new Error('Login musi mieć min. 3 znaki (dozwolone: małe litery, cyfry, kropka, myślnik, podkreślnik).');
    }
    const duplicateUser = (state.admins || []).some(
      (a) => a.id !== adm.id && a.username && a.username.toLowerCase() === cleanUser
    );
    if (duplicateUser) {
      throw new Error('Ten login jest już zajęty przez innego administratora.');
    }

    const cleanNewPass = String(newPassword || '').trim();
    if (cleanNewPass && cleanNewPass.length < 6) {
      throw new Error('Nowe hasło administratora musi mieć co najmniej 6 znaków.');
    }

    adm.username = cleanUser;
    if (newEmail && String(newEmail).trim()) {
      adm.email = String(newEmail).trim().toLowerCase();
    }
    if (cleanNewPass) {
      adm.passwordHash = hashSecret(cleanNewPass);
      delete adm.password;
    } else if (!adm.passwordHash || String(adm.passwordHash).indexOf('smplh1$') !== 0) {
      adm.passwordHash = hashSecret(String(currentPassword || '').trim());
      delete adm.password;
    }

    addLog(
      'ADMIN_CREDS_UPDATE',
      `🔐 Administrator ${adm.name} zaktualizował swój indywidualny login / hasło dostępowe.`
    );
    try {
      const curSess = getSession();
      if (curSess && curSess.isAdminAuthenticated && String(curSess.adminId) === String(adm.id)) {
        curSess.adminUsername = adm.username;
        if (adm.email) curSess.adminEmail = adm.email;
        saveSession(curSess);
      }
    } catch (e) {}
    syncToBackend();
    return {
      ok: true,
      username: adm.username,
      email: adm.email,
      passwordChanged: Boolean(cleanNewPass)
    };
  }

  let lastThrottledPullAt = 0;
  function pullIfStale(minIntervalMs = 12000, onUpdatedCallback) {
    if (!isHttpProtocol()) return false;
    const now = Date.now();
    if (activeServerWritesCount > 0 && (now - lastServerWriteStartedAt) < 15000) return false;
    if (now - lastThrottledPullAt < Number(minIntervalMs || 12000)) return false;
    lastThrottledPullAt = now;
    pullFromServer(onUpdatedCallback);
    return true;
  }

  function updateMyPlayerPassword({ currentPassword, newPassword }) {
    const sess = getSession();
    if (!sess.isPlayerAuthenticated || !sess.activePlayerId) {
      throw new Error('Odmowa dostępu: Musisz być zalogowany na swoje konto zawodnika.');
    }
    const cleanNew = String(newPassword || '').trim();
    if (!cleanNew || cleanNew.length < 4) {
      throw new Error('Nowe hasło musi mieć minimum 4 znaki.');
    }

    const player = (state.players || []).find((p) => p.id === sess.activePlayerId);
    if (!player) {
      throw new Error('Nie znaleziono aktywnego konta zawodnika w bazie ligi.');
    }
    if (!verifySecret(player, currentPassword)) {
      throw new Error('Obecne hasło jest nieprawidłowe!');
    }

    player.passwordHash = hashSecret(cleanNew);
    delete player.password;

    addLog('PLAYER_PASS_UPDATE', `🔑 Zawodnik ${player.name} zaktualizował swoje prywatne hasło.`);
    syncToBackend();
    return { ok: true, name: player.name };
  }

  function sanitizeProfileBio(rawBio) {
    const cleaned = String(rawBio == null ? '' : rawBio)
      .replace(/\r\n?/g, '\n')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim();
    return cleaned.slice(0, 280);
  }

  function validateProfileAvatar(rawAvatar) {
    const s = String(rawAvatar == null ? '' : rawAvatar).trim();
    if (!s) return '';
    if (/^https?:\/\/[^\s"'<>]{4,1020}$/i.test(s)) return s;
    if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s)) {
      if (s.length > 480000) {
        throw new Error('Wybrane zdjęcie awatara jest za duże (max ok. 350 KB po kompresji).');
      }
      return s;
    }
    if (/^data:image\/svg\+xml(;charset=utf-8|;utf8)?,/i.test(s)) {
      if (s.length > 45000) {
        throw new Error('Obraz SVG awatara jest zbyt duży.');
      }
      let decoded = '';
      try { decoded = decodeURIComponent(s.replace(/^data:image\/svg\+xml[^,]*,/i, '')); } catch (e) { decoded = s; }
      if (/<\s*script|javascript:|on[a-z]+\s*=|<\s*foreignObject/i.test(decoded)) {
        throw new Error('Wykryto niedozwoloną zawartość SVG w awatarze.');
      }
      return s;
    }
    if (/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/i.test(s) && s.length <= 45000) {
      return s;
    }
    throw new Error('Nieprawidłowy format awatara. Wybierz plik PNG/JPG/WebP, gotowy herb SMPL lub poprawny link https://.');
  }

  function getOwnProfileSubject(sessionOverride) {
    const sess = sessionOverride || getSession();
    if (!sess || sess.isGuest) return { canEdit: false };
    const isAdmin = isStrictAdminSession(sess);
    if (isAdmin) {
      const adm = (state.admins || []).find((a) => a && a.id === sess.adminId) || null;
      const linkedPlayer = findPlayerForAdmin(sess.adminId || adm, state);
      const actor = linkedPlayer || adm;
      if (!actor) return { canEdit: false };
      return {
        canEdit: true,
        kind: linkedPlayer ? 'PLAYER' : 'ADMIN',
        id: actor.id,
        admin: adm,
        player: linkedPlayer,
        reg: null,
        name: actor.name || sess.adminName || 'Admin',
        nick: actor.nick || (adm && adm.username) || 'ADMIN',
        avatar: (linkedPlayer && linkedPlayer.avatar) || (adm && adm.avatar) || '',
        bio: sanitizeProfileBio((linkedPlayer && linkedPlayer.bio) || (adm && adm.bio) || ''),
        leagueId: linkedPlayer ? (linkedPlayer.leagueId || 'POOL') : 'ADMIN'
      };
    }
    if (sess.isPlayerAuthenticated && sess.activePlayerId) {
      const pl = (state.players || []).find((p) => p && p.id === sess.activePlayerId && !p.isPlaceholder && !p.gdprDeleted) || null;
      if (!pl) return { canEdit: false };
      return {
        canEdit: true,
        kind: 'PLAYER',
        id: pl.id,
        admin: null,
        player: pl,
        reg: null,
        name: pl.name || 'Zawodnik',
        nick: pl.nick || '',
        avatar: pl.avatar || '',
        bio: sanitizeProfileBio(pl.bio || ''),
        leagueId: pl.leagueId || 'POOL'
      };
    }
    if (sess.isPlayerAuthenticated && sess.activeRegId) {
      const reg = (state.registrations || []).find((r) => r && r.id === sess.activeRegId) || null;
      if (!reg) return { canEdit: false };
      return {
        canEdit: true,
        kind: 'REG',
        id: reg.id,
        admin: null,
        player: null,
        reg: reg,
        name: reg.name || 'Zawodnik',
        nick: reg.nick || '',
        avatar: reg.avatar || '',
        bio: sanitizeProfileBio(reg.bio || ''),
        leagueId: 'POOL'
      };
    }
    return { canEdit: false };
  }

  function sendAuthenticatedActionToServer(actionName, payload, useAdminToken, netErrMsg, opts) {
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      return Promise.resolve({ ok: true, localOnly: true });
    }
    const waitTok = useAdminToken
      ? (serverAdminTokenPromise || Promise.resolve(null))
      : (serverPlayerTokenPromise || Promise.resolve(null));
    return waitTok
      .then(() => {
        const headers = { 'Content-Type': 'application/json' };
        const wirePayload = (payload && typeof payload === 'object' && !Array.isArray(payload))
          ? Object.assign({}, payload)
          : payload;
        if (useAdminToken) {
          const admTok = resolveAdminRequestToken();
          if (admTok) {
            headers['X-SMPL-Admin-Token'] = admTok;
            if (wirePayload && typeof wirePayload === 'object' && !Array.isArray(wirePayload)) {
              wirePayload._adminToken = admTok;
            }
          }
        } else {
          const pTok = resolvePlayerRequestToken();
          if (pTok) {
            headers['X-SMPL-Player-Token'] = pTok;
            if (wirePayload && typeof wirePayload === 'object' && !Array.isArray(wirePayload)) {
              wirePayload._playerToken = pTok;
            }
          }
        }
        return fetch(getAiActionUrl(actionName), {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(wirePayload)
        });
      })
      .then((res) => {
        if (!res) return { ok: false, status: 0, error: 'Brak odpowiedzi serwera.' };
        return res.json()
          .catch(() => null)
          .then((data) => {
            if (!res.ok || !data || !data.ok) {
              const errMsg = (data && data.error) || ('Błąd serwera HTTP ' + res.status);
              if ((res.status === 401 || res.status === 403) && !(opts && opts.silentAuthError)) {
                if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
                  try {
                    window.dispatchEvent(new CustomEvent('smpl:server-rejected', { detail: { status: res.status } }));
                  } catch (e) {}
                }
                pullFromServer();
              }
              return { ok: false, status: res.status, error: errMsg };
            }
            backendOnline = true;
            if (data.state && Array.isArray(data.state.players)) {
              state = data.state;
              ensureLeaguesStructure(state);
              ensureClansStructure(state);
              ensureMasterExtensions(state);
              ensureCompetitionsStructure(state);
              applyLocalNotifPrefsToState(state);
              try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
            }
            return { ok: true, data: data };
          });
      })
      .catch(() => {
        backendOnline = false;
        return { ok: false, status: 0, error: netErrMsg || 'Brak połączenia z serwerem.' };
      });
  }

  function sendPlayerProfileUpdateToServer(payload, useAdminToken) {
    return sendAuthenticatedActionToServer(
      'player_profile_update',
      payload,
      useAdminToken,
      'Brak połączenia z serwerem podczas zapisu profilu.'
    );
  }

  function sendCompetitionActionToServer(payload, useAdminToken, opts) {
    return sendAuthenticatedActionToServer(
      'competition_action',
      payload,
      useAdminToken,
      'Brak połączenia z serwerem podczas zapisu akcji konkursowej.',
      opts
    );
  }

  function updateOwnProfile(options = {}) {
    const sess = getSession();
    const subj = getOwnProfileSubject(sess);
    if (!subj || !subj.canEdit) {
      throw new Error('Odmowa dostępu: zaloguj się na konto zawodnika lub administratora, aby edytować awatar i Bio.');
    }
    const isAdminSess = isStrictAdminSession(sess);
    const hasAvatar = Boolean(options.resetAvatar) || options.avatar !== undefined;
    const hasBio = options.bio !== undefined;
    const hasVacation = options.vacation !== undefined && options.vacation && typeof options.vacation === 'object';
    if (!hasAvatar && !hasBio && !hasVacation) {
      throw new Error('Nie wprowadzono żadnych zmian w awatarze, Bio ani urlopie.');
    }

    if (subj.player && (subj.player.isBlacklisted || subj.player.banned || subj.player.customRank === 'BLACKLISTED')) {
      throw new Error('⛔ Konto znajduje się na Czarnej Liście SMPL.');
    }

    let nextAvatar = subj.avatar || '';
    if (hasAvatar) {
      if (options.resetAvatar || !String(options.avatar || '').trim()) {
        const seedIdx = Math.max(1, ((subj.player && subj.player.excelOrder) || (subj.name ? subj.name.length : 5)));
        nextAvatar = window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
          ? window.SMPL_MEDIA.generatePlayerAvatar(subj.name, subj.nick || 'SMPL', seedIdx)
          : '';
      } else {
        nextAvatar = validateProfileAvatar(options.avatar);
      }
    }

    const nextBio = hasBio ? sanitizeProfileBio(options.bio) : (subj.bio || '');
    const nowStr = nowFormatted();
    const cleanVac = hasVacation
      ? {
          isOnVacation: Boolean(options.vacation.isOnVacation),
          untilDate: /^\d{4}-\d{2}-\d{2}$/.test(String(options.vacation.untilDate || '').trim()) ? String(options.vacation.untilDate).trim() : '',
          reason: String(options.vacation.reason || '').replace(/<[^>]*>/g, '').trim().slice(0, 140),
          updatedAt: nowStr
        }
      : null;

    if (subj.player) {
      if (hasAvatar) subj.player.avatar = nextAvatar;
      if (hasBio) subj.player.bio = nextBio;
      if (hasVacation) subj.player.vacation = cleanVac;
      subj.player.profileUpdatedAt = nowStr;
      const linkedAdm = subj.admin || (subj.player.adminId && (state.admins || []).find((a) => a && a.id === subj.player.adminId));
      if (linkedAdm) {
        if (hasAvatar) linkedAdm.avatar = nextAvatar;
        if (hasBio) linkedAdm.bio = nextBio;
        if (hasVacation) linkedAdm.vacation = cleanVac;
        linkedAdm.profileUpdatedAt = nowStr;
      }
      const linkedReg = (state.registrations || []).find((r) => r && r.assignedPlayerId === subj.player.id);
      if (linkedReg) {
        if (hasAvatar) linkedReg.avatar = nextAvatar;
        if (hasBio) linkedReg.bio = nextBio;
        if (hasVacation) linkedReg.vacation = cleanVac;
        linkedReg.profileUpdatedAt = nowStr;
      }
    } else if (subj.reg) {
      if (hasAvatar) subj.reg.avatar = nextAvatar;
      if (hasBio) subj.reg.bio = nextBio;
      if (hasVacation) subj.reg.vacation = cleanVac;
      subj.reg.profileUpdatedAt = nowStr;
    } else if (subj.admin) {
      if (hasAvatar) subj.admin.avatar = nextAvatar;
      if (hasBio) subj.admin.bio = nextBio;
      if (hasVacation) subj.admin.vacation = cleanVac;
      subj.admin.profileUpdatedAt = nowStr;
    }

    state.updatedAt = Date.now();
    addLog('PLAYER_PROFILE_UPDATE', `🎨 ${subj.name} zaktualizował swój awatar / Bio / status urlopu.`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const serverPayload = {};
    if (hasAvatar) serverPayload.avatar = nextAvatar;
    if (hasBio) serverPayload.bio = nextBio;
    if (hasVacation) serverPayload.vacation = cleanVac;
    if (isAdminSess && subj.player && subj.player.id) {
      serverPayload.targetPlayerId = subj.player.id;
    }

    const serverPromise = isHttpProtocol()
      ? sendPlayerProfileUpdateToServer(serverPayload, isAdminSess)
      : Promise.resolve({ ok: true, localOnly: true });

    return {
      ok: true,
      kind: subj.kind,
      id: subj.id,
      name: subj.name,
      avatar: nextAvatar,
      bio: nextBio,
      vacation: cleanVac,
      serverPromise: serverPromise
    };
  }

  function setOwnVacation(vacationOptions) {
    const src = vacationOptions && typeof vacationOptions === 'object' ? vacationOptions : {};
    return updateOwnProfile({
      vacation: {
        isOnVacation: src.isOnVacation !== undefined ? Boolean(src.isOnVacation) : Boolean(src.enabled),
        untilDate: src.untilDate !== undefined ? String(src.untilDate || '') : String(src.until || ''),
        reason: src.reason !== undefined ? String(src.reason || '') : String(src.note || '')
      }
    });
  }

  // --- ARCHIWIZACJA SEZONU DO HISTORII + NADAwanie TROFEÓW + ZŁOTA PIŁKA ---
  function awardTrophyToPlayer(playerId, { icon, title, season, rarity }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const player = (state.players || []).find((p) => p.id === playerId);
    if (!player) throw new Error('Nie znaleziono gracza.');

    if (!player.trophies) player.trophies = [];
    const newTrophy = {
      id: 'TR_CUSTOM_' + Date.now(),
      icon: icon || '🏆',
      title: (title || 'Wyróżnienie Specjalne Score Match Liga').trim(),
      season: String(season || ('Sezon ' + (state.season || 56))).trim(),
      rarity: rarity || 'GOLD'
    };
    player.trophies.unshift(newTrophy);

    pushPlayerNotification(player, {
      idPrefix: 'NOTIF_TR',
      type: 'PRIZE',
      icon: newTrophy.icon || '🏆',
      title: 'Dostałeś nową nagrodę / trofeum!',
      text: `Admin ${adminName} przyznał Ci nowe trofeum do Gabloty: ${newTrophy.icon} ${newTrophy.title} (${newTrophy.season})!`
    });

    addLog(
      'TROPHY_AWARD',
      `🏆 Admin ${adminName} nadał trofeum „${newTrophy.icon} ${newTrophy.title}” graczowi ${player.name}!`
    );
    syncToBackend();
    return player;
  }

  function archiveCurrentSeason(adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const seasonNum = Number(state.season || 56);
    const activeIds = getActiveLeagueIds(state).slice();
    (state.players || []).forEach((p) => {
      if (p && p.active !== false && p.leagueId && /^L\d{1,2}$/i.test(String(p.leagueId)) && activeIds.indexOf(p.leagueId) === -1) {
        activeIds.push(p.leagueId);
      }
    });
    activeIds.sort((a, b) => getLeagueNumber(a) - getLeagueNumber(b));

    function mapStandingsToArchive(rows, leagueLabel) {
      return rows.map((r) => ({
        pos: r.position,
        name: r.name,
        M: r.M,
        W: r.W,
        R: r.R,
        P: r.P,
        BZ: r.BZ,
        BS: r.BS,
        diff: r.diff,
        PKT: r.PKT,
        note:
          r.position === 1
            ? '👑 MISTRZ ' + leagueLabel + ' S' + seasonNum
            : r.position === 2
            ? '🥈 WICEMISTRZ ' + leagueLabel + ' S' + seasonNum
            : r.position === 3
            ? '🥉 III MIEJSCE ' + leagueLabel + ' S' + seasonNum
            : r.zone
            ? r.zone.label
            : ''
      }));
    }

    const standingsByLeague = {};
    const archivedLeaguesMap = {};
    const championsMap = {};
    const groupsList = [];

    activeIds.forEach((lid) => {
      const rows = window.SMPL_ENGINE.calculateStandings(state, lid);
      standingsByLeague[lid] = rows;
      const lgCfg = state.leagues && state.leagues[lid];
      const shortLbl = (lgCfg && lgCfg.shortName) || lid;
      const archLabel = lid === 'L1' ? 'POLSKI (L1)' : (shortLbl + ' (' + lid + ')');
      archivedLeaguesMap[lid] = mapStandingsToArchive(rows, archLabel);
      const champName = rows[0] && rows[0].M > 0 ? rows[0].name + ' 👑' : 'Brak';
      championsMap[lid] = champName;
      groupsList.push({
        lid: lid,
        list: rows,
        label: (lgCfg && lgCfg.name) || (lid + ' SMPL')
      });
    });

    const archiveEntry = {
      seasonNumber: seasonNum,
      yearLabel: `Sezon ${seasonNum} (Zarchiwizowany przez: ${adminName} • ${nowFormatted()})`,
      leagueCount: activeIds.length,
      champions: championsMap,
      championL1: championsMap.L1 || 'Brak 👑',
      championL2: championsMap.L2 || 'Brak 👑',
      championL3: championsMap.L3 || '—',
      leagues: archivedLeaguesMap
    };

    if (!state.historicalSeasons) state.historicalSeasons = [];
    const existingIdx = state.historicalSeasons.findIndex((s) => Number(s.seasonNumber) === seasonNum);
    if (existingIdx >= 0) {
      state.historicalSeasons[existingIdx] = archiveEntry;
    } else {
      state.historicalSeasons.unshift(archiveEntry);
    }

    if (!state.allTimeRanking) state.allTimeRanking = [];
    if (!state.careerRanking) state.careerRanking = [];
    const playersToRefreshRank = [];

    // Automatycznie dopisz medale do Gabloty oraz dolicz rozegrany sezon do Kariery & Rankingu All-Time (idempotentnie)
    groupsList.forEach((group) => {
      group.list.forEach((row, idx) => {
        if (!row || Number(row.M || 0) <= 0) return;
        const p = (state.players || []).find((pl) => pl.id === row.playerId);
        if (!p) return;

        // 1. Medale za Top 3 (tylko gdy gracz rozegrał przynajmniej 1 mecz)
        if (idx < 3) {
          if (!p.trophies) p.trophies = [];
          const icons = ['👑', '🥈', '🥉'];
          const titles = ['Mistrz ' + group.label, 'Wicemistrz ' + group.label, 'Brązowy Medalista ' + group.label];
          const rarities = ['LEGENDARY', 'GOLD', 'SILVER'];
          const trId = `TR_ARCH_S${seasonNum}_${p.id}`;
          if (!p.trophies.some((t) => t.id === trId)) {
            p.trophies.unshift({
              id: trId,
              icon: icons[idx],
              title: titles[idx] + ' (' + row.PKT + ' pkt)',
              season: 'Sezon ' + seasonNum,
              rarity: rarities[idx]
            });
            pushPlayerNotification(p, {
              idPrefix: 'NOTIF_MEDAL',
              type: 'PRIZE',
              icon: icons[idx],
              title: `Medal na zakończenie Sezonu ${seasonNum}!`,
              text: `Gratulacje! Zdobyłeś nagrodę: ${titles[idx]} (${row.PKT} pkt) — medal trafił do Twojej Gabloty Trofeów!`
            });
          }
        }

        // 2. Idempotentny merge statystyk kariery (S1–S55 + kolejne sezony bez dublowania)
        if (!Array.isArray(p.archivedSeasons)) p.archivedSeasons = [];
        if (p.archivedSeasons.indexOf(seasonNum) === -1) {
          p.archivedSeasons.push(seasonNum);
          const base = p.historicalStats
            ? JSON.parse(JSON.stringify(p.historicalStats))
            : {
                rank: '-',
                name: p.historicalArchiveName || p.name,
                seasons: 0,
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gf: 0,
                ga: 0,
                gd: 0,
                winPct: 0,
                points: 0,
                gold: 0,
                silver: 0,
                bronze: 0,
                bestPos: '',
                total: 0
              };

          const addG = row.position === 1 ? 1 : 0;
          const addS = row.position === 2 ? 1 : 0;
          const addB = row.position === 3 ? 1 : 0;

          base.seasons = Number(base.seasons || 0) + 1;
          base.matches = Number(base.matches || 0) + Number(row.M || 0);
          base.wins = Number(base.wins || 0) + Number(row.W || 0);
          base.draws = Number(base.draws || 0) + Number(row.R || 0);
          base.losses = Number(base.losses || 0) + Number(row.P || 0);
          base.gf = Number(base.gf || 0) + Number(row.BZ || 0);
          base.ga = Number(base.ga || 0) + Number(row.BS || 0);
          base.gd = base.gf - base.ga;
          base.winPct = base.matches > 0 ? Number(((base.wins / base.matches) * 100).toFixed(1)) : 0;
          base.points = Number(base.points || 0) + Number(row.PKT || 0);
          base.gold = Number(base.gold || 0) + addG;
          base.silver = Number(base.silver || 0) + addS;
          base.bronze = Number(base.bronze || 0) + addB;
          base.total = Number(base.total || 0) + Number(row.PKT || 0) + addG * 30 + addS * 20 + addB * 10;

          if (row.position === 1) {
            base.bestPos = '👑 #1 Mistrz SMPL (' + group.lid + ')';
          } else if (row.position === 2 && String(base.bestPos || '').indexOf('#1') < 0) {
            base.bestPos = '🥈 #2 Wicemistrz (' + group.lid + ')';
          } else if (row.position === 3 && String(base.bestPos || '').indexOf('#1') < 0 && String(base.bestPos || '').indexOf('#2') < 0) {
            base.bestPos = '🥉 #3 Medalista (' + group.lid + ')';
          } else if (!base.bestPos) {
            base.bestPos = '#' + row.position + ' (' + group.lid + ')';
          }

          p.historicalStats = base;

          const lookupFold = canonicalArchiveFold(p.historicalArchiveName || p.name || '');
          const careerIdx = state.careerRanking.findIndex(
            (a) => canonicalArchiveFold(a.name) === lookupFold || canonicalArchiveFold(a.name) === canonicalArchiveFold(p.name)
          );
          const displayName = (careerIdx >= 0 && state.careerRanking[careerIdx].name) || p.historicalArchiveName || canonicalArchiveName(p.name);
          const careerRow = Object.assign({}, base, { name: displayName });
          if (careerIdx >= 0) {
            state.careerRanking[careerIdx] = careerRow;
          } else {
            state.careerRanking.push(careerRow);
          }

          if (group.lid === 'L1') {
            const rankIdx = state.allTimeRanking.findIndex(
              (a) => canonicalArchiveFold(a.name) === lookupFold || canonicalArchiveFold(a.name) === canonicalArchiveFold(p.name)
            );
            const atPrev = rankIdx >= 0 ? state.allTimeRanking[rankIdx] : {
              name: displayName,
              seasons: 0, matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0,
              points: 0, posPts: 0, total: 0, gold: 0, silver: 0, bronze: 0
            };
            const l1PosPtsAdd = row.position >= 1 && row.position <= 16 ? (POS_PTS_L1[row.position] || 0) : 0;
            const l1Matches = Number(atPrev.matches || 0) + Number(row.M || 0);
            const l1Wins = Number(atPrev.wins || 0) + Number(row.W || 0);
            const l1Gf = Number(atPrev.gf || 0) + Number(row.BZ || 0);
            const l1Ga = Number(atPrev.ga || 0) + Number(row.BS || 0);
            const l1Points = Number(atPrev.points || 0) + Number(row.PKT || 0);
            const l1PosPts = Number(atPrev.posPts || 0) + l1PosPtsAdd;
            const l1Gold = Number(atPrev.gold || 0) + addG;
            const l1Silver = Number(atPrev.silver || 0) + addS;
            const l1Bronze = Number(atPrev.bronze || 0) + addB;
            const atUpdated = {
              rank: atPrev.rank || '-',
              name: displayName,
              bestPos: formatArchiveBestPos(
                row.position === 1 ? 1 : (atPrev.gold > 0 ? 1 : (row.position === 2 ? 2 : (atPrev.silver > 0 ? 2 : (row.position === 3 ? 3 : row.position)))),
                'L1',
                true
              ),
              seasons: Number(atPrev.seasons || 0) + 1,
              matches: l1Matches,
              wins: l1Wins,
              draws: Number(atPrev.draws || 0) + Number(row.R || 0),
              losses: Number(atPrev.losses || 0) + Number(row.P || 0),
              gf: l1Gf,
              ga: l1Ga,
              gd: l1Gf - l1Ga,
              winPct: l1Matches > 0 ? Number(((l1Wins / l1Matches) * 100).toFixed(1)) : 0,
              points: l1Points,
              pts: l1Points,
              posPts: l1PosPts,
              total: l1Points + l1PosPts,
              gold: l1Gold,
              silver: l1Silver,
              bronze: l1Bronze,
              medals: l1Gold + l1Silver + l1Bronze
            };
            if (rankIdx >= 0) {
              state.allTimeRanking[rankIdx] = atUpdated;
            } else {
              state.allTimeRanking.push(atUpdated);
            }
          }

          playersToRefreshRank.push({ player: p, lookupFold: lookupFold, inL1: group.lid === 'L1' });
        }
      });
    });

    if (playersToRefreshRank.length > 0) {
      if (state.careerRanking.length > 0) {
        state.careerRanking.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
        state.careerRanking.forEach((item, idx) => {
          item.rank = idx + 1;
          item.pos = idx + 1;
        });
      }
      if (state.allTimeRanking.length > 0) {
        state.allTimeRanking.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
        state.allTimeRanking.forEach((item, idx) => {
          item.rank = idx + 1;
          item.pos = idx + 1;
        });
      }
      playersToRefreshRank.forEach((entry) => {
        const foundL1Row = state.allTimeRanking.find((a) => canonicalArchiveFold(a.name) === entry.lookupFold);
        const foundCareerRow = state.careerRanking.find((a) => canonicalArchiveFold(a.name) === entry.lookupFold);
        if (entry.player.historicalStats) {
          if (foundCareerRow) entry.player.historicalStats.careerRank = foundCareerRow.rank;
          if (foundL1Row) {
            entry.player.historicalStats.rank = foundL1Row.rank;
          } else if (foundCareerRow) {
            entry.player.historicalStats.rank = foundCareerRow.rank + ' (L1\u2013L9)';
          }
        }
      });
    }

    __histCatalogCacheKey = '';
    __histCatalogCache = null;

    addLog(
      'SEASON_ARCHIVE',
      `📦 Admin ${adminName} zarchiwizował pełne tabele i statystyki Sezonu ${seasonNum} do Archiwum Historycznego oraz rozdał medale za Podium!`
    );
    syncToBackend();
    return archiveEntry;
  }

  function foldGbVoterIdentity(val) {
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

  function findExistingGoldenBallVote(votes, actor) {
    if (!Array.isArray(votes) || !actor) return null;
    const actorIdFold = foldGbVoterIdentity(actor.actorId || '');
    const actorPlrFold = foldGbVoterIdentity(actor.actorPlayerId || '');
    const actorNameFold = foldGbVoterIdentity(actor.actorName || '');
    for (let i = 0; i < votes.length; i++) {
      const v = votes[i];
      if (!v) continue;
      const vIdFold = foldGbVoterIdentity(v.voterId || '');
      const vPlrFold = foldGbVoterIdentity(v.voterPlayerId || '');
      const vNameFold = foldGbVoterIdentity(v.voterName || '');
      if (actorIdFold && vIdFold && vIdFold === actorIdFold) return v;
      if (actorPlrFold && (vPlrFold === actorPlrFold || (vIdFold && vIdFold === ('plr_' + actorPlrFold)))) return v;
      if (!vIdFold && !vPlrFold && actorNameFold && vNameFold && vNameFold === actorNameFold) return v;
    }
    return null;
  }

  function getGoldenBallVoteStatus(sessionArg) {
    const sess = sessionArg || getSession();
    const isAdmin = isStrictAdminSession(sess);
    const isLoggedIn = Boolean(sess && !sess.isGuest && (sess.isPlayerAuthenticated || isAdmin || sess.registeredId));
    const isOpen = !(state.goldenBall && state.goldenBall.isOpen === false);
    if (!isLoggedIn) {
      return {
        isLoggedIn: false,
        isAdmin: false,
        isOpen: isOpen,
        actor: null,
        myVote: null,
        hasVoted: false,
        blockedSelfPlayerId: null,
        canVote: false
      };
    }
    const actor = resolveCompetitionActor(sess);
    const votes = (state.goldenBall && Array.isArray(state.goldenBall.votes)) ? state.goldenBall.votes : [];
    const myVote = findExistingGoldenBallVote(votes, actor);
    const blockedSelfPlayerId = actor.actorPlayerId || (sess && sess.activePlayerId) || null;
    return {
      isLoggedIn: true,
      isAdmin: Boolean(actor.isAdmin),
      isOpen: isOpen,
      actor: actor,
      myVote: myVote,
      hasVoted: Boolean(myVote),
      blockedSelfPlayerId: blockedSelfPlayerId,
      canVote: !myVote && (isOpen || Boolean(actor.isAdmin))
    };
  }

  function castGoldenBallVote({ voterName, candidateId, comment }) {
    const sess = getSession();
    const isAdmin = isStrictAdminSession(sess);
    if (!sess || sess.isGuest || (!sess.isPlayerAuthenticated && !isAdmin && !sess.registeredId)) {
      throw new Error('⛔ Tylko zalogowany zawodnik lub Administrator może oddać głos w Złotej Piłce.');
    }

    if (!state.goldenBall || typeof state.goldenBall !== 'object' || Array.isArray(state.goldenBall)) {
      state.goldenBall = { season: state.season || 56, isOpen: true, winnerPlayerId: null, votes: [] };
    }
    if (!Array.isArray(state.goldenBall.votes)) {
      state.goldenBall.votes = [];
    }
    if (!isAdmin && state.goldenBall.isOpen === false) {
      throw new Error('⛔ Głosowanie w plebiscycie Złota Piłka jest aktualnie zamknięte.');
    }

    const candidate = (state.players || []).find((p) =>
      p &&
      p.id === candidateId &&
      p.active !== false &&
      !p.isPlaceholder &&
      !p.gdprDeleted &&
      !p.isBlacklisted &&
      !p.banned &&
      p.customRank !== 'BLACKLISTED' &&
      p.leagueId &&
      p.leagueId !== 'POOL'
    );
    if (!candidate) throw new Error('Wybierz aktywnego kandydata do Złotej Piłki z listy.');

    const actor = resolveCompetitionActor(sess);
    const selfPlayerId = actor.actorPlayerId || sess.activePlayerId || '';
    if (selfPlayerId && selfPlayerId === candidate.id) {
      throw new Error('⛔ Nie możesz głosować na samego siebie w plebiscycie Złota Piłka!');
    }
    if (!actor.actorPlayerId && !isAdmin && foldGbVoterIdentity(actor.actorName) === foldGbVoterIdentity(candidate.name)) {
      throw new Error('⛔ Nie możesz głosować na samego siebie w plebiscycie Złota Piłka!');
    }

    const existingVote = findExistingGoldenBallVote(state.goldenBall.votes, actor);
    if (existingVote) {
      throw new Error(`⛔ Już oddałeś swój jedyny głos (${existingVote.candidateName || 'Złota Piłka'}). Zasada SMPL: 1 gracz = 1 głos.`);
    }

    const resolvedVoterName = actor.actorName || (voterName || (isAdmin ? 'Administrator SMPL' : 'Gracz Ligi')).trim();
    const cleanComment = (comment || 'Zasłużony głos za formę w Lidze!').trim().slice(0, 240);

    const newVote = {
      id: 'GB_V_' + Date.now() + '_' + Math.floor(10 + Math.random() * 89),
      voterId: actor.actorId,
      voterPlayerId: selfPlayerId || null,
      voterName: resolvedVoterName,
      voterNick: actor.actorNick || '',
      candidateId: candidate.id,
      candidateName: candidate.name,
      points: 1,
      comment: cleanComment,
      createdAt: nowFormatted()
    };

    const prevVotes = state.goldenBall.votes.slice();
    state.goldenBall.votes.push(newVote);
    addLog(
      'GOLDEN_BALL_VOTE',
      `🏆 ${newVote.voterName} oddał swój jedyny głos (1/1) w Złotej Piłce na: ${candidate.name}!`
    );
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer(
          {
            op: 'golden_ball_vote',
            candidateId: candidate.id,
            comment: cleanComment
          },
          isAdmin
        ).then((srvRes) => {
          if (srvRes && !srvRes.ok && !srvRes.localOnly) {
            state.goldenBall.votes = prevVotes;
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
          }
          return srvRes;
        })
      : Promise.resolve({ ok: true, localOnly: true });

    try {
      Object.defineProperty(newVote, 'remotePromise', {
        value: remotePromise,
        enumerable: false,
        configurable: true
      });
    } catch (e) {
      newVote.remotePromise = remotePromise;
    }
    return newVote;
  }

  function adminAwardGoldenBallWinner(adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const gbData = window.SMPL_ENGINE.calculateGoldenBallStandings(state);
    const winner = gbData.candidates[0];
    if (!winner) throw new Error('Brak kandydatów w plebiscycie.');
    winner.playerName = winner.name;

    state.goldenBall.winnerPlayerId = winner.playerId;
    awardTrophyToPlayer(
      winner.playerId,
      {
        icon: '🏆⚽',
        title: `Laureat Złotej Piłki SMPL (${winner.finalScore} pkt łącznych • SI ${winner.meritScore}/100 • ${winner.votes} gł.)`,
        season: 'Sezon ' + ((state.goldenBall && state.goldenBall.season) || state.season || 56),
        rarity: 'LEGENDARY'
      },
      adminName
    );

    addLog(
      'GOLDEN_BALL_WINNER',
      `🏆👑 Admin ${adminName} oficjalnie wręczył Złotą Piłkę Score Match Liga zawodnikowi: ${winner.name} (${winner.finalScore} pkt • SI ${winner.meritScore}/100 • ${winner.votes} gł.)!`
    );
    syncToBackend();
    return winner;
  }

  // =========================================================================
  // KONKURSY PIŁKARSKIE SMPL (ZŁOTY BUT, PUCHAR LIGI KO, TYPER, PUSKÁS, FAIR PLAY)
  // =========================================================================
  function buildDefaultCompetitionsState(seasonNum) {
    const s = Number(seasonNum || 56);
    return {
      season: s,
      cup: {
        id: 'CUP_S' + s,
        name: 'Puchar Ligi SMPL',
        size: 8,
        mode: 'TOP_RANKED',
        status: 'NOT_STARTED',
        rounds: [],
        winnerPlayerId: null,
        createdAt: null
      },
      typerOpen: true,
      typerPredictions: [],
      puskasOpen: true,
      puskasWinnerNominationId: null,
      puskasNominations: [],
      awardedHonors: {},
      blitzCup: {
        id: 'BLITZ_S' + s,
        name: 'Weekendowy Blitz Cup SMPL',
        size: 8,
        status: 'NOT_STARTED',
        rounds: [],
        winnerPlayerId: null,
        createdAt: null
      },
      supercup: {
        status: 'NOT_STARTED',
        season: s,
        homePlayerId: null,
        awayPlayerId: null,
        homeScore: null,
        awayScore: null,
        penWinnerId: null,
        winnerPlayerId: null,
        updatedAt: null
      },
      playoffs: {
        status: 'NOT_STARTED',
        ties: [],
        resolvedAt: null
      },
      matchProposals: [],
      matchDisputes: [],
      fanPolls: {},
      totwHistory: [],
      playerShop: { unlocks: {}, bonusCoins: {}, giftHistory: [] },
      smplTV: {
        liveStream: { isLive: false, title: '', url: '', streamerName: '', updatedAt: '' },
        clips: []
      },
      newsletter: { current: null, archive: [] },
      draftSession: null
    };
  }

  function ensureCompetitionsStructure(targetState) {
    const st = targetState || state;
    const s = Number((st && st.season) || 56);
    if (!st.competitions || typeof st.competitions !== 'object' || Array.isArray(st.competitions)) {
      st.competitions = buildDefaultCompetitionsState(s);
    }
    const c = st.competitions;
    const def = buildDefaultCompetitionsState(s);
    if (!c.cup || typeof c.cup !== 'object' || Array.isArray(c.cup)) c.cup = def.cup;
    if (!Array.isArray(c.cup.rounds)) c.cup.rounds = [];
    if (c.typerOpen === undefined) c.typerOpen = true;
    if (!Array.isArray(c.typerPredictions)) c.typerPredictions = [];
    if (c.puskasOpen === undefined) c.puskasOpen = true;
    if (!Array.isArray(c.puskasNominations)) c.puskasNominations = [];
    if (!c.awardedHonors || typeof c.awardedHonors !== 'object' || Array.isArray(c.awardedHonors)) c.awardedHonors = {};
    if (!c.blitzCup || typeof c.blitzCup !== 'object' || Array.isArray(c.blitzCup)) c.blitzCup = def.blitzCup;
    if (!Array.isArray(c.blitzCup.rounds)) c.blitzCup.rounds = [];
    if (!c.supercup || typeof c.supercup !== 'object' || Array.isArray(c.supercup)) c.supercup = def.supercup;
    if (!c.playoffs || typeof c.playoffs !== 'object' || Array.isArray(c.playoffs)) c.playoffs = def.playoffs;
    if (!Array.isArray(c.playoffs.ties)) c.playoffs.ties = [];
    if (!Array.isArray(c.matchProposals)) c.matchProposals = [];
    if (!Array.isArray(c.matchDisputes)) c.matchDisputes = [];
    if (!c.fanPolls || typeof c.fanPolls !== 'object' || Array.isArray(c.fanPolls)) c.fanPolls = {};
    if (!Array.isArray(c.totwHistory)) c.totwHistory = [];
    if (!c.playerShop || typeof c.playerShop !== 'object' || Array.isArray(c.playerShop)) c.playerShop = def.playerShop;
    if (!c.playerShop.unlocks || typeof c.playerShop.unlocks !== 'object' || Array.isArray(c.playerShop.unlocks)) c.playerShop.unlocks = {};
    if (!c.playerShop.bonusCoins || typeof c.playerShop.bonusCoins !== 'object' || Array.isArray(c.playerShop.bonusCoins)) c.playerShop.bonusCoins = {};
    if (!Array.isArray(c.playerShop.giftHistory)) c.playerShop.giftHistory = [];
    if (!c.smplTV || typeof c.smplTV !== 'object' || Array.isArray(c.smplTV)) c.smplTV = def.smplTV;
    if (!c.smplTV.liveStream || typeof c.smplTV.liveStream !== 'object' || Array.isArray(c.smplTV.liveStream)) c.smplTV.liveStream = def.smplTV.liveStream;
    if (!Array.isArray(c.smplTV.clips)) c.smplTV.clips = [];
    if (!c.newsletter || typeof c.newsletter !== 'object' || Array.isArray(c.newsletter)) c.newsletter = def.newsletter;
    if (!Array.isArray(c.newsletter.archive)) c.newsletter.archive = [];
    return c;
  }

  function resolveCompetitionActor(sess) {
    const s = sess || getSession();
    const isAdmin = isStrictAdminSession(s);
    if (!s || s.isGuest || (!s.isPlayerAuthenticated && !isAdmin)) {
      throw new Error('⛔ Zaloguj się jako Zawodnik lub Administrator, aby wziąć udział w konkursie.');
    }
    if (isAdmin) {
      const admPlayer = findPlayerForAdmin(s.adminId, state);
      return {
        isAdmin: true,
        actorId: 'ADM_' + String(s.adminId || 'ADM'),
        actorPlayerId: admPlayer ? admPlayer.id : '',
        actorName: String(s.adminName || 'Administrator SMPL'),
        actorNick: admPlayer ? String(admPlayer.nick || '') : ''
      };
    }
    const pl = s.activePlayerId ? (state.players || []).find((p) => p && p.id === s.activePlayerId) : null;
    if (pl) {
      if (pl.isBlacklisted || pl.banned || pl.customRank === 'BLACKLISTED' || isUserBlacklisted(pl.name, pl.nick)) {
        throw new Error('⛔ Konto znajduje się na Czarnej Liście SMPL.');
      }
      return {
        isAdmin: false,
        actorId: 'PLR_' + pl.id,
        actorPlayerId: pl.id,
        actorName: pl.name,
        actorNick: pl.nick || ''
      };
    }
    const reg = s.activeRegId ? (state.registrations || []).find((r) => r && r.id === s.activeRegId) : null;
    if (reg) {
      return {
        isAdmin: false,
        actorId: 'REG_' + reg.id,
        actorPlayerId: '',
        actorName: reg.name,
        actorNick: reg.nick || ''
      };
    }
    throw new Error('Nie znaleziono aktywnego profilu konta.');
  }

  function submitTyperPrediction({ matchId, predHome, predAway }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    if (comp.typerOpen === false && !actor.isAdmin) {
      throw new Error('⏳ Typer Kolejki jest obecnie zamknięty przez Administrację.');
    }
    const mId = String(matchId || '').trim();
    const ph = Number(predHome);
    const pa = Number(predAway);
    if (!mId || !isValidLeagueGoalPair(ph, pa, false)) {
      throw new Error('⚽ W lidze Score! Match mecz kończy się przy max 2 bramkach — wpisz typ 0–2 (bez 2:2, np. 2:1, 2:0, 1:1).');
    }
    const match = (state.matches || []).find((m) => m && m.id === mId);
    if (!match) throw new Error('Nie znaleziono wybranego meczu.');
    if (match.status !== 'SCHEDULED') {
      throw new Error('⏳ Mecz został już rozegrany lub oczekuje na weryfikację — nie można zmienić typu.');
    }
    const nowStr = nowFormatted();
    let entry = comp.typerPredictions.find((pr) => pr && pr.matchId === mId && pr.voterId === actor.actorId);
    if (entry) {
      entry.predHome = ph;
      entry.predAway = pa;
      entry.updatedAt = nowStr;
    } else {
      entry = {
        id: 'TYP_' + Date.now() + '_' + Math.floor(Math.random() * 900 + 100),
        matchId: mId,
        voterId: actor.actorId,
        voterPlayerId: actor.actorPlayerId || null,
        voterName: actor.actorName,
        voterNick: actor.actorNick,
        predHome: ph,
        predAway: pa,
        createdAt: nowStr,
        updatedAt: nowStr
      };
      comp.typerPredictions.push(entry);
    }
    addLog('TYPER_PREDICT', `🔮 ${actor.actorName} wytypował wynik ${ph}:${pa} w Typerze Kolejki.`);
    if (isHttpProtocol()) {
      const remotePromise = sendCompetitionActionToServer({ op: 'typer_predict', matchId: mId, predHome: ph, predAway: pa }, actor.isAdmin);
      return { ok: true, prediction: entry, remotePromise };
    }
    syncToBackend();
    return { ok: true, prediction: entry, remotePromise: Promise.resolve({ ok: true, localOnly: true }) };
  }

  function nominatePuskasGoal({ playerId, matchId, title, description, clipUrl }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    if (comp.puskasOpen === false && !actor.isAdmin) {
      throw new Error('⏳ Zgłoszenia do Nagrody Puskása są obecnie zamknięte.');
    }
    const cleanTitle = String(title || '').replace(/<[^>]*>/g, '').trim().slice(0, 100);
    const cleanDesc = String(description || '').replace(/<[^>]*>/g, '').trim().slice(0, 240);
    const cleanClip = String(clipUrl || '').trim();
    if (!playerId || cleanTitle.length < 4) {
      throw new Error('Wybierz strzelca bramki i podaj tytuł akcji (min. 4 znaki).');
    }
    if (cleanClip && !/^https?:\/\/[^\s"'<>]{4,500}$/i.test(cleanClip)) {
      throw new Error('Link do powtórki musi zaczynać się od https:// lub http://.');
    }
    const scorer = (state.players || []).find((p) => p && p.id === playerId);
    if (!scorer) throw new Error('Nie znaleziono wskazanego zawodnika.');
    if (comp.puskasNominations.length >= 60) {
      throw new Error('Osiągnięto limit 60 nominacji do Nagrody Puskása w tym sezonie.');
    }
    const nom = {
      id: 'PUS_' + Date.now() + '_' + Math.floor(Math.random() * 900 + 100),
      playerId: scorer.id,
      playerName: scorer.name,
      nick: scorer.nick || '',
      leagueId: scorer.leagueId || 'L1',
      matchId: String(matchId || '').trim(),
      title: cleanTitle,
      description: cleanDesc,
      clipUrl: cleanClip,
      nominatedById: actor.actorId,
      nominatedByName: actor.actorName,
      votes: [],
      createdAt: nowFormatted()
    };
    comp.puskasNominations.push(nom);
    addLog('PUSKAS_NOMINATE', `🥅 ${actor.actorName} nominował bramkę gracza ${scorer.name} („${cleanTitle}”) do Nagrody Puskása!`);
    if (isHttpProtocol()) {
      const remotePromise = sendCompetitionActionToServer(
        { op: 'puskas_nominate', playerId: scorer.id, matchId: nom.matchId, title: cleanTitle, description: cleanDesc, clipUrl: cleanClip },
        actor.isAdmin
      );
      return { ok: true, nomination: nom, remotePromise };
    }
    syncToBackend();
    return { ok: true, nomination: nom, remotePromise: Promise.resolve({ ok: true, localOnly: true }) };
  }

  function votePuskasGoal(nominationId) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    if (comp.puskasOpen === false && !actor.isAdmin) {
      throw new Error('⏳ Głosowanie w Nagrodzie Puskása jest obecnie zamknięte.');
    }
    const nom = comp.puskasNominations.find((n) => n && n.id === nominationId);
    if (!nom) throw new Error('Nie znaleziono nominacji Puskása.');
    if (!actor.isAdmin && actor.actorPlayerId && nom.playerId === actor.actorPlayerId) {
      throw new Error('⛔ Nie możesz głosować na własną bramkę w Nagrodzie Puskása!');
    }
    if (!Array.isArray(nom.votes)) nom.votes = [];
    const idx = nom.votes.indexOf(actor.actorId);
    let voted = false;
    if (idx >= 0) {
      nom.votes.splice(idx, 1);
      voted = false;
    } else {
      nom.votes.push(actor.actorId);
      voted = true;
    }
    addLog('PUSKAS_VOTE', `⚽🔥 ${actor.actorName} ${voted ? 'zagłosował na' : 'cofnął głos na'} nominację „${nom.title}”.`);
    if (isHttpProtocol()) {
      const remotePromise = sendCompetitionActionToServer({ op: 'puskas_vote', nominationId: nom.id }, actor.isAdmin);
      return { ok: true, voted, nomination: nom, remotePromise };
    }
    syncToBackend();
    return { ok: true, voted, nomination: nom, remotePromise: Promise.resolve({ ok: true, localOnly: true }) };
  }

  function getCupBracketSeedOrder(bracketSize) {
    if (bracketSize === 4) return [0, 3, 1, 2];
    if (bracketSize === 16) return [0, 15, 7, 8, 3, 12, 4, 11, 2, 13, 5, 10, 1, 14, 6, 9];
    return [0, 7, 3, 4, 2, 5, 1, 6];
  }

  function getCupRoundTitle(roundIndex, totalRounds) {
    const fromFinal = totalRounds - 1 - roundIndex;
    if (fromFinal === 0) return '🏆 Wielki Finał';
    if (fromFinal === 1) return '🔥 Półfinały';
    if (fromFinal === 2) return '⚔️ Ćwierćfinały';
    return '🏟️ 1/8 Finału';
  }

  function generateLeagueCupBracket({ size, mode }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const activePlayers = (state.players || []).filter(function (p) {
      return p && p.active !== false && !p.isPlaceholder && !p.gdprDeleted && p.leagueId !== 'POOL';
    });
    if (activePlayers.length < 2) {
      throw new Error('Do rozlosowania Pucharu Ligi SMPL potrzeba co najmniej 2 aktywnych zawodników w ligach.');
    }

    const reqSize = Number(size) === 16 ? 16 : Number(size) === 4 ? 4 : 8;
    const drawMode = mode === 'RANDOM_DRAW' ? 'RANDOM_DRAW' : 'TOP_RANKED';

    const standingsById = {};
    if (window.SMPL_ENGINE) {
      const leaguesSet = {};
      activePlayers.forEach((p) => { if (p.leagueId) leaguesSet[p.leagueId] = true; });
      Object.keys(leaguesSet).forEach((lid) => {
        window.SMPL_ENGINE.calculateStandings(state, lid).forEach((r) => {
          standingsById[r.playerId] = r;
        });
      });
    }

    let pool = activePlayers.slice();
    if (drawMode === 'RANDOM_DRAW') {
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
    } else {
      pool.sort(function (a, b) {
        const lgA = getLeagueNumber(a.leagueId || 'L1');
        const lgB = getLeagueNumber(b.leagueId || 'L1');
        if (lgA !== lgB) return lgA - lgB;
        const rA = standingsById[a.id] || { PKT: 0, diff: 0, BZ: 0 };
        const rB = standingsById[b.id] || { PKT: 0, diff: 0, BZ: 0 };
        if (rB.PKT !== rA.PKT) return rB.PKT - rA.PKT;
        if (rB.diff !== rA.diff) return rB.diff - rA.diff;
        return rB.BZ - rA.BZ;
      });
    }

    const picked = pool.slice(0, reqSize);
    let bracketSize = 4;
    if (picked.length > 4 && reqSize >= 8) bracketSize = 8;
    if (picked.length > 8 && reqSize >= 16) bracketSize = 16;

    const totalRounds = bracketSize === 16 ? 4 : bracketSize === 8 ? 3 : 2;
    const seedOrder = getCupBracketSeedOrder(bracketSize);
    const rounds = [];

    for (let r = 0; r < totalRounds; r++) {
      const matchCount = bracketSize / Math.pow(2, r + 1);
      const rMatches = [];
      for (let m = 0; m < matchCount; m++) {
        rMatches.push({
          id: 'CUPM_R' + r + '_M' + m + '_' + Date.now(),
          roundIndex: r,
          matchIndex: m,
          homeId: null,
          awayId: null,
          homeScore: null,
          awayScore: null,
          penaltyWinnerId: null,
          winnerId: null,
          status: 'SCHEDULED'
        });
      }
      rounds.push({
        roundIndex: r,
        name: getCupRoundTitle(r, totalRounds),
        matches: rMatches
      });
    }

    // Wypełniamy 1. rundę pucharową wg kolejności rozstawienia (z BYE dla brakujących slotów)
    for (let m = 0; m < rounds[0].matches.length; m++) {
      const cm = rounds[0].matches[m];
      const pHome = picked[seedOrder[m * 2]] || null;
      const pAway = picked[seedOrder[m * 2 + 1]] || null;
      cm.homeId = pHome ? pHome.id : 'BYE';
      cm.awayId = pAway ? pAway.id : 'BYE';

      if (cm.homeId !== 'BYE' && cm.awayId === 'BYE') {
        cm.status = 'BYE';
        cm.winnerId = cm.homeId;
      } else if (cm.homeId === 'BYE' && cm.awayId !== 'BYE') {
        cm.status = 'BYE';
        cm.winnerId = cm.awayId;
      } else if (cm.homeId === 'BYE' && cm.awayId === 'BYE') {
        cm.status = 'BYE';
        cm.winnerId = 'BYE';
      }

      if (cm.winnerId && rounds[1]) {
        const nextMatch = rounds[1].matches[Math.floor(m / 2)];
        if (nextMatch) {
          if (m % 2 === 0) nextMatch.homeId = cm.winnerId;
          else nextMatch.awayId = cm.winnerId;
        }
      }
    }

    const comp = ensureCompetitionsStructure(state);
    comp.cup = {
      id: 'CUP_S' + (state.season || 56) + '_' + Date.now(),
      name: 'Puchar Ligi SMPL',
      size: bracketSize,
      mode: drawMode,
      status: 'ACTIVE',
      rounds: rounds,
      winnerPlayerId: null,
      createdAt: nowFormatted()
    };

    addLog(
      'CUP_DRAW',
      `🏆 Admin ${adminName} rozlosował drabinkę Pucharu Ligi SMPL (${bracketSize} miejsc • ${picked.length} uczestników • tryb ${drawMode === 'RANDOM_DRAW' ? 'Losowy' : 'Rozstawiony'}).`
    );
    syncToBackend();
    return comp.cup;
  }

  function recordCupMatchResult({ cupMatchId, homeScore, awayScore, penaltyWinnerId }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const cup = comp.cup;
    if (!cup || !Array.isArray(cup.rounds) || cup.rounds.length === 0) {
      throw new Error('Najpierw rozlosuj drabinkę Pucharu Ligi SMPL.');
    }

    let targetRoundIdx = -1;
    let targetMatchIdx = -1;
    let targetMatch = null;
    for (let r = 0; r < cup.rounds.length; r++) {
      const mIdx = (cup.rounds[r].matches || []).findIndex((m) => m && m.id === cupMatchId);
      if (mIdx >= 0) {
        targetRoundIdx = r;
        targetMatchIdx = mIdx;
        targetMatch = cup.rounds[r].matches[mIdx];
        break;
      }
    }
    if (!targetMatch) throw new Error('Nie znaleziono meczu w drabince Pucharu.');
    if (!targetMatch.homeId || !targetMatch.awayId || targetMatch.homeId === 'BYE' || targetMatch.awayId === 'BYE') {
      throw new Error('Poczekaj aż obaj rywale awansują do tego meczu pucharowego.');
    }

    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!isValidLeagueGoalPair(hs, as, false)) {
      throw new Error('⚽ W Score! Match mecz pucharowy trwa do max 2 bramek (0–2, bez 2:2; przy remisie 0:0 lub 1:1 wskaż zwycięzcę karnych).');
    }

    let winnerId = null;
    let cleanPenWinner = null;
    if (hs > as) {
      winnerId = targetMatch.homeId;
    } else if (as > hs) {
      winnerId = targetMatch.awayId;
    } else {
      if (penaltyWinnerId !== targetMatch.homeId && penaltyWinnerId !== targetMatch.awayId) {
        throw new Error('⚽ Przy remisie w fazie pucharowej wskaż zwycięzcę po rzutach karnych!');
      }
      winnerId = penaltyWinnerId;
      cleanPenWinner = penaltyWinnerId;
    }

    targetMatch.homeScore = hs;
    targetMatch.awayScore = as;
    targetMatch.penaltyWinnerId = cleanPenWinner;
    targetMatch.winnerId = winnerId;
    targetMatch.status = 'FINISHED';

    // Automatyczny awans zwycięzcy do kolejnej rundy pucharowej
    if (targetRoundIdx + 1 < cup.rounds.length) {
      let curIdx = targetMatchIdx;
      let curWinner = winnerId;
      for (let nr = targetRoundIdx + 1; nr < cup.rounds.length; nr++) {
        const slotIdx = Math.floor(curIdx / 2);
        const isTopSlot = curIdx % 2 === 0;
        const nm = cup.rounds[nr].matches[slotIdx];
        if (!nm) break;
        const prevSlotVal = isTopSlot ? nm.homeId : nm.awayId;
        if (isTopSlot) nm.homeId = curWinner;
        else nm.awayId = curWinner;
        if (prevSlotVal && prevSlotVal !== curWinner && nm.status === 'FINISHED') {
          nm.homeScore = null;
          nm.awayScore = null;
          nm.penaltyWinnerId = null;
          nm.winnerId = null;
          nm.status = 'SCHEDULED';
        }
        curIdx = slotIdx;
        curWinner = nm.winnerId || null;
        if (!curWinner) break;
      }
    }

    const finalRound = cup.rounds[cup.rounds.length - 1];
    const finalMatch = finalRound && finalRound.matches && finalRound.matches[0];
    if (finalMatch && finalMatch.status === 'FINISHED' && finalMatch.winnerId) {
      cup.winnerPlayerId = finalMatch.winnerId;
      cup.status = 'FINISHED';
    } else {
      cup.winnerPlayerId = null;
      cup.status = 'ACTIVE';
    }

    const wPlayer = (state.players || []).find((p) => p && p.id === winnerId);
    addLog(
      'CUP_MATCH_RESULT',
      `🏆 Admin ${adminName} zapisał wynik Pucharu Ligi (${hs}:${as}${cleanPenWinner ? ' po karnych' : ''}) — awans: ${wPlayer ? wPlayer.name : winnerId}.`
    );
    syncToBackend();
    return { cup, winnerId, match: targetMatch };
  }

  function clearCupBracket(adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    comp.cup = buildDefaultCompetitionsState(state.season || 56).cup;
    addLog('CUP_RESET', `🧹 Admin ${adminName} zresetował drabinkę Pucharu Ligi SMPL.`);
    syncToBackend();
    return comp.cup;
  }

  function adminAwardCompetitionTrophy(competitionKey, overrideTargetId = null, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const sLabel = 'Sezon ' + (state.season || 56);
    const eng = window.SMPL_ENGINE;
    if (!eng) throw new Error('Brak silnika statystyk SMPL_ENGINE.');

    let awardRes = null;
    if (competitionKey === 'golden_boot') {
      const gb = eng.calculateGoldenBootRanking(state, 'ALL');
      const top = overrideTargetId ? gb.find((x) => x.playerId === overrideTargetId) : gb[0];
      if (!top) throw new Error('Brak kandydatów do Złotego Buta.');
      awardTrophyToPlayer(top.playerId, {
        icon: '👟',
        title: `Złoty But SMPL — Król Strzelców (${top.goalsFor} goli • ${top.leagueId})`,
        season: sLabel,
        rarity: 'LEGENDARY'
      }, adminName);
      comp.awardedHonors.goldenBoot = { playerId: top.playerId, playerName: top.name, goals: top.goalsFor, awardedAt: nowFormatted(), awardedBy: adminName };
      awardRes = { label: 'Złoty But', winnerName: top.name };
    } else if (competitionKey === 'cup') {
      const winnerId = overrideTargetId || (comp.cup && comp.cup.winnerPlayerId);
      const pl = winnerId ? (state.players || []).find((p) => p && p.id === winnerId) : null;
      if (!pl) throw new Error('Wyłoń najpierw zwycięzcę Wielkiego Finału Pucharu Ligi SMPL.');
      awardTrophyToPlayer(pl.id, {
        icon: '🏆⚔️',
        title: 'Zdobywca Pucharu Ligi SMPL (Knockout)',
        season: sLabel,
        rarity: 'LEGENDARY'
      }, adminName);
      comp.awardedHonors.cupWinner = { playerId: pl.id, playerName: pl.name, awardedAt: nowFormatted(), awardedBy: adminName };
      awardRes = { label: 'Puchar Ligi SMPL', winnerName: pl.name };
    } else if (competitionKey === 'typer') {
      const typ = eng.calculateTyperLeaderboard(state);
      const top = overrideTargetId ? typ.leaderboard.find((x) => x.voterPlayerId === overrideTargetId) : typ.leaderboard[0];
      if (!top || !top.voterPlayerId) throw new Error('Lider Typera nie jest przypisanym zawodnikiem lub brak typowań.');
      awardTrophyToPlayer(top.voterPlayerId, {
        icon: '🔮',
        title: `Mistrz Typera SMPL (${top.totalPoints} pkt • 🎯 ${top.exactHits} dokładnych)`,
        season: sLabel,
        rarity: 'GOLD'
      }, adminName);
      comp.awardedHonors.typerChampion = { playerId: top.voterPlayerId, playerName: top.voterName, points: top.totalPoints, awardedAt: nowFormatted(), awardedBy: adminName };
      awardRes = { label: 'Mistrz Typera', winnerName: top.voterName };
    } else if (competitionKey === 'puskas') {
      const pus = eng.calculatePuskasStandings(state);
      const top = overrideTargetId ? pus.nominations.find((n) => n.id === overrideTargetId) : pus.nominations[0];
      if (!top) throw new Error('Brak nominacji do Nagrody Puskása.');
      comp.puskasWinnerNominationId = top.id;
      awardTrophyToPlayer(top.playerId, {
        icon: '🥅⭐',
        title: `Nagroda Puskása SMPL — Gol Sezonu („${top.title}”)`,
        season: sLabel,
        rarity: 'LEGENDARY'
      }, adminName);
      comp.awardedHonors.puskasWinner = { playerId: top.playerId, playerName: top.playerName, nominationId: top.id, title: top.title, awardedAt: nowFormatted(), awardedBy: adminName };
      awardRes = { label: 'Nagroda Puskása', winnerName: top.playerName };
    } else if (competitionKey === 'mvp_form') {
      const fr = eng.calculateSeasonFormAndRecords(state);
      const top = overrideTargetId ? fr.invincibles.find((x) => x.playerId === overrideTargetId) : fr.invincibles[0];
      if (!top) throw new Error('Brak zawodników do wyróżnienia Invincibles / MVP Formy.');
      awardTrophyToPlayer(top.playerId, {
        icon: '🔥🛡️',
        title: `Invincible & MVP Formy SMPL (Seria ${top.longestUnbeaten} bez porażki)`,
        season: sLabel,
        rarity: 'GOLD'
      }, adminName);
      comp.awardedHonors.mvpForm = { playerId: top.playerId, playerName: top.name, streak: top.longestUnbeaten, awardedAt: nowFormatted(), awardedBy: adminName };
      awardRes = { label: 'Invincible & MVP Formy', winnerName: top.name };
    } else if (competitionKey === 'fair_play') {
      const fp = eng.calculateFairPlayRanking(state);
      const top = overrideTargetId ? fp.find((x) => x.playerId === overrideTargetId) : fp[0];
      if (!top) throw new Error('Brak zawodników w rankingu Fair Play.');
      awardTrophyToPlayer(top.playerId, {
        icon: '🕊️',
        title: `Puchar Fair Play SMPL (${top.fairPlayScore} pkt Respect)`,
        season: sLabel,
        rarity: 'GOLD'
      }, adminName);
      comp.awardedHonors.fairPlay = { playerId: top.playerId, playerName: top.name, score: top.fairPlayScore, awardedAt: nowFormatted(), awardedBy: adminName };
      awardRes = { label: 'Puchar Fair Play', winnerName: top.name };
    } else if (competitionKey === 'clan_champions') {
      const clans = eng.calculateClanChampionsRanking(state);
      const topClan = overrideTargetId ? clans.find((c) => c.clanId === overrideTargetId) : clans[0];
      if (!topClan || !topClan.members || topClan.members.length === 0) {
        throw new Error('Brak aktywnych klanów z zawodnikami do nagrodzenia.');
      }
      topClan.members.forEach((m) => {
        awardTrophyToPlayer(m.playerId, {
          icon: '⚔️🏆',
          title: `Mistrzowski Klan SMPL — [${topClan.tag || topClan.name}] ${topClan.name}`,
          season: sLabel,
          rarity: 'GOLD'
        }, adminName);
      });
      comp.awardedHonors.clanChampion = { clanId: topClan.clanId, clanName: topClan.name, totalPKT: topClan.totalPKT, awardedAt: nowFormatted(), awardedBy: adminName };
      awardRes = { label: 'Mistrzowski Klan SMPL', winnerName: topClan.name };
    } else {
      throw new Error('Nieznany typ konkursu do wręczenia nagrody.');
    }

    addLog('COMPETITION_AWARD', `🏅 Admin ${adminName} wręczył trofeum (${awardRes.label}) dla: ${awardRes.winnerName}!`);
    syncToBackend();
    return awardRes;
  }

  function masterManageCompetitions(action, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const act = String(action || '');
    if (act === 'typer_open') {
      comp.typerOpen = true;
      addLog('MASTER_COMP', `🔮 Master ${adminName} otworzył Typera Kolejki.`);
    } else if (act === 'typer_close') {
      comp.typerOpen = false;
      addLog('MASTER_COMP', `🔒 Master ${adminName} zamknął Typera Kolejki.`);
    } else if (act === 'typer_clear') {
      comp.typerPredictions = [];
      addLog('MASTER_COMP', `🧹 Master ${adminName} wyczyścił typy w Typerze Kolejki.`);
    } else if (act === 'puskas_open') {
      comp.puskasOpen = true;
      addLog('MASTER_COMP', `🥅 Master ${adminName} otworzył Nagrodę Puskása.`);
    } else if (act === 'puskas_close') {
      comp.puskasOpen = false;
      addLog('MASTER_COMP', `🔒 Master ${adminName} zamknął Nagrodę Puskása.`);
    } else if (act === 'puskas_clear') {
      comp.puskasNominations = [];
      comp.puskasWinnerNominationId = null;
      addLog('MASTER_COMP', `🧹 Master ${adminName} wyczyścił nominacje do Nagrody Puskása.`);
    } else if (act.indexOf('puskas_delete:') === 0) {
      const delId = act.slice('puskas_delete:'.length);
      comp.puskasNominations = (comp.puskasNominations || []).filter((n) => n && n.id !== delId);
      addLog('MASTER_COMP', `🗑️ Master ${adminName} usunął nominację Puskása (${delId}).`);
    } else {
      throw new Error('Nieznana akcja konkursowa Master Admina.');
    }
    syncToBackend();
    return comp;
  }

  // =========================================================================
  // EXPANSION PACK (v56): KIEDY GRAMY, VAR/SPORY, URLOP, ZASTĘPSTWO, BARAŻE,
  // SUPERPUCHAR, BLITZ CUP, SKLEPIK COINS, TOTW, SMPL TV, GAZETA, DRAFT,
  // WEBHOOKI, SNAPSHOTY 14 DNI, PRZERWA TECHNICZNA, AI OCR SS
  // =========================================================================
  function getMaintenanceMode() {
    const ps = state && state.portalSettings && typeof state.portalSettings === 'object' && !Array.isArray(state.portalSettings) ? state.portalSettings : {};
    const m = ps.maintenanceMode;
    if (!m || typeof m !== 'object' || Array.isArray(m)) return { enabled: false, message: '' };
    return { enabled: Boolean(m.enabled), message: String(m.message || '') };
  }

  function setMaintenanceMode(enabled, message, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    if (!state.portalSettings || typeof state.portalSettings !== 'object' || Array.isArray(state.portalSettings)) state.portalSettings = {};
    const prevMaint = state.portalSettings.maintenanceMode && typeof state.portalSettings.maintenanceMode === 'object' && !Array.isArray(state.portalSettings.maintenanceMode)
      ? Object.assign({}, state.portalSettings.maintenanceMode)
      : { enabled: false, message: '' };
    const cleanMsg = String(message || '').replace(/<[^>]*>/g, '').trim().slice(0, 220) || 'Trwa przerwa techniczna (losowanie/aktualizacja tabel) — zgłaszanie wyników chwilowo wstrzymane.';
    const nextMaint = {
      enabled: Boolean(enabled),
      message: cleanMsg,
      updatedBy: adminName,
      updatedAt: nowFormatted()
    };
    state.portalSettings.maintenanceMode = nextMaint;
    addLog('MAINTENANCE_MODE', Boolean(enabled) ? `🚧 Admin ${adminName} WŁĄCZYŁ tryb przerwy technicznej.` : `✅ Admin ${adminName} WYŁĄCZYŁ tryb przerwy technicznej.`);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
    sendAtomicAdminAction(
      'admin_set_maintenance',
      { enabled: Boolean(enabled), message: cleanMsg },
      () => {
        if (state && state.portalSettings) state.portalSettings.maintenanceMode = prevMaint;
      },
      { maintenanceMode: nextMaint },
      (err) => {
        if (err) {
          syncToBackend();
        }
      }
    );
    return state.portalSettings.maintenanceMode;
  }

  function normalizeUpdateVersionClient(raw) {
    if (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.normalizeUpdateVersion === 'function') {
      return window.SMPL_STUDIO.normalizeUpdateVersion(raw);
    }
    const cleaned = String(raw || '').replace(/update/gi, '').replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.').filter(Boolean);
    if (!parts.length) return 'V1.0';
    const nums = parts.slice(0, 3).map((p) => Math.min(9999, Math.max(0, parseInt(p, 10) || 0)));
    if (nums.length === 1) nums.push(0);
    return 'V' + nums.join('.');
  }

  function publishPlayerUpdate(payload, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const p = payload && typeof payload === 'object' ? payload : {};
    if (!/[0-9]/.test(String(p.version || ''))) {
      throw new Error('Podaj numer wersji zawierający cyfry (np. V1.2 lub V2.0).');
    }
    const normVer = normalizeUpdateVersionClient(p.version);
    const builtinList = window.SMPL_STUDIO && Array.isArray(window.SMPL_STUDIO.BUILTIN_PLAYER_UPDATES)
      ? window.SMPL_STUDIO.BUILTIN_PLAYER_UPDATES
      : [];
    if (builtinList.some((b) => b && b.version === normVer)) {
      const nextHint = window.SMPL_STUDIO && typeof window.SMPL_STUDIO.getNextUpdateVersionSuggestion === 'function'
        ? window.SMPL_STUDIO.getNextUpdateVersionSuggestion(state)
        : 'V1.2';
      throw new Error('Wersja Update ' + normVer + ' należy już do wbudowanej historii zmian. Wybierz kolejny numer (np. ' + nextHint + ').');
    }

    const cleanTitle = String(p.title || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
    const cleanSummary = String(p.summary || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
    const rawHighlights = Array.isArray(p.highlights)
      ? p.highlights
      : String(p.highlights || '').split(/\r?\n/);
    const cleanHighlights = rawHighlights
      .map((line) => String(line || '').replace(/<[^>]*>/g, '').replace(/^[•\-*]\s*/, '').trim().slice(0, 260))
      .filter(Boolean)
      .slice(0, 20);

    if (cleanTitle.length < 3) {
      throw new Error('Wpisz czytelny tytuł aktualizacji (min. 3 znaki).');
    }
    if (!cleanHighlights.length && !cleanSummary) {
      throw new Error('Wpisz opis zmian lub listę nowości dla graczy (minimum jedna linijka).');
    }

    const rawCat = String(p.category || '').toUpperCase().trim();
    const cleanCat = (rawCat === 'ULEPSZENIA' || rawCat === 'TURNIEJE' || rawCat === 'POPRAWKI')
      ? rawCat
      : 'NOWOŚCI';
    const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(String(p.date || '').trim())
      ? String(p.date).trim()
      : (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.todayYmd === 'function' ? window.SMPL_STUDIO.todayYmd() : new Date().toISOString().slice(0, 10));
    const cleanAuthor = String(adminName || 'Administracja SMPL').replace(/<[^>]*>/g, '').trim().slice(0, 60) || 'Administracja SMPL';

    if (!state.portalSettings || typeof state.portalSettings !== 'object' || Array.isArray(state.portalSettings)) {
      state.portalSettings = {};
    }
    if (!Array.isArray(state.portalSettings.playerUpdates)) {
      state.portalSettings.playerUpdates = [];
    }

    const existingIdx = state.portalSettings.playerUpdates.findIndex((u) => u && normalizeUpdateVersionClient(u.version) === normVer);
    const entry = {
      id: existingIdx !== -1 && state.portalSettings.playerUpdates[existingIdx].id
        ? state.portalSettings.playerUpdates[existingIdx].id
        : ('UPD_' + normVer.replace(/\./g, '_') + '_' + Date.now()),
      version: normVer,
      date: cleanDate,
      createdAt: new Date().toISOString(),
      category: cleanCat,
      title: cleanTitle,
      summary: cleanSummary,
      highlights: cleanHighlights,
      author: cleanAuthor,
      isBuiltin: false
    };

    if (existingIdx !== -1) {
      state.portalSettings.playerUpdates[existingIdx] = entry;
    } else {
      state.portalSettings.playerUpdates.unshift(entry);
    }

    addLog('PORTAL_UPDATE', `🆕 ${cleanAuthor} opublikował dla graczy Update ${normVer}: ${cleanTitle}`);
    syncToBackend();
    return entry;
  }

  function deletePlayerUpdate(updateId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    if (!state.portalSettings || !Array.isArray(state.portalSettings.playerUpdates)) {
      throw new Error('Brak wpisu aktualizacji do usunięcia.');
    }
    const idx = state.portalSettings.playerUpdates.findIndex((u) => u && u.id === updateId);
    if (idx === -1) {
      throw new Error('Nie znaleziono tej aktualizacji lub jest to wbudowana wersja systemowa.');
    }
    const removed = state.portalSettings.playerUpdates[idx];
    state.portalSettings.playerUpdates.splice(idx, 1);
    addLog('PORTAL_UPDATE_DEL', `🗑️ Admin ${adminName} usunął wpis Update ${removed.version || ''}.`);
    syncToBackend();
    return true;
  }

  function proposeMatchTime({ matchId, slots, note }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const targetMatch = (state.matches || []).find((m) => m && m.id === matchId);
    if (!targetMatch) throw new Error('Nie znaleziono meczu.');
    if (!actor.isAdmin && actor.actorPlayerId !== targetMatch.homeId && actor.actorPlayerId !== targetMatch.awayId) {
      throw new Error('Tylko uczestnicy meczu lub Admin mogą proponować termin.');
    }
    const cleanSlots = (Array.isArray(slots) ? slots : [])
      .map((s) => String(s || '').replace(/<[^>]*>/g, '').trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 4);
    if (!cleanSlots.length) throw new Error('Wybierz lub wpisz co najmniej jeden proponowany termin.');
    const cleanNote = String(note || '').replace(/<[^>]*>/g, '').trim().slice(0, 180);
    const nowStr = nowFormatted();
    const oppId = actor.actorPlayerId === targetMatch.homeId ? targetMatch.awayId : targetMatch.homeId;
    const prop = {
      id: 'PROP_' + Date.now() + '_' + Math.floor(10 + Math.random() * 89),
      matchId: targetMatch.id,
      round: Number(targetMatch.round || 1),
      leagueId: String(targetMatch.leagueId || 'L1'),
      proposerId: actor.actorId,
      proposerPlayerId: actor.actorPlayerId || null,
      proposerName: actor.actorName,
      targetPlayerId: oppId,
      proposedSlots: cleanSlots,
      chosenSlot: '',
      status: 'PROPOSED',
      note: cleanNote,
      createdAt: nowStr,
      respondedAt: '',
      respondedByName: ''
    };
    comp.matchProposals.unshift(prop);
    if (comp.matchProposals.length > 400) comp.matchProposals = comp.matchProposals.slice(0, 400);
    const oppP = (state.players || []).find((p) => p && p.id === oppId);
    if (oppP) {
      if (!Array.isArray(oppP.notifications)) oppP.notifications = [];
      oppP.notifications.unshift({
        id: 'NOTIF_' + prop.id,
        time: nowStr,
        text: `📅 ${actor.actorName} zaproponował termin meczu (K${targetMatch.round || '?'}): ${cleanSlots.join(' / ')}`
      });
    }
    addLog('MATCH_PROPOSAL', `📅 ${actor.actorName} zaproponował termin meczu K${targetMatch.round || '?'} (${cleanSlots.join(', ')}).`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'match_propose', matchId: targetMatch.id, slots: cleanSlots, note: cleanNote }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, proposal: prop, remotePromise: remotePromise };
  }

  function respondMatchProposal({ proposalId, decision, chosenSlot, note }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const pObj = (comp.matchProposals || []).find((p) => p && p.id === proposalId);
    if (!pObj) throw new Error('Nie znaleziono propozycji terminu.');
    if (!actor.isAdmin && actor.actorPlayerId !== pObj.targetPlayerId && actor.actorPlayerId !== pObj.proposerPlayerId) {
      throw new Error('Brak uprawnień do odpowiedzi na tę propozycję terminu.');
    }
    const dec = ['ACCEPT', 'RESCHEDULE', 'DECLINE'].indexOf(String(decision || 'ACCEPT').toUpperCase()) >= 0
      ? String(decision || 'ACCEPT').toUpperCase()
      : 'ACCEPT';
    let finalSlot = String(chosenSlot || '').replace(/<[^>]*>/g, '').trim().slice(0, 60);
    if (dec === 'ACCEPT' && !finalSlot && Array.isArray(pObj.proposedSlots) && pObj.proposedSlots[0]) {
      finalSlot = String(pObj.proposedSlots[0]);
    }
    const cleanNote = String(note || '').replace(/<[^>]*>/g, '').trim().slice(0, 180);
    pObj.status = dec === 'ACCEPT' ? 'ACCEPTED' : (dec === 'RESCHEDULE' ? 'RESCHEDULE' : 'DECLINED');
    pObj.chosenSlot = finalSlot;
    pObj.respondedAt = nowFormatted();
    pObj.respondedByName = actor.actorName;
    if (cleanNote) pObj.responseNote = cleanNote;
    const oppRespId = actor.actorPlayerId === pObj.proposerPlayerId ? pObj.targetPlayerId : pObj.proposerPlayerId;
    if (oppRespId) {
      pushPlayerNotification(oppRespId, {
        idPrefix: 'NOTIF_PROP',
        type: 'MATCH_PROPOSAL',
        icon: '📅',
        title: `Odpowiedź na termin meczu (Kol. ${pObj.round || '?'})`,
        text: `${actor.actorName} odpowiedział na propozycję terminu: ${pObj.status}${finalSlot ? ' (' + finalSlot + ')' : ''}.`
      });
    }
    addLog('MATCH_PROPOSAL_RESP', `📅 ${actor.actorName} odpowiedział na termin (${pObj.status}${finalSlot ? ': ' + finalSlot : ''}).`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'match_respond', proposalId: proposalId, decision: dec, chosenSlot: finalSlot, note: cleanNote }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, proposal: pObj, remotePromise: remotePromise };
  }

  function submitMatchDispute({ matchId, reasonType, description, screenshot }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const targetMatch = (state.matches || []).find((m) => m && m.id === matchId);
    if (!targetMatch) throw new Error('Nie znaleziono wskazanego meczu.');
    const cleanDesc = String(description || '').replace(/<[^>]*>/g, '').trim().slice(0, 420);
    if (cleanDesc.length < 6) throw new Error('Wpisz opis zgłoszenia VAR / sporu (minimum 6 znaków).');
    const rType = ['DISCONNECT', 'NO_SHOW_48H', 'SCORE_DISPUTE', 'APPEAL_7D', 'OTHER'].indexOf(String(reasonType || '').toUpperCase()) >= 0
      ? String(reasonType).toUpperCase()
      : 'OTHER';
    const cleanSs = String(screenshot || '').trim();
    if (!cleanSs || cleanSs.length > 1600000 || !/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(cleanSs)) {
      throw new Error('📸 Do zgłoszenia sporu lub wniosku o walkower (W.O.) wymagany jest obowiązkowy zrzut ekranu (SS) pokazujący powód (dlaczego).');
    }
    const accusedId = actor.actorPlayerId === targetMatch.homeId
      ? targetMatch.awayId
      : (actor.actorPlayerId === targetMatch.awayId ? targetMatch.homeId : '');
    const dlDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
    const dispute = {
      id: 'VAR_' + Date.now() + '_' + Math.floor(10 + Math.random() * 89),
      matchId: targetMatch.id,
      leagueId: String(targetMatch.leagueId || 'L1'),
      round: Number(targetMatch.round || 1),
      reporterId: actor.actorId,
      reporterPlayerId: actor.actorPlayerId || null,
      reporterName: actor.actorName,
      accusedPlayerId: accusedId,
      reasonType: rType,
      description: cleanDesc,
      screenshot: cleanSs,
      deadlineAt: dlDate,
      status: 'PENDING',
      resolutionNote: '',
      resolvedBy: '',
      resolvedAt: '',
      createdAt: nowFormatted()
    };
    comp.matchDisputes.unshift(dispute);
    if (comp.matchDisputes.length > 200) comp.matchDisputes = comp.matchDisputes.slice(0, 200);
    if (accusedId) {
      pushPlayerNotification(accusedId, {
        idPrefix: 'NOTIF_VARD',
        type: 'DISPUTE',
        icon: '🚩',
        title: `Zgłoszono Spór VAR / W.O. (Kol. ${targetMatch.round || '?'})`,
        text: `${actor.actorName} zgłosił spór z obowiązkowym SS: „${cleanDesc}”. Sprawdź Terminarz i odpowiedz w ciągu 48h.`
      });
    }
    addLog('DISPUTE_SUBMIT', `🚩 ${actor.actorName} otworzył zgłoszenie VAR (${rType}) ze screenem dowodowym dla meczu K${targetMatch.round || '?'}.`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'dispute_submit', matchId: targetMatch.id, reasonType: rType, description: cleanDesc, screenshot: cleanSs }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, dispute: dispute, remotePromise: remotePromise };
  }

  function resolveMatchDispute(disputeId, decision, resolutionNote, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const disp = (comp.matchDisputes || []).find((d) => d && d.id === disputeId);
    if (!disp) throw new Error('Nie znaleziono sporu VAR.');
    const dec = String(decision || 'REJECT').toUpperCase();
    const note = String(resolutionNote || '').replace(/<[^>]*>/g, '').trim().slice(0, 280);
    const m = (state.matches || []).find((x) => x && x.id === disp.matchId);
    if (m) {
      if (dec === 'WO_HOME') {
        setWalkover(m.id, 'HOME_WIN', adminName, note || ('Decyzja VAR: Walkower 2:0 WO dla gospodarza (' + adminName + ')'), disp.screenshot || '');
      } else if (dec === 'WO_AWAY') {
        setWalkover(m.id, 'AWAY_WIN', adminName, note || ('Decyzja VAR: Walkower 0:2 WO dla gościa (' + adminName + ')'), disp.screenshot || '');
      } else if (dec === 'REPLAY') {
        m.status = 'SCHEDULED';
        m.homeScore = null;
        m.awayScore = null;
        m.screenshot = null;
        m.rejectionReason = note || 'Decyzja VAR: Powtórka meczu.';
      }
    }
    disp.status = dec === 'REJECT' ? 'REJECTED' : 'RESOLVED';
    disp.decision = dec;
    disp.resolutionNote = note || ('Werdykt VAR: ' + dec);
    disp.resolvedBy = adminName;
    disp.resolvedAt = nowFormatted();
    if (m && dec !== 'WO_HOME' && dec !== 'WO_AWAY') {
      [m.homeId, m.awayId].forEach((pid) => {
        if (!pid) return;
        pushPlayerNotification(pid, {
          idPrefix: 'NOTIF_VAR',
          type: 'DISPUTE',
          icon: '⚖️',
          title: `Werdykt VAR (Kol. ${disp.round || m.round || '?'})`,
          text: `Admin ${adminName} rozstrzygnął spór (${dec}): ${disp.resolutionNote}.`
        });
      });
    }
    addLog('VAR_VERDICT', `⚖️ Admin ${adminName} rozstrzygnął spór VAR (${dec}) w meczu K${disp.round || '?'}.`);
    syncToBackend();
    return disp;
  }

  function voteFanPoll({ matchId, pick }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const cleanPick = String(pick || '').toUpperCase();
    if (!matchId || ['HOME', 'DRAW', 'AWAY'].indexOf(cleanPick) < 0) {
      throw new Error('Wybierz typ kibica: HOME, DRAW lub AWAY.');
    }
    if (!comp.fanPolls[matchId]) {
      comp.fanPolls[matchId] = { homeVotes: [], drawVotes: [], awayVotes: [] };
    }
    const poll = comp.fanPolls[matchId];
    ['homeVotes', 'drawVotes', 'awayVotes'].forEach((vk) => {
      poll[vk] = (Array.isArray(poll[vk]) ? poll[vk] : []).filter((id) => id !== actor.actorId);
    });
    const tk = cleanPick === 'HOME' ? 'homeVotes' : (cleanPick === 'AWAY' ? 'awayVotes' : 'drawVotes');
    poll[tk].push(actor.actorId);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'fan_poll_vote', matchId: matchId, pick: cleanPick }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, poll: poll, remotePromise: remotePromise };
  }

  function ensureShopUnlockEntry(comp, pid) {
    if (!comp.playerShop.unlocks[pid]) {
      comp.playerShop.unlocks[pid] = {
        frame: 'default', bgStyle: 'default', profileBadge: 'default', nickEffect: 'default',
        posterTheme: 'default', customTitle: '', joinSound: 'default',
        unlockedItems: [], spentCoins: 0, claimedQuests: [], questCoins: 0, giftCoinsReceived: 0, carryoverCoins: 0
      };
    }
    const u = comp.playerShop.unlocks[pid];
    if (!Array.isArray(u.unlockedItems)) u.unlockedItems = [];
    if (!Array.isArray(u.claimedQuests)) u.claimedQuests = [];
    if (u.carryoverCoins === undefined) u.carryoverCoins = 0;
    return u;
  }

  function buyShopItem({ itemId, customTitle }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const targetPid = actor.actorPlayerId;
    if (!targetPid) throw new Error('Sklepik SMPL Coins dostępny jest dla przypisanych zawodników ligi.');
    const catalog = (window.SMPL_STUDIO && window.SMPL_STUDIO.SHOP_CATALOG) || [];
    const item = catalog.find((x) => x.id === itemId);
    if (!item) throw new Error('Nie znaleziono przedmiotu w sklepiku.');

    const u = ensureShopUnlockEntry(comp, targetPid);
    const currentSeason = Number((state && state.season) || 56);
    if (u.unlockedItems.indexOf(itemId) < 0) {
      if (item.seasonOnly && Number(item.seasonOnly) !== currentSeason) {
        throw new Error(`Ten limitowany drop był dostępny wyłącznie w Sezonie ${item.seasonOnly}.`);
      }
      const balInfo = window.SMPL_STUDIO && typeof window.SMPL_STUDIO.calculatePlayerCoinsBreakdown === 'function'
        ? window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, targetPid)
        : { balance: 0 };
      if (balInfo.balance < item.price) {
        throw new Error(`Za mało SMPL Coins! Potrzebujesz ${item.price} (masz: ${balInfo.balance}).`);
      }
      u.unlockedItems.push(itemId);
      u.spentCoins = Number(u.spentCoins || 0) + item.price;
    }
    if (item.category === 'frame') u.frame = item.value;
    else if (item.category === 'bg') u.bgStyle = item.value;
    else if (item.category === 'poster') u.posterTheme = item.value;
    else if (item.category === 'badge') u.profileBadge = item.value;
    else if (item.category === 'nickfx') u.nickEffect = item.value;
    else if (item.category === 'sound') u.joinSound = item.value;
    else if (item.category === 'title') {
      if (item.value && item.value !== 'custom') {
        u.customTitle = String(item.value).replace(/<[^>]*>/g, '').trim().slice(0, 28);
      } else if (customTitle !== undefined) {
        u.customTitle = String(customTitle || '').replace(/<[^>]*>/g, '').trim().slice(0, 28);
      }
    }
    pushPlayerNotification(targetPid, {
      idPrefix: 'NOTIF_BUY',
      type: 'PRIZE',
      icon: '🪙',
      title: `Odblokowano nagrodę ze Sklepiku!`,
      text: `Odblokowałeś i aktywowałeś kosmetyk SMPL: „${item.title}”.`
    });
    addLog('SHOP_BUY', `🪙 ${actor.actorName} odblokował kosmetyk SMPL (${item.title}).`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'shop_buy', itemId: itemId, customTitle: customTitle, playerId: targetPid }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, unlock: u, remotePromise: remotePromise };
  }

  function equipShopItem({ category, value, customTitle }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const targetPid = actor.actorPlayerId;
    if (!targetPid) throw new Error('Kosmetyki dotyczą aktywnych zawodników.');
    const u = ensureShopUnlockEntry(comp, targetPid);
    if (category === 'frame') u.frame = String(value || 'default');
    else if (category === 'bg') u.bgStyle = String(value || 'default');
    else if (category === 'poster') u.posterTheme = String(value || 'default');
    else if (category === 'badge') u.profileBadge = String(value || 'default');
    else if (category === 'nickfx') u.nickEffect = String(value || 'default');
    else if (category === 'sound') u.joinSound = String(value || 'default');
    else if (category === 'title') {
      const cleanCustom = String(customTitle || '').replace(/<[^>]*>/g, '').trim().slice(0, 28);
      const valStr = String(value || 'default');
      if (cleanCustom) u.customTitle = cleanCustom;
      else if (valStr && valStr !== 'default' && valStr !== 'custom') u.customTitle = valStr.replace(/<[^>]*>/g, '').trim().slice(0, 28);
      else u.customTitle = '';
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'shop_equip', category: category, value: value, customTitle: customTitle, playerId: targetPid }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, unlock: u, remotePromise: remotePromise };
  }

  function claimShopQuest({ questId }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const targetPid = actor.actorPlayerId;
    if (!targetPid) throw new Error('Wyzwania dostępne są dla aktywnych zawodników.');
    const quests = (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.computePlayerWeeklyQuests === 'function')
      ? window.SMPL_STUDIO.computePlayerWeeklyQuests(state, targetPid)
      : [];
    const q = quests.find((x) => x.id === questId);
    if (!q) throw new Error('Nie znaleziono takiego wyzwania.');
    if (!q.done) throw new Error('To wyzwanie nie zostało jeszcze ukończone.');
    const u = ensureShopUnlockEntry(comp, targetPid);
    if (u.claimedQuests.indexOf(q.periodKey) !== -1) {
      throw new Error('Nagroda za to wyzwanie została już odebrana.');
    }
    u.claimedQuests.push(q.periodKey);
    u.questCoins = Number(u.questCoins || 0) + Number(q.reward || 0);
    pushPlayerNotification(targetPid, {
      idPrefix: 'NOTIF_QUEST',
      type: 'SHOP_QUEST',
      icon: '🎯',
      title: `Odebrano nagrodę: +${q.reward} SMPL Coins!`,
      text: `Ukończono wyzwanie „${q.title}” — na Twoje konto dopisano +${q.reward} Coins.`
    });
    addLog('SHOP_QUEST', `🎯 ${actor.actorName} odebrał +${q.reward} Coins za wyzwanie "${q.title}".`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'shop_quest_claim', questId: questId, playerId: targetPid }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, quest: q, unlock: u, remotePromise: remotePromise };
  }

  function sendShopGift({ toPlayerId, giftType, amount, itemId, note }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const targetPid = actor.actorPlayerId;
    if (!targetPid) throw new Error('Prezenty mogą wysyłać aktywni zawodnicy ligi.');
    const recipient = (state.players || []).find((p) => p && String(p.id) === String(toPlayerId || ''));
    if (!recipient) throw new Error('Wybierz poprawnego odbiorcę prezentu.');
    if (String(recipient.id) === String(targetPid)) throw new Error('Nie możesz wysłać prezentu samemu sobie.');

    const gType = String(giftType || 'coins') === 'item' ? 'item' : 'coins';
    const cleanNote = String(note || '').replace(/<[^>]*>/g, '').trim().slice(0, 120);
    const senderU = ensureShopUnlockEntry(comp, targetPid);
    const recU = ensureShopUnlockEntry(comp, String(recipient.id));
    const balInfo = window.SMPL_STUDIO && typeof window.SMPL_STUDIO.calculatePlayerCoinsBreakdown === 'function'
      ? window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, targetPid)
      : { balance: 0 };

    let giftCost = 0;
    let giftLabel = '';
    let amountOrItemId = '';
    if (gType === 'item') {
      const catalog = (window.SMPL_STUDIO && window.SMPL_STUDIO.SHOP_CATALOG) || [];
      const item = catalog.find((x) => x.id === itemId);
      if (!item) throw new Error('Wybierz prawidłowy kosmetyk ze sklepiku.');
      const currentSeason = Number((state && state.season) || 56);
      if (item.seasonOnly && Number(item.seasonOnly) !== currentSeason) {
        throw new Error(`Limitowany drop Sezonu ${item.seasonOnly} jest już zamknięty.`);
      }
      if (recU.unlockedItems.indexOf(itemId) !== -1) {
        throw new Error(`${recipient.name} posiada już ten kosmetyk w swojej kolekcji.`);
      }
      if (balInfo.balance < item.price) {
        throw new Error(`Za mało SMPL Coins na ten prezent! Koszt: ${item.price} (masz: ${balInfo.balance}).`);
      }
      giftCost = item.price;
      senderU.spentCoins = Number(senderU.spentCoins || 0) + giftCost;
      recU.unlockedItems.push(itemId);
      giftLabel = item.title;
      amountOrItemId = itemId;
    } else {
      const amt = Math.round(Number(amount || 0));
      if (!amt || amt < 10 || amt > 500) {
        throw new Error('Kwota prezentu Coins musi mieścić się między 10 a 500 monet.');
      }
      if (balInfo.balance < amt) {
        throw new Error(`Za mało SMPL Coins! Potrzebujesz ${amt} (masz: ${balInfo.balance}).`);
      }
      giftCost = amt;
      senderU.spentCoins = Number(senderU.spentCoins || 0) + amt;
      recU.giftCoinsReceived = Number(recU.giftCoinsReceived || 0) + amt;
      giftLabel = `${amt} SMPL Coins`;
      amountOrItemId = amt;
    }

    const entry = {
      id: 'GIFT_' + Date.now(),
      fromPlayerId: String(targetPid),
      fromName: String(actor.actorName || 'Gracz'),
      toPlayerId: String(recipient.id),
      toName: String(recipient.name || 'Gracz'),
      giftType: gType,
      amountOrItemId: amountOrItemId,
      label: giftLabel,
      note: cleanNote,
      createdAt: new Date().toISOString()
    };
    comp.playerShop.giftHistory.unshift(entry);
    comp.playerShop.giftHistory = comp.playerShop.giftHistory.slice(0, 50);

    pushPlayerNotification(recipient, {
      idPrefix: 'NOTIF_GIFT',
      type: 'SHOP_GIFT',
      icon: '🎁',
      title: `Otrzymałeś prezent od ${actor.actorName}!`,
      text: `Dostałeś prezent: ${giftLabel}.${cleanNote ? ' Wiadomość: „' + cleanNote + '”' : ''}`
    });
    addLog('SHOP_GIFT', `🎁 ${actor.actorName} podarował prezent dla ${recipient.name}: ${giftLabel}.`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'shop_gift', toPlayerId: String(recipient.id), giftType: gType, amount: giftCost, itemId: itemId, note: cleanNote, playerId: targetPid }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, gift: entry, unlock: senderU, remotePromise: remotePromise };
  }

  function masterGrantPlayerCoins({ playerId, delta, amount, mode, reason }) {
    const sess = assertMasterAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    if (!comp.playerShop || typeof comp.playerShop !== 'object' || Array.isArray(comp.playerShop)) {
      comp.playerShop = { unlocks: {}, bonusCoins: {}, giftHistory: [] };
    }
    if (!comp.playerShop.bonusCoins || typeof comp.playerShop.bonusCoins !== 'object' || Array.isArray(comp.playerShop.bonusCoins)) {
      comp.playerShop.bonusCoins = {};
    }
    const targetPid = String(playerId || '').trim();
    if (!targetPid) throw new Error('Wybierz zawodnika, któremu chcesz przyznać SMPL Coins.');
    const targetPlayer = (state.players || []).find((p) => p && String(p.id) === targetPid);
    if (!targetPlayer) throw new Error('Nie znaleziono wskazanego zawodnika w bazie ligi.');

    const cleanMode = String(mode || 'add').trim().toLowerCase();
    const cleanReason = String(reason || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
    const curBonus = Number(comp.playerShop.bonusCoins[targetPid] || 0);
    const maxSafe = 1000000000;
    let nextBonus = curBonus;
    let appliedDelta = 0;

    if (!comp.playerShop.unlocks || typeof comp.playerShop.unlocks !== 'object' || Array.isArray(comp.playerShop.unlocks)) {
      comp.playerShop.unlocks = {};
    }
    if (cleanMode === 'reset_shop') {
      nextBonus = 0;
      appliedDelta = -curBonus;
      comp.playerShop.unlocks[targetPid] = {
        unlockedItems: [],
        spentCoins: 0,
        questCoins: 0,
        giftCoinsReceived: 0,
        carryoverCoins: 0,
        claimedQuests: [],
        frame: 'default',
        bgStyle: 'default',
        customTitle: '',
        joinSound: 'default',
        profileBadge: 'default',
        nickEffect: 'default',
        posterTheme: 'default'
      };
    } else if (cleanMode === 'reset_bonus') {
      nextBonus = 0;
      appliedDelta = -curBonus;
    } else if (cleanMode === 'set_bonus') {
      const rawSet = Math.round(Number(amount !== undefined ? amount : delta || 0) || 0);
      nextBonus = Math.max(-maxSafe, Math.min(maxSafe, rawSet));
      appliedDelta = nextBonus - curBonus;
    } else {
      const rawDelta = Math.round(Number(delta !== undefined ? delta : amount || 0) || 0);
      if (!rawDelta) throw new Error('Podaj liczbę SMPL Coins różną od 0 (np. 1000 lub -500).');
      nextBonus = Math.max(-maxSafe, Math.min(maxSafe, curBonus + rawDelta));
      appliedDelta = nextBonus - curBonus;
    }

    comp.playerShop.bonusCoins[targetPid] = nextBonus;
    const balInfo = window.SMPL_STUDIO && typeof window.SMPL_STUDIO.calculatePlayerCoinsBreakdown === 'function'
      ? window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, targetPid)
      : { balance: Math.max(0, nextBonus) };
    const adminName = String((sess && sess.adminName) || 'Szymon Komenda');

    if (appliedDelta > 0) {
      pushPlayerNotification(targetPlayer, {
        idPrefix: 'NOTIF_MCOINS',
        type: 'MASTER_COINS',
        icon: '👑',
        title: `Otrzymałeś +${appliedDelta} SMPL Coins od Master Admina!`,
        text: `Master Admin ${adminName} doładował Twoje konto w Sklepiku SMPL o +${appliedDelta} Coins (saldo: ${balInfo.balance} Coins).${cleanReason ? ' Powód: ' + cleanReason : ''}`
      });
    }
    addLog(
      'MASTER_COINS',
      cleanMode === 'reset_shop'
        ? `👑🗑️ Master Admin ${adminName} wyzerował cały Sklepik SMPL gracza ${targetPlayer.name} (usunięto przedmioty i bonusowe Coins; saldo: ${balInfo.balance} Coins).`
        : cleanMode === 'reset_bonus'
          ? `👑🧹 Master Admin ${adminName} wyzerował bonusowe SMPL Coins gracza ${targetPlayer.name} (saldo: ${balInfo.balance} Coins).`
          : `👑🪙 Master Admin ${adminName} zmienił SMPL Coins gracza ${targetPlayer.name} o ${appliedDelta >= 0 ? '+' : ''}${appliedDelta} (saldo: ${balInfo.balance} Coins)${cleanReason ? ' [' + cleanReason + ']' : ''}.`
    );
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer(
          { op: 'master_grant_coins', playerId: targetPid, delta: appliedDelta, amount: nextBonus, mode: cleanMode, reason: cleanReason },
          true
        )
      : Promise.resolve({ ok: true, localOnly: true });
    return {
      ok: true,
      playerId: targetPid,
      playerName: targetPlayer.name,
      bonusCoins: nextBonus,
      balance: balInfo.balance,
      delta: appliedDelta,
      remotePromise: remotePromise
    };
  }

  function addSmplTvClip({ title, url, playerName, tag }) {
    const actor = resolveCompetitionActor(getSession());
    const comp = ensureCompetitionsStructure(state);
    const cleanTitle = String(title || '').replace(/<[^>]*>/g, '').trim().slice(0, 100);
    const cleanUrl = String(url || '').trim();
    const cleanPlayer = String(playerName || actor.actorName).replace(/<[^>]*>/g, '').trim().slice(0, 60);
    const cleanTag = String(tag || 'HIGHLIGHT').replace(/<[^>]*>/g, '').trim().slice(0, 24) || 'HIGHLIGHT';
    if (cleanTitle.length < 4 || !/^https?:\/\/[^\s"'<>]{6,500}$/i.test(cleanUrl)) {
      throw new Error('Podaj tytuł klipu (min. 4 znaki) oraz poprawny adres https://.');
    }
    const clip = {
      id: 'TV_' + Date.now(),
      title: cleanTitle,
      playerName: cleanPlayer,
      url: cleanUrl,
      tag: cleanTag,
      addedBy: actor.actorName,
      createdAt: nowFormatted()
    };
    comp.smplTV.clips.unshift(clip);
    if (comp.smplTV.clips.length > 60) comp.smplTV.clips = comp.smplTV.clips.slice(0, 60);
    addLog('TV_CLIP', `📺 ${actor.actorName} dodał klip w SMPL TV: ${cleanTitle}`);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}

    const remotePromise = isHttpProtocol()
      ? sendCompetitionActionToServer({ op: 'tv_clip_add', title: cleanTitle, url: cleanUrl, playerName: cleanPlayer, tag: cleanTag }, actor.isAdmin)
      : Promise.resolve({ ok: true, localOnly: true });
    return { ok: true, clip: clip, remotePromise: remotePromise };
  }

  function setSmplTvLiveStream({ isLive, title, url, streamerName }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    comp.smplTV.liveStream = {
      isLive: Boolean(isLive),
      title: String(title || '').replace(/<[^>]*>/g, '').trim().slice(0, 120),
      url: String(url || '').trim().slice(0, 400),
      streamerName: String(streamerName || adminName).replace(/<[^>]*>/g, '').trim().slice(0, 60),
      updatedAt: nowFormatted()
    };
    addLog('SMPL_TV_LIVE', Boolean(isLive) ? `📺 Admin ${adminName} uruchomił transmisję NA ŻYWO w SMPL TV!` : `📺 Admin ${adminName} zakończył transmisję LIVE SMPL TV.`);
    syncToBackend();
    return comp.smplTV.liveStream;
  }

  function awardWeeklyTotw(weekNum, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.computeWeeklyTotwCandidates !== 'function') {
      throw new Error('Moduł SMPL_STUDIO nie jest załadowany.');
    }
    const wk = Number(weekNum || (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1);
    const data = window.SMPL_STUDIO.computeWeeklyTotwCandidates(state, wk);
    if (!data.starters.length) {
      throw new Error(`Brak zatwierdzonych meczów w Tygodniu #${wk}, aby wyłonić Szóstkę Tygodnia (TOTW).`);
    }
    const entry = {
      id: 'TOTW_S' + (state.season || 56) + '_W' + wk,
      season: Number(state.season || 56),
      week: wk,
      roundRange: data.roundRange,
      starters: data.starters,
      winners: data.leagueWinners,
      awardedBy: adminName,
      createdAt: nowFormatted()
    };
    comp.totwHistory = (comp.totwHistory || []).filter((x) => x && Number(x.week) !== wk);
    comp.totwHistory.unshift(entry);
    (entry.starters || []).forEach((stItem) => {
      if (stItem && stItem.playerId) {
        pushPlayerNotification(stItem.playerId, {
          idPrefix: 'NOTIF_TOTW',
          type: 'TOTW',
          icon: '⚡',
          title: `Wyróżnienie: Szóstka Tygodnia #${wk} (TOTW)!`,
          text: `Gratulacje! Trafiłeś do Drużyny Kolejki #${wk} SMPL (${stItem.pts} pkt w tygodniu)!`
        });
      }
    });
    addLog('TOTW_AWARD', `⚡ Admin ${adminName} ogłosił Drużynę Kolejki (TOTW Tydzień #${wk}): lider ${data.starters[0].name} (${data.starters[0].pts} pkt)!`);
    syncToBackend();
    return entry;
  }

  function generatePlayoffTies(adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const activeIds = getActiveLeagueIds(state);
    if (activeIds.length < 2) throw new Error('Potrzeba co najmniej 2 aktywnych lig do wygenerowania baraży.');
    const ties = [];
    for (let i = 0; i < activeIds.length - 1; i++) {
      const upperId = activeIds[i];
      const lowerId = activeIds[i + 1];
      const upCfg = (state.leagues && state.leagues[upperId]) || {};
      const lowCfg = (state.leagues && state.leagues[lowerId]) || {};
      const upTbl = window.SMPL_ENGINE.calculateStandings(state, upperId) || [];
      const lowTbl = window.SMPL_ENGINE.calculateStandings(state, lowerId) || [];
      const relSpots = Math.max(1, Number(upCfg.relSpots || 2));
      const promoSpots = Math.max(1, Number(lowCfg.promoSpots || 2));
      if (upTbl.length > relSpots + 1 && lowTbl.length > promoSpots + 1) {
        const upPlayer = upTbl[upTbl.length - relSpots - 1];
        const lowPlayer = lowTbl[promoSpots];
        if (upPlayer && lowPlayer) {
          ties.push({
            id: 'PO_' + upperId + '_' + lowerId + '_1',
            upperLeagueId: upperId,
            lowerLeagueId: lowerId,
            upperPlayerId: upPlayer.playerId,
            upperPlayerName: upPlayer.name,
            upperPos: upTbl.indexOf(upPlayer) + 1,
            lowerPlayerId: lowPlayer.playerId,
            lowerPlayerName: lowPlayer.name,
            lowerPos: lowTbl.indexOf(lowPlayer) + 1,
            leg1HomeScore: null,
            leg1AwayScore: null,
            leg2HomeScore: null,
            leg2AwayScore: null,
            penWinnerId: null,
            winnerPlayerId: null,
            status: 'SCHEDULED'
          });
        }
      }
    }
    comp.playoffs = { status: ties.length > 0 ? 'ACTIVE' : 'NOT_STARTED', ties: ties, createdAt: nowFormatted(), resolvedAt: null };
    addLog('PLAYOFFS_GEN', `🥊 Admin ${adminName} wygenerował dwumecze barażowe (${ties.length} par).`);
    syncToBackend();
    return comp.playoffs;
  }

  function updatePlayoffLegResult({ tieId, leg, homeScore, awayScore, penWinnerId }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const tie = (comp.playoffs && comp.playoffs.ties || []).find((t) => t && t.id === tieId);
    if (!tie) throw new Error('Nie znaleziono pary barażowej.');
    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!isValidLeagueGoalPair(hs, as, true)) {
      throw new Error('Podaj poprawny wynik (0–2, bez 2:2; walkowery 2:0 / 0:2 / 0:0 WO).');
    }
    if (Number(leg) === 2) {
      tie.leg2HomeScore = hs;
      tie.leg2AwayScore = as;
    } else {
      tie.leg1HomeScore = hs;
      tie.leg1AwayScore = as;
    }
    if (penWinnerId) tie.penWinnerId = String(penWinnerId);

    if (tie.leg1HomeScore !== null && tie.leg2HomeScore !== null) {
      const upperTotal = Number(tie.leg1HomeScore) + Number(tie.leg2AwayScore);
      const lowerTotal = Number(tie.leg1AwayScore) + Number(tie.leg2HomeScore);
      if (upperTotal > lowerTotal) tie.winnerPlayerId = tie.upperPlayerId;
      else if (lowerTotal > upperTotal) tie.winnerPlayerId = tie.lowerPlayerId;
      else if (tie.penWinnerId === tie.upperPlayerId || tie.penWinnerId === tie.lowerPlayerId) {
        tie.winnerPlayerId = tie.penWinnerId;
      } else {
        tie.winnerPlayerId = tie.upperPlayerId;
      }
      tie.status = 'DONE';
      const poWinnerName = tie.winnerPlayerId === tie.upperPlayerId ? tie.upperPlayerName : tie.lowerPlayerName;
      [tie.upperPlayerId, tie.lowerPlayerId].forEach((pid) => {
        if (!pid) return;
        const isWin = pid === tie.winnerPlayerId;
        pushPlayerNotification(pid, {
          idPrefix: 'NOTIF_PO',
          type: isWin ? 'PRIZE' : 'PLAYOFF_RES',
          icon: isWin ? '🥊🏆' : '🥊',
          title: isWin ? `Wygrany Baraż ${tie.upperLeagueId}/${tie.lowerLeagueId}!` : `Zakończony Baraż ${tie.upperLeagueId}/${tie.lowerLeagueId}`,
          text: isWin
            ? `Gratulacje! Wygrałeś dwumecz barażowy ${tie.upperLeagueId}/${tie.lowerLeagueId} (awans/utrzymanie w wyższej lidze)!`
            : `Zakończył się baraż ${tie.upperLeagueId}/${tie.lowerLeagueId} — zwycięzcą dwumeczu został ${poWinnerName || 'rywal'}.`
        });
      });
    } else {
      tie.status = 'IN_PROGRESS';
    }
    addLog('PLAYOFF_RES', `🥊 Admin ${adminName} zapisał wynik Barażu (${tie.upperLeagueId}/${tie.lowerLeagueId} mecz #${leg}: ${hs}:${as}).`);
    syncToBackend();
    return tie;
  }

  function generateSupercupBracket(options, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const opts = options && typeof options === 'object' ? options : {};
    const l1Standings = window.SMPL_ENGINE.calculateStandings(state, 'L1') || [];
    const champId = opts.homePlayerId || (l1Standings[0] && l1Standings[0].playerId) || null;
    const cupWinId = opts.awayPlayerId || (comp.cup && comp.cup.winnerPlayerId) || (l1Standings[1] && l1Standings[1].playerId) || null;
    if (!champId || !cupWinId || champId === cupWinId) {
      throw new Error('Wskaż dwóch różnych finalistów Superpucharu Mistrzów (Mistrz L1 vs Zdobywca Pucharu).');
    }
    comp.supercup = {
      status: 'ACTIVE',
      season: Number(state.season || 56),
      homePlayerId: champId,
      awayPlayerId: cupWinId,
      homeScore: null,
      awayScore: null,
      penWinnerId: null,
      winnerPlayerId: null,
      updatedAt: nowFormatted()
    };
    addLog('SUPERCUP_GEN', `🌟 Admin ${adminName} zestawił Superpuchar Mistrzów SMPL!`);
    syncToBackend();
    return comp.supercup;
  }

  function updateSupercupMatch({ homeScore, awayScore, penWinnerId }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const sc = comp.supercup;
    if (!sc || !sc.homePlayerId || !sc.awayPlayerId) throw new Error('Najpierw utwórz parę Superpucharu.');
    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!isValidLeagueGoalPair(hs, as, true)) {
      throw new Error('Nieprawidłowy wynik (0–2 bez 2:2; walkowery 2:0 / 0:2 / 0:0 WO).');
    }
    sc.homeScore = hs;
    sc.awayScore = as;
    sc.penWinnerId = penWinnerId || null;
    if (hs > as) sc.winnerPlayerId = sc.homePlayerId;
    else if (as > hs) sc.winnerPlayerId = sc.awayPlayerId;
    else if (penWinnerId === sc.homePlayerId || penWinnerId === sc.awayPlayerId) sc.winnerPlayerId = penWinnerId;
    else throw new Error('W razie remisu wskaż zwycięzcę serii rzutów karnych!');
    sc.status = 'DONE';
    sc.updatedAt = nowFormatted();
    const wP = (state.players || []).find((p) => p && p.id === sc.winnerPlayerId);
    if (wP) {
      awardTrophyToPlayer(wP.id, {
        icon: '🌟🏆',
        title: `Superpuchar Mistrzów SMPL (${hs}:${as})`,
        season: 'Sezon ' + (state.season || 56),
        rarity: 'MYTHIC'
      }, adminName);
      comp.awardedHonors.supercup = { playerId: wP.id, playerName: wP.name, awardedAt: nowFormatted(), awardedBy: adminName };
    }
    addLog('SUPERCUP_WIN', `🌟 Admin ${adminName} zapisał finał Superpucharu (${hs}:${as}) — triumfator: ${wP ? wP.name : sc.winnerPlayerId}!`);
    syncToBackend();
    return sc;
  }

  function generateBlitzBracket({ size, name }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const bracketSize = [4, 8, 16].indexOf(Number(size)) >= 0 ? Number(size) : 8;
    const activePlayers = (state.players || []).filter((p) => p && !p.isPlaceholder && p.active !== false && !p.isBlacklisted);
    if (activePlayers.length < bracketSize) {
      throw new Error(`Za mało aktywnych graczy (${activePlayers.length}/${bracketSize}) do turnieju Blitz ${bracketSize}.`);
    }
    const pool = activePlayers.slice().sort(() => Math.random() - 0.5).slice(0, bracketSize);
    const roundNames = { 2: 'Finał Blitz', 4: 'Półfinały', 8: 'Ćwierćfinały', 16: '1/8 Finału' };
    const totalRounds = Math.round(Math.log(bracketSize) / Math.LN2);
    const rounds = [];
    for (let r = 1; r <= totalRounds; r++) {
      const numMatches = bracketSize / Math.pow(2, r);
      const matches = [];
      for (let m = 0; m < numMatches; m++) {
        matches.push({
          id: 'BLZ_R' + r + '_M' + (m + 1),
          homePlayerId: r === 1 ? pool[m * 2].id : null,
          awayPlayerId: r === 1 ? pool[m * 2 + 1].id : null,
          homeScore: null,
          awayScore: null,
          penWinnerId: null,
          winnerId: null,
          status: 'SCHEDULED'
        });
      }
      rounds.push({ roundNumber: r, roundName: roundNames[numMatches * 2] || ('Runda ' + r), matches: matches });
    }
    comp.blitzCup = {
      id: 'BLITZ_' + Date.now(),
      name: String(name || 'Weekendowy Blitz Cup SMPL').trim().slice(0, 60),
      size: bracketSize,
      status: 'IN_PROGRESS',
      rounds: rounds,
      winnerPlayerId: null,
      createdAt: nowFormatted()
    };
    addLog('BLITZ_GEN', `⚡ Admin ${adminName} rozlosował turniej ${comp.blitzCup.name} (${bracketSize} graczy).`);
    syncToBackend();
    return comp.blitzCup;
  }

  function updateBlitzMatch({ matchId, homeScore, awayScore, penWinnerId }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const blitz = comp.blitzCup;
    if (!blitz || !Array.isArray(blitz.rounds)) throw new Error('Brak aktywnej drabinki Blitz Cup.');
    let targetMatch = null;
    let rIdx = -1;
    let mIdx = -1;
    blitz.rounds.forEach((rnd, ri) => {
      (rnd.matches || []).forEach((m, mi) => {
        if (m && m.id === matchId) { targetMatch = m; rIdx = ri; mIdx = mi; }
      });
    });
    if (!targetMatch) throw new Error('Nie znaleziono meczu Blitz Cup.');
    if (!targetMatch.homePlayerId || !targetMatch.awayPlayerId) throw new Error('Obaj uczestnicy muszą być wyłonieni.');
    const hs = Number(homeScore);
    const as = Number(awayScore);
    if (!isValidLeagueGoalPair(hs, as, true)) throw new Error('Nieprawidłowy wynik (0–2 bez 2:2, lub WO).');

    let winnerId = null;
    if (hs > as) winnerId = targetMatch.homePlayerId;
    else if (as > hs) winnerId = targetMatch.awayPlayerId;
    else if (penWinnerId === targetMatch.homePlayerId || penWinnerId === targetMatch.awayPlayerId) winnerId = penWinnerId;
    else throw new Error('Przy remisie wskaż zwycięzcę karnych!');

    targetMatch.homeScore = hs;
    targetMatch.awayScore = as;
    targetMatch.penWinnerId = penWinnerId || null;
    targetMatch.winnerId = winnerId;
    targetMatch.status = 'DONE';

    if (rIdx + 1 < blitz.rounds.length) {
      const nextMatch = blitz.rounds[rIdx + 1].matches[Math.floor(mIdx / 2)];
      if (nextMatch) {
        if (mIdx % 2 === 0) nextMatch.homePlayerId = winnerId;
        else nextMatch.awayPlayerId = winnerId;
      }
    } else {
      blitz.status = 'FINISHED';
      blitz.winnerPlayerId = winnerId;
      const wp = (state.players || []).find((p) => p && p.id === winnerId);
      if (wp) {
        awardTrophyToPlayer(wp.id, {
          icon: '⚡🏆',
          title: `Zwycięzca ${blitz.name}`,
          season: 'Sezon ' + (state.season || 56),
          rarity: 'GOLD'
        }, adminName);
      }
    }
    addLog('BLITZ_RES', `⚡ Admin ${adminName} zapisał mecz Blitz Cup (${hs}:${as}).`);
    syncToBackend();
    return blitz;
  }

  function replacePlayerMidSeason(outPlayerId, inCandidateToken, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const outP = (state.players || []).find((p) => p && p.id === outPlayerId);
    if (!outP) throw new Error('Nie znaleziono wycofywanego zawodnika.');
    const lid = String(outP.leagueId || 'L1');
    let addOpts = null;
    if (inCandidateToken && typeof inCandidateToken === 'object') {
      addOpts = Object.assign({}, inCandidateToken, { leagueId: lid });
    } else {
      const tokStr = String(inCandidateToken || '').trim();
      if (tokStr.indexOf('PLAYER:') === 0) {
        addOpts = { kind: 'PLAYER_POOL', refId: tokStr.slice(7), leagueId: lid };
      } else if (tokStr.indexOf('REG:') === 0) {
        const regId = tokStr.slice(4);
        const regObj = (state.registrations || []).find((r) => r && r.id === regId);
        const rKind = (regObj && regObj.status === 'APPROVED_POOL') ? 'REG_POOL' : 'REG_PENDING';
        addOpts = { kind: rKind, refId: regId, leagueId: lid };
      } else if (tokStr) {
        const regMatch = (state.registrations || []).find((r) => r && r.id === tokStr);
        if (regMatch) {
          addOpts = { kind: regMatch.status === 'APPROVED_POOL' ? 'REG_POOL' : 'REG_PENDING', refId: tokStr, leagueId: lid };
        } else {
          addOpts = { kind: 'PLAYER_POOL', refId: tokStr, leagueId: lid };
        }
      }
    }
    const res = adminAddCandidateToLeague(addOpts || {}, adminName);
    const newP = res && res.player;
    if (!newP) throw new Error('Nie udało się aktywować zawodnika zastępczego.');

    let transferredCount = 0;
    (state.matches || []).forEach((m) => {
      if (!m || m.status !== 'SCHEDULED') return;
      if (m.homeId === outPlayerId) { m.homeId = newP.id; transferredCount++; }
      if (m.awayId === outPlayerId) { m.awayId = newP.id; transferredCount++; }
    });
    outP.active = false;
    outP.isReplacedMidSeason = true;
    outP.replacedByPlayerId = newP.id;
    outP.replacedAt = nowFormatted();
    newP.excelOrder = outP.excelOrder || newP.excelOrder;

    addLog('MID_SEASON_REPLACE', `🔄 Admin ${adminName} przeprowadził zastępstwo śródsezonowe w ${lid}: ${outP.name} ➔ ${newP.name} (przepisano ${transferredCount} nierozegranych meczów).`);
    syncToBackend();
    return { outPlayer: outP, newPlayer: newP, transferredCount: transferredCount, reboundMatches: transferredCount };
  }

  function generateDraftBuckets(numLeagues, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    if (!window.SMPL_STUDIO || typeof window.SMPL_STUDIO.buildDraftBuckets !== 'function') {
      throw new Error('Brak modułu SMPL_STUDIO.');
    }
    const n = Math.max(2, Math.min(4, Number(numLeagues || 3)));
    const buckets = window.SMPL_STUDIO.buildDraftBuckets(state.players || [], n);
    comp.draftSession = {
      id: 'DRAFT_' + Date.now(),
      status: 'DRAWN',
      numLeagues: n,
      buckets: buckets.map((b, idx) => ({
        bucketNumber: idx + 1,
        targetLeagueId: 'L' + (idx + 1),
        players: b.map((item) => ({
          playerId: item.player.id,
          name: item.player.name,
          nick: item.player.nick || '',
          rating: item.rating,
          careerRank: item.careerRank,
          assignedLeagueId: 'L' + (idx + 1)
        }))
      })),
      createdAt: nowFormatted(),
      createdBy: adminName
    };
    addLog('DRAFT_GENERATED', `🎲 Admin ${adminName} przygotował Koszyki Losowania Live (${n} dywizje).`);
    syncToBackend();
    return comp.draftSession;
  }

  function commitDraftAssignments(assignmentsMap, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    let moved = 0;
    const map = assignmentsMap || {};
    Object.keys(map).forEach((pid) => {
      const targetLg = String(map[pid] || '').trim();
      if (!/^L\d{1,2}$/.test(targetLg)) return;
      const p = (state.players || []).find((x) => x && x.id === pid);
      if (p) {
        p.leagueId = targetLg;
        p.active = true;
        moved++;
      }
    });
    if (comp.draftSession) {
      comp.draftSession.status = 'COMMITTED';
      comp.draftSession.committedAt = nowFormatted();
    }
    addLog('DRAFT_COMMITTED', `🎲 Admin ${adminName} zatwierdził przydział lig po Losowaniu Live (${moved} zawodników).`);
    syncToBackend();
    return { moved: moved };
  }

  function saveNewsletterEntry({ week, title, content, isAiGenerated }, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const comp = ensureCompetitionsStructure(state);
    const entry = {
      id: 'NEWS_' + Date.now(),
      season: Number(state.season || 56),
      week: Number(week || (state.weeklyConfig && state.weeklyConfig.currentWeek) || 1),
      title: String(title || ('Gazeta Ligi SMPL — Tydzień #' + (week || 1))).trim().slice(0, 120),
      content: String(content || '').trim().slice(0, 6000),
      isAiGenerated: Boolean(isAiGenerated),
      authorName: adminName,
      createdAt: nowFormatted()
    };
    comp.newsletter.current = entry;
    comp.newsletter.archive.unshift(entry);
    if (comp.newsletter.archive.length > 24) comp.newsletter.archive = comp.newsletter.archive.slice(0, 24);
    addLog('NEWSLETTER_PUB', `📰 Admin ${adminName} opublikował wydanie „Gazety Ligi SMPL” (Tydzień #${entry.week}).`);
    syncToBackend();
    return entry;
  }

  function callAdminServerGet(actionName) {
    assertAdminAuthenticated();
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      return makeResolvedPromise({ ok: false, offline: true, error: 'Funkcja wymaga serwera HTTP/HTTPS (PHP, Node.js lub server.ps1).' });
    }
    const waitTok = serverAdminTokenPromise || Promise.resolve(null);
    return waitTok.then(() => {
      const tok = resolveAdminRequestToken();
      const headers = { Accept: 'application/json' };
      if (tok) headers['X-SMPL-Admin-Token'] = tok;
      return fetch(getAiActionUrl(actionName), { method: 'GET', cache: 'no-store', headers: headers });
    })
      .then((res) => res.json().catch(() => ({ ok: false, error: 'Błąd odpowiedzi serwera (' + res.status + ').' })))
      .catch((err) => ({ ok: false, error: (err && err.message) || 'Błąd sieci.' }));
  }

  function callAdminServerPost(actionName, payloadObj) {
    assertAdminAuthenticated();
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      return makeResolvedPromise({ ok: false, offline: true, error: 'Funkcja wymaga serwera HTTP/HTTPS.' });
    }
    const waitTok = serverAdminTokenPromise || Promise.resolve(null);
    return waitTok.then(() => {
      const tok = resolveAdminRequestToken();
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const bodyObj = (payloadObj && typeof payloadObj === 'object' && !Array.isArray(payloadObj))
        ? Object.assign({}, payloadObj)
        : {};
      if (tok) {
        headers['X-SMPL-Admin-Token'] = tok;
        bodyObj._adminToken = tok;
      }
      return fetch(getAiActionUrl(actionName), { method: 'POST', headers: headers, body: JSON.stringify(bodyObj) });
    })
      .then((res) => res.json().catch(() => ({ ok: false, error: 'Błąd odpowiedzi serwera (' + res.status + ').' })))
      .catch((err) => ({ ok: false, error: (err && err.message) || 'Błąd sieci.' }));
  }

  function fetchWebhooksConfig() { return callAdminServerGet('webhooks_get'); }
  function saveWebhooksConfig(cfg) { return callAdminServerPost('webhooks_save', cfg); }
  function testWebhooks() { return callAdminServerPost('webhooks_test', {}); }
  function broadcastWebhook(title, message, adminOnly) {
    return callAdminServerPost('webhooks_broadcast', { title: title, message: message, adminOnly: Boolean(adminOnly) });
  }
  function fetchSnapshotsList() { return callAdminServerGet('snapshots_list'); }

  function restoreServerSnapshot(snapshotName) {
    assertMasterAdminAuthenticated();
    return callAdminServerPost('snapshot_restore', { name: snapshotName }).then((data) => {
      if (data && data.ok && data.state && Array.isArray(data.state.players)) {
        captureServerArchiveSnapshot(data.state);
        state = ensureMasterExtensions(enrichFromArchive(data.state));
        ensureCompetitionsStructure(state);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
      }
      return data;
    });
  }

  function verifyMatchScreenshotAI({ screenshot, homeName, awayName, expectedHome, expectedAway }) {
    return sendAuthenticatedActionToServer('ai_verify_match_ss', {
      screenshot: screenshot,
      homeName: homeName,
      awayName: awayName,
      expectedHome: expectedHome,
      expectedAway: expectedAway
    }, isStrictAdminSession(getSession()), 'Błąd połączenia przy analizie SS przez Gemini AI.');
  }

  function isByeSlotPlayer(pl) {
    if (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.isPlaceholderPlayer === 'function') {
      return window.SMPL_ENGINE.isPlaceholderPlayer(pl);
    }
    return Boolean(pl && (pl.isPlaceholder === true || pl.gdprDeleted === true || /^wolny\s*los|^wl\d+$/i.test(String(pl.name || '').trim())));
  }

  function syncByeMatchesForSlot(slotPlayer, becomeReal) {
    if (!slotPlayer || !Array.isArray(state.matches)) return;
    const playersById = {};
    (state.players || []).forEach((item) => {
      if (item && item.id) playersById[item.id] = item;
    });
    const rpw = Math.max(1, Number((state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4));
    const curWeek = Math.max(1, Number((state.weeklyConfig && state.weeklyConfig.currentWeek) || 1));
    const curStartRound = (curWeek - 1) * rpw + 1;

    state.matches.forEach((m) => {
      if (!m || (m.homeId !== slotPlayer.id && m.awayId !== slotPlayer.id)) return;
      const isHome = m.homeId === slotPlayer.id;
      const otherPl = playersById[isHome ? m.awayId : m.homeId];
      const otherIsBye = isByeSlotPlayer(otherPl);

      if (becomeReal) {
        if (otherIsBye) {
          m.homeScore = isHome ? 2 : 0;
          m.awayScore = isHome ? 0 : 2;
          m.status = 'WALKOVER';
          m.isByeWalkover = true;
          m.submittedBy = 'SYSTEM (WOLNY LOS)';
          m.approvedBy = 'SYSTEM SMPL';
          m.comment = isHome ? 'Automatyczny walkower 2:0 WO (WOLNY LOS).' : 'Automatyczny walkower 0:2 WO (WOLNY LOS).';
        } else if (m.isByeWalkover === true && (curWeek <= 1 || Number(m.round || 1) >= curStartRound)) {
          m.status = 'SCHEDULED';
          m.homeScore = null;
          m.awayScore = null;
          m.screenshot = null;
          m.submittedBy = null;
          m.submittedAt = null;
          m.approvedBy = null;
          m.approvedAt = null;
          m.comment = '';
          delete m.isByeWalkover;
        }
      } else if (m.status === 'SCHEDULED') {
        m.status = 'WALKOVER';
        m.isByeWalkover = true;
        m.submittedBy = 'SYSTEM (WOLNY LOS)';
        m.approvedBy = 'SYSTEM SMPL';
        if (otherIsBye) {
          m.homeScore = 0;
          m.awayScore = 0;
          m.comment = 'Pusty dwumecz między slotami WOLNY LOS (0:0).';
        } else {
          m.homeScore = isHome ? 0 : 2;
          m.awayScore = isHome ? 2 : 0;
          m.comment = isHome ? 'Automatyczny walkower 0:2 WO (WOLNY LOS).' : 'Automatyczny walkower 2:0 WO (WOLNY LOS).';
        }
      }
    });
  }

  function addByeSlotPlayer(leagueId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const lid = String(leagueId || 'L1').toUpperCase().trim() || 'L1';
    ensureSingleLeagueExists(state, lid, true);
    const curSlots = (state.players || []).filter((p) => p && p.leagueId === lid && p.active !== false);
    const existingByes = curSlots.filter((p) => isByeSlotPlayer(p)).length;
    const byeNum = existingByes + 1;
    const byeName = 'WOLNY LOS ' + byeNum;
    const ts = Date.now();
    const byePlayer = {
      id: `${lid}_WL_${byeNum}_${ts.toString(36).slice(-4)}`,
      name: byeName,
      nick: 'WOLNY_LOS_' + byeNum,
      username: 'wolny.los.' + lid.toLowerCase() + '.' + byeNum + '.' + ts.toString(36).slice(-3),
      fb: '',
      fbLink: '',
      leagueId: lid,
      excelOrder: curSlots.length + 1,
      isPlaceholder: true,
      active: true,
      avatar: window.SMPL_MEDIA.generatePlayerAvatar(byeName, 'BYE', 99),
      bio: 'Wolny slot w tabeli (daje 2:0 i 0:2 WO do czasu przyjęcia gracza).',
      penaltyPoints: 0,
      penaltyReason: '',
      yellowCards: 0,
      redCards: 0,
      isSuspended: false,
      joinedSeason: state.season || 56,
      trophies: [],
      notifications: []
    };
    state.players.push(byePlayer);
    addLog('PLAYER_ADD_BYE', `🤖 Admin ${adminName} dodał slot ${byeName} do ligi ${lid} (automatyczne 2:0/0:2 do czasu zapisu gracza).`);
    syncToBackend();
    return byePlayer;
  }

  function getMaxLeagueRoundsForWeeks() {
    let maxR = 0;
    Object.keys(state.leagues || {}).forEach((lid) => {
      if (state.leagues[lid] && Number(state.leagues[lid].totalRounds || 0) > maxR) {
        maxR = Number(state.leagues[lid].totalRounds || 0);
      }
    });
    (state.matches || []).forEach((m) => {
      if (m && Number(m.round || 0) > maxR) maxR = Number(m.round || 0);
    });
    return maxR > 0 ? maxR : 15;
  }

  function setCurrentWeek(weekNum, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const rpw = Math.max(1, Number((state.weeklyConfig && state.weeklyConfig.roundsPerWeek) || 4));
    const maxRound = getMaxLeagueRoundsForWeeks();
    const calcTotalWeeks = Math.max(1, Math.ceil(maxRound / rpw));
    if (!state.weeklyConfig) state.weeklyConfig = { roundsPerWeek: rpw, currentWeek: 1, totalWeeks: calcTotalWeeks };
    state.weeklyConfig.totalWeeks = calcTotalWeeks;
    state.weeklyConfig.currentWeek = Math.max(1, Math.min(calcTotalWeeks, Number(weekNum || 1)));
    const rStart = (state.weeklyConfig.currentWeek - 1) * rpw + 1;
    const rEnd = Math.min(maxRound, state.weeklyConfig.currentWeek * rpw);
    addLog(
      'WEEK_CHANGE',
      `📅 Admin ${adminName} ustawił aktywny Tydzień Rozgrywkowy #${state.weeklyConfig.currentWeek} (Kolejki ${rStart}–${rEnd} • ${rpw} kolejki na tydzień).`
    );
    syncToBackend();
    return state.weeklyConfig;
  }

  function deletePlayerAccountGDPR(playerId, passwordOrReason = '') {
    const __sess = getSession();
    const p = (state.players || []).find((item) => item.id === playerId);
    if (!p) throw new Error('Nie znaleziono konta gracza.');

    const isOwnerAdmin = isStrictAdminSession(__sess);
    const isVerifiedSelf = Boolean(
      __sess &&
      __sess.isPlayerAuthenticated &&
      __sess.activePlayerId === p.id &&
      verifySecret(p, passwordOrReason)
    );
    if (!isOwnerAdmin && !isVerifiedSelf) {
      throw new Error('Odmowa dostępu: Zaloguj się na swoje konto i potwierdź operację poprawnym hasłem!');
    }

    const oldName = p.name;
    p.name = 'WOLNY LOS (Konto Usunięte RODO)';
    p.nick = 'WOLNY_LOS';
    p.fb = '';
    p.isPlaceholder = true;
    p.gdprDeleted = true;
    p.username = 'wolny.los.' + p.id.toLowerCase();
    delete p.password;
    delete p.passwordHash;
    p.avatar = window.SMPL_MEDIA.generatePlayerAvatar('WOLNY LOS', 'BYE', 99);
    syncByeMatchesForSlot(p, false);
    addLog(
      'GDPR_DELETE',
      `⚖️ Wykonano żądanie RODO (Prawo do bycia zapomnianym) dla byłego konta: ${oldName}. Zastąpiono statusem WOLNY LOS.`
    );
    syncToBackend();
    return p;
  }

  function updatePlayer(playerId, updates, adminName = 'Szymon Komenda') {
    const __sess = assertAdminAuthenticated();
    const p = state.players.find((item) => item.id === playerId);
    if (!p) throw new Error('Nie znaleziono gracza.');

    const actorName = String(adminName || __sess.adminName || 'Administrator SMPL').trim();
    const oldPenalty = Number(p.penaltyPoints || 0);
    let nextPenalty = oldPenalty;
    let nextPenaltyReason = String(p.penaltyReason || '').trim();

    if (updates.penaltyPoints !== undefined) {
      const numVal = Number(updates.penaltyPoints);
      if (isNaN(numVal)) {
        throw new Error('Podaj poprawną liczbę punktów karnych.');
      }
      nextPenalty = Math.floor(Math.abs(numVal));
    }
    if (updates.penaltyReason !== undefined) {
      nextPenaltyReason = String(updates.penaltyReason || '').trim();
    }

    if ((nextPenalty !== oldPenalty && nextPenalty > 0) || (nextPenalty > 0 && updates.penaltyReason !== undefined && nextPenaltyReason.length < 3)) {
      if (nextPenaltyReason.length < 3) {
        throw new Error('⚠️ Musisz obowiązkowo podać powód odjęcia punktów (min. 3 znaki) — każdy Admin zobaczy ten wpis!');
      }
    }

    if (updates.name !== undefined) p.name = updates.name.trim();
    if (updates.nick !== undefined) p.nick = updates.nick.trim();
    if (updates.fb !== undefined) p.fb = updates.fb.trim();
    if (updates.leagueId !== undefined) p.leagueId = updates.leagueId;
    if (updates.avatar !== undefined && updates.avatar) p.avatar = updates.avatar;
    if (updates.bio !== undefined) p.bio = sanitizeProfileBio(updates.bio);
    if (updates.customRank !== undefined) p.customRank = updates.customRank ? updates.customRank.trim() : null;
    if (updates.clanId !== undefined || updates.newClanName !== undefined) {
      const updClanInfo = resolvePlayerClanPayload({
        clanId: updates.clanId,
        newClanName: updates.newClanName,
        newClanTag: updates.newClanTag,
        newClanColor: updates.newClanColor,
        newClanLogo: updates.newClanLogo,
        createdBy: actorName
      });
      p.clanId = updClanInfo.clanId;
      p.clanName = updClanInfo.clanName;
      p.clanTag = updClanInfo.clanTag;
      p.clanLogo = updClanInfo.clanLogo;
    }

    if (updates.penaltyPoints !== undefined) {
      p.penaltyPoints = nextPenalty;
      if (nextPenalty > 0) {
        p.penaltyReason = nextPenaltyReason;
        if (nextPenalty !== oldPenalty || !p.penaltyBy) {
          p.penaltyBy = actorName;
          p.penaltyAt = nowFormatted();
        }
      } else {
        p.penaltyReason = '';
        p.penaltyBy = '';
        p.penaltyAt = '';
      }
    } else if (updates.penaltyReason !== undefined) {
      p.penaltyReason = nextPenaltyReason;
    }

    if (p.penaltyPoints !== oldPenalty) {
      const logReason = p.penaltyPoints > 0
        ? p.penaltyReason
        : (nextPenaltyReason.length >= 3 ? nextPenaltyReason : 'Zdjęcie kary punktowej przez Admina');
      const delta = p.penaltyPoints - oldPenalty;
      const entryId = 'DISC_SET_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      const stamp = nowFormatted();

      if (!Array.isArray(p.disciplinaryHistory)) p.disciplinaryHistory = [];
      p.disciplinaryHistory.unshift({
        id: entryId,
        date: stamp,
        actionType: p.penaltyPoints > 0 ? 'PENALTY_SET' : 'PENALTY_CLEARED',
        penaltyPoints: p.penaltyPoints,
        previousPenalty: oldPenalty,
        delta: delta,
        yellowCards: 0,
        redCards: 0,
        isSuspended: false,
        reason: logReason,
        adminName: actorName
      });

      if (!Array.isArray(state.disciplinaryLog)) state.disciplinaryLog = [];
      state.disciplinaryLog.unshift({
        id: entryId,
        playerId: p.id,
        playerName: p.name,
        playerNick: p.nick,
        leagueId: p.leagueId,
        actionType: p.penaltyPoints > 0 ? 'PENALTY_SET' : 'PENALTY_CLEARED',
        penaltyPoints: p.penaltyPoints,
        previousPenalty: oldPenalty,
        delta: delta,
        yellowCards: 0,
        redCards: 0,
        isSuspended: false,
        reason: logReason,
        date: stamp,
        adminName: actorName
      });

      if (!Array.isArray(p.notifications)) p.notifications = [];
      p.notifications.unshift({
        id: 'NOTIF_PEN_' + Date.now(),
        time: stamp,
        text: p.penaltyPoints > 0
          ? `⚖️ Admin ${actorName} ustawił karę punktową: -${p.penaltyPoints} pkt. Powód: ${logReason}`
          : `✅ Admin ${actorName} zdjął Twoją karę punktową (${logReason}).`
      });

      addLog(
        'PENALTY',
        `⚖️ Admin ${actorName} zmienił karę punktową gracza ${p.name}: -${oldPenalty} ➔ -${p.penaltyPoints} pkt. Powód: ${logReason}`
      );
    } else {
      addLog('PLAYER_EDIT', `👤 Admin ${actorName} zaktualizował profil gracza ${p.name} (@${p.nick}).`);
    }

    syncToBackend();
    return p;
  }

  function adminManualRegisterPlayer(options, adminName = 'Szymon Komenda', onServerResult) {
    const __sess = assertAdminAuthenticated();
    const opts = options && typeof options === 'object' ? options : {};
    const actorName = adminName || __sess.adminName || 'Szymon Komenda';
    if (!Array.isArray(state.players)) state.players = [];
    if (!Array.isArray(state.registrations)) state.registrations = [];
    if (!Array.isArray(state.clans)) state.clans = [];

    const cleanName = String(opts.name || '').trim();
    const cleanNick = String(opts.nick || '').trim();
    const cleanFb = String(opts.fbLink || opts.fb || '').trim() || 'https://m.me/smpl';
    if (cleanName.length < 2) throw new Error('Podaj imię i nazwisko lub pseudonim gracza (minimum 2 znaki).');
    if (cleanNick.length < 2) throw new Error('Podaj nick gracza w grze Score! Match (minimum 2 znaki).');

    if (isEntityBlacklisted(cleanName, cleanNick, cleanFb)) {
      throw new Error('⛔ Gracz widnieje na Czarnej Liście Score Match Ligi z dożywotnim zakazem gry!');
    }

    const nickFold = foldPlChars(cleanNick);
    const dupPlayer = state.players.find(
      (p) => p && !p.isPlaceholder && !p.gdprDeleted && p.nick && foldPlChars(p.nick) === nickFold
    );
    if (dupPlayer) {
      throw new Error(`Nick @${cleanNick} jest już przypisany do istniejącego gracza.`);
    }
    const dupReg = state.registrations.find(
      (r) => r && (r.status === 'PENDING' || r.status === 'APPROVED_POOL') && r.nick && foldPlChars(r.nick) === nickFold
    );
    if (dupReg) {
      throw new Error(`Konto z nickiem @${cleanNick} już istnieje w kolejce/puli rejestracji.`);
    }

    const rawPwd = opts.password !== undefined ? String(opts.password).trim() : '';
    if (rawPwd && rawPwd.length < 4) {
      throw new Error('Hasło startowe musi mieć minimum 4 znaki.');
    }
    const cleanInitialPass = rawPwd || generateReadablePassword('SMPL');
    const passHash = hashSecret(cleanInitialPass);

    const usedLogins = collectUsedUsernamesSet(false);
    const explicitUser = String(opts.username || '').trim().toLowerCase();
    let cleanUser = '';
    if (explicitUser) {
      if (!/^[a-z0-9._-]{3,40}$/.test(explicitUser)) {
        throw new Error('Login gracza musi mieć 3–40 znaków (małe litery, cyfry, kropka, myślnik lub podkreślnik).');
      }
      if (usedLogins[explicitUser]) {
        throw new Error(`Login "${explicitUser}" jest już zajęty. Wpisz inny login (np. z cyfrą).`);
      }
      cleanUser = explicitUser;
    } else {
      const baseUser = toCleanUsername(cleanName);
      cleanUser = baseUser;
      if (usedLogins[cleanUser]) {
        let sfx = 2;
        while (usedLogins[baseUser + '.' + sfx] && sfx < 999) sfx++;
        cleanUser = baseUser + '.' + sfx;
      }
    }

    const rawTargetLg = String(opts.leagueId || 'L2').trim().toUpperCase();
    const isPool = String(opts.targetMode || '').toUpperCase() === 'POOL' || rawTargetLg === 'APPROVED_POOL' || rawTargetLg === 'POOL';
    const targetLg = isPool ? 'APPROVED_POOL' : (/^L\d{1,2}$/.test(rawTargetLg) ? rawTargetLg : 'L2');

    const prevSnap = {
      players: JSON.stringify(state.players),
      registrations: JSON.stringify(state.registrations),
      clans: JSON.stringify(state.clans),
      leagues: JSON.stringify(state.leagues || {}),
      allTimeRanking: JSON.stringify(state.allTimeRanking || []),
      activityLog: JSON.stringify(state.activityLog || []),
      updatedAt: state.updatedAt || 0
    };

    const directClanInfo = resolvePlayerClanPayload({
      clanId: opts.clanId,
      newClanName: opts.newClanName,
      newClanTag: opts.newClanTag,
      newClanColor: opts.newClanColor,
      newClanLogo: opts.newClanLogo,
      createdBy: actorName
    });

    const tsMs = Date.now();
    const nowFmt = nowFormatted();
    const curSeason = state.season || 56;
    const cleanBio = sanitizeProfileBio(opts.bio || '');
    const cleanHist = String(opts.historicalArchiveName || '').trim();
    const genAv = (idx) => (window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
      ? window.SMPL_MEDIA.generatePlayerAvatar(cleanName, cleanNick, idx)
      : '');
    const finalAvatar = String(opts.avatar || '') || genAv(state.players.length + 1);

    let outPlayer = null;
    let outReg = null;
    let entityId = '';

    if (isPool) {
      const prefLg = /^L\d{1,2}$/.test(String(opts.preferredLeague || '').toUpperCase())
        ? String(opts.preferredLeague).toUpperCase()
        : 'L2';
      entityId = 'REG_MAN_' + tsMs.toString(36) + '_' + Math.random().toString(36).slice(2, 5);
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
        reviewedBy: actorName,
        reviewedAt: nowFmt,
        manualCreatedBy: actorName,
        notes: `Konto założone ręcznie przez Administratora ${actorName} (login i hasło gotowe).`,
        avatar: finalAvatar,
        bio: cleanBio,
        playedBefore: Boolean(cleanHist && cleanHist !== 'NONE'),
        linkedHistoricalName: cleanHist && cleanHist !== 'NONE' ? cleanHist : '',
        clanId: directClanInfo.clanId,
        clanName: directClanInfo.clanName,
        clanTag: directClanInfo.clanTag,
        clanLogo: directClanInfo.clanLogo
      };
      try { Object.defineProperty(outReg, '_tempInitialPassword', { value: cleanInitialPass, enumerable: false, configurable: true }); } catch (e) {}
      state.registrations.unshift(outReg);
    } else {
      ensureSingleLeagueExists(state, targetLg, true);
      const placeholderSlot = state.players.find(
        (p) =>
          p &&
          p.leagueId === targetLg &&
          p.active !== false &&
          (p.isPlaceholder === true || /^wolny los/i.test(p.name || ''))
      );
      if (placeholderSlot) {
        const oldLabel = placeholderSlot.name;
        placeholderSlot.name = cleanName;
        placeholderSlot.nick = cleanNick;
        placeholderSlot.username = cleanUser;
        placeholderSlot.passwordHash = passHash;
        delete placeholderSlot.password;
        placeholderSlot.fb = cleanFb;
        placeholderSlot.fbLink = cleanFb;
        placeholderSlot.clanId = directClanInfo.clanId;
        placeholderSlot.clanName = directClanInfo.clanName;
        placeholderSlot.clanTag = directClanInfo.clanTag;
        placeholderSlot.clanLogo = directClanInfo.clanLogo;
        placeholderSlot.isPlaceholder = false;
        placeholderSlot.replacedPlaceholderName = oldLabel;
        placeholderSlot.avatar = String(opts.avatar || '') || genAv(placeholderSlot.excelOrder || 10);
        placeholderSlot.bio = cleanBio;
        placeholderSlot.joinedSeason = curSeason;
        placeholderSlot.manualCreatedBy = actorName;
        syncByeMatchesForSlot(placeholderSlot, true);
        outPlayer = placeholderSlot;
      } else {
        entityId = `${targetLg}_P_${tsMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        outPlayer = {
          id: entityId,
          name: cleanName,
          nick: cleanNick,
          username: cleanUser,
          passwordHash: passHash,
          fb: cleanFb,
          fbLink: cleanFb,
          leagueId: targetLg,
          excelOrder: state.players.filter((p) => p && p.leagueId === targetLg).length + 1,
          isPlaceholder: false,
          clanId: directClanInfo.clanId,
          clanName: directClanInfo.clanName,
          clanTag: directClanInfo.clanTag,
          clanLogo: directClanInfo.clanLogo,
          avatar: finalAvatar,
          bio: cleanBio,
          penaltyPoints: 0,
          penaltyReason: '',
          joinedSeason: curSeason,
          manualCreatedBy: actorName,
          active: true,
          trophies: [
            {
              id: 'tr_add_' + tsMs,
              icon: '⚽',
              title: 'Zawodnik Score Match Ligi (' + targetLg + ')',
              season: 'Sezon ' + curSeason,
              rarity: 'SILVER'
            }
          ],
          notifications: [
            {
              id: 'NOTIF_MAN_' + tsMs,
              time: nowFmt,
              text: `✍️ Admin ${actorName} utworzył Twoje konto i dopisał Cię do ${targetLg} (login: ${cleanUser}).`
            }
          ]
        };
        state.players.push(outPlayer);
      }
      entityId = outPlayer.id;
      const matchedAdmin = (state.admins || []).find(
        (a) =>
          a &&
          ((a.username && String(a.username).trim().toLowerCase() === cleanUser) ||
            (a.name && foldPlChars(a.name) === foldPlChars(cleanName)))
      );
      if (matchedAdmin) {
        outPlayer.isAdminPlayer = true;
        outPlayer.adminId = matchedAdmin.id;
        outPlayer.adminRole = matchedAdmin.role || 'CO_ADMIN';
      }
      if (cleanHist && cleanHist !== 'NONE') {
        try {
          assignHistoricalStatsToPlayer(outPlayer.id, { archiveName: cleanHist, _skipSync: true }, actorName);
        } catch (e) {}
      }
      try { Object.defineProperty(outPlayer, '_tempInitialPassword', { value: cleanInitialPass, enumerable: false, configurable: true }); } catch (e) {}
    }

    const destLabel = isPool
      ? 'Pula Aktywnych Kont (gotowy do logowania)'
      : ((state.leagues[targetLg] && state.leagues[targetLg].name) || targetLg);

    addLog(
      'ADMIN_MANUAL_REGISTER',
      `✍️ Admin ${actorName} utworzył ręcznie konto gracza ${cleanName} (@${cleanNick}, login: ${cleanUser}) -> ${destLabel}.`
    );

    const messengerText = [
      `⚽ KONTO ZAWODNIKA SCORE MATCH LIGA — GOTOWE DANE LOGOWANIA`,
      `Cześć ${cleanName} (@${cleanNick})! Założyliśmy ręcznie Twoje konto w lidze (${destLabel}):`,
      `👤 Twój Login: ${cleanUser} (lub @${cleanNick})`,
      `🔒 Hasło startowe: ${cleanInitialPass}`,
      `🌐 Zaloguj się na portalu Score Match Liga, aby sprawdzić tabelę, podawać wyniki meczów i edytować profil.`,
      `Pozdrawiamy, Zarząd Score Match Liga (${actorName})`
    ].join('\n');

    const rollbackFn = () => {
      try {
        state.players = JSON.parse(prevSnap.players);
        state.registrations = JSON.parse(prevSnap.registrations);
        state.clans = JSON.parse(prevSnap.clans);
        state.leagues = JSON.parse(prevSnap.leagues);
        state.allTimeRanking = JSON.parse(prevSnap.allTimeRanking);
        state.activityLog = JSON.parse(prevSnap.activityLog);
        state.updatedAt = prevSnap.updatedAt;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {}
    };

    const resultObj = {
      mode: isPool ? 'POOL' : 'LEAGUE',
      player: outPlayer,
      registration: outReg,
      username: cleanUser,
      tempPassword: cleanInitialPass,
      destLabel: destLabel,
      messengerText: messengerText
    };

    sendAtomicAdminAction(
      'admin_manual_register',
      {
        id: entityId,
        targetMode: isPool ? 'POOL' : 'LEAGUE',
        leagueId: targetLg,
        preferredLeague: (opts.preferredLeague && /^L\d{1,2}$/i.test(opts.preferredLeague)) ? String(opts.preferredLeague).toUpperCase() : (isPool ? 'L2' : targetLg),
        name: cleanName,
        nick: cleanNick,
        username: cleanUser,
        passwordHash: passHash,
        fbLink: cleanFb,
        avatar: outPlayer ? outPlayer.avatar : (outReg ? outReg.avatar : finalAvatar),
        bio: cleanBio,
        historicalArchiveName: cleanHist && cleanHist !== 'NONE' ? cleanHist : '',
        historicalStats: outPlayer && outPlayer.historicalStats ? outPlayer.historicalStats : null,
        trophies: outPlayer && Array.isArray(outPlayer.trophies) ? outPlayer.trophies : null,
        clanId: directClanInfo.clanId || (opts.clanId || 'NONE'),
        newClanName: opts.newClanName || '',
        newClanTag: opts.newClanTag || '',
        newClanColor: opts.newClanColor || '',
        newClanLogo: opts.newClanLogo || '',
        clanName: directClanInfo.clanName || '',
        clanTag: directClanInfo.clanTag || ''
      },
      rollbackFn,
      resultObj,
      onServerResult
    );

    return resultObj;
  }

  function addDirectPlayer(payload, adminName = 'Szymon Komenda', onServerResult) {
    const res = adminManualRegisterPlayer(payload, adminName, onServerResult);
    return res.player || res.registration;
  }

  function clearAllTablesForFreshSeason56(adminName = 'Szymon Komenda', options = null) {
    assertMasterAdminAuthenticated();
    const opts = options && typeof options === 'object' ? options : {};
    const targetSeason = Math.max(1, Number(opts.seasonNumber) || 56);
    state.season = targetSeason;
    state.seasonName = `Sezon ${targetSeason} — Czysty Start (Puste Tabele do Samodzielnego Obsadzenia)`;
    if (state.weeklyConfig) {
      state.weeklyConfig.currentWeek = 1;
    }
    if (state.leagues) {
      Object.keys(state.leagues).forEach((lid) => {
        if (state.leagues[lid]) state.leagues[lid].totalRounds = 15;
      });
    }
    const leftAtStr = nowFormatted();
    state.players = (state.players || [])
      .filter((p) => p && p.isPlaceholder !== true)
      .map((p) => {
        p.leagueId = 'POOL';
        p.active = false;
        p.excelOrder = 0;
        p.leftLeagueAt = leftAtStr;
        p.penaltyPoints = 0;
        p.penaltyReason = '';
        p.yellowCards = 0;
        p.redCards = 0;
        p.isSuspended = false;
        return p;
      });
    (state.registrations || []).forEach((r) => {
      if (r && (r.status === 'ASSIGNED' || r.status === 'APPROVED')) {
        r.assignedLeague = 'POOL';
      }
    });
    state.matches = [];

    if (opts.wipeSocialAndVotes) {
      state.registrations = [];
      state.passwordRequests = [];
      state.chatMessages = [];
      state.directMessages = [];
      state.moderationIncidents = [];
      state.disciplinaryLog = [];
      state.activityLog = [];
      state.aiUnansweredQueue = [];
      state.aiInteractionLog = [];
      state.goldenBall = {
        season: targetSeason,
        isOpen: true,
        winnerPlayerId: null,
        votes: []
      };
      state.competitions = buildDefaultCompetitionsState(targetSeason);
    } else if (state.goldenBall) {
      state.goldenBall.season = targetSeason;
      if (state.competitions) state.competitions.season = targetSeason;
    }

    if (opts.wipeBlacklist) {
      state.blacklist = [];
    }

    if (opts.keepOnlyMasterAdmin && Array.isArray(state.admins)) {
      const masterAdmins = state.admins.filter(
        (a) => a.id === 'ADM_MASTER' || a.role === 'MASTER_ADMIN'
      );
      if (masterAdmins.length > 0) {
        state.admins = masterAdmins;
      }
    }

    const activeLeaguesDesc = getLeaguesList(state, false).map((l) => l.shortName || l.name || l.id).join(', ');
    addLog(
      'SEASON_56_EMPTY_START',
      `🧹 Admin ${adminName} przygotował Czysty Start pod Sezon ${targetSeason}. Wszystkie aktywne ligi (${activeLeaguesDesc}) są puste i gotowe do obsadzenia!`
    );
    syncToBackend();
    return state;
  }

  function clearSingleLeague(leagueId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const lName = (state.leagues && state.leagues[leagueId] && state.leagues[leagueId].name) || leagueId;
    const leftAtStr = nowFormatted();
    const movedIds = Object.create(null);
    const movedUsers = Object.create(null);
    let movedCount = 0;

    state.players = (state.players || []).filter((p) => {
      if (!p) return false;
      if (p.isPlaceholder === true && p.leagueId === leagueId) {
        return false;
      }
      if (p.leagueId === leagueId) {
        p.leagueId = 'POOL';
        p.active = false;
        p.excelOrder = 0;
        p.leftLeagueAt = leftAtStr;
        if (p.id) movedIds[p.id] = true;
        if (p.username) movedUsers[String(p.username).trim().toLowerCase()] = true;
        movedCount += 1;
      }
      return true;
    });

    (state.registrations || []).forEach((r) => {
      if (!r) return;
      const rUser = r.username ? String(r.username).trim().toLowerCase() : '';
      if (
        r.assignedLeague === leagueId ||
        (r.assignedPlayerId && movedIds[r.assignedPlayerId]) ||
        (rUser && movedUsers[rUser])
      ) {
        r.assignedLeague = 'POOL';
      }
    });

    state.matches = (state.matches || []).filter((m) => m.leagueId !== leagueId);
    addLog(
      'LEAGUE_CLEAR',
      `🧹 Admin ${adminName} wyczyścił tabelę i terminarz ligi: ${lName}. Przeniesiono bezpiecznie ${movedCount} graczy do Puli Graczy (POOL) z zachowaniem kont, haseł i statystyk.`
    );
    syncToBackend();
    return state;
  }

  function movePlayerToLeague(playerId, targetLeagueId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const p = (state.players || []).find((item) => item.id === playerId);
    if (!p) throw new Error('Nie znaleziono gracza.');
    const oldLeague = p.leagueId;
    const targetLid = String(targetLeagueId || '').toUpperCase().trim() || 'POOL';

    if (targetLid === 'POOL') {
      p.leagueId = 'POOL';
      p.active = false;
      p.excelOrder = 0;
      p.leftLeagueAt = nowFormatted();
    } else {
      ensureSingleLeagueExists(state, targetLid, true);
      p.leagueId = targetLid;
      p.active = true;
      p.leftLeagueAt = null;
      p.excelOrder = (state.players || []).filter(
        (item) => item && item.leagueId === targetLid && item.active !== false && !item.isPlaceholder
      ).length;
    }

    // Zsynchronizuj powiązany rekord rejestracji w state.registrations
    const pUserLow = p.username ? String(p.username).trim().toLowerCase() : '';
    const pNickLow = p.nick ? String(p.nick).trim().toLowerCase() : '';
    (state.registrations || []).forEach((r) => {
      if (!r) return;
      const rUser = r.username ? String(r.username).trim().toLowerCase() : '';
      const rNick = r.nick ? String(r.nick).trim().toLowerCase() : '';
      if (
        (r.assignedPlayerId && r.assignedPlayerId === p.id) ||
        (pUserLow && rUser === pUserLow) ||
        (pNickLow && rNick === pNickLow)
      ) {
        r.assignedLeague = targetLid;
        r.status = 'ASSIGNED';
        r.assignedPlayerId = p.id;
      }
    });

    // Usuwamy zaplanowane mecze z poprzedniej ligi dla tego gracza, aby terminarze były spójne
    state.matches = (state.matches || []).filter(
      (m) => !(m.leagueId === oldLeague && (m.homeId === playerId || m.awayId === playerId) && m.status === 'SCHEDULED')
    );
    const targetLgName =
      targetLid === 'POOL'
        ? 'Pula Graczy (POOL)'
        : (state.leagues && state.leagues[targetLid] && state.leagues[targetLid].name) || targetLid;
    addLog(
      'PLAYER_MOVE',
      `🔄 Admin ${adminName} przeniósł gracza ${p.name} (@${p.nick}) z ${oldLeague} do: ${targetLgName}.`
    );
    syncToBackend();
    return p;
  }

  function deletePlayer(playerId, adminName = 'Szymon Komenda', options = null) {
    assertAdminAuthenticated();
    const opts = options && typeof options === 'object' ? options : {};
    const p = (state.players || []).find((item) => item.id === playerId);
    if (!p) throw new Error('Nie znaleziono gracza.');
    const oldLeague = p.leagueId;
    const isHardDelete = opts.hardDeleteAccount === true || p.isPlaceholder === true;

    if (!isHardDelete) {
      p.leagueId = 'POOL';
      p.active = false;
      p.excelOrder = 0;
      p.leftLeagueAt = nowFormatted();
      state.matches = (state.matches || []).filter(
        (m) => !(m.leagueId === oldLeague && (m.homeId === playerId || m.awayId === playerId) && m.status === 'SCHEDULED')
      );
      const pUserLow = p.username ? String(p.username).trim().toLowerCase() : '';
      const pNickLow = p.nick ? String(p.nick).trim().toLowerCase() : '';
      (state.registrations || []).forEach((r) => {
        if (!r) return;
        const rUser = r.username ? String(r.username).trim().toLowerCase() : '';
        const rNick = r.nick ? String(r.nick).trim().toLowerCase() : '';
        if (
          (r.assignedPlayerId && r.assignedPlayerId === p.id) ||
          (pUserLow && rUser === pUserLow) ||
          (pNickLow && rNick === pNickLow)
        ) {
          r.assignedLeague = 'POOL';
        }
      });
      addLog(
        'PLAYER_MOVE_POOL',
        `📦 Admin ${adminName} wypisał gracza ${p.name} (@${p.nick}) z ligi ${oldLeague} do Puli Graczy (POOL) — konto, hasło i trofea zostały zachowane.`
      );
      syncToBackend();
      return p;
    }

    state.players = (state.players || []).filter((item) => item.id !== playerId);
    state.matches = (state.matches || []).filter(
      (m) => !(m.homeId === playerId || m.awayId === playerId)
    );
    const pUserLow = p.username ? String(p.username).trim().toLowerCase() : '';
    const pNickLow = p.nick ? String(p.nick).trim().toLowerCase() : '';
    (state.registrations || []).forEach((r) => {
      if (!r) return;
      const rUser = r.username ? String(r.username).trim().toLowerCase() : '';
      const rNick = r.nick ? String(r.nick).trim().toLowerCase() : '';
      if (
        (r.assignedPlayerId && r.assignedPlayerId === playerId) ||
        (pUserLow && rUser === pUserLow) ||
        (pNickLow && rNick === pNickLow)
      ) {
        r.status = 'APPROVED_POOL';
        r.assignedLeague = null;
        r.assignedPlayerId = null;
      }
    });
    addLog(
      'PLAYER_DELETE',
      `🗑️ Admin ${adminName} trwale usunął konto gracza ${p.name} (@${p.nick}) z ${oldLeague}.`
    );
    syncToBackend({ allowHardDeletePlayerId: playerId });
    return p;
  }

  function startFreshSeason56(adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    const targetSeason = Math.max(56, Number(state.season || 56));
    state.season = targetSeason;
    state.seasonName = `Sezon ${targetSeason} — Oficjalny Start Rozgrywek (Czysta Tabela 0:0)`;
    if (state.weeklyConfig) {
      state.weeklyConfig.currentWeek = 1;
    }
    (state.players || []).forEach((p) => {
      p.penaltyPoints = 0;
      p.penaltyReason = '';
      p.yellowCards = 0;
      p.redCards = 0;
      p.isSuspended = false;
    });
    (state.matches || []).forEach((m) => {
      m.status = 'SCHEDULED';
      m.homeScore = null;
      m.awayScore = null;
      m.screenshot = null;
      m.submittedBy = null;
      m.submittedAt = null;
      m.approvedBy = null;
      m.approvedAt = null;
      m.comment = '';
    });
    addLog(
      'SEASON_56_START',
      `🚀 Admin ${adminName} wystartował czysty Sezon ${targetSeason}! Wszystkie ${(state.matches || []).length} meczów w ligach zostało wyzerowanych (0:0) pod 1. kolejkę.`
    );
    syncToBackend();
    return state;
  }

  function restoreExcelSeason55State(adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    state.season = 56;
    state.seasonName = 'Sezon 56 — Stan z Arkusza Excel (6 Rozegranych Meczów w Ekstraklasie)';
    (state.matches || []).forEach((m) => {
      if (m.excelDefaultStatus === 'APPROVED' && m.excelDefaultHomeScore !== null && m.excelDefaultAwayScore !== null) {
        m.status = 'APPROVED';
        m.homeScore = Number(m.excelDefaultHomeScore);
        m.awayScore = Number(m.excelDefaultAwayScore);
        m.approvedBy = 'Szymon Komenda (Excel)';
        m.approvedAt = nowFormatted();
        m.comment = 'Wynik z oficjalnego arkusza Excel SMPL.';
      } else {
        m.status = 'SCHEDULED';
        m.homeScore = null;
        m.awayScore = null;
        m.screenshot = null;
        m.submittedBy = null;
        m.submittedAt = null;
        m.approvedBy = null;
        m.approvedAt = null;
        m.comment = '';
      }
    });
    addLog(
      'EXCEL_RESTORE',
      `📊 Admin ${adminName} przywrócił dokładny stan z arkusza Excel (6 zatwierdzonych meczów w Ekstraklasie: Olczyk 6 pkt, Maciejewski 4 pkt, Dziubak 3 pkt, Rachwalski 3 pkt, Pełka 1 pkt).`
    );
    syncToBackend();
    return state;
  }

  function clearLeagueSchedule(leagueIdOrAll = 'ALL', adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    if (!Array.isArray(state.matches)) state.matches = [];
    const target = String(leagueIdOrAll || 'ALL').trim().toUpperCase() || 'ALL';
    let removedCount = 0;

    if (target === 'ALL') {
      removedCount = state.matches.length;
      state.matches = [];
      Object.keys(state.leagues || {}).forEach((lid) => {
        if (state.leagues[lid]) {
          state.leagues[lid].totalRounds = 0;
        }
      });
      if (state.weeklyConfig) {
        state.weeklyConfig.currentWeek = 1;
      }
      addLog(
        'SCHEDULE_CLEAR',
        `\uD83D\uDDD1\uFE0F Admin ${adminName} wyzerowa\u0142 CA\u0141Y terminarz we wszystkich ligach (${removedCount} mecz\u00F3w usuni\u0119tych \u2014 gotowe do nowego wygenerowania).`
      );
    } else {
      const beforeCount = state.matches.length;
      state.matches = state.matches.filter((m) => m && m.leagueId !== target);
      removedCount = beforeCount - state.matches.length;
      if (state.leagues && state.leagues[target]) {
        state.leagues[target].totalRounds = 0;
      }
      const lgLabel = (state.leagues && state.leagues[target] && state.leagues[target].name) || target;
      addLog(
        'SCHEDULE_CLEAR',
        `\uD83D\uDDD1\uFE0F Admin ${adminName} wyzerowa\u0142 terminarz ligi ${lgLabel} (${removedCount} mecz\u00F3w usuni\u0119tych \u2014 gotowe do nowego wygenerowania).`
      );
    }

    syncToBackend();
    return { target, removedCount };
  }

  function generateLeagueSchedule(leagueId, preservePlayed = true, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const leaguePlayers = state.players.filter((p) => p.leagueId === leagueId && p.active !== false);
    const otherMatches = state.matches.filter((m) => m.leagueId !== leagueId);
    const currentLeagueMatches = state.matches.filter((m) => m.leagueId === leagueId);

    const newlyGenerated = window.SMPL_ENGINE.generateRoundRobinSchedule(
      leaguePlayers,
      leagueId,
      currentLeagueMatches,
      preservePlayed
    );

    state.matches = [...otherMatches, ...newlyGenerated];
    const maxRound = newlyGenerated.reduce((acc, m) => Math.max(acc, Number(m.round || 1)), 1);
    if (state.leagues[leagueId]) {
      state.leagues[leagueId].totalRounds = maxRound;
    }
    if (!state.weeklyConfig) state.weeklyConfig = { roundsPerWeek: 4, currentWeek: 1, totalWeeks: 4 };
    const rpwGen = Math.max(1, Number(state.weeklyConfig.roundsPerWeek || 4));
    const maxAllRounds = getMaxLeagueRoundsForWeeks();
    state.weeklyConfig.totalWeeks = Math.max(1, Math.ceil(maxAllRounds / rpwGen));

    addLog(
      'SCHEDULE_GEN',
      `🗓️ Admin ${adminName} wygenerował terminarz „Każdy z każdym” (dwumecz w każdej kolejce, ${maxRound} kolejek, ${newlyGenerated.length} meczów) dla ligi ${state.leagues[leagueId].name || leagueId}.`
    );

    syncToBackend();
    return newlyGenerated;
  }

  function startNextSeasonRollover(options = {}, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const opts = options && typeof options === 'object' ? options : {};
    const archiveOldSeason = opts.archiveOldSeason !== false;
    const applyPromotions = opts.applyPromotions !== false;
    const prevSeason = Math.max(1, Number(state.season || 56));
    const nextSeason = Math.max(prevSeason + 1, Number(opts.targetSeason || (prevSeason + 1)));

    const activeIds = getActiveLeagueIds(state);
    const preStandings = {};
    activeIds.forEach((lid) => {
      preStandings[lid] = window.SMPL_ENGINE.calculateStandings(state, lid);
    });

    function hasPlayedMatchesInPair(lidA, lidB) {
      return (state.matches || []).some(
        (m) => (m.leagueId === lidA || m.leagueId === lidB) && m.status === 'APPROVED'
      );
    }

    let archivedEntry = null;
    if (archiveOldSeason) {
      archivedEntry = archiveCurrentSeason(adminName);
    }

    const movesSummary = [];
    if (applyPromotions) {
      const pendingMoves = [];
      const resolvedPlayoffs = (state.competitions && state.competitions.playoffs && Array.isArray(state.competitions.playoffs.ties))
        ? state.competitions.playoffs.ties.filter((t) => t && t.status === 'DONE' && t.winnerPlayerId)
        : [];
      resolvedPlayoffs.forEach((tie) => {
        if (tie.winnerPlayerId === tie.lowerPlayerId) {
          pendingMoves.push({ playerId: tie.lowerPlayerId, name: tie.lowerPlayerName, from: tie.lowerLeagueId, to: tie.upperLeagueId, type: 'PROMOTION' });
          pendingMoves.push({ playerId: tie.upperPlayerId, name: tie.upperPlayerName, from: tie.upperLeagueId, to: tie.lowerLeagueId, type: 'RELEGATION' });
        }
      });

      for (let i = 0; i < activeIds.length - 1; i++) {
        const upperId = activeIds[i];
        const lowerId = activeIds[i + 1];
        const upperList = preStandings[upperId] || [];
        const lowerList = preStandings[lowerId] || [];
        if (upperList.length >= 4 && lowerList.length >= 4 && hasPlayedMatchesInPair(upperId, lowerId)) {
          upperList.slice(-2).forEach((r) => {
            pendingMoves.push({ playerId: r.playerId, name: r.name, from: upperId, to: lowerId, type: 'RELEGATION' });
          });
          lowerList.slice(0, 2).forEach((r) => {
            pendingMoves.push({ playerId: r.playerId, name: r.name, from: lowerId, to: upperId, type: 'PROMOTION' });
          });
        }
      }

      const movedIds = {};
      pendingMoves.forEach((mv) => {
        if (!mv.playerId || movedIds[mv.playerId]) return;
        const player = (state.players || []).find((p) => p.id === mv.playerId);
        if (!player) return;
        movedIds[mv.playerId] = true;
        player.leagueId = mv.to;
        if (!player.notifications) player.notifications = [];
        const arrowIcon = mv.type === 'PROMOTION' ? '⬆️' : '⬇️';
        const label = mv.type === 'PROMOTION' ? 'AWANS' : 'SPADEK';
        player.notifications.unshift({
          id: 'NOTIF_ROLL_' + nextSeason + '_' + player.id,
          time: nowFormatted(),
          text: `${arrowIcon} ${label} przed Sezonem ${nextSeason}: Przeniesienie z ${mv.from} do ${mv.to} na podstawie tabeli Sezonu ${prevSeason}!`
        });
        movesSummary.push(mv);
      });
    }

    state.season = nextSeason;
    state.seasonName = `Sezon ${nextSeason} — Oficjalne Rozgrywki SMPL`;
    if (!state.weeklyConfig) {
      state.weeklyConfig = { roundsPerWeek: 4, currentWeek: 1, totalWeeks: 8 };
    } else {
      state.weeklyConfig.currentWeek = 1;
    }

    // Zachowujemy wielosezonowy sklepik (odblokowane kosmetyki + wypracowane saldo Coins przenoszone do carryoverCoins)
    const prevCompShop = ensureCompetitionsStructure(state).playerShop || { unlocks: {}, bonusCoins: {}, giftHistory: [] };
    const carriedShop = {
      unlocks: {},
      bonusCoins: Object.assign({}, prevCompShop.bonusCoins || {}),
      giftHistory: Array.isArray(prevCompShop.giftHistory) ? prevCompShop.giftHistory.slice(0, 50) : []
    };
    const pidSet = {};
    (state.players || []).forEach((p) => { if (p && p.id) pidSet[String(p.id)] = true; });
    Object.keys(prevCompShop.unlocks || {}).forEach((k) => { if (k) pidSet[String(k)] = true; });
    Object.keys(prevCompShop.bonusCoins || {}).forEach((k) => { if (k) pidSet[String(k)] = true; });
    Object.keys(pidSet).forEach((pid) => {
      const prevU = (prevCompShop.unlocks && prevCompShop.unlocks[pid]) ? prevCompShop.unlocks[pid] : null;
      const clonedU = prevU
        ? Object.assign({}, prevU, {
            unlockedItems: Array.isArray(prevU.unlockedItems) ? prevU.unlockedItems.slice() : [],
            claimedQuests: Array.isArray(prevU.claimedQuests) ? prevU.claimedQuests.slice() : [],
            carryoverCoins: Number(prevU.carryoverCoins || 0)
          })
        : {
            frame: 'default', bgStyle: 'default', profileBadge: 'default', nickEffect: 'default',
            posterTheme: 'default', customTitle: '', joinSound: 'default',
            unlockedItems: [], spentCoins: 0, claimedQuests: [], questCoins: 0, giftCoinsReceived: 0, carryoverCoins: 0
          };
      if (window.SMPL_STUDIO && typeof window.SMPL_STUDIO.calculatePlayerCoinsBreakdown === 'function') {
        const bd = window.SMPL_STUDIO.calculatePlayerCoinsBreakdown(state, pid).breakdown || {};
        const seasonMatchGain =
          Number(bd.matchesCoins || 0) +
          Number(bd.cleanSheetCoins || 0) +
          Number(bd.timelyBonusCoins || 0) +
          Number(bd.typerCoins || 0) +
          Number(bd.puskasCoins || 0) +
          Number(bd.goldenBallCoins || 0);
        clonedU.carryoverCoins = Number(clonedU.carryoverCoins || 0) + seasonMatchGain;
      }
      const hasAnyProgress =
        clonedU.carryoverCoins > 0 ||
        Number(clonedU.spentCoins || 0) > 0 ||
        Number(clonedU.questCoins || 0) > 0 ||
        Number(clonedU.giftCoinsReceived || 0) > 0 ||
        clonedU.unlockedItems.length > 0 ||
        clonedU.claimedQuests.length > 0 ||
        (clonedU.frame && clonedU.frame !== 'default') ||
        (clonedU.bgStyle && clonedU.bgStyle !== 'default') ||
        (clonedU.profileBadge && clonedU.profileBadge !== 'default') ||
        (clonedU.nickEffect && clonedU.nickEffect !== 'default') ||
        (clonedU.posterTheme && clonedU.posterTheme !== 'default') ||
        (clonedU.joinSound && clonedU.joinSound !== 'default') ||
        Boolean(clonedU.customTitle);
      if (hasAnyProgress) {
        carriedShop.unlocks[pid] = clonedU;
      }
    });

    state.goldenBall = {
      season: nextSeason,
      isOpen: true,
      winnerPlayerId: null,
      votes: []
    };
    state.competitions = buildDefaultCompetitionsState(nextSeason);
    state.competitions.playerShop = carriedShop;

    (state.players || []).forEach((p) => {
      p.penaltyPoints = 0;
      p.penaltyReason = '';
      p.yellowCards = 0;
      p.redCards = 0;
      p.isSuspended = false;
    });

    state.matches = [];
    let generatedMatchCount = 0;
    let maxRoundsAny = 1;

    activeIds.forEach((lid) => {
      const leaguePlayers = (state.players || []).filter((p) => p.leagueId === lid && p.active !== false);
      if (leaguePlayers.length >= 2) {
        const gen = window.SMPL_ENGINE.generateRoundRobinSchedule(leaguePlayers, lid, [], false);
        Array.prototype.push.apply(state.matches, gen);
        generatedMatchCount += gen.length;
        const maxR = gen.reduce((acc, m) => Math.max(acc, Number(m.round || 1)), 1);
        if (maxR > maxRoundsAny) maxRoundsAny = maxR;
        if (state.leagues && state.leagues[lid]) {
          state.leagues[lid].totalRounds = maxR;
        }
      } else if (state.leagues && state.leagues[lid]) {
        state.leagues[lid].totalRounds = 15;
      }
    });

    if (state.weeklyConfig) {
      const rpw = Math.max(1, Number(state.weeklyConfig.roundsPerWeek || 4));
      state.weeklyConfig.totalWeeks = Math.max(1, Math.ceil(maxRoundsAny / rpw));
    }

    __histCatalogCacheKey = '';
    __histCatalogCache = null;

    addLog(
      'SEASON_ROLLOVER',
      `🚀 Admin ${adminName} zakończył Sezon ${prevSeason} i jednym kliknięciem wystartował Sezon ${nextSeason} (${generatedMatchCount} meczów w terminarzu, ${movesSummary.length} awansów/spadków).`
    );
    syncToBackend();
    return {
      finishedSeason: prevSeason,
      nextSeason: nextSeason,
      matchCount: generatedMatchCount,
      movesSummary: movesSummary,
      archivedEntry: archivedEntry
    };
  }

  function setCustomCrest(leagueId, dataUrl, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    if (!state.customCrests) state.customCrests = { L1: null, L2: null, L3: null };
    state.customCrests[leagueId] = dataUrl;
    addLog('CREST_UPDATE', `🛡️ Admin ${adminName} zaktualizował oficjalny herb dla ligi ${leagueId}.`);
    syncToBackend();
  }

  function adminCreateOrEnableLeague(opts, adminNameOverride) {
    const sess = assertAdminAuthenticated();
    const actorName = adminNameOverride || (sess && sess.adminName) || 'Szymon Komenda';
    ensureLeaguesStructure(state);

    const cfg = opts || {};
    const suggestion = getNextLeagueSuggestion(state);
    const targetId = String(cfg.id || suggestion.id || 'L3').toUpperCase().trim();
    if (!/^L\d{1,2}$/.test(targetId)) {
      throw new Error('Kod ligi musi mieć format L + numer (np. L3, L4, L5).');
    }

    const basePreset = getDefaultLeaguePreset(targetId);
    const prev = state.leagues[targetId];
    const cleanName = String(cfg.name || (prev && prev.name) || basePreset.name).trim();
    const cleanShort = String(cfg.shortName || (prev && prev.shortName) || basePreset.shortName).trim();
    const cleanSubtitle = String(cfg.subtitle || (prev && prev.subtitle) || basePreset.subtitle).trim();
    const cleanPrimary = /^#[0-9A-Fa-f]{6}$/.test(String(cfg.primaryColor || '').trim())
      ? String(cfg.primaryColor).trim()
      : ((prev && prev.primaryColor) || basePreset.primaryColor);
    const cleanSecondary = /^#[0-9A-Fa-f]{6}$/.test(String(cfg.secondaryColor || '').trim())
      ? String(cfg.secondaryColor).trim()
      : ((prev && prev.secondaryColor) || basePreset.secondaryColor);
    const cleanAdmin = String(cfg.adminName || (prev && prev.adminName) || actorName).trim();

    if (cleanName.length < 3) {
      throw new Error('Nazwa ligi musi mieć co najmniej 3 znaki.');
    }

    const wasAlreadyPresent = Boolean(prev);
    const wasEnabled = Boolean(prev && prev.enabled !== false);

    state.leagues[targetId] = {
      id: targetId,
      enabled: true,
      order: prev && typeof prev.order === 'number' ? prev.order : getLeagueNumber(targetId),
      name: cleanName,
      shortName: cleanShort || targetId,
      subtitle: cleanSubtitle,
      primaryColor: cleanPrimary,
      secondaryColor: cleanSecondary,
      adminName: cleanAdmin,
      totalRounds: Number((prev && prev.totalRounds) || 15)
    };

    if (!state.customCrests || typeof state.customCrests !== 'object' || Array.isArray(state.customCrests)) state.customCrests = {};
    if (typeof state.customCrests[targetId] === 'undefined') {
      state.customCrests[targetId] = null;
    }

    addLog(
      wasAlreadyPresent && !wasEnabled ? 'LEAGUE_ENABLE' : 'LEAGUE_CREATE',
      `🏟️ Admin ${actorName} ${wasAlreadyPresent ? 'aktywował' : 'utworzył'} rozgrywki ${cleanName} (${targetId})!`
    );
    syncToBackend();
    return state.leagues[targetId];
  }

  function adminToggleLeagueEnabled(leagueId, enabled, adminNameOverride) {
    const sess = assertAdminAuthenticated();
    const actorName = adminNameOverride || (sess && sess.adminName) || 'Szymon Komenda';
    ensureLeaguesStructure(state);

    const lid = String(leagueId || '').toUpperCase().trim();
    if (!lid || !state.leagues[lid]) {
      throw new Error('Nie znaleziono wskazanej ligi w systemie SMPL.');
    }

    const nextEnabled = Boolean(enabled);
    if (!nextEnabled && (lid === 'L1' || lid === 'L2')) {
      throw new Error('Ekstraklasa (L1) i 2. Liga (L2) są podstawowymi dywizjami i nie mogą zostać wyłączone.');
    }

    if (!nextEnabled) {
      const leftAtStr = nowFormatted();
      const movedIds = Object.create(null);
      const movedUsers = Object.create(null);
      state.players = (state.players || []).filter((p) => {
        if (!p) return false;
        if (p.isPlaceholder === true && p.leagueId === lid) return false;
        if (p.leagueId === lid) {
          p.leagueId = 'POOL';
          p.active = false;
          p.excelOrder = 0;
          p.leftLeagueAt = leftAtStr;
          if (p.id) movedIds[p.id] = true;
          if (p.username) movedUsers[String(p.username).trim().toLowerCase()] = true;
        }
        return true;
      });
      (state.registrations || []).forEach((r) => {
        if (!r) return;
        const rUser = r.username ? String(r.username).trim().toLowerCase() : '';
        if (
          r.assignedLeague === lid ||
          (r.assignedPlayerId && movedIds[r.assignedPlayerId]) ||
          (rUser && movedUsers[rUser])
        ) {
          r.assignedLeague = 'POOL';
        }
      });
      state.matches = (state.matches || []).filter(
        (m) => !(m && m.leagueId === lid && m.status === 'SCHEDULED')
      );
    }

    state.leagues[lid].enabled = nextEnabled;
    const lgName = state.leagues[lid].name || lid;
    addLog(
      nextEnabled ? 'LEAGUE_ENABLE' : 'LEAGUE_DISABLE',
      `${nextEnabled ? '✅' : '🙈'} Admin ${actorName} ${nextEnabled ? 'włączył' : 'ukrył'} ligę ${lgName} (${lid}).`
    );
    syncToBackend();
    return state.leagues[lid];
  }

  function resetDatabaseToSeed() {
    assertMasterAdminAuthenticated();
    state = ensureMasterExtensions(enrichFromArchive(window.SMPL_SEED.buildInitialDatabase()));
    state.version = TARGET_VERSION;
    seedSeenMessageIds(state);
    syncToBackend({ allowBulkPlayerWipe: true });
    return state;
  }

  
  // =========================================================================
  // MODUŁ CZATU LIGOWEGO ORAZ WIADOMOŚCI PRYWATNYCH (DIRECT MESSAGES - DMs)
  // =========================================================================

  function formatPolishDuration(ms) {
    const totalSec = Math.max(1, Math.ceil(Number(ms || 0) / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (days > 0) return days + (days === 1 ? ' dzień' : ' dni') + (hours > 0 ? ' ' + hours + ' godz.' : '');
    if (hours > 0) return hours + ' godz.' + (mins > 0 ? ' ' + mins + ' min' : '');
    if (mins > 0) return mins + ' min';
    return totalSec + ' sek.';
  }

  function getPlayerChatSanctionStatus(player) {
    if (!player) return { blocked: false, type: 'NONE' };
    if (
      player.isBlacklisted ||
      player.banned ||
      player.customRank === 'BLACKLISTED' ||
      isUserBlacklisted(player.name) ||
      isUserBlacklisted(player.nick)
    ) {
      return {
        blocked: true,
        type: 'BLACKLIST',
        label: 'DOŻYWOTNI BAN (Czarna Lista)',
        reason: 'Wykluczenie z Score Match Ligi na Czarnej Liście.',
        by: 'Zarząd SMPL',
        at: ''
      };
    }
    if (player.chatBanned === true) {
      return {
        blocked: true,
        type: 'CHAT_BAN',
        label: 'PERMANENTNY BAN NA CZAT',
        reason: player.chatMuteReason || 'Złamanie netykiety — stała blokada czatu przez Administrację.',
        by: player.chatMutedBy || 'Zarząd SMPL',
        at: player.chatMutedAt || ''
      };
    }
    const until = Number(player.chatMutedUntil || 0);
    if (until > Date.now()) {
      const remMs = until - Date.now();
      return {
        blocked: true,
        type: 'TIMEOUT',
        until: until,
        remainingMs: remMs,
        remainingText: formatPolishDuration(remMs),
        label: 'TIME-OUT NA CZACIE (pozostało: ' + formatPolishDuration(remMs) + ')',
        reason: player.chatMuteReason || 'Chwilowe wyciszenie na czacie decyzją Administracji.',
        by: player.chatMutedBy || 'Zarząd SMPL',
        at: player.chatMutedAt || ''
      };
    }
    if (until > 0 && until <= Date.now()) {
      player.chatMutedUntil = 0;
    }
    return { blocked: false, type: 'NONE' };
  }

  function canUserAccessChatChannel(channel, sess, targetState) {
    const st = targetState || state || {};
    const s = sess || getSession();
    const isAdmin = isStrictAdminSession(s);
    const ch = String(channel || 'L2');
    if (ch === 'ADMIN_STAFF') return isAdmin;
    if (ch === 'OFFTOPIC' || ch === 'ANNOUNCEMENTS' || ch === 'DM') return true;
    if (isLeagueChannelId(ch, st)) {
      if (isAdmin) return true;
      if (s && s.isPlayerAuthenticated && s.activePlayerId) {
        const p = (st.players || []).find((x) => x.id === s.activePlayerId);
        return Boolean(p && p.leagueId === ch);
      }
      return false;
    }
    return false;
  }

  function getVisibleChatChannelsForSession(sess, targetState) {
    const st = targetState || state || {};
    const s = sess || getSession();
    const isAdmin = isStrictAdminSession(s);
    const player = !isAdmin && s && s.isPlayerAuthenticated && s.activePlayerId
      ? (st.players || []).find((x) => x.id === s.activePlayerId)
      : null;
    const base = ['OFFTOPIC'];
    if (isAdmin) {
      getActiveLeagueIds(st).forEach((lid) => {
        if (base.indexOf(lid) === -1) base.push(lid);
      });
      base.push('ANNOUNCEMENTS', 'ADMIN_STAFF', 'DM');
    } else if (player) {
      const lg = player.leagueId || 'L2';
      if (base.indexOf(lg) === -1) base.push(lg);
      base.push('ANNOUNCEMENTS', 'DM');
    } else {
      base.push('ANNOUNCEMENTS', 'DM');
    }
    return base;
  }

  function setPlayerChatSanction(playerId, opts, adminNameOverride) {
    const sess = assertAdminAuthenticated();
    const targetPlayer = (state.players || []).find((p) => p.id === playerId);
    if (!targetPlayer) throw new Error('Nie znaleziono zawodnika w bazie ligi.');

    const mode = String((opts && opts.mode) || 'TIMEOUT').toUpperCase();
    const durationMinutes = Number((opts && opts.durationMinutes) || 0);
    const cleanReason = String((opts && opts.reason) || '').trim();
    const resolvedAdmin = adminNameOverride || sess.adminName || 'Szymon Komenda';
    const stamp = nowFormatted();

    if ((mode === 'TIMEOUT' || mode === 'BAN') && cleanReason.length < 3) {
      throw new Error('Podaj dokładny powód Time-Outu / Bana na czat (minimum 3 znaki — każdy Admin go zobaczy!).');
    }
    if (mode === 'TIMEOUT' && (!Number.isFinite(durationMinutes) || durationMinutes < 1)) {
      throw new Error('Wybierz lub wpisz poprawny czas trwania Time-Outu (min. 1 minuta).');
    }

    if (!Array.isArray(targetPlayer.notifications)) targetPlayer.notifications = [];
    if (!Array.isArray(state.disciplinaryLog)) state.disciplinaryLog = [];

    let logActionType = 'CHAT_TIMEOUT';
    let badgeText = '';
    let notifText = '';

    if (mode === 'BAN') {
      targetPlayer.chatBanned = true;
      targetPlayer.chatMutedUntil = 0;
      targetPlayer.chatMuteReason = cleanReason;
      targetPlayer.chatMutedBy = resolvedAdmin;
      targetPlayer.chatMutedAt = stamp;
      logActionType = 'CHAT_BAN';
      badgeText = '🚫 BAN NA CZAT (Stały)';
      notifText = `🚫 Admin ${resolvedAdmin} nałożył na Ciebie STAŁY BAN NA CZAT (publiczny i priv). Powód: ${cleanReason}`;
      addLog('CHAT_BAN', `🚫 Admin ${resolvedAdmin} zbanował na czacie gracza ${targetPlayer.name}. Powód: ${cleanReason}`);
    } else if (mode === 'TIMEOUT') {
      const untilTs = Date.now() + durationMinutes * 60000;
      const durText = formatPolishDuration(durationMinutes * 60000);
      targetPlayer.chatBanned = false;
      targetPlayer.chatMutedUntil = untilTs;
      targetPlayer.chatMuteReason = cleanReason;
      targetPlayer.chatMutedBy = resolvedAdmin;
      targetPlayer.chatMutedAt = stamp;
      logActionType = 'CHAT_TIMEOUT';
      badgeText = `⏳ TIME-OUT (${durText})`;
      notifText = `⏳ Admin ${resolvedAdmin} nałożył na Ciebie TIME-OUT na czacie (${durText}). Powód: ${cleanReason}`;
      addLog('CHAT_TIMEOUT', `⏳ Admin ${resolvedAdmin} wyciszył na czacie gracza ${targetPlayer.name} (${durText}). Powód: ${cleanReason}`);
    } else {
      const liftReason = cleanReason || 'Zdjęcie blokady czatu decyzją Administracji';
      targetPlayer.chatBanned = false;
      targetPlayer.chatMutedUntil = 0;
      targetPlayer.chatMuteReason = '';
      targetPlayer.chatMutedBy = '';
      targetPlayer.chatMutedAt = '';
      logActionType = 'CHAT_UNMUTE';
      badgeText = '🔓 ODCISZONY';
      notifText = `🔓 Admin ${resolvedAdmin} zdjął blokadę czatu z Twojego konta. Uwaga: ${liftReason}`;
      addLog('CHAT_UNMUTE', `🔓 Admin ${resolvedAdmin} odciszył na czacie gracza ${targetPlayer.name}.`);
    }

    targetPlayer.notifications.unshift({
      id: 'NOTIF_CHATMOD_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      time: stamp,
      text: notifText
    });

    state.disciplinaryLog.unshift({
      id: 'DISC_CHAT_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      playerNick: targetPlayer.nick,
      leagueId: targetPlayer.leagueId,
      actionType: logActionType,
      badgeLabel: badgeText,
      durationMinutes: mode === 'TIMEOUT' ? durationMinutes : 0,
      penaltyPoints: 0,
      delta: 0,
      reason: mode === 'UNMUTE' ? (cleanReason || 'Zdjęcie blokady czatu') : cleanReason,
      date: stamp,
      adminName: resolvedAdmin
    });

    syncToBackend();
    return {
      ok: true,
      mode: mode,
      player: targetPlayer,
      sanction: getPlayerChatSanctionStatus(targetPlayer)
    };
  }

  function sendChatMessage({ channel, text, senderId, senderName, senderAvatar, leagueId, isAdmin, mentions }) {
    if (!state.chatMessages) state.chatMessages = [];
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Wiadomość nie może być pusta.');

    const sess = getSession();
    const strictAdmin = isStrictAdminSession(sess);
    const effectiveIsAdmin = Boolean((isAdmin !== undefined ? isAdmin : strictAdmin) && strictAdmin);
    const targetChan = String(channel || 'L2');

    if (targetChan === 'ADMIN_STAFF' && !effectiveIsAdmin) {
      throw new Error('🔒 Pokój Administracji jest ukryty i dostępny wyłącznie dla Zarządu SMPL.');
    }
    if (targetChan === 'ANNOUNCEMENTS' && !effectiveIsAdmin) {
      throw new Error('Tylko Administrator może publikować ogłoszenia na tablicy zarządu.');
    }

    const authorId = effectiveIsAdmin ? (senderId || sess.adminId || 'ADM_MASTER') : (sess ? sess.activePlayerId : null);
    const authorObj = (state.players || []).find((p) => p.id === authorId);
    const authorName = effectiveIsAdmin
      ? (senderName || sess.adminName || 'Szymon Komenda')
      : (authorObj ? authorObj.name : 'Zawodnik Ligi');

    if (!effectiveIsAdmin) {
      if (!authorId || sess.isGuest) {
        throw new Error('Zaloguj się na konto zawodnika, aby pisać na czacie.');
      }
      if (isLeagueChannelId(targetChan, state) && (!authorObj || authorObj.leagueId !== targetChan)) {
        const myLg = authorObj && authorObj.leagueId ? authorObj.leagueId : 'twojej ligi';
        throw new Error(`🔒 Dostęp zablokowany: Możesz pisać tylko w pokoju swojej dywizji (${myLg}) oraz na Czacie Ogólnym!`);
      }
      const sanction = getPlayerChatSanctionStatus(authorObj);
      if (!sanction.blocked && (isUserBlacklisted(authorName) || (authorObj && isUserBlacklisted(authorObj.nick)))) {
        throw new Error('⛔ DOŻYWOTNI BAN: Jesteś na Czarnej Liście Score Match Ligi — nie masz prawa pisać na czacie!');
      }
      if (sanction.blocked) {
        if (sanction.type === 'BLACKLIST') {
          throw new Error('⛔ DOŻYWOTNI BAN: Jesteś na Czarnej Liście Score Match Ligi — nie masz prawa pisać na czacie!');
        }
        if (sanction.type === 'CHAT_BAN') {
          throw new Error(`🚫 BAN NA CZAT: Masz stałą blokadę pisania na czacie. Powód: ${sanction.reason}`);
        }
        throw new Error(`⏳ TIME-OUT NA CZACIE (pozostało: ${sanction.remainingText}): Powód: ${sanction.reason}`);
      }
    }
    const authorAvatar = senderAvatar || (effectiveIsAdmin ? (state.customCrests && state.customCrests.L2 ? state.customCrests.L2 : window.SMPL_MEDIA.DEFAULT_CRESTS.L2) : window.SMPL_MEDIA.generatePlayerAvatar(authorName, '', 90));

    // Automatyczne wykrywanie agresji i wulgaryzmów (Moderacja AI / Netykieta)
    const tox = detectToxicity(cleanText);

    const detectedMentions = Array.isArray(mentions) && mentions.length > 0
      ? mentions
      : (window.SMPL_RANKS ? window.SMPL_RANKS.extractMentions(cleanText, state) : []);

    const msg = {
      id: 'MSG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      channel: channel || 'L2',
      senderId: authorId,
      senderName: authorName,
      senderAvatar: slimMessageAvatar(authorAvatar),
      leagueId: leagueId || (effectiveIsAdmin ? 'ALL' : 'L2'),
      isAdmin: effectiveIsAdmin,
      text: cleanText,
      createdAt: nowFormatted(),
      timestamp: Date.now(),
      isFlagged: tox.isToxic,
      flagReason: tox.isToxic ? tox.reason : null,
      status: tox.isToxic ? 'FLAGGED' : 'APPROVED',
      mentions: detectedMentions
    };

    if (detectedMentions.length > 0 && !tox.isToxic) {
      detectedMentions.forEach((pId) => {
        const targetP = (state.players || []).find((p) => p.id === pId);
        if (targetP && targetP.id !== authorId) {
          if (!targetP.notifications) targetP.notifications = [];
          targetP.notifications.unshift({
            id: 'NOTIF_MENTION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            title: `📣 ${authorName} oznaczył Cię na kanale [${msg.channel}]!`,
            text: cleanText.length > 80 ? cleanText.substring(0, 77) + '...' : cleanText,
            createdAt: nowFormatted(),
            read: false
          });
        }
      });
    }

    if (tox.isToxic) {
      if (!state.moderationIncidents) state.moderationIncidents = [];
      const curP = (state.players || []).find((p) => p.id === authorId);
      const incident = {
        id: 'INC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        messageId: msg.id,
        channel: msg.channel,
        senderId: authorId,
        senderName: authorName,
        senderNick: curP ? curP.nick : 'brak',
        senderAvatar: authorAvatar,
        leagueId: msg.leagueId,
        text: cleanText,
        flagReason: tox.reason,
        detectedAt: nowFormatted(),
        timestamp: Date.now(),
        status: 'PENDING',
        verdict: null
      };
      state.moderationIncidents.unshift(incident);

      if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.sendLocalNotification === 'function') {
        window.SMPL_NOTIF.sendLocalNotification('🚨 Alert Moderacji Czatu', {
          body: `Wykryto agresję/wulgaryzmy od ${authorName} na kanale [${msg.channel}]. Wiadomość skierowana do Trybunału!`,
          tag: `incident-${incident.id}`
        });
      }
    } else {
      if (msg && msg.id) seenRemoteMessageIds[msg.id] = true;
      if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playChatChime === 'function') {
        window.SMPL_NOTIF.playChatChime();
      }
    }

    if (msg && msg.id) seenRemoteMessageIds[msg.id] = true;
    state.chatMessages.push(msg);
    if (state.chatMessages.length > 300) {
      state.chatMessages = state.chatMessages.slice(-300);
    }
    syncToBackend();
    return msg;
  }

  function sendDirectMessage({ recipientId, text, senderId, senderName, senderAvatar }) {
    if (!state.directMessages) state.directMessages = [];
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Wiadomość prywatna nie może być pusta.');
    if (!recipientId) throw new Error('Nie wskazano odbiorcy wiadomości.');

    const sess = getSession();
    const effectiveIsAdmin = isStrictAdminSession(sess);
    const authorId = effectiveIsAdmin ? (senderId || sess.adminId || 'ADM_MASTER') : (sess ? sess.activePlayerId : null);
    const authorObj = (state.players || []).find((p) => p.id === authorId);
    const authorName = effectiveIsAdmin
      ? (senderName || sess.adminName || 'Szymon Komenda')
      : (authorObj ? authorObj.name : 'Zawodnik Ligi');
    if (!effectiveIsAdmin) {
      if (!authorId || sess.isGuest) {
        throw new Error('Zaloguj się na konto zawodnika, aby wysyłać wiadomości prywatne.');
      }
      const sanction = getPlayerChatSanctionStatus(authorObj);
      if (!sanction.blocked && (isUserBlacklisted(authorName) || (authorObj && isUserBlacklisted(authorObj.nick)))) {
        throw new Error('⛔ DOŻYWOTNI BAN: Jesteś na Czarnej Liście Score Match Ligi — nie masz prawa wysyłać wiadomości prywatnych!');
      }
      if (sanction.blocked) {
        if (sanction.type === 'BLACKLIST') {
          throw new Error('⛔ DOŻYWOTNI BAN: Jesteś na Czarnej Liście Score Match Ligi — nie masz prawa wysyłać wiadomości prywatnych!');
        }
        if (sanction.type === 'CHAT_BAN') {
          throw new Error(`🚫 BAN NA CZAT: Masz stałą blokadę wiadomości prywatnych i czatu. Powód: ${sanction.reason}`);
        }
        throw new Error(`⏳ TIME-OUT NA CZACIE (pozostało: ${sanction.remainingText}): Powód: ${sanction.reason}`);
      }
    }
    const authorAvatar = senderAvatar || (effectiveIsAdmin ? (state.customCrests && state.customCrests.L2 ? state.customCrests.L2 : window.SMPL_MEDIA.DEFAULT_CRESTS.L2) : window.SMPL_MEDIA.generatePlayerAvatar(authorName, '', 90));

    const recPlayer = (state.players || []).find((p) => p.id === recipientId);
    const recAdmin = (state.admins || []).find((a) => a.id === recipientId || a.username === recipientId);
    const recipientName = recPlayer ? recPlayer.name : recAdmin ? recAdmin.name : 'Odbiorca Ligi';
    const recipientAvatar = recPlayer ? recPlayer.avatar : recAdmin ? (recAdmin.avatar || window.SMPL_MEDIA.DEFAULT_CRESTS.L2) : '';

    const dm = {
      id: 'DM_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      senderId: authorId,
      senderName: authorName,
      senderAvatar: slimMessageAvatar(authorAvatar),
      recipientId: recipientId,
      recipientName: recipientName,
      recipientAvatar: slimMessageAvatar(recipientAvatar),
      text: cleanText,
      createdAt: nowFormatted(),
      timestamp: Date.now(),
      read: false
    };

    seenRemoteMessageIds[dm.id] = true;
    state.directMessages.push(dm);
    if (state.directMessages.length > 500) {
      state.directMessages = state.directMessages.slice(-500);
    }
    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.playChatChime === 'function') { window.SMPL_NOTIF.playChatChime(); }
    syncToBackend();
    return dm;
  }

  function deleteChatMessage(messageId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    if (!state.chatMessages) return false;
    const beforeLen = state.chatMessages.length;
    state.chatMessages = state.chatMessages.filter((m) => m.id !== messageId);
    if (state.chatMessages.length !== beforeLen) {
      addLog('CHAT_DELETE', `🗑️ Admin ${adminName} usunął wiadomość z czatu.`);
      syncToBackend();
      return true;
    }
    return false;
  }

  function deleteDirectMessage(dmId) {
    const sess = getSession();
    if (!state.directMessages) return false;
    const dm = state.directMessages.find((m) => m.id === dmId);
    if (!dm) return false;
    const isAdmin = isStrictAdminSession(sess);
    const isOwner = (sess && sess.isPlayerAuthenticated && dm.senderId === sess.activePlayerId) || (isAdmin && dm.senderId === sess.adminId);
    if (!isOwner && !isAdmin) {
      throw new Error('Możesz usuwać tylko własne wiadomości.');
    }
    state.directMessages = state.directMessages.filter((m) => m.id !== dmId);
    syncToBackend();
    return true;
  }

  function markDirectMessagesAsRead(currentUserId, partnerId) {
    if (!state.directMessages || !currentUserId || !partnerId) return;
    let modified = false;
    state.directMessages.forEach((m) => {
      if (m.recipientId === currentUserId && m.senderId === partnerId && !m.read) {
        m.read = true;
        modified = true;
      }
    });
    if (modified) {
      syncToBackend();
    }
  }

  function getUnreadDirectMessagesCount(userId) {
    if (!state || !state.directMessages || !userId) return 0;
    return state.directMessages.filter((m) => m.recipientId === userId && !m.read).length;
  }

  function getDirectMessagesBetween(userAId, userBId) {
    if (!state || !state.directMessages || !userAId || !userBId) return [];
    return state.directMessages
      .filter((m) => (m.senderId === userAId && m.recipientId === userBId) || (m.senderId === userBId && m.recipientId === userAId))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }

  function getDirectConversationsForUser(userId) {
    if (!state || !state.directMessages || !userId) return [];
    const conversationsMap = {};

    state.directMessages.forEach((m) => {
      let partnerId = null;
      let partnerName = '';
      let partnerAvatar = '';
      if (m.senderId === userId) {
        partnerId = m.recipientId;
        partnerName = m.recipientName;
        partnerAvatar = m.recipientAvatar;
      } else if (m.recipientId === userId) {
        partnerId = m.senderId;
        partnerName = m.senderName;
        partnerAvatar = m.senderAvatar;
      }
      if (!partnerId) return;

      if (!conversationsMap[partnerId]) {
        const p = (state.players || []).find((x) => x.id === partnerId);
        const a = (state.admins || []).find((x) => x.id === partnerId);
        conversationsMap[partnerId] = {
          partnerId: partnerId,
          partnerName: p ? p.name : (a ? a.name : partnerName),
          partnerNick: p ? p.nick : (a ? (a.username || 'Admin') : ''),
          partnerAvatar: p ? p.avatar : (a ? (a.avatar || window.SMPL_MEDIA.DEFAULT_CRESTS.L2) : partnerAvatar),
          partnerLeague: p ? p.leagueId : (a ? 'ADMIN' : 'SMPL'),
          lastMessage: m.text,
          lastMessageTime: m.createdAt,
          lastMessageTimestamp: m.timestamp || 0,
          unreadCount: 0
        };
      }
      if ((m.timestamp || 0) > conversationsMap[partnerId].lastMessageTimestamp) {
        conversationsMap[partnerId].lastMessage = m.text;
        conversationsMap[partnerId].lastMessageTime = m.createdAt;
        conversationsMap[partnerId].lastMessageTimestamp = m.timestamp || 0;
      }
      if (m.recipientId === userId && !m.read) {
        conversationsMap[partnerId].unreadCount++;
      }
    });

    return Object.values(conversationsMap).sort((a, b) => b.lastMessageTimestamp - a.lastMessageTimestamp);
  }

  // =========================================================================
  // OFICJALNA CZARNA LISTA SCORE MATCH LIGI (DOŻYWOTNI BAN)
  // =========================================================================

  function assertAdminAuthenticated() {
    const sess = getSession();
    if (!isStrictAdminSession(sess)) {
      throw new Error('Odmowa dostępu: Wymagane zalogowanie jako Administrator w Panelu Admina!');
    }
    return sess;
  }

  function normalizeBlacklistKey(val) {
    return String(val || '').trim().toLowerCase();
  }

  function findPlayerForBlacklistEntry(nameKey, nickKey) {
    return (state.players || []).find((p) => {
      const pName = normalizeBlacklistKey(p.name);
      const pNick = normalizeBlacklistKey(p.nick);
      const pUser = normalizeBlacklistKey(p.username);
      return (nameKey && (pName === nameKey || pNick === nameKey || pUser === nameKey)) ||
             (nickKey && (pNick === nickKey || pName === nickKey || pUser === nickKey));
    });
  }

  function getBlacklist() {
    if (!state) return [];
    if (!Array.isArray(state.blacklist)) state.blacklist = [];
    return state.blacklist;
  }

  function isUserBlacklisted(nameOrNickOrId) {
    const key = normalizeBlacklistKey(nameOrNickOrId);
    if (!key || !state) return false;
    const inList = (state.blacklist || []).some((b) =>
      normalizeBlacklistKey(b.id) === key ||
      normalizeBlacklistKey(b.name) === key ||
      normalizeBlacklistKey(b.nick) === key
    );
    if (inList) return true;
    return (state.players || []).some((p) => {
      const match = normalizeBlacklistKey(p.id) === key ||
                    normalizeBlacklistKey(p.name) === key ||
                    normalizeBlacklistKey(p.nick) === key ||
                    normalizeBlacklistKey(p.username) === key;
      return match && !!(p.isBlacklisted || p.banned || p.customRank === 'BLACKLISTED');
    });
  }

  function addToBlacklist({ name, nick, fbProfile, reason, bannedBy, avatar }) {
    assertAdminAuthenticated();
    if (!Array.isArray(state.blacklist)) state.blacklist = [];

    const cleanName = String(name || '').trim();
    const cleanNick = String(nick || '').trim();
    const cleanReason = String(reason || '').trim();
    if (!cleanName && !cleanNick) {
      throw new Error('Podaj imię i nazwisko lub nick gracza do wpisania na Czarną Listę.');
    }
    if (!cleanReason) {
      throw new Error('Podaj uzasadnienie nadania dożywotniego bana.');
    }

    const nameKey = normalizeBlacklistKey(cleanName);
    const nickKey = normalizeBlacklistKey(cleanNick);
    const duplicate = state.blacklist.find((b) =>
      (nameKey && normalizeBlacklistKey(b.name) === nameKey) ||
      (nickKey && normalizeBlacklistKey(b.nick) === nickKey)
    );
    if (duplicate) {
      throw new Error(`Gracz ${duplicate.name || duplicate.nick} znajduje się już na Oficjalnej Czarnej Liście.`);
    }

    const matchedPlayer = findPlayerForBlacklistEntry(nameKey, nickKey);
    const judgeName = bannedBy || getSession().adminName || 'Szymon Komenda (Master Admin)';
    const entryAvatar =
      avatar ||
      (matchedPlayer && matchedPlayer.avatar) ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    const entry = {
      id: 'BL_' + Date.now(),
      name: cleanName || (matchedPlayer ? matchedPlayer.name : cleanNick),
      nick: cleanNick || (matchedPlayer ? matchedPlayer.nick : ''),
      fbProfile: String(fbProfile || (matchedPlayer && (matchedPlayer.fbLink || matchedPlayer.fb)) || '').trim(),
      avatar: entryAvatar,
      bannedAt: nowFormatted(),
      bannedBy: judgeName,
      reason: cleanReason,
      scope: 'DOŻYWOTNI ZAKAZ WSTĘPU DO WSZYSTKICH SEZONÓW I ROZGRYWEK SCORE MATCH LIGA',
      status: 'PERMANENT_BAN'
    };

    if (matchedPlayer) {
      matchedPlayer.isBlacklisted = true;
      matchedPlayer.banned = true;
      matchedPlayer.active = false;
      matchedPlayer.customRank = 'BLACKLISTED';
      matchedPlayer.customTitle = 'DOŻYWOTNI BAN';
      matchedPlayer.blacklistReason = cleanReason;
    }

    state.blacklist.unshift(entry);
    addLog('BLACKLIST_ADD', `💀 ${judgeName} wpisał ${entry.name}${entry.nick ? ' (@' + entry.nick + ')' : ''} na Czarną Listę (DOŻYWOTNI BAN). Powód: ${cleanReason}`);
    syncToBackend();
    return entry;
  }

  function removeFromBlacklist(blacklistId, adminName) {
    assertAdminAuthenticated();
    if (!Array.isArray(state.blacklist)) state.blacklist = [];
    const idx = state.blacklist.findIndex((b) => b.id === blacklistId);
    if (idx === -1) {
      throw new Error('Nie znaleziono wskazanego wpisu na Czarnej Liście.');
    }

    const removed = state.blacklist[idx];
    state.blacklist.splice(idx, 1);

    const matchedPlayer = findPlayerForBlacklistEntry(
      normalizeBlacklistKey(removed.name),
      normalizeBlacklistKey(removed.nick)
    );
    if (matchedPlayer) {
      matchedPlayer.isBlacklisted = false;
      matchedPlayer.banned = false;
      matchedPlayer.active = true;
      if (matchedPlayer.customRank === 'BLACKLISTED') matchedPlayer.customRank = null;
      if (matchedPlayer.customTitle === 'DOŻYWOTNI BAN') matchedPlayer.customTitle = null;
      delete matchedPlayer.blacklistReason;
    }

    const judgeName = adminName || getSession().adminName || 'Szymon Komenda';
    addLog('BLACKLIST_REMOVE', `🔓 ${judgeName} zdjął dożywotni ban z gracza ${removed.name}${removed.nick ? ' (@' + removed.nick + ')' : ''}.`);
    syncToBackend();
    return true;
  }
  // =========================================================================
  // TRYBUNAŁ DYSCYPLINARNY, MODERACJA AGRESJI I PUSZCZANIE KOLEJEK
  // =========================================================================

  function detectToxicity(text) {
    if (!text) return { isToxic: false };
    const raw = String(text).toLowerCase();
    const normalized = raw
      .replace(/[\*\.\-_\+\#\!]/g, '')
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/@/g, 'a')
      .replace(/\$/g, 's')
      .replace(/v/g, 'u');

    const toxicRegex = /\b(kurw|chuj|huj|cwel|jeb|pierdol|szmat|pedał|pedal|dziwk|suka|kutas|spierdal|ciot|frajer|debil|idiot|zajeb|wpierdol|rozjeb|zdechnij|śmieciu|smieciu|zjeb|rucham|chujem|pizd|matkojeb)\w*/i;

    if (toxicRegex.test(raw) || toxicRegex.test(normalized)) {
      return {
        isToxic: true,
        reason: 'Wykryto słowa niedozwolone / agresję / wulgaryzmy'
      };
    }
    return { isToxic: false };
  }

  function applyDisciplinaryAction({
    playerId,
    incidentId,
    penaltyPoints,
    yellowCards,
    redCards,
    isSuspended,
    suspensionReason,
    penaltyReason,
    adminName
  }) {
    assertAdminAuthenticated();
    const targetPlayer = state.players.find((p) => p.id === playerId);
    if (!targetPlayer) throw new Error('Nie znaleziono wskazanego zawodnika.');

    const rawPts = Number(penaltyPoints || 0);
    if (isNaN(rawPts) || rawPts < 0) {
      throw new Error('Podaj poprawną liczbę punktów do odjęcia.');
    }
    const pts = Math.floor(rawPts);
    const yc = Math.max(0, Number(yellowCards || 0));
    const rc = Math.max(0, Number(redCards || 0));
    const rawReason = String(penaltyReason || '').trim();
    if (pts > 0 && rawReason.length < 3) {
      throw new Error('⚠️ Musisz obowiązkowo podać powód odjęcia punktów (min. 3 znaki) — każdy Admin zobaczy ten wpis!');
    }
    const reasonText = rawReason || 'Decyzja dyscyplinarna Admina SMPL';
    const sess = getSession();
    const judgeName = String(adminName || (sess && sess.adminName) || 'Zarząd Ligi SMPL').trim();
    const oldPenalty = Number(targetPlayer.penaltyPoints) || 0;
    const stamp = nowFormatted();

    targetPlayer.penaltyPoints = oldPenalty + pts;
    targetPlayer.yellowCards = (Number(targetPlayer.yellowCards) || 0) + yc;
    targetPlayer.redCards = (Number(targetPlayer.redCards) || 0) + rc;
    if (pts > 0 || rawReason) {
      targetPlayer.penaltyReason = reasonText;
      targetPlayer.penaltyBy = judgeName;
      targetPlayer.penaltyAt = stamp;
    }

    if (isSuspended) {
      targetPlayer.isSuspended = true;
      targetPlayer.suspensionReason = String(suspensionReason || reasonText).trim();
    }

    if (!targetPlayer.disciplinaryHistory) targetPlayer.disciplinaryHistory = [];
    const penaltyEntry = {
      id: 'DISC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      date: stamp,
      actionType: pts > 0 ? 'PENALTY_DEDUCT' : 'DISCIPLINARY_CARD',
      penaltyPoints: pts,
      previousPenalty: oldPenalty,
      newPenalty: targetPlayer.penaltyPoints,
      delta: pts,
      yellowCards: yc,
      redCards: rc,
      isSuspended: !!isSuspended,
      reason: reasonText,
      adminName: judgeName
    };
    targetPlayer.disciplinaryHistory.unshift(penaltyEntry);

    if (!state.disciplinaryLog) state.disciplinaryLog = [];
    if (!state.blacklist) state.blacklist = [];
    state.disciplinaryLog.unshift({
      id: penaltyEntry.id,
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      playerNick: targetPlayer.nick,
      leagueId: targetPlayer.leagueId,
      actionType: penaltyEntry.actionType,
      penaltyPoints: pts,
      previousPenalty: oldPenalty,
      newPenalty: targetPlayer.penaltyPoints,
      delta: pts,
      yellowCards: yc,
      redCards: rc,
      isSuspended: !!isSuspended,
      reason: reasonText,
      date: stamp,
      adminName: judgeName
    });

    if (incidentId) {
      if (!state.moderationIncidents) state.moderationIncidents = [];
      const inc = state.moderationIncidents.find((i) => i.id === incidentId);
      if (inc) {
        inc.status = 'RESOLVED_PENALIZED';
        inc.resolvedAt = stamp;
        inc.resolvedBy = judgeName;
        inc.verdict = `Nałożono: -${pts} pkt, 🟨 ${yc}, 🟥 ${rc}${isSuspended ? ', ZAWIESZENIE' : ''}. Powód: ${reasonText}`;
      }
    }

    const summary = [];
    if (pts > 0) summary.push(`-${pts} PKT w tabeli (łącznie -${targetPlayer.penaltyPoints} pkt)`);
    if (yc > 0) summary.push(`🟨 ${yc} żółta kartka`);
    if (rc > 0) summary.push(`🟥 ${rc} czerwona kartka`);
    if (isSuspended) summary.push(`⛔ ZAWIESZENIE`);

    if (!Array.isArray(targetPlayer.notifications)) targetPlayer.notifications = [];
    targetPlayer.notifications.unshift({
      id: 'NOTIF_DISC_' + Date.now(),
      time: stamp,
      text: `⚖️ Admin ${judgeName} zastosował karę: ${summary.join(', ') || 'Decyzja dyscyplinarna'}. Powód: ${reasonText}`
    });

    addLog(
      'PENALTY',
      `⚖️ Admin ${judgeName} nałożył karę na ${targetPlayer.name}: ${summary.join(', ') || 'Upomnienie'}. Powód: ${reasonText}`
    );

    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.notifyTribunalVerdict === 'function') {
      window.SMPL_NOTIF.notifyTribunalVerdict(targetPlayer.name, summary.join(', '));
    }

    syncToBackend();
    return { ok: true, penaltyEntry, player: targetPlayer };
  }

  function deductPlayerPoints(playerId, pointsToDeduct, reason, adminName) {
    assertAdminAuthenticated();
    const pts = Math.floor(Number(pointsToDeduct));
    if (isNaN(pts) || pts < 1) {
      throw new Error('Wpisz poprawną liczbę punktów do odjęcia (minimum 1 pkt, bez górnego limitu).');
    }
    const cleanReason = String(reason || '').trim();
    if (cleanReason.length < 3) {
      throw new Error('⚠️ Musisz obowiązkowo podać powód odjęcia punktów (min. 3 znaki) — każdy Admin zobaczy ten wpis!');
    }
    return applyDisciplinaryAction({
      playerId: playerId,
      penaltyPoints: pts,
      yellowCards: 0,
      redCards: 0,
      isSuspended: false,
      penaltyReason: cleanReason,
      adminName: adminName
    });
  }

  function dismissModerationIncident(incidentId, adminName) {
    assertAdminAuthenticated();
    if (!state.moderationIncidents) state.moderationIncidents = [];
    const inc = state.moderationIncidents.find((i) => i.id === incidentId);
    if (!inc) throw new Error('Nie znaleziono wskazanego incydentu.');

    const judgeName = adminName || getSession().adminName || 'Zarząd Ligi SMPL';
    inc.status = 'RESOLVED_DISMISSED';
    inc.resolvedAt = nowFormatted();
    inc.resolvedBy = judgeName;
    inc.verdict = 'Uznano za zgodne z netykietą (uniewinnienie)';

    if (inc.messageId && state.chatMessages) {
      const msg = state.chatMessages.find((m) => m.id === inc.messageId);
      if (msg) {
        msg.isFlagged = false;
        msg.status = 'APPROVED';
      }
    }

    syncToBackend();
    return { ok: true };
  }

  function deleteFlaggedMessageAndIncident(incidentId, messageId, adminName) {
    assertAdminAuthenticated();
    const judgeName = adminName || getSession().adminName || 'Zarząd Ligi SMPL';

    if (messageId && state.chatMessages) {
      state.chatMessages = state.chatMessages.filter((m) => m.id !== messageId);
    }

    if (incidentId && state.moderationIncidents) {
      const inc = state.moderationIncidents.find((i) => i.id === incidentId);
      if (inc) {
        inc.status = 'RESOLVED_DELETED';
        inc.resolvedAt = nowFormatted();
        inc.resolvedBy = judgeName;
        inc.verdict = 'Wiadomość usunięta na stałe z czatu';
      }
    }

    syncToBackend();
    return { ok: true };
  }

  function pardonPlayerDiscipline(playerId, adminName, reason = '') {
    assertAdminAuthenticated();
    const targetPlayer = state.players.find((p) => p.id === playerId);
    if (!targetPlayer) throw new Error('Nie znaleziono zawodnika.');

    const sess = getSession();
    const judgeName = String(adminName || (sess && sess.adminName) || 'Zarząd Ligi SMPL').trim();
    const oldPenalty = Number(targetPlayer.penaltyPoints) || 0;
    const cleanReason = String(reason || '').trim() || 'Zniesienie kar i ułaskawienie przez Admina';
    const stamp = nowFormatted();

    targetPlayer.penaltyPoints = 0;
    targetPlayer.penaltyReason = '';
    targetPlayer.penaltyBy = '';
    targetPlayer.penaltyAt = '';
    targetPlayer.yellowCards = 0;
    targetPlayer.redCards = 0;
    targetPlayer.isSuspended = false;
    targetPlayer.suspensionReason = '';
    targetPlayer.chatBanned = false;
    targetPlayer.chatMutedUntil = 0;
    targetPlayer.chatMuteReason = '';
    targetPlayer.chatMutedBy = '';
    targetPlayer.chatMutedAt = '';

    if (oldPenalty > 0) {
      if (!Array.isArray(state.disciplinaryLog)) state.disciplinaryLog = [];
      state.disciplinaryLog.unshift({
        id: 'DISC_PARDON_' + Date.now(),
        playerId: targetPlayer.id,
        playerName: targetPlayer.name,
        playerNick: targetPlayer.nick,
        leagueId: targetPlayer.leagueId,
        actionType: 'PARDON',
        penaltyPoints: 0,
        previousPenalty: oldPenalty,
        newPenalty: 0,
        delta: -oldPenalty,
        yellowCards: 0,
        redCards: 0,
        isSuspended: false,
        reason: cleanReason,
        date: stamp,
        adminName: judgeName
      });
      addLog('PENALTY', `🕊️ Admin ${judgeName} zniósł karę punktową (-${oldPenalty} pkt) dla ${targetPlayer.name}. Powód: ${cleanReason}`);
    }

    syncToBackend();
    return { ok: true };
  }

  function broadcastRoundRelease(roundNumber, weekNumber, adminName) {
    assertAdminAuthenticated();
    const r = Number(roundNumber || 1);
    const w = Number(weekNumber || Math.ceil(r / 4));
    const judgeName = adminName || getSession().adminName || 'Szymon Komenda';

    if (state.currentLeagueWeek !== undefined) {
      state.currentLeagueWeek = w;
    }

    (state.players || []).forEach((p) => {
      if (p.active !== false) {
        if (!p.notifications) p.notifications = [];
        p.notifications.unshift({
          id: 'NOTIF_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          title: `⚽ Kolejka #${r} wystartowała! (Tydzień #${w})`,
          text: 'Administratorzy puszczają kolejkę. Zaloguj się i rozegraj swoje spotkanie ligowe!',
          createdAt: nowFormatted(),
          read: false
        });
      }
    });

    if (window.SMPL_NOTIF && typeof window.SMPL_NOTIF.notifyRoundReleased === 'function') {
      window.SMPL_NOTIF.notifyRoundReleased(r, w);
    }

    syncToBackend();
    return { ok: true, round: r, week: w };
  }

  // =========================================================================
  // ASYSTENTKA AI VANESSA — SAMOUCZĄCA SIĘ BAZA WIEDZY I KOLEJKA PYTAŃ
  // =========================================================================
  function ensureAiContainers() {
    if (!Array.isArray(state.aiKnowledge)) state.aiKnowledge = [];
    if (!Array.isArray(state.aiUnansweredQueue)) state.aiUnansweredQueue = [];
    if (!Array.isArray(state.aiInteractionLog)) state.aiInteractionLog = [];
  }

  function normalizeAiString(txt) {
    if (window.SMPL_AI && typeof window.SMPL_AI.normalizeText === 'function') {
      return window.SMPL_AI.normalizeText(txt);
    }
    return String(txt || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function upsertAiKnowledgeMaterialized(knowledgeId) {
    ensureAiContainers();
    if (!knowledgeId) return null;
    let rec = state.aiKnowledge.find((k) => k && k.id === knowledgeId);
    if (!rec) {
      const base = window.SMPL_AI && typeof window.SMPL_AI.getBaseItemById === 'function'
        ? window.SMPL_AI.getBaseItemById(knowledgeId)
        : null;
      if (!base) return null;
      rec = {
        id: base.id,
        category: base.category || 'Wiedza SMPL',
        title: base.title || '',
        keywords: (base.keywords || []).slice(),
        learnedPhrases: (base.learnedPhrases || []).slice(),
        answer: base.answer || '',
        helpfulCount: 0,
        unhelpfulCount: 0,
        asksCount: 0,
        source: 'BUILT_IN',
        updatedAt: Date.now(),
        createdBy: 'System SMPL'
      };
      state.aiKnowledge.push(rec);
    }
    return rec;
  }

  function enqueueAiUnansweredInternal(questionText, interactionId, reasonType) {
    ensureAiContainers();
    const cleanQ = String(questionText || '').trim();
    const normQ = normalizeAiString(cleanQ);
    if (!cleanQ || !normQ) return null;

    const existing = state.aiUnansweredQueue.find((q) => q && q.status === 'PENDING' && q.normalized === normQ);
    const sess = getSession();
    const isAdmin = isStrictAdminSession(sess);
    const askerPlayer = !isAdmin && sess.activePlayerId
      ? (state.players || []).find((p) => p.id === sess.activePlayerId)
      : null;

    if (existing) {
      existing.askCount = Number(existing.askCount || 1) + 1;
      existing.lastAskedAt = new Date().toLocaleString('pl-PL');
      existing.reason = reasonType || existing.reason || 'UNKNOWN';
      if (askerPlayer && !existing.playerId) {
        existing.playerId = askerPlayer.id;
        existing.playerName = askerPlayer.name;
        existing.leagueId = askerPlayer.leagueId;
      }
      return existing;
    }

    const qEntry = {
      id: 'AIQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      interactionId: interactionId || null,
      question: cleanQ.slice(0, 320),
      normalized: normQ,
      playerId: askerPlayer ? askerPlayer.id : (isAdmin ? (sess.adminId || 'ADM') : null),
      playerName: askerPlayer ? askerPlayer.name : (isAdmin ? (sess.adminName || 'Admin') : 'Gość / Rejestracja'),
      leagueId: askerPlayer ? askerPlayer.leagueId : 'ALL',
      createdAt: new Date().toLocaleString('pl-PL'),
      lastAskedAt: new Date().toLocaleString('pl-PL'),
      askCount: 1,
      reason: reasonType || 'UNKNOWN',
      status: 'PENDING',
      resolvedAnswer: '',
      resolvedBy: '',
      resolvedAt: '',
      knowledgeId: ''
    };
    state.aiUnansweredQueue.unshift(qEntry);
    if (state.aiUnansweredQueue.length > 100) {
      state.aiUnansweredQueue = state.aiUnansweredQueue.slice(0, 100);
    }
    return qEntry;
  }

  function logAiInteraction(payload) {
    ensureAiContainers();
    const p = payload && typeof payload === 'object' ? payload : {};
    const cleanQ = String(p.question || '').trim();
    if (!cleanQ) return null;
    const sess = getSession();
    const isAdmin = isStrictAdminSession(sess);
    const askerPlayer = !isAdmin && sess.activePlayerId
      ? (state.players || []).find((pl) => pl.id === sess.activePlayerId)
      : null;

    const entry = {
      id: 'AILOG_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
      question: cleanQ.slice(0, 260),
      normalized: normalizeAiString(cleanQ),
      matched: Boolean(p.matched),
      knowledgeId: p.knowledgeId || null,
      matchedTitle: String(p.title || '').slice(0, 160),
      confidence: Number(p.confidence || 0),
      playerId: askerPlayer ? askerPlayer.id : null,
      playerName: askerPlayer ? askerPlayer.name : (isAdmin ? (sess.adminName || 'Admin') : 'Gość'),
      rating: null,
      createdAt: new Date().toLocaleString('pl-PL')
    };

    state.aiInteractionLog.unshift(entry);
    if (state.aiInteractionLog.length > 120) {
      state.aiInteractionLog = state.aiInteractionLog.slice(0, 120);
    }

    let queuedRec = null;
    if (entry.knowledgeId && String(entry.knowledgeId).indexOf('GEMINI_') !== 0) {
      const kRec = upsertAiKnowledgeMaterialized(entry.knowledgeId);
      if (kRec) {
        kRec.asksCount = Number(kRec.asksCount || 0) + 1;
        kRec.updatedAt = Date.now();
      }
    } else if (!entry.matched) {
      queuedRec = enqueueAiUnansweredInternal(cleanQ, entry.id, 'UNKNOWN');
    }

    if (isStrictAdminSession(sess)) {
      syncToBackend();
    } else {
      persistAiStateLocalOnly();
      sendPublicAiTelemetry({
        op: 'log',
        entry: entry,
        queueItem: queuedRec
      });
    }
    return entry;
  }

  function recordAiFeedback(interactionId, vote) {
    ensureAiContainers();
    const sess = getSession();
    const cleanVote = vote === 'UP' ? 'UP' : 'DOWN';
    const logItem = state.aiInteractionLog.find((it) => it && it.id === interactionId);
    if (!logItem) return { ok: false, error: 'Nie znaleziono wpisu rozmowy.' };
    logItem.rating = cleanVote;

    let learnedPhraseAdded = '';
    let learnedKeywordsAdded = [];
    let queuedDownRec = null;

    if (cleanVote === 'UP') {
      if (logItem.knowledgeId && String(logItem.knowledgeId).indexOf('GEMINI_') !== 0) {
        const kRec = upsertAiKnowledgeMaterialized(logItem.knowledgeId);
        if (kRec) {
          kRec.helpfulCount = Number(kRec.helpfulCount || 0) + 1;
          if (!Array.isArray(kRec.learnedPhrases)) kRec.learnedPhrases = [];
          if (!Array.isArray(kRec.keywords)) kRec.keywords = [];

          // Samouczenie: zapamiętujemy potoczną frazę gracza i wyekstrahowane słowa kluczowe
          const normPhrase = normalizeAiString(logItem.question);
          if (normPhrase && normPhrase.length >= 4 && kRec.learnedPhrases.indexOf(normPhrase) === -1) {
            kRec.learnedPhrases.push(normPhrase);
            learnedPhraseAdded = normPhrase;
            if (kRec.learnedPhrases.length > 40) {
              kRec.learnedPhrases = kRec.learnedPhrases.slice(-40);
            }
          }
          if (window.SMPL_AI && typeof window.SMPL_AI.extractAutoKeywords === 'function') {
            const autoKws = window.SMPL_AI.extractAutoKeywords(logItem.question);
            autoKws.forEach((kw) => {
              if (kRec.keywords.indexOf(kw) === -1) {
                kRec.keywords.push(kw);
                learnedKeywordsAdded.push(kw);
              }
            });
            if (kRec.keywords.length > 35) {
              kRec.keywords = kRec.keywords.slice(0, 35);
            }
          }
          kRec.updatedAt = Date.now();
        }
      }
    } else {
      if (logItem.knowledgeId && String(logItem.knowledgeId).indexOf('GEMINI_') !== 0) {
        const kRec = upsertAiKnowledgeMaterialized(logItem.knowledgeId);
        if (kRec) {
          kRec.unhelpfulCount = Number(kRec.unhelpfulCount || 0) + 1;
          kRec.updatedAt = Date.now();
        }
      }
      queuedDownRec = enqueueAiUnansweredInternal(logItem.question, logItem.id, 'THUMBS_DOWN');
    }

    if (isStrictAdminSession(sess)) {
      syncToBackend();
    } else {
      persistAiStateLocalOnly();
      sendPublicAiTelemetry({
        op: 'vote',
        interactionId: logItem.id,
        vote: cleanVote,
        knowledgeId: logItem.knowledgeId || null,
        learnedPhrase: learnedPhraseAdded,
        learnedKeywords: learnedKeywordsAdded,
        queueItem: queuedDownRec
      });
    }
    return { ok: true, vote: cleanVote, interaction: logItem };
  }

  function adminTeachAiAnswer(payload, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    ensureAiContainers();
    const p = payload && typeof payload === 'object' ? payload : {};
    const answerText = String(p.answer || '').trim();
    if (answerText.length < 5) {
      throw new Error('Wpisz konkretną odpowiedź dla Vanessy (min. 5 znaków).');
    }

    const qItem = p.queueId
      ? state.aiUnansweredQueue.find((q) => q && q.id === p.queueId)
      : null;

    const rawPhrase = String(p.questionPhrase || (qItem && qItem.question) || p.title || '').trim();
    const normPhrase = normalizeAiString(rawPhrase);
    const titleText = String(p.title || rawPhrase || 'Wiedza Administracji').trim().slice(0, 120);
    const categoryText = String(p.category || 'Wiedza Wyuczona').trim().slice(0, 60);

    const kwSet = {};
    const manualKws = String(p.keywords || '').split(/[,;\n\s]+/);
    manualKws.forEach((kw) => {
      const c = normalizeAiString(kw);
      if (c && c.length >= 2) kwSet[c] = true;
    });
    if (window.SMPL_AI && typeof window.SMPL_AI.extractAutoKeywords === 'function') {
      window.SMPL_AI.extractAutoKeywords(rawPhrase + ' ' + titleText).forEach((ak) => {
        if (ak && ak.length >= 2) kwSet[ak] = true;
      });
    }
    const kwList = Object.keys(kwSet).slice(0, 35);

    let targetKnowledge = null;
    if (p.knowledgeId) {
      targetKnowledge = upsertAiKnowledgeMaterialized(p.knowledgeId);
    }

    if (targetKnowledge) {
      targetKnowledge.title = titleText || targetKnowledge.title;
      targetKnowledge.category = categoryText || targetKnowledge.category;
      targetKnowledge.answer = answerText;
      targetKnowledge.source = 'ADMIN_TAUGHT';
      targetKnowledge.updatedAt = Date.now();
      targetKnowledge.createdBy = adminName;
      if (!Array.isArray(targetKnowledge.keywords)) targetKnowledge.keywords = [];
      kwList.forEach((k) => {
        if (targetKnowledge.keywords.indexOf(k) === -1) targetKnowledge.keywords.push(k);
      });
      if (!Array.isArray(targetKnowledge.learnedPhrases)) targetKnowledge.learnedPhrases = [];
      if (normPhrase && targetKnowledge.learnedPhrases.indexOf(normPhrase) === -1) {
        targetKnowledge.learnedPhrases.push(normPhrase);
      }
    } else {
      targetKnowledge = {
        id: 'AI_KB_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        category: categoryText,
        title: titleText,
        keywords: kwList,
        learnedPhrases: normPhrase ? [normPhrase] : [],
        answer: answerText,
        helpfulCount: 1,
        unhelpfulCount: 0,
        asksCount: 0,
        source: 'ADMIN_TAUGHT',
        updatedAt: Date.now(),
        createdBy: adminName
      };
      state.aiKnowledge.unshift(targetKnowledge);
    }

    // Zamykamy dopasowane pytania oczekujące i wysyłamy odpowiedź pytającemu graczowi
    const nowStr = new Date().toLocaleString('pl-PL');
    state.aiUnansweredQueue.forEach((qi) => {
      if (!qi || qi.status !== 'PENDING') return;
      const matchId = qItem && qi.id === qItem.id;
      const matchPhrase = normPhrase && qi.normalized === normPhrase;
      if (matchId || matchPhrase) {
        qi.status = 'RESOLVED';
        qi.resolvedAnswer = answerText;
        qi.resolvedBy = adminName;
        qi.resolvedAt = nowStr;
        qi.knowledgeId = targetKnowledge.id;

        if (qi.playerId) {
          const asker = (state.players || []).find((pl) => pl.id === qi.playerId);
          if (asker) {
            if (!Array.isArray(asker.notifications)) asker.notifications = [];
            asker.notifications.unshift({
              id: 'NOTIF_AI_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
              type: 'AI_ANSWER',
              text: '💋 Vanessa AI nauczyła się odpowiedzi na Twoje pytanie („' + qi.question.slice(0, 60) + '”): ' + answerText,
              date: nowStr,
              read: false
            });
          }
        }
      }
    });

    addLog(
      'AI_TEACH',
      '💋 Admin ' + adminName + ' nauczył Asystentkę Vanessę nowej odpowiedzi: „' + targetKnowledge.title + '”.'
    );
    syncToBackend();
    return { ok: true, knowledge: targetKnowledge };
  }

  function adminDismissAiQueueItem(queueId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    ensureAiContainers();
    const q = state.aiUnansweredQueue.find((it) => it && it.id === queueId);
    if (!q) return false;
    q.status = 'DISMISSED';
    q.resolvedBy = adminName;
    q.resolvedAt = new Date().toLocaleString('pl-PL');
    syncToBackend();
    return true;
  }

  function adminDeleteAiKnowledge(knowledgeId, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    ensureAiContainers();
    const prevLen = state.aiKnowledge.length;
    state.aiKnowledge = state.aiKnowledge.filter((k) => k && k.id !== knowledgeId);
    if (state.aiKnowledge.length !== prevLen) {
      addLog('AI_KNOWLEDGE_DEL', '🗑️ Admin ' + adminName + ' usunął wyuczony wpis AI (' + knowledgeId + ').');
      syncToBackend();
      return true;
    }
    return false;
  }

  // --- INTEGRACJA VANESSY AI Z GOOGLE GEMINI API (HTTP/HTTPS REST -> api.php / server.js) ---
  let aiGeminiStatusCache = {
    checked: false,
    geminiReady: false,
    enabled: false,
    model: 'gemini-3.8-flash'
  };

  function getAiActionUrl(actionName) {
    const base = (typeof activeApiEndpoint === 'string' && activeApiEndpoint) ? activeApiEndpoint : './api.php';
    const sep = base.indexOf('?') === -1 ? '?' : '&';
    return base + sep + 'action=' + encodeURIComponent(actionName);
  }

  function resolveAdminRequestToken() {
    const sess = getSession();
    if (!isStrictAdminSession(sess)) return '';
    return serverAdminTokenCache || (sess && sess.serverAdminToken) || '';
  }

  function resolvePlayerRequestToken() {
    const sess = getSession();
    return serverPlayerTokenCache || (sess && sess.serverPlayerToken) || '';
  }

  function persistAiStateLocalOnly() {
    if (!state) return;
    state.updatedAt = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function sendPublicAiTelemetry(payloadObj) {
    if (!isHttpProtocol() || typeof fetch !== 'function') return;
    try {
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const pTok = resolvePlayerRequestToken();
      if (pTok) headers['X-SMPL-Player-Token'] = pTok;
      fetch(getAiActionUrl('ai_telemetry'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payloadObj || {})
      }).catch(() => {});
    } catch (e) {}
  }

  function getAiStatusCached() {
    return aiGeminiStatusCache;
  }

  function makeResolvedPromise(val) {
    return {
      then: function (cb) {
        if (typeof cb === 'function') {
          try {
            const nextVal = cb(val);
            if (nextVal && typeof nextVal.then === 'function') return nextVal;
            return makeResolvedPromise(nextVal);
          } catch (e) {
            return makeResolvedPromise(null);
          }
        }
        return makeResolvedPromise(val);
      },
      catch: function () { return this; }
    };
  }

  function getAiStatus() {
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      aiGeminiStatusCache = {
        checked: true,
        checkedAt: Date.now(),
        geminiReady: false,
        enabled: false,
        model: 'gemini-3.5-flash-lite'
      };
      return makeResolvedPromise({
        ok: false,
        geminiReady: false,
        enabled: false,
        model: 'gemini-3.5-flash-lite',
        reason: 'FILE_PROTOCOL'
      });
    }
    return fetch(getAiActionUrl('ai_status'), {
      method: 'GET',
      cache: 'no-store'
    })
      .then((res) => {
        if (res && res.ok) return res.json();
        return fetch('./api/state?action=ai_status', { method: 'GET', cache: 'no-store' }).then((r2) => {
          if (r2 && r2.ok) {
            activeApiEndpoint = './api/state';
            return r2.json();
          }
          return null;
        });
      })
      .then((data) => {
        if (data && data.ok) {
          aiGeminiStatusCache = {
            checked: true,
            checkedAt: Date.now(),
            geminiReady: Boolean(data.geminiReady),
            enabled: Boolean(data.enabled),
            model: data.model || 'gemini-3.5-flash-lite'
          };
          return data;
        }
        return { ok: false, geminiReady: false, enabled: false, model: 'gemini-3.5-flash-lite' };
      })
      .catch(() => ({ ok: false, geminiReady: false, enabled: false, model: 'gemini-3.5-flash-lite' }));
  }

  function getAiGeminiConfig() {
    assertAdminAuthenticated();
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      return makeResolvedPromise({
        ok: false,
        offline: true,
        error: 'Konfiguracja klucza Gemini API wymaga uruchomienia portalu przez serwer (http/https: Hostido PHP lub node server.js).'
      });
    }
    const waitTok = serverAdminTokenPromise || Promise.resolve(null);
    return waitTok.then(() => {
      const tok = resolveAdminRequestToken();
      const headers = { Accept: 'application/json' };
      if (tok) headers['X-SMPL-Admin-Token'] = tok;
      return fetch(getAiActionUrl('ai_config_get'), {
        method: 'GET',
        cache: 'no-store',
        headers: headers
      });
    })
      .then((res) => res.json().catch(() => ({ ok: false, error: 'Błąd odpowiedzi serwera (' + res.status + ').' })))
      .then((data) => {
        if (data && data.ok) {
          aiGeminiStatusCache = {
            checked: true,
            geminiReady: Boolean(data.configured && data.enabled),
            enabled: Boolean(data.enabled),
            model: data.model || 'gemini-3.8-flash'
          };
        }
        return data;
      })
      .catch((err) => ({ ok: false, error: (err && err.message) || 'Błąd połączenia z serwerem.' }));
  }

  function saveAiGeminiConfig(cfg) {
    assertMasterAdminAuthenticated();
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      return makeResolvedPromise({
        ok: false,
        offline: true,
        error: 'Zapis klucza Gemini API działa w trybie serwerowym (Hostido PHP lub lokalnie node server.js).'
      });
    }
    const waitTok = serverAdminTokenPromise || Promise.resolve(null);
    return waitTok.then(() => {
      const tok = resolveAdminRequestToken();
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const bodyObj = (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) ? Object.assign({}, cfg) : {};
      if (tok) {
        headers['X-SMPL-Admin-Token'] = tok;
        bodyObj._adminToken = tok;
      }
      return fetch(getAiActionUrl('ai_config_save'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyObj)
      });
    })
      .then((res) => res.json().catch(() => ({ ok: false, error: 'Błąd zapisu konfiguracji (' + res.status + ').' })))
      .then((data) => {
        if (data && data.ok) {
          aiGeminiStatusCache = {
            checked: true,
            geminiReady: Boolean(data.configured && data.enabled),
            enabled: Boolean(data.enabled),
            model: data.model || 'gemini-3.8-flash'
          };
        }
        return data;
      })
      .catch((err) => ({ ok: false, error: (err && err.message) || 'Błąd sieci przy zapisie konfiguracji.' }));
  }

  function testAiGeminiConnection(overrideCfg) {
    assertAdminAuthenticated();
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      return makeResolvedPromise({
        ok: false,
        offline: true,
        error: 'Test na żywo z Google Gemini wymaga uruchomienia przez http:// lub https:// (node server.js lub Hostido).'
      });
    }
    const waitTok = serverAdminTokenPromise || Promise.resolve(null);
    return waitTok.then(() => {
      const tok = resolveAdminRequestToken();
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const bodyObj = (overrideCfg && typeof overrideCfg === 'object' && !Array.isArray(overrideCfg)) ? Object.assign({}, overrideCfg) : {};
      if (tok) {
        headers['X-SMPL-Admin-Token'] = tok;
        bodyObj._adminToken = tok;
      }
      return fetch(getAiActionUrl('ai_test'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyObj)
      });
    })
      .then((res) => res.json().catch(() => ({ ok: false, error: 'Nieprawidłowa odpowiedź serwera podczas testu (' + res.status + ').' })))
      .catch((err) => ({ ok: false, error: (err && err.message) || 'Błąd połączenia z serwerem testowym.' }));
  }

  function askVanessaGemini(payload) {
    if (!isHttpProtocol() || typeof fetch !== 'function') {
      return makeResolvedPromise({ ok: false, fallback: true, reason: 'FILE_PROTOCOL' });
    }
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const tok = resolveAdminRequestToken();
    const pTok = resolvePlayerRequestToken();
    if (tok) headers['X-SMPL-Admin-Token'] = tok;
    if (pTok) headers['X-SMPL-Player-Token'] = pTok;
    const bodyStr = JSON.stringify(payload || {});
    return fetch(getAiActionUrl('ai_chat'), {
      method: 'POST',
      headers: headers,
      body: bodyStr
    })
      .then((res) => {
        if (res && res.status === 404 && activeApiEndpoint !== './api/state') {
          return fetch('./api/state?action=ai_chat', {
            method: 'POST',
            headers: headers,
            body: bodyStr
          });
        }
        return res;
      })
      .then((res) => (res ? res.json().catch(() => ({ ok: false, fallback: true, reason: 'BAD_JSON' })) : { ok: false, fallback: true, reason: 'EMPTY' }))
      .then((data) => {
        if (data && data.ok) {
          aiGeminiStatusCache = {
            checked: true,
            checkedAt: Date.now(),
            geminiReady: true,
            enabled: true,
            model: data.model || aiGeminiStatusCache.model || 'gemini-3.5-flash-lite'
          };
        }
        return data || { ok: false, fallback: true, reason: 'EMPTY' };
      })
      .catch((err) => ({
        ok: false,
        fallback: true,
        reason: 'NETWORK_ERROR',
        error: (err && err.message) || 'Brak połączenia z serwerem'
      }));
  }

  // --- MASTER STUDIO: PEŁNY PANEL WŁAŚCICIELA (SZYMON KOMENDA) ---
  function assertMasterAdminAuthenticated() {
    const sess = getSession();
    if (!isStrictAdminSession(sess) || sess.adminRole !== 'MASTER_ADMIN') {
      throw new Error('⛔ Ta operacja jest dostępna wyłącznie dla Głównego Właściciela (Master Admin — Szymon Komenda).');
    }
    return sess;
  }

  function ensureMasterExtensions(targetState) {
    const st = targetState || state;
    if (!st) return st;
    if (!Array.isArray(st.customRanks)) st.customRanks = [];
    if (!st.portalSettings || typeof st.portalSettings !== 'object' || Array.isArray(st.portalSettings)) st.portalSettings = {};
    if (!st.customCrests || typeof st.customCrests !== 'object' || Array.isArray(st.customCrests)) st.customCrests = {};
    return st;
  }

  function masterSaveCustomRank(payload, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureMasterExtensions(state);
    const p = payload && typeof payload === 'object' ? payload : {};
    const cleanName = String(p.name || '').trim().slice(0, 48);
    if (cleanName.length < 2) {
      throw new Error('Podaj nazwę rangi (minimum 2 znaki).');
    }
    const cleanIcon = String(p.icon || '🌟').trim().slice(0, 8) || '🌟';
    const safeColor = /^#[0-9A-Fa-f]{6}$/.test(String(p.colorHex || '')) ? String(p.colorHex) : '#fbbf24';
    const safeText = /^#[0-9A-Fa-f]{6}$/.test(String(p.textColor || '')) ? String(p.textColor) : '#ffffff';
    const safeDesc = String(p.description || '').trim().slice(0, 160);
    const safeXp = Math.max(0, Math.min(5000, Math.round(Number(p.xpBonus || 0) || 0)));
    const allowedVariants = ['HOLO_GOLD', 'METALLIC', 'NEON_GLOW', 'LIQUID_GLASS', 'CHROME_OBSIDIAN'];
    const rawVariant = String(p.styleVariant || 'HOLO_GOLD').trim().toUpperCase();
    const safeVariant = allowedVariants.includes(rawVariant) ? rawVariant : 'HOLO_GOLD';

    const reqId = String(p.id || '').trim();
    let existing = reqId ? state.customRanks.find((cr) => cr && cr.id === reqId) : null;
    if (existing) {
      existing.name = cleanName;
      existing.icon = cleanIcon;
      existing.colorHex = safeColor;
      existing.textColor = safeText;
      existing.description = safeDesc;
      existing.xpBonus = safeXp;
      existing.styleVariant = safeVariant;
      existing.updatedAt = nowFormatted();
      addLog('MASTER_RANK_EDIT', `👑 Master ${adminName} zaktualizował własną rangę: ${cleanIcon} ${cleanName}.`);
    } else {
      const duplicateName = state.customRanks.some(
        (cr) => cr && String(cr.name || '').trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicateName) {
        throw new Error('Ranga o takiej nazwie już istnieje.');
      }
      const rankId = 'RANK_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6).toUpperCase();
      existing = {
        id: rankId,
        name: cleanName,
        icon: cleanIcon,
        css: 'tt-custom',
        styleVariant: safeVariant,
        colorHex: safeColor,
        textColor: safeText,
        description: safeDesc,
        xpBonus: safeXp,
        createdBy: adminName,
        createdAt: nowFormatted()
      };
      state.customRanks.push(existing);
      addLog('MASTER_RANK_ADD', `👑 Master ${adminName} utworzył nową rangę w lidze: ${cleanIcon} ${cleanName}${safeXp > 0 ? ' (+' + safeXp + ' XP)' : ''}.`);
    }
    syncToBackend();
    return existing;
  }

  function masterDeleteCustomRank(rankId, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureMasterExtensions(state);
    const idx = state.customRanks.findIndex((cr) => cr && cr.id === rankId);
    if (idx === -1) throw new Error('Nie znaleziono wskazanej rangi.');
    const removed = state.customRanks[idx];
    state.customRanks.splice(idx, 1);
    (state.players || []).forEach((pl) => {
      if (!pl) return;
      if (pl.customRank === rankId) pl.customRank = null;
      if (Array.isArray(pl.extraCustomRanks)) {
        pl.extraCustomRanks = pl.extraCustomRanks.filter((rid) => rid !== rankId);
      }
    });
    addLog('MASTER_RANK_DEL', `🗑️ Master ${adminName} usunął rangę własną: ${(removed && removed.icon) || ''} ${(removed && removed.name) || rankId}.`);
    syncToBackend();
    return removed;
  }

  function masterAssignRankToPlayer(playerId, rankId, mode = 'primary', adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureMasterExtensions(state);
    const player = (state.players || []).find((p) => p && p.id === playerId);
    if (!player) throw new Error('Nie znaleziono zawodnika.');
    const cleanRankId = String(rankId || '').trim();
    const resolvedTitle = cleanRankId && window.SMPL_RANKS && typeof window.SMPL_RANKS.getTitleById === 'function'
      ? window.SMPL_RANKS.getTitleById(cleanRankId, state)
      : null;

    if (mode === 'clear_all') {
      player.customRank = null;
      player.extraCustomRanks = [];
      addLog('MASTER_RANK_CLEAR', `🧹 Master ${adminName} wyczyścił rangi specjalne zawodnika ${player.name}.`);
      syncToBackend();
      return player;
    }

    if (mode === 'toggle_extra') {
      if (!cleanRankId || !resolvedTitle) throw new Error('Wybierz poprawną rangę do dopisania.');
      if (!Array.isArray(player.extraCustomRanks)) player.extraCustomRanks = [];
      const idx = player.extraCustomRanks.indexOf(cleanRankId);
      if (idx !== -1) {
        player.extraCustomRanks.splice(idx, 1);
        addLog('MASTER_RANK_UNASSIGN', `👑 Master ${adminName} zdjął dodatkową rangę ${resolvedTitle.icon} ${resolvedTitle.name} zawodnikowi ${player.name}.`);
      } else {
        player.extraCustomRanks.push(cleanRankId);
        if (!Array.isArray(player.notifications)) player.notifications = [];
        player.notifications.unshift({
          id: 'NOTIF_RANK_' + Date.now(),
          time: nowFormatted(),
          text: `👑 Właściciel Ligi ${adminName} nadał Ci dodatkową rangę: ${resolvedTitle.icon} ${resolvedTitle.name}!`
        });
        addLog('MASTER_RANK_ASSIGN', `👑 Master ${adminName} nadał dodatkową rangę ${resolvedTitle.icon} ${resolvedTitle.name} zawodnikowi ${player.name}.`);
      }
      syncToBackend();
      return player;
    }

    if (!cleanRankId) {
      player.customRank = null;
      addLog('MASTER_RANK_UNASSIGN', `👑 Master ${adminName} zdjął główną rangę specjalną zawodnikowi ${player.name}.`);
    } else {
      if (!resolvedTitle) throw new Error('Nie znaleziono wybranej rangi.');
      player.customRank = cleanRankId;
      if (!Array.isArray(player.notifications)) player.notifications = [];
      player.notifications.unshift({
        id: 'NOTIF_RANK_' + Date.now(),
        time: nowFormatted(),
        text: `👑 Właściciel Ligi ${adminName} nadał Ci wyróżnienie / rangę: ${resolvedTitle.icon} ${resolvedTitle.name}!`
      });
      addLog('MASTER_RANK_ASSIGN', `👑 Master ${adminName} nadał rangę ${resolvedTitle.icon} ${resolvedTitle.name} zawodnikowi ${player.name}.`);
    }
    syncToBackend();
    return player;
  }

  function masterUpdatePortalSettings(updates, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureMasterExtensions(state);
    const upd = updates && typeof updates === 'object' ? updates : {};

    if (upd.season !== undefined && Number(upd.season) >= 1) {
      state.season = Math.min(999, Math.max(1, Math.round(Number(upd.season))));
    }
    if (upd.seasonName !== undefined && String(upd.seasonName).trim()) {
      state.seasonName = String(upd.seasonName).trim().slice(0, 120);
    }
    if (!state.weeklyConfig) state.weeklyConfig = { roundsPerWeek: 4, currentWeek: 1, totalWeeks: 8 };
    if (upd.currentWeek !== undefined && Number(upd.currentWeek) >= 1) {
      state.weeklyConfig.currentWeek = Math.min(60, Math.max(1, Math.round(Number(upd.currentWeek))));
    }
    if (upd.roundsPerWeek !== undefined && Number(upd.roundsPerWeek) >= 1) {
      state.weeklyConfig.roundsPerWeek = Math.min(15, Math.max(1, Math.round(Number(upd.roundsPerWeek))));
    }

    const ps = state.portalSettings;
    if (upd.heroBadge !== undefined) ps.heroBadge = String(upd.heroBadge || '').trim().slice(0, 120);
    if (upd.heroTitle !== undefined) ps.heroTitle = String(upd.heroTitle || '').trim().slice(0, 120);
    if (upd.heroSubtitle !== undefined) ps.heroSubtitle = String(upd.heroSubtitle || '').trim().slice(0, 500);
    if (upd.announcementText !== undefined) ps.announcementText = String(upd.announcementText || '').trim().slice(0, 300);
    if (upd.announcementActive !== undefined) ps.announcementActive = Boolean(upd.announcementActive);
    let maintChanged = false;
    let prevMaintSnap = null;
    if (upd.maintenanceMode !== undefined || upd.maintenanceMessage !== undefined) {
      const curM = getMaintenanceMode();
      prevMaintSnap = ps.maintenanceMode ? Object.assign({}, ps.maintenanceMode) : { enabled: false, message: '' };
      const nextEnabled = (upd.maintenanceMode && typeof upd.maintenanceMode === 'object')
        ? Boolean(upd.maintenanceMode.enabled)
        : (upd.maintenanceMode !== undefined ? Boolean(upd.maintenanceMode) : curM.enabled);
      const rawMsg = upd.maintenanceMessage !== undefined
        ? upd.maintenanceMessage
        : ((upd.maintenanceMode && typeof upd.maintenanceMode === 'object' && upd.maintenanceMode.message !== undefined) ? upd.maintenanceMode.message : curM.message);
      const cleanMsg = String(rawMsg || '').replace(/<[^>]*>/g, '').trim().slice(0, 220) || 'Trwa przerwa techniczna (losowanie/aktualizacja tabel) — zgłaszanie wyników chwilowo wstrzymane.';
      ps.maintenanceMode = {
        enabled: nextEnabled,
        message: cleanMsg,
        updatedBy: adminName,
        updatedAt: nowFormatted()
      };
      maintChanged = true;
    }
    if (upd.seasonJoinOpen !== undefined) {
      ps.seasonJoinOpen = Boolean(upd.seasonJoinOpen);
      ps.seasonWindowPhase = ps.seasonJoinOpen ? 'OPEN' : 'ENDED';
      ps.seasonJoinUpdatedBy = adminName;
      ps.seasonJoinUpdatedAt = nowFormatted();
    }
    if (upd.seasonWindowPhase !== undefined) ps.seasonWindowPhase = String(upd.seasonWindowPhase || 'NOT_STARTED');
    if (Array.isArray(upd.seasonJoinAllowedLeagues)) ps.seasonJoinAllowedLeagues = upd.seasonJoinAllowedLeagues;
    ps.updatedAt = nowFormatted();
    ps.updatedBy = adminName;

    addLog('MASTER_SETTINGS', `⚙️ Master ${adminName} zaktualizował globalne ustawienia portalu (Sezon ${state.season}, Tydzień ${state.weeklyConfig.currentWeek}).`);
    syncToBackend();
    return state.portalSettings;
  }

  function sanitizeSupportUrl(rawUrl) {
    const clean = String(rawUrl || '').trim().slice(0, 320);
    if (!clean) return '';
    if (!/^https?:\/\/[^\s"'<>]+$/i.test(clean)) {
      throw new Error('Link wsparcia musi zaczynać się od https:// (lub http://).');
    }
    return clean;
  }

  function getDefaultSupportConfig() {
    return {
      enabled: true,
      headline: 'Postaw Kawę Twórcy & Dorzuć Paliwa Arenie SMPL',
      intro: 'Portal Score Match Liga, aplikacja PWA na telefon, karty UT, archiwum 55 sezonów oraz Vanessa Gemini AI powstały z czystej pasji dla społeczności Score Match Polska — bez reklam, bez wpisowego (0 zł) i bez Pay-to-Win. Jeśli liga daje Ci frajdę, możesz dobrowolnie wesprzeć utrzymanie serwera, domeny, silnika AI oraz pracę Twórcy i Administracji!',
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
      adminSupportNote: 'Dobrowolne wsparcie pomaga opłacić szybki hosting Hostido NVMe, domenę, tokeny Vanessy AI oraz docenić codzienną, społeczną pracę Twórcy i Administracji przy prowadzeniu rozgrywek.',
      supporters: [],
      updatedAt: '',
      updatedBy: ''
    };
  }

  function getSupportConfig(targetState) {
    const st = targetState || state;
    const def = getDefaultSupportConfig();
    const raw = (st && st.portalSettings && st.portalSettings.supportConfig && typeof st.portalSettings.supportConfig === 'object' && !Array.isArray(st.portalSettings.supportConfig))
      ? st.portalSettings.supportConfig
      : {};
    const merged = Object.assign({}, def, raw);
    merged.enabled = raw.enabled === undefined ? true : Boolean(raw.enabled);
    merged.adminSupportEnabled = raw.adminSupportEnabled === undefined ? true : Boolean(raw.adminSupportEnabled);
    merged.goalAmount = Math.max(0, Math.min(50000, Math.round(Number(merged.goalAmount || 0) || 0)));
    merged.currentAmount = Math.max(0, Math.min(50000, Math.round(Number(merged.currentAmount || 0) || 0)));
    merged.supporters = Array.isArray(raw.supporters) ? raw.supporters : [];
    return merged;
  }

  function masterUpdateSupportConfig(payload, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureMasterExtensions(state);
    const p = payload && typeof payload === 'object' ? payload : {};
    const cur = getSupportConfig(state);
    const next = Object.assign({}, cur, {
      enabled: p.enabled !== undefined ? Boolean(p.enabled) : cur.enabled,
      headline: p.headline !== undefined ? String(p.headline || '').trim().slice(0, 120) || cur.headline : cur.headline,
      intro: p.intro !== undefined ? String(p.intro || '').trim().slice(0, 600) || cur.intro : cur.intro,
      goalTitle: p.goalTitle !== undefined ? String(p.goalTitle || '').trim().slice(0, 140) || cur.goalTitle : cur.goalTitle,
      goalPeriod: p.goalPeriod !== undefined ? String(p.goalPeriod || '').trim().slice(0, 60) : cur.goalPeriod,
      goalAmount: p.goalAmount !== undefined ? Math.max(0, Math.min(50000, Math.round(Number(p.goalAmount || 0) || 0))) : cur.goalAmount,
      currentAmount: p.currentAmount !== undefined ? Math.max(0, Math.min(50000, Math.round(Number(p.currentAmount || 0) || 0))) : cur.currentAmount,
      creatorLabel: p.creatorLabel !== undefined ? String(p.creatorLabel || '').trim().slice(0, 100) || cur.creatorLabel : cur.creatorLabel,
      buyCoffeeUrl: p.buyCoffeeUrl !== undefined ? sanitizeSupportUrl(p.buyCoffeeUrl) : cur.buyCoffeeUrl,
      suppiUrl: p.suppiUrl !== undefined ? sanitizeSupportUrl(p.suppiUrl) : cur.suppiUrl,
      paypalUrl: p.paypalUrl !== undefined ? sanitizeSupportUrl(p.paypalUrl) : cur.paypalUrl,
      blikInfo: p.blikInfo !== undefined ? String(p.blikInfo || '').trim().slice(0, 120) : cur.blikInfo,
      adminSupportEnabled: p.adminSupportEnabled !== undefined ? Boolean(p.adminSupportEnabled) : cur.adminSupportEnabled,
      adminLabel: p.adminLabel !== undefined ? String(p.adminLabel || '').trim().slice(0, 100) || cur.adminLabel : cur.adminLabel,
      adminSupportUrl: p.adminSupportUrl !== undefined ? sanitizeSupportUrl(p.adminSupportUrl) : cur.adminSupportUrl,
      adminSupportNote: p.adminSupportNote !== undefined ? String(p.adminSupportNote || '').trim().slice(0, 400) : cur.adminSupportNote,
      supporters: Array.isArray(cur.supporters) ? cur.supporters : [],
      updatedAt: nowFormatted(),
      updatedBy: adminName
    });
    state.portalSettings.supportConfig = next;
    addLog('MASTER_SUPPORT_CFG', `☕ Master ${adminName} zaktualizował konfigurację zakładki Wsparcia (Donate).`);
    syncToBackend();
    return next;
  }

  function masterAddSupporterEntry(payload, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureMasterExtensions(state);
    const p = payload && typeof payload === 'object' ? payload : {};
    const displayName = String(p.displayName || '').trim().slice(0, 60) || 'Anonimowy Kibic SMPL';
    const badge = String(p.badge || '☕').trim().slice(0, 28) || '☕';
    const note = String(p.note || '').trim().slice(0, 160);
    const cur = getSupportConfig(state);
    const entry = {
      id: 'SUP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      displayName: displayName,
      badge: badge,
      note: note,
      date: nowFormatted().slice(0, 10),
      addedBy: adminName,
      consentConfirmed: true
    };
    const nextList = [entry].concat(Array.isArray(cur.supporters) ? cur.supporters : []).slice(0, 100);
    cur.supporters = nextList;
    cur.updatedAt = nowFormatted();
    cur.updatedBy = adminName;
    state.portalSettings.supportConfig = cur;
    addLog('MASTER_SUPPORTER_ADD', `🏆 Master ${adminName} dodał podziękowanie na Ścianie Mecenasów: ${displayName} (${badge}).`);
    syncToBackend();
    return entry;
  }

  function masterRemoveSupporterEntry(supporterId, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureMasterExtensions(state);
    const sid = String(supporterId || '').trim();
    if (!sid) return false;
    const cur = getSupportConfig(state);
    const before = cur.supporters.length;
    cur.supporters = cur.supporters.filter((s) => s && s.id !== sid);
    if (cur.supporters.length === before) return false;
    cur.updatedAt = nowFormatted();
    cur.updatedBy = adminName;
    state.portalSettings.supportConfig = cur;
    addLog('MASTER_SUPPORTER_DEL', `🗑️ Master ${adminName} usunął wpis ze Ściany Mecenasów.`);
    syncToBackend();
    return true;
  }

  function masterSaveClan(payload, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureClansStructure(state);
    const p = payload && typeof payload === 'object' ? payload : {};
    const cleanName = String(p.name || '').trim().slice(0, 60);
    if (cleanName.length < 2) {
      throw new Error('Nazwa klanu musi mieć co najmniej 2 znaki.');
    }
    const safeTag = deriveClanTag(cleanName, p.tag || '');
    const safeColor = /^#[0-9A-Fa-f]{6}$/.test(String(p.primaryColor || '')) ? String(p.primaryColor) : '#10B981';
    const hasUploadedLogo = p.logo && String(p.logo).indexOf('data:image/') === 0 && String(p.logo).length <= 170000;

    let targetClan = p.id ? state.clans.find((c) => c && c.id === p.id) : null;
    if (targetClan) {
      targetClan.name = cleanName;
      targetClan.tag = safeTag;
      targetClan.primaryColor = safeColor;
      if (hasUploadedLogo) {
        targetClan.logo = String(p.logo);
      } else if (p.clearLogo) {
        targetClan.logo = resolveClanLogo({
          name: cleanName,
          tag: safeTag,
          primaryColor: safeColor,
          secondaryColor: targetClan.secondaryColor || '#0F172A'
        });
      }
      targetClan.updatedAt = nowFormatted();
      (state.players || []).forEach((pl) => {
        if (pl && pl.clanId === targetClan.id) {
          pl.clanName = targetClan.name;
          pl.clanTag = targetClan.tag;
          pl.clanLogo = targetClan.logo || null;
        }
      });
      (state.registrations || []).forEach((rg) => {
        if (rg && rg.clanId === targetClan.id) {
          rg.clanName = targetClan.name;
          rg.clanTag = targetClan.tag;
          rg.clanLogo = targetClan.logo || null;
        }
      });
      addLog('MASTER_CLAN_EDIT', `🛡️ Master ${adminName} zaktualizował klan [${safeTag}] ${cleanName}.`);
    } else {
      targetClan = registerOrFindClan({
        name: cleanName,
        tag: safeTag,
        primaryColor: safeColor,
        logo: hasUploadedLogo ? p.logo : null,
        createdBy: adminName
      });
      if (hasUploadedLogo && targetClan) {
        targetClan.logo = String(p.logo);
      }
      addLog('MASTER_CLAN_ADD', `🛡️ Master ${adminName} dodał nowy oficjalny klan [${safeTag}] ${cleanName}.`);
    }
    syncToBackend();
    return targetClan;
  }

  function masterDeleteClan(clanId, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureClansStructure(state);
    const idx = state.clans.findIndex((c) => c && c.id === clanId);
    if (idx === -1) throw new Error('Nie znaleziono klanu.');
    const removed = state.clans[idx];
    state.clans.splice(idx, 1);
    (state.players || []).forEach((pl) => {
      if (pl && pl.clanId === clanId) {
        pl.clanId = null;
        pl.clanName = '';
        pl.clanTag = '';
        pl.clanLogo = null;
      }
    });
    (state.registrations || []).forEach((rg) => {
      if (rg && rg.clanId === clanId) {
        rg.clanId = null;
        rg.clanName = '';
        rg.clanTag = '';
        rg.clanLogo = null;
      }
    });
    addLog('MASTER_CLAN_DEL', `🗑️ Master ${adminName} usunął klan ${(removed && removed.name) || clanId}.`);
    syncToBackend();
    return removed;
  }

  function masterUpdateLeague(leagueId, updates, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    ensureLeaguesStructure(state);
    const lg = state.leagues && state.leagues[leagueId];
    if (!lg) throw new Error('Nie znaleziono wskazanej ligi.');
    const u = updates && typeof updates === 'object' ? updates : {};
    if (u.name !== undefined && String(u.name).trim().length >= 2) {
      lg.name = String(u.name).trim().slice(0, 80);
    }
    if (u.shortName !== undefined && String(u.shortName).trim().length >= 2) {
      lg.shortName = String(u.shortName).trim().slice(0, 32);
    }
    if (u.primaryColor !== undefined && /^#[0-9A-Fa-f]{6}$/.test(String(u.primaryColor).trim())) {
      lg.primaryColor = String(u.primaryColor).trim();
    }
    if (u.adminName !== undefined && String(u.adminName).trim()) {
      lg.adminName = String(u.adminName).trim().slice(0, 80);
    }
    addLog('MASTER_LEAGUE_EDIT', `🏟️ Master ${adminName} zmodyfikował ustawienia ligi ${lg.id}: ${lg.name}.`);
    syncToBackend();
    return lg;
  }

  function masterManageGoldenBall(action, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    if (!state.goldenBall) {
      state.goldenBall = { season: state.season || 56, isOpen: true, winnerPlayerId: null, votes: [] };
    }
    if (action === 'open') {
      state.goldenBall.isOpen = true;
      addLog('MASTER_GB_OPEN', `🏆 Master ${adminName} otworzył głosowanie Złotej Piłki (Sezon ${state.goldenBall.season || state.season || 56}).`);
    } else if (action === 'close') {
      state.goldenBall.isOpen = false;
      addLog('MASTER_GB_CLOSE', `🔒 Master ${adminName} zamknął głosowanie Złotej Piłki.`);
    } else if (action === 'clear_votes') {
      const cnt = Array.isArray(state.goldenBall.votes) ? state.goldenBall.votes.length : 0;
      state.goldenBall.votes = [];
      state.goldenBall.winnerPlayerId = null;
      addLog('MASTER_GB_RESET', `🧹 Master ${adminName} wyzerował głosy Złotej Piłki (usunięto: ${cnt}).`);
    } else if (action === 'award') {
      return adminAwardGoldenBallWinner(adminName);
    } else {
      throw new Error('Nieznana akcja Złotej Piłki.');
    }
    syncToBackend();
    return state.goldenBall;
  }

  function masterImportDatabaseJson(rawJsonText, adminName = 'Szymon Komenda') {
    assertMasterAdminAuthenticated();
    let parsed;
    try {
      parsed = JSON.parse(String(rawJsonText || ''));
    } catch (e) {
      throw new Error('Wybrany plik nie jest poprawnym plikiem JSON.');
    }
    if (!parsed || !Array.isArray(parsed.players) || !Array.isArray(parsed.matches) || !parsed.leagues) {
      throw new Error('Nieprawidłowa struktura bazy danych SMPL (brak players / matches / leagues).');
    }
    parsed.version = TARGET_VERSION;
    if (!Array.isArray(parsed.admins) || !parsed.admins.some((a) => a && a.role === 'MASTER_ADMIN')) {
      const currentMaster = (state.admins || []).find((a) => a && a.role === 'MASTER_ADMIN');
      if (!Array.isArray(parsed.admins)) parsed.admins = [];
      if (currentMaster) parsed.admins.unshift(JSON.parse(JSON.stringify(currentMaster)));
    }
    state = ensureMasterExtensions(enrichFromArchive(parsed));
    ensureCompetitionsStructure(state);
    addLog('MASTER_DB_IMPORT', `📥 Master ${adminName} wczytał pełną kopię zapasową bazy danych JSON (${state.players.length} graczy, ${state.matches.length} meczów).`);
    syncToBackend({ allowBulkPlayerWipe: true });
    return state;
  }

  function setupUatMiniLeague(options = {}, adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const opts = options && typeof options === 'object' ? options : {};
    const targetLeague = String(opts.leagueId || 'L3').toUpperCase().trim() || 'L3';
    ensureLeaguesStructure(state);
    ensureSingleLeagueExists(state, targetLeague, true);
    if (state.leagues[targetLeague]) {
      state.leagues[targetLeague].enabled = true;
    }

    // Usuń poprzednie dane UAT przed ponownym utworzeniem czystej mini-ligi testowej
    const prevUatIds = {};
    (state.players || []).forEach((p) => {
      if (p && (p.isUatTester || String(p.id || '').indexOf('UAT_') === 0)) {
        prevUatIds[p.id] = true;
      }
    });
    state.players = (state.players || []).filter((p) => !p || !prevUatIds[p.id]);
    state.matches = (state.matches || []).filter(
      (m) => !m || (!m.isUatMatch && !prevUatIds[m.homeId] && !prevUatIds[m.awayId])
    );

    const testersSpec = [
      { id: 'UAT_SZYMON', name: 'Szymon Komenda (Test)', nick: 'SzymonUAT', username: 'uat_szymon', roleTag: 'Master Admin' },
      { id: 'UAT_KACPER', name: 'Kacper (Test)', nick: 'KacperUAT', username: 'uat_kacper', roleTag: 'Admin Ekstraklasy' },
      { id: 'UAT_ADRIAN', name: 'Adrian Baliński (Test)', nick: 'AdrianUAT', username: 'uat_adrian', roleTag: 'Tester PRO' },
      { id: 'UAT_GRZEGORZ', name: 'Grzegorz Grzegorzyca (Test)', nick: 'GrzegorzUAT', username: 'uat_grzegorz', roleTag: 'Tester Maszyn & UX' },
      { id: 'UAT_KRYSTIAN', name: 'Krystian Bujak (Test)', nick: 'KrystianUAT', username: 'uat_krystian', roleTag: 'Pierwszy Tester' }
    ];

    const creds = [];
    const baseOrder = (state.players || []).filter((p) => p && p.leagueId === targetLeague).length;
    const createdPlayers = [];

    testersSpec.forEach((spec, idx) => {
      const plainPass = generateReadablePassword();
      const avatar = window.SMPL_MEDIA && typeof window.SMPL_MEDIA.generatePlayerAvatar === 'function'
        ? window.SMPL_MEDIA.generatePlayerAvatar(spec.name, '', 88 + idx)
        : '';
      const playerObj = {
        id: spec.id,
        leagueId: targetLeague,
        excelOrder: baseOrder + idx,
        name: spec.name,
        nick: spec.nick,
        username: spec.username,
        passwordHash: hashSecret(plainPass),
        fb: 'https://m.me/',
        fbLink: 'https://m.me/',
        avatar: avatar,
        bio: 'Konto testowe UAT (' + spec.roleTag + ')',
        active: true,
        isUatTester: true,
        penaltyPoints: 0,
        penaltyReason: '',
        yellowCards: 0,
        redCards: 0,
        isSuspended: false,
        trophies: [],
        notifications: [],
        joinedSeason: state.season || 56,
        playedBefore: false
      };
      state.players.push(playerObj);
      createdPlayers.push(playerObj);
      creds.push({
        name: spec.name,
        role: spec.roleTag,
        username: spec.username,
        password: plainPass,
        leagueId: targetLeague
      });
    });

    const roundMatches = window.SMPL_ENGINE.generateRoundRobinSchedule(
      createdPlayers,
      targetLeague,
      [],
      false
    ).map((m) => {
      m.isUatMatch = true;
      return m;
    });

    // Opcjonalny 1 przykładowy wynik zatwierdzony + 1 oczekujący dla testu widoku tabeli/statystyk
    if (opts.seedSampleResults && roundMatches.length >= 2) {
      const m0 = roundMatches[0];
      m0.status = 'APPROVED';
      m0.homeScore = 2;
      m0.awayScore = 1;
      m0.submittedBy = createdPlayers[0].name;
      m0.submittedAt = nowFormatted();
      m0.approvedBy = adminName;
      m0.approvedAt = nowFormatted();
      m0.comment = 'Przykładowy mecz testowy UAT (2:1)';

      const m1 = roundMatches[1];
      m1.status = 'APPROVED';
      m1.homeScore = 2;
      m1.awayScore = 0;
      m1.submittedBy = createdPlayers[2].name;
      m1.submittedAt = nowFormatted();
      m1.approvedBy = adminName;
      m1.approvedAt = nowFormatted();
      m1.comment = 'Przykładowy mecz testowy UAT (2:0 + Czyste Konto)';
    }

    state.matches = (state.matches || []).concat(roundMatches);
    const maxR = roundMatches.reduce((acc, m) => Math.max(acc, Number(m.round || 1)), 1);
    if (state.leagues[targetLeague]) {
      state.leagues[targetLeague].totalRounds = Math.max(Number(state.leagues[targetLeague].totalRounds || 0), maxR);
    }

    addLog(
      'UAT_MINILEAGUE_SETUP',
      `🧪 Admin ${adminName} uruchomił 5-osobową Mini-Ligę Testową UAT w ${targetLeague} (${roundMatches.length} meczów, ${maxR} kolejek).`
    );
    syncToBackend();
    return { leagueId: targetLeague, credentials: creds, matchesCount: roundMatches.length, roundsCount: maxR };
  }

  function cleanupUatMiniLeague(adminName = 'Szymon Komenda') {
    assertAdminAuthenticated();
    const uatIds = {};
    let removedPlayers = 0;
    let removedMatches = 0;

    state.players = (state.players || []).filter((p) => {
      const isUat = p && (p.isUatTester || String(p.id || '').indexOf('UAT_') === 0);
      if (isUat) {
        uatIds[p.id] = true;
        removedPlayers++;
        return false;
      }
      return true;
    });

    state.matches = (state.matches || []).filter((m) => {
      const isUatM = m && (m.isUatMatch || uatIds[m.homeId] || uatIds[m.awayId]);
      if (isUatM) {
        removedMatches++;
        return false;
      }
      return true;
    });

    addLog(
      'UAT_MINILEAGUE_CLEAN',
      `🧹 Admin ${adminName} usunął dane testowe UAT (${removedPlayers} kont testowych, ${removedMatches} meczów testowych).`
    );
    syncToBackend();
    return { removedPlayers, removedMatches };
  }

  function getServerAuthHeaders() {
    const sess = getSession();
    const h = {};
    const admTok = isStrictAdminSession(sess) ? (serverAdminTokenCache || (sess && sess.serverAdminToken) || '') : '';
    const plTok = serverPlayerTokenCache || (sess && sess.serverPlayerToken) || '';
    if (admTok) h['X-SMPL-Admin-Token'] = String(admTok);
    if (plTok) h['X-SMPL-Player-Token'] = String(plTok);
    return h;
  }

  return {
    getAiStatus,
    getAiStatusCached,
    getAiGeminiConfig,
    saveAiGeminiConfig,
    testAiGeminiConnection,
    askVanessaGemini,
    logAiInteraction,
    recordAiFeedback,
    adminTeachAiAnswer,
    adminDismissAiQueueItem,
    adminDeleteAiKnowledge,
    detectToxicity,
    applyDisciplinaryAction,
    dismissModerationIncident,
    deleteFlaggedMessageAndIncident,
    pardonPlayerDiscipline,
    broadcastRoundRelease,
    init,
    getState,
    pullFromServer,
    pullIfStale,
    isBackendOnline,
    hashSecret,
    detectLinkMode,
    getSession,
    isStrictAdminSession,
    getServerAuthHeaders,
    saveSession,
    authenticateAdmin,
    logoutAdmin,
    updateMyAdminCredentials,
    updateMyPlayerPassword,
    sanitizeProfileBio,
    validateProfileAvatar,
    getOwnProfileSubject,
    updateOwnProfile,
    setOwnVacation,
    generateReadablePassword,
    masterGrantAdminDirect,
    submitAdminApplication,
    approveAdminApplication,
    rejectOrRevokeAdmin,
    isValidLeagueGoalPair,
    findCompanionReturnMatch,
    resolveMatchSubmissionPair,
    submitMatchResult,
    submitDoubleMatchResult,
    approveMatch,
    approveDoubleMatch,
    editMatchByAdmin,
    rejectMatch,
    setWalkover,
    submitRegistration,
    assignRegistration,
    approveRegistrationAccount,
    approveAllPendingToPool,
    assignHistoricalStatsToPlayer,
    getHistoricalPlayersCatalog,
    getAddPlayerCandidates,
    adminAddCandidateToLeague,
    findAdminForPlayer,
    findPlayerForAdmin,
    getSeasonJoinWindowInfo,
    setSeasonJoinWindow,
    adminJoinOrLeaveLeague,
    playerJoinLeague,
    playerLeaveLeague,
    rejectRegistration,
    loginPlayer,
    unlockGateAsGuest,
    lockGate,
    requestPasswordReminder,
    adminSendPasswordReminder,
    adminResetPlayerPassword,
    awardTrophyToPlayer,
    archiveCurrentSeason,
    getGoldenBallVoteStatus,
    castGoldenBallVote,
    adminAwardGoldenBallWinner,
    ensureCompetitionsStructure,
    submitTyperPrediction,
    nominatePuskasGoal,
    votePuskasGoal,
    generateLeagueCupBracket,
    recordCupMatchResult,
    clearCupBracket,
    adminAwardCompetitionTrophy,
    masterManageCompetitions,
    getMaintenanceMode,
    setMaintenanceMode,
    proposeMatchTime,
    respondMatchProposal,
    submitMatchDispute,
    resolveMatchDispute,
    voteFanPoll,
    buyShopItem,
    equipShopItem,
    claimShopQuest,
    sendShopGift,
    addSmplTvClip,
    setSmplTvLiveStream,
    awardWeeklyTotw,
    generatePlayoffTies,
    updatePlayoffLegResult,
    generateSupercupBracket,
    updateSupercupMatch,
    generateBlitzBracket,
    updateBlitzMatch,
    replacePlayerMidSeason,
    generateDraftBuckets,
    commitDraftAssignments,
    saveNewsletterEntry,
    fetchWebhooksConfig,
    saveWebhooksConfig,
    testWebhooks,
    broadcastWebhook,
    fetchSnapshotsList,
    restoreServerSnapshot,
    verifyMatchScreenshotAI,
    setCurrentWeek,
    deletePlayerAccountGDPR,
    updatePlayer,
    deductPlayerPoints,
    toCleanUsername,
    adminManualRegisterPlayer,
    addDirectPlayer,
    clearAllTablesForFreshSeason56,
    clearSingleLeague,
    movePlayerToLeague,
    deletePlayer,
    startFreshSeason56,
    startNextSeasonRollover,
    restoreExcelSeason55State,
    clearLeagueSchedule,
    generateLeagueSchedule,
    addByeSlotPlayer,
    adminRecalculateAllHistoricalStats,
    findPlayerS55Record,
    canonicalArchiveName,
    findArchiveEntryByName,
    setCustomCrest,
    getLeagueNumber,
    getDefaultLeaguePreset,
    ensureLeaguesStructure,
    isLeagueEnabled,
    getLeaguesList,
    getActiveLeagueIds,
    getNextLeagueSuggestion,
    isLeagueChannelId,
    adminCreateOrEnableLeague,
    adminToggleLeagueEnabled,
    ensureClansStructure,
    getClansList,
    getClanById,
    resolveClanLogo,
    registerOrFindClan,
    masterSaveCustomRank,
    masterDeleteCustomRank,
    masterAssignRankToPlayer,
    masterUpdatePortalSettings,
    getSupportConfig,
    masterUpdateSupportConfig,
    masterAddSupporterEntry,
    masterRemoveSupporterEntry,
    masterGrantPlayerCoins,
    masterSaveClan,
    masterDeleteClan,
    masterUpdateLeague,
    masterManageGoldenBall,
    masterImportDatabaseJson,
    publishPlayerUpdate,
    deletePlayerUpdate,
    getPlayerChatSanctionStatus,
    setPlayerChatSanction,
    canUserAccessChatChannel,
    getVisibleChatChannelsForSession,
    sendChatMessage,
    sendDirectMessage,
    deleteChatMessage,
    deleteDirectMessage,
    markDirectMessagesAsRead,
    getUnreadDirectMessagesCount,
    getDirectMessagesBetween,
    getDirectConversationsForUser,
    pushPlayerNotification,
    markAllNotificationsRead,
    clearPlayerNotifications,
    getBlacklist,
    isUserBlacklisted,
    addToBlacklist,
    removeFromBlacklist,
    setupUatMiniLeague,
    cleanupUatMiniLeague,
    resetDatabaseToSeed
  };
})();
