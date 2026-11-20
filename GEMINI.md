# Zasady Projektowe — Score Match Liga Polska (SMPL)

## 1. Środowisko i Architektura
- **Produkcja:** Hostido.pl (DirectAdmin + LiteSpeed Enterprise + **PHP 8.3**), główny backend produkcyjny to `api.php` (baza JSON w `data/smpl-db.json` + automatyczne snapshoty w `data/snapshots/`).
- **Lokalny dev:** Laragon (PHP 8.3 + Node.js v22) lub `URUCHOM-LOKALNIE-PHP.bat`. `server.js` służy jako opcjonalny lokalny serwer Node.js o zgodnej logice zabezpieczeń.
- **PWA / Cache LiteSpeed:** Każda zmiana w plikach `js/`, `css/` lub `img/` wymaga podbicia wersji cache w `sw.js` (`smpl-pwa-v...`) oraz parametrów `?v=...` w `index.html`, `MASTER-SZYMON-KOMENDA.html`, `PANEL-ADMINA.html` i `REJESTRACJA.html`.

## 2. KRYTYCZNE Zasady Bezpieczeństwa i Anti-Data-Loss
1. **NIGDY nie commituj sekretów ani bazy graczy** (`data/smpl-db.json`, `data/.smpl-*`, `data/snapshots/`, `data/audit.log`, `*.zip`, `*.mp4`). `.gitignore` je blokuje — nigdy go nie osłabiaj.
2. **Ochrona przed utratą danych w `api.php`:** Zachowuj zawsze serwerowe mechanizmy ochronne:
   - Anti-Player-Loss Guard (nigdy nie kasuje istniejących graczy — przenosi do `POOL` z `active: false`).
   - Anti-Trophy/History Wipe Guard (chroni trofea i `historicalStats` przed przypadkowym wyzerowaniem).
   - Server-side DM base64 avatar deduplication (nie zapisuj ciężkich base64 avatarów w każdej wiadomości DM).
   - Wyłączny zapis ustawień sekcji Wsparcia (`portalSettings.supportConfig` / Donate) oraz ról `MASTER_ADMIN` tylko dla Master Admina (blokada `403` dla `CO_ADMIN` i gości).
3. **Bezpieczne aktualizacje na Hostido:** Do codziennych aktualizacji używaj WYŁĄCZNIE paczki bez folderu `data/` (`npm run build:zip` → `PACZKA-AKTUALIZACJA-BEZ-BAZY.zip`), żeby nie nadpisać żywej bazy graczy i sekretów serwera!

## 3. Obowiązkowy Changelog po Każdej Zmianie
1. **Zakładka dla Graczy (`🆕 Update V...`)**: Po każdej zmianie funkcji, poprawce błędu lub przebudowie UI **ZAWSZE** dopisz nowy wpis na początku tablicy `BUILTIN_PLAYER_UPDATES` w `js/expansion-studio.js` (kolejny numer `V...`, data `YYYY-MM-DD`, kategoria `NOWOŚCI` / `ULEPSZENIA` / `TURNIEJE` / `POPRAWKI`, zwięzły tytuł, opis i lista `highlights`).
2. **Changelog dla Administracji**: Gdy zmieniają się narzędzia lub procedury Admina, zaktualizuj także `ADMIN_CHANGELOG_SIMPLE` w `js/archive-data.js` oraz `CHANGELOG-DLA-ADMINISTRACJI.md`.
3. **Weryfikacja przed wdrożeniem:** Po każdej zmianie uruchom:
   - `npm run verify` (sprawdza składnię wszystkich plików PHP `php -l`, JS `node --check`, JSON i sprawdza czy brak wycieku sekretów w Git).
   - `npm run build:zip` (buduje gotową paczkę aktualizacyjną `PACZKA-AKTUALIZACJA-BEZ-BAZY.zip` ze ścieżkami Linux `/`, bez folderu `data/`).
