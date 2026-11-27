# 🛡️ CLOUDFLARE ANTI-DDOS & WAF SHIELD — INSTRUKCJA WDROŻENIA SMPL (v79)

Ten dokument opisuje pełną, 3-warstwową ochronę **Anty-DDoS, WAF i Anti-Brute-Force** wdrożoną dla portalu **Score Match Liga Polska (SMPL)** na koncie Cloudflare użytkownika.

---

## 1. Aktywna Warstwa Brzegowa Cloudflare Edge Worker (JUŻ WDROŻONA!)

Ponieważ serwer docelowy działa obecnie pod subdomeną operatora hostingu (`https://host976694.xce.pl/`), subdomeny `xce.pl` nie da się wydelegować po DNS/NS bez własnej domeny `.pl`. Dlatego na Twoim koncie Cloudflare wdrożyliśmy od razu pełnoprawnego **Cloudflare Edge Anti-DDoS & WAF Workera** (`smpl-security-shield`):

- **Publiczny adres przez tarczę Cloudflare (Anycast):**
  `https://smpl-security-shield.smpl-liga.workers.dev`
- **Endpoint diagnostyczny zdrowia Edge Shield:**
  `https://smpl-security-shield.smpl-liga.workers.dev/__smpl_cf_health`
- **Kod źródłowy Workera w repozytorium:**
  - `cloudflare-worker/worker.js`
  - `cloudflare-worker/wrangler.jsonc`

### Co robi aktywna tarcza Cloudflare Worker:
1. **L3/L4/L7 DDoS Mitigation** — cały ruch przechodzący przez `smpl-liga.workers.dev` trafia najpierw do globalnej sieci Anycast Cloudflare (w tym węzła WAW w Warszawie).
2. **Edge WAF (Web Application Firewall)** — blokuje z kodem `403 Forbidden` boty skanujące (`sqlmap`, `nikto`, `acunetix`, `nuclei`, `wpscan`), próby odczytu `.env`, `.git`, `wp-admin`, `xmlrpc.php`, `phpmyadmin`, `data/`, plików `.sql`/`.bak`/`.log` oraz sygnatury SQLi / XSS / Path Traversal zanim dotkną hostingu Hostido.
3. **Edge Cache dla statycznych grafik/CSS/JS** — odciąża serwer Apache/LiteSpeed podczas szczytu kolejki lub fali zapytań.
4. **Kryptograficzny tunel `X-SMPL-CF-Shield`** — Worker dokleja tajny token z Cloudflare Worker Secrets (`SMPL_CF_SHIELD_SECRET`), dzięki czemu serwer `api.php` weryfikuje autentyczność ruchu brzegowego.

---

## 2. Co wrzucić na serwer WWW (Hostido / `host976694.xce.pl`)

Wgraj przez FTP / Menedżer Plików następujące zaktualizowane pliki i foldery z paczki `v79`:
- `.htaccess` (reguły WAF blokujące skanery i niedozwolone metody HTTP + nagłówki `Permissions-Policy` / `COOP`)
- `api.php` (weryfikacja oficjalnych podsieci IPv4/IPv6 Cloudflare, `X-SMPL-CF-Shield`, blokada Brute-Force `429` po 8 błędnych hasłach / 5 min, limity floodowe `429` i ochrona `Cross-Site Guard`)
- `sw.js` (`smpl-pwa-v79`)
- `index.html`, `REJESTRACJA.html`, `PANEL-ADMINA.html`, `MASTER-SZYMON-KOMENDA.html`
- `js/security-center.js`, `js/ai-assistant.js`, `js/expansion-studio.js`, `js/archive-data.js`
- `css/security-center.css`
- `img/security/vendor-cloudflare.svg`
- *(Opcjonalnie — zalecane dla weryfikacji nagłówka `X-SMPL-CF-Shield`)* lokalny plik `data/.smpl-cf-shield.json` (chroniony w `.htaccess` przed dostępem z internetu).

> **WAŻNE:** **NIE NADPISUJ** produkcyjnego pliku `data/smpl-db.json` na serwerze! Plik `.gitignore` również chroni `data/smpl-db.json` oraz `data/.smpl-*` przed przypadkowym wypchnięciem na GitHub.

---

## 3. Opcjonalnie: Podpięcie własnej domeny (np. `scorematchliga.pl`) w 3 minuty

Jeśli w przyszłości kupisz własną domenę `.pl`:
1. W panelu Cloudflare kliknij **Add a domain** i wpisz swoją domenę (plan **Free** ma darmowy, nielimitowany Anti-DDoS!).
2. Zmień 2 serwery DNS (NS) u rejestratora domeny na te podane przez Cloudflare.
3. W zakładce **DNS** włącz pomarańczową chmurkę (**Proxied**) i wskaż rekord `CNAME` / `A` na serwer Hostido.
4. W **SSL/TLS** ustaw tryb **Full (strict)** oraz **Always Use HTTPS**, a w **Security → Settings** włącz **Bot Fight Mode**. Serwer `api.php` automatycznie rozpozna wszystkie oficjalne zakresy IP Cloudflare (`CF-Connecting-IP`) bez żadnych zmian w kodzie!
