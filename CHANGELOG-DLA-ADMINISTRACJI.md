# 📋 KOMPLETNY CHANGELOG DLA ADMINISTRACJI — SCORE MATCH LIGA (WSZYSTKIE SEZONY S1–S56)
*(Napisany prostym, zrozumiałym językiem krok po kroku — gotowy do skopiowania i wysłania pozostałym Administratorom)*

Cześć! Cały portal ligowy został oficjalnie przebudowany i nazwany **Score Match Liga** — kompleksowa platforma dla **wszystkich sezonów (kompletna historia S1–S55 + bieżące tabele Sezonu 56)**.
System jest w 100% gotowy — **nie musisz pisać ani linijki kodu**, wystarczy przerzucić paczkę na hosting/serwer i wszystko działa samo!

Poniżej znajduje się kompletne podsumowanie **wszystkiego, co zostało stworzone i jak z tego korzystać**:

---

## 📱 1. APLIKACJA NA SMARTFONY — POZIOMO I PIONOWO NA KAŻDYM TELEFONIE!
Portal został przebudowany jako nowoczesna aplikacja mobilna (PWA), dopasowana do **każdego modelu telefonu** (iPhone 12–16 Pro Max, SE, Samsung Galaxy S21–S25, Ultra, Fold, Flip, Xiaomi, Pixel):

* **W PIONIE (PORTRAIT):**
  * Wygodna dolna belka nawigacyjna pod kciukiem (Tabela, Terminarz, Czat, Wynik, Karta UT, Zapisy/Admin).
  * Pełne wsparcie dla wycięć w ekranie (**Notch**, **Dynamic Island** na iPhone, zaokrąglone rogi i oczka aparatów).
  * Płynne przewijanie tabel gestem w bok (`👉 Przesuń palcem w bok`).
* **W POZIOMIE (LANDSCAPE):**
  * Gdy gracz obróci telefon poziomo, dolny pasek nawigacji automatycznie zmienia się w **ultra-smukły (kompaktowy)**, aby nie zasłaniać ekranu.
  * Nagłówki, herby i banery zmniejszają wysokość, dzięki czemu cała zawartość zakładki mieści się na ekranie bez mozolnego przewijania.
  * **Czat w poziomie:** Zamienia się w wygodny panoramiczny układ 2-kolumnowy (po lewej lista rozmówców, po prawej okno czatu — dokładnie jak na tablecie).
  * **Tabela w poziomie:** Ekran ma wtedy ponad 850 pikseli szerokości, więc cała tabela ligowa mieści się w całości bez ściskania!
* **Gładkie wejście po zalogowaniu:** Po wpisaniu hasła ekran logowania znika z animacją (`tab-fade-enter`), a na ekranie **od razu pojawia się wybrana zakładka** automatycznie przewinięta do góry.

---

## 📲 2. INSTALACJA NA TELEFONIE (PWA) I POWIADOMIENIA PUSH!
Gracze mogą zainstalować ligę na pulpicie telefonu jak zwykłą aplikację z Google Play / App Store:

* **Instalacja 1-kliknięciem:** Na telefonie u góry ekranu pojawia się pasek: **`[ 📲 Zainstaluj aplikację SMPL ]`**. Kliknięcie dodaje ikonkę ligi na pulpit telefonu.
* **Powiadomienia, gdy Admin „puści kolejkę”:**
  * W Panelu Admina wystarczy kliknąć przycisk: **`[ 📢 Puść Kolejkę / Wyślij Powiadomienie PUSH do Graczy ]`**.
  * Wszyscy gracze w Polsce dostają na telefony alert z dźwiękiem i wibracją:
    > *„⚽ Kolejka #X (Tydzień #Y) wystartowała! Zaloguj się, zaproś rywala i rozegraj mecz w Score! Match!”*
* **Powiadomienia o wiadomościach prywatnych (Priv / DMs):** Gdy rywal napisze wiadomość prywatną (np. z kodem do pokoju), gracz natychmiast dostaje powiadomienie: *„✉️ Nowa wiadomość Priv od [Rywal]”*.
* **Powiadomienia o czacie ligowym:** Alerty o nowych wiadomościach w pokojach dyskusyjnych.
* **Wbudowany Syntetyzator Dźwięków Meczowych (Web Audio API — 100% Offline, Zero Plików MP3/WAV):**
  * ⚽ **Gwizdek Sędziego:** Realistyczny podwójny świst sędziego piłkarskiego przy puszczeniu kolejki i zatwierdzeniu wyniku meczu.
  * 💬 **Dzwonek Czatu:** Krystaliczny, elegancki dwuton powiadamiający o nowej wiadomości.
  * ⚖️ **Młotek Trybunału:** Głębokie, drewniane uderzenie młotka sędziowskiego przy orzeczeniu kary dyscyplinarnej.
  * 🔊 **Pełna kontrola:** Przełącznik wyciszenia dźwięków zapamiętywany w telefonie każdego użytkownika.
* **Generator Kodów Pokoju Score! Match (`SMPL-XXX`):**
  * W oknie wiadomości prywatnych (Priv) oraz czacie dodano przycisk **`[ 🎮 Generuj Kod Pokoju ]`**.
  * Jedno kliknięcie losuje kod pokoju (np. `SMPL-742`), kopiuje go do schowka telefonu i wkleja w treść wiadomości do rywala!

---

## ☕ 3. CZAT LIGOWY & OFFTOPIC Z FILTREM AGRESJI I WYZWISK (MODERACJA AI)
Dla graczy i Administracji powstał pełny zintegrowany komunikator ligowy podzielony na 5 oficjalnych pokoi:

1. **Pokoje dyskusyjne:**
   - ☕ **Czat Ogólny / Offtopic** — luźne rozmowy o wszystkim, sparingi, dyskusje pozaligowe.
   - 🥈 **Czat 2. Ligi (L2)** — oficjalny pokój dla graczy 2. Ligi.
   - 🏆 **Czat Ekstraklasy (L1)** — elitarny pokój dyskusyjny najwyższej klasy rozgrywkowej.
   - 🥉 **Czat 3. Ligi (L3)** — pokój dla nowych graczy i pretendentów.
   - 📢 **Komunikaty Zarządu** — oficjalne ogłoszenia, decyzje dyscyplinarne i komunikaty Master Admina.
2. **Automatyczny filtr netykiety (Zero tolerancji dla chamstwa):**
   - Każda wiadomość jest skanowana w czasie rzeczywistym pod kątem wulgaryzmów, wyzwisk, chamskich odzywek i agresji słownej w języku polskim.
3. **Co się dzieje, gdy ktoś kogoś obrazi?**
   - Zwykli gracze **nie widzą wyzwisk** — treść zostaje natychmiast ukryta pod tarczą ochronną:
     > *„🛡️ Wiadomość zablokowana przez filtr netykiety: przekazana do weryfikacji przez Administrację.”*
   - Sprawa w ułamku sekundy trafia do **Trybunału Dyscyplinarnego w Panelu Admina** z czerwonym alertem `🚨 Alert Moderacji Czatu`!

---

## ⚖️ 4. TRYBUNAŁ DYSCYPLINARNY — PUNKTY UJEMNE I KARTKI WIDOCZNE W TABELI!
W Panelu Administratora działa pod-zakładka: **`[ ⚖️ Trybunał Dyscyplinarny & Czat ]`**:

1. **Jak podejmujecie decyzję jako Zarząd?**
   - Widzicie zablokowaną wypowiedź, autora, datę i pokój.
   - Macie proste menu decyzyjne:
     - **Punkty ujemne:** Wybieracie `[-1 pkt]`, `[-2 pkt]`, `[-3 pkt]` lub `[-5 pkt]`.
     - **Kartki:** Wybieracie `🟨 Żółta kartka` lub `🟥 Czerwona kartka`.
     - **Zawieszenie:** Możecie zaznaczyć opcję `[x] Zawieś gracza w rozgrywkach`.
     - **Uzasadnienie:** Wpisujecie powód (np. *„Agresja słowna wobec rywala na czacie offtopic”*).
   - Klikacie **`[ ⚖️ Wydaj Wyrok i Odejmij Punkty w Tabeli ]`**.
2. **Jak kara pokazuje się w oficjalnej tabeli ligowej?**
   - **Punkty ujemne:** Liczba punktów gracza w tabeli od razu maleje (wpływa na pozycję w lidze), a obok nazwiska pojawia się czerwona etykieta, np. **`[-3 PKT]`**!
   - **Żółte i czerwone kartki:** Bezpośrednio przy nazwisku w tabeli wyświetlają się odznaki: **`🟨 1`** lub **`🟥 1`**.
   - **Zawieszenie:** Przy nazwisku pojawia się pulsujący napis **`⛔ ZAWIESZONY`**.
   - **Oficjalne ogłoszenie:** System automatycznie publikuje na kanale `📢 Komunikaty Zarządu` wpis informujący całą ligę o nałożonej karze.
3. **Możliwość ułaskawienia:** W Rejestrze Kar Admin może jednym kliknięciem wybrać **`[ 🔄 Ułaskawienie (Zdejmij karę) ]`** – punkty wracają do normy, a kartki znikają z tabeli.
4. **Ręczne nakładanie kar:** Możecie ukarać dowolnego zawodnika z listy także za przewinienia pozaczatowe (np. niestawienie się na mecz w terminie 4 kolejek na tydzień).

---

## 💬 5. WIADOMOŚCI PRYWATNE 1-NA-1 (PRIV / DMs) & 1-KLIKOWE UMAWIANIE MECZÓW
* **Prywatne rozmowy między dowolnymi graczami:** Gracz 2. Ligi może pisać na priv z rywalem z Ekstraklasy, umawiać termin meczu, przesyłać kody do pokoju w *Score! Match* lub kontaktować się z Adminem.
* **Nowoczesny interfejs:** Lista rozmów po lewej z licznikiem `NOWA`, dymki czatu po prawej ze znacznikami przeczytania (`✓✓ Przeczytana`).
* **1-klikowe przyciski "💬 Umów mecz (Priv)":**
  * W **Terminarzu**: przy każdym nierozegranym meczu pojawił się przycisk **`[ 💬 Umów mecz (Priv) ]`**, który od razu otwiera prywatny czat z rywalem i automatycznie wpisuje wiadomość: *"Cześć! Kiedy gramy nasz mecz kolejki X w Score! Match?"*.
  * W **Tabeli** i na **Karcie Gracza UT**: przycisk **`[ 💬 Napisz na Priv ]`**.
  * Szybkie szablony: *"Kiedy gramy mecz?"*, *"Mogę dziś po 20:00"*, *"Pokój założony, wbijaj!"*, *"Wynik wysłany do Admina ze screenem"*.

---

## 🔒 6. MAKSYMALNE BEZPIECZEŃSTWO SYSTEMU (LEPIEJ NIŻ W EXCELU — ZERO OSZUSTW)
Zgodnie z Waszymi wytycznymi system został zablokowany tak, aby żaden gracz nie mógł manipulować wynikami ani cudzymi danymi:

1. **Blokada podszywania się pod rywali:**
   - Usunięto możliwość dowolnego przełączania się między graczami.
   - Każdy zawodnik loguje się wyłącznie swoim hasłem.
   - Kliknięcie w zawodnika w tabeli otwiera **czysty tryb podglądu statystyk** (karta UT, bilans kariery, trofea) — brak jakiejkolwiek możliwości manipulacji.
2. **Zgłaszanie wyników wyłącznie ze swoich meczów:**
   - Gracz może wpisać wynik **tylko i wyłącznie dla meczu, w którym bierze udział** (jako Gospodarz lub Gość).
   - Goście i niezalogowani mają widok tylko do odczytu z etykietą `TRYB GOŚCIA`.
3. **Poczekalnia Moderacji (Kolejka Zgłoszeń):**
   - Wpisany przez gracza wynik **nie zmienia tabeli od razu!**
   - Wynik trafia do **Kolejki Moderacji Admina** ze statusem `OCZEKUJE NA ZATWIERDZENIE` wraz ze zrzutem ekranu (screenem).
   - Dopiero po weryfikacji i kliknięciu przez Admina **`[ ✅ Zatwierdź ]`**, punkty, bramki i czyste konta dopisują się do oficjalnej tabeli.
   - Admin ma też przycisk **`[ ❌ Odrzuć ]`** (z podaniem powodu) oraz **`[ ⚖️ Przyznaj Walkower 2:0 ]`**.

---

## 👑 7. JAK LOGUJE SIĘ ADMINISTRATOR / MASTER ADMIN?
Każdy Administrator loguje się **wyłącznie swoim indywidualnym loginem i hasłem**:

* **Wejście dla Administracji:**
  - Link: `PANEL-ADMINA.html` (lub `MASTER-SZYMON-KOMENDA.html` dla Master Admina).
  - System zawsze wymaga podania prywatnego **loginu / e-maila oraz hasła** (brak auto-logowania i brak podpowiedzi haseł na stronie).
  - Po pierwszym zalogowaniu w zakładce **Ustawienia** można od razu zmienić swój login, adres e-mail i hasło na własne.
* **Każdy gracz ma własne konto:**
  - Gracze logują się swoimi indywidualnymi danymi utworzonymi przy rejestracji lub ustawionymi przez Administratora.

---

## ⚽ 8. DWA TRYBY PRACY POD SEZON 56 (PEŁNA SWOBODA DLA ADMINÓW)

### 🚀 OPCJA 1: CZYSTE PUSTE TABELE (WY SAMI WPISUJECIE KTO GDZIE GRA)
Jeśli chcecie wystartować od zera i sami poukładać składy Ekstraklasy, 2. Ligi i 3. Ligi:
1. Wchodzicie do **Panelu Administratora**.
2. Na samej górze klikacie czerwony przycisk: **`[ 🗑️ Wyczyść Tabele (Pusty Start S56) ]`**.
3. Tabele we wszystkich ligach stają się **w 100% czyste**.
4. Dodajecie graczy na 2 proste sposoby:
   - **Ręcznie:** Klikacie przycisk **`[ ➕ Dodaj do L1 ]`**, **`[ ➕ Dodaj do L2 ]`** lub **`[ ➕ Dodaj do L3 ]`** i wpisujecie Imię, Nazwisko oraz Nick gracza.
   - **Ze zgłoszeń:** Nowy gracz sam rejestruje się na stronie `REJESTRACJA.html`, a Wy w zakładce **„📝 Lista do Dopisania”** klikacie **[ Dopisz do Ekstraklasy ]**, **[ Dopisz do 2. Ligi ]** lub **[ Dopisz do 3. Ligi ]**!
5. **Przenoszenie graczy:** Przy każdym zawodniku na liście w Panelu macie przyciski:
   - `[ 👑 Ekstraklasa ]`, `[ 🥈 2. Liga ]`, `[ 🥉 3. Liga ]` — jedno kliknięcie i gracz jest przeniesiony!
   - `[ ❌ Usuń ]` — jeśli gracz zrezygnuje.
6. **Wygenerowanie terminarza:** Gdy macie skompletowaną ligę, klikacie niebieski przycisk: **`[ 📅 Wygeneruj Terminarz (1-Klik) ]`** — system sam ułoży terminarz „każdy z każdym” (mecz i rewanż, po 4 kolejki na tydzień)!

---

### 📊 OPCJA 2: PEŁNY SKŁAD Z WASZEGO ARKUSZA EXCEL
Jeśli wolicie od razu mieć załadowanych 48 graczy z przesłanego arkusza Excel:
- Wystarczy kliknąć przycisk **`[ 📥 Przywróć z Excela ]`** — system natychmiast załaduje:
  - **Ekstraklasę (`L1`)**: Jan Joachimiak, Michał Wu, Dawid Walaszek, Rafał Warzecha, Mateusz Olczyk, Patryk Warzybok, Rafał Jończyk, Rafał Lewandowski, Piotr Pastuszak, Maciek Maciejewski, Marcin Chorobowicz, Michał Pełka, Krystian Rachwalski, Jakub Latuszek, Kacper Kurczewski, Krzysztof Dziubak.
  - **2. Ligę (`L2`)**: Patryk Dzierża, Paweł Kuśmicki, Krystian Bujak, Marcin Ptaszyna, Tomasz Fałat, WOLNY LOS 1, Kuba Zdrojewski, Michał Zawada, Łukasz Jawor, WOLNY LOS 4, Grzegorz Grzegorzyca, Piotr Sitny, WOLNY LOS 2, WOLNY LOS 3, Piotr Ciepichał, Adrian Baliński.
  - **3. Ligę (`L3`)**: Krystian Stępień, Piotr Ciepichał oraz miejsca Wolny los 1-14 pod nowych graczy z zapisów.
- Jeśli chcecie wyzerować wyniki meczów do `0:0`, klikacie zielony przycisk: **`[ 🔄 Wyzeruj 0:0 ]`**.

---

## 📅 9. SYSTEM ROZGRYWEK: 4 KOLEJKI NA TYDZIEŃ
* Terminarz podzielony na Tygodnie Rozgrywkowe (Tydzień 1 to Kolejki 1–4, Tydzień 2 to 5–8 itd.).
* Zasada z Przewodnika SMPL: **Gospodarz (po lewej) zaprasza Gościa do gry**.
* Mecze z **WOLNYM LOSEM** liczą się automatycznie jako walkower **2:0 (+3 pkt)**.
* **Gotowy raport na grupę Messenger / FB:** W Panelu Admina klikacie **`[ 📋 Wygeneruj Raport Tygodnia ]`** — system kopiuje do schowka gotowy, sformatowany tekst z tabelą i wynikami do wklejenia na grupę!

---

## 🃏 10. KARTY ZAWODNIKA ULTIMATE TEAM (EA FC STYLE) & GABLOTA TROFEÓW
* Każdy gracz posiada własną dynamiczną Kartę Zawodnika z ogólną oceną **OVR (75–99)**:
  - Tiers: `BRONZE`, `SILVER`, `GOLD`, `TOTW STAR`, `ICON LEGEND`.
  - Statystyki bazowe: Tempo (PAC), Strzał (SHO), Podania (PAS), Drybling (DRI), Obrona (DEF), Fizyczność (PHY).
* System wylicza: **Ulubionego Rywala** (z kim gracz najczęściej wygrywa), **Nemezis** (kto sprawia mu najwięcej problemów) oraz **Styl Gry**.
* **Gablota Trofeów:** Wyświetla wszystkie zdobyte puchary, medale mistrzowskie, króla strzelców i odznaki.
* **Dopisywanie statystyk z poprzednich lat (1 Klik):** Admin w profilu zawodnika klika **`[ 📚 Dopisz statystyki z poprzednich lat ]`** i jednym ruchem dodaje dorobek z dawnych sezonów!

---

## ⚽ 11. GŁOSOWANIE NA ZŁOTĄ PIŁKĘ (BALLON D'OR SMPL)
* Dedykowana podstrona do oficjalnego głosowania społeczności na Najlepszego Gracza Sezonu.
* Blokada wielokrotnego głosowania przez jedno konto.
* Wybór Laureata przez Zarząd i uroczyste przypisanie Trofeum Złotej Piłki do profilu gracza!

---

## 📚 12. WIELKIE ARCHIWUM HISTORII LIGI (S1–S55) & RANKING WSZECH CZASÓW
* **Archiwum Sezonów:** Pełne tabele końcowe, medaliści i królowie strzelców od Sezonu 1 do 55.
* **Tabela Wszech Czasów (All-Time Ranking):** Zbiorcza tabela historyczna sumująca punkty, rozegrane mecze, wygrane i bilanse bramek z całej historii polskiej ligi Score! Match.

---

## 🔑 13. SYSTEM ODZYSKIWANIA HASŁA (SELF-SERVICE + WSPARCIE ADMINA)
* Gracz, który zapomniał hasła, klika na ekranie logowania **`[ 🔑 Nie pamiętasz hasła? ]`**.
* Wpisuje swoje dane — system pokazuje mu podpowiedź oraz tworzy wniosek dla Zarządu.
* Administrator w zakładce Dopisania widzi zgłoszenie i jednym kliknięciem kopiuje gotową wiadomość z hasłem do wysłania na Messengerze (`[ 💬 Kopiuj wiadomość na Messenger ]`) lub resetuje hasło.

---

## ⚔️ 14. PORÓWNYWARKA HEAD-TO-HEAD (H2H)
* Wybierasz dwóch dowolnych graczy (np. z Ekstraklasy lub 2. Ligi).
* System generuje natychmiastowe porównanie bezpośrednich pojedynków:
  - Liczba spotkań, bilans zwycięstw, remisy, strzelone bramki.
  - Wykres przewagi i historia wszystkich bezpośrednich meczów.

---

## ⚖️ 15. ZABEZPIECZENIE PRAWNE ADMINISTRACJI (RODO, DSA, KLAUZULA ANTYHAZARDOWA)
Portal zabezpiecza Zarząd pod każdym względem prawnym:
1. **Art. 14 UŚUDE / Akt o Usługach Cyfrowych (DSA):** Wyłączenie odpowiedzialności Administracji za treści wgrywane przez graczy (procedura *Notice & Takedown*).
2. **Klauzula Antyhazardowa:** Zapis w regulaminie, że rozgrywki mają charakter w 100% zręcznościowy (*Skill-Based*), wpisowe wynosi 0 zł i nie ma nagród pieniężnych w rozumieniu Ustawy o grach hazardowych.
3. **RODO / GDPR (Prawo do bycia zapomnianym):** Gracz może w każdej chwili zażądać usunięcia lub anonimizacji swojego konta (`[ ⚖️ Zgłoś żądanie RODO ]`).

---

## ⚙️ 16. ZERO-CODE BACKEND NA KAŻDY SERWER (PHP + JSON)
Nie musisz konfigurować żadnych baz MySQL ani instalować oprogramowania:
* **`api.php`**: Samodzielny skrypt backendowy z atomową blokadą plików (`LOCK_EX`).
* **`data/smpl-db.json`**: Gotowa, kompletna baza danych ligi.
* **Kopie zapasowe i audyt:** System automatycznie tworzy `smpl-db.backup.json` oraz rejestruje wszystkie akcje w dzienniku `data/audit.log`.
* Działa na każdym hostingu (CyberFolks, cPanel, DirectAdmin, SeoHost, OVH, darmowe ct8.pl / InfinityFree, Netlify).

---

## 🎖️ 18. SYSTEM RANG PRESTIŻU (XP), TYTUŁY SPECJALNE & OZNACZANIE GRACZY NA CZACIE
Wprowadzono spektakularny system rang i wyróżnień robiący furorę w społeczności ligowej:
* **9-stopniowa drabina prestiżu XP:** Od *Nowicjusza* (🌱 0 XP), przez *Weterana* (⚔️ 1200 XP), *Mistrza* (👑 2200 XP), *Legendę* (💎 3600 XP), aż po status **G.O.A.T. — Greatest of All Time** (🐐 7500+ XP).
* **Automatyczne naliczanie XP:** Punkty doświadczenia sumują się z całej historii (rozegrane mecze, wygrane, złote/srebrne/brązowe medale, punkty w sezonie), z potrąceniem kar dyscyplinarnych.
* **Animowane efekty wizualne:**
  - Obracające się pierścienie wokół awatarów (`.rk-ring-*`).
  - Animowane tęczowe neony i błyski nazwisk (`.rk-name-*`).
  - Lśniące odznaki z gradientem widoczne na czacie, w profilach UT oraz w tabeli ligowej.
* **8 Tytułów Specjalnych nadawanych przez Zarząd:** Mistrz SMPL (👑), TOTW (🌟), Król Strzelców (🎯), Żelazna Ściana (🧱), Dżentelmen Fair Play (🕊️), Hype Master (🔥), VIP SMPL (💎), Debiut Sezonu (⭐).
* **System oznaczania graczy `@Gracz` na czacie:**
  - Dynamiczne menu podpowiedzi po wpisaniu znaku `@`.
  - Nawigacja klawiaturą (strzałki, Enter/Tab).
  - Wyróżnienie oznaczonej wiadomości fioletowym neonem.
  - Oznaczony zawodnik otrzymuje powiadomienie PUSH na telefonie oraz powiadomienie dźwiękowe (Web Audio API).
* **Generator zaproszeń na mecz:** Przycisk `[ 🎮 Zaproszenie na mecz ]` generuje unikalny kod do pokoju w Score! Match oraz gotowy szablon wiadomości do skopiowania jednym kliknięciem.

---

## 🔍 19. KOMPLEKSOWY AUDYT MODUŁU WYNIKÓW I GOTOWOŚĆ POD SEZON 56 (100% POPRAWNOŚCI)
Przeprowadzono pełny audyt end-to-end zgłaszania wyników, terminarza oraz tabeli Sezonu 56:
* **720 meczów w 3 ligach (L1, L2, L3):** Każda liga liczy dokładnie 16 zawodników i 30 kolejek w systemie 4 kolejek na tydzień (8 tygodni).
* **Bezpieczeństwo zgłaszania:** Zawodnicy mogą zgłaszać wyniki wyłącznie dla swoich własnych meczów z dołączeniem zrzutu ekranu lub automatycznie generowanej karty meczowej Score! Match.
* **Procedura weryfikacji:** Mecz oczekuje na decyzję Administratora (status `PENDING`). Po zatwierdzeniu przez Zarząd (`APPROVED`), tabela ligowa i klasyfikacja Czystych Kont przeliczają się natychmiastowo.
* **Automatyczne kary:** Punkty ujemne nałożone przez Trybunał Dyscyplinarny są automatycznie odejmowane w tabeli oficjalnej (`PKT = rawPKT - penaltyPoints`).
* **100% testów jednostkowych i symulacji zaliczonych pomyślnie** (`test_match_submission_flow.ps1` i `test_smpl_simulation.ps1`).

---

## 🌐 20. SCORE MATCH LIGA — ARCHITEKTURA WSZYSTKICH SEZONÓW W JEDNYM MIEJSCU
Portal został oficjalnie nazwany i przygotowany pod **Score Match Liga** jako centralna platforma obsługująca każdy sezon rozgrywek:
* **Interaktywny Selektor Sezonów:** Jeden klik na samej górze strony pozwala błyskawicznie przełączać się między:
  - ⚡ **Sezon 56 (Trwający / Live)** – bieżące terminarze, 720 spotkań, tabele na żywo i Czyste Konta.
  - ⏪ **Sezon 55** – pełna baza końcowa z arkusza Excel.
* **Archiwum Wszystkich Sezonów (S1–S55) & 9 Poziomów Rozgrywkowych:** Kompletna baza **55 sezonów (318 tabel ligowych S1–S55 w dywizjach L1–L9)**, Ranking Generalny (**216 graczy**), Ranking 5 Sezonów (**28 graczy**), Ranking Wszech Czasów All-Time (**131 legend**) oraz automatyczne przeliczanie trofeów (**248 zawodników**), z filtrowaniem dekad (`S45–55`, `S30–44`, `S15–29`, `S1–14`) i podglądem pełnej kariery każdego gracza.
* **Globalny Branding:** Zaktualizowane meta-tytuły, ikony PWA, manifest aplikacji (`Score Match Liga`), nagłówki i panele administracyjne.

---

## 💀 21. OFICJALNA CZARNA LISTA LIGI (DOŻYWOTNI BAN / PERSONA NON GRATA) & RANGA HAŃBY
Zgodnie z poleceniem Zarządu, wprowadzono bezwzględny system wykluczania oszustów i graczy toksycznych:
* **Specjalna Ranga Hańby:** `💀 CZARNA LISTA • DOŻYWOTNI BAN` (Persona Non Grata).
  - Ciemnoczerwony, pulsujący styl ostrzegawczy z motywem czaszki i pasków ostrzegawczych (`.rk-blacklisted`).
  - Przekreślone na czerwono nazwisko z efektem neonowego glitcha (`.rk-name-blacklisted`).
  - Mroczny, krwawy pierścień wokół awatara (`.rk-ring-blacklisted`).
* **Całkowita Blokada Bezpieczeństwa w Kodzie:**
  - **Blokada logowania:** Próba wejścia kończy się natychmiastowym odrzuceniem, uderzeniem młotka sędziowskiego (Web Audio API) i czerwonym oknem ostrzegawczym.
  - **Blokada zgłaszania wyników:** Mecz z udziałem zbanowanego jest automatycznie blokowany.
  - **Blokada czatu:** Całkowity zakaz wysyłania wiadomości publicznych i prywatnych.
  - **Blokada rejestracji:** Odrzucenie wniosków o dołączenie do ligi z danych z Czarnej Listy.
* **Zarządzanie w Panelu Administratora:**
  - Nowa pod-zakładka: `💀 Czarna Lista (Dożywotni Ban)`.
  - Możliwość natychmiastowego wykluczenia gracza z aktywnych kadr lub dopisania nowej osoby wraz z podaniem szczegółowego uzasadnienia (np. lag-switch, fałszowanie screenów, agresja).
  - Opcja ułaskawienia i zdjęcia bana w uzasadnionych przypadkach.
* **Widok Publiczny dla Społeczności:**
  - Dostępny z górnego menu i stopki: `💀 Czarna Lista`.
  - Oficjalny pręgierz ligowy ostrzegający społeczność o osobach trwale wykluczonych z zakazem rozgrywania z nimi meczów.

---

## 🛠️ 22. GŁĘBOKI AUDYT TECHNICZNY I ZOPTYMALIZOWANA BAZA PRODUKCYJNA (v5)
Przeprowadzono szczegółowy audyt kodu JS, HTML, CSS, Service Workera oraz bazy danych JSON:
* **Weryfikacja składni i logiki ES6:** Naprawiono wszystkie błędy składniowe (m.in. szablony w `js/ranks.js`, brakujący nawias w `js/ui-views.js`, kolizje zmiennych w `js/api-client.js` i `js/app.js`), usunięto zdublowane widoki czatu oraz naprawiono obsługę przycisków i modali.
* **Czyste kodowanie UTF-8:** Wyczyszczono wszystkie błędy kodowania polskich znaków (`mojibake`) we wszystkich modułach interfejsu, herbów SVG i komunikatów.
* **Spójny Branding „Score Match Liga”:** Ujednolicono nazewnictwo całej platformy (tytuły, stopka, herby SVG, dowody meczowe, formularze rejestracji, panele admina), pozostawiając numer sezonu wyłącznie przy bieżących tabelach, wynikach, terminarzu oraz archiwum konkretnych sezonów.
* **Rozbudowa Archiwum z Excela:** Zaimportowano kompletne 17 arkuszy Excela do zoptymalizowanej bazy (`data/smpl-db.json`, `js/archive-data.js`, `js/seed-data.js`) z automatyczną funkcją dogrywania danych historycznych `enrichFromArchive()` dla istniejących baz na serwerze i w przeglądarce.
* **Aktualizacja PWA Cache:** Podbicie Service Workera (`sw.js`) do wersji **`smpl-pwa-v6`**, gwarantujące automatyczne pobranie nowej wersji przez telefony graczy.

---

## 💎 23. DYNAMICZNY SYSTEM RANG, ODZNAK I PRESTIŻU (LIQUID GLASS BADGES)
Wprowadzono nowoczesny, automatyczny system szklanych odznak (**Liquid Glass Badges**), które na żywo wyliczają osiągnięcia, OVR, pozycję w tabeli, statystyki bramek i czystych kont oraz historię z sezonów `S1–S55`:
* **5 Automatycznych Odznak Prestiżu:**
  1. 👑 **LEGENDA LIGI (MISTRZ)** — Najwyższa złota odznaka z pulsującą poświatą dla panującego Mistrza Ekstraklasy (S54) oraz aktualnego lidera `#1` Ekstraklasy (S56).
  2. 🔥 **ELITA / TOP SNAJPER** — Srebrno-złota odznaka Liquid Glass dla czołówki tabeli (miejsca `2–4`) oraz liderów klasyfikacji strzelców.
  3. 🛡️ **ŻELAZNA DEFENSYWA** — Stalowo-grafitowa odznaka z ikoną tarczy i rękawicy (`🛡️🧤`) dla liderów rankingu „Złote Rękawice / Czyste Konta”.
  4. ⚡ **WETERAN / STALOWY FILAR** — Brązowo-szklana odznaka dla zawodników ze stażem powyżej 3 sezonów lub z frekwencją `≥ 95%` rozegranych meczów w terminie.
  5. 🚀 **DEBIUTANT / ŚWIEŻA KREW** — Niebiesko-miedziana odznaka startowa dla nowych graczy dołączających do 2. Ligi lub 3. Ligi (`L3`).
* **Widoczność w całym portalu:** Szklane odznaki oraz dopasowane pierścienie i mini-medaliony przy awatarach wyświetlają się na **Karcie Zawodnika (UT Card + Panel Prestiżu)**, w **Tabeli Ligowej**, klasyfikacji **Czystych Kont**, szybkim podglądzie gracza i na **Czacie**.
* **Interaktywny Szklany Tooltip (Pop-up):** Kliknięcie dowolnej rangi w tabeli lub przy awatarze otwiera półprzezroczysty, szklany dymek z dokładnym wyjaśnieniem powodu przyznania odznaki (np. *„Mistrzostwo Ekstraklasy S54 (61 pkt, 18Z)”*, *„Lider Złotych Rękawic — czyste konta”*, staż sezonów i statystyki `OVR`).

---

## 💻 24. NAPRAWA URUCHAMIANIA NA KOMPUTERACH PC WINDOWS & POPRAWKI STABILNOŚCI (v7)
Wykryto i wyeliminowano przyczyny zawieszania się i problemów z uruchamianiem portalu na PC:
* **Naprawa serwera lokalnego ([`server.ps1`](file:///C:/Users/Małgorzata/.gemini/antigravity/scratch/smpl-sezon-55/server.ps1)):**
  - Usunięto krytyczne zawieszenie przy każdym zapisie (`POST /api.php`): serwer odczytuje teraz dokładną liczbę **bajtów** z `Content-Length` zamiast znaków UTF-16 (wcześniej polskie znaki i emoji powodowały nieskończone oczekiwanie).
  - Dodano nieblokującą kolejkę połączeń i obsługę zarówno `127.0.0.1`, jak i `::1` (`localhost`), aby puste połączenia wyprzedzające (preconnect) z Chrome/Edge nie blokowały ładowania strony.
  - Automatyczne wykrywanie działającej już instancji oraz automatyczne przełączenie na wolny port z zakresu `3055–3065` zamiast zamykania okna błędem zajętego portu.
* **Naprawa skryptów startowych `.bat` (`URUCHOM-SCORE-MATCH-LIGA.bat`, `URUCHOM-SMPL-SEZON-56.bat`, `URUCHOM-SMPL-SEZON-55.bat`):** Zapis w formacie Windows CRLF (`\r\n`), dodane `cd /d "%~dp0"`, wykrywanie uruchomienia bez wypakowania paczki `.zip` oraz automatyczny start serwera na porcie `3055` z bezpiecznym fallbackiem do `index.html`.
* **Bezpośrednia rejestracja (`REJESTRACJA.html`):** Wejście na dedykowany adres rejestracji automatycznie kieruje na formularz rejestracji zamiast zatrzymywać użytkownika na zakładce logowania.
* **Service Worker (`smpl-pwa-v7`):** Wykluczenie zapytań `/api.php` i `/api/state` z buforowania offline.
* **Oczyszczenie danych startowych i archiwum:** Naprawiono uszkodzone emotikony brązowych medali (`🥉`) oraz resztki kodowania w `js/seed-data.js`, `js/archive-data.js` i `data/smpl-db.json`.

---

## 📦 25. GOTOWE PACZKI DO POBRANIA

1. [**`PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip`**](file:///C:/Users/Małgorzata/.gemini/antigravity/scratch/smpl-sezon-55/PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip) – **Główna oficjalna paczka produkcyjna Score Match Liga** (Wszystkie Sezony S1–S55 + live Sezon 56, 318 tabel historycznych L1–L9, PWA w pionie i poziomie, Czarna Lista z dożywotnim banem, czat z moderacją agresji i oznaczaniem `@Gracz`, system rang prestiżu XP, Trybunał Dyscyplinarny, zero-code PHP/Node backend).
2. [**`PACZKA-NA-SERWER-SMPL-SEZON-56.zip`**](file:///C:/Users/Małgorzata/.gemini/antigravity/scratch/smpl-sezon-55/PACZKA-NA-SERWER-SMPL-SEZON-56.zip) – Paczka zaktualizowana (kompatybilna nazwa pliku dla hostingu).
3. [**`PACZKA-NA-SERWER-SMPL-SEZON-55.zip`**](file:///C:/Users/Małgorzata/.gemini/antigravity/scratch/smpl-sezon-55/PACZKA-NA-SERWER-SMPL-SEZON-55.zip) – Kopia archiwalna paczki.
4. [**`INSTRUKCJA-WRZUCENIA-NA-SERWER.md`**](file:///C:/Users/Małgorzata/.gemini/antigravity/scratch/smpl-sezon-55/INSTRUKCJA-WRZUCENIA-NA-SERWER.md) – Instrukcja instalacji w 1 minutę.
