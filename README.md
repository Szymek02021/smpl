# Score Match Liga Polska (SMPL) — Portal Rozgrywek (v56)

Oficjalne, prywatne repozytorium kodu źródłowego portalu **Score Match Liga Polska (SMPL)**.
Dzięki temu repozytorium możesz wygodnie edytować portal z **dowolnego komputera** przez **GitHub Desktop + Antigravity**, testować go lokalnie na **PHP 8.3 (Laragon)** i jednym kliknięciem budować bezpieczną paczkę aktualizacyjną na serwer **Hostido.pl**.

---

## Praca z kilku komputerów (krok po kroku)

1. **Zanim zaczniesz edycję (na każdym komputerze):**
   - Otwórz **GitHub Desktop** → kliknij **Fetch origin** → **Pull origin** (pobierasz najnowszą wersję kodu).
   - Otwórz ten folder w **Antigravity** jako aktywny Workspace.
2. **Wprowadź zmiany i sprawdź błędy:**
   - Uruchom w terminalu:
     ```powershell
     npm run verify
     ```
     Skrypt automatycznie sprawdzi składnię wszystkich plików PHP (`php -l`), wszystkich plików JavaScript (`node --check`), JSON-ów oraz upewni się, że do Git nie trafiły żadne sekrety.
3. **Zapisz zmiany w chmurze (GitHub):**
   - Wróć do **GitHub Desktop**, wpisz krótki opis zmian (np. `Sezon 56: poprawka tabeli`), kliknij **Commit to main**, a następnie **Push origin**.
   - Gotowe — na drugim komputerze klikasz tylko **Pull origin** i masz dokładnie ten sam kod!

---

## Podgląd lokalny na Twoim komputerze (identyczny z Hostido)

- **Najszybszy sposób (1 kliknięcie):** kliknij dwukrotnie plik **`URUCHOM-LOKALNIE-PHP.bat`** w tym folderze.
  - Automatycznie wykryje **PHP 8.3** z Laragona (lub z systemu Windows), uruchomi lokalny serwer `http://127.0.0.1:8080` i otworzy stronę w przeglądarce.
- **Alternatywnie (Node.js):** wpisz w terminalu `npm start`.

> **Wskazówka dla Laragona:** W programie Laragon kliknij **Menu → Tools → Path → Add Laragon to Path**, dzięki czemu polecenia `php`, `node` i `npm` będą działać globalnie w każdym terminalu i w Antigravity!

---

## Wrzucanie aktualizacji na serwer Hostido.pl (BEZ utraty bazy graczy!)

1. Uruchom w terminalu:
   ```powershell
   npm run build:zip
   ```
   *(lub kliknij prawym przyciskiem myszy na `scripts/build-hostido-zip.ps1` → **Uruchom za pomocą programu PowerShell**)*.
2. W głównym folderze powstanie gotowy plik **`PACZKA-AKTUALIZACJA-BEZ-BAZY.zip`** (ignorowany przez Git — nie zaśmieca repozytorium).
   - Paczka zawiera **wyłącznie zaktualizowany kod i grafiki** (z poprawnymi ścieżkami `/` dla serwera Linux/LiteSpeed).
   - Paczka **NIE zawiera** folderu `data/`, więc **nigdy nie nadpisze** żywej bazy graczy (`smpl-db.json`), snapshotów ani sekretów serwera!
3. Zaloguj się do **DirectAdmin (Hostido.pl)** → **Menedżer plików** → `public_html` → wgraj `PACZKA-AKTUALIZACJA-BEZ-BAZY.zip` → kliknij **Wypakuj (Extract)** (nadpisz pliki) → usuń plik `.zip`.

---

## Bezpieczeństwo (dlaczego `data/smpl-db.json` nie ma na GitHubie?)

Plik `.gitignore` celowo i bezwzględnie blokuje:
- `data/smpl-db.json` oraz `data/snapshots/` (dane graczy, hasła, wiadomości prywatne),
- `data/.smpl-ai-secrets.json`, `data/.smpl-vapid.json`, `data/.smpl-admin-tokens.json` (klucze API, tokeny sesji i klucze Push),
- ciężkie archiwa `.zip` i pliki wideo `.mp4`.

Dzięki temu repozytorium jest lekkie, błyskawiczne i **w 100% bezpieczne**.
