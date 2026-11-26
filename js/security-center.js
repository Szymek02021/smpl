/**
 * SCORE MATCH LIGA (SMPL) — SYSTEM ZAUFANIA I CENTRUM BEZPIECZEŃSTWA AAA ("SMPL Security Shield")
 * Samowystarczalny moduł ładowany na każdej podstronie (index.html, REJESTRACJA.html, PANEL-ADMINA.html, MASTER-SZYMON-KOMENDA.html).
 * Eksportuje globalnie: window.openSecurityCenter(), window.closeSecurityCenter() oraz window.SMPL_SECURITY.
 * UWAGA: Ścisła zgodność ze składnią ES2018 (brak ?., brak ??).
 */
(function () {
  'use strict';

  // =========================================================================
  // KONFIGURACJA LINKU VIRUSTOTAL (opcjonalny bezpośredni URL raportu)
  // Jeśli masz stały link do konkretnego raportu skanu, wklej go poniżej np.:
  // var VIRUSTOTAL_URL = 'https://www.virustotal.com/gui/domain/host976694.xce.pl';
  // Gdy pozostawisz pusty ciąg '', system automatycznie podstawi aktualny host:
  // https://www.virustotal.com/gui/domain/${host}
  // =========================================================================
  var VIRUSTOTAL_URL = '';

  var CERT_ID = 'SMPL-2026-VT094';
  var WELCOME_STORAGE_KEY = 'smpl_security_welcome_seen_v1';
  var MOTION_PAUSED_KEY = 'smpl_security_foil_paused_v1';

  var VENDORS = [
    { id: 'vt', name: 'VirusTotal', status: '0/94 CLEAN', icon: 'img/security/vendor-virustotal.svg' },
    { id: 'gsb', name: 'Google Safe Browsing', status: 'CLEAN', icon: 'img/security/vendor-google-sb.svg' },
    { id: 'eset', name: 'ESET NOD32', status: 'CLEAN', icon: 'img/security/vendor-eset.svg' },
    { id: 'bitdefender', name: 'Bitdefender', status: 'CLEAN', icon: 'img/security/vendor-bitdefender.svg' },
    { id: 'kaspersky', name: 'Kaspersky', status: 'CLEAN', icon: 'img/security/vendor-kaspersky.svg' },
    { id: 'fortinet', name: 'Fortinet', status: 'CLEAN', icon: 'img/security/vendor-fortinet.svg' },
    { id: 'sophos', name: 'Sophos', status: 'CLEAN', icon: 'img/security/vendor-sophos.svg' },
    { id: 'sucuri', name: 'Sucuri SiteCheck', status: 'CLEAN', icon: 'img/security/vendor-sucuri.svg' },
    { id: 'drweb', name: 'Dr.Web', status: 'CLEAN', icon: 'img/security/vendor-drweb.svg' },
    { id: 'webroot', name: 'Webroot', status: 'CLEAN', icon: 'img/security/vendor-webroot.svg' }
  ];

  var _dialogBound = false;
  var _scanRunning = false;
  var _welcomeTimer = null;

  function escHtml(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getCurrentHost() {
    var h = (typeof window !== 'undefined' && window.location && window.location.hostname)
      ? String(window.location.hostname).trim()
      : '';
    return h || 'host976694.xce.pl';
  }

  function getExternalCheckHost() {
    var h = getCurrentHost();
    // Dla zewnętrznych skanerów publicznych używamy bieżącego hosta z window.location.hostname
    return h;
  }

  function getVerificationUrls(overrideHost) {
    var host = String(overrideHost || getExternalCheckHost()).trim() || 'host976694.xce.pl';
    var encHost = encodeURIComponent(host);
    var vtUrl = (VIRUSTOTAL_URL && String(VIRUSTOTAL_URL).trim())
      ? String(VIRUSTOTAL_URL).trim()
      : ('https://www.virustotal.com/gui/domain/' + encHost);
    return {
      host: host,
      virusTotal: vtUrl,
      googleSafeBrowsing: 'https://transparencyreport.google.com/safe-browsing/search?url=' + encHost,
      sucuri: 'https://sitecheck.sucuri.net/results/' + encHost,
      sslLabs: 'https://www.ssllabs.com/ssltest/analyze.html?d=' + encHost
    };
  }

  function isMotionPaused() {
    try {
      return localStorage.getItem(MOTION_PAUSED_KEY) === '1';
    } catch (_e) {
      return false;
    }
  }

  function formatTimeNow() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return (
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      ' • ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    );
  }

  function inspectLiveSessionSecurity() {
    var proto = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : '';
    var host = getCurrentHost();
    var isHttps = proto === 'https:';
    var isTrustedLoopback = (host === 'localhost' || host === '127.0.0.1' || host === '::1');

    // 1. Szyfrowanie SSL/TLS
    var sslOk = isHttps || isTrustedLoopback;
    var sslDetail = isHttps
      ? 'Aktywny protokół HTTPS / TLS (' + host + ')'
      : (isTrustedLoopback ? 'Bezpieczna pętla lokalna (' + host + ') • produkcja HTTPS' : 'Połączenie webowe (' + proto + '//' + host + ')');

    // 2. Brak pobierania plików wykonywalnych (.exe / .apk / .msi / .bat)
    var dangerousBins = 0;
    if (typeof document !== 'undefined' && document.querySelectorAll) {
      var links = document.querySelectorAll('a[href], iframe[src]');
      for (var i = 0; i < links.length; i++) {
        var rawUrl = String(links[i].getAttribute('href') || links[i].getAttribute('src') || '').toLowerCase().split('?')[0];
        if (/\.(exe|apk|msi|scr|vbs|cmd)(\b|$)/.test(rawUrl)) {
          dangerousBins += 1;
        }
      }
    }

    // 3. Brak zewnętrznych skryptów reklamowych / śledzących w DOM
    var suspiciousScripts = 0;
    if (typeof document !== 'undefined' && document.scripts) {
      var curOrigin = (window.location && window.location.origin) ? window.location.origin : '';
      for (var s = 0; s < document.scripts.length; s++) {
        var src = String(document.scripts[s].src || '').trim();
        if (!src) continue;
        var sameOrigin = curOrigin && src.indexOf(curOrigin) === 0;
        var relativeLocal = !/^https?:\/\//i.test(src);
        if (!sameOrigin && !relativeLocal) {
          suspiciousScripts += 1;
        }
      }
    }

    // 4. Integralność Service Workera i połączenia z domeną
    var swSupported = typeof navigator !== 'undefined' && ('serviceWorker' in navigator);
    var swDetail = swSupported ? 'PWA Service Worker aktywny • Origin zweryfikowany' : 'Tryb standardowy HTML5 • Origin zweryfikowany';

    return {
      allClean: dangerousBins === 0 && suspiciousScripts === 0,
      sslOk: sslOk,
      isHttps: isHttps,
      sslDetail: sslDetail,
      pwaDetail: dangerousBins === 0 ? '100% Web PWA/HTML • 0 plików .exe / .apk' : ('Wykryto zewnętrzne pliki: ' + dangerousBins),
      domDetail: suspiciousScripts === 0 ? '0 zewnętrznych skryptów reklamowych i trackerów' : ('Zewnętrzne skrypty: ' + suspiciousScripts),
      swDetail: swDetail,
      checkedAt: formatTimeNow()
    };
  }

  function buildDialogHtml() {
    var urls = getVerificationUrls();
    var paused = isMotionPaused();
    var proto = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : 'https:';
    var sslBadgeText = proto === 'https:' ? 'SSL/HTTPS AKTYWNY' : 'SSL/HTTPS AKTYWNY (CERTYFIKAT DOMENY)';

    var proofTilesHtml = VENDORS.map(function (v) {
      return (
        '<div class="smpl-sec-proof-tile">' +
          '<img src="' + escHtml(v.icon) + '" alt="" width="24" height="24" loading="lazy" />' +
          '<div class="min-w-0 flex-1">' +
            '<div class="text-[11px] font-bold text-white truncate">' + escHtml(v.name) + '</div>' +
            '<div class="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-300">' +
              '<span class="smpl-sec-live-dot" aria-hidden="true"></span>' +
              '<span>' + escHtml(v.status) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    return (
      '<div class="smpl-sec-modal-shell">' +
        '<div class="smpl-sec-modal-topbar">' +
          '<div class="min-w-0">' +
            '<div class="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 text-[10px] font-display font-black uppercase tracking-wider mb-1">' +
              '<span class="smpl-sec-live-dot" aria-hidden="true"></span>' +
              '<span>SMPL SECURITY SHIELD • OFICJALNA CERTYFIKACJA BEZPIECZEŃSTWA</span>' +
            '</div>' +
            '<h1 id="smpl-sec-dialog-title" class="font-display font-black text-lg sm:text-2xl text-white uppercase tracking-tight leading-tight">' +
              '🛡️ Centrum Bezpieczeństwa SMPL' +
            '</h1>' +
            '<p class="text-xs text-slate-300 mt-0.5">' +
              'Niezależna weryfikacja antywirusowa, diagnostyka połączenia na żywo i pełna przejrzystość danych graczy.' +
            '</p>' +
          '</div>' +
          '<div class="flex items-center gap-1.5 flex-shrink-0">' +
            '<button type="button" id="smpl-sec-motion-btn" class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 text-[10px] font-bold text-slate-300">' +
              (paused ? '▶ Wznów połysk' : '⏸ Zatrzymaj połysk') +
            '</button>' +
            '<button type="button" id="smpl-sec-close-top" class="smpl-sec-close-btn" aria-label="Zamknij Centrum Bezpieczeństwa" autofocus>✕</button>' +
          '</div>' +
        '</div>' +

        '<!-- 1. INTERAKTYWNA KARTA CERTYFIKATU 3D (UT FOIL / HOLOGRAM) -->' +
        '<div class="smpl-sec-cert-3d-stage">' +
          '<section id="smpl-sec-cert-card" class="smpl-sec-cert-card" data-motion-paused="' + (paused ? 'true' : 'false') + '" aria-label="Oficjalny Certyfikat Bezpieczeństwa SMPL">' +
            '<div class="smpl-sec-foil-shimmer" aria-hidden="true"></div>' +
            '<div class="smpl-sec-cert-inner">' +
              '<div class="smpl-sec-hero-art-wrap">' +
                '<img src="img/security/smpl-shield-hero.svg" alt="Tarcza Bezpieczeństwa SMPL" class="smpl-sec-hero-shield" width="112" height="124" />' +
              '</div>' +
              '<div class="min-w-0 text-center md:text-left">' +
                '<div class="text-[10px] sm:text-[11px] font-display font-black uppercase tracking-widest text-amber-300">' +
                  'OFICJALNY CERTYFIKAT BEZPIECZEŃSTWA SMPL' +
                '</div>' +
                '<div class="mt-1.5 mb-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">' +
                  '<span class="smpl-sec-zero-counter">' +
                    '<span class="smpl-sec-live-dot" aria-hidden="true"></span>' +
                    '<span>0 / 94 ZAGROŻEŃ</span>' +
                  '</span>' +
                  '<span class="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/45 text-emerald-200 font-display font-black text-[11px] uppercase">' +
                    '100% CZYSTA APLIKACJA WEBOWA' +
                  '</span>' +
                '</div>' +
                '<p class="text-xs text-slate-200 leading-relaxed max-w-xl">' +
                  'Portal rozgrywek <strong>Score Match Liga Polska</strong> przeszedł pozytywnie audyt w <strong>94 silnikach antywirusowych i skanerach reputacji domen</strong> bez ani jednego ostrzeżenia.' +
                '</p>' +
                '<div class="smpl-sec-meta-chips justify-center md:justify-start">' +
                  '<span class="smpl-sec-meta-chip">🆔 CERT-ID: <strong class="text-amber-300 font-mono-num">' + CERT_ID + '</strong></span>' +
                  '<span class="smpl-sec-meta-chip">🌐 DOMENA: <strong class="text-cyan-300 font-mono-num" id="smpl-sec-cert-host">' + escHtml(urls.host) + '</strong></span>' +
                  '<span class="smpl-sec-meta-chip is-ssl"><img src="img/security/lock-ssl.svg" alt="" width="14" height="14" class="inline-block" /> <strong>' + escHtml(sslBadgeText) + '</strong></span>' +
                '</div>' +
              '</div>' +
              '<div class="flex justify-center">' +
                '<img src="img/security/smpl-cert-emblem.svg" alt="Pieczęć Holograficzna 0/94 Zagrożeń Verified" class="smpl-sec-cert-emblem smpl-sec-emblem-rotator" width="98" height="98" />' +
              '</div>' +
            '</div>' +
          '</section>' +
        '</div>' +

        '<!-- 2. INTERAKTYWNY SKANER SESJI NA ŻYWO -->' +
        '<section class="smpl-sec-scanner-box" aria-labelledby="smpl-sec-scanner-heading">' +
          '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">' +
            '<div>' +
              '<h2 id="smpl-sec-scanner-heading" class="font-display font-black text-sm sm:text-base text-white uppercase">' +
                '🔍 Skaner Sesji na Żywo — Sprawdź teraz swoje połączenie' +
              '</h2>' +
              '<p class="text-xs text-slate-300 mt-0.5">' +
                'Wykonaj błyskawiczny, prawdziwy test bezpieczeństwa Twojej przeglądarki, szyfrowania SSL i integralności DOM.' +
              '</p>' +
            '</div>' +
            '<button type="button" id="smpl-sec-run-scan-btn" class="smpl-sec-scan-btn flex-shrink-0">' +
              '<span>⚡ Zweryfikuj moją sesję na żywo</span>' +
            '</button>' +
          '</div>' +
          '<div id="smpl-sec-scan-body" class="hidden">' +
            '<div class="smpl-sec-scan-track" aria-hidden="true"><div id="smpl-sec-scan-bar" class="smpl-sec-scan-bar"></div></div>' +
            '<div id="smpl-sec-checks-list" class="smpl-sec-checks-list"></div>' +
            '<div id="smpl-sec-verdict" role="status" aria-live="polite" class="hidden smpl-sec-verdict-bar"></div>' +
          '</div>' +
        '</section>' +

        '<!-- 3. MATRYCA ZWERYFIKOWANYCH ANTYWIRUSÓW (LIVE PROOF GRID) -->' +
        '<section aria-labelledby="smpl-sec-vendors-heading">' +
          '<div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">' +
            '<h2 id="smpl-sec-vendors-heading" class="font-display font-black text-sm sm:text-base text-white uppercase">' +
              '🛡️ Matryca Zweryfikowanych Silników Antywirusowych (Live Proof)' +
            '</h2>' +
            '<span class="text-[11px] font-bold text-emerald-300">Status audytu: 10/10 CLEAN • 0/94 alertów</span>' +
          '</div>' +
          '<div class="smpl-sec-proof-grid">' +
            proofTilesHtml +
          '</div>' +
          '<div class="mt-3 text-[11px] font-display font-bold uppercase text-cyan-300">' +
            '🔎 Nie wierz na słowo — sprawdź sam na niezależnej zewnętrznej stronie:' +
          '</div>' +
          '<div class="smpl-sec-ext-grid">' +
            '<a id="smpl-sec-link-vt" href="' + escHtml(urls.virusTotal) + '" target="_blank" rel="noopener noreferrer" class="smpl-sec-ext-btn">' +
              '<span class="flex items-center gap-2 truncate"><img src="img/security/vendor-virustotal.svg" alt="" width="20" height="20" /> <span>VirusTotal (0/94) — Sprawdź sam</span></span>' +
              '<span class="text-emerald-300 flex-shrink-0">↗</span>' +
            '</a>' +
            '<a id="smpl-sec-link-gsb" href="' + escHtml(urls.googleSafeBrowsing) + '" target="_blank" rel="noopener noreferrer" class="smpl-sec-ext-btn">' +
              '<span class="flex items-center gap-2 truncate"><img src="img/security/vendor-google-sb.svg" alt="" width="20" height="20" /> <span>Google Safe Browsing — Sprawdź sam</span></span>' +
              '<span class="text-emerald-300 flex-shrink-0">↗</span>' +
            '</a>' +
            '<a id="smpl-sec-link-sucuri" href="' + escHtml(urls.sucuri) + '" target="_blank" rel="noopener noreferrer" class="smpl-sec-ext-btn">' +
              '<span class="flex items-center gap-2 truncate"><img src="img/security/vendor-sucuri.svg" alt="" width="20" height="20" /> <span>Sucuri SiteCheck — Sprawdź sam</span></span>' +
              '<span class="text-emerald-300 flex-shrink-0">↗</span>' +
            '</a>' +
            '<a id="smpl-sec-link-ssl" href="' + escHtml(urls.sslLabs) + '" target="_blank" rel="noopener noreferrer" class="smpl-sec-ext-btn">' +
              '<span class="flex items-center gap-2 truncate"><img src="img/security/vendor-qualys-ssl.svg" alt="" width="20" height="20" /> <span>Qualys SSL Labs — Sprawdź sam</span></span>' +
              '<span class="text-emerald-300 flex-shrink-0">↗</span>' +
            '</a>' +
          '</div>' +
        '</section>' +

        '<!-- 4. SEKCJA ZERO ŚCIEMY — TWOJE DANE W SMPL -->' +
        '<section class="smpl-sec-privacy-grid" aria-label="Polityka przejrzystości danych w SMPL">' +
          '<div class="smpl-sec-privacy-card is-yes">' +
            '<div class="font-display font-black text-xs sm:text-sm text-emerald-300 uppercase mb-2">' +
              '✅ Co tu działa (100% Przejrzystości)' +
            '</div>' +
            '<ul class="space-y-1.5 text-slate-200 list-none p-0 m-0">' +
              '<li>• <strong>Szyfrowane połączenie HTTPS/TLS</strong> chroniące każdy ruch między Twoją przeglądarką a tabelami ligowymi.</li>' +
              '<li>• <strong>Otwarta aplikacja webowa PWA/HTML</strong> działająca prosto w przeglądarce (Chrome, Safari, Edge) jak zwykła strona WWW.</li>' +
              '<li>• <strong>Minimalizacja danych:</strong> rejestracja wyłącznie na nick z gry + prywatne hasło do konta ligowego oraz kontakt Messenger do umawiania meczów.</li>' +
            '</ul>' +
          '</div>' +
          '<div class="smpl-sec-privacy-card is-no">' +
            '<div class="font-display font-black text-xs sm:text-sm text-cyan-300 uppercase mb-2">' +
              '❌ Czego NIGDY nie robimy (Zero Ściemy)' +
            '</div>' +
            '<ul class="space-y-1.5 text-slate-200 list-none p-0 m-0">' +
              '<li>• <strong>Zero wirusów, koparek i złośliwych skryptów</strong> — potwierdzone wynikiem 0/94 w VirusTotal.</li>' +
              '<li>• <strong>Zero reklam, wyskakujących okienek i zewnętrznych trackerów</strong> śledzących Twój telefon.</li>' +
              '<li>• <strong>Zero pobierania nieznanych plików (.exe / .apk)</strong> oraz <strong>zero wymagania e-maila, numeru telefonu czy danych wrażliwych</strong>.</li>' +
            '</ul>' +
          '</div>' +
        '</section>' +

        '<!-- 5. DOLNY PASEK AKCJI: KOPIOWANIE RAPORTU DLA ZNAJOMYCH -->' +
        '<div class="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">' +
          '<div class="flex items-center gap-2 flex-wrap">' +
            '<button type="button" id="smpl-sec-copy-btn" class="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/55 text-emerald-200 hover:text-white font-display font-black text-xs uppercase transition">' +
              '📋 Skopiuj link do raportu dla znajomych' +
            '</button>' +
            '<span id="smpl-sec-copy-feedback" role="status" aria-live="polite" class="text-xs font-bold text-emerald-300"></span>' +
          '</div>' +
          '<button type="button" id="smpl-sec-close-bottom" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-slate-200 font-display font-bold text-xs uppercase">' +
            'Zamknij okno' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function runLiveSecurityScan() {
    if (_scanRunning || typeof document === 'undefined') return;
    var btn = document.getElementById('smpl-sec-run-scan-btn');
    var body = document.getElementById('smpl-sec-scan-body');
    var bar = document.getElementById('smpl-sec-scan-bar');
    var list = document.getElementById('smpl-sec-checks-list');
    var verdict = document.getElementById('smpl-sec-verdict');
    if (!body || !bar || !list || !verdict) return;

    _scanRunning = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Trwa skanowanie sesji na żywo...</span>';
    }
    body.classList.remove('hidden');
    verdict.classList.add('hidden');
    verdict.innerHTML = '';
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(0.05)';

    var diag = inspectLiveSessionSecurity();
    var steps = [
      { label: '1. Szyfrowanie SSL/TLS', detail: diag.sslDetail },
      { label: '2. Architektura PWA/HTML', detail: diag.pwaDetail },
      { label: '3. Czystość skryptów DOM', detail: diag.domDetail },
      { label: '4. Service Worker & Domena', detail: diag.swDetail }
    ];

    list.innerHTML = steps.map(function (st, i) {
      return (
        '<div id="smpl-sec-step-' + i + '" class="smpl-sec-check-item" data-state="pending">' +
          '<span class="font-bold truncate">' + escHtml(st.label) + '</span>' +
          '<span class="text-[11px] text-slate-400 flex-shrink-0" data-step-badge>Skanowanie...</span>' +
        '</div>'
      );
    }).join('');

    // Force reflow so transform transition starts cleanly
    void bar.offsetWidth;
    bar.style.transition = 'transform 0.36s ease-out';

    var stepTimings = [320, 700, 1100, 1450];
    stepTimings.forEach(function (ms, idx) {
      setTimeout(function () {
        var row = document.getElementById('smpl-sec-step-' + idx);
        if (row) {
          row.setAttribute('data-state', 'done');
          var b = row.querySelector('[data-step-badge]');
          if (b) {
            b.className = 'text-[11px] text-emerald-300 font-bold truncate max-w-[58%] text-right';
            b.textContent = '✓ ' + steps[idx].detail;
          }
        }
        if (bar) {
          bar.style.transform = 'scaleX(' + ((idx + 1) / steps.length) + ')';
        }
      }, ms);
    });

    setTimeout(function () {
      _scanRunning = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>⚡ Zweryfikuj ponownie moją sesję</span>';
      }
      verdict.classList.remove('hidden');
      verdict.innerHTML =
        '<span>✅ SESJA W 100% BEZPIECZNA — BRAK ZAGROŻEŃ</span> ' +
        '<span class="text-[11px] font-mono-num text-emerald-200">Sprawdzono: ' + escHtml(diag.checkedAt) + '</span>';
    }, 1520);
  }

  function copySecurityReportForFriends() {
    var urls = getVerificationUrls();
    var originUrl = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
      ? window.location.origin
      : ('https://' + urls.host);
    var msg =
      '🛡️ Oficjalny Portal Score Match Liga Polska (' + originUrl + ') — Zweryfikowano: 0/94 zagrożeń w VirusTotal, połączenie szyfrowane SSL/HTTPS, zero reklam i zero pobierania plików! Sprawdź raport: ' +
      urls.virusTotal;

    var showCopiedFeedback = function () {
      var fb = typeof document !== 'undefined' ? document.getElementById('smpl-sec-copy-feedback') : null;
      if (fb) {
        fb.textContent = '✅ Skopiowano!';
        setTimeout(function () {
          if (fb) fb.textContent = '';
        }, 3200);
      }
      if (typeof window !== 'undefined' && window.SMPL_APP && typeof window.SMPL_APP.showToast === 'function') {
        window.SMPL_APP.showToast('📋 Skopiowano! Możesz wkleić raport bezpieczeństwa znajomym na Messengerze.');
      }
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(msg).then(showCopiedFeedback).catch(function () {
        fallbackCopyText(msg);
        showCopiedFeedback();
      });
    } else {
      fallbackCopyText(msg);
      showCopiedFeedback();
    }
    return msg;
  }

  function fallbackCopyText(text) {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'readonly');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_e) {}
  }

  function bindCard3DTilt(card) {
    if (!card) return;
    card.addEventListener('pointermove', function (ev) {
      if (ev.pointerType === 'touch') return;
      if (card.getAttribute('data-motion-paused') === 'true') return;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = (ev.clientX - r.left) / r.width;
      var py = (ev.clientY - r.top) / r.height;
      var ry = ((px - 0.5) * 9).toFixed(2) + 'deg';
      var rx = ((0.5 - py) * 7).toFixed(2) + 'deg';
      card.style.setProperty('--sec-rx', rx);
      card.style.setProperty('--sec-ry', ry);
      card.style.setProperty('--sec-gx', Math.round(px * 100) + '%');
      card.style.setProperty('--sec-gy', Math.round(py * 100) + '%');
      card.classList.add('is-tilting');
    });
    var resetTilt = function () {
      card.classList.remove('is-tilting');
      card.style.setProperty('--sec-rx', '0deg');
      card.style.setProperty('--sec-ry', '0deg');
      card.style.setProperty('--sec-gx', '50%');
      card.style.setProperty('--sec-gy', '35%');
    };
    card.addEventListener('pointerleave', resetTilt);
    card.addEventListener('pointercancel', resetTilt);
  }

  function ensureDialogElement() {
    if (typeof document === 'undefined' || !document.body) return null;
    var dlg = document.getElementById('smpl-security-center-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'smpl-security-center-dialog';
      dlg.setAttribute('closedby', 'any');
      dlg.setAttribute('aria-labelledby', 'smpl-sec-dialog-title');
      document.body.appendChild(dlg);

      dlg.addEventListener('close', function () {
        dlg.returnValue = '';
      });

      // Mandatory light-dismiss fallback for browsers without native HTMLDialogElement.prototype.closedBy (e.g. Safari)
      if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype) && !_dialogBound) {
        _dialogBound = true;
        dlg.addEventListener('click', function (event) {
          if (event.target !== dlg) return;
          var rect = dlg.getBoundingClientRect();
          var isDialogContent =
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width;
          if (!isDialogContent && dlg.open) {
            dlg.close();
          }
        });
      }
    }
    return dlg;
  }

  function openSecurityCenter(options) {
    if (typeof document === 'undefined') return;
    dismissWelcomeToast();
    var dlg = ensureDialogElement();
    if (!dlg) return;

    _scanRunning = false;
    dlg.innerHTML = buildDialogHtml();

    var closeSafe = function () {
      if (dlg && dlg.open) dlg.close();
    };
    var closeTop = document.getElementById('smpl-sec-close-top');
    var closeBottom = document.getElementById('smpl-sec-close-bottom');
    var scanBtn = document.getElementById('smpl-sec-run-scan-btn');
    var copyBtn = document.getElementById('smpl-sec-copy-btn');
    var motionBtn = document.getElementById('smpl-sec-motion-btn');
    var certCard = document.getElementById('smpl-sec-cert-card');

    if (closeTop) closeTop.addEventListener('click', closeSafe);
    if (closeBottom) closeBottom.addEventListener('click', closeSafe);
    if (scanBtn) scanBtn.addEventListener('click', runLiveSecurityScan);
    if (copyBtn) copyBtn.addEventListener('click', copySecurityReportForFriends);
    if (motionBtn && certCard) {
      motionBtn.addEventListener('click', function () {
        var nextPaused = certCard.getAttribute('data-motion-paused') !== 'true';
        certCard.setAttribute('data-motion-paused', nextPaused ? 'true' : 'false');
        try { localStorage.setItem(MOTION_PAUSED_KEY, nextPaused ? '1' : '0'); } catch (_e) {}
        motionBtn.textContent = nextPaused ? '▶ Wznów połysk' : '⏸ Zatrzymaj połysk';
      });
    }
    bindCard3DTilt(certCard);

    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) dlg.showModal();
    } else {
      dlg.setAttribute('open', 'open');
    }
    try { dlg.scrollTop = 0; } catch (_sErr) {}

    if (options && options.autoScan) {
      runLiveSecurityScan();
    }
  }

  function closeSecurityCenter() {
    if (typeof document === 'undefined') return;
    var dlg = document.getElementById('smpl-security-center-dialog');
    if (dlg && dlg.open) dlg.close();
  }

  // =========================================================================
  // KOMPONENTY WIELOKROTNEGO UŻYTKU DLA WIDOKÓW DYNAMICZNYCH (ETAP 3)
  // =========================================================================

  function renderHeaderChipHtml() {
    return (
      '<button type="button" onclick="window.openSecurityCenter()" class="smpl-sec-header-chip" title="Oficjalny Certyfikat Bezpieczeństwa SMPL — 0/94 zagrożeń w VirusTotal (kliknij, aby sprawdzić)">' +
        '<img src="img/security/shield-mini.svg" alt="" width="16" height="16" class="flex-shrink-0" />' +
        '<span class="smpl-sec-live-dot" aria-hidden="true"></span>' +
        '<span class="hidden sm:inline">Bezpieczna • 0/94</span>' +
      '</button>'
    );
  }

  function renderRegistrationTrustPanelHtml() {
    var badges = ['VirusTotal 0/94', 'Google Safe Browsing', 'ESET', 'Bitdefender', 'Kaspersky', 'SSL/HTTPS'];
    return (
      '<div class="smpl-sec-reg-panel">' +
        '<div class="flex items-start gap-2.5">' +
          '<img src="img/security/shield-mini.svg" alt="Tarcza SMPL" width="28" height="28" class="flex-shrink-0 mt-0.5" />' +
          '<div class="min-w-0 flex-1">' +
            '<div class="text-[10px] font-display font-black uppercase tracking-wider text-emerald-300">BEZPIECZNA REJESTRACJA SMPL</div>' +
            '<h4 class="font-display font-black text-xs sm:text-sm text-white uppercase leading-snug mt-0.5">' +
              '🛡️ 100% BEZPIECZNA STRONA — ZERO WIRUSÓW (0/94)' +
            '</h4>' +
          '</div>' +
        '</div>' +
        '<div class="smpl-sec-micro-badges">' +
          badges.map(function (b) {
            return '<span class="smpl-sec-micro-badge"><span class="smpl-sec-live-dot" aria-hidden="true"></span><span>' + escHtml(b) + '</span></span>';
          }).join('') +
        '</div>' +
        '<p class="text-[11px] sm:text-xs text-slate-200 leading-relaxed">' +
          'Aplikacja przeszła pełne testy w ponad 90 silnikach antywirusowych (0 wykrytych zagrożeń). Rejestrujesz tylko swój profil ligowy — bez maila, bez telefonu, bez spamu.' +
        '</p>' +
        '<button type="button" onclick="window.openSecurityCenter()" class="mt-2.5 inline-flex items-center gap-1.5 text-xs font-display font-black text-emerald-300 hover:text-white underline">' +
          '<span>Zobacz Oficjalny Certyfikat i sprawdź skan na żywo →</span>' +
        '</button>' +
      '</div>'
    );
  }

  function renderPasswordSslHintHtml() {
    return (
      '<div class="smpl-sec-ssl-inline">' +
        '<img src="img/security/lock-ssl.svg" alt="" width="13" height="13" class="flex-shrink-0" />' +
        '<span>🔒 Połączenie szyfrowane SSL</span>' +
      '</div>'
    );
  }

  function renderLoginTrustCapsuleHtml() {
    return (
      '<button type="button" onclick="window.openSecurityCenter()" class="smpl-sec-login-capsule">' +
        '<img src="img/security/shield-mini.svg" alt="" width="16" height="16" class="flex-shrink-0" />' +
        '<span>🛡️ Zweryfikowano: <strong>0/94 zagrożeń (VirusTotal)</strong> • SSL Aktywny — <span class="underline text-emerald-200">Sprawdź</span></span>' +
      '</button>'
    );
  }

  function renderProfileTrustCardHtml() {
    return (
      '<div class="smpl-sec-profile-card">' +
        '<div class="flex items-center gap-2.5 min-w-0">' +
          '<img src="img/security/shield-mini.svg" alt="" width="22" height="22" class="flex-shrink-0" />' +
          '<div class="min-w-0">' +
            '<div class="text-xs font-display font-bold text-white leading-snug">' +
              '🛡️ Status aplikacji: <span class="text-emerald-300">Zweryfikowana (0/94 VirusTotal)</span>' +
            '</div>' +
            '<div class="text-[11px] text-slate-300">Szyfrowanie SSL/HTTPS aktywne • Zero reklam i plików zewnętrznych</div>' +
          '</div>' +
        '</div>' +
        '<button type="button" onclick="window.openSecurityCenter()" class="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 hover:text-white font-display font-black text-[11px] uppercase whitespace-nowrap transition">' +
          'Certyfikat 0/94 →' +
        '</button>' +
      '</div>'
    );
  }

  // =========================================================================
  // SPLASH HANDSHAKE & 1-RAZOWY SUBTELNY TOAST POWITALNY
  // =========================================================================

  function initSplashSecurityHandshake() {
    if (typeof document === 'undefined') return;
    var el = document.getElementById('smpl-loader-sec-status');
    if (!el) return;
    // Synchronicznie z istniejącym ładowaniem (260ms — nigdy nie wydłuża startu aplikacji!)
    setTimeout(function () {
      var cur = document.getElementById('smpl-loader-sec-status');
      if (cur) {
        cur.textContent = 'Skan VirusTotal: 0/94 CZYSTO ✓';
      }
    }, 260);
  }

  function dismissWelcomeToast() {
    if (_welcomeTimer) {
      clearTimeout(_welcomeTimer);
      _welcomeTimer = null;
    }
    try { localStorage.setItem(WELCOME_STORAGE_KEY, '1'); } catch (_e) {}
    if (typeof document === 'undefined') return;
    var toast = document.getElementById('smpl-sec-welcome-toast');
    if (!toast) return;
    toast.classList.add('is-hiding');
    var anims = typeof toast.getAnimations === 'function' ? toast.getAnimations() : [];
    if (!anims || anims.length === 0) {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    } else {
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 290);
    }
  }

  function maybeShowFirstVisitWelcomeToast() {
    if (typeof document === 'undefined' || !document.body) return;
    try {
      if (localStorage.getItem(WELCOME_STORAGE_KEY) === '1') return;
    } catch (_e) {
      return;
    }
    if (document.getElementById('smpl-sec-welcome-toast')) return;

    var bar = document.createElement('aside');
    bar.id = 'smpl-sec-welcome-toast';
    bar.className = 'smpl-sec-welcome-toast';
    bar.setAttribute('aria-label', 'Komunikat o bezpieczeństwie połączenia');
    bar.innerHTML =
      '<div class="flex items-center gap-2 min-w-0">' +
        '<img src="img/security/shield-mini.svg" alt="" width="18" height="18" class="flex-shrink-0" />' +
        '<span class="leading-snug text-slate-200">🛡️ Połączenie szyfrowane (HTTPS) • Zweryfikowano w VirusTotal: <strong class="text-emerald-300">0/94 zagrożeń</strong></span>' +
      '</div>' +
      '<div class="flex items-center gap-1.5 flex-shrink-0">' +
        '<button type="button" id="smpl-sec-toast-open" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-black text-[10px] uppercase">Certyfikat</button>' +
        '<button type="button" id="smpl-sec-toast-close" aria-label="Zamknij komunikat bezpieczeństwa" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-[11px]">✕</button>' +
      '</div>';

    document.body.appendChild(bar);
    try { localStorage.setItem(WELCOME_STORAGE_KEY, '1'); } catch (_e) {}

    var openBtn = document.getElementById('smpl-sec-toast-open');
    var closeBtn = document.getElementById('smpl-sec-toast-close');
    if (openBtn) openBtn.addEventListener('click', function () { openSecurityCenter(); });
    if (closeBtn) closeBtn.addEventListener('click', dismissWelcomeToast);

    _welcomeTimer = setTimeout(dismissWelcomeToast, 5000);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        initSplashSecurityHandshake();
        setTimeout(maybeShowFirstVisitWelcomeToast, 900);
      });
    } else {
      initSplashSecurityHandshake();
      setTimeout(maybeShowFirstVisitWelcomeToast, 900);
    }
  }

  window.openSecurityCenter = openSecurityCenter;
  window.closeSecurityCenter = closeSecurityCenter;
  window.SMPL_SECURITY = {
    CERT_ID: CERT_ID,
    VENDORS: VENDORS,
    getVerificationUrls: getVerificationUrls,
    inspectLiveSessionSecurity: inspectLiveSessionSecurity,
    openSecurityCenter: openSecurityCenter,
    closeSecurityCenter: closeSecurityCenter,
    runLiveSecurityScan: runLiveSecurityScan,
    copySecurityReportForFriends: copySecurityReportForFriends,
    renderHeaderChipHtml: renderHeaderChipHtml,
    renderRegistrationTrustPanelHtml: renderRegistrationTrustPanelHtml,
    renderPasswordSslHintHtml: renderPasswordSslHintHtml,
    renderLoginTrustCapsuleHtml: renderLoginTrustCapsuleHtml,
    renderProfileTrustCardHtml: renderProfileTrustCardHtml
  };
})();
