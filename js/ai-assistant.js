/**
 * SCORE MATCH LIGA — VANESSA AI (SAMOUCZĄCA SIĘ ASYSTENTKA PORTALU I APLIKACJI)
 * - Działa od razu bez płatnych kluczy API (wspólna baza wiedzy w data/smpl-db.json)
 * - Rozpoznaje polskie zdania, slang graczy, odmianę wyrazów i literówki
 * - Personalizuje podpowiedzi pod aktualny stan konta (gość / gracz L1-L3 / admin / blokady)
 * - Uczy się na bieżąco: z ocen 👍/👎 graczy oraz 1-kliknięciem z odpowiedzi Administracji
 */

window.SMPL_AI = (function () {
  const ASSISTANT_NAME = 'Vanessa';
  const ASSISTANT_SUBTITLE = 'Asystentka AI • Wsparcie Score Match Ligi';

  const STOP_WORDS = {
    a: 1, aby: 1, albo: 1, ale: 1, ani: 1, az: 1, bardzo: 1, bez: 1, bo: 1,
    by: 1, choc: 1, co: 1, cos: 1, czy: 1, dla: 1, dlaczego: 1, do: 1, dobrze: 1,
    gdzie: 1, go: 1, i: 1, ich: 1, ile: 1, im: 1, iz: 1, ja: 1, jak: 1,
    jaki: 1, jakie: 1, jest: 1, jestem: 1, juz: 1, kiedy: 1, kto: 1, ktos: 1,
    lub: 1, ma: 1, mam: 1, maja: 1, mnie: 1, mi: 1, moge: 1, mozna: 1, moj: 1,
    moja: 1, moje: 1, na: 1, nad: 1, nam: 1, nas: 1, nie: 1, nic: 1, no: 1,
    o: 1, od: 1, ok: 1, on: 1, ona: 1, po: 1, pod: 1, pojac: 1, pomoc: 1,
    pomoz: 1, prosze: 1, przed: 1, przez: 1, przy: 1, sie: 1, sobie: 1,
    sa: 1, ta: 1, tak: 1, tam: 1, te: 1, tego: 1, tej: 1, ten: 1, teraz: 1,
    to: 1, tu: 1, tutaj: 1, twoj: 1, twoja: 1, ty: 1, u: 1, w: 1, we: 1,
    wiec: 1, wszystko: 1, z: 1, za: 1, ze: 1, zeby: 1, zrobic: 1
  };

  // Mapa potocznego slangu graczy -> kanoniczne pojęcia domenowe
  const SYNONYM_MAP = {
    skrin: 'screen',
    skrina: 'screen',
    skriny: 'screen',
    screenshot: 'screen',
    zrzut: 'screen',
    fota: 'screen',
    fotka: 'screen',
    fotke: 'screen',
    zdjecie: 'screen',
    zdjecia: 'screen',
    obrazek: 'screen',
    dowod: 'screen',
    apka: 'aplikacja',
    apke: 'aplikacja',
    apki: 'aplikacja',
    appka: 'aplikacja',
    app: 'aplikacja',
    pwa: 'aplikacja',
    ikona: 'ikona',
    ikonka: 'ikona',
    pulpit: 'pulpit',
    tel: 'telefon',
    telef: 'telefon',
    telefonie: 'telefon',
    komorka: 'telefon',
    komorce: 'telefon',
    smartfon: 'telefon',
    iphone: 'iphone',
    ios: 'iphone',
    safari: 'iphone',
    apple: 'iphone',
    android: 'android',
    chrome: 'android',
    priv: 'messenger',
    pw: 'messenger',
    prv: 'messenger',
    prywatna: 'messenger',
    prywatnie: 'messenger',
    direct: 'messenger',
    wiadomosc: 'wiadomosc',
    wiadomosci: 'wiadomosc',
    notyfikacje: 'powiadomienia',
    notyfikacja: 'powiadomienia',
    alert: 'powiadomienia',
    alerty: 'powiadomienia',
    dzwonek: 'powiadomienia',
    push: 'powiadomienia',
    haslo: 'haslo',
    hasla: 'haslo',
    pass: 'haslo',
    password: 'haslo',
    pin: 'haslo',
    przypomnij: 'przypomnienie',
    zapomnialem: 'przypomnienie',
    zapomnialam: 'przypomnienie',
    sklad: 'sklad',
    sklady: 'sklad',
    skladow: 'sklad',
    skladem: 'sklad',
    taktyka: 'sklad',
    taktyki: 'sklad',
    formacja: 'sklad',
    formacje: 'sklad',
    ludzikow: 'sklad',
    zawodnikow: 'sklad',
    timeout: 'timeout',
    mute: 'timeout',
    wycisz: 'timeout',
    wyciszony: 'timeout',
    wyciszenie: 'timeout',
    blokada: 'ban',
    zbanowany: 'ban',
    zbanowano: 'ban',
    bana: 'ban',
    bany: 'ban',
    karny: 'kara',
    odejmowanie: 'odejmowanie',
    odjeto: 'odejmowanie',
    odjal: 'odejmowanie',
    odjetych: 'odejmowanie',
    ujemne: 'odejmowanie',
    minus: 'odejmowanie',
    pkt: 'punkty',
    punktow: 'punkty',
    punkt: 'punkty',
    l1: 'l1',
    ekstraklasa: 'l1',
    ekstraklasie: 'l1',
    l2: 'l2',
    l3: 'l3',
    pokoje: 'kanal',
    pokoj: 'kanal',
    pokoju: 'kanal',
    kanaly: 'kanal',
    czat: 'messenger',
    chat: 'messenger',
    chacie: 'messenger',
    czacie: 'messenger',
    ranga: 'ranga',
    rangi: 'ranga',
    odznaka: 'ranga',
    odznaki: 'ranga',
    badge: 'ranga',
    tytul: 'ranga',
    xp: 'xp',
    goat: 'xp',
    legenda: 'xp',
    rejestracja: 'rejestracja',
    zarejestrowac: 'rejestracja',
    zapisy: 'rejestracja',
    zapisac: 'rejestracja',
    dolaczyc: 'rejestracja',
    konto: 'konto',
    konta: 'konto',
    weteran: 'historia',
    wczesniej: 'historia',
    dawniej: 'historia',
    stare: 'historia',
    s1: 'historia',
    s55: 'historia',
    archiwum: 'historia',
    staty: 'historia',
    statystyki: 'historia',
    mecz: 'mecz',
    mecze: 'mecz',
    wynik: 'wynik',
    wyniki: 'wynik',
    kolejka: 'kolejka',
    terminarz: 'kolejka',
    walkower: 'walkower',
    wo: 'walkower',
    awans: 'awans',
    spadek: 'awans',
    spadki: 'awans',
    awanse: 'awans',
    s56: 'sezon',
    s57: 'sezon',
    sezon: 'sezon',
    nowy: 'sezon',
    poczekalnia: 'oczekujacy',
    oczekujacych: 'oczekujacy',
    akceptacja: 'oczekujacy',
    odswieza: 'odswiezanie',
    odswiezyc: 'odswiezanie',
    cache: 'odswiezanie',
    nieaktualne: 'odswiezanie',
    blad: 'blad',
    psuje: 'blad',
    niedziala: 'blad',
    klan: 'klan',
    klanu: 'klan',
    klanie: 'klan',
    klany: 'klan',
    druzyna: 'klan',
    team: 'klan',
    herb: 'klan',
    herbu: 'klan',
    logo: 'klan',
    zaczac: 'start',
    poczatek: 'start',
    pierwszy: 'start',
    pierwsze: 'start',
    kroki: 'start',
    krok: 'start',
    poradnik: 'start',
    instrukcja: 'start',
    jak: 'jak',
    zagrac: 'towarzyski',
    towarzyski: 'towarzyski',
    friendly: 'towarzyski',
    pokoju: 'towarzyski',
    kod: 'towarzyski',
    gospodarz: 'towarzyski',
    przeciwnik: 'rywal',
    przeciwnika: 'rywal',
    wirus: 'bezpieczenstwo',
    wirusy: 'bezpieczenstwo',
    wirusow: 'bezpieczenstwo',
    bezpieczna: 'bezpieczenstwo',
    bezpieczny: 'bezpieczenstwo',
    bezpiecznie: 'bezpieczenstwo',
    certyfikat: 'bezpieczenstwo',
    virustotal: 'bezpieczenstwo',
    antywirus: 'bezpieczenstwo',
    ssl: 'bezpieczenstwo',
    https: 'bezpieczenstwo',
    pomoc: 'pomoc'
  };

  function stripPl(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/ą/g, 'a')
      .replace(/ć/g, 'c')
      .replace(/ę/g, 'e')
      .replace(/ł/g, 'l')
      .replace(/ń/g, 'n')
      .replace(/ó/g, 'o')
      .replace(/ś/g, 's')
      .replace(/ź/g, 'z')
      .replace(/ż/g, 'z');
  }

  function normalizeText(str) {
    return stripPl(str)
      .replace(/[^a-z0-9@\s_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stemToken(tok) {
    if (!tok) return '';
    const t = SYNONYM_MAP[tok] || tok;
    if (t.length >= 6) return t.slice(0, 5);
    return t;
  }

  function tokenize(str) {
    const norm = normalizeText(str);
    if (!norm) return [];
    const raw = norm.split(' ');
    const out = [];
    const seen = {};
    for (let i = 0; i < raw.length; i++) {
      const w = raw[i];
      if (!w || STOP_WORDS[w]) continue;
      const canonical = SYNONYM_MAP[w] || w;
      if (!seen[canonical]) {
        seen[canonical] = true;
        out.push(canonical);
      }
    }
    return out;
  }

  function levenshtein(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    const m = s.length;
    const n = t.length;
    if (!m) return n;
    if (!n) return m;
    if (Math.abs(m - n) > 2) return 99;
    const prev = [];
    const curr = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        let minVal = prev[j] + 1;
        if (curr[j - 1] + 1 < minVal) minVal = curr[j - 1] + 1;
        if (prev[j - 1] + cost < minVal) minVal = prev[j - 1] + cost;
        curr[j] = minVal;
      }
      for (let j = 0; j <= n; j++) prev[j] = curr[j];
    }
    return prev[n];
  }

  // Pełna Baza Wiedzy Startowej SMPL (pokrywa typowe pytania graczy na starcie i podczas ligi)
  const BASE_KB = [
    {
      id: 'KB_SECURITY_SHIELD',
      category: 'Prywatność & Zasady',
      title: 'Czy portal SMPL jest bezpieczny? Wirusy, SSL i Certyfikat 0/94 VirusTotal',
      keywords: ['bezpieczenstwo', 'wirus', 'certyfikat', 'virustotal', 'ssl', 'https', 'antywirus', 'dane', 'telefon', 'plik'],
      learnedPhrases: ['czy ta strona jest bezpieczna', 'czy tu sa wirusy', 'boje sie wejsc w link', 'certyfikat bezpieczenstwa smpl', 'virustotal 0 94'],
      answer: 'Portal **Score Match Liga (SMPL)** jest w **100% bezpieczną aplikacją webową PWA/HTML** działającą przez szyfrowane połączenie **SSL/HTTPS**. Przeszedł niezależną weryfikację w ponad **90 silnikach antywirusowych (VirusTotal: 0/94 zagrożeń, Google Safe Browsing, ESET, Bitdefender, Kaspersky, Sucuri)**. Strona NIGDY nie pobiera na telefon plików `.apk`/`.exe`, nie wyświetla reklam i nie prosi o e-mail ani numer telefonu. Kliknij odznakę **„🛡️ Bezpieczna • 0/94”** w górnym pasku lub **„🛡️ Certyfikat Bezpieczeństwa”** w menu, aby otworzyć **Centrum Bezpieczeństwa SMPL** i uruchomić skaner sesji na żywo!'
    },
    {
      id: 'KB_REGISTER_NEW',
      category: 'Start & Konto',
      title: 'Jak założyć konto i zapisać się do ligi?',
      keywords: ['rejestracja', 'zapisy', 'konto', 'zapisac', 'dolaczyc', 'nowy', 'start', 'formularz', 'oczekujacy'],
      learnedPhrases: ['jak sie zapisac', 'jak zalozyc konto', 'chce zagrac w lidze', 'gdzie sie rejestrowac'],
      answer: 'Wejdź w zakładkę „Zapisy” (lub stronę REJESTRACJA.html), wpisz Imię i Nazwisko, swój nick ze Score! Match, link Messenger/FB oraz ustaw prywatne hasło (min. 4 znaki). Wybierz też swój **klan** z listy (lub dodaj własny z logo!). Po wysłaniu trafiasz na Listę Oczekujących — Administracja przydzieli Cię do Ekstraklasy (L1), 2. Ligi (L2) lub 3. Ligi (L3).'
    },
    {
      id: 'KB_NEW_PLAYER_CHECKLIST',
      category: 'Start & Konto',
      title: 'Pierwsze kroki nowego gracza — jak zacząć od A do Z?',
      keywords: ['start', 'poczatek', 'kroki', 'nowy', 'jak', 'poradnik', 'instrukcja', 'przewodnik', 'odnalezc'],
      learnedPhrases: ['jestem nowy jak zaczac', 'co mam zrobic na start', 'pierwsze kroki w lidze', 'jak dziala ta strona'],
      answer: 'Witaj w Score Match Liga! Oto Twój szybki start w 5 krokach:\n1️⃣ **Zapisy & Klan**: Załóż konto w „📝 Zapisy”, wybierz swój klan (albo dodaj nowy + własne logo!) i zaznacz checkbox RODO.\n2️⃣ **Przydział do ligi**: Gdy Admin przeniesie Cię z Listy Oczekujących do L1/L2, pojawiasz się w tabeli i terminarzu swojej ligi.\n3️⃣ **Umawianie na Messengerze**: Wejdź w „📅 Terminarz”, sprawdź rywala na bieżące kolejki i kliknij „💬 Napisz na Messengerze” lub „📅 Kiedy Gramy?”.\n4️⃣ **Dwumecz do max 2 bramek**: W trybie Friendly gry **Score! Match** rozgrywacie **2 mecze: 1 u siebie + 1 na wyjeździe** (każdy do max 2 goli, bez 2:2) i robicie po screenie (SS) z obu spotkań.\n5️⃣ **Wysyłka obu wyników + SS**: W „➕ Wynik” wpisujecie **oba wyniki + oba SS** (a przy sporze VAR lub W.O. obowiązkowo załączasz SS dlaczego!) — dopiero wtedy Admini zatwierdzają mecze i tabela aktualizuje się na żywo!'
    },
    {
      id: 'KB_CLANS_BADGES',
      category: 'Klany & Herby',
      title: 'Wybór klanu, dopisanie własnego klanu i wgranie logo',
      keywords: ['klan', 'klany', 'herb', 'logo', 'druzyna', 'team', 'tag', 'dodac', 'brak', 'lista'],
      learnedPhrases: ['jak dodac swoj klan', 'nie ma mojego klanu na liscie', 'gdzie wgrac logo klanu', 'jak wybrac klan'],
      answer: 'Podczas rejestracji (ekran startowy lub zakładka „📝 Zapisy”) w polu **„Klub / Klan Score! Match”** wybierz swój klan z listy. Jeśli Twojego klanu jeszcze tam nie ma, kliknij ostatnią opcję **„➕ Mojego klanu nie ma na liście”** — wpisz nazwę klanu, 2–6 znakowy Tag (np. PLG), wybierz kolor i wgraj własne logo/herb (PNG/JPG/WEBP z zachowaniem przezroczystości lub automatyczny herb SVG). Logo wyświetli się od razu przy Twoim nicku w tabeli i na Karcie UT!'
    },
    {
      id: 'KB_HOW_TO_PLAY_FRIENDLY',
      category: 'Mecze & Wyniki',
      title: 'Jak rozegrać dwumecz ligowy w grze Score! Match (Dom / Wyjazd, max 2 bramki)?',
      keywords: ['towarzyski', 'friendly', 'kod', 'pokoju', 'gospodarz', 'gosc', 'zagrac', 'zaprosic', 'mecz', 'dwumecz', 'rewanz', 'bramek', 'bramki', 'max'],
      learnedPhrases: ['jak zagrac mecz w grze', 'do ilu bramek gramy', 'ile bramek max w lidze', 'czy gramy dwumecz u siebie i na wyjezdzie'],
      answer: 'W **Score Match Liga (SMPL)** każda para gra **dwumecz: 1 mecz U SIEBIE (Gospodarz) + 1 mecz NA WYJEŹDZIE (Rewanż)** — mecze w grze *Score! Match* rozgrywa się do **max 2 bramek** (dozwolone wyniki 0–2, np. `2:0`, `2:1`, `1:0`, `1:1`, `0:0`, bez `2:2`; walkower `2:0 WO` nakłada tylko Admin). Gospodarz zakłada pokój **Friendly / Towarzyski**, po dwóch meczach robicie **2 screeny (SS)** i wysyłacie **oba wyniki razem** w „➕ Wynik”!'
    },
    {
      id: 'KB_HISTORY_S1_S55',
      category: 'Start & Konto',
      title: 'Grałem wcześniej (S1–S55) — jak odzyskać swoją historię?',
      keywords: ['historia', 'archiwum', 'weteran', 'wczesniej', 'dawniej', 'statystyki', 'sezon', 'lista', 'profil'],
      learnedPhrases: ['gralem wczesniej', 'stare sezony', 'moja historia s1 s55', 'polaczyc historie', 'nie ma mojej historii'],
      answer: 'Podczas rejestracji zaznacz okienko „Tak — grałem wcześniej w lidze (S1–S55)” i wybierz swoje imię/nazwisko z listy archiwum. Po zaakceptowaniu przez Admina cała Twoja kariera z sezonów 1–55 (mecze, punkty, medale i rangi XP) automatycznie połączy się z Twoim profilem i Kartą UT. Jeśli już założyłeś konto bez tego, napisz do Admina na Messengerze — podepnie historię ręcznie w 10 sekund!'
    },
    {
      id: 'KB_SQUADS_SECRET',
      category: 'Prywatność & Zasady',
      title: 'Czemu nie podajemy składów / formacji?',
      keywords: ['sklad', 'sklady', 'taktyka', 'formacja', 'tajemnica', 'ukryte', 'sekret', 'gdzie wpisac sklad'],
      learnedPhrases: ['czemu nie ma skladow', 'gdzie dodac swoj sklad', 'czy widac moj sklad', 'kto widzi moja taktyke'],
      answer: 'W Score Match Lidze składy i ustawienia zawodników są ściśle tajne! Celowo usunęliśmy pola na składy w rejestracji, profilach i kartach UT, żeby żaden rywal nie podglądał Twojej taktyki przed meczem.'
    },
    {
      id: 'KB_LOGIN_GUEST',
      category: 'Start & Konto',
      title: 'Logowanie na konto i różnica względem trybu Gościa',
      keywords: ['zalogowac', 'login', 'gosc', 'bramka', 'wejscie', 'wyloguj', 'sesja'],
      learnedPhrases: ['jak sie zalogowac', 'co moze gosc', 'czemu nie moge pisac jako gosc'],
      answer: 'Na ekranie startowym wpisz swoje Imię/Nick oraz hasło ustawione podczas rejestracji. Tryb „Przeglądaj jako Gość” pozwala oglądać tabele i terminarz, ale NIE daje dostępu do wysyłania wyników meczów, propozycji terminów „Kiedy Gramy?” ani zgłaszania sporów VAR / W.O.'
    },
    {
      id: 'KB_PASSWORD_FORGOT',
      category: 'Start & Konto',
      title: 'Zapomniałem hasła lub chcę je zmienić',
      keywords: ['haslo', 'przypomnienie', 'zapomnialem', 'reset', 'zmienic', 'zmiana', 'odzyskac'],
      learnedPhrases: ['zapomnialem hasla', 'nie pamietam hasla', 'jak zmienic haslo', 'zresetuj haslo'],
      answer: 'Jeśli nie pamiętasz hasła, kliknij „🔑 Zapomniałeś hasła? Przypomnij / Wyślij prośbę do Admina” w ekranie logowania — Szymon albo Współadmin wyśle Ci tymczasowy reset. Po zalogowaniu w dowolnej chwili ustawisz własne hasło przyciskiem „🔑 Zmień moje hasło”.'
    },
    {
      id: 'KB_SUBMIT_MATCH_SCREEN',
      category: 'Mecze & Wyniki',
      title: 'Jak wysłać oba wyniki dwumeczu (max 2 bramki) i screeny SS?',
      keywords: ['wynik', 'wyniki', 'mecz', 'dwumecz', 'rewanz', 'usiebie', 'wyjezdzie', 'bramek', 'max', 'screen', 'dodac', 'wyslac', 'zatwierdzic', 'zglosic', 'zdjecie', 'limit'],
      learnedPhrases: ['jak dodac wynik', 'gdzie wyslac screena', 'nie dziala zdjecie wyniku', 'czekam na akceptacje wyniku', 'czy podajemy oba wyniki dwumeczu', 'do ilu bramek sie gra w lidze'],
      answer: 'W lidze SMPL gramy do **max 2 bramek** w meczu oraz **dwumecz (1 u siebie + 1 na wyjeździe)**! Wejdź w „➕ Wynik” (albo kliknij „➕ Wpisz wynik (+SS)” w Terminarzu), system automatycznie otworzy **oba mecze pary**:\n1️⃣ Wpisz wynik 1. meczu (0–2 bramki) + wgraj **SS #1**.\n2️⃣ Wpisz wynik rewanżu (0–2 bramki) + wgraj **SS #2**.\n3️⃣ Wyślij komplet — **Admini zatwierdzają oba wyniki dopiero po otrzymaniu kompletu screenów (SS)**, a wtedy tabela, H2H, Czyste Konta i Karta UT aktualizują się automatycznie!'
    },
    {
      id: 'KB_SCORING_RULES',
      category: 'Mecze & Wyniki',
      title: 'Punktacja, kolejność w tabeli, Czyste Konta i Złota Piłka',
      keywords: ['punkty', 'tabela', 'remis', 'wygrana', 'bilans', 'bramki', 'czyste', 'konta', 'zlota', 'pilka'],
      learnedPhrases: ['ile punktow za wygrana', 'co decyduje w tabeli', 'jak dzialaja czyste konta', 'jak glosowac na zlota pilke'],
      answer: 'Zwycięstwo daje 3 PKT, remis 1 PKT, a przegrana 0 PKT. O kolejności w tabeli decydują punkty, mała tabela H2H, bilans i zdobyte bramki. W plebiscycie **„Złota Piłka”** ranking łączy **75% obliczeń boiskowych SI** (dominacja punktowa z wagą ligi L1>L2, skuteczność, czyste konta, forma i Fair Play) + **25% głosy graczy**, przy ścisłym limicie **1 gracz = maksymalnie 1 głos** i **zakazie głosowania na siebie**!'
    },
    {
      id: 'KB_DIVISIONS_PROMO',
      category: 'Ligi & Sezony',
      title: 'Jak działają ligi oraz awanse i spadki?',
      keywords: ['l1', 'l2', 'l3', 'l4', 'awans', 'spadek', 'dywizja', 'ekstraklasa', 'liga'],
      learnedPhrases: ['czym sie rozni l1 od l2', 'kto awansuje', 'kto spada', 'jak przejsc wyzej', 'czy jest l3'],
      answer: 'Aktualnie bazowymi aktywnymi ligami są Ekstraklasa (L1 — najwyższa liga) oraz 2. Liga (L2). Gdy zgłosi się więcej chętnych, Administracja może jednym kliknięciem dodać kolejne ligi (np. 3. Ligę L3, 4. Ligę L4). Na koniec sezonu system obsługuje awanse i spadki między aktywnymi poziomami.'
    },
    {
      id: 'KB_MESSENGER_CONTACT',
      category: 'Kontakt & Messenger',
      title: 'Umawianie meczów wyłącznie na Messengerze (brak czatu/DM w portalu)',
      keywords: ['messenger', 'kontakt', 'facebook', 'priv', 'dm', 'czat', 'chat', 'napisac', 'umowic', 'kod'],
      learnedPhrases: ['gdzie jest czat', 'gdzie napisac priv', 'jak kogos zlapac', 'czemu nie ma czatu'],
      answer: 'Wewnętrzny czat i DM zostały wyłączone — wszystkie mecze umawiamy bezpośrednio na **Messengerze**! W „📅 Terminarz” lub na Karcie UT kliknij **„💬 Napisz na Messengerze”**: system wygeneruje bezpieczny kod pokoju bez cyfr, skopiuje zaproszenie do schowka i od razu otworzy profil Messenger rywala.'
    },
    {
      id: 'KB_NOTIFICATIONS',
      category: 'Powiadomienia & PUSH',
      title: 'Jak włączyć powiadomienia na pulpicie i telefonie?',
      keywords: ['powiadomienia', 'telefon', 'pulpit', 'dzwiek', 'alerty', 'chrome', 'iphone', 'nie przychodza'],
      learnedPhrases: ['jak wlaczyc powiadomienia', 'nie wyskakuja powiadomienia', 'czemu nie dzialaja alerty na iphone'],
      answer: 'Kliknij dzwonek **🔔 Centrum Powiadomień** na górnym pasku i włącz **Alerty** / **Aktywuj PUSH**. Ważne dla iPhone (iOS 16.4+): Safari wysyła Web Push WYŁĄCZNIE po dodaniu strony na ekran początkowy telefonu („Udostępnij” -> „Do ekranu początkowego”) i uruchomieniu z nowej ikony na pulpicie! Uwaga: przeglądarka wewnątrz Messengera/FB na iOS blokuje PWA — kliknij „⋯” i wybierz „Otwórz w Safari”.'
    },
    {
      id: 'KB_PWA_INSTALL',
      category: 'Aplikacja na Telefon',
      title: 'Jak zainstalować aplikację Score Match Liga na telefonie?',
      keywords: ['aplikacja', 'telefon', 'zainstaluj', 'android', 'iphone', 'ekran', 'skrot', 'ikona'],
      learnedPhrases: ['jak pobrac aplikacje', 'jak zainstalowac na telefonie', 'gdzie pobrac apke', 'jak dodac ikone'],
      answer: 'Nie musisz nic pobierać ze sklepu Google Play ani App Store! Na Androidzie (Chrome) kliknij górny baner „📲 Zainstaluj” albo w menu przeglądarki wybierz „Dodaj do ekranu głównego / Zainstaluj aplikację”. Na iPhone (Safari) kliknij ikonę Udostępnij (kwadrat ze strzałką w górę) i wybierz „Do ekranu początkowego”. Portal pojawi się na pulpicie z naszą własną ikoną!'
    },
    {
      id: 'KB_RANKS_XP_GLASS',
      category: 'Rangi & Odznaki',
      title: 'Jak działają rangi na czacie, kariera XP, Liquid Glass i Tytuły?',
      keywords: ['ranga', 'xp', 'goat', 'legenda', 'glass', 'odznaki', 'karta', 'ut'],
      learnedPhrases: ['skad sie biora rangi na czacie', 'jak wbic goat', 'czemu ktos ma zlota range', 'co oznacza odznaka'],
      answer: 'Na czacie i w Karcie UT działają 4 warstwy odznak naraz: (1) Rola funkcyjna — Właściciel / Admin, (2) Dynamiczna odznaka Liquid Glass — np. Mistrz, Top Snajper, Żelazna Defensywa, Weteran, Debiutant, (3) Drabinka kariery XP ze wszystkich sezonów S1–S56 — od Debiutanta aż do Legendy i G.O.A.T., oraz (4) ponad 30 prestiżowych Tytułów Specjalnych (np. Galáctico, Złota Piłka, Cesarz Areny, Niepokonany, Król Końcówek, Maestro Tiki-Taki) i własnych rang nadawanych przez Master Admina.'
    },
    {
      id: 'KB_DISPUTES_VAR_SS',
      category: 'Spory VAR & W.O.',
      title: 'Zgłaszanie sporu VAR lub walkowera (W.O.) + obowiązkowy SS dlaczego',
      keywords: ['spor', 'var', 'walkower', 'wo', 'ss', 'screen', 'dowod', 'dlaczego', 'odwolanie'],
      learnedPhrases: ['jak zglosic walkower', 'jak otworzyc spor var', 'czemu wymaga screena do sporu', 'rywal nie odpisuje'],
      answer: 'Każde zgłoszenie **sporu VAR lub wniosku o W.O.** przy meczu w „📅 Terminarz” wymaga podania przyczyny, krótkiego opisu oraz **OBOWIĄZKOWEGO zrzutu ekranu (SS dlaczego)** — np. screen rozmowy na Messengerze z datami (reguła 48h / niestawienie się po 15 min) albo screen rozłączenia z gry. Bez SS system nie wyśle zgłoszenia do Administracji!'
    },
    {
      id: 'KB_POINTS_DEDUCTION',
      category: 'Kary & Moderacja',
      title: 'Odjęte punkty w tabeli i Czarna Lista — gdzie widać powód?',
      keywords: ['odejmowanie', 'punkty', 'kara', 'trybunal', 'czarna', 'lista', 'powod', 'minus'],
      learnedPhrases: ['czemu mam odjete punkty', 'gdzie zobaczyc powod kary', 'za co dostalem minusowe punkty'],
      answer: 'Każde odjęcie punktów przez Admina wymaga wpisania konkretnego powodu i jest jawnie zapisywane w Dzienniku Dyscyplinarnym (Trybunał) oraz powiadomieniach na Twojej Karcie UT. Graczy wykluczonych dyscyplinarnie z rozgrywek znajdziesz w zakładce „💀 Czarna Lista”.'
    },
    {
      id: 'KB_SCHEDULE_ARRANGE',
      category: 'Mecze & Wyniki',
      title: 'Terminarz, 4 kolejki tygodniowo, przedłużanie kolejek i umawianie meczu',
      keywords: ['kolejka', 'terminarz', 'tydzien', 'rywal', 'umowic', 'walkower', 'messenger', 'wolny', 'los', 'przedluzenie', 'przedluzyc', 'swieta', 'termin'],
      learnedPhrases: ['jak umowic sie na mecz', 'ile kolejek w tygodniu', 'rywal nie odpisuje', 'mam wolny los', 'czy kolejka jest przedluzona', 'przedluzenie kolejki swieta'],
      answer: 'W każdej kolejce gramy od razu pełny dwumecz (1 u siebie + 1 na wyjeździe w tej samej kolejce) — standardowo 4 kolejki na tydzień, a **kolejka kończy się ZAWSZE w czwartek o 23:59**! Administracja ma też możliwość puszczenia nowej kolejki wcześniej (np. po szybkim rozegraniu meczów) lub przedłużenia terminu w razie Świąt czy awarii. **Uwaga:** wszystkie mecze nierozegrane po zamknięciu kolejki trafiają automatycznie do Administracji w celu podjęcia działań (walkower 2:0 / 0:2 WO, obustronny 0:0 WO lub dogrywka). Kliknij **„💬 Napisz na Messengerze”** lub **„📅 Kiedy Gramy?”** przy spotkaniu, aby uzgodnić termin!'
    },
    {
      id: 'KB_SEASON_ROLLOVER',
      category: 'Ligi & Sezony',
      title: 'Co się dzieje przy przejściu na nowy sezon (np. S56 ➔ S57)?',
      keywords: ['sezon', 'nowy', 'koniec', 'rollover', 'archiwizacja', 'medale'],
      learnedPhrases: ['kiedy nowy sezon', 'czy znikna moje konta po sezonie', 'co z punktami po sezonie'],
      answer: 'Przy uruchomieniu nowego sezonu przez Master Admina tabele starego sezonu są automatycznie archiwizowane do zakładki „Archiwum”, medale za podium dopisują się na Karty UT, przeliczają się awanse/spadki między L1/L2/L3, a nowe tabele startują na czysto (0:0) bez utraty Twojego konta i historii XP!'
    },
    {
      id: 'KB_SYNC_REFRESH',
      category: 'Problemy Techniczne',
      title: 'Nie widzę nowego wyniku / wiadomości — jak wymusić odświeżenie?',
      keywords: ['odswiezanie', 'blad', 'synchronizacja', 'nie widze', 'zawiecha', 'stara', 'wersja'],
      learnedPhrases: ['strona sie nie odswieza', 'nie widze zmian', 'pokazuje stara wersje', 'jak odswiezyc cache'],
      answer: 'Portal sam pobiera nowe dane z serwera co ok. 6 sekund. Jeśli korzystasz ze słabszego internetu lub widzisz starszy wygląd po aktualizacji, kliknij przycisk synchronizacji „🔄” na górnym pasku, zrób twarde odświeżenie (Ctrl + F5 na komputerze) albo zamknij i uruchom ponownie przypiętą ikonę apki na telefonie.'
    },
    {
      id: 'KB_PROFILE_EDIT',
      category: 'Konto & Profil',
      title: 'Jak zmienić avatar, link FB, obejrzeć Kartę UT albo H2H?',
      keywords: ['profil', 'avatar', 'zdjecie', 'h2h', 'karta', 'ut', 'trofea', 'statystyki'],
      learnedPhrases: ['gdzie zmienic zdjecie profilowe', 'jak zobaczyc moja karte ut', 'jak sprawdzic bilans z graczem'],
      answer: 'Wszystko o Tobie jest w zakładce „🎴 Karta UT & Kariera” (albo klikając swój nick na górnym pasku) — zobaczysz tam gablote trofeów, karierę S1–S56 i odznaki. Bezpośrednie pojedynki z wybranym rywalem sprawdzisz w zakładce „H2H”, a dane profilowe może dodatkowo skorygować Admin w edycji zawodnika.'
    },
    {
      id: 'KB_CONTACT_SUPPORT_RULES',
      category: 'Prywatność & Zasady',
      title: 'Kontakt z Administracją, zgłoszenia toksyczności i zasady 0 zł',
      keywords: ['admin', 'pomoc', 'kontakt', 'szymon', 'zglosic', 'oszustwo', 'regulamin', 'oplata', 'rodo'],
      learnedPhrases: ['jak napisac do admina', 'czy liga jest platna', 'gdzie zglosic oszusta', 'chce usunac konto rodo'],
      answer: 'Do Admina najszybciej napiszesz bezpośrednio na **Messengerze** (link kontaktowy Zarządu). Liga Score Match jest w 100% darmowa (0 zł wpisowego, brak hazardu i nagród pieniężnych), a w zakładce „⚖️ Prawo & Regulamin” znajdziesz pełny Regulamin dla Graczy, tarczę prawną DSA/AS IS oraz przycisk natychmiastowego usunięcia danych wg Art. 17 RODO.'
    },
    {
      id: 'KB_LEGAL_APPEALS_48H',
      category: 'Prywatność & Zasady',
      title: 'Reguła 48h na walkower, rozłączenia i 7 dni na odwołanie od kary',
      keywords: ['48h', 'odwolanie', 'odwolac', 'skarga', 'dsa', 'wiek', '16', 'rozlaczenie', 'rage', 'quit', 'urlop'],
      learnedPhrases: ['rywal nie odpisuje 48h', 'jak odwolac sie od kary', 'zerwalo polaczenie w meczu', 'ile lat trzeba miec'],
      answer: 'Gdy rywal nie odpowiada przez 48h na 2–3 konkretne terminy lub nie stawi się przez 15 min, zgłoś Spór VAR / W.O. w Terminarzu z **obowiązkowym zrzutem ekranu (SS dlaczego)** — np. screen rozmowy na Messengerze z datami (walkower 2:0 WO na Twoją korzyść). Jeśli dostałeś karę lub wpis, masz 7 dni na umotywowane odwołanie na Messengerze do Głównego Administratora (Szymona Komendy). Udział od 16 lat lub za zgodą opiekuna.'
    },
    {
      id: 'KB_JOIN_LEAVE_BUTTON',
      category: 'Zapisy & Poczekalnia',
      title: 'Przycisk „Dołącz do ligi” / „Opuść ligę” oraz Poczekalnia (Pula)',
      keywords: ['dolacz', 'opusc', 'pula', 'poczekalnia', 'sezon', 'otwarte', 'zamkniete', 'przycisk', 'wypisac'],
      learnedPhrases: ['gdzie jest przycisk dolacz do ligi', 'jak opuscic lige', 'czemu okno zapisow jest zamkniete', 'co to jest pula oczekujacych'],
      answer: 'Po rejestracji trafiasz na zatwierdzenie do Poczekalni (Puli). Gdy Administracja zatwierdzi początek lub otworzy okno transferowe sezonu, w Twoim portalu (i profilu) aktywuje się przycisk „⚽ Dołącz do ligi” dla dozwolonych dywizji oraz „🚪 Opuść ligę” (powrót do Puli bez utraty konta). Dodatkowo Admin może dodać Cię bezpośrednio z filtrowanej listy graczy!'
    },
    {
      id: 'KB_ADMIN_PLAYER_MODE',
      category: 'Administracja & Rozgrywki',
      title: 'Admin jako zawodnik ligi (np. Ekstraklasa) + dopisywanie statystyk S1–S55',
      keywords: ['admin', 'ekstraklasa', 'gra', 'ranga', 'statystyki', 'wystepowac', 'wspoladmin'],
      learnedPhrases: ['czy admin moze grac w lidze', 'jak admin wpisuje swoje statystyki s1 s55', 'czy admin ma range admin w tabeli'],
      answer: 'Tak! Zarówno Master Admin, jak i Co-Admini mogą aktywnie grać w lidze (np. w Ekstraklasie L1) jako pełnoprawni zawodnicy z widoczną rangą Admin w tabeli, terminarzu i na Kartach UT. W Panelu Admina mogą też jednym kliknięciem dołączyć jako gracz oraz uzupełnić swoje historyczne statystyki z poprzednich sezonów S1–S55.'
    },
    {
      id: 'KB_PROFILE_AVATAR_BIO',
      category: 'Konto & Karta UT',
      title: 'Jak zmienić awatar i ustawić swoje Bio po rejestracji lub wyborze ligi?',
      keywords: ['awatar', 'avatar', 'zdjecie', 'profil', 'bio', 'opis', 'edycja', 'zmienic', 'obrazek'],
      learnedPhrases: ['jak zmienic awatar', 'nie moge edytowac awatara', 'jak ustawic bio', 'gdzie dodac opis gracza'],
      answer: 'Po zalogowaniu wejdź w zakładkę „🎴 Karta UT & Kariera” lub kliknij przycisk „🎨 Edytuj Awatar i Bio” w górnym pasku albo na karcie konta w „📝 Zapisy”. Możesz wgrać własne zdjęcie z telefonu/komputera, wybrać jeden z gotowych herbów SMPL lub wkleić link URL, a także wpisać swoje Bio (do 280 znaków), które pojawi się od razu na Twojej Karcie UT!'
    },
    {
      id: 'KB_FOOTBALL_COMPETITIONS',
      category: 'Konkursy & Nagrody',
      title: 'Konkursy Piłkarskie: Złoty But, Puchar Ligi, Typer Kolejki, Nagroda Puskása, Invincibles, Fair Play i Liga Klanów',
      keywords: ['konkurs', 'konkursy', 'zloty but', 'strzelcow', 'puchar', 'drabinka', 'typer', 'typowac', 'puskas', 'gol sezonu', 'fair play', 'klan', 'invincibles', 'forma'],
      learnedPhrases: ['jakie sa konkursy w lidze', 'jak dziala typer kolejki', 'gdzie glosowac na puskasa', 'kto wygrywa zloty but', 'jak dziala puchar ligi'],
      answer: 'W zakładce „🥇 Konkursy Piłkarskie” działa pełen zestaw nagród znanych z prawdziwej piłki: 👟 Złoty But (król strzelców ze współczynnikiem ligi i dubletami 2-bramkowymi), 🏆 Puchar Ligi SMPL (drabinka Knockout 1/8–Finał z rzutami karnymi przy remisie), 🔮 Typer Kolejki (+5 pkt dokładny wynik 0–2, +3 pkt różnica/remis, +1 pkt 1X2), 🥅 Nagroda Puskása (nominacje i głosowanie na najpiękniejszego gola), 🔥 Forma & Invincibles (seria bez porażki, Twierdza Domowa, Król Wyjazdów, rekordy), 🕊️ Puchar Fair Play oraz ⚔️ Drużynowa Liga Mistrzów Klanów!'
    }
  ];

  // Łączy bazę wbudowaną + wiedzę wyuczoną z state.aiKnowledge
  function getCombinedKnowledge(state) {
    const dynamicList = state && Array.isArray(state.aiKnowledge) ? state.aiKnowledge : [];
    const byId = {};
    const merged = [];

    for (let i = 0; i < BASE_KB.length; i++) {
      const base = BASE_KB[i];
      const copy = {
        id: base.id,
        category: base.category,
        title: base.title,
        keywords: (base.keywords || []).slice(),
        learnedPhrases: (base.learnedPhrases || []).slice(),
        answer: base.answer,
        helpfulCount: 0,
        unhelpfulCount: 0,
        asksCount: 0,
        source: 'BUILT_IN'
      };
      byId[copy.id] = copy;
      merged.push(copy);
    }

    for (let j = 0; j < dynamicList.length; j++) {
      const dyn = dynamicList[j];
      if (!dyn || !dyn.id) continue;
      if (byId[dyn.id]) {
        const target = byId[dyn.id];
        if (dyn.answer) target.answer = dyn.answer;
        if (dyn.title) target.title = dyn.title;
        if (Array.isArray(dyn.keywords) && dyn.keywords.length) {
          const kwSeen = {};
          target.keywords.concat(dyn.keywords).forEach(function (kw) {
            const c = normalizeText(kw);
            if (c && !kwSeen[c]) kwSeen[c] = true;
          });
          target.keywords = Object.keys(kwSeen);
        }
        if (Array.isArray(dyn.learnedPhrases)) {
          const phSeen = {};
          target.learnedPhrases.concat(dyn.learnedPhrases).forEach(function (ph) {
            const p = normalizeText(ph);
            if (p && !phSeen[p]) phSeen[p] = true;
          });
          target.learnedPhrases = Object.keys(phSeen);
        }
        target.helpfulCount = Number(dyn.helpfulCount || 0);
        target.unhelpfulCount = Number(dyn.unhelpfulCount || 0);
        target.asksCount = Number(dyn.asksCount || 0);
      } else {
        const customEntry = {
          id: dyn.id,
          category: dyn.category || 'Wiedza Wyuczona',
          title: dyn.title || 'Odpowiedź Administracji',
          keywords: Array.isArray(dyn.keywords) ? dyn.keywords.slice() : [],
          learnedPhrases: Array.isArray(dyn.learnedPhrases) ? dyn.learnedPhrases.slice() : [],
          answer: dyn.answer || '',
          helpfulCount: Number(dyn.helpfulCount || 0),
          unhelpfulCount: Number(dyn.unhelpfulCount || 0),
          asksCount: Number(dyn.asksCount || 0),
          source: dyn.source || 'ADMIN_TAUGHT'
        };
        byId[customEntry.id] = customEntry;
        merged.push(customEntry);
      }
    }
    if (!isClansUiEnabledSafe(state)) {
      return merged
        .filter(function (entry) { return entry && entry.id !== 'KB_CLANS_BADGES'; })
        .map(function (entry) {
          if (entry.id === 'KB_REGISTER_NEW') {
            return Object.assign({}, entry, {
              answer: 'Wejdź w zakładkę „Zapisy” (lub stronę REJESTRACJA.html), wpisz Imię i Nazwisko, swój nick ze Score! Match, link Messenger/FB oraz ustaw prywatne hasło (min. 4 znaki). Po wysłaniu trafiasz na Listę Oczekujących — Administracja przydzieli Cię do Ekstraklasy (L1), 2. Ligi (L2) lub 3. Ligi (L3).'
            });
          }
          if (entry.id === 'KB_NEW_PLAYER_CHECKLIST') {
            return Object.assign({}, entry, {
              answer: 'Witaj w Score Match Liga! Oto Twój szybki start w 5 krokach:\n1️⃣ **Zapisy**: Załóż konto w „📝 Zapisy”, uzupełnij swój profil gracza i zaznacz checkbox RODO.\n2️⃣ **Przydział do ligi**: Gdy Admin przeniesie Cię z Listy Oczekujących do L1/L2, pojawiasz się w tabeli i terminarzu swojej ligi.\n3️⃣ **Umawianie na Messengerze**: Wejdź w „📅 Terminarz”, sprawdź rywala na bieżące kolejki i kliknij „💬 Napisz na Messengerze” lub „📅 Kiedy Gramy?”.\n4️⃣ **Dwumecz do max 2 bramek**: W trybie Friendly gry **Score! Match** rozgrywacie **2 mecze: 1 u siebie + 1 na wyjeździe** (każdy do max 2 goli, bez 2:2) i robicie po screenie (SS) z obu spotkań.\n5️⃣ **Wysyłka obu wyników + SS**: W „➕ Wynik” wpisujecie **oba wyniki + oba SS** (a przy sporze VAR lub W.O. obowiązkowo załączasz SS dlaczego!) — dopiero wtedy Admini zatwierdzają mecze i tabela aktualizuje się na żywo!'
            });
          }
          if (entry.id === 'KB_FOOTBALL_COMPETITIONS') {
            return Object.assign({}, entry, {
              title: 'Konkursy Piłkarskie: Złoty But, Puchar Ligi, Typer Kolejki, Nagroda Puskása, Invincibles i Fair Play',
              answer: 'W zakładce „🥇 Konkursy Piłkarskie” działa pełen zestaw nagród znanych z prawdziwej piłki: 👟 Złoty But (król strzelców ze współczynnikiem ligi i dubletami 2-bramkowymi), 🏆 Puchar Ligi SMPL (drabinka Knockout 1/8–Finał z rzutami karnymi przy remisie), 🔮 Typer Kolejki (+5 pkt dokładny wynik 0–2, +3 pkt różnica/remis, +1 pkt 1X2), 🥅 Nagroda Puskása (nominacje i głosowanie na najpiękniejszego gola), 🔥 Forma & Invincibles (seria bez porażki, Twierdza Domowa, Król Wyjazdów, rekordy) oraz 🕊️ Puchar Fair Play!'
            });
          }
          return entry;
        });
    }
    return merged;
  }

  function isClansUiEnabledSafe(state) {
    const resolved = state || (window.SMPL_DB && typeof window.SMPL_DB.getState === 'function' ? window.SMPL_DB.getState() : null);
    if (window.SMPL_VIEWS && typeof window.SMPL_VIEWS.isClansUiEnabled === 'function') {
      return window.SMPL_VIEWS.isClansUiEnabled(resolved);
    }
    return Boolean(
      (typeof window !== 'undefined' && window.SMPL_ENABLE_CLANS === true) ||
      (resolved && resolved.portalSettings && resolved.portalSettings.clansEnabled === true)
    );
  }

  function scoreItemAgainstQuery(item, normQuery, qTokens) {
    if (!item || !item.answer) return 0;
    let score = 0;

    // 1. Dokładne / częściowe dopasowanie wyuczonych fraz graczy (najwyższy priorytet!)
    const phrases = item.learnedPhrases || [];
    for (let i = 0; i < phrases.length; i++) {
      const ph = normalizeText(phrases[i]);
      if (!ph) continue;
      if (normQuery === ph) {
        score += 120;
      } else if (ph.length >= 6 && normQuery.indexOf(ph) !== -1) {
        score += 70;
      } else if (normQuery.length >= 6 && ph.indexOf(normQuery) !== -1) {
        score += 65;
      } else {
        const phToks = tokenize(ph);
        let overlap = 0;
        for (let k = 0; k < qTokens.length; k++) {
          if (phToks.indexOf(qTokens[k]) !== -1) overlap++;
        }
        if (overlap >= 2) score += overlap * 16;
      }
    }

    // 2. Słowa kluczowe + tytuł (z tolerancją literówek i odmian)
    const itemTokens = {};
    const kwList = item.keywords || [];
    for (let i = 0; i < kwList.length; i++) {
      const toks = tokenize(kwList[i]);
      for (let j = 0; j < toks.length; j++) itemTokens[toks[j]] = true;
    }
    const titleToks = tokenize(item.title || '');
    for (let i = 0; i < titleToks.length; i++) itemTokens[titleToks[i]] = true;

    const itemTokKeys = Object.keys(itemTokens);
    let matchedCount = 0;
    for (let q = 0; q < qTokens.length; q++) {
      const qt = qTokens[q];
      if (!qt || qt.length < 2) continue;
      if (itemTokens[qt]) {
        score += 24;
        matchedCount++;
        continue;
      }
      // Fuzzy match (prefix / wspólny rdzeń >=5 lub literówka Levenshtein)
      let bestFuzzy = 0;
      const stemQt = stemToken(qt);
      for (let k = 0; k < itemTokKeys.length; k++) {
        const it = itemTokKeys[k];
        const stemIt = stemToken(it);
        if (it.length >= 4 && qt.length >= 4 && (it.indexOf(qt) === 0 || qt.indexOf(it) === 0 || (stemQt.length >= 5 && stemQt === stemIt))) {
          bestFuzzy = Math.max(bestFuzzy, 18);
        } else if (qt.length >= 4 && it.length >= 4 && Math.max(qt.length, it.length) >= 5) {
          const dist = levenshtein(qt, it);
          const maxD = Math.min(qt.length, it.length) >= 7 ? 2 : 1;
          if (dist <= maxD) bestFuzzy = Math.max(bestFuzzy, 16 - dist * 3);
        }
      }
      if (bestFuzzy > 0) {
        score += bestFuzzy;
        matchedCount++;
      }
    }

    // Lekki bonus za sprawdzoną przez graczy trafność (👍 - 👎)
    const feedbackBonus = Math.min(20, Math.max(-15, (Number(item.helpfulCount || 0) - Number(item.unhelpfulCount || 0)) * 3));
    if (matchedCount > 0 || score > 25) {
      score += feedbackBonus;
    }
    if (item.source === 'ADMIN_TAUGHT' && matchedCount >= 2) {
      score += 12;
    }

    return score;
  }

  function buildContextHint(item, normQuery, session, state) {
    if (!session) return '';
    const notes = [];
    const curPlayer = !session.isAdminAuthenticated && session.activePlayerId && state && Array.isArray(state.players)
      ? state.players.find(function (p) { return p.id === session.activePlayerId; })
      : null;

    if (curPlayer && (item.id === 'KB_DISPUTES_VAR_SS' || item.id === 'KB_MESSENGER_CONTACT' || normQuery.indexOf('czat') !== -1 || normQuery.indexOf('messenger') !== -1 || normQuery.indexOf('spor') !== -1 || normQuery.indexOf('walkower') !== -1)) {
      notes.push('W lidze umawiamy mecze bezpośrednio na Messengerze, a każdy spór VAR / W.O. wymaga załączenia zrzutu ekranu (SS dlaczego).');
    }

    if (curPlayer && (item.id === 'KB_MESSENGER_CONTACT' || item.id === 'KB_DIVISIONS_PROMO')) {
      notes.push('Twoja aktualna dywizja to ' + (curPlayer.leagueId || 'L2') + ' — sprawdź swoich rywali w zakładce „📅 Terminarz” i kliknij „💬 Napisz na Messengerze”.');
    }

    if (isClansUiEnabledSafe(state) && curPlayer && (item.id === 'KB_CLANS_BADGES' || item.id === 'KB_NEW_PLAYER_CHECKLIST')) {
      if (curPlayer.clanName) {
        notes.push('Twój obecny klan w bazie SMPL: ' + (curPlayer.clanTag ? '[' + curPlayer.clanTag + '] ' : '') + curPlayer.clanName + '.');
      } else {
        notes.push('Nie masz jeszcze przypisanego klanu — możesz poprosić Admina na Messengerze o dopisanie klanu i herbu do profilu.');
      }
    }

    if (curPlayer && item.id === 'KB_HISTORY_S1_S55') {
      if (curPlayer.historicalArchiveName || (curPlayer.historicalStats && Number(curPlayer.historicalStats.matches || 0) > 0)) {
        notes.push('Dobra wiadomość: na Twoim koncie historia jest już podpięta (' + (curPlayer.historicalArchiveName || 'Archiwum SMPL') + ')!');
      } else {
        notes.push('Na tym koncie nie widzę jeszcze podpiętej historii S1–S55 — jeśli grałeś wcześniej, napisz swój stary nick Adminowi na Messengerze.');
      }
    }

    if ((!session || session.isGuest) && (item.id === 'KB_MESSENGER_CONTACT' || item.id === 'KB_SUBMIT_MATCH_SCREEN')) {
      notes.push('Wskazówka: przeglądasz teraz portal jako Gość — aby zgłaszać mecze, umawiać terminy i zakładać spory VAR, zaloguj się na swoje konto gracza.');
    }

    return notes.join(' ');
  }

  function tryLiveOrConversationalAnswer(rawQ, normQuery, qTokens, state, session) {
    var st = state && typeof state === 'object' ? state : {};
    var sess = session && typeof session === 'object' ? session : {};
    var players = Array.isArray(st.players) ? st.players : [];
    var playerById = {};
    for (var pi = 0; pi < players.length; pi++) {
      if (players[pi] && players[pi].id) playerById[players[pi].id] = players[pi];
    }
    var me = !sess.isAdminAuthenticated && sess.activePlayerId ? (playerById[sess.activePlayerId] || null) : null;

    var hasSpecificDomainTopic = /\b(screen|fotk|haslo|przypomnienie|sklad|formacj|powiadomieni|iphone|android|timeout|wycisz|walkower|48h|regulamin|rodo|koszulk|turniej)\b/.test(normQuery);

    // 1. Powitania / podziękowania / przedstawienie Vanessy (działa natychmiast dla każdego)
    var isGreeting = /^(czesc|hej|heja|siema|siemanko|elo|witam|witaj|dzien dobry|dobry wieczor|yo|hi|hello|bry)\b/.test(normQuery) ||
      /\b(kim jestes|kim ty jestes|co potrafisz|jak mozesz pomoc)\b/.test(normQuery);
    var isThanks = /^(dzieki|dziekuje|dziekowac|super dzieki|spoko dzieki|ok dzieki)\b/.test(normQuery) && qTokens.length <= 4;

    if ((isGreeting || isThanks) && !hasSpecificDomainTopic && qTokens.length <= 6) {
      if (isThanks) {
        return {
          matched: true,
          confidence: 0.98,
          score: 70,
          knowledgeId: 'KB_GREETING_THANKS',
          title: 'Zawsze do usług! ⚽',
          category: 'Asystentka SMPL',
          answer: isClansUiEnabledSafe(state)
            ? 'Cała przyjemność po mojej stronie! Jeśli będziesz chciał sprawdzić tabelę, umówić mecz, dodać klan albo dopytać o zasady Score Match Liga — po prostu napisz. Powodzenia na boisku! 💋⚽'
            : 'Cała przyjemność po mojej stronie! Jeśli będziesz chciał sprawdzić tabelę, umówić mecz albo dopytać o zasady Score Match Liga — po prostu napisz. Powodzenia na boisku! 💋⚽',
          contextNote: '',
          related: isClansUiEnabledSafe(state)
            ? [{ id: 'KB_REGISTER_AND_CLAN', title: 'Rejestracja i wybór Klanu' }, { id: 'KB_SUBMIT_MATCH_SCREEN', title: 'Zgłaszanie wyniku meczu' }]
            : [{ id: 'KB_REGISTER_NEW', title: 'Rejestracja Konta Gracza' }, { id: 'KB_SUBMIT_MATCH_SCREEN', title: 'Zgłaszanie wyniku meczu' }]
        };
      }
      var whoText = isClansUiEnabledSafe(state)
        ? 'Przeglądasz portal jako Gość — pomogę Ci założyć konto w Zapisach, wybrać lub dodać własny klan z logo albo podejrzeć tabele na żywo!'
        : 'Przeglądasz portal jako Gość — pomogę Ci założyć konto w Zapisach, wyjaśnię zasady albo podejrzymy razem tabele na żywo!';
      if (sess.isAdminAuthenticated) {
        whoText = 'Jesteś zalogowany jako Administrator **' + String(sess.adminName || 'Admin') + '**! Pomogę z panelem, akceptacją wyników, ligą i pytaniami graczy.';
      } else if (me) {
        whoText = 'Widzę Cię jako zawodnika **' + me.name + '** (' + (me.leagueId || 'POOL') + '). Mogę sprawdzić Twoją tabelę, najbliższe mecze albo zasady ligi!';
      }
      return {
        matched: true,
        confidence: 0.98,
        score: 70,
        knowledgeId: 'KB_GREETING_WELCOME',
        title: 'Cześć! Tu Vanessa AI — Twoja przewodniczka SMPL 💋',
        category: 'Asystentka SMPL',
        answer: 'Hej! Jestem **Vanessa AI** — oficjalna asystentka Score Match Liga. ' + whoText + ' O co chcesz zapytać?',
        contextNote: '',
        related: [{ id: 'KB_FULL_ONBOARDING', title: 'Pierwsze kroki nowego gracza' }, { id: 'KB_JOIN_LEAVE_BUTTON', title: 'Przycisk Dołącz / Opuść ligę' }]
      };
    }

    // 2. Aktualna tabela / kto prowadzi / moje punkty i pozycja
    var asksStandings = /\b(kto prowadzi|lider tabeli|aktualna tabela|pokaz tabele|ktory jestem|moje miejsce|ile mam punktow|tabela l1|tabela l2|tabela ligi)\b/.test(normQuery) ||
      (normQuery.indexOf('tabela') !== -1 && qTokens.length <= 4);
    if (asksStandings && normQuery.indexOf('koszulk') === -1) {
      var targetLid = normQuery.indexOf('l2') !== -1 || normQuery.indexOf('2 liga') !== -1 ? 'L2' : (normQuery.indexOf('l3') !== -1 ? 'L3' : (me && me.leagueId && me.leagueId !== 'POOL' ? me.leagueId : 'L1'));
      var hasEng = typeof window !== 'undefined' && window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateStandings === 'function';
      if (hasEng) {
        var rows = window.SMPL_ENGINE.calculateStandings(st, targetLid) || [];
        var lgName = (st.leagues && st.leagues[targetLid] && st.leagues[targetLid].name) ? st.leagues[targetLid].name : targetLid;
        if (!rows.length) {
          return {
            matched: true, confidence: 0.95, score: 68, knowledgeId: 'KB_LIVE_STANDINGS',
            title: 'Tabela na żywo — ' + lgName, category: 'Dane na żywo',
            answer: 'W lidze **' + lgName + '** nie ma jeszcze przypisanych zawodników — sezon dopiero startuje lub trwa nabór z Poczekalni! Gdy Admin otworzy ligę albo zatwierdzi graczy, od razu zobaczysz tu tabelę na żywo.',
            contextNote: '', related: [{ id: 'KB_JOIN_LEAVE_BUTTON', title: 'Dołączanie do ligi i Poczekalnia' }]
          };
        }
        var linesT = [];
        for (var r = 0; r < Math.min(rows.length, 5); r++) {
          var row = rows[r];
          if (!row || !row.player) continue;
          var pts = row.PKT != null ? row.PKT : (row.pts || 0);
          var mp = row.M != null ? row.M : (row.mp || 0);
          linesT.push((r + 1) + '. **' + row.player.name + '** — ' + pts + ' pkt (' + mp + ' meczów)');
        }
        return {
          matched: true, confidence: 0.96, score: 69, knowledgeId: 'KB_LIVE_STANDINGS',
          title: 'Tabela na żywo — ' + lgName, category: 'Dane na żywo',
          answer: 'Aktualna czołówka **' + lgName + '** (Sezon ' + (st.season || '56') + '):\n' + linesT.join('\n') + '\nPełną tabelę sprawdzisz w zakładce `📊 Tabele Live`.',
          contextNote: '', related: [{ id: 'KB_SCHEDULE_ARRANGE', title: 'Terminarz i mecze' }]
        };
      }
    }

    // 3. Moje mecze / z kim gram
    if (/\b(moje mecze|z kim gram|kogo mam|najblizszy mecz|moj terminarz|kiedy gram)\b/.test(normQuery)) {
      if (!me) {
        return {
          matched: true, confidence: 0.93, score: 66, knowledgeId: 'KB_LIVE_MY_MATCHES',
          title: 'Twój terminarz spotkań', category: 'Dane na żywo',
          answer: 'Aby zobaczyć swoje osobiste mecze, zaloguj się na konto zawodnika. Wszystkie pary kolejek sprawdzisz od razu w zakładce `📅 Terminarz`!',
          contextNote: '', related: [{ id: 'KB_SCHEDULE_ARRANGE', title: 'Jak umówić mecz z rywalem?' }]
        };
      }
      var allMatches = Array.isArray(st.matches) ? st.matches : [];
      var mine = [];
      for (var mi = 0; mi < allMatches.length; mi++) {
        var mt = allMatches[mi];
        if (!mt || (mt.status !== 'SCHEDULED' && mt.status !== 'PENDING')) continue;
        if (mt.homeId === me.id || mt.awayId === me.id) {
          var oppId = mt.homeId === me.id ? mt.awayId : mt.homeId;
          var oppName = playerById[oppId] ? playerById[oppId].name : oppId;
          var rnd = mt.round != null ? mt.round : (mt.week != null ? mt.week : '?');
          mine.push('• Kolejka ' + rnd + ': **' + oppName + '** (' + (mt.status === 'PENDING' ? 'czeka na akceptację wyniku' : 'do rozegrania') + ')');
          if (mine.length >= 6) break;
        }
      }
      return {
        matched: true, confidence: 0.95, score: 68, knowledgeId: 'KB_LIVE_MY_MATCHES',
        title: 'Twoje mecze — ' + me.name, category: 'Dane na żywo',
        answer: mine.length
          ? 'Twoje aktywne mecze w lidze **' + (me.leagueId || '') + '**:\n' + mine.join('\n') + '\nKliknij `💬 Napisz na Messengerze` lub `📅 Kiedy Gramy?` w zakładce `📅 Terminarz`, żeby umówić rywala!'
          : 'Nie masz teraz żadnych nierozgranych spotkań w terminarzu dla **' + me.name + '**. Poczekaj na wygenerowanie nowych kolejek przez Administrację!',
        contextNote: '', related: [{ id: 'KB_SUBMIT_MATCH_SCREEN', title: 'Wysyłanie wyniku ze screenem' }]
      };
    }

    // 4. Status okna zapisów / przycisk Dołącz lub Opuść ligę
    if (/\b(czy moge dolaczyc|gdzie przycisk dolacz|jak dolaczyc do ligi|jak opuscic lige|czy zapisy otwarte|okno zapisow)\b/.test(normQuery)) {
      var ps = st.portalSettings && typeof st.portalSettings === 'object' ? st.portalSettings : {};
      var isOpen = Boolean(ps.seasonJoinOpen);
      var allowedL = Array.isArray(ps.seasonJoinAllowedLeagues) && ps.seasonJoinAllowedLeagues.length ? ps.seasonJoinAllowedLeagues.join(', ') : 'wszystkie aktywne ligi';
      return {
        matched: true, confidence: 0.95, score: 68, knowledgeId: 'KB_JOIN_LEAVE_BUTTON',
        title: 'Status okna zapisów do ligi (Dołącz / Opuść)', category: 'Dane na żywo',
        answer: isOpen
          ? 'Okno zapisów do ligi jest teraz **OTWARTE** (dozwolone dywizje: **' + allowedL + '**)! Zalogowani gracze z zatwierdzonym kontem widzą w portalu przycisk **„⚽ Dołącz do ligi”** oraz **„🚪 Opuść ligę”**.'
          : 'Okno samodzielnego dołączania przyciskiem jest aktualnie **ZAMKNIĘTE** (uruchamia je Administracja przy zatwierdzaniu początku/końca sezonu). Nadal możesz wysłać zgłoszenie w `📝 Zapisy` do Puli Oczekujących lub poprosić Admina o bezpośrednie dodanie!',
        contextNote: '', related: isClansUiEnabledSafe(st) ? [{ id: 'KB_REGISTER_AND_CLAN', title: 'Rejestracja i wybór Klanu' }] : [{ id: 'KB_REGISTER_NEW', title: 'Rejestracja Konta Gracza' }]
      };
    }

    // 5. Klany tymczasowo ukryte / Lista klanów na żywo
    if (!isClansUiEnabledSafe(st) && /\b(jakie sa klany|lista klanow|dostepne klany|ile jest klanow|klan|klany|klanu|klanow|wojny klanow)\b/.test(normQuery)) {
      return {
        matched: true, confidence: 0.94, score: 67, knowledgeId: 'KB_CLANS_HIDDEN',
        title: 'Klany & Wojny Klanów — Wkrótce', category: 'Informacja Ligi',
        answer: 'System klanów oraz **Wojny Klanów SMPL** są teraz tymczasowo ukryte — przygotowujemy je do wdrożenia w kolejnych aktualizacjach! Aktualnie cała rywalizacja toczy się w dywizjach indywidualnych oraz konkursach (Złoty But, Puchar Ligi, Typer, Puskás).',
        contextNote: '', related: [{ id: 'KB_DIVISIONS_PROMO', title: 'Dywizje i awanse' }]
      };
    }

    if (/\b(jakie sa klany|lista klanow|dostepne klany|ile jest klanow)\b/.test(normQuery)) {
      var clans = Array.isArray(st.clans) ? st.clans : [];
      var cNames = [];
      for (var ci = 0; ci < Math.min(clans.length, 15); ci++) {
        if (clans[ci] && clans[ci].name) {
          cNames.push((clans[ci].tag ? '[' + clans[ci].tag + '] ' : '') + clans[ci].name);
        }
      }
      return {
        matched: true, confidence: 0.94, score: 67, knowledgeId: 'KB_CLAN_ADD_NEW',
        title: 'Oficjalne Klany w Score Match Liga (' + clans.length + ')', category: 'Dane na żywo',
        answer: (cNames.length
          ? 'Aktualnie w bazie znajduje się **' + clans.length + '** klanów (np. ' + cNames.join(', ') + '). '
          : 'Baza klanów jest gotowa na pierwsze drużyny! ') + 'Jeśli Twojego klanu jeszcze nie ma przy rejestracji, wybierz **„➕ Mojego klanu nie ma na liście”** i wgraj własne logo!',
        contextNote: '', related: [{ id: 'KB_CLAN_ADD_NEW', title: 'Dodawanie nowego Klanu & Logo' }]
      };
    }

    // 6. Lista administratorów na żywo
    if (/\b(kto jest adminem|lista adminow|kto rzadzi|kto prowadzi lige)\b/.test(normQuery)) {
      var admins = Array.isArray(st.admins) ? st.admins : [];
      var admLabels = [];
      for (var ai = 0; ai < admins.length; ai++) {
        if (admins[ai] && admins[ai].name && (!admins[ai].status || admins[ai].status === 'APPROVED')) {
          admLabels.push('**' + admins[ai].name + '**' + (admins[ai].role === 'MASTER_ADMIN' ? ' (Master Admin)' : ' (Admin)'));
        }
      }
      return {
        matched: true, confidence: 0.94, score: 67, knowledgeId: 'KB_CONTACT_SUPPORT_RULES',
        title: 'Administracja Score Match Liga', category: 'Dane na żywo',
        answer: (admLabels.length ? 'Zatwierdzeni Administratorzy ligi: ' + admLabels.join(', ') + '. ' : '') + 'Najszybciej skontaktujesz się bezpośrednio przez **Messenger** (link w profilu Zarządu lub grupa ligowa)!',
        contextNote: '', related: [{ id: 'KB_ADMIN_PLAYER_MODE', title: 'Admini grający w lidze' }]
      };
    }

    return null;
  }

  function ask(questionText, state, session) {
    const rawQ = String(questionText || '').trim();
    if (!rawQ || rawQ.length < 2) {
      return {
        matched: false,
        confidence: 0,
        answer: 'Napisz choć kilka słów o swoim pytaniu lub problemie, a od razu Ci pomogę! 💋',
        suggestions: []
      };
    }

    const normQuery = normalizeText(rawQ);
    const qTokens = tokenize(rawQ);
    const liveHit = tryLiveOrConversationalAnswer(rawQ, normQuery, qTokens, state, session);
    if (liveHit) {
      return liveHit;
    }

    const kb = getCombinedKnowledge(state);

    const scored = [];
    for (let i = 0; i < kb.length; i++) {
      const s = scoreItemAgainstQuery(kb[i], normQuery, qTokens);
      if (s > 0) {
        scored.push({ item: kb[i], score: s });
      }
    }
    scored.sort(function (a, b) { return b.score - a.score; });

    const top = scored.length > 0 ? scored[0] : null;
    const confidence = top ? Math.min(1, Number((top.score / 72).toFixed(2))) : 0;
    const isMatched = Boolean(top && top.score >= 22);

    if (isMatched) {
      const ctxHint = buildContextHint(top.item, normQuery, session, state);
      const related = scored.slice(1, 3).filter(function (x) { return x.score >= 16; }).map(function (x) {
        return { id: x.item.id, title: x.item.title };
      });
      return {
        matched: true,
        confidence: confidence,
        score: top.score,
        knowledgeId: top.item.id,
        title: top.item.title,
        category: top.item.category,
        answer: top.item.answer,
        contextNote: ctxHint,
        related: related,
        learnedFromCount: Number(top.item.helpfulCount || 0)
      };
    }

    // Gdy pytanie wykracza poza znaną bazę -> Vanessa zapisuje je do kolejki Admina i proponuje najbliższe tematy
    const fallbackRelated = scored.slice(0, 3).map(function (x) {
      return { id: x.item.id, title: x.item.title };
    });

    return {
      matched: false,
      confidence: confidence,
      score: top ? top.score : 0,
      knowledgeId: null,
      title: 'Nowe pytanie — przekazane do nauki',
      category: 'Samouczenie',
      answer: 'Hmm, jeszcze nie znam dokładnej odpowiedzi na to pytanie! Zapisałam je od razu dla Szymona i Administracji — gdy tylko dodadzą odpowiedź, nauczę się jej na stałe dla całej ligi. 💋 W międzyczasie możesz wybrać jeden z podobnych tematów poniżej albo napisać na Messengerze do Admina.',
      contextNote: '',
      related: fallbackRelated,
      autoQueued: true
    };
  }

  function extractAutoKeywords(questionText) {
    const tokens = tokenize(questionText);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].length >= 3 && out.indexOf(tokens[i]) === -1) {
        out.push(tokens[i]);
      }
    }
    return out.slice(0, 10);
  }

  function getBaseItemById(id) {
    for (let i = 0; i < BASE_KB.length; i++) {
      if (BASE_KB[i].id === id) return BASE_KB[i];
    }
    return null;
  }

  function getAvailableGeminiModels() {
    return [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Zalecany • Szybki i Najmądrzejszy)' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Stabilny • Wysoka jakość)' },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Ultra-szybki • Największe limity Free)' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Klasyczny LTS)' }
    ];
  }

  function buildLiveLeagueContext(state, session) {
    if (!state || typeof state !== 'object') return '';
    var lines = [];
    var seasonNum = state.season || (state.meta && state.meta.season) || 'SMPL';
    var curWeek = (state.weeklyConfig && state.weeklyConfig.currentWeek) || (state.meta && state.meta.currentWeek) || 1;
    lines.push('SEZON: ' + String(seasonNum) + ' | Aktualna kolejka/tydzień: ' + String(curWeek));
    if (state.weeklyConfig && Array.isArray(state.weeklyConfig.extensions) && state.weeklyConfig.extensions.length > 0) {
      var extInfo = [];
      for (var ei = 0; ei < state.weeklyConfig.extensions.length; ei++) {
        var exObj = state.weeklyConfig.extensions[ei];
        if (exObj && exObj.enabled !== false && exObj.extendedUntilDate) {
          extInfo.push((exObj.scopeLabel || 'Kolejka') + ' do ' + exObj.extendedUntilDate + ' ' + (exObj.extendedUntilTime || '23:59') + ' (' + (exObj.reason || '') + ')');
        }
      }
      if (extInfo.length > 0) {
        lines.push('AKTYWNE PRZEDŁUŻENIA TERMINU KOLEJKI: ' + extInfo.join(' | '));
      }
    }

    var playerById = {};
    var players = Array.isArray(state.players) ? state.players : [];
    for (var i = 0; i < players.length; i++) {
      if (players[i] && players[i].id) {
        playerById[players[i].id] = players[i];
      }
    }

    var leagues = (typeof window !== 'undefined' && window.SMPL_DB && typeof window.SMPL_DB.getActiveLeagueIds === 'function')
      ? window.SMPL_DB.getActiveLeagueIds(state)
      : ['L1', 'L2'];
    if (!leagues || !leagues.length) leagues = ['L1', 'L2'];
    var hasEngine = typeof window !== 'undefined' && window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateStandings === 'function';
    for (var li = 0; li < leagues.length; li++) {
      var lid = leagues[li];
      var lName = (state.leagues && state.leagues[lid] && state.leagues[lid].name) ? state.leagues[lid].name : lid;
      if (hasEngine) {
        try {
          var table = window.SMPL_ENGINE.calculateStandings(state, lid) || [];
          var topRows = [];
          var limit = Math.min(table.length, 8);
          for (var r = 0; r < limit; r++) {
            var row = table[r];
            if (!row || !row.player) continue;
            var ptsVal = row.PKT != null ? row.PKT : (row.pts || 0);
            var mpVal = row.M != null ? row.M : (row.mp || 0);
            var wVal = row.W != null ? row.W : (row.w || 0);
            var dVal = row.R != null ? row.R : (row.d || 0);
            var lVal = row.P != null ? row.P : (row.l || 0);
            var gfVal = row.BZ != null ? row.BZ : (row.gf || 0);
            var gaVal = row.BS != null ? row.BS : (row.ga || 0);
            topRows.push('#' + (r + 1) + ' ' + row.player.name + ' (' + ptsVal + ' pkt, ' + mpVal + 'm, ' + wVal + '-' + dVal + '-' + lVal + ', BR ' + gfVal + ':' + gaVal + ')');
          }
          lines.push(lName + ' [' + table.length + ' graczy]: ' + (topRows.length ? topRows.join(' | ') : 'brak graczy'));
        } catch (e) {}
      }
    }

    var matches = Array.isArray(state.matches) ? state.matches : [];
    var approvedRecent = [];
    var pendingMatches = [];
    for (var mi = matches.length - 1; mi >= 0; mi--) {
      var m = matches[mi];
      if (!m) continue;
      var hp = playerById[m.homeId];
      var ap = playerById[m.awayId];
      var hName = hp ? hp.name : String(m.homeId || '?');
      var aName = ap ? ap.name : String(m.awayId || '?');
      var rNum = m.round != null ? m.round : (m.week != null ? m.week : '?');
      var hsVal = m.homeScore != null ? m.homeScore : (m.homeGoals != null ? m.homeGoals : '?');
      var asVal = m.awayScore != null ? m.awayScore : (m.awayGoals != null ? m.awayGoals : '?');
      if ((m.status === 'APPROVED' || (m.status === 'WALKOVER' && !m.isByeWalkover)) && approvedRecent.length < 8) {
        approvedRecent.push(m.leagueId + ' K' + rNum + ': ' + hName + ' ' + hsVal + ':' + asVal + ' ' + aName + (m.status === 'WALKOVER' ? ' (WO)' : ''));
      } else if (m.status === 'PENDING' && pendingMatches.length < 6) {
        pendingMatches.push(m.leagueId + ' K' + rNum + ': ' + hName + ' ' + hsVal + ':' + asVal + ' ' + aName + ' (oczekuje)');
      }
    }
    if (approvedRecent.length) lines.push('OSTATNIE WYNIKI: ' + approvedRecent.join(' | '));
    if (pendingMatches.length) lines.push('MECZE DO ZATWIERDZENIA: ' + pendingMatches.join(' | '));

    var regsPending = Array.isArray(state.registrations)
      ? state.registrations.filter(function (rg) { return rg && rg.status === 'PENDING'; }).length
      : 0;
    var regsPool = Array.isArray(state.registrations)
      ? state.registrations.filter(function (rg) { return rg && rg.status === 'APPROVED_POOL'; }).length
      : 0;
    var blCount = Array.isArray(state.blacklist) ? state.blacklist.length : 0;
    var psCtx = (state.portalSettings && typeof state.portalSettings === 'object') ? state.portalSettings : {};
    var joinOpenTxt = psCtx.seasonJoinOpen ? ('OTWARTE (' + (Array.isArray(psCtx.seasonJoinAllowedLeagues) && psCtx.seasonJoinAllowedLeagues.length ? psCtx.seasonJoinAllowedLeagues.join(',') : 'wszystkie') + ')') : 'ZAMKNIĘTE';
    lines.push('Zgłoszenia oczekujące: ' + regsPending + ' | Pula zatwierdzonych (Poczekalnia): ' + regsPool + ' | Okno przycisku Dołącz/Opuść ligę: ' + joinOpenTxt + ' | Lista Zbanowanych: ' + blCount);

    var pubAdmins = Array.isArray(state.admins)
      ? state.admins.filter(function (a) { return a && a.name && (!a.status || a.status === 'APPROVED'); }).map(function (a) { return a.name + (a.role === 'MASTER_ADMIN' ? ' [MASTER]' : ' [ADMIN]'); })
      : [];
    if (pubAdmins.length) {
      lines.push('ZATWIERDZENI ADMINI: ' + pubAdmins.join(', '));
    }

    if (session && session.isAdminAuthenticated) {
      var pendingAiQ = Array.isArray(state.aiUnansweredQueue)
        ? state.aiUnansweredQueue.filter(function (q) { return q && q.status === 'PENDING'; }).length
        : 0;
      var pendingDisp = (state.competitions && Array.isArray(state.competitions.matchDisputes))
        ? state.competitions.matchDisputes.filter(function (d) { return d && d.status === 'PENDING'; }).length
        : 0;
      lines.push('AKTYWNY UŻYTKOWNIK: Administrator ' + String(session.adminName || 'Admin') + ' (' + String(session.adminRole || 'CO_ADMIN') + ') | Pytania AI w kolejce: ' + pendingAiQ + ' | Otwarte spory VAR (+SS): ' + pendingDisp);
    } else if (session && session.activePlayerId && playerById[session.activePlayerId]) {
      var me = playerById[session.activePlayerId];
      var myRankStr = '';
      if (hasEngine) {
        try {
          var myTable = window.SMPL_ENGINE.calculateStandings(state, me.leagueId) || [];
          for (var k = 0; k < myTable.length; k++) {
            if (myTable[k] && myTable[k].player && myTable[k].player.id === me.id) {
              var myPts = myTable[k].PKT != null ? myTable[k].PKT : (myTable[k].pts || 0);
              var myMp = myTable[k].M != null ? myTable[k].M : (myTable[k].mp || 0);
              myRankStr = ' | Pozycja w tabeli: #' + (k + 1) + ' (' + myPts + ' pkt, ' + myMp + ' meczów)';
              break;
            }
          }
        } catch (e2) {}
      }
      var myPending = [];
      for (var sm = 0; sm < matches.length; sm++) {
        var mt = matches[sm];
        if (!mt || (mt.status !== 'SCHEDULED' && mt.status !== 'PENDING')) continue;
        if (mt.homeId === me.id || mt.awayId === me.id) {
          var oppId = mt.homeId === me.id ? mt.awayId : mt.homeId;
          var oppName = playerById[oppId] ? playerById[oppId].name : oppId;
          var mtRound = mt.round != null ? mt.round : (mt.week != null ? mt.week : '?');
          myPending.push('K' + mtRound + ' vs ' + oppName + ' [' + mt.status + ']');
          if (myPending.length >= 6) break;
        }
      }
      lines.push('AKTYWNY GRACZ: ' + me.name + ' (Liga: ' + me.leagueId + (isClansUiEnabledSafe(state) && me.clanName ? ' | Klan: ' + (me.clanTag ? '[' + me.clanTag + '] ' : '') + me.clanName : '') + myRankStr + ') | Nadchodzące/oczekujące mecze: ' + (myPending.length ? myPending.join(', ') : 'brak'));
    } else {
      lines.push(isClansUiEnabledSafe(state)
        ? 'AKTYWNY UŻYTKOWNIK: Gość (niezalogowany gracz — może oglądać tabele lub założyć konto w Zapisach z wyborem/dodaniem klanu).'
        : 'AKTYWNY UŻYTKOWNIK: Gość (niezalogowany gracz — może oglądać tabele lub założyć konto w Zapisach).');
    }

    if (isClansUiEnabledSafe(state)) {
      var clans = Array.isArray(state.clans) ? state.clans : [];
      if (clans.length) {
        var clanLabels = [];
        for (var ci = 0; ci < Math.min(clans.length, 16); ci++) {
          if (clans[ci] && clans[ci].name) {
            clanLabels.push((clans[ci].tag ? '[' + clans[ci].tag + '] ' : '') + clans[ci].name);
          }
        }
        if (clanLabels.length) lines.push('OFICJALNE KLANY W BAZIE: ' + clanLabels.join(', '));
      }
    } else {
      lines.push('SYSTEM KLANÓW / WOJNY KLANÓW: Aktualnie ukryty w UI (w przygotowaniu na kolejne aktualizacje — informuj graczy, że teraz gramy indywidualnie w dywizjach).');
    }

    if (hasEngine && typeof window.SMPL_ENGINE.calculateGoldenBallStandings === 'function') {
      try {
        var gbSnap = window.SMPL_ENGINE.calculateGoldenBallStandings(state);
        if (gbSnap && Array.isArray(gbSnap.candidates) && gbSnap.candidates.length > 0) {
          var gbTopList = gbSnap.candidates.slice(0, 5).map(function (c, i) {
            return '#' + (i + 1) + ' ' + c.name + ' (' + c.leagueId + ', Łącznie: ' + c.finalScore + ' pkt, SI: ' + c.meritScore + '/100, Głosy: ' + c.votes + ')';
          });
          lines.push('ZŁOTA PIŁKA (Wagi: ' + gbSnap.meritWeightPct + '% SI + ' + gbSnap.voteWeightPct + '% głosy, limit 1 gracz = 1 głos, zakaz autogłosów): ' + gbTopList.join(' | '));
        }
      } catch (eGb) {}
    }

    var learned = Array.isArray(state.aiKnowledge) ? state.aiKnowledge : [];
    if (learned.length) {
      var kbLines = [];
      for (var ki = 0; ki < Math.min(learned.length, 12); ki++) {
        if (learned[ki] && learned[ki].title && learned[ki].answer) {
          kbLines.push(learned[ki].title + ' => ' + String(learned[ki].answer).slice(0, 260));
        }
      }
      if (kbLines.length) lines.push('WYUCZONA WIEDZA ADMINÓW:\n- ' + kbLines.join('\n- '));
    }

    return lines.join('\n');
  }

  function getQuickPrompts(state) {
    var items = [
      { label: '🌟 Pierwsze kroki (Nowy gracz)', query: 'Jestem nowy, jak zacząć od A do Z i jak zagrać mecz?' }
    ];
    if (isClansUiEnabledSafe(state)) {
      items.push({ label: '🛡️ Wybór / Dodanie Klanu & Logo', query: 'Jak wybrać klan albo dodać swój klan z własnym logo?' });
    }
    return items.concat([
      { label: '📝 Rejestracja & Historia S1–S55', query: 'Jak się zapisać i połączyć historię S1-S55?' },
      { label: '🥇 Konkursy & Puchar', query: 'Jak działają konkursy Złoty But, Puchar Ligi, Typer i Puskás?' },
      { label: '⚽ Dwumecz, Max 2 bramki & SS?', query: 'Jak wysłać oba wyniki dwumeczu (max 2 bramki) i screeny SS?' },
      { label: '🎮 Jak zagrać mecz towarzyski?', query: 'Jak rozegrać mecz w grze Score Match (Gospodarz i Gość)?' },
      { label: '📱 Apka na Telefon & Alerty', query: 'Jak zainstalować aplikację na telefonie i włączyć powiadomienia?' },
      { label: '💬 Czemu nie widzę innych lig na czacie?', query: 'Czemu nie widzę innych lig na czacie?' },
      { label: '🚩 Spór VAR & W.O. (+SS)', query: 'Jak zgłosić spór VAR lub walkower W.O. ze screenem?' }
    ]);
  }

  function getOnboardingActions(state, session) {
    const isGuestOrGate = !session || (!session.isAdminAuthenticated && !session.isPlayerAuthenticated);
    if (isGuestOrGate) {
      return [
        { label: isClansUiEnabledSafe(state) ? '📝 Otwórz Zapisy + Klan' : '📝 Otwórz Zapisy', action: 'register', badge: 'Start' },
        { label: '📊 Tabele Live', action: 'standings' },
        { label: '📅 Terminarz', action: 'schedule' },
        { label: '⚖️ Regulamin', action: 'legal' }
      ];
    }
    if (session.isAdminAuthenticated) {
      return [
        { label: '🛡️ Panel Admina', action: 'admin' },
        { label: '📊 Tabele Live', action: 'standings' },
        { label: '📅 Terminarz', action: 'schedule' },
        { label: '📅 Terminarz & Messenger', action: 'schedule' }
      ];
    }
    return [
      { label: '📅 Moje Mecze', action: 'schedule', badge: '4/tydz.' },
      { label: '➕ Wyślij Wynik', action: 'submit', badge: 'Screen' },
      { label: '🎴 Karta UT', action: 'profile' },
      { label: '💬 Czat Ligi', action: 'chat' }
    ];
  }

  return {
    ASSISTANT_NAME: ASSISTANT_NAME,
    ASSISTANT_SUBTITLE: ASSISTANT_SUBTITLE,
    BASE_KB: BASE_KB,
    normalizeText: normalizeText,
    tokenize: tokenize,
    extractAutoKeywords: extractAutoKeywords,
    getCombinedKnowledge: getCombinedKnowledge,
    getBaseItemById: getBaseItemById,
    getAvailableGeminiModels: getAvailableGeminiModels,
    buildLiveLeagueContext: buildLiveLeagueContext,
    getQuickPrompts: getQuickPrompts,
    getOnboardingActions: getOnboardingActions,
    ask: ask
  };
})();
