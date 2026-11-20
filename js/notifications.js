/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * Moduł Powiadomień Web Push, PWA (Instalacja na telefonie) i Syntetyzatora Dźwięków Web Audio API
 * Działa w 100% OFFLINE — Zero zewnętrznych plików audio!
 */

window.SMPL_NOTIF = (function () {
  let swRegistration = null;
  let deferredPrompt = null;
  let audioCtx = null;
  let soundEnabled = true;
  let notificationsEnabled = true;
  let vapidPublicKeyCache = '';
  let vapidSupportedCache = null;
  let pushSubscribedCache = false;
  let lastPushEndpoint = '';

  try {
    const saved = localStorage.getItem('smpl_sound_enabled');
    if (saved !== null) {
      soundEnabled = saved !== 'false';
    }
    const savedNotif = localStorage.getItem('smpl_notifications_enabled');
    if (savedNotif !== null) {
      notificationsEnabled = savedNotif !== 'false';
    }
  } catch (e) {}

  function isHttpOriginNow() {
    try {
      return typeof window !== 'undefined' && window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:') && typeof fetch === 'function';
    } catch (e) {
      return false;
    }
  }

  function resolvedThenable(val) {
    try {
      if (typeof Promise !== 'undefined' && Promise && typeof Promise.resolve === 'function') {
        const p = Promise.resolve(val);
        if (p && typeof p.then === 'function') return p;
      }
    } catch (e) {}
    return {
      then: function (fn) { return resolvedThenable(typeof fn === 'function' ? fn(val) : val); },
      'catch': function () { return this; }
    };
  }

  function getIosPushDiagnostic() {
    const ua = typeof navigator !== 'undefined' && navigator.userAgent ? String(navigator.userAgent) : '';
    const plat = typeof navigator !== 'undefined' && navigator.platform ? String(navigator.platform) : '';
    const maxTp = typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
    const isIos = /iPad|iPhone|iPod/i.test(ua) || (plat === 'MacIntel' && maxTp > 1);
    const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Messenger|WhatsApp|Snapchat|Line|MicroMessenger|TikTok/i.test(ua);
    let isStandalone = false;
    try {
      isStandalone = Boolean(
        (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
        (typeof navigator !== 'undefined' && navigator.standalone === true)
      );
    } catch (e) {}
    let isHttps = true;
    try {
      if (typeof window !== 'undefined' && window.location) {
        const p = window.location.protocol;
        const h = window.location.hostname;
        isHttps = (p === 'https:' || h === 'localhost' || h === '127.0.0.1');
      }
    } catch (e) {}
    const hasNotification = typeof Notification !== 'undefined';
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasPushManager = hasServiceWorker && typeof window !== 'undefined' && 'PushManager' in window;
    const permission = hasNotification ? (Notification.permission || 'default') : 'unsupported';
    const needsIosHomeScreen = isIos && !isStandalone;
    return {
      isIos,
      isInAppBrowser,
      isStandalone,
      isHttps,
      hasNotification,
      hasServiceWorker,
      hasPushManager,
      permission,
      needsIosHomeScreen,
      needsHttps: !isHttps,
      canPromptPushNow: hasNotification && permission !== 'denied' && isHttps,
      serverPushSupported: vapidSupportedCache,
      pushSubscribed: pushSubscribedCache
    };
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (String(base64String || '').length % 4)) % 4);
    const base64 = (String(base64String || '') + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = typeof atob === 'function' ? atob(base64) : '';
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function buildPushAuthHeaders() {
    const base = { 'Content-Type': 'application/json' };
    try {
      if (window.SMPL_DB && typeof window.SMPL_DB.getServerAuthHeaders === 'function') {
        Object.assign(base, window.SMPL_DB.getServerAuthHeaders() || {});
      }
    } catch (e) {}
    return base;
  }

  function postPushApiAction(action, bodyObj) {
    if (!isHttpOriginNow()) return resolvedThenable({ ok: false, offline: true });
    const bodyStr = JSON.stringify(bodyObj || {});
    const headers = buildPushAuthHeaders();
    const ep1 = './api.php?action=' + encodeURIComponent(action);
    const ep2 = './api/state?action=' + encodeURIComponent(action);
    return fetch(ep1, { method: 'POST', headers, body: bodyStr })
      .then((res) => (res && (res.status === 404 || res.status === 405 || res.status === 501) ? fetch(ep2, { method: 'POST', headers, body: bodyStr }) : res))
      .catch(() => fetch(ep2, { method: 'POST', headers, body: bodyStr }))
      .then((res) => (res ? res.json().catch(() => ({ ok: res.ok })) : { ok: false }))
      .catch((err) => ({ ok: false, error: err && err.message ? err.message : 'network_error' }));
  }

  function fetchVapidPublicKey() {
    if (!isHttpOriginNow()) return resolvedThenable('');
    if (vapidPublicKeyCache) return resolvedThenable(vapidPublicKeyCache);
    return fetch('./api.php?action=push_public_key', { method: 'GET', cache: 'no-store' })
      .then((res) => (res && res.ok ? res : fetch('./api/state?action=push_public_key', { method: 'GET', cache: 'no-store' })))
      .catch(() => fetch('./api/state?action=push_public_key', { method: 'GET', cache: 'no-store' }))
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.supported === true && data.publicKey) {
          vapidSupportedCache = true;
          vapidPublicKeyCache = String(data.publicKey);
          return vapidPublicKeyCache;
        }
        vapidSupportedCache = false;
        return '';
      })
      .catch(() => '');
  }

  function buildPushContextPayload() {
    const diag = getIosPushDiagnostic();
    let leagueId = '';
    try {
      if (window.SMPL_DB && typeof window.SMPL_DB.getSession === 'function' && typeof window.SMPL_DB.getState === 'function') {
        const sess = window.SMPL_DB.getSession();
        const st = window.SMPL_DB.getState();
        const pid = sess && !sess.isGuest ? sess.activePlayerId : null;
        if (pid && st && Array.isArray(st.players)) {
          const pl = st.players.find((p) => p && String(p.id) === String(pid));
          if (pl && pl.leagueId) leagueId = String(pl.leagueId);
        }
      }
    } catch (e) {}
    return {
      leagueId: leagueId,
      muted: !notificationsEnabled,
      isIos: diag.isIos,
      standalone: diag.isStandalone
    };
  }

  function ensurePushSubscribed(opts = {}) {
    if (!isHttpOriginNow()) return resolvedThenable({ ok: false, reason: 'NOT_HTTP' });
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return resolvedThenable({ ok: false, reason: 'NO_SW' });
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return resolvedThenable({ ok: false, reason: 'PERMISSION_NOT_GRANTED' });
    }
    const getRegPromise = () => {
      if (swRegistration && swRegistration.pushManager) return resolvedThenable(swRegistration);
      if (navigator.serviceWorker.ready && typeof navigator.serviceWorker.ready.then === 'function') {
        return navigator.serviceWorker.ready.then((r) => {
          if (r) swRegistration = r;
          return r;
        });
      }
      return resolvedThenable(swRegistration);
    };
    return getRegPromise()
      .then((reg) => {
        if (!reg || !reg.pushManager || typeof reg.pushManager.getSubscription !== 'function') {
          return { ok: false, reason: 'NO_PUSH_MANAGER' };
        }
        return reg.pushManager.getSubscription().then((existingSub) => {
          if (existingSub || !opts.subscribeIfMissing) {
            return existingSub;
          }
          return fetchVapidPublicKey().then((pubKey) => {
            if (!pubKey) return null;
            return reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(pubKey)
            });
          });
        });
      })
      .then((sub) => {
        if (!sub) {
          pushSubscribedCache = false;
          return { ok: false, reason: opts.subscribeIfMissing ? 'VAPID_OR_SUBSCRIBE_UNAVAILABLE' : 'NOT_SUBSCRIBED' };
        }
        lastPushEndpoint = sub.endpoint || '';
        pushSubscribedCache = true;
        const subJson = typeof sub.toJSON === 'function' ? sub.toJSON() : { endpoint: sub.endpoint, keys: {} };
        const ctxPayload = Object.assign({ subscription: subJson }, buildPushContextPayload());
        return postPushApiAction('push_subscribe', ctxPayload).then((res) =>
          Object.assign({ ok: Boolean(res && res.ok !== false), subscription: subJson }, res || {})
        );
      })
      .catch((err) => ({ ok: false, reason: 'SUBSCRIBE_ERROR', error: err && err.message ? err.message : String(err) }));
  }

  function syncPushSubscriptionContext() {
    if (!isHttpOriginNow()) return resolvedThenable(false);
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return resolvedThenable(false);
    const p = ensurePushSubscribed({ subscribeIfMissing: notificationsEnabled });
    return p && typeof p.catch === 'function' ? p.catch(() => false) : resolvedThenable(false);
  }

  function syncNotifPrefToServiceWorker(enabled) {
    const val = enabled !== false;
    try {
      if (typeof caches !== 'undefined' && typeof caches.open === 'function' && typeof Response !== 'undefined') {
        caches
          .open('smpl-prefs-v1')
          .then((cache) => cache.put('./__smpl_notif_pref', new Response(val ? 'on' : 'off')))
          .catch(() => {});
      }
      if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.controller && typeof navigator.serviceWorker.controller.postMessage === 'function') {
        navigator.serviceWorker.controller.postMessage({ type: 'SMPL_SET_NOTIF_PREF', enabled: val });
      }
      if (lastPushEndpoint && isHttpOriginNow()) {
        postPushApiAction('push_set_muted', { endpoint: lastPushEndpoint, muted: !val });
      }
    } catch (e) {}
  }

  function isNotificationsEnabled() {
    return notificationsEnabled;
  }

  function setNotificationsEnabled(enabled, opts = {}) {
    notificationsEnabled = Boolean(enabled);
    try {
      localStorage.setItem('smpl_notifications_enabled', notificationsEnabled ? 'true' : 'false');
    } catch (e) {}
    syncNotifPrefToServiceWorker(notificationsEnabled);

    if (!opts || !opts.silent) {
      if (notificationsEnabled) {
        if (soundEnabled) playChatChime();
        if (window.SMPL_APP && window.SMPL_APP.showToast) {
          const pushGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
          window.SMPL_APP.showToast(
            pushGranted
              ? '🔔 Powiadomienia na telefonie i laptopie: WŁĄCZONE'
              : '🔔 Powiadomienia w aplikacji: WŁĄCZONE (kliknij Aktywuj PUSH, aby dostawać też poza kartą)',
            'success'
          );
        }
      } else if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('🔕 Powiadomienia na telefonie i laptopie: WYŁĄCZONE (koniec ze spamem)', 'info');
      }
    }
    return notificationsEnabled;
  }

  function toggleNotifications() {
    return setNotificationsEnabled(!notificationsEnabled);
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function isSoundEnabled() {
    return soundEnabled;
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try {
      localStorage.setItem('smpl_sound_enabled', soundEnabled ? 'true' : 'false');
    } catch (e) {}

    if (soundEnabled) {
      playChatChime();
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('🔊 Dźwięki aplikacji i powiadomień: WŁĄCZONE', 'success');
      }
    } else {
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('🔇 Dźwięki: WYCISZONE', 'info');
      }
    }
    return soundEnabled;
  }

  // 1. Gwizdek sędziowski (Whistle) — dynamiczny podwójny świst sędziego piłkarskiego
  function playWhistleSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      function blast(startTime, duration) {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        // Modulacja kulki gwizdka (32 Hz vibrato)
        lfo.frequency.setValueAtTime(32, startTime);
        lfoGain.gain.setValueAtTime(120, startTime);
        lfo.connect(osc1.frequency);
        lfo.connect(osc2.frequency);

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(2450, startTime);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(2880, startTime);

        gain1.gain.setValueAtTime(0.001, startTime);
        gain1.gain.exponentialRampToValueAtTime(0.2, startTime + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        gain2.gain.setValueAtTime(0.001, startTime);
        gain2.gain.exponentialRampToValueAtTime(0.14, startTime + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(ctx.destination);
        gain2.connect(ctx.destination);

        lfo.start(startTime);
        osc1.start(startTime);
        osc2.start(startTime);

        lfo.stop(startTime + duration);
        osc1.stop(startTime + duration);
        osc2.stop(startTime + duration);
      }

      // Krótki gwizd, krótka pauza, dłuższy finałowy gwizd
      blast(now, 0.14);
      blast(now + 0.18, 0.32);
    } catch (e) {
      console.warn('Audio synthesis skipped:', e);
    }
  }

  // 2. Krystaliczny dzwonek czatu (Chat Chime) — subtelny, nowoczesny dwuton
  function playChatChime() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      function tone(freq, start, dur, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }

      tone(880, now, 0.25, 0.15);            // A5
      tone(1318.5, now + 0.08, 0.38, 0.12);   // E6
    } catch (e) {}
  }

  // 3. Uderzenie Młotka Trybunału Dyscyplinarnego (Gavel Sound)
  function playGavelSound() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      function gavel(start) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, start);
        osc.frequency.exponentialRampToValueAtTime(45, start + 0.14);
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.15);

        // Trzask drewna
        const snap = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snap.type = 'triangle';
        snap.frequency.setValueAtTime(520, start);
        snap.frequency.exponentialRampToValueAtTime(90, start + 0.04);
        snapGain.gain.setValueAtTime(0.18, start);
        snapGain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
        snap.connect(snapGain);
        snapGain.connect(ctx.destination);
        snap.start(start);
        snap.stop(start + 0.04);
      }

      gavel(now);
      gavel(now + 0.2);
    } catch (e) {}
  }

  // 4. Sygnał triumfu / sukcesu (Success Arpeggio)
  function playSuccessChime() {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch (e) {}
  }

  function playShopSound(soundId, forcePreview) {
    if (!forcePreview && !soundEnabled) return false;
    var key = String(soundId || 'default').replace(/^sound_/, '');
    if (!key || key === 'default') return false;
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;
      const now = ctx.currentTime;

      function synth(freq, startOffset, dur, vol, waveType, endFreq) {
        const start = now + startOffset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = waveType || 'sine';
        osc.frequency.setValueAtTime(freq, start);
        if (endFreq && endFreq > 0) {
          osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
        }
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(vol || 0.12, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }

      if (key === 'arcade_levelup') {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
          synth(f, i * 0.06, 0.14, 0.08, 'square');
        });
      } else if (key === 'fanfare') {
        synth(523.25, 0, 0.14, 0.13, 'triangle');
        synth(659.25, 0.12, 0.14, 0.13, 'triangle');
        synth(783.99, 0.24, 0.16, 0.14, 'triangle');
        synth(1046.5, 0.38, 0.42, 0.16, 'sawtooth');
        synth(523.25, 0.38, 0.42, 0.09, 'triangle');
      } else if (key === 'goal_horn') {
        synth(146.83, 0, 0.45, 0.14, 'sawtooth');
        synth(220.0, 0, 0.45, 0.11, 'sawtooth');
        synth(293.66, 0.04, 0.42, 0.07, 'triangle');
      } else if (key === 'laser_strike') {
        synth(1480, 0, 0.24, 0.13, 'sine', 220);
        synth(920, 0.09, 0.26, 0.09, 'triangle', 1760);
      } else if (key === 'champions_anthem') {
        [261.63, 329.63, 392.0, 523.25].forEach(function (f) {
          synth(f, 0, 0.55, 0.08, 'triangle');
        });
        synth(659.25, 0.22, 0.45, 0.10, 'sine');
      } else if (key === 'samurai_gong') {
        [110, 165, 277.18, 415.3].forEach(function (f, i) {
          synth(f, i * 0.015, 0.85, i === 0 ? 0.18 : 0.07, i % 2 === 0 ? 'sine' : 'triangle', f * 0.94);
        });
      } else {
        playSuccessChime();
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // 5. Generator Kodów Pokoju Score! Match (krótkie kody słowne BEZ cyfr i myślników — gra wymaga samych liter)
  const ROOM_WORD_CODES = [
    'DERBY', 'ARENA', 'KARNY', 'BRAMA', 'MISTRZ', 'PUCHAR', 'SOKOL', 'ORZEL',
    'TYGRYS', 'LIDER', 'RYWAL', 'TURBO', 'FUTBOL', 'STADION', 'STRZAL', 'REWANZ',
    'FINALE', 'PILKA', 'BOISKO', 'KORONA', 'OGIEN', 'ISKRA', 'BLYSK', 'PIORUN',
    'BURZA', 'TYTAN', 'GIGANT', 'SPARTA', 'OLIMP', 'SPARING', 'SZTURM', 'TRIUMF',
    'KLASA', 'GWIZD', 'SPRINT', 'SLUPEK', 'WRZUTA', 'LOBIK', 'BOMBA', 'ZLOTY',
    'SREBRO', 'BRAMKA', 'NAPAD', 'OBRONA', 'POMOC', 'KIBIC', 'ELITA', 'HONOR',
    'GLORIA', 'BONUS', 'TEMPO', 'FORMA', 'AWANS', 'WIKTOR', 'SMOKI', 'WILKI',
    'REKORD', 'GOLAZO', 'WALKA', 'SEZON', 'PASEK', 'TARCZA', 'LEGEND', 'PUNKTY',
    'MECZ', 'GRACZ', 'KADRA', 'SZALIK', 'ZASIEG', 'MOCNY', 'SZYBKI', 'WYGRANA'
  ];
  let lastGeneratedRoomCode = '';

  function sanitizeScoreMatchRoomCode(rawCode) {
    return String(rawCode == null ? '' : rawCode)
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 12);
  }

  function generateScoreMatchRoomCode() {
    let picked = ROOM_WORD_CODES[Math.floor(Math.random() * ROOM_WORD_CODES.length)];
    if (picked === lastGeneratedRoomCode && ROOM_WORD_CODES.length > 1) {
      const idx = ROOM_WORD_CODES.indexOf(picked);
      picked = ROOM_WORD_CODES[(idx + 1 + Math.floor(Math.random() * (ROOM_WORD_CODES.length - 1))) % ROOM_WORD_CODES.length];
    }
    lastGeneratedRoomCode = picked;
    return picked;
  }

  // 6. Bezpieczne kopiowanie do schowka
  async function copyToClipboard(text, successMsg = 'Skopiowano kod do schowka!') {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast(`📋 ${successMsg}`, 'success');
      }
      playChatChime();
      return true;
    } catch (err) {
      console.warn('Clipboard copy error:', err);
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast(`Twój kod pokoju: ${text}`, 'info');
      }
      return false;
    }
  }

  function init() {
    syncNotifPrefToServiceWorker(notificationsEnabled);
    const diag = getIosPushDiagnostic();
    if (isHttpOriginNow()) {
      const vp = fetchVapidPublicKey();
      if (vp && typeof vp.catch === 'function') vp.catch(() => '');
    }

    // 1. Rejestracja Service Workera dla PWA i Powiadomień
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then((reg) => {
          swRegistration = reg;
          if (reg && typeof reg.update === 'function') reg.update().catch(() => {});
          syncNotifPrefToServiceWorker(notificationsEnabled);
          console.log('[SMPL PWA] ServiceWorker zarejestrowany pomyślnie:', reg.scope);
        })
        .catch((err) => {
          console.warn('[SMPL PWA] Błąd rejestracji ServiceWorkera:', err);
        });
      if (navigator.serviceWorker.ready && typeof navigator.serviceWorker.ready.then === 'function') {
        navigator.serviceWorker.ready
          .then((readyReg) => {
            if (readyReg) swRegistration = readyReg;
            syncNotifPrefToServiceWorker(notificationsEnabled);
            if (notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              const ep = ensurePushSubscribed({ subscribeIfMissing: true });
              if (ep && typeof ep.catch === 'function') ep.catch(() => {});
            }
          })
          .catch(() => {});
      }
      if (typeof navigator.serviceWorker.addEventListener === 'function') {
        navigator.serviceWorker.addEventListener('message', (event) => {
          const msg = event && event.data;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'SMPL_PUSH_RECEIVED' || msg.type === 'SMPL_NOTIF_CLICKED') {
            if (window.SMPL_DB && typeof window.SMPL_DB.pullIfStale === 'function') {
              window.SMPL_DB.pullIfStale(300);
            }
          }
          if (msg.type === 'SMPL_NOTIF_CLICKED' && msg.tab && window.SMPL_APP && typeof window.SMPL_APP.switchTab === 'function') {
            window.SMPL_APP.switchTab(String(msg.tab));
          }
        });
      }
    }

    // Odblokowanie kontekstu audio po pierwszym dotknięciu ekranu
    const unlockAudio = () => {
      getAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    // Na iPhone (iOS Safari) beforeinstallprompt nie istnieje — pokaż baner wskazujący "Dodaj do ekranu początkowego"
    if (diag.needsIosHomeScreen) {
      try {
        if (localStorage.getItem('smpl_install_banner_dismissed') !== 'true') {
          const banner = document.getElementById('pwa-install-banner');
          if (banner) {
            const subTxt = banner.querySelector('span');
            if (subTxt) {
              subTxt.textContent = diag.isInAppBrowser
                ? 'Otwórz w Safari, kliknij Udostępnij ⬆️ → Dodaj do ekranu początkowego, aby dostawać PUSH na iPhone!'
                : 'Na iPhone kliknij Udostępnij ⬆️ → Dodaj do ekranu początkowego, aby włączyć powiadomienia PUSH!';
              subTxt.className = 'text-[11px] text-blue-100 block';
            }
            banner.style.display = 'flex';
          }
        }
      } catch (e) {}
    }

    // 2. Przechwycenie zdarzenia instalacji na telefonie (PWA Install Banner — Android/Desktop)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      try {
        if (localStorage.getItem('smpl_install_banner_dismissed') === 'true') return;
      } catch (err) {}
      const banner = document.getElementById('pwa-install-banner');
      if (banner) {
        banner.style.display = 'flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'none';
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('🎉 Aplikacja SMPL została zainstalowana na Twoim telefonie!', 'success');
      }
      playSuccessChime();
    });
  }

  function promptInstall() {
    const diag = getIosPushDiagnostic();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[SMPL PWA] Użytkownik zaakceptował instalację aplikacji');
        }
        deferredPrompt = null;
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.style.display = 'none';
      });
    } else if (diag.isIos && !diag.isStandalone && window.SMPL_APP && typeof window.SMPL_APP.openIosInstallGuideModal === 'function') {
      window.SMPL_APP.openIosInstallGuideModal();
    } else {
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('Aby zainstalować SMPL na telefonie: w Safari na iOS kliknij Udostępnij ⬆️ → "Dodaj do ekranu początkowego" (na Androidzie menu ⋮ → Zainstaluj aplikację).', 'info');
      }
    }
  }

  function dismissInstallBanner() {
    try {
      localStorage.setItem('smpl_install_banner_dismissed', 'true');
    } catch (e) {}
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.style.display = 'none';
  }

  async function requestNotificationPermission() {
    const diag = getIosPushDiagnostic();
    if (diag.needsHttps && diag.isIos) {
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('⚠️ Na iPhone powiadomienia PUSH wymagają połączenia HTTPS z serwerem WWW.', 'warning');
      }
      return false;
    }
    if (diag.needsIosHomeScreen && !diag.hasNotification) {
      if (window.SMPL_APP && typeof window.SMPL_APP.openIosInstallGuideModal === 'function') {
        window.SMPL_APP.openIosInstallGuideModal();
      } else if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('📲 Na iPhone najpierw dodaj portal do Ekranu początkowego (Udostępnij ⬆️ → Dodaj do ekranu początkowego), otwórz ikonę z pulpitu i tam kliknij Aktywuj PUSH!', 'info');
      }
      return false;
    }
    if (!diag.hasNotification) {
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('Twoja przeglądarka nie obsługuje powiadomień systemowych.', 'error');
      }
      return false;
    }

    try {
      // KRYTYCZNE na iOS Safari PWA: Notification.requestPermission() musi zostać wywołane natychmiast w geście kliknięcia!
      let perm = Notification.permission;
      if (perm !== 'granted' && perm !== 'denied') {
        perm = await Notification.requestPermission();
      }
      setNotificationsEnabled(true, { silent: true });

      if (perm === 'granted') {
        const subRes = await ensurePushSubscribed({ subscribeIfMissing: true });
        sendLocalNotification('🔔 Powiadomienia SMPL Aktywne!', {
          body: subRes && subRes.ok
            ? 'Twój telefon jest zapisany do powiadomień PUSH (nawet gdy aplikacja jest zamknięta)!'
            : 'Otrzymasz alert, gdy przeciwnik wstawi wynik, Admin zatwierdzi mecz lub pojawi się wiadomość!',
          force: true
        });
        playSuccessChime();
        if (window.SMPL_APP && window.SMPL_APP.showToast) {
          window.SMPL_APP.showToast(
            subRes && subRes.ok
              ? '✅ Powiadomienia i Web Push na telefonie są włączone!'
              : '✅ Zezwolono na powiadomienia systemowe!' + (subRes && subRes.reason ? '' : ''),
            'success'
          );
        }
        return true;
      } else {
        if (window.SMPL_APP && window.SMPL_APP.showToast) {
          window.SMPL_APP.showToast(
            diag.isIos
              ? '🔕 Powiadomienia zostały zablokowane na iPhone. Włącz je w: Ustawienia iPhone → Powiadomienia → Score Match Liga.'
              : 'Powiadomienia systemowe zostały zablokowane w ustawieniach przeglądarki.',
            'info'
          );
        }
        return false;
      }
    } catch (err) {
      console.error('Błąd zapytania o uprawnienia powiadomień:', err);
      return false;
    }
  }

  async function sendServerPushTest() {
    const diag = getIosPushDiagnostic();
    if (diag.needsIosHomeScreen && !diag.hasNotification) {
      if (window.SMPL_APP && typeof window.SMPL_APP.openIosInstallGuideModal === 'function') {
        window.SMPL_APP.openIosInstallGuideModal();
      }
      return { ok: false, reason: 'IOS_NEEDS_HOME_SCREEN' };
    }
    const permOk = await requestNotificationPermission();
    if (!permOk) return { ok: false, reason: 'NO_PERMISSION' };
    const subRes = await ensurePushSubscribed({ subscribeIfMissing: true });
    if (!subRes || !subRes.ok) {
      return subRes || { ok: false, reason: 'SUBSCRIBE_FAILED' };
    }
    const res = await postPushApiAction('push_test', Object.assign({ endpoint: lastPushEndpoint }, buildPushContextPayload()));
    if (res && res.ok && res.sent > 0) {
      if (window.SMPL_APP && window.SMPL_APP.showToast) {
        window.SMPL_APP.showToast('📲 Wysłano testowy PUSH z serwera na ten telefon (Apple/Google HTTP 201)!', 'success');
      }
    } else if (window.SMPL_APP && window.SMPL_APP.showToast) {
      window.SMPL_APP.showToast('⚠️ ' + ((res && res.error) || 'Test PUSH nie został wysłany (' + ((res && res.errors && res.errors[0]) || 'sprawdź HTTPS / OpenSSL na serwerze') + ').'), 'warning');
    }
    return res || { ok: false };
  }

  function showForegroundToastIfVisible(title, body, toastType) {
    if (!notificationsEnabled) return;
    const hasPush = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (hasPush && typeof document !== 'undefined' && document.visibilityState === 'visible' && window.SMPL_APP && window.SMPL_APP.showToast) {
      window.SMPL_APP.showToast(`${title}${body ? ' — ' + body : ''}`, toastType || 'info');
    }
  }

  function sendLocalNotification(title, options = {}) {
    const opts = options || {};
    if (!notificationsEnabled && !opts.force) {
      return false;
    }
    const defaultOptions = Object.assign(
      {
        icon: './css/icon-192.png',
        badge: './css/icon-192.png',
        vibrate: [200, 100, 200],
        renotify: true
      },
      opts,
      {
        data: Object.assign({ url: './index.html#schedule', tab: 'schedule' }, opts.data || {})
      }
    );

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 60, 150]);
      } catch (e) {}
    }

    const fallbackDesktop = () => {
      try {
        const n = new Notification(title, defaultOptions);
        if (n && typeof n.onclick === 'undefined') return;
        n.onclick = () => {
          try { window.focus(); } catch (e) {}
          if (window.SMPL_APP && typeof window.SMPL_APP.switchTab === 'function') {
            window.SMPL_APP.switchTab('schedule');
          }
          try { n.close(); } catch (e) {}
        };
      } catch (e) {
        if (window.SMPL_APP && window.SMPL_APP.showToast) {
          window.SMPL_APP.showToast(`${title}${opts.body ? ' — ' + opts.body : ''}`, opts.toastType || 'info');
        }
      }
    };

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      if (swRegistration && typeof swRegistration.showNotification === 'function') {
        try {
          const p = swRegistration.showNotification(title, defaultOptions);
          if (p && typeof p.catch === 'function') {
            p.catch(fallbackDesktop);
          }
          return true;
        } catch (err) {
          fallbackDesktop();
          return true;
        }
      }
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        if (navigator.serviceWorker.ready && typeof navigator.serviceWorker.ready.then === 'function') {
          navigator.serviceWorker.ready
            .then((readyReg) => {
              if (readyReg && typeof readyReg.showNotification === 'function') {
                swRegistration = readyReg;
                return readyReg.showNotification(title, defaultOptions);
              }
              fallbackDesktop();
            })
            .catch(fallbackDesktop);
          return true;
        }
        if (typeof navigator.serviceWorker.getRegistration === 'function') {
          navigator.serviceWorker
            .getRegistration()
            .then((reg) => {
              if (reg && typeof reg.showNotification === 'function') {
                swRegistration = reg;
                return reg.showNotification(title, defaultOptions);
              }
              fallbackDesktop();
            })
            .catch(fallbackDesktop);
          return true;
        }
      }
      fallbackDesktop();
      return true;
    } else if (window.SMPL_APP && window.SMPL_APP.showToast) {
      window.SMPL_APP.showToast(`${title}${opts.body ? ' — ' + opts.body : ''}`, opts.toastType || 'info');
    }
    return true;
  }

  // Uniwersalne powiadomienie konta gracza (mecz, akceptacja, nagroda, prezent, trofeum)
  function notifyPlayerEvent(notifObj) {
    if (!notificationsEnabled || !notifObj) return false;
    const t = String(notifObj.type || 'INFO').toUpperCase();
    const isCelebration = ['PRIZE', 'TROPHY', 'MATCH_APPROVED', 'SHOP_GIFT', 'SHOP_QUEST', 'TOTW', 'PLAYOFF_RES', 'ACCOUNT_APPROVED'].indexOf(t) !== -1;
    const isWarning = ['MATCH_REJECTED', 'WALKOVER', 'PENALTY', 'DISPUTE'].indexOf(t) !== -1;
    if (isCelebration) playSuccessChime();
    else if (isWarning) playGavelSound();
    else playChatChime();

    const iconPrefix = notifObj.icon ? (String(notifObj.title || '').indexOf(notifObj.icon) === 0 ? '' : (notifObj.icon + ' ')) : '';
    const title = iconPrefix + (notifObj.title || 'Nowe powiadomienie SMPL');
    const rawBody = String(notifObj.text || '');
    const shortBody = rawBody.length > 130 ? rawBody.substring(0, 127) + '...' : rawBody;
    const toastType = isCelebration ? 'success' : (isWarning ? 'warning' : 'info');
    const delivered = sendLocalNotification(title, {
      body: shortBody,
      tag: 'smpl-ev-' + (notifObj.id || Date.now()),
      toastType: toastType,
      renotify: true
    });
    showForegroundToastIfVisible(title, shortBody, toastType);
    return delivered;
  }

  // Powiadomienie: Puszczenie nowej kolejki przez Admina
  function notifyRoundReleased(roundNumber, weekNumber) {
    if (!notificationsEnabled) return false;
    playWhistleSound();
    const title = `⚽ Kolejka #${roundNumber} (Tydzień #${weekNumber}) wystartowała!`;
    const body = 'Administrator ligi puścił nową kolejkę! Zaloguj się, zaproś rywala i rozegraj mecz w Score! Match.';
    const ok = sendLocalNotification(title, {
      body,
      tag: `round-release-${roundNumber}`,
      toastType: 'success',
      renotify: true
    });
    showForegroundToastIfVisible(title, body, 'success');
    return ok;
  }

  // Powiadomienie: Nowa wiadomość na czacie ligowym / offtopic
  function notifyChatMessage(senderName, channelName, text) {
    if (!notificationsEnabled) return false;
    playChatChime();
    const title = `💬 [${channelName}] ${senderName}`;
    const body = text.length > 70 ? text.substring(0, 67) + '...' : text;
    const ok = sendLocalNotification(title, {
      body,
      tag: `chat-msg-${Date.now()}`
    });
    showForegroundToastIfVisible(title, body, 'info');
    return ok;
  }

  // Powiadomienie: Nowa wiadomość prywatna (Priv / DM)
  function notifyDirectMessage(senderName, text) {
    if (!notificationsEnabled) return false;
    playChatChime();
    const title = `✉️ Nowa wiadomość Priv od ${senderName}`;
    const body = text.length > 70 ? text.substring(0, 67) + '...' : text;
    const ok = sendLocalNotification(title, {
      body,
      tag: `dm-msg-${Date.now()}`,
      renotify: true
    });
    showForegroundToastIfVisible(title, body, 'info');
    return ok;
  }

  // Powiadomienie: Wyrok Trybunału Dyscyplinarnego
  function notifyTribunalVerdict(playerName, penaltyText) {
    if (!notificationsEnabled) return false;
    playGavelSound();
    const title = `⚖️ Decyzja Dyscyplinarna: ${playerName}`;
    const body = `Komisja Ligi nałożyła karę: ${penaltyText}. Sprawdź tabelę i komunikat zarządu.`;
    const ok = sendLocalNotification(title, {
      body,
      toastType: 'warning',
      tag: `tribunal-${Date.now()}`
    });
    showForegroundToastIfVisible(title, body, 'warning');
    return ok;
  }

  // Powiadomienie: Wzmianka / Oznaczenie gracza (@nick)
  function notifyMention(senderName, channelName, text) {
    if (!notificationsEnabled) return false;
    playChatChime();
    const title = `📣 ${senderName} oznaczył Cię na kanale [${channelName}]!`;
    const body = text.length > 70 ? text.substring(0, 67) + '...' : text;
    const ok = sendLocalNotification(title, {
      body,
      tag: `mention-${Date.now()}`,
      renotify: true
    });
    showForegroundToastIfVisible(title, body, 'info');
    return ok;
  }

  function getPermissionState() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission || 'default';
  }

  return {
    init,
    promptInstall,
    dismissInstallBanner,
    getIosPushDiagnostic,
    getPermissionState,
    requestNotificationPermission,
    ensurePushSubscribed,
    syncPushSubscriptionContext,
    sendServerPushTest,
    sendLocalNotification,
    notifyPlayerEvent,
    notifyRoundReleased,
    notifyChatMessage,
    notifyDirectMessage,
    notifyTribunalVerdict,
    notifyMention,
    isNotificationsEnabled,
    setNotificationsEnabled,
    toggleNotifications,
    // Synteza dźwięków i sterowanie
    playWhistleSound,
    playChatChime,
    playGavelSound,
    playSuccessChime,
    playShopSound,
    isSoundEnabled,
    toggleSound,
    // Pokoje Score! Match i schowek
    sanitizeScoreMatchRoomCode,
    generateScoreMatchRoomCode,
    copyToClipboard
  };
})();
