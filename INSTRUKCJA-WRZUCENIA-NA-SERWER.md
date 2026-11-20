# 🚀 INSTRUKCJA „JAK DLA DEBILA” — JAK WRZUCIĆ PORTAL SCORE MATCH LIGA NA SERWER BEZ PISANIA KODU

Nie musisz pisać **ani jednej linijki kodu** ani nic konfigurować!
Cała paczka w folderze `smpl-sezon-55` (oraz gotowe archiwa `PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip`, `PACZKA-NA-SERWER-SMPL-SEZON-56.zip` i `PACZKA-NA-SERWER-SMPL-SEZON-55.zip`) ma już wszystko wbudowane:
- **`api.php`** + **`.htaccess`** + **`.user.ini`** — automatyczny silnik bazy danych dla każdego zwykłego hostingu WWW (cPanel, DirectAdmin, CyberFolks, Hostido, SeoHost, nazwa.pl, home.pl, OVH, darmowe ct8.pl / InfinityFree),
- **`data/smpl-db.json`** — gotowa, załadowana baza danych (Ekstraklasa, 2. Liga, 3. Liga, pełne Archiwum S1–S55 we wszystkich dywizjach L1–L9, Ranking Generalny i 5 Sezonów, Karty UT, Gablota Trofeów, Złota Piłka, Czarna Lista, Czat i DMs),
- **`server.js`** + **`package.json`** — automatyczny serwer jeśli wrzucasz na hosting Node.js (Render, Railway, VPS),
- **`netlify.toml`** + **`vercel.json`** — automatyczna konfiguracja pod darmowe wrzucenie „Przeciągnij i Upuść” (Netlify Drop).

---

## 🏆 SPOSÓB 1 (NAJLEPSZY — PEŁNA WSPÓLNA BAZA DANYCH NA ŻYWO DLA WSZYSTKICH GRACZY I ADMINÓW)
### Dowolny hosting WWW z obsługą PHP (np. CyberFolks, Hostido, SeoHost, OVH, nazwa.pl, home.pl, darmowy InfinityFree / ct8.pl)

1. Zaloguj się do panelu swojego hostingu (cPanel / DirectAdmin / Menedżer Plików / FTP).
2. Wejdź do głównego folderu strony — zazwyczaj nazywa się **`public_html`** (lub `domains/twojadomena.pl/public_html` albo `htdocs`).
3. Przeciągnij tam myszką plik **`PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip`** (lub `PACZKA-NA-SERWER-SMPL-SEZON-56.zip`) i kliknij prawym przyciskiem myszy **„Wypakuj” (Extract)** — albo po prostu przeciągnij wszystkie pliki z folderu bezpośrednio do `public_html`.
4. **GOTOWE! Nic więcej nie robisz!**
   - Plik `api.php` sam połączy się z plikiem bazy `data/smpl-db.json`.
   - Gdy jakikolwiek gracz na swoim telefonie doda wynik meczu, wyśle wiadomość na czacie ligowym lub priv, a Ty na swoim telefonie/komputerze klikniesz **[ ✅ ZATWIERDŹ WYNIK ]**, wszyscy gracze w całej Polsce od razu widzą nową tabelę i wiadomości na żywo!

---

## ⚡ SPOSÓB 2 (DARMOWY W 30 SEKUND — PRZECIĄGNIJ FOLDER MYSZKĄ DO PRZEGLĄDARKI)
### Netlify Drop (bez zakładania serwera FTP)

1. Wejdź na stronę **[https://app.netlify.com/drop](https://app.netlify.com/drop)** (lub **[https://tiiny.host](https://tiiny.host)**).
2. Złap myszką cały folder projektu (albo rozpakowaną zawartość) i upuść go w okienko na stronie.
3. Po 5 sekundach dostaniesz gotowy link `https://twoja-nazwa.netlify.app`!

---

## 🔗 TWOJE 3 GOTOWE LINKI PO WRZUCENIU NA SERWER

Załóżmy, że Twoja strona na serwerze ma adres `https://twojadomena.pl`:

1. **🌐 LINK DLA WSZYSTKICH GRACZY (wklejasz na grupę FB / Messenger):**
   👉 `https://twojadomena.pl/` *(lub `https://twojadomena.pl/index.html`)*
   *(Gracze widzą tabele, Czyste Konta, Karty UT, Trofea, pełne Archiwum S1–S55, Złotą Piłkę, Czarną Listę, Czat Ligi & Priv, Zapisy i Dodawanie Wyników. Panel Admina jest tu całkowicie ukryty!).*

2. **🛡️ LINK LOGOWANIA DLA ADMINISTRACJI (wysyłasz tylko zaufanym Współadministratorom):**
   👉 `https://twojadomena.pl/PANEL-ADMINA.html`
   *(Wymaga podania prywatnego loginu i hasła zatwierdzonego Administratora).*

3. **👑 PRYWATNY LINK MASTER ADMINA (TYLKO DLA CIEBIE — SZYMON KOMENDA):**
   👉 `https://twojadomena.pl/MASTER-SZYMON-KOMENDA.html`
   *(Otwiera bramkę logowania Master Admina — wymaga podania Twojego prywatnego loginu i hasła Właściciela ligi!).*

---

## 💻 URUCHOMIENIE LOKALNIE NA TWOIM KOMPUTERZE PC (BEZ INTERNETU)

WAŻNE na Windows PC:
1. **Najpierw kliknij prawym przyciskiem myszy na paczkę `.zip` i wybierz „Wyodrębnij wszystko...”** (rozpakuj cały folder np. na Pulpit — nigdy nie klikaj `index.html` ani `.bat` bezpośrednio w podglądzie spakowanego ZIP!).
2. Wejdź do rozpakowanego folderu i kliknij dwukrotnie plik **`URUCHOM-SCORE-MATCH-LIGA.bat`** (lub **`URUCHOM-SMPL-SEZON-55.bat`** aby wejść od razu jako Master Admin Szymon Komenda).
3. Skrypt sam uruchomi lekki lokalny serwer Windows (`http://127.0.0.1:3055/`), dzięki czemu działa zapis bazy do `data/smpl-db.json`, rejestracja, panel admina oraz aplikacja PWA bez blokad przeglądarki!
   *(Gdyby zapora/antywirus pytał o PowerShell, można też po rozpakowaniu otworzyć w przeglądarce bezpośrednio plik `index.html` w trybie lokalnym).*
