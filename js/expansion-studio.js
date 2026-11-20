/**
 * SCORE MATCH LIGA (OFICJALNA POLSKA LIGA SCORE! MATCH — WSZYSTKIE SEZONY)
 * SMPL Expansion Studio (v56):
 * - Studio Grafik PNG (<canvas>: Tabela, Hit Kolejki VS, Karta UT, SMPL Wrapped)
 * - Sklepik Kosmetyczny & SMPL Loyalty Coins
 * - Kamienie Milowe (Achievements) & Odznaka Rzetelnosci
 * - Wykres Kariery S1-S55 SVG, Historyczne H2H, Rekordy Sezonowe
 * - Druzyna Kolejki (TOTW), SMPL Wrapped, Gazeta Ligi SMPL, Eksport CSV (PL Excel), Wykrywacz Duplikatow SS
 * UWAGA: Scisla zgodnosc ze skladnia ES2018 (brak ?., brak ??, brak regex lookbehind) dla ChakraHost & starszych przegladarek.
 */

window.SMPL_STUDIO = (function () {
  var SHOP_CATALOG = [
    // 1. RAMKI KARTY UT & PROFILU (10) — Ekonomia Długodystansowa
    { id: 'frame_neon_emerald', category: 'frame', value: 'neon_emerald', rarity: 'KLASYK', swatch: '#10b981', price: 350, icon: '🌿', title: 'Szmaragdowa Ramka Neon', desc: 'Świetlista zielona obwódka na Karcie UT, profilu i PNG.' },
    { id: 'frame_ice_glacial', category: 'frame', value: 'ice_glacial', rarity: 'RZADKI', swatch: '#7dd3fc', price: 420, icon: '❄️', title: 'Lodowiec Arktyczny', desc: 'Mroźny błękit i krystaliczna poświata na Karcie UT i PNG.' },
    { id: 'frame_violet_galaxy', category: 'frame', value: 'violet_galaxy', rarity: 'RZADKI', swatch: '#a855f7', price: 680, icon: '🔮', title: 'Kosmiczna Mgławica', desc: 'Głęboki ultrafiolet i fioletowa poświata elity.' },
    { id: 'frame_holo_diamond', category: 'frame', value: 'holo_diamond', rarity: 'EPICKI', swatch: '#38bdf8', price: 1050, icon: '💎', title: 'Holograficzny Diament UT', desc: 'Lodowo-diamentowa ramka z błyskiem Ligi Mistrzów.' },
    { id: 'frame_cyber_magenta', category: 'frame', value: 'cyber_magenta', rarity: 'EPICKI', swatch: '#ec4899', price: 1250, icon: '⚡', title: 'Cyber Punk 2099', desc: 'Neonowa magenta z futurystycznym akcentem e-sport.' },
    { id: 'frame_gold_crown', category: 'frame', value: 'gold_crown', rarity: 'EPICKI', swatch: '#facc15', price: 1450, icon: '👑', title: 'Złota Korona Mistrza', desc: 'Królewska złota rama zarezerwowana dla najaktywniejszych.' },
    { id: 'frame_jade_dragon', category: 'frame', value: 'jade_dragon', rarity: 'LEGENDARNY', swatch: '#34d399', price: 1800, icon: '🐉', title: 'Nefrytowy Smok', desc: 'Cesarski nefryt przeplatany złotym szlifem tarczy.' },
    { id: 'frame_crimson_inferno', category: 'frame', value: 'crimson_inferno', rarity: 'LEGENDARNY', swatch: '#f43f5e', price: 2350, icon: '🔥', title: 'Szkarłatne Inferno Legend', desc: 'Ognista czerwono-złota aura elitarnych weteranów.' },
    { id: 'frame_obsidian_noir', category: 'frame', value: 'obsidian_noir', rarity: 'LEGENDARNY', swatch: '#e2e8f0', price: 2600, icon: '🖤', title: 'Obsydianowy Prestiż', desc: 'Czarna karbonowa tarcza ze srebrzystą krawędzią VIP.' },
    { id: 'frame_champion_eclipse', category: 'frame', value: 'champion_eclipse', rarity: 'VIP', swatch: '#fbbf24', price: 5000, icon: '🏆', title: 'Zaćmienie Czempiona VIP', desc: 'Najwyższy wielosezonowy tier wizualny: królewski ametyst i płynne złoto.' },

    // 2. TŁA KARTY UT & PROFILU (9)
    { id: 'bg_emerald_pitch', category: 'bg', value: 'emerald_pitch', rarity: 'KLASYK', swatch: '#059669', price: 280, icon: '⚽', title: 'Tło: Murawa Nocą UCL', desc: 'Szmaragdowe boisko oświetlone nocnymi jupiterami.' },
    { id: 'bg_stadium_aura', category: 'bg', value: 'stadium_aura', rarity: 'KLASYK', swatch: '#2563eb', price: 380, icon: '🏟️', title: 'Tło: Nocna Arena Jupitery', desc: 'Głębokie granatowe podświetlenie reflektorów stadionu.' },
    { id: 'bg_sunset_derby', category: 'bg', value: 'sunset_derby', rarity: 'RZADKI', swatch: '#f97316', price: 520, icon: '🌅', title: 'Tło: Zachód Nad Stadionem', desc: 'Gorące bursztynowo-pomarańczowe niebo przed meczem derbowym.' },
    { id: 'bg_cyber_grid', category: 'bg', value: 'cyber_grid', rarity: 'RZADKI', swatch: '#14b8a6', price: 720, icon: '🌐', title: 'Tło: Cyber-Neon Matrix', desc: 'Futurystyczna siatka gradientowa w stylu e-sport.' },
    { id: 'bg_aurora_borealis', category: 'bg', value: 'aurora_borealis', rarity: 'EPICKI', swatch: '#2dd4bf', price: 1100, icon: '🌌', title: 'Tło: Zorza Polarna Arena', desc: 'Arktyczny turkus łączący się z nocnym fioletem na Karcie UT.' },
    { id: 'bg_royal_gold', category: 'bg', value: 'royal_gold', rarity: 'EPICKI', swatch: '#eab308', price: 1350, icon: '✨', title: 'Tło: Królewski Welur Złota', desc: 'Prestiżowy czarno-złoty aksamit na Twoim profilu i karcie.' },
    { id: 'bg_volcano_magma', category: 'bg', value: 'volcano_magma', rarity: 'LEGENDARNY', swatch: '#ef4444', price: 1900, icon: '🌋', title: 'Tło: Krater Ognia', desc: 'Żarząca się magma pod stopami najgroźniejszych napastników.' },
    { id: 'bg_holo_carbon', category: 'bg', value: 'holo_carbon', rarity: 'LEGENDARNY', swatch: '#64748b', price: 2200, icon: '🕶️', title: 'Tło: Włókno Węglowe PRO', desc: 'Tekstura dark-carbon znana z bolidów sportowych.' },
    { id: 'bg_galaxies_end', category: 'bg', value: 'galaxies_end', rarity: 'VIP', swatch: '#c084fc', price: 3800, icon: '🌠', title: 'Tło: Gwiezdny Kosmos S56', desc: 'Głęboka mgławica gwiezdna widoczna w profilu i eksporcie PNG.' },

    // 3. ODZNAKI FLAIR OBOK NICKU & KARCIE UT (6)
    { id: 'badge_sniper', category: 'badge', value: 'sniper', rarity: 'KLASYK', swatch: '#38bdf8', price: 250, icon: '🎯', title: 'Odznaka: Snajper Pola Karnego', desc: 'Przypnij etykietę „🎯 SNAJPER” przy swoim nicku i na Karcie UT.' },
    { id: 'badge_wall', category: 'badge', value: 'wall', rarity: 'KLASYK', swatch: '#34d399', price: 360, icon: '🧱', title: 'Odznaka: Mur Obrony', desc: 'Znak firmowy specialisty od czystych kont („🧱 MUR”).' },
    { id: 'badge_clutch', category: 'badge', value: 'clutch', rarity: 'RZADKI', swatch: '#7dd3fc', price: 540, icon: '❄️', title: 'Odznaka: Zimna Krew 90+', desc: 'Elitarny znacznik „❄️ CLUTCH” dla graczy rozstrzygających końcówki.' },
    { id: 'badge_rocket', category: 'badge', value: 'rocket', rarity: 'EPICKI', swatch: '#fb923c', price: 900, icon: '🚀', title: 'Odznaka: Turbo Strzelec', desc: 'Wybuchowy styl ataku z etykietą „🚀 RAKIETA”.' },
    { id: 'badge_tactician', category: 'badge', value: 'tactician', rarity: 'EPICKI', swatch: '#c084fc', price: 1200, icon: '🧠', title: 'Odznaka: Architekt Gry', desc: 'Plakietka „🧠 TAKTYK” widoczna na Twoim profilu i PNG.' },
    { id: 'badge_goat_horn', category: 'badge', value: 'goat_horn', rarity: 'VIP', swatch: '#fde047', price: 2800, icon: '🐐', title: 'Odznaka: Żywa Legenda SMPL', desc: 'Prestiżowa złota plakietka „🐐 LEGENDA” dla wielosezonowych dominatorów.' },

    // 4. EFEKTY BLASKU NICKU (5)
    { id: 'nick_gold_shimmer', category: 'nickfx', value: 'gold_shimmer', rarity: 'RZADKI', swatch: '#fde047', price: 600, icon: '✨', title: 'Blask Nicku: Złote Światło', desc: 'Szlachetna złota poświata wokół Twojego nicku na Karcie UT.' },
    { id: 'nick_emerald_glow', category: 'nickfx', value: 'emerald_glow', rarity: 'RZADKI', swatch: '#34d399', price: 750, icon: '💚', title: 'Blask Nicku: Szmaragdowa Aura', desc: 'Elektryzujący zielony neon podświetlający nick zawodnika.' },
    { id: 'nick_cyber_pulse', category: 'nickfx', value: 'cyber_pulse', rarity: 'EPICKI', swatch: '#38bdf8', price: 980, icon: '💠', title: 'Blask Nicku: Cyjan Pulse', desc: 'Arktyczny cyber-neon dodający głębi nazwie na profilu.' },
    { id: 'nick_fire_blaze', category: 'nickfx', value: 'fire_blaze', rarity: 'LEGENDARNY', swatch: '#fb7185', price: 1650, icon: '🔥', title: 'Blask Nicku: Płomienny Żar', desc: 'Gorący karmazynowo-bursztynowy żar wokół Twojego nicku.' },
    { id: 'nick_prism_rainbow', category: 'nickfx', value: 'prism_rainbow', rarity: 'VIP', swatch: '#e879f9', price: 3200, icon: '🌈', title: 'Blask Nicku: Pryzmatyczny Hologram VIP', desc: 'Ekskluzywna wielobarwna aura hologramu dla kolekcjonerów.' },

    // 5. TYTUŁY KOLEKCJONERSKIE & WŁASNY NAPIS (6)
    { id: 'title_preset_king', category: 'title', value: 'KRÓL STAŁYCH FRAGMENTÓW', rarity: 'KLASYK', swatch: '#fbbf24', price: 220, icon: '🎯', title: 'Tytuł: „KRÓL STAŁYCH FRAGMENTÓW”', desc: 'Gotowy tytuł wyświetlany pod nickiem oraz na Karcie UT PNG.' },
    { id: 'title_preset_wall', category: 'title', value: 'ŁOWCA CZYSTYCH KONT', rarity: 'KLASYK', swatch: '#34d399', price: 320, icon: '🧤', title: 'Tytuł: „ŁOWCA CZYSTYCH KONT”', desc: 'Prestiżowy tytuł dla defensywnych gigantów ligi.' },
    { id: 'title_preset_comeback', category: 'title', value: 'MISTRZ POWROTÓW 90+', rarity: 'RZADKI', swatch: '#38bdf8', price: 440, icon: '⚡', title: 'Tytuł: „MISTRZ POWROTÓW 90+”', desc: 'Odwracasz losy meczów w końcówce? Ten tytuł jest dla Ciebie.' },
    { id: 'title_custom', category: 'title', value: 'custom', rarity: 'EPICKI', swatch: '#facc15', price: 850, icon: '🏷️', title: 'Własny Dowolny Tytuł na Karcie', desc: 'Wpisz absolutnie dowolny własny podpis (max 28 znaków)!' },
    { id: 'title_preset_storm', category: 'title', value: 'CISZA PRZED BURZĄ', rarity: 'EPICKI', swatch: '#a855f7', price: 1150, icon: '🌩️', title: 'Tytuł: „CISZA PRZED BURZĄ”', desc: 'Klimatyczny tytuł budzący respekt przed pierwszym gwizdkiem.' },
    { id: 'title_preset_veteran', category: 'title', value: 'LEGENDA POLSKIEJ LIGI', rarity: 'VIP', swatch: '#f43f5e', price: 2500, icon: '🏛️', title: 'Tytuł: „LEGENDA POLSKIEJ LIGI”', desc: 'Oficjalny złoty napis honorowy weteranów SMPL.' },

    // 6. DŹWIĘKI MECZOWE WEB AUDIO (6)
    { id: 'sound_arcade_levelup', category: 'sound', value: 'arcade_levelup', rarity: 'KLASYK', swatch: '#22c55e', price: 300, icon: '🕹️', title: 'Dźwięk: Retro 8-Bit Level Up', desc: 'Arcade’owe arpeggio zwycięstwa po wysłaniu wyniku meczu.' },
    { id: 'sound_fanfare', category: 'sound', value: 'fanfare', rarity: 'RZADKI', swatch: '#facc15', price: 460, icon: '🎺', title: 'Dźwięk: Fanfara Zwycięstwa', desc: 'Triumfalny akord dęty Web Audio grany przy meldunku wyniku.' },
    { id: 'sound_goal_horn', category: 'sound', value: 'goal_horn', rarity: 'RZADKI', swatch: '#fb923c', price: 620, icon: '📣', title: 'Dźwięk: Stadionowy Róg Gola', desc: 'Potężny stadionowy klakson po każdym wysłanym wyniku!' },
    { id: 'sound_laser_strike', category: 'sound', value: 'laser_strike', rarity: 'EPICKI', swatch: '#38bdf8', price: 880, icon: '🛸', title: 'Dźwięk: Cyber Laser Strzał', desc: 'Futurystyczny syntezator sci-fi i krystaliczny pogłos.' },
    { id: 'sound_champions_anthem', category: 'sound', value: 'champions_anthem', rarity: 'LEGENDARNY', swatch: '#818cf8', price: 1400, icon: '🎼', title: 'Dźwięk: Akord Ligi Mistrzów', desc: 'Szeroki wielogłosowy akord stadionowy z europejskich pucharów.' },
    { id: 'sound_samurai_gong', category: 'sound', value: 'samurai_gong', rarity: 'VIP', swatch: '#f43f5e', price: 2100, icon: '🥋', title: 'Dźwięk: Cesarski Gong Turnieju', desc: 'Głęboki, majestatyczny dźwięk gongu turniejowego weteranów.' },
    // Skórki Grafik PNG (motywy dla Tabeli, Hit Kolejki VS i SMPL Wrapped)
    { id: 'poster_arctic_ucl', category: 'poster', value: 'arctic_ucl', rarity: 'RZADKI', swatch: '#7dd3fc', price: 560, icon: '🌌', title: 'Skórka PNG: Arktyczna Noc UCL', desc: 'Mroźny granat i lodowy błękit w stylu europejskich pucharów.' },
    { id: 'poster_cyber_arena', category: 'poster', value: 'cyber_arena', rarity: 'EPICKI', swatch: '#22d3ee', price: 800, icon: '🎨', title: 'Skórka PNG: Cyber Arena', desc: 'Neonowy motyw Cyjan & Magenta dla grafik VS, Tabeli i Wrapped PNG.' },
    { id: 'poster_derby_inferno', category: 'poster', value: 'derby_inferno', rarity: 'EPICKI', swatch: '#fb7185', price: 920, icon: '🌋', title: 'Skórka PNG: Derby Inferno', desc: 'Ognisty szkarłat i pomarańczowa poświata na wielkie hity kolejki.' },
    { id: 'poster_golden_gala', category: 'poster', value: 'golden_gala', rarity: 'LEGENDARNY', swatch: '#fbbf24', price: 1500, icon: '🏆', title: 'Skórka PNG: Złota Gala Mistrzów', desc: 'Prestiżowy bursztynowo-złoty szablon galowy na Twoje grafiki PNG.' },
    { id: 'poster_royal_eclipse', category: 'poster', value: 'royal_eclipse', rarity: 'VIP', swatch: '#c084fc', price: 2400, icon: '🌑', title: 'Skórka PNG: Królewskie Zaćmienie', desc: 'Królewski fiolet i złote kontury VIP na wszystkie generowane PNG.' },
    // Limitowany Drop Sezonowy S56 (kupno wyłącznie w Sezonie 56, zostaje na zawsze!)
    { id: 'drop_s56_title_founder', category: 'title', value: 'Legenda Startu S56', seasonOnly: 56, rarity: 'LIMIT S56', swatch: '#fde047', price: 480, icon: '⏳', title: 'DROP S56: Legenda Startu S56', desc: 'Limitowany tytuł honorowy dostępny wyłącznie podczas Sezonu 56.' },
    { id: 'drop_s56_badge_pioneer', category: 'badge', value: 's56_pioneer', seasonOnly: 56, rarity: 'LIMIT S56', swatch: '#22d3ee', price: 550, icon: '💠', title: 'DROP S56: Plakietka Pionier S56', desc: 'Plakietka [💠 PIONIER S56] przy nicku dla uczestników Sezonu 56.' },
    { id: 'drop_s56_bg_starfall', category: 'bg', value: 'drop_s56_starfall', seasonOnly: 56, rarity: 'LIMIT S56', swatch: '#a78bfa', price: 720, icon: '🌠', title: 'DROP S56: Tło Deszcz Gwiazd', desc: 'Limitowane nocne niebo spadających gwiazd (wyłącznie w Sezonie 56).' },
    { id: 'drop_s56_frame_frostking', category: 'frame', value: 'drop_s56_frostking', seasonOnly: 56, rarity: 'LIMIT S56', swatch: '#38bdf8', price: 900, icon: '❄️', title: 'DROP S56: Ramka Król Mrozu', desc: 'Ekskluzywna kryształowa ramka UT i profilu dostępna tylko w Sezonie 56.' }
  ];

  var POSTER_THEMES_MAP = {
    'default': { accent: '#facc15', accent2: '#38bdf8', accentRgb: '250, 204, 21', accentRightRgb: '56, 189, 248', bg0: '#040814', bg1: '#0a1428', bg2: '#030610', headerFill: '#fde047', label: '' },
    'cyber_arena': { accent: '#22d3ee', accent2: '#e879f9', accentRgb: '34, 211, 238', accentRightRgb: '232, 121, 249', bg0: '#04121f', bg1: '#0b2239', bg2: '#060718', headerFill: '#67e8f9', label: 'CYBER ARENA' },
    'golden_gala': { accent: '#fbbf24', accent2: '#fde047', accentRgb: '251, 191, 36', accentRightRgb: '245, 158, 11', bg0: '#160d02', bg1: '#2a1a05', bg2: '#0c0701', headerFill: '#fef08a', label: 'ZŁOTA GALA' },
    'derby_inferno': { accent: '#fb7185', accent2: '#fb923c', accentRgb: '251, 113, 133', accentRightRgb: '249, 115, 22', bg0: '#1d050a', bg1: '#350a14', bg2: '#0f0306', headerFill: '#fda4af', label: 'DERBY INFERNO' },
    'arctic_ucl': { accent: '#7dd3fc', accent2: '#a5b4fc', accentRgb: '125, 211, 252', accentRightRgb: '129, 140, 248', bg0: '#051226', bg1: '#0c2345', bg2: '#030a18', headerFill: '#bae6fd', label: 'ARKTYCZNA NOC' },
    'royal_eclipse': { accent: '#c084fc', accent2: '#facc15', accentRgb: '192, 132, 252', accentRightRgb: '250, 204, 21', bg0: '#110622', bg1: '#230d45', bg2: '#070312', headerFill: '#e9d5ff', label: 'KRÓLEWSKIE ZAĆMIENIE' }
  };

  var WEEKLY_QUESTS_DEF = [
    { id: 'q_match_opener', icon: '⚽', title: 'Pierwszy Gwizdek', desc: 'Rozegraj wyznaczoną liczbę oficjalnych meczów w bieżącym sezonie.', target: 1, reward: 8 },
    { id: 'q_two_matches', icon: '⚡', title: 'Aktywny Ligowiec', desc: 'Rozegraj serię meczów w sezonie bez żadnego oddanego walkowera.', target: 2, reward: 15 },
    { id: 'q_clean_sheet', icon: '🧤', title: 'Mur Bramkarza', desc: 'Zachowaj wymagane czyste konta w zatwierdzonych meczach.', target: 1, reward: 14 },
    { id: 'q_fan_typer', icon: '🔮', title: 'Analityk Trybun', desc: 'Weź udział w Typerze Kolejki lub Sądzie Kibiców 1X2.', target: 1, reward: 6 },
    { id: 'q_three_wins', icon: '🔥', title: 'Seria Mistrza', desc: 'Zdobądź wymagany próg oficjalnych zwycięstw w tym sezonie.', target: 3, reward: 22 }
  ];

  var FRAME_CSS_MAP = {
    'default': '',
    'neon_emerald': 'smpl-ut-frame-emerald',
    'holo_diamond': 'smpl-ut-frame-diamond',
    'gold_crown': 'smpl-ut-frame-gold',
    'crimson_inferno': 'smpl-ut-frame-crimson',
    'ice_glacial': 'smpl-ut-frame-glacial',
    'violet_galaxy': 'smpl-ut-frame-galaxy',
    'cyber_magenta': 'smpl-ut-frame-magenta',
    'jade_dragon': 'smpl-ut-frame-dragon',
    'obsidian_noir': 'smpl-ut-frame-obsidian',
    'champion_eclipse': 'smpl-ut-frame-eclipse',
    'drop_s56_frostking': 'smpl-ut-frame-frostking'
  };

  var BG_CSS_MAP = {
    'default': '',
    'stadium_aura': 'smpl-profile-bg-stadium',
    'cyber_grid': 'smpl-profile-bg-cyber',
    'royal_gold': 'smpl-profile-bg-royal',
    'emerald_pitch': 'smpl-profile-bg-pitch',
    'sunset_derby': 'smpl-profile-bg-sunset',
    'aurora_borealis': 'smpl-profile-bg-aurora',
    'volcano_magma': 'smpl-profile-bg-volcano',
    'holo_carbon': 'smpl-profile-bg-carbon',
    'galaxies_end': 'smpl-profile-bg-cosmos',
    'drop_s56_starfall': 'smpl-profile-bg-starfall'
  };

  var BADGE_DISPLAY_MAP = {
    'sniper': { badge: '🎯 SNAJPER', color: '#38bdf8' },
    'wall': { badge: '🧱 MUR', color: '#34d399' },
    'clutch': { badge: '❄️ CLUTCH', color: '#7dd3fc' },
    'rocket': { badge: '🚀 RAKIETA', color: '#fb923c' },
    'tactician': { badge: '🧠 TAKTYK', color: '#c084fc' },
    'goat_horn': { badge: '🐐 LEGENDA', color: '#fde047' },
    's56_pioneer': { badge: '💠 PIONIER S56', color: '#22d3ee' }
  };

  var NICKFX_CSS_MAP = {
    'default': '',
    'gold_shimmer': 'smpl-nickfx-gold',
    'emerald_glow': 'smpl-nickfx-emerald',
    'cyber_pulse': 'smpl-nickfx-cyber',
    'fire_blaze': 'smpl-nickfx-fire',
    'prism_rainbow': 'smpl-nickfx-prism'
  };

  function foldName(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .replace(/ą/g, 'a')
      .replace(/ć/g, 'c')
      .replace(/ę/g, 'e')
      .replace(/ł/g, 'l')
      .replace(/ń/g, 'n')
      .replace(/ó/g, 'o')
      .replace(/ś/g, 's')
      .replace(/[źż]/g, 'z')
      .replace(/\s+/g, ' ');
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function todayYmd() {
    try {
      return new Date().toISOString().slice(0, 10);
    } catch (e) {
      return '2026-01-01';
    }
  }

  function getArchiveData() {
    return (typeof window !== 'undefined' && window.SMPL_ARCHIVE_DATA) ? window.SMPL_ARCHIVE_DATA : null;
  }

  function findArchiveCareerEntry(playerName, archiveName) {
    var arch = getArchiveData();
    if (!arch) return null;
    var targets = [foldName(archiveName || ''), foldName(playerName || '')].filter(Boolean);
    if (!targets.length) return null;
    var lists = [arch.CAREER_RANKING || [], arch.ALL_TIME_RANKING || []];
    for (var li = 0; li < lists.length; li++) {
      var arr = lists[li];
      for (var i = 0; i < arr.length; i++) {
        var row = arr[i];
        if (!row || !row.name) continue;
        var fn = foldName(row.name);
        if (targets.indexOf(fn) >= 0) return row;
      }
    }
    return null;
  }

  function isPlayerOnVacation(player, refYmd) {
    if (!player || !player.vacation || typeof player.vacation !== 'object') return false;
    if (!player.vacation.isOnVacation) return false;
    var until = String(player.vacation.untilDate || '').trim();
    if (until && /^\d{4}-\d{2}-\d{2}$/.test(until)) {
      var today = refYmd || todayYmd();
      if (until < today) return false;
    }
    return true;
  }

  function vacationBadgeHtml(player) {
    if (!isPlayerOnVacation(player)) return '';
    var until = String(player.vacation.untilDate || '').trim();
    var reason = String(player.vacation.reason || '').trim();
    var titleTxt = 'Urlop zgloszony' + (until ? (' do ' + until) : '') + (reason ? (' — ' + reason) : '');
    return '<span class="smpl-vacation-badge" title="' + escHtml(titleTxt) + '">✈️ Urlop' + (until ? (' (' + escHtml(until.slice(5)) + ')') : '') + '</span>';
  }

  function calculateReliabilityBadge(state, playerId) {
    var s = state || {};
    var matches = (s.matches || []).filter(function (m) {
      return m && (String(m.homeId) === String(playerId) || String(m.awayId) === String(playerId));
    });
    var currentWeek = Number((s.weeklyConfig && s.weeklyConfig.currentWeek) || 1);
    var roundsPerWeek = Number((s.weeklyConfig && s.weeklyConfig.roundsPerWeek) || 8);
    var maxExpectedRound = Math.max(roundsPerWeek, currentWeek * roundsPerWeek);
    var played = 0;
    var pending = 0;
    var woLost = 0;
    var overdue = 0;
    var totalDue = 0;

    matches.forEach(function (m) {
      var rnd = Number(m.round || 1);
      var st = String(m.status || 'SCHEDULED');
      if (st === 'APPROVED') played++;
      else if (st === 'PENDING') pending++;
      else if (st === 'WALKOVER') {
        var hs = Number(m.homeScore || 0);
        var as = Number(m.awayScore || 0);
        if ((String(m.homeId) === String(playerId) && hs < as) || (String(m.awayId) === String(playerId) && as < hs)) {
          woLost++;
        } else {
          played++;
        }
      } else if (st === 'SCHEDULED' && rnd <= maxExpectedRound - roundsPerWeek) {
        overdue++;
      }
      if (rnd <= maxExpectedRound) totalDue++;
    });

    if (matches.length === 0) {
      return { tier: 'DEBIUT', icon: '⚪', label: 'Nowy w terminarzu', css: 'smpl-rel-neutral', played: 0, overdue: 0, woLost: 0, pct: 100 };
    }
    var doneCount = played + pending;
    var pct = totalDue > 0 ? Math.min(100, Math.round((doneCount / totalDue) * 100)) : 100;
    if (woLost === 0 && overdue === 0 && (played >= 2 || pct >= 85)) {
      return { tier: 'TERMINOWY', icon: '🟢', label: 'Terminowy Gracz', css: 'smpl-rel-green', played: played, overdue: overdue, woLost: woLost, pct: pct };
    }
    if (woLost === 0 && overdue <= 2) {
      return { tier: 'SOLIDNY', icon: '🟡', label: 'Aktywny (' + pct + '%)', css: 'smpl-rel-amber', played: played, overdue: overdue, woLost: woLost, pct: pct };
    }
    return { tier: 'ZALEGLOSCI', icon: '🔴', label: (woLost > 0 ? ('WO: ' + woLost) : ('Zalegle: ' + overdue)), css: 'smpl-rel-red', played: played, overdue: overdue, woLost: woLost, pct: pct };
  }

  function reliabilityBadgeHtml(state, playerId, compact) {
    var rel = calculateReliabilityBadge(state, playerId);
    if (rel.tier === 'DEBIUT') return '';
    if (compact && rel.tier === 'SOLIDNY') return '';
    return '<span class="smpl-rel-badge ' + rel.css + '" title="Rzetelnosc: ' + escHtml(rel.label) + ' (' + rel.pct + '% w terminie)">' + rel.icon + (compact ? '' : (' ' + escHtml(rel.label))) + '</span>';
  }

  function calculatePlayerCoinsBreakdown(state, playerId) {
    var s = state || {};
    var pid = String(playerId || '');
    if (!pid) {
      return {
        earned: 0, spent: 0, balance: 0,
        breakdown: {
          matchesCoins: 0, cleanSheetCoins: 0, timelyBonusCoins: 0, typerCoins: 0,
          puskasCoins: 0, goldenBallCoins: 0, adminBonusCoins: 0,
          questCoins: 0, giftCoinsReceived: 0, carryoverCoins: 0
        }
      };
    }
    var played = 0;
    var cs = 0;
    var woLost = 0;
    var byId = {};
    (s.matches || []).forEach(function (m) {
      if (!m) return;
      if (m.id) byId[String(m.id)] = m;
      var h = String(m.homeId || '');
      var a = String(m.awayId || '');
      if (h !== pid && a !== pid) return;
      if (m.status === 'APPROVED') {
        played++;
        var hs = Number(m.homeScore || 0);
        var as = Number(m.awayScore || 0);
        if ((h === pid && as === 0) || (a === pid && hs === 0)) cs++;
      } else if (m.status === 'WALKOVER') {
        var whs = Number(m.homeScore || 0);
        var was = Number(m.awayScore || 0);
        if ((h === pid && whs < was) || (a === pid && was < whs)) woLost++;
      }
    });

    // Długoterminowa ekonomia SMPL: powolne, prestiżowe gromadzenie monet między sezonami
    var matchesCoins = played * 6;
    var cleanSheetCoins = cs * 5;
    var timelyBonusCoins = (played >= 10 && woLost === 0) ? 35 : 0;

    var comp = s.competitions || {};
    var typerCoins = 0;
    (comp.typerPredictions || []).forEach(function (pr) {
      if (!pr || String(pr.voterPlayerId || '') !== pid) return;
      var m = byId[String(pr.matchId || '')];
      if (m && m.status === 'APPROVED') {
        var hs = Number(m.homeScore);
        var as = Number(m.awayScore);
        var ph = Number(pr.predHome);
        var pa = Number(pr.predAway);
        if (hs === ph && as === pa) typerCoins += 12;
        else if ((hs > as && ph > pa) || (hs < as && ph < pa) || (hs === as && ph === pa)) typerCoins += 4;
      }
    });

    var hasPuskas = false;
    (comp.puskasNominations || []).forEach(function (nm) {
      if (nm && String(nm.playerId || '') === pid) hasPuskas = true;
    });
    var puskasCoins = hasPuskas ? 15 : 0;

    var goldenBallCoins = 0;
    if (s.goldenBall && Array.isArray(s.goldenBall.votes)) {
      var hasGb = s.goldenBall.votes.some(function (vt) { return vt && String(vt.voterPlayerId || '') === pid; });
      if (hasGb) goldenBallCoins = 10;
    }

    var pShop = comp.playerShop || { unlocks: {}, bonusCoins: {} };
    var adminBonusCoins = (pShop.bonusCoins && pShop.bonusCoins[pid]) ? Number(pShop.bonusCoins[pid] || 0) : 0;
    var unlockObj = (pShop.unlocks && pShop.unlocks[pid]) ? pShop.unlocks[pid] : null;
    var spent = unlockObj ? Number(unlockObj.spentCoins || 0) : 0;
    var questCoins = unlockObj ? Number(unlockObj.questCoins || 0) : 0;
    var giftCoinsReceived = unlockObj ? Number(unlockObj.giftCoinsReceived || 0) : 0;
    var carryoverCoins = unlockObj ? Number(unlockObj.carryoverCoins || 0) : 0;

    var earned = matchesCoins + cleanSheetCoins + timelyBonusCoins + typerCoins + puskasCoins + goldenBallCoins + adminBonusCoins + questCoins + giftCoinsReceived + carryoverCoins;
    var balance = Math.max(0, earned - spent);
    return {
      earned: earned,
      spent: spent,
      balance: balance,
      breakdown: {
        matchesCoins: matchesCoins,
        cleanSheetCoins: cleanSheetCoins,
        timelyBonusCoins: timelyBonusCoins,
        typerCoins: typerCoins,
        puskasCoins: puskasCoins,
        goldenBallCoins: goldenBallCoins,
        adminBonusCoins: adminBonusCoins,
        questCoins: questCoins,
        giftCoinsReceived: giftCoinsReceived,
        carryoverCoins: carryoverCoins
      }
    };
  }

  function getPlayerCosmetics(state, playerId) {
    var comp = (state && state.competitions) ? state.competitions : {};
    var pShop = comp.playerShop || {};
    var unlocks = pShop.unlocks || {};
    var u = unlocks[String(playerId || '')] || {};
    var frame = String(u.frame || 'default');
    var bgStyle = String(u.bgStyle || 'default');
    var profileBadge = String(u.profileBadge || 'default');
    var nickEffect = String(u.nickEffect || 'default');
    var posterTheme = String(u.posterTheme || 'default');
    var posterThemeMeta = POSTER_THEMES_MAP[posterTheme] || POSTER_THEMES_MAP['default'];
    var badgeMeta = BADGE_DISPLAY_MAP[profileBadge] || null;
    return {
      frame: frame,
      bgStyle: bgStyle,
      customTitle: String(u.customTitle || ''),
      joinSound: String(u.joinSound || 'default'),
      profileBadge: profileBadge,
      badgeLabel: badgeMeta ? badgeMeta.badge : '',
      badgeColor: badgeMeta ? badgeMeta.color : '#38bdf8',
      nickEffect: nickEffect,
      nickFxCss: NICKFX_CSS_MAP[nickEffect] || '',
      posterTheme: posterTheme,
      posterThemeMeta: posterThemeMeta,
      claimedQuests: Array.isArray(u.claimedQuests) ? u.claimedQuests : [],
      questCoins: Number(u.questCoins || 0),
      giftCoinsReceived: Number(u.giftCoinsReceived || 0),
      carryoverCoins: Number(u.carryoverCoins || 0),
      unlockedItems: Array.isArray(u.unlockedItems) ? u.unlockedItems : [],
      spentCoins: Number(u.spentCoins || 0),
      frameCss: FRAME_CSS_MAP[frame] || '',
      bgCss: BG_CSS_MAP[bgStyle] || ''
    };
  }

  function computePlayerWeeklyQuests(state, playerId) {
    var s = state || {};
    var pid = String(playerId || '');
    var season = Number(s.season || 56);
    var currentWeek = Math.max(1, Number((s.weeklyConfig && s.weeklyConfig.currentWeek) || 1));
    var stepW = Math.max(0, currentWeek - 1);
    var comp = s.competitions || {};
    var unlocks = (comp.playerShop && comp.playerShop.unlocks) ? comp.playerShop.unlocks : {};
    var u = unlocks[pid] || {};
    var claimedList = Array.isArray(u.claimedQuests) ? u.claimedQuests : [];

    var played = 0;
    var wins = 0;
    var cs = 0;
    var woLost = 0;
    (s.matches || []).forEach(function (m) {
      if (!m) return;
      var hId = String(m.homeId || '');
      var aId = String(m.awayId || '');
      if (hId !== pid && aId !== pid) return;
      var isH = hId === pid;
      var myG = Number(isH ? m.homeScore : m.awayScore);
      var opG = Number(isH ? m.awayScore : m.homeScore);
      if (m.status === 'APPROVED') {
        played++;
        if (myG > opG) wins++;
        if (opG === 0) cs++;
      } else if (m.status === 'WALKOVER') {
        if (myG < opG) woLost++;
      }
    });

    var typerCount = (comp.typerPredictions || []).filter(function (tp) {
      return tp && String(tp.voterPlayerId || '') === pid;
    }).length;

    var fanPollCount = 0;
    var polls = comp.fanPolls || {};
    Object.keys(polls).forEach(function (mid) {
      var fp = polls[mid];
      if (!fp) return;
      var inHome = Array.isArray(fp.homeVotes) && fp.homeVotes.indexOf(pid) !== -1;
      var inAway = Array.isArray(fp.awayVotes) && fp.awayVotes.indexOf(pid) !== -1;
      var inDraw = Array.isArray(fp.drawVotes) && fp.drawVotes.indexOf(pid) !== -1;
      if (inHome || inAway || inDraw) fanPollCount++;
    });

    var typerFan = typerCount + fanPollCount;

    return WEEKLY_QUESTS_DEF.map(function (q) {
      var target = q.target;
      var progress = 0;
      var done = false;
      var desc = q.desc;
      if (q.id === 'q_match_opener') {
        target = 1 + (stepW * 2);
        progress = played;
        done = played >= target;
        desc = 'Rozegraj min. ' + target + ' oficjalnych meczów w sezonie (próg Tyg. ' + currentWeek + ').';
      } else if (q.id === 'q_two_matches') {
        target = 2 + (stepW * 2);
        progress = woLost === 0 ? played : 0;
        done = played >= target && woLost === 0;
        desc = 'Rozegraj min. ' + target + ' meczów w sezonie bez żadnego oddanego walkowera.';
      } else if (q.id === 'q_clean_sheet') {
        target = 1 + stepW;
        progress = cs;
        done = cs >= target;
        desc = 'Zachowaj min. ' + target + ' czystych kont w zatwierdzonych meczach.';
      } else if (q.id === 'q_fan_typer') {
        target = 1 + (stepW * 2);
        progress = typerFan;
        done = typerFan >= target;
        desc = 'Oddaj co najmniej ' + target + ' głosów w Typerze lub Sądzie Kibiców.';
      } else if (q.id === 'q_three_wins') {
        target = 3 + (stepW * 2);
        progress = wins;
        done = wins >= target;
        desc = 'Odnieś minimum ' + target + ' oficjalnych zwycięstw w sezonie (próg Tyg. ' + currentWeek + ').';
      }
      var periodKey = 'S' + season + '_W' + currentWeek + ':' + q.id;
      var claimed = claimedList.indexOf(periodKey) !== -1;
      return {
        id: q.id,
        icon: q.icon,
        title: q.title,
        desc: desc,
        target: target,
        reward: q.reward,
        progress: Math.min(target, progress),
        rawProgress: progress,
        done: done,
        claimed: claimed,
        claimable: !claimed && done,
        periodKey: periodKey,
        season: season,
        week: currentWeek
      };
    });
  }

  function calculatePlayerAchievements(state, playerId) {
    var s = state || {};
    var pid = String(playerId || '');
    var player = (s.players || []).find(function (p) { return p && String(p.id) === pid; }) || null;
    if (!player) return { unlockedCount: 0, totalCount: 0, items: [] };

    var archRow = findArchiveCareerEntry(player.name, player.historicalArchiveName);
    var matches = (s.matches || []).filter(function (m) {
      return m && (String(m.homeId) === pid || String(m.awayId) === pid);
    });

    var sPlayed = 0;
    var sWins = 0;
    var sGoals = 0;
    var sCS = 0;
    var sWoLost = 0;
    var roundStats = {};
    var winOppList = [];
    var maxUnbeaten = 0;
    var curUnbeaten = 0;
    var rpw = Math.max(4, Number((s.weeklyConfig && s.weeklyConfig.roundsPerWeek) || 4));

    var sortedMatches = matches.slice().sort(function (a, b) {
      return Number(a.round || 0) - Number(b.round || 0);
    });

    sortedMatches.forEach(function (m) {
      if (m.status === 'WALKOVER') {
        var whs = Number(m.homeScore || 0);
        var was = Number(m.awayScore || 0);
        if ((String(m.homeId) === pid && whs < was) || (String(m.awayId) === pid && was < whs)) {
          sWoLost++;
          curUnbeaten = 0;
        }
        return;
      }
      if (m.status !== 'APPROVED') return;
      sPlayed++;
      var isH = String(m.homeId) === pid;
      var gf = Number(isH ? m.homeScore : m.awayScore);
      var ga = Number(isH ? m.awayScore : m.homeScore);
      var oppId = String(isH ? m.awayId : m.homeId);
      sGoals += gf;
      if (ga === 0) sCS++;
      if (gf > ga) {
        sWins++;
        winOppList.push(oppId);
      }
      if (gf >= ga) {
        curUnbeaten++;
        if (curUnbeaten > maxUnbeaten) maxUnbeaten = curUnbeaten;
      } else {
        curUnbeaten = 0;
      }
      var wk = Math.ceil(Number(m.round || 1) / rpw);
      if (!roundStats[wk]) roundStats[wk] = { played: 0, wins: 0 };
      roundStats[wk].played++;
      if (gf > ga) roundStats[wk].wins++;
    });

    var cleanSweepWeeksCount = Object.keys(roundStats).filter(function (wk) {
      return roundStats[wk].played >= 4 && roundStats[wk].wins === roundStats[wk].played;
    }).length;

    var divTopIds = {};
    var playerDiv = String(player.leagueId || 'L1');
    if (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateStandings === 'function') {
      var divTbl = window.SMPL_ENGINE.calculateStandings(s, playerDiv) || [];
      divTbl.slice(0, 5).forEach(function (r) { divTopIds[String(r.playerId)] = true; });
    }
    var giantWinsCount = winOppList.filter(function (oid) { return divTopIds[oid] && oid !== pid; }).length;

    var histMatches = archRow ? Number(archRow.matches || 0) : 0;
    var totalMatches = histMatches + sPlayed;
    var histWins = archRow ? Number(archRow.wins || 0) : 0;
    var totalWins = histWins + sWins;
    var histGoals = archRow ? Number(archRow.gf || 0) : 0;
    var totalGoals = histGoals + sGoals;
    var histL1Seasons = archRow ? Number(archRow.l1Seasons || 0) : 0;

    var archGolds = archRow ? Number(archRow.gold || 0) : 0;
    var archMedals = archRow ? Number(archRow.medals || (Number(archRow.gold || 0) + Number(archRow.silver || 0) + Number(archRow.bronze || 0))) : 0;
    var liveGolds = 0;
    var liveMedals = 0;
    if (Array.isArray(player.trophies)) {
      player.trophies.forEach(function (t) {
        if (!t) return;
        var tid = String(t.id || '');
        var txt = String(t.title || '') + ' ' + String(t.season || '');
        var isHist = tid.indexOf('TR_HIST_') === 0 || tid.indexOf('ARCH_') === 0 || /Archiwum|Sezon\s+([1-9]|[1-4][0-9]|5[0-4])\b|\bS([1-9]|[1-4][0-9]|5[0-4])\b/i.test(txt);
        if (isHist) return;
        if (/Mistrz|Złoto|Zloto/i.test(String(t.title || '')) || t.rarity === 'MYTHIC') {
          liveGolds++;
          liveMedals++;
        } else if (/Wicemistrz|Srebro|Brąz|Braz|3\.\s*miejsce|2\.\s*miejsce/i.test(String(t.title || ''))) {
          liveMedals++;
        }
      });
    }
    var totalGolds = archGolds + liveGolds;
    var totalMedals = archMedals + liveMedals;

    var comp = s.competitions || {};
    var didVoteGb = Boolean(s.goldenBall && Array.isArray(s.goldenBall.votes) && s.goldenBall.votes.some(function (v) { return v && String(v.voterPlayerId || '') === pid; }));
    var typerCount = (comp.typerPredictions || []).filter(function (v) { return v && String(v.voterPlayerId || '') === pid; }).length;

    function calcPct(val, target) {
      if (target <= 0) return 0;
      return Math.max(0, Math.min(100, Math.round((Number(val || 0) / target) * 100)));
    }

    var defs = [
      { id: 'M500', tier: 'WETERAN', icon: '🎖️', title: 'Klub 500 Weterana', desc: '500+ oficjalnych meczów w historii SMPL', done: totalMatches >= 500, progress: totalMatches + '/500', pct: calcPct(totalMatches, 500) },
      { id: 'M1000', tier: 'ELITA', icon: '🏛️', title: 'Panteon 1000', desc: '1 000+ oficjalnych meczów w karierze', done: totalMatches >= 1000, progress: totalMatches + '/1000', pct: calcPct(totalMatches, 1000) },
      { id: 'M1500', tier: 'LEGEND', icon: '💎', title: 'Klub 1500 Tytanów', desc: '1 500+ oficjalnych meczów na arenach SMPL', done: totalMatches >= 1500, progress: totalMatches + '/1500', pct: calcPct(totalMatches, 1500) },
      { id: 'M2000', tier: 'MYTHIC', icon: '🌌', title: 'Nieśmiertelny 2000', desc: '2 000+ oficjalnych meczów — mityczny rekord!', done: totalMatches >= 2000, progress: totalMatches + '/2000', pct: calcPct(totalMatches, 2000) },

      { id: 'W500', tier: 'ELITA', icon: '⚔️', title: 'Klub 500 Zwycięstw', desc: '500+ wygranych spotkań w historii kariery', done: totalWins >= 500, progress: totalWins + '/500 W', pct: calcPct(totalWins, 500) },
      { id: 'W750', tier: 'MYTHIC', icon: '🦁', title: 'Legenda 750 Zwycięstw', desc: '750+ wygranych meczów — rekordowy szczyt!', done: totalWins >= 750, progress: totalWins + '/750 W', pct: calcPct(totalWins, 750) },
      { id: 'GOALS1200', tier: 'ELITA', icon: '🎯', title: 'Kanonier 1200+', desc: '1 200+ goli w karierze lub 40+ w sezonie', done: totalGoals >= 1200 || sGoals >= 40, progress: totalGoals + '/1200 (sez: ' + sGoals + '/40)', pct: Math.max(calcPct(totalGoals, 1200), calcPct(sGoals, 40)) },
      { id: 'GOALS1800', tier: 'MYTHIC', icon: '☄️', title: 'Król Kanonierów 1800', desc: '1 800+ goli w karierze lub 50+ w sezonie', done: totalGoals >= 1800 || sGoals >= 50, progress: totalGoals + '/1800 (sez: ' + sGoals + '/50)', pct: Math.max(calcPct(totalGoals, 1800), calcPct(sGoals, 50)) },

      { id: 'GOLD3', tier: 'LEGEND', icon: '👑', title: 'Potrójny Mistrz', desc: 'Min. 3 złote medale ligowe w historii kariery', done: totalGolds >= 3, progress: totalGolds + '/3 Złota', pct: calcPct(totalGolds, 3) },
      { id: 'GOLD7', tier: 'MYTHIC', icon: '🏆', title: 'Dynastia Mistrzów 7×', desc: 'Min. 7 złotych medali ligowych w karierze', done: totalGolds >= 7, progress: totalGolds + '/7 Złot', pct: calcPct(totalGolds, 7) },
      { id: 'MEDALS10', tier: 'LEGEND', icon: '🥇', title: 'Kolekcjoner Podium', desc: 'Min. 10 medali ligowych (Złoto/Srebro/Brąz)', done: totalMedals >= 10, progress: totalMedals + '/10 medali', pct: calcPct(totalMedals, 10) },
      { id: 'ELITE20', tier: 'LEGEND', icon: '🏟️', title: 'Filar Ekstraklasy 20+', desc: 'Min. 20 pełnych sezonów w Ekstraklasie (L1)', done: histL1Seasons >= 20, progress: histL1Seasons + '/20 sez. L1', pct: calcPct(histL1Seasons, 20) },

      { id: 'CS10', tier: 'SEASON', icon: '🧤', title: 'Żelazna Kurtyna 10+', desc: 'Min. 10 czystych kont w jednym sezonie', done: sCS >= 10, progress: sCS + '/10 CS', pct: calcPct(sCS, 10) },
      { id: 'STREAK10', tier: 'SEASON', icon: '🔥', title: 'Niepokonany 10+', desc: 'Seria min. 10 meczów bez porażki w sezonie', done: maxUnbeaten >= 10, progress: maxUnbeaten + '/10 serii', pct: calcPct(maxUnbeaten, 10) },
      { id: 'SWEEP2', tier: 'SEASON', icon: '⚡', title: 'Podwójny Perfekt', desc: 'Min. 2 perfekcyjne tygodnie (komplet ≥4 W)', done: cleanSweepWeeksCount >= 2, progress: cleanSweepWeeksCount + '/2 tyg.', pct: calcPct(cleanSweepWeeksCount, 2) },
      { id: 'GIANT3', tier: 'SEASON', icon: '🐉', title: 'Kat Gigantów 3×', desc: 'Min. 3 zwycięstwa w sezonie z TOP 5 swojej ligi', done: giantWinsCount >= 3, progress: giantWinsCount + '/3 vs TOP 5', pct: calcPct(giantWinsCount, 3) },
      { id: 'FAIRPLAY25', tier: 'SEASON', icon: '🟢', title: 'Żelazny Terminarz 25+', desc: 'Min. 25 rozegranych meczów w sezonie bez WO', done: sPlayed >= 25 && sWoLost === 0, progress: sPlayed + '/25 (WO: ' + sWoLost + ')', pct: sWoLost === 0 ? calcPct(sPlayed, 25) : 0 },
      { id: 'FAN_PRO', tier: 'SEASON', icon: '🗳️', title: 'Głos Społeczności Pro', desc: 'Głos w Złotej Piłce + min. 5 typów w Typerze', done: didVoteGb && typerCount >= 5, progress: 'Typer ' + typerCount + '/5 • ZP ' + (didVoteGb ? '✓' : '0/1'), pct: Math.min(100, Math.round(((Math.min(typerCount, 5) + (didVoteGb ? 1 : 0)) / 6) * 100)) }
    ];

    var unlockedCount = defs.filter(function (d) { return d.done; }).length;
    return { unlockedCount: unlockedCount, totalCount: defs.length, items: defs };
  }

  var _seasonRecordsCache = null;

  function computePlayerCareerTrajectory(playerName, archiveName) {
    var arch = getArchiveData();
    if (!arch || !Array.isArray(arch.HISTORICAL_SEASONS)) return { points: [], summary: null };
    var targets = [foldName(archiveName || ''), foldName(playerName || '')].filter(Boolean);
    if (!targets.length) return { points: [], summary: null };

    var points = [];
    var seasonsSorted = arch.HISTORICAL_SEASONS.slice().sort(function (a, b) {
      return Number(a.seasonNumber || 0) - Number(b.seasonNumber || 0);
    });

    seasonsSorted.forEach(function (seas) {
      if (!seas || !seas.leagues) return;
      var found = null;
      var leagueKeys = Object.keys(seas.leagues);
      for (var li = 0; li < leagueKeys.length; li++) {
        var lKey = leagueKeys[li];
        var tbl = seas.leagues[lKey];
        if (!Array.isArray(tbl)) continue;
        for (var ri = 0; ri < tbl.length; ri++) {
          var row = tbl[ri];
          if (!row || !row.name) continue;
          if (targets.indexOf(foldName(row.name)) >= 0) {
            found = {
              seasonNumber: Number(seas.seasonNumber || 0),
              inProgress: Boolean(seas.inProgress),
              yearLabel: seas.yearLabel || ('S' + seas.seasonNumber),
              leagueId: lKey,
              pos: Number(row.pos || (ri + 1)),
              M: Number(row.M || 0),
              W: Number(row.W || 0),
              R: Number(row.R || 0),
              P: Number(row.P || 0),
              BZ: Number(row.BZ || 0),
              BS: Number(row.BS || 0),
              PKT: Number(row.PKT || 0),
              note: String(row.note || '')
            };
            break;
          }
        }
        if (found) break;
      }
      if (found) points.push(found);
    });

    var summary = findArchiveCareerEntry(playerName, archiveName);
    return { points: points, summary: summary };
  }

  function renderCareerTrajectorySvg(points) {
    if (!points || !points.length) {
      return '<div class="text-xs text-slate-400 p-4 rounded-xl border border-slate-700/60 bg-slate-900/50">Brak historycznych wystepow tego gracza w bazie S1–S55. Rozegraj swoj pierwszy sezon, aby zbudowac wykres kariery!</div>';
    }
    var W = 680;
    var H = 220;
    var padL = 48;
    var padR = 20;
    var padT = 22;
    var padB = 34;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    // Skala globalna: L1 pos 1..16 -> y od 0..15, L2 pos 1..16 -> y od 17..32, L3 pos 1..16 -> y od 34..49
    function mapPoint(pt, idx) {
      var x = points.length === 1 ? (padL + plotW / 2) : (padL + (idx / (points.length - 1)) * plotW);
      var lNum = Number(String(pt.leagueId || 'L1').replace(/\D/g, '')) || 1;
      var tierOffset = (Math.min(3, Math.max(1, lNum)) - 1) * 17;
      var rankScore = Math.min(49, tierOffset + Math.min(16, Math.max(1, pt.pos)) - 1);
      var y = padT + (rankScore / 49) * plotH;
      var color = lNum === 1 ? '#facc15' : (lNum === 2 ? '#38bdf8' : '#fb923c');
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), color: color, pt: pt, lNum: lNum };
    }

    var coords = points.map(mapPoint);
    var polyPts = coords.map(function (c) { return c.x + ',' + c.y; }).join(' ');

    var l1H = (16 / 49) * plotH;
    var l2Y = padT + (17 / 49) * plotH;
    var l2H = (16 / 49) * plotH;
    var l3Y = padT + (34 / 49) * plotH;
    var l3H = (15 / 49) * plotH;

    var dotsSvg = coords.map(function (c) {
      var tip = 'Sezon ' + c.pt.seasonNumber + (c.pt.inProgress ? ' (półmetek)' : '') + ' (' + c.pt.leagueId + '): #' + c.pt.pos + ' • ' + c.pt.PKT + ' pkt (' + c.pt.W + 'W-' + c.pt.R + 'R-' + c.pt.P + 'P)';
      return '<circle cx="' + c.x + '" cy="' + c.y + '" r="' + (coords.length > 25 ? 3.5 : 4.8) + '" fill="' + c.color + '" stroke="#0f172a" stroke-width="1.5"><title>' + escHtml(tip) + '</title></circle>';
    }).join('');

    var labelIdxs = [0];
    if (coords.length > 4) labelIdxs.push(Math.floor(coords.length / 2));
    if (coords.length > 1) labelIdxs.push(coords.length - 1);
    var xLabelsSvg = labelIdxs.map(function (idx) {
      var c = coords[idx];
      return '<text x="' + c.x + '" y="' + (H - 10) + '" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="sans-serif">S' + c.pt.seasonNumber + '</text>';
    }).join('');

    return '' +
      '<div class="smpl-career-chart-wrap">' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full h-auto" role="img" aria-label="Wykres kariery S1-S55">' +
          '<rect x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + l1H.toFixed(1) + '" fill="rgba(250,204,21,0.08)" rx="4"/>' +
          '<rect x="' + padL + '" y="' + l2Y.toFixed(1) + '" width="' + plotW + '" height="' + l2H.toFixed(1) + '" fill="rgba(56,189,248,0.06)" rx="4"/>' +
          '<rect x="' + padL + '" y="' + l3Y.toFixed(1) + '" width="' + plotW + '" height="' + l3H.toFixed(1) + '" fill="rgba(251,146,60,0.06)" rx="4"/>' +
          '<text x="8" y="' + (padT + 14) + '" fill="#fde047" font-size="10" font-weight="bold">L1</text>' +
          '<text x="8" y="' + (l2Y + 14).toFixed(1) + '" fill="#7dd3fc" font-size="10" font-weight="bold">2.L</text>' +
          '<text x="8" y="' + (l3Y + 14).toFixed(1) + '" fill="#fdba74" font-size="10" font-weight="bold">3.L</text>' +
          '<polyline fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-linejoin="round" points="' + polyPts + '"/>' +
          dotsSvg +
          xLabelsSvg +
        '</svg>' +
        '<div class="text-xs text-slate-400 mt-1 flex flex-wrap gap-3 justify-between">' +
          '<span>📈 Najedz na punkt, aby zobaczyc wynik w sezonie S1–S55</span>' +
          '<span>Sezonow w archiwum: <strong class="text-amber-300">' + points.length + '</strong></span>' +
        '</div>' +
      '</div>';
  }

  function computeHistoricalH2H(nameA, nameB, archA, archB) {
    var trajA = computePlayerCareerTrajectory(nameA, archA);
    var trajB = computePlayerCareerTrajectory(nameB, archB);
    var mapA = {};
    trajA.points.forEach(function (p) { mapA[p.seasonNumber] = p; });
    var shared = [];
    var higherA = 0;
    var higherB = 0;
    var sameLeagueHigherA = 0;
    var sameLeagueHigherB = 0;

    trajB.points.forEach(function (pb) {
      var pa = mapA[pb.seasonNumber];
      if (!pa || pa.inProgress || pb.inProgress) return;
      var lA = Number(String(pa.leagueId || 'L1').replace(/\D/g, '')) || 1;
      var lB = Number(String(pb.leagueId || 'L1').replace(/\D/g, '')) || 1;
      var sameLg = pa.leagueId === pb.leagueId;
      var winner = 'TIE';
      if (lA < lB || (lA === lB && pa.pos < pb.pos)) {
        higherA++;
        if (sameLg) sameLeagueHigherA++;
        winner = 'A';
      } else if (lB < lA || (lA === lB && pb.pos < pa.pos)) {
        higherB++;
        if (sameLg) sameLeagueHigherB++;
        winner = 'B';
      }
      shared.push({ season: pa.seasonNumber, a: pa, b: pb, sameLeague: sameLg, winner: winner });
    });
    shared.sort(function (x, y) { return y.season - x.season; });

    return {
      careerA: trajA.summary,
      careerB: trajB.summary,
      sharedSeasons: shared,
      higherA: higherA,
      higherB: higherB,
      sameLeagueHigherA: sameLeagueHigherA,
      sameLeagueHigherB: sameLeagueHigherB
    };
  }

  function computeAllTimeSeasonRecords() {
    if (_seasonRecordsCache) return _seasonRecordsCache;
    var arch = getArchiveData();
    if (!arch || !Array.isArray(arch.HISTORICAL_SEASONS)) {
      return { bestPointsL1: [], bestGoals: [], bestDefense: [], bestDiff: [], bestWins: [], invincibles: [] };
    }
    var allRows = [];
    arch.HISTORICAL_SEASONS.forEach(function (seas) {
      if (!seas || !seas.leagues) return;
      if (seas.inProgress === true || /w\s+trakcie|przedsezon|p[o\u00F3][l\u0142]metek/i.test(String(seas.yearLabel || ''))) return;
      Object.keys(seas.leagues).forEach(function (lKey) {
        var rows = seas.leagues[lKey];
        if (!Array.isArray(rows)) return;
        rows.forEach(function (r) {
          if (!r || !r.name) return;
          allRows.push({
            seasonNumber: Number(seas.seasonNumber || 0),
            leagueId: lKey,
            pos: Number(r.pos || 0),
            name: String(r.name),
            M: Number(r.M || 0),
            W: Number(r.W || 0),
            R: Number(r.R || 0),
            P: Number(r.P || 0),
            BZ: Number(r.BZ || 0),
            BS: Number(r.BS || 0),
            diff: Number(r.diff != null ? r.diff : (Number(r.BZ || 0) - Number(r.BS || 0))),
            PKT: Number(r.PKT || 0)
          });
        });
      });
    });

    var l1Only = allRows.filter(function (r) { return r.leagueId === 'L1'; });
    var bestPointsL1 = l1Only.slice().sort(function (a, b) { return b.PKT - a.PKT || b.diff - a.diff; }).slice(0, 10);
    var bestGoals = allRows.slice().sort(function (a, b) { return b.BZ - a.BZ || b.PKT - a.PKT; }).slice(0, 10);
    var bestDefense = allRows.filter(function (r) { return r.M >= 20; }).slice().sort(function (a, b) { return a.BS - b.BS || b.PKT - a.PKT; }).slice(0, 10);
    var bestDiff = allRows.slice().sort(function (a, b) { return b.diff - a.diff || b.BZ - a.BZ; }).slice(0, 10);
    var bestWins = allRows.slice().sort(function (a, b) { return b.W - a.W || b.PKT - a.PKT; }).slice(0, 10);
    var invincibles = allRows.filter(function (r) { return r.M >= 14 && r.P === 0; }).sort(function (a, b) { return b.M - a.M || b.PKT - a.PKT; }).slice(0, 10);

    _seasonRecordsCache = {
      bestPointsL1: bestPointsL1,
      bestGoals: bestGoals,
      bestDefense: bestDefense,
      bestDiff: bestDiff,
      bestWins: bestWins,
      invincibles: invincibles
    };
    return _seasonRecordsCache;
  }

  function computeWeeklyTotwCandidates(state, weekNum) {
    var s = state || {};
    var wk = Number(weekNum || (s.weeklyConfig && s.weeklyConfig.currentWeek) || 1);
    var rRange = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.getRoundsRangeForWeek === 'function')
      ? window.SMPL_ENGINE.getRoundsRangeForWeek(s, wk)
      : { start: (wk - 1) * 8 + 1, end: wk * 8 };

    var pMap = {};
    (s.players || []).forEach(function (p) {
      if (p && !p.isPlaceholder && p.active !== false) {
        pMap[String(p.id)] = {
          playerId: String(p.id),
          name: p.name,
          nick: p.nick || p.name,
          leagueId: String(p.leagueId || 'L1'),
          avatar: p.avatar || '',
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          gf: 0,
          ga: 0,
          cs: 0,
          pts: 0,
          formScore: 0
        };
      }
    });

    (s.matches || []).forEach(function (m) {
      if (!m || m.status !== 'APPROVED') return;
      var rnd = Number(m.round || 0);
      if (rnd < rRange.start || rnd > rRange.end) return;
      var h = pMap[String(m.homeId)];
      var a = pMap[String(m.awayId)];
      var hs = Number(m.homeScore || 0);
      var as = Number(m.awayScore || 0);
      if (h) {
        h.played++; h.gf += hs; h.ga += as;
        if (as === 0) h.cs++;
        if (hs > as) { h.wins++; h.pts += 3; }
        else if (hs === as) { h.draws++; h.pts += 1; }
        else h.losses++;
      }
      if (a) {
        a.played++; a.gf += as; a.ga += hs;
        if (hs === 0) a.cs++;
        if (as > hs) { a.wins++; a.pts += 3; }
        else if (as === hs) { a.draws++; a.pts += 1; }
        else a.losses++;
      }
    });

    var list = Object.keys(pMap).map(function (pid) { return pMap[pid]; }).filter(function (st) { return st.played > 0; });
    list.forEach(function (st) {
      st.diff = st.gf - st.ga;
      st.formScore = st.pts * 10 + st.cs * 5 + st.diff * 3 + st.gf;
    });
    list.sort(function (a, b) {
      return b.formScore - a.formScore || b.pts - a.pts || b.diff - a.diff || b.gf - a.gf;
    });

    var byLeague = {};
    list.forEach(function (st) {
      if (!byLeague[st.leagueId]) byLeague[st.leagueId] = st;
    });

    return {
      week: wk,
      roundRange: rRange,
      starters: list.slice(0, 6),
      leagueWinners: byLeague,
      allCandidates: list
    };
  }

  function isPlayerInCurrentTotw(state, playerId) {
    var comp = (state && state.competitions) ? state.competitions : {};
    var hist = Array.isArray(comp.totwHistory) ? comp.totwHistory : [];
    if (!hist.length) return null;
    var latest = hist[0];
    if (!latest) return null;
    var pid = String(playerId || '');
    var starters = Array.isArray(latest.starters) ? latest.starters : [];
    for (var i = 0; i < starters.length; i++) {
      if (starters[i] && String(starters[i].playerId) === pid) return latest;
    }
    if (latest.winners && typeof latest.winners === 'object') {
      var keys = Object.keys(latest.winners);
      for (var k = 0; k < keys.length; k++) {
        var w = latest.winners[keys[k]];
        if (w && String(w.playerId) === pid) return latest;
      }
    }
    return null;
  }

  function buildSmplWrappedData(state, playerId) {
    var s = state || {};
    var pid = String(playerId || '');
    var player = (s.players || []).find(function (p) { return p && String(p.id) === pid; }) || null;
    if (!player) return null;

    var playersById = {};
    (s.players || []).forEach(function (p) { if (p) playersById[String(p.id)] = p; });

    var played = 0;
    var wins = 0;
    var draws = 0;
    var losses = 0;
    var gf = 0;
    var ga = 0;
    var cs = 0;
    var bestWin = null;
    var vsMap = {};
    var maxStreak = 0;
    var curStreak = 0;

    var myMatches = (s.matches || []).filter(function (m) {
      return m && (m.status === 'APPROVED' || m.status === 'WALKOVER') && (String(m.homeId) === pid || String(m.awayId) === pid);
    }).sort(function (a, b) { return Number(a.round || 0) - Number(b.round || 0); });

    myMatches.forEach(function (m) {
      var isH = String(m.homeId) === pid;
      var myG = Number(isH ? m.homeScore : m.awayScore);
      var opG = Number(isH ? m.awayScore : m.homeScore);
      var opId = String(isH ? m.awayId : m.homeId);
      var opName = (playersById[opId] && playersById[opId].name) ? playersById[opId].name : 'Rywal';

      played++;
      gf += myG;
      ga += opG;
      if (opG === 0 && m.status === 'APPROVED') cs++;

      if (!vsMap[opId]) vsMap[opId] = { id: opId, name: opName, ptsFor: 0, ptsAgainst: 0, w: 0, l: 0, gf: 0, ga: 0 };
      vsMap[opId].gf += myG;
      vsMap[opId].ga += opG;

      if (myG > opG) {
        wins++;
        vsMap[opId].w++;
        vsMap[opId].ptsFor += 3;
        curStreak++;
        if (curStreak > maxStreak) maxStreak = curStreak;
        var margin = myG - opG;
        if (!bestWin || margin > bestWin.margin || (margin === bestWin.margin && myG > bestWin.myG)) {
          bestWin = { myG: myG, opG: opG, margin: margin, oppName: opName, round: Number(m.round || 1) };
        }
      } else if (myG === opG) {
        draws++;
        vsMap[opId].ptsFor += 1;
        vsMap[opId].ptsAgainst += 1;
        curStreak = 0;
      } else {
        losses++;
        vsMap[opId].l++;
        vsMap[opId].ptsAgainst += 3;
        curStreak = 0;
      }
    });

    var vsList = Object.keys(vsMap).map(function (k) { return vsMap[k]; });
    var favVictim = vsList.slice().filter(function (v) { return v.w > 0; }).sort(function (a, b) {
      return b.ptsFor - a.ptsFor || (b.gf - b.ga) - (a.gf - a.ga);
    })[0] || null;
    var nemesis = vsList.slice().filter(function (v) { return v.l > 0; }).sort(function (a, b) {
      return b.ptsAgainst - a.ptsAgainst || (b.ga - b.gf) - (a.ga - a.gf);
    })[0] || null;

    var careerEntry = findArchiveCareerEntry(player.name, player.historicalArchiveName);
    var rel = calculateReliabilityBadge(s, pid);
    var coins = calculatePlayerCoinsBreakdown(s, pid);
    var ach = calculatePlayerAchievements(s, pid);

    return {
      season: Number(s.season || 56),
      player: player,
      played: played,
      wins: wins,
      draws: draws,
      losses: losses,
      gf: gf,
      ga: ga,
      cleanSheets: cs,
      winPct: played > 0 ? Math.round((wins / played) * 100) : 0,
      maxWinStreak: maxStreak,
      bestWin: bestWin,
      favoriteVictim: favVictim,
      nemesis: nemesis,
      careerEntry: careerEntry,
      reliability: rel,
      coins: coins,
      achievements: ach,
      posterTheme: getPlayerCosmetics(s, pid).posterThemeMeta
    };
  }

  function buildOfflineNewsletterText(state, weekNum) {
    var s = state || {};
    var wk = Number(weekNum || (s.weeklyConfig && s.weeklyConfig.currentWeek) || 1);
    var totw = computeWeeklyTotwCandidates(s, wk);
    var lines = [];
    lines.push('📰 GAZETA LIGI SMPL — WYDANIE KOLEJKI (TYDZIEN ' + wk + ', SEZON ' + (s.season || 56) + ')');
    lines.push('════════════════════════════════════════════════════');

    var lKeys = Object.keys(s.leagues || {}).filter(function (k) { return s.leagues[k] && s.leagues[k].enabled !== false; });
    lines.push('\n🏆 LIDERZY DYWIZJI:');
    lKeys.forEach(function (lk) {
      var lCfg = s.leagues[lk];
      var tbl = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateStandings === 'function')
        ? (window.SMPL_ENGINE.calculateStandings(s, lk) || [])
        : [];
      if (tbl.length > 0) {
        var top = tbl[0];
        lines.push(' • ' + (lCfg.name || lk) + ': 👑 ' + top.name + ' (' + top.PKT + ' pkt, bilans ' + top.BZ + ':' + top.BS + ', ' + top.M + 'M)');
      }
    });

    if (totw.starters.length > 0) {
      lines.push('\n⚡ SZÓSTKA TYGODNIA (TOTW TYDZIEN ' + wk + '):');
      totw.starters.forEach(function (st, idx) {
        lines.push(' ' + (idx + 1) + '. ' + st.name + ' (' + st.leagueId + ') — ' + st.pts + ' pkt, ' + st.gf + ':' + st.ga + ', ' + st.cs + ' CS');
      });
    }

    if (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateGoldenBootRanking === 'function') {
      var boot = window.SMPL_ENGINE.calculateGoldenBootRanking(s, 'ALL') || [];
      if (boot.length > 0) {
        lines.push('\n👟 ZLOTY BUT: ' + boot[0].name + ' prowadzi z dorobkiem ' + boot[0].BZ + ' goli!');
      }
    }
    if (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateCleanSheetsRanking === 'function') {
      var csList = window.SMPL_ENGINE.calculateCleanSheetsRanking(s, 'ALL') || [];
      if (csList.length > 0) {
        lines.push('🧤 ZELAZNA KURTYNA: ' + csList[0].name + ' ma juz ' + csList[0].cleanSheets + ' czystych kont!');
      }
    }

    var scheduledTop = (s.matches || []).filter(function (m) {
      return m && m.status === 'SCHEDULED' && Number(m.round || 0) >= totw.roundRange.start && Number(m.round || 0) <= totw.roundRange.end;
    }).slice(0, 4);
    if (scheduledTop.length > 0) {
      var pById = {};
      (s.players || []).forEach(function (p) { if (p) pById[String(p.id)] = p.name; });
      lines.push('\n🔥 HITY DO ROZEGRANIA W TYM TYGODNIU:');
      scheduledTop.forEach(function (m) {
        lines.push(' • K' + m.round + ' (' + m.leagueId + '): ' + (pById[String(m.homeId)] || '?') + ' vs ' + (pById[String(m.awayId)] || '?'));
      });
    }
    return lines.join('\n');
  }

  function detectDuplicateScreenshots(matches) {
    var seen = {};
    var duplicates = [];
    (matches || []).forEach(function (m) {
      if (!m || !m.screenshot) return;
      var raw = String(m.screenshot).trim();
      if (raw.length < 40) return;
      var fp = raw.length + ':' + raw.slice(0, 64) + ':' + raw.slice(-48);
      if (seen[fp]) {
        duplicates.push({
          matchA: seen[fp],
          matchB: m,
          fingerprint: fp
        });
      } else {
        seen[fp] = m;
      }
    });
    return duplicates;
  }

  function buildDraftBuckets(players, numLeagues) {
    var count = Math.max(2, Math.min(4, Number(numLeagues || 3)));
    var eligible = (players || []).filter(function (p) {
      return p && !p.isPlaceholder && !p.gdprDeleted && !p.isBlacklisted && !p.banned && p.active !== false;
    }).map(function (p) {
      var car = findArchiveCareerEntry(p.name, p.historicalArchiveName);
      var rating = car ? Number(car.total || car.points || 0) : (Number(p.historicalStats && p.historicalStats.matches || 0) * 2);
      return { player: p, rating: rating, careerRank: car ? Number(car.rank || 999) : 999 };
    });
    eligible.sort(function (a, b) {
      return b.rating - a.rating || String(a.player.name || '').localeCompare(String(b.player.name || ''));
    });

    var buckets = [];
    for (var bi = 0; bi < count; bi++) buckets.push([]);
    var perBucket = Math.ceil(eligible.length / count);
    eligible.forEach(function (item, idx) {
      var bIdx = Math.min(count - 1, Math.floor(idx / Math.max(1, perBucket)));
      buckets[bIdx].push(item);
    });
    return buckets;
  }

  // ---------------------------------------------------------------------------
  // CANVAS PNG STUDIO (Tylko bezpieczne obrazy CORS / data:image, zero tainted)
  // ---------------------------------------------------------------------------
  var FONT_DISPLAY = '"Exo 2", "Space Grotesk", system-ui, -apple-system, sans-serif';
  var FONT_BODY = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

  function loadSafeImage(src) {
    return new Promise(function (resolve) {
      if (!src || typeof Image === 'undefined') return resolve(null);
      var img = new Image();
      if (/^(https?:)?\/\//i.test(src)) img.crossOrigin = 'anonymous';
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 3000);
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (typeof img.naturalWidth === 'number' && img.naturalWidth <= 0) { resolve(null); return; }
        resolve(img);
      };
      img.onerror = function () { if (!done) { done = true; clearTimeout(timer); resolve(null); } };
      img.src = src;
    });
  }

  function waitFontsBrief() {
    if (typeof document === 'undefined' || !document.fonts || !document.fonts.ready) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(); } }, 220);
      try {
        if (typeof document.fonts.load === 'function') {
          try { document.fonts.load('900 48px "Exo 2"').catch(function () {}); } catch (e0) {}
          try { document.fonts.load('700 22px "Plus Jakarta Sans"').catch(function () {}); } catch (e1) {}
        }
        document.fonts.ready.then(function () {
          if (!done) { done = true; clearTimeout(timer); resolve(); }
        }).catch(function () {
          if (!done) { done = true; clearTimeout(timer); resolve(); }
        });
      } catch (e) {
        if (!done) { done = true; clearTimeout(timer); resolve(); }
      }
    });
  }

  function drawRoundedRectPath(ctx, x, y, w, h, r) {
    var rad = Math.max(0, Math.min(Number(r || 0), w / 2, h / 2));
    ctx.beginPath();
    if (rad <= 0) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
    } else if (typeof ctx.quadraticCurveTo === 'function') {
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + w - rad, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
      ctx.lineTo(x + w, y + h - rad);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
      ctx.lineTo(x + rad, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
      ctx.lineTo(x, y + rad);
      ctx.quadraticCurveTo(x, y, x + rad, y);
    } else {
      ctx.moveTo(x + rad, y);
      ctx.lineTo(x + w - rad, y);
      ctx.lineTo(x + w, y + rad);
      ctx.lineTo(x + w, y + h - rad);
      ctx.lineTo(x + w - rad, y + h);
      ctx.lineTo(x + rad, y + h);
      ctx.lineTo(x, y + h - rad);
      ctx.lineTo(x, y + rad);
    }
    ctx.closePath();
  }

  function fillRoundedRect(ctx, x, y, w, h, r, fillStyle) {
    ctx.save();
    drawRoundedRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.restore();
  }

  function strokeRoundedRect(ctx, x, y, w, h, r, strokeStyle, lineWidth) {
    ctx.save();
    drawRoundedRectPath(ctx, x, y, w, h, r);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawImageCover(ctx, img, x, y, w, h) {
    if (!ctx || !img) return false;
    var iw = Number(img.naturalWidth || img.width || 0);
    var ih = Number(img.naturalHeight || img.height || 0);
    if (iw <= 0 || ih <= 0) {
      ctx.drawImage(img, x, y, w, h);
      return true;
    }
    var scale = Math.max(w / iw, h / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = x + (w - dw) / 2;
    var dy = y + (h - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
    return true;
  }

  function fitTextTruncate(ctx, text, maxW) {
    var s = String(text == null ? '' : text);
    if (!s || !maxW || maxW <= 0) return s;
    try {
      if (ctx.measureText(s).width <= maxW) return s;
      while (s.length > 1 && ctx.measureText(s + '…').width > maxW) {
        s = s.slice(0, -1);
      }
      return s + '…';
    } catch (e) {
      return s;
    }
  }

  function fitFontSize(ctx, text, maxPx, minPx, weight, family, maxW) {
    var s = String(text == null ? '' : text);
    var sz = maxPx;
    while (sz > minPx) {
      ctx.font = weight + ' ' + sz + 'px ' + family;
      if (ctx.measureText(s).width <= maxW) break;
      sz -= 2;
    }
    ctx.font = weight + ' ' + Math.max(minPx, sz) + 'px ' + family;
    return fitTextTruncate(ctx, s, maxW);
  }

  function drawFutShieldPath(ctx, x, y, w, h) {
    ctx.beginPath();
    if (typeof ctx.quadraticCurveTo === 'function') {
      ctx.moveTo(x + w * 0.08, y + h * 0.058);
      ctx.lineTo(x + w * 0.34, y + h * 0.032);
      ctx.quadraticCurveTo(x + w * 0.50, y - h * 0.008, x + w * 0.66, y + h * 0.032);
      ctx.lineTo(x + w * 0.92, y + h * 0.058);
      ctx.quadraticCurveTo(x + w, y + h * 0.088, x + w, y + h * 0.145);
      ctx.lineTo(x + w * 0.968, y + h * 0.77);
      ctx.quadraticCurveTo(x + w * 0.94, y + h * 0.89, x + w * 0.50, y + h);
      ctx.quadraticCurveTo(x + w * 0.06, y + h * 0.89, x + w * 0.032, y + h * 0.77);
      ctx.lineTo(x, y + h * 0.145);
      ctx.quadraticCurveTo(x, y + h * 0.088, x + w * 0.08, y + h * 0.058);
    } else {
      ctx.moveTo(x + w * 0.08, y + h * 0.058);
      ctx.lineTo(x + w * 0.50, y);
      ctx.lineTo(x + w * 0.92, y + h * 0.058);
      ctx.lineTo(x + w, y + h * 0.145);
      ctx.lineTo(x + w * 0.968, y + h * 0.77);
      ctx.lineTo(x + w * 0.50, y + h);
      ctx.lineTo(x + w * 0.032, y + h * 0.77);
      ctx.lineTo(x, y + h * 0.145);
    }
    ctx.closePath();
  }

  function drawHexagonPath(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var ang = (Math.PI / 3) * i - Math.PI / 6;
      var px = cx + r * Math.cos(ang);
      var py = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawPillBadge(ctx, x, y, text, opts) {
    var o = opts || {};
    var padX = o.padX != null ? o.padX : 18;
    var h = o.height || 34;
    var font = o.font || ('800 15px ' + FONT_BODY);
    ctx.save();
    ctx.font = font;
    var tw = ctx.measureText(String(text || '')).width;
    var w = Math.min(o.maxW || 620, Math.max(o.minW || 0, tw + padX * 2));
    var rx = o.align === 'center' ? (x - w / 2) : (o.align === 'right' ? (x - w) : x);
    fillRoundedRect(ctx, rx, y, w, h, h / 2, o.bg || 'rgba(250, 204, 21, 0.16)');
    if (o.border) strokeRoundedRect(ctx, rx, y, w, h, h / 2, o.border, o.borderW || 1.5);
    if (o.dotColor) {
      ctx.beginPath();
      ctx.arc(rx + padX - 2, y + h / 2, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = o.dotColor;
      ctx.fill();
    }
    ctx.fillStyle = o.color || '#fde047';
    ctx.textAlign = 'center';
    var txOffset = o.dotColor ? 5 : 0;
    ctx.fillText(fitTextTruncate(ctx, String(text || ''), w - padX * 1.4), rx + w / 2 + txOffset, y + h / 2 + 5);
    ctx.restore();
    return { x: rx, w: w, h: h };
  }

  function drawClippedAvatar(ctx, img, cx, cy, r, fallbackChar, accentCol, innerBg) {
    ctx.save();
    var glow = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r * 1.38);
    glow.addColorStop(0, accentCol || 'rgba(250, 204, 21, 0.35)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.38, 0, Math.PI * 2);
    ctx.fill();

    var sphere = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
    sphere.addColorStop(0, innerBg || '#1e293b');
    sphere.addColorStop(1, '#090f1d');
    ctx.fillStyle = sphere;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var drewImg = false;
    if (img) {
      try {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        ctx.clip();
        drawImageCover(ctx, img, cx - (r - 3), cy - (r - 3), (r - 3) * 2, (r - 3) * 2);
        ctx.restore();
        drewImg = true;
      } catch (e) {
        try { ctx.restore(); } catch (e2) {}
        drewImg = false;
      }
    }

    if (!drewImg) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = accentCol || '#fde047';
      ctx.font = '900 ' + Math.round(r * 0.85) + 'px ' + FONT_DISPLAY;
      ctx.textAlign = 'center';
      ctx.fillText(String(fallbackChar || 'S').slice(0, 1).toUpperCase(), cx, cy + Math.round(r * 0.29));
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = accentCol || '#facc15';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return drewImg;
  }

  function drawStatBar(ctx, x, y, w, h, ratio, colA, colB, trackCol) {
    var clamped = Math.max(0, Math.min(1, Number(ratio || 0)));
    fillRoundedRect(ctx, x, y, w, h, h / 2, trackCol || 'rgba(148, 163, 184, 0.16)');
    if (clamped > 0.02) {
      var fillW = Math.max(h, Math.round(w * clamped));
      var g = ctx.createLinearGradient(x, y, x + fillW, y);
      g.addColorStop(0, colA || '#facc15');
      g.addColorStop(1, colB || colA || '#fde047');
      fillRoundedRect(ctx, x, y, fillW, h, h / 2, g);
    }
  }

  function drawArcGauge(ctx, cx, cy, r, pct, fgCol, trackCol, labelBottom) {
    var clamped = Math.max(0, Math.min(100, Number(pct || 0)));
    ctx.save();
    ctx.lineWidth = 14;
    ctx.strokeStyle = trackCol || 'rgba(148, 163, 184, 0.16)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    if (clamped > 0) {
      var start = -Math.PI / 2;
      var end = start + (Math.PI * 2) * (clamped / 100);
      ctx.strokeStyle = fgCol || '#22c55e';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 36px ' + FONT_DISPLAY;
    ctx.fillText(clamped + '%', cx, cy + 10);

    if (labelBottom) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '800 12px ' + FONT_BODY;
      ctx.fillText(labelBottom, cx, cy + 32);
    }
    ctx.restore();
  }

  function paintStudioBackdrop(ctx, W, H, badgeTxt, headline, subline, opts) {
    var o = opts || {};
    var accent = o.accent || '#facc15';
    var accentRgb = o.accentRgb || '250, 204, 21';
    var accentRightRgb = o.accentRightRgb || '56, 189, 248';

    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, o.bg0 || '#040814');
    grad.addColorStop(0.5, o.bg1 || '#0a1428');
    grad.addColorStop(1, o.bg2 || '#030610');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (o.bgImg) {
      try {
        ctx.save();
        ctx.globalAlpha = o.bgAlpha != null ? o.bgAlpha : 0.22;
        drawImageCover(ctx, o.bgImg, 0, 0, W, H);
        ctx.restore();
        ctx.globalAlpha = 1;
      } catch (eImg) {
        try { ctx.restore(); } catch (eR) {}
        ctx.globalAlpha = 1;
      }
    }

    var darkWash = ctx.createLinearGradient(0, 0, 0, H);
    darkWash.addColorStop(0, 'rgba(4, 8, 20, 0.72)');
    darkWash.addColorStop(0.45, 'rgba(6, 12, 28, 0.52)');
    darkWash.addColorStop(1, 'rgba(3, 6, 16, 0.88)');
    ctx.fillStyle = darkWash;
    ctx.fillRect(0, 0, W, H);

    var radTop = ctx.createRadialGradient(W * 0.25, H * 0.08, 20, W * 0.25, H * 0.08, W * 0.68);
    radTop.addColorStop(0, 'rgba(' + accentRgb + ', 0.22)');
    radTop.addColorStop(1, 'rgba(' + accentRgb + ', 0)');
    ctx.fillStyle = radTop;
    ctx.fillRect(0, 0, W, H);

    var radRight = ctx.createRadialGradient(W * 0.82, H * 0.18, 20, W * 0.82, H * 0.18, W * 0.62);
    radRight.addColorStop(0, 'rgba(' + accentRightRgb + ', 0.16)');
    radRight.addColorStop(1, 'rgba(' + accentRightRgb + ', 0)');
    ctx.fillStyle = radRight;
    ctx.fillRect(0, 0, W, H);

    // Subtle broadcast diagonal geometric light streaks
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.lineWidth = 2;
    for (var sIdx = -2; sIdx < 6; sIdx++) {
      var sx = sIdx * (W * 0.26);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + H * 0.35, H);
      ctx.stroke();
    }
    ctx.restore();

    // Sleek rounded outer broadcast frame
    strokeRoundedRect(ctx, 20, 20, W - 40, H - 40, 26, 'rgba(' + accentRgb + ', 0.34)', 2.5);
    strokeRoundedRect(ctx, 28, 28, W - 56, H - 56, 20, 'rgba(255, 255, 255, 0.06)', 1);

    if (!o.skipHeader) {
      if (badgeTxt) {
        drawPillBadge(ctx, 48, 46, badgeTxt, {
          bg: 'rgba(' + accentRgb + ', 0.14)',
          border: 'rgba(' + accentRgb + ', 0.45)',
          color: accent,
          dotColor: accent,
          height: 36,
          padX: 18,
          font: '800 15px ' + FONT_BODY
        });
      }

      if (headline) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        var fittedHead = fitFontSize(ctx, String(headline), o.headlineSize || 46, 26, '900', FONT_DISPLAY, W - 110);
        ctx.fillText(fittedHead, 48, 134);
        ctx.restore();
      }

      if (subline) {
        ctx.save();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 20px ' + FONT_BODY;
        ctx.textAlign = 'left';
        ctx.fillText(fitTextTruncate(ctx, String(subline), W - 110), 48, 168);
        ctx.restore();
      }
    }

    if (!o.skipFooter) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(48, H - 62);
      ctx.lineTo(W - 48, H - 62);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '700 13px ' + FONT_BODY;
      ctx.textAlign = 'center';
      ctx.fillText(o.footerText || 'SCORE! MATCH LIGA POLSKA • OFICJALNY PORTAL SMPL • ZERO PAY-TO-WIN', W / 2, H - 36);
      ctx.restore();
    }
  }

  function canvasToSafePngDataUrl(canvas) {
    if (!canvas || typeof canvas.toDataURL !== 'function') return '';
    try {
      var out = canvas.toDataURL('image/png');
      return (out && String(out).indexOf('data:image/') === 0) ? out : '';
    } catch (e) {
      return '';
    }
  }

  function buildPosterResult(canvas, filename) {
    var dataUrl = canvasToSafePngDataUrl(canvas);
    if (!dataUrl) {
      return { ok: false, error: 'Nie udało się wyeksportować grafiki PNG (błąd Canvas lub CORS).' };
    }
    return { ok: true, dataUrl: dataUrl, filename: filename || 'smpl-grafika.png' };
  }

  function dataUrlToBlob(dataUrl) {
    if (typeof Blob === 'undefined' || typeof atob !== 'function' || typeof Uint8Array === 'undefined') return null;
    var parts = String(dataUrl || '').split(',');
    if (parts.length < 2) return null;
    var mimeMatch = parts[0].match(/data:([^;]+);base64/i);
    var mime = mimeMatch ? mimeMatch[1] : 'image/png';
    try {
      var binStr = atob(parts[1]);
      var bytes = new Uint8Array(binStr.length);
      for (var i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } catch (e) {
      return null;
    }
  }

  function renderStandingsCanvas(s, lid, lCfg, rows, bgImg, posterTheme) {
    var W = 1080;
    var H = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var th = posterTheme || POSTER_THEMES_MAP['default'];
    var badgeText = 'SEZON ' + (s.season || 56) + ' • OFICJALNA TABELA' + (th.label ? (' • 🎨 ' + th.label) : '');
    paintStudioBackdrop(
      ctx, W, H,
      badgeText,
      String(lCfg.name || lid).toUpperCase(),
      'Klasyfikacja po zatwierdzonych kolejkach • Liczba graczy: ' + rows.length,
      { bgImg: bgImg, bgAlpha: 0.22, bg0: th.bg0, bg1: th.bg1, bg2: th.bg2, accent: th.accent, accentRgb: th.accentRgb, accentRightRgb: th.accentRightRgb, skipFooter: true }
    );

    // Table header capsule
    fillRoundedRect(ctx, 48, 192, W - 96, 44, 12, 'rgba(15, 23, 42, 0.92)');
    strokeRoundedRect(ctx, 48, 192, W - 96, 44, 12, 'rgba(' + th.accentRgb + ', 0.30)', 1.5);
    ctx.save();
    ctx.fillStyle = th.headerFill || '#fde047';
    ctx.font = '800 14px ' + FONT_BODY;
    ctx.textAlign = 'center';
    ctx.fillText('#', 88, 219);
    ctx.textAlign = 'left';
    ctx.fillText('ZAWODNIK / KLAN', 130, 219);
    ctx.textAlign = 'center';
    ctx.fillText('M', 560, 219);
    ctx.fillText('W-R-P', 636, 219);
    ctx.fillText('BRAMKI', 746, 219);
    ctx.fillText('FORMA', 874, 219);
    ctx.fillText('PKT', 984, 219);
    ctx.restore();

    var promo = Number(lCfg.promoSpots || (lid === 'L1' ? 3 : 2));
    var rel = Number(lCfg.relSpots || 2);
    var totalRows = rows.length;
    var visRows = rows.slice(0, 16);
    var rowStep = visRows.length <= 12 ? 78 : 62;
    var rowH = visRows.length <= 12 ? 66 : 54;
    var startY = 248;

    visRows.forEach(function (r, idx) {
      var y = startY + idx * rowStep;
      var cy = y + rowH / 2;
      var isTop3 = idx < 3;
      var bgGrad = ctx.createLinearGradient(48, y, W - 48, y);
      if (idx === 0) {
        bgGrad.addColorStop(0, 'rgba(250, 204, 21, 0.18)');
        bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
      } else if (idx % 2 === 0) {
        bgGrad.addColorStop(0, 'rgba(30, 41, 59, 0.82)');
        bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.82)');
      } else {
        bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.78)');
        bgGrad.addColorStop(1, 'rgba(11, 18, 34, 0.78)');
      }
      fillRoundedRect(ctx, 48, y, W - 96, rowH, 14, bgGrad);
      strokeRoundedRect(ctx, 48, y, W - 96, rowH, 14, isTop3 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(148, 163, 184, 0.12)', 1);

      var barCol = 'rgba(148, 163, 184, 0.25)';
      if (idx === 0) barCol = '#facc15';
      else if (idx < promo) barCol = '#22c55e';
      else if (totalRows > 6 && idx >= totalRows - rel) barCol = '#ef4444';
      fillRoundedRect(ctx, 50, y + 8, 6, rowH - 16, 3, barCol);

      // Rank badge
      ctx.save();
      if (idx === 0 || idx === 1 || idx === 2) {
        var medalCols = ['#facc15', '#cbd5e1', '#d97706'];
        ctx.beginPath();
        ctx.arc(88, cy, 17, 0, Math.PI * 2);
        ctx.fillStyle = medalCols[idx];
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.font = '900 18px ' + FONT_DISPLAY;
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), 88, cy + 6);
      } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '800 19px ' + FONT_DISPLAY;
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), 88, cy + 7);
      }

      // Player + Clan Tag
      var clanTag = (r.player && r.player.clanTag) ? ('[' + r.player.clanTag + '] ') : '';
      var xName = 130;
      if (clanTag) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '800 17px ' + FONT_BODY;
        ctx.textAlign = 'left';
        ctx.fillText(clanTag, xName, cy + 6);
        xName += ctx.measureText(clanTag).width + 4;
      }
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 20px ' + FONT_BODY;
      ctx.textAlign = 'left';
      ctx.fillText(fitTextTruncate(ctx, String(r.name || ''), Math.max(120, 520 - xName)), xName, cy + 6);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 18px ' + FONT_BODY;
      ctx.fillText(String(r.M || 0), 560, cy + 6);
      ctx.fillText((r.W || 0) + '-' + (r.R || 0) + '-' + (r.P || 0), 636, cy + 6);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText((r.BZ || 0) + ':' + (r.BS || 0), 746, cy + 6);

      // Form indicator dots (obsługa obiektów { result: 'Z'|'R'|'P' } oraz liter 'W'|'D'|'L')
      var formArr = Array.isArray(r.form) ? r.form.slice(-5) : [];
      if (formArr.length) {
        var dotStep = 16;
        var dotStart = 874 - ((formArr.length - 1) * dotStep) / 2;
        formArr.forEach(function (resItem, dIdx) {
          var resChar = (resItem && typeof resItem === 'object')
            ? String(resItem.result || resItem.code || resItem.outcome || '').toUpperCase()
            : String(resItem || '').toUpperCase();
          var dc = '#64748b';
          if (resChar === 'W' || resChar === 'Z') dc = '#22c55e';
          else if (resChar === 'D' || resChar === 'R') dc = '#f59e0b';
          else if (resChar === 'L' || resChar === 'P') dc = '#ef4444';
          ctx.beginPath();
          ctx.arc(dotStart + dIdx * dotStep, cy, 5.8, 0, Math.PI * 2);
          ctx.fillStyle = dc;
          ctx.fill();
        });
      } else {
        ctx.fillStyle = '#475569';
        ctx.font = '700 15px ' + FONT_BODY;
        ctx.fillText('—', 874, cy + 5);
      }

      // Points capsule
      fillRoundedRect(ctx, 948, cy - 19, 72, 38, 11, idx < 3 ? 'rgba(250, 204, 21, 0.2)' : 'rgba(56, 189, 248, 0.14)');
      strokeRoundedRect(ctx, 948, cy - 19, 72, 38, 11, idx < 3 ? 'rgba(250, 204, 21, 0.45)' : 'rgba(56, 189, 248, 0.3)', 1);
      ctx.fillStyle = idx < 3 ? '#fde047' : '#f8fafc';
      ctx.font = '900 22px ' + FONT_DISPLAY;
      ctx.fillText(String(r.PKT || 0), 984, cy + 8);
      ctx.restore();
    });

    // When league has <= 9 visible teams, show 3 mini Division Highlights cards to balance the canvas
    var tableBottomY = startY + visRows.length * rowStep;
    if (visRows.length > 0 && visRows.length <= 9 && tableBottomY + 195 < H - 115) {
      var topScorer = rows.slice().sort(function (a, b) { return Number(b.BZ || 0) - Number(a.BZ || 0) || Number(b.PKT || 0) - Number(a.PKT || 0); })[0];
      var activeDef = rows.filter(function (x) { return Number(x.M || 0) > 0; }).sort(function (a, b) {
        var rA = Number(a.BS || 0) / Math.max(1, Number(a.M || 1));
        var rB = Number(b.BS || 0) / Math.max(1, Number(b.M || 1));
        return rA - rB || Number(b.M || 0) - Number(a.M || 0);
      })[0] || rows[0];
      var leader = rows[0];
      var hiY = Math.max(tableBottomY + 28, H - 306);
      var hiW = 312;
      var hiCards = [
        { tag: '👑 LIDER TABELI', col: '#facc15', name: leader.name, stat: (leader.PKT || 0) + ' PKT  •  ' + (leader.W || 0) + 'Z-' + (leader.R || 0) + 'R-' + (leader.P || 0) + 'P' },
        { tag: '⚽ KRÓL STRZELCÓW', col: '#22c55e', name: topScorer ? topScorer.name : '-', stat: (topScorer ? (topScorer.BZ || 0) : 0) + ' zdobytych bramek' },
        { tag: '🛡️ ŻELAZNA OBRONA', col: '#38bdf8', name: activeDef ? activeDef.name : '-', stat: (activeDef ? (activeDef.BS || 0) : 0) + ' straconych (' + (activeDef ? (activeDef.cleanSheets || 0) : 0) + ' CS)' }
      ];
      hiCards.forEach(function (hc, hi) {
        var hx = 48 + hi * (hiW + 24);
        fillRoundedRect(ctx, hx, hiY, hiW, 146, 18, 'rgba(15, 23, 42, 0.88)');
        strokeRoundedRect(ctx, hx, hiY, hiW, 146, 18, 'rgba(148, 163, 184, 0.2)', 1.2);
        fillRoundedRect(ctx, hx + 18, hiY, hiW - 36, 4, 2, hc.col);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = hc.col;
        ctx.font = '800 13px ' + FONT_BODY;
        ctx.fillText(hc.tag, hx + 20, hiY + 34);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 24px ' + FONT_DISPLAY;
        ctx.fillText(fitTextTruncate(ctx, String(hc.name || ''), hiW - 40), hx + 20, hiY + 80);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 15px ' + FONT_BODY;
        ctx.fillText(fitTextTruncate(ctx, hc.stat, hiW - 40), hx + 20, hiY + 114);
        ctx.restore();
      });
    }

    // Zone legend & broadcast footer
    fillRoundedRect(ctx, 48, H - 102, W - 96, 46, 14, 'rgba(15, 23, 42, 0.85)');
    strokeRoundedRect(ctx, 48, H - 102, W - 96, 46, 14, 'rgba(148, 163, 184, 0.18)', 1);
    var legendItems = [
      { x: 76, col: '#facc15', txt: 'Lider / Mistrz' },
      { x: 256, col: '#22c55e', txt: 'Strefa Awansu' },
      { x: 446, col: '#ef4444', txt: 'Strefa Spadku' },
      { x: 646, col: '#22c55e', txt: 'Forma: Z / R / P' }
    ];
    ctx.save();
    legendItems.forEach(function (it) {
      ctx.beginPath();
      ctx.arc(it.x, H - 79, 6, 0, Math.PI * 2);
      ctx.fillStyle = it.col;
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 14px ' + FONT_BODY;
      ctx.textAlign = 'left';
      ctx.fillText(it.txt, it.x + 14, H - 74);
    });
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
    ctx.font = '700 13px ' + FONT_BODY;
    ctx.textAlign = 'center';
    ctx.fillText('SCORE! MATCH LIGA POLSKA • OFICJALNA TABELA SEZONU ' + (s.season || 56), W / 2, H - 30);
    ctx.restore();

    return canvas;
  }

  function generateStandingsPosterPng(state, leagueId, viewerPlayerId) {
    if (typeof document === 'undefined') return Promise.resolve({ ok: false, error: 'Canvas niedostepny offline.' });
    var s = state || {};
    var lid = leagueId || 'L1';
    var lCfg = (s.leagues && s.leagues[lid]) ? s.leagues[lid] : { name: lid, promoSpots: 2, relSpots: 2 };
    var rows = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateStandings === 'function')
      ? (window.SMPL_ENGINE.calculateStandings(s, lid) || [])
      : [];
    var outName = 'SMPL-Tabela-' + lid + '-S' + (s.season || 56) + '.png';
    var posterTheme = viewerPlayerId ? getPlayerCosmetics(s, viewerPlayerId).posterThemeMeta : POSTER_THEMES_MAP['default'];

    return waitFontsBrief().then(function () {
      return loadSafeImage('./img/hero-league-stage-banner.jpg').then(function (bgImg) {
        var res = buildPosterResult(renderStandingsCanvas(s, lid, lCfg, rows, bgImg, posterTheme), outName);
        if (!res.ok && bgImg) {
          res = buildPosterResult(renderStandingsCanvas(s, lid, lCfg, rows, null, posterTheme), outName);
        }
        return res;
      });
    });
  }

  function safeDrawAvatarCircle(ctx, img, cx, cy, r) {
    if (!ctx || !img) return false;
    try {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      drawImageCover(ctx, img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      return true;
    } catch (e) {
      try { ctx.restore(); } catch (e2) {}
      return false;
    }
  }

  function renderMatchdayCanvas(s, m, hp, ap, lCfg, imgs, bgImg, posterTheme) {
    var W = 1200;
    var H = 675;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var th = posterTheme || POSTER_THEMES_MAP['default'];
    paintStudioBackdrop(
      ctx, W, H,
      '', '', '',
      {
        bgImg: bgImg,
        bgAlpha: 0.25,
        bg0: th.bg0,
        bg1: th.bg1,
        bg2: th.bg2,
        accent: th.accent,
        accentRgb: th.accentRgb,
        accentRightRgb: th.accentRightRgb,
        skipHeader: true,
        footerText: 'SCORE! MATCH LIGA POLSKA • OFICJALNA ZAPOWIEDŹ MECZOWA • ZERO PAY-TO-WIN'
      }
    );

    // Split arena glow: Primary Theme / Warm Gold (Left) vs Secondary Theme / Electric Cyan (Right)
    var gLeft = ctx.createRadialGradient(265, 340, 20, 265, 340, 320);
    gLeft.addColorStop(0, 'rgba(' + th.accentRgb + ', 0.22)');
    gLeft.addColorStop(1, 'rgba(' + th.accentRgb + ', 0)');
    ctx.fillStyle = gLeft;
    ctx.fillRect(0, 0, W / 2, H);

    var gRight = ctx.createRadialGradient(935, 340, 20, 935, 340, 320);
    gRight.addColorStop(0, 'rgba(' + th.accentRightRgb + ', 0.22)');
    gRight.addColorStop(1, 'rgba(' + th.accentRightRgb + ', 0)');
    ctx.fillStyle = gRight;
    ctx.fillRect(W / 2, 0, W / 2, H);

    // Center Broadcast Header
    drawPillBadge(ctx, W / 2, 42, '⚡ HIT KOLEJKI • ' + String(lCfg.name || m.leagueId || 'L1').toUpperCase() + ' • SEZON ' + (s.season || 56) + (th.label ? (' • 🎨 ' + th.label) : ''), {
      align: 'center',
      bg: 'rgba(' + th.accentRgb + ', 0.16)',
      border: 'rgba(' + th.accentRgb + ', 0.48)',
      color: th.headerFill || '#fde047',
      height: 34,
      padX: 22
    });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px ' + FONT_DISPLAY;
    ctx.fillText('KOLEJKA ' + (m.round || 1) + ' • STARCIE TYGODNIA', W / 2, 122);
    ctx.restore();

    function drawSideCard(player, img, xCard, isHome) {
      var wCard = 434;
      var yCard = 152;
      var hCard = 434;
      var cx = xCard + wCard / 2;
      var accent = isHome ? '#facc15' : '#38bdf8';
      var accentSoft = isHome ? 'rgba(250, 204, 21, 0.16)' : 'rgba(56, 189, 248, 0.16)';
      var borderCol = isHome ? 'rgba(250, 204, 21, 0.40)' : 'rgba(56, 189, 248, 0.40)';

      var cardGrad = ctx.createLinearGradient(xCard, yCard, xCard, yCard + hCard);
      cardGrad.addColorStop(0, 'rgba(15, 23, 42, 0.90)');
      cardGrad.addColorStop(1, 'rgba(7, 11, 24, 0.94)');
      fillRoundedRect(ctx, xCard, yCard, wCard, hCard, 24, cardGrad);
      strokeRoundedRect(ctx, xCard, yCard, wCard, hCard, 24, borderCol, 2);

      // Top team role pill
      drawPillBadge(ctx, cx, yCard + 18, isHome ? '🏠 GOSPODARZ' : '✈️ GOŚĆ', {
        align: 'center',
        bg: accentSoft,
        border: borderCol,
        color: accent,
        height: 30,
        padX: 16,
        font: '800 13px ' + FONT_BODY
      });

      drawClippedAvatar(ctx, img, cx, yCard + 162, 92, String(player.name || 'S'), accent, '#111c36');

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      var nm = fitFontSize(ctx, String(player.name || '').toUpperCase(), 32, 20, '900', FONT_DISPLAY, wCard - 48);
      ctx.fillText(nm, cx, yCard + 298);

      var sub = (player.clanTag ? ('[' + player.clanTag + ']  •  ') : '') + '@' + String(player.nick || player.name || '');
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 17px ' + FONT_BODY;
      ctx.fillText(fitTextTruncate(ctx, sub, wCard - 52), cx, yCard + 334);

      var divTxt = String((player.leagueId || m.leagueId || 'L1')).toUpperCase();
      drawPillBadge(ctx, cx, yCard + 362, 'DYWIZJA ' + divTxt, {
        align: 'center',
        bg: 'rgba(255, 255, 255, 0.06)',
        border: 'rgba(148, 163, 184, 0.22)',
        color: '#e2e8f0',
        height: 32,
        padX: 18,
        font: '800 13px ' + FONT_BODY
      });
      ctx.restore();
    }

    drawSideCard(hp, imgs && imgs[0], 46, true);
    drawSideCard(ap, imgs && imgs[1], 720, false);

    // Centerpiece energy beam + Hexagon medallion
    ctx.save();
    var beamGrad = ctx.createLinearGradient(600, 154, 600, 584);
    beamGrad.addColorStop(0, 'rgba(250, 204, 21, 0)');
    beamGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.55)');
    beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.strokeStyle = beamGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(600, 154);
    ctx.lineTo(600, 584);
    ctx.stroke();

    var hexCy = 368;
    var hexR = 92;
    drawHexagonPath(ctx, 600, hexCy, hexR);
    var hexGrad = ctx.createLinearGradient(508, hexCy - hexR, 692, hexCy + hexR);
    hexGrad.addColorStop(0, '#1e293b');
    hexGrad.addColorStop(0.5, '#0b1326');
    hexGrad.addColorStop(1, '#1a1205');
    ctx.fillStyle = hexGrad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    drawHexagonPath(ctx, 600, hexCy, hexR - 9);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.stroke();

    var isDone = (m.status === 'APPROVED' || m.status === 'WALKOVER');
    var centerTxt = isDone ? ((m.homeScore || 0) + ' : ' + (m.awayScore || 0)) : 'VS';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.font = '900 ' + (isDone ? 62 : 76) + 'px ' + FONT_DISPLAY;
    ctx.fillText(centerTxt, 600, hexCy + (isDone ? 18 : 26));

    if (m.status === 'WALKOVER') {
      drawPillBadge(ctx, 600, hexCy + 104, 'WALKOWER ' + (m.homeScore || 0) + ':' + (m.awayScore || 0) + ' WO', {
        align: 'center',
        bg: 'rgba(239, 68, 68, 0.2)',
        border: 'rgba(239, 68, 68, 0.55)',
        color: '#fca5a5',
        height: 30,
        padX: 16,
        font: '800 13px ' + FONT_BODY
      });
    } else if (m.status === 'APPROVED') {
      drawPillBadge(ctx, 600, hexCy + 104, 'WYNIK OFICJALNY', {
        align: 'center',
        bg: 'rgba(16, 185, 129, 0.18)',
        border: 'rgba(16, 185, 129, 0.5)',
        color: '#6ee7b7',
        height: 30,
        padX: 16,
        font: '800 13px ' + FONT_BODY
      });
    } else {
      drawPillBadge(ctx, 600, hexCy + 104, 'GRA DO 2 BRAMEK', {
        align: 'center',
        bg: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(250, 204, 21, 0.35)',
        color: '#e2e8f0',
        height: 30,
        padX: 16,
        font: '800 12px ' + FONT_BODY
      });
    }
    ctx.restore();
    return canvas;
  }

  function generateMatchdayPosterPng(state, matchId, viewerPlayerId) {
    if (typeof document === 'undefined') return Promise.resolve({ ok: false, error: 'Canvas niedostepny.' });
    var s = state || {};
    var m = (s.matches || []).find(function (x) { return x && String(x.id) === String(matchId); });
    if (!m) return Promise.resolve({ ok: false, error: 'Nie znaleziono meczu.' });
    var hp = (s.players || []).find(function (p) { return p && String(p.id) === String(m.homeId); }) || { name: 'Gospodarz' };
    var ap = (s.players || []).find(function (p) { return p && String(p.id) === String(m.awayId); }) || { name: 'Gość' };
    var lCfg = (s.leagues && s.leagues[m.leagueId]) ? s.leagues[m.leagueId] : { name: m.leagueId || 'L1' };
    var outName = 'SMPL-Hit-K' + (m.round || 1) + '-' + foldName(hp.name).replace(/\s+/g, '-') + '-vs-' + foldName(ap.name).replace(/\s+/g, '-') + '.png';
    var posterTheme = viewerPlayerId ? getPlayerCosmetics(s, viewerPlayerId).posterThemeMeta : POSTER_THEMES_MAP['default'];

    return waitFontsBrief().then(function () {
      return loadSafeImage('./img/match-arena-banner.jpg').then(function (bgImg) {
        return loadSafeImage(hp.avatar).then(function (hImg) {
          return loadSafeImage(ap.avatar).then(function (aImg) {
            var imgs = [hImg, aImg];
            var res = buildPosterResult(renderMatchdayCanvas(s, m, hp, ap, lCfg, imgs, bgImg, posterTheme), outName);
            if (!res.ok && (hImg || aImg)) {
              res = buildPosterResult(renderMatchdayCanvas(s, m, hp, ap, lCfg, [], bgImg, posterTheme), outName);
            }
            if (!res.ok && bgImg) {
              res = buildPosterResult(renderMatchdayCanvas(s, m, hp, ap, lCfg, [], null, posterTheme), outName);
            }
            return res;
          });
        });
      });
    });
  }

  function getUtBgRgb(bgStyle) {
    var map = {
      'emerald_pitch': '16, 185, 129',
      'stadium_aura': '37, 99, 235',
      'sunset_derby': '249, 115, 22',
      'cyber_grid': '20, 184, 166',
      'aurora_borealis': '45, 212, 191',
      'royal_gold': '234, 179, 8',
      'volcano_magma': '239, 68, 68',
      'holo_carbon': '148, 163, 184',
      'galaxies_end': '192, 132, 252',
      'drop_s56_starfall': '167, 139, 250'
    };
    return map[String(bgStyle || 'default')] || '56, 189, 248';
  }

  function getUtVisualTheme(ut, cos) {
    var frame = cos ? String(cos.frame || 'default') : 'default';
    var tier = (ut && ut.cardTier) ? String(ut.cardTier).toUpperCase() : 'GOLD';

    if (frame === 'drop_s56_frostking') {
      return {
        shield0: '#041d2e', shield1: '#0b4469', shield2: '#020c14',
        accent: '#38bdf8', accent2: '#a78bfa', accentRgb: '56, 189, 248',
        barA: '#38bdf8', barB: '#a78bfa', pillBg: 'rgba(56, 189, 248, 0.24)', tag: 'DROP S56 • KRÓL MROZU'
      };
    }
    if (frame === 'champion_eclipse') {
      return {
        shield0: '#240b36', shield1: '#3d135c', shield2: '#0d0414',
        accent: '#fbbf24', accent2: '#c084fc', accentRgb: '251, 191, 36',
        barA: '#fbbf24', barB: '#c084fc', pillBg: 'rgba(251, 191, 36, 0.22)', tag: 'ZAĆMIENIE VIP'
      };
    }
    if (frame === 'obsidian_noir') {
      return {
        shield0: '#0f172a', shield1: '#1e293b', shield2: '#020617',
        accent: '#e2e8f0', accent2: '#94a3b8', accentRgb: '226, 232, 240',
        barA: '#e2e8f0', barB: '#cbd5e1', pillBg: 'rgba(226, 232, 240, 0.18)', tag: 'OBSYDIAN PRESTIŻ'
      };
    }
    if (frame === 'crimson_inferno') {
      return {
        shield0: '#2d0612', shield1: '#4c0519', shield2: '#130308',
        accent: '#fb7185', accent2: '#facc15', accentRgb: '244, 63, 94',
        barA: '#fb7185', barB: '#f59e0b', pillBg: 'rgba(244, 63, 94, 0.22)', tag: 'INFERNO LEGEND'
      };
    }
    if (frame === 'jade_dragon') {
      return {
        shield0: '#042419', shield1: '#0a4a33', shield2: '#02120c',
        accent: '#34d399', accent2: '#facc15', accentRgb: '52, 211, 153',
        barA: '#34d399', barB: '#facc15', pillBg: 'rgba(52, 211, 153, 0.22)', tag: 'NEFRYTOWY SMOK'
      };
    }
    if (frame === 'cyber_magenta') {
      return {
        shield0: '#2d0626', shield1: '#560b44', shield2: '#140311',
        accent: '#f472b6', accent2: '#38bdf8', accentRgb: '236, 72, 153',
        barA: '#ec4899', barB: '#38bdf8', pillBg: 'rgba(236, 72, 153, 0.22)', tag: 'CYBER PUNK 2099'
      };
    }
    if (frame === 'violet_galaxy') {
      return {
        shield0: '#1d0a36', shield1: '#3b1566', shield2: '#0c0418',
        accent: '#c084fc', accent2: '#e879f9', accentRgb: '168, 85, 247',
        barA: '#a855f7', barB: '#e879f9', pillBg: 'rgba(168, 85, 247, 0.22)', tag: 'KOSMICZNA MGŁAWICA'
      };
    }
    if (frame === 'ice_glacial') {
      return {
        shield0: '#071b2d', shield1: '#0c3559', shield2: '#030d18',
        accent: '#7dd3fc', accent2: '#e0f2fe', accentRgb: '125, 211, 252',
        barA: '#7dd3fc', barB: '#38bdf8', pillBg: 'rgba(125, 211, 252, 0.22)', tag: 'ARKTYCZNY LÓD'
      };
    }
    if (frame === 'holo_diamond' || (frame === 'default' && tier === 'TOTY')) {
      return {
        shield0: '#071a38', shield1: '#0e366b', shield2: '#050d1e',
        accent: '#38bdf8', accent2: '#e0f2fe', accentRgb: '56, 189, 248',
        barA: '#38bdf8', barB: '#a5f3fc', pillBg: 'rgba(56, 189, 248, 0.20)', tag: frame === 'holo_diamond' ? 'HOLO DIAMENT' : 'TOTY ELITA'
      };
    }
    if (frame === 'neon_emerald') {
      return {
        shield0: '#031e18', shield1: '#065f46', shield2: '#02120e',
        accent: '#34d399', accent2: '#a7f3d0', accentRgb: '16, 185, 129',
        barA: '#34d399', barB: '#6ee7b7', pillBg: 'rgba(16, 185, 129, 0.20)', tag: 'EMERALD NEON'
      };
    }
    if (frame === 'default' && tier === 'HERO') {
      return {
        shield0: '#210a36', shield1: '#3b1263', shield2: '#10041c',
        accent: '#c084fc', accent2: '#fde047', accentRgb: '192, 132, 252',
        barA: '#c084fc', barB: '#facc15', pillBg: 'rgba(192, 132, 252, 0.20)', tag: 'SMPL HERO'
      };
    }
    if (frame === 'default' && tier === 'SILVER') {
      return {
        shield0: '#162032', shield1: '#2d3f59', shield2: '#0a101b',
        accent: '#e2e8f0', accent2: '#94a3b8', accentRgb: '203, 213, 225',
        barA: '#cbd5e1', barB: '#f8fafc', pillBg: 'rgba(203, 213, 225, 0.18)', tag: 'SILVER PRO'
      };
    }
    if (frame === 'default' && tier === 'BRONZE') {
      return {
        shield0: '#24140c', shield1: '#452414', shield2: '#110804',
        accent: '#fdba74', accent2: '#d97706', accentRgb: '217, 119, 6',
        barA: '#fb923c', barB: '#fcd34d', pillBg: 'rgba(217, 119, 6, 0.20)', tag: 'DEBIUTANT'
      };
    }
    return {
      shield0: '#1c1608', shield1: '#3b2d0d', shield2: '#0b0803',
      accent: '#fde047', accent2: '#f59e0b', accentRgb: '250, 204, 21',
      barA: '#facc15', barB: '#fef08a', pillBg: 'rgba(250, 204, 21, 0.20)', tag: frame === 'gold_crown' ? 'ZŁOTA KORONA' : 'ZŁOTA KARTA'
    };
  }

  function renderUtCardCanvas(s, player, ut, cos, img, bgImg) {
    var W = 720;
    var H = 1020;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var th = getUtVisualTheme(ut, cos);
    paintStudioBackdrop(
      ctx, W, H,
      '', '', '',
      {
        bgImg: bgImg,
        bgAlpha: 0.24,
        accent: th.accent,
        accentRgb: th.accentRgb,
        accentRightRgb: getUtBgRgb(cos ? cos.bgStyle : 'default'),
        skipHeader: true,
        footerText: 'SCORE! MATCH LIGA POLSKA • OFICJALNA KARTA ULTIMATE TEAM'
      }
    );

    // Aura spotlight behind shield
    var sGlow = ctx.createRadialGradient(360, 340, 30, 360, 420, 410);
    sGlow.addColorStop(0, 'rgba(' + th.accentRgb + ', 0.34)');
    sGlow.addColorStop(1, 'rgba(' + th.accentRgb + ', 0)');
    ctx.fillStyle = sGlow;
    ctx.fillRect(0, 0, W, H);

    // Top season pill above shield
    drawPillBadge(ctx, W / 2, 24, 'KARTA ULTIMATE TEAM • SEZON ' + (s.season || 56), {
      align: 'center',
      bg: th.pillBg,
      border: 'rgba(' + th.accentRgb + ', 0.48)',
      color: th.accent,
      height: 30,
      padX: 18,
      font: '800 13px ' + FONT_BODY
    });

    // Sculpted FUT Shield silhouette
    var sx = 48;
    var sy = 64;
    var sw = 624;
    var sh = 886;
    ctx.save();
    drawFutShieldPath(ctx, sx, sy, sw, sh);
    var shGrad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    shGrad.addColorStop(0, th.shield0);
    shGrad.addColorStop(0.42, th.shield1);
    shGrad.addColorStop(1, th.shield2);
    ctx.fillStyle = shGrad;
    ctx.fill();

    // Foil light streaks clipped strictly inside shield
    ctx.save();
    ctx.clip();
    var spotTop = ctx.createRadialGradient(440, 260, 20, 440, 260, 300);
    spotTop.addColorStop(0, 'rgba(' + th.accentRgb + ', 0.28)');
    spotTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotTop;
    ctx.fillRect(sx, sy, sw, sh);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    for (var f = 0; f < 4; f++) {
      var fx = sx - 120 + f * 210;
      ctx.beginPath();
      ctx.moveTo(fx, sy);
      ctx.lineTo(fx + 75, sy);
      ctx.lineTo(fx - 210, sy + sh);
      ctx.lineTo(fx - 285, sy + sh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Metallic bevel outer + inner stroke
    drawFutShieldPath(ctx, sx, sy, sw, sh);
    var rimGrad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    rimGrad.addColorStop(0, th.accent2);
    rimGrad.addColorStop(0.5, th.accent);
    rimGrad.addColorStop(1, th.accent2);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 6;
    ctx.stroke();

    drawFutShieldPath(ctx, sx + 12, sy + 12, sw - 24, sh - 24);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Top-left OVR / Division / Clan / Tier stack
    ctx.save();
    var leftCx = 186;
    ctx.textAlign = 'center';
    ctx.fillStyle = th.accent;
    ctx.font = '900 102px ' + FONT_DISPLAY;
    ctx.fillText(String((ut && ut.ovr) || 78), leftCx, 224);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.font = '800 15px ' + FONT_BODY;
    ctx.fillText('OVR', leftCx, 248);

    ctx.strokeStyle = 'rgba(' + th.accentRgb + ', 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(118, 266);
    ctx.lineTo(254, 266);
    ctx.stroke();

    drawPillBadge(ctx, leftCx, 282, String(player.leagueId || 'L1').toUpperCase(), {
      align: 'center',
      bg: th.pillBg,
      border: 'rgba(' + th.accentRgb + ', 0.5)',
      color: '#ffffff',
      height: 32,
      padX: 18,
      font: '900 16px ' + FONT_DISPLAY
    });

    if (player.clanTag) {
      drawPillBadge(ctx, leftCx, 324, '[' + String(player.clanTag).toUpperCase() + ']', {
        align: 'center',
        bg: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(255, 255, 255, 0.22)',
        color: th.accent,
        height: 28,
        padX: 14,
        font: '800 13px ' + FONT_BODY
      });
    } else {
      drawPillBadge(ctx, leftCx, 324, th.tag, {
        align: 'center',
        bg: 'rgba(255, 255, 255, 0.08)',
        border: 'rgba(255, 255, 255, 0.18)',
        color: '#e2e8f0',
        height: 28,
        padX: 14,
        maxW: 156,
        font: '800 12px ' + FONT_BODY
      });
    }
    if (cos && cos.badgeLabel) {
      drawPillBadge(ctx, leftCx, 362, cos.badgeLabel, {
        align: 'center',
        bg: 'rgba(9, 14, 28, 0.92)',
        border: cos.badgeColor || th.accent,
        color: cos.badgeColor || '#ffffff',
        height: 26,
        padX: 12,
        maxW: 164,
        font: '900 12px ' + FONT_BODY
      });
    }
    ctx.restore();

    // Top-right Hero Portrait
    drawClippedAvatar(ctx, img, 456, 262, 122, String(player.name || 'S'), th.accent, th.shield1);
    drawPillBadge(ctx, 540, 356, 'S' + (s.season || 56), {
      align: 'center',
      bg: '#090e1c',
      border: th.accent,
      color: th.accent,
      height: 28,
      padX: 12,
      font: '900 13px ' + FONT_DISPLAY
    });

    // Metallic Nameplate Ribbon
    var plateGrad = ctx.createLinearGradient(82, 422, 638, 422);
    plateGrad.addColorStop(0, 'rgba(9, 13, 24, 0.35)');
    plateGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.92)');
    plateGrad.addColorStop(1, 'rgba(9, 13, 24, 0.35)');
    fillRoundedRect(ctx, 82, 422, 556, 72, 14, plateGrad);

    ctx.save();
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(106, 422);
    ctx.lineTo(614, 422);
    ctx.moveTo(106, 494);
    ctx.lineTo(614, 494);
    ctx.stroke();

    ctx.textAlign = 'center';
    var nFx = cos ? String(cos.nickEffect || 'default') : 'default';
    var nColors = {
      'gold_shimmer': { fill: '#fef08a', glow: '#facc15' },
      'emerald_glow': { fill: '#a7f3d0', glow: '#10b981' },
      'cyber_pulse': { fill: '#bae6fd', glow: '#38bdf8' },
      'fire_blaze': { fill: '#fecdd3', glow: '#f43f5e' },
      'prism_rainbow': { fill: '#f5d0fe', glow: '#e879f9' }
    };
    var nStyle = nColors[nFx] || null;
    ctx.fillStyle = nStyle ? nStyle.fill : '#ffffff';
    if (nStyle) {
      ctx.shadowColor = nStyle.glow;
      ctx.shadowBlur = 16;
    }
    var nameFitted = fitFontSize(ctx, String(player.name || '').toUpperCase(), 42, 24, '900', FONT_DISPLAY, 510);
    ctx.fillText(nameFitted, 360, 471);
    ctx.shadowBlur = 0;

    var subtitleTxt = String((cos && cos.customTitle) || (ut && (ut.playstyle || ut.cardLabel || ut.tierLabel)) || 'ELITA SMPL').toUpperCase();
    ctx.fillStyle = th.accent;
    ctx.font = '800 15px ' + FONT_BODY;
    ctx.fillText(fitTextTruncate(ctx, subtitleTxt, 480), 360, 524);
    ctx.restore();

    // 6 Stat Capsules with Color Progress Bars
    var srcSt = (ut && (ut.attributes || ut.attrs || ut.stats)) ? (ut.attributes || ut.attrs || ut.stats) : {};
    var pairs = [
      ['ATA', srcSt.ATA || srcSt.ATK || 75, 'ATAK'],
      ['DEF', srcSt.DEF || 75, 'OBRONA'],
      ['SKT', srcSt.SKT || srcSt.STR || 75, 'SKUTECZNOŚĆ'],
      ['DOS', srcSt.DOS || srcSt.KON || 75, 'DOŚWIADCZ.'],
      ['FOR', srcSt.FOR || 75, 'FORMA'],
      ['MEN', srcSt.MEN || srcSt.PRS || 75, 'MENTAL']
    ];
    pairs.forEach(function (pr, i) {
      var col = i % 2;
      var row = Math.floor(i / 2);
      var bx = 98 + col * 272;
      var by = 550 + row * 82;
      var bw = 252;
      var bh = 68;
      var val = Math.max(1, Math.min(99, Number(pr[1] || 75)));

      fillRoundedRect(ctx, bx, by, bw, bh, 14, 'rgba(6, 10, 22, 0.72)');
      strokeRoundedRect(ctx, bx, by, bw, bh, 14, 'rgba(' + th.accentRgb + ', 0.25)', 1.2);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = th.accent;
      ctx.font = '900 32px ' + FONT_DISPLAY;
      ctx.fillText(String(val), bx + 16, by + 39);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 17px ' + FONT_BODY;
      ctx.fillText(pr[0], bx + 74, by + 29);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 11px ' + FONT_BODY;
      ctx.fillText(pr[2], bx + 74, by + 44);
      ctx.restore();

      drawStatBar(ctx, bx + 14, by + 53, bw - 28, 6, val / 99, th.barA, th.barB, 'rgba(255, 255, 255, 0.10)');
    });

    // Bottom Shield Crest & Season/Career Micro-Strip
    var sRow = (ut && (ut.seasonRow || ut.row)) ? (ut.seasonRow || ut.row) : null;
    var footChip = sRow
      ? ('S' + (s.season || 56) + ': ' + (sRow.M || 0) + 'M • ' + (sRow.W || 0) + 'W • ' + (sRow.PKT || 0) + ' PKT')
      : ('🏆 ' + ((ut && ut.tierLabel) ? String(ut.tierLabel).toUpperCase() : 'SCORE! MATCH POLSKA'));
    drawPillBadge(ctx, 360, 816, footChip, {
      align: 'center',
      bg: 'rgba(255, 255, 255, 0.06)',
      border: 'rgba(' + th.accentRgb + ', 0.35)',
      color: '#e2e8f0',
      height: 36,
      padX: 22,
      maxW: 390,
      font: '800 14px ' + FONT_BODY
    });

    return canvas;
  }

  function generateUtCardPosterPng(state, playerId) {
    if (typeof document === 'undefined') return Promise.resolve({ ok: false, error: 'Canvas niedostepny.' });
    var s = state || {};
    var pid = String(playerId || '');
    var player = (s.players || []).find(function (p) { return p && String(p.id) === pid; });
    if (!player) return Promise.resolve({ ok: false, error: 'Nie znaleziono zawodnika.' });

    var ut = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculatePlayerUTCard === 'function')
      ? window.SMPL_ENGINE.calculatePlayerUTCard(s, pid)
      : { ovr: 75, tierLabel: 'GOLD', stats: { ATK: 75, DEF: 74, STR: 76, KON: 75, FOR: 75, PRS: 75 } };
    var cos = getPlayerCosmetics(s, pid);
    var outName = 'SMPL-KartaUT-' + foldName(player.name).replace(/\s+/g, '-') + '.png';

    return waitFontsBrief().then(function () {
      return loadSafeImage('./img/ut-card-foil-bg.jpg').then(function (bgImg) {
        return loadSafeImage(player.avatar).then(function (img) {
          var res = buildPosterResult(renderUtCardCanvas(s, player, ut, cos, img, bgImg), outName);
          if (!res.ok && img) {
            res = buildPosterResult(renderUtCardCanvas(s, player, ut, cos, null, bgImg), outName);
          }
          if (!res.ok && bgImg) {
            res = buildPosterResult(renderUtCardCanvas(s, player, ut, cos, null, null), outName);
          }
          return res;
        });
      });
    });
  }

  function renderWrappedCanvas(wrapped, img, bgImg) {
    var W = 1080;
    var H = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var player = wrapped.player || {};
    var th = wrapped.posterTheme || POSTER_THEMES_MAP['default'];
    paintStudioBackdrop(
      ctx, W, H,
      '', '', '',
      {
        bgImg: bgImg,
        bgAlpha: 0.22,
        bg0: th.bg0,
        bg1: th.bg1,
        bg2: th.bg2,
        accent: th.accent,
        accentRgb: th.accentRgb,
        accentRightRgb: th.accentRightRgb,
        skipHeader: true,
        footerText: 'SCORE! MATCH LIGA POLSKA • OFICJALNE PODSUMOWANIE SEZONU • S1–S56'
      }
    );

    // Header Identity Block (with circular portrait + chips)
    drawClippedAvatar(ctx, img, 128, 128, 60, String(player.name || 'S'), th.accent, '#172542');

    drawPillBadge(ctx, 216, 56, '✨ SMPL WRAPPED • SEZON ' + wrapped.season + (th.label ? (' • 🎨 ' + th.label) : ''), {
      bg: 'rgba(' + th.accentRgb + ', 0.16)',
      border: 'rgba(' + th.accentRgb + ', 0.45)',
      color: th.headerFill || '#fde047',
      height: 32,
      padX: 16,
      font: '800 14px ' + FONT_BODY
    });

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    var pHead = fitFontSize(ctx, String(player.name || '').toUpperCase(), 48, 28, '900', FONT_DISPLAY, 790);
    ctx.fillText(pHead, 216, 136);

    var chipX = 216;
    if (player.clanTag) {
      var c1 = drawPillBadge(ctx, chipX, 152, '[' + player.clanTag + ']', {
        bg: 'rgba(250, 204, 21, 0.14)', border: 'rgba(250, 204, 21, 0.35)', color: '#fde047', height: 28, padX: 12, font: '800 13px ' + FONT_BODY
      });
      chipX += c1.w + 10;
    }
    var c2 = drawPillBadge(ctx, chipX, 152, 'DYWIZJA ' + String(player.leagueId || 'L1').toUpperCase(), {
      bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.35)', color: '#7dd3fc', height: 28, padX: 14, font: '800 13px ' + FONT_BODY
    });
    chipX += c2.w + 10;
    if (wrapped.reliability && wrapped.reliability.label) {
      drawPillBadge(ctx, chipX, 152, String(wrapped.reliability.label), {
        bg: 'rgba(16, 185, 129, 0.14)', border: 'rgba(16, 185, 129, 0.35)', color: '#6ee7b7', height: 28, padX: 14, font: '800 13px ' + FONT_BODY
      });
    }
    ctx.restore();

    // Row 1: Hero Performance Card (Win-Rate Gauge + 3 KPI Pillars)
    var heroGrad = ctx.createLinearGradient(56, 224, 1024, 448);
    heroGrad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
    heroGrad.addColorStop(1, 'rgba(23, 18, 48, 0.90)');
    fillRoundedRect(ctx, 56, 224, 968, 224, 24, heroGrad);
    strokeRoundedRect(ctx, 56, 224, 968, 224, 24, 'rgba(250, 204, 21, 0.32)', 1.8);

    drawArcGauge(ctx, 178, 336, 68, wrapped.winPct || 0, '#22c55e', 'rgba(148, 163, 184, 0.16)', 'WYGRANYCH');

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(294, 252);
    ctx.lineTo(294, 420);
    ctx.stroke();

    // KPI 1: Played & Bilans
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 14px ' + FONT_BODY;
    ctx.fillText('MECZE W SEZONIE', 326, 272);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 54px ' + FONT_DISPLAY;
    ctx.fillText(String(wrapped.played || 0), 326, 334);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 18px ' + FONT_BODY;
    ctx.fillText((wrapped.wins || 0) + 'W  •  ' + (wrapped.draws || 0) + 'R  •  ' + (wrapped.losses || 0) + 'P', 326, 372);
    var playPct = Math.min(1, Number(wrapped.played || 0) / 14);
    drawStatBar(ctx, 326, 394, 190, 8, playPct, '#38bdf8', '#818cf8');

    // KPI 2: Goals For : Against
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 14px ' + FONT_BODY;
    ctx.fillText('BRAMKI (ZD : ST)', 560, 272);
    ctx.fillStyle = '#fde047';
    ctx.font = '900 54px ' + FONT_DISPLAY;
    ctx.fillText((wrapped.gf || 0) + ' : ' + (wrapped.ga || 0), 560, 334);
    var gTot = Number(wrapped.gf || 0) + Number(wrapped.ga || 0);
    var gfShare = gTot > 0 ? (Number(wrapped.gf || 0) / gTot) : 0.5;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 17px ' + FONT_BODY;
    var diffG = Number(wrapped.gf || 0) - Number(wrapped.ga || 0);
    ctx.fillText('Bilans: ' + (diffG > 0 ? ('+' + diffG) : String(diffG)) + ' goli', 560, 372);
    drawStatBar(ctx, 560, 394, 190, 8, gfShare, '#22c55e', '#4ade80', 'rgba(239, 68, 68, 0.38)');

    // KPI 3: Clean Sheets
    ctx.fillStyle = '#94a3b8';
    ctx.font = '800 14px ' + FONT_BODY;
    ctx.fillText('CZYSTE KONTA', 804, 272);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 54px ' + FONT_DISPLAY;
    ctx.fillText(String(wrapped.cleanSheets || 0), 804, 334);
    var csRate = wrapped.played > 0 ? Math.round((Number(wrapped.cleanSheets || 0) / wrapped.played) * 100) : 0;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 17px ' + FONT_BODY;
    ctx.fillText(csRate + '% meczów na zero', 804, 372);
    drawStatBar(ctx, 804, 394, 180, 8, csRate / 100, '#38bdf8', '#22d3ee');
    ctx.restore();

    // 2x2 Rich Bento Cards
    function drawBentoCard(bx, by, tagTxt, accentCol, mainTxt, subTxt, extraFn) {
      fillRoundedRect(ctx, bx, by, 472, 192, 22, 'rgba(15, 23, 42, 0.88)');
      strokeRoundedRect(ctx, bx, by, 472, 192, 22, 'rgba(148, 163, 184, 0.22)', 1.5);
      fillRoundedRect(ctx, bx, by + 20, 6, 152, 3, accentCol);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = accentCol;
      ctx.font = '800 15px ' + FONT_BODY;
      ctx.fillText(tagTxt, bx + 28, by + 44);

      ctx.fillStyle = '#ffffff';
      var fittedMain = fitFontSize(ctx, String(mainTxt), 38, 24, '900', FONT_DISPLAY, 412);
      ctx.fillText(fittedMain, bx + 28, by + 106);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 18px ' + FONT_BODY;
      ctx.fillText(fitTextTruncate(ctx, String(subTxt), 412), bx + 28, by + 150);
      ctx.restore();
      if (typeof extraFn === 'function') extraFn(bx, by);
    }

    var streak = Number(wrapped.maxWinStreak || 0);
    drawBentoCard(
      56, 472,
      '🔥 SERIA BEZ PORAŻKI / ZWYCIĘSTW',
      '#f59e0b',
      streak > 0 ? (streak + (streak === 1 ? ' wygrana' : ' z rzędu')) : 'ROZGRZEWKA SEZONU',
      streak > 0 ? 'Najdłuższa zwycięska passa w S' + wrapped.season : 'Czas na pierwsze ligowe zwycięstwa!',
      function (bx, by) {
        for (var k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.arc(bx + 362 + k * 20, by + 39, 6, 0, Math.PI * 2);
          ctx.fillStyle = k < Math.min(5, streak) ? '#f59e0b' : 'rgba(148, 163, 184, 0.2)';
          ctx.fill();
        }
      }
    );

    drawBentoCard(
      552, 472,
      '🏆 NAJWYŻSZE ZWYCIĘSTWO',
      '#22c55e',
      wrapped.bestWin ? (wrapped.bestWin.myG + ' : ' + wrapped.bestWin.opG + '  W') : 'CZEKA NA 2:0',
      wrapped.bestWin ? ('Przeciwko: ' + wrapped.bestWin.oppName) : 'Najlepszy mecz jeszcze przed Tobą!'
    );

    drawBentoCard(
      56, 686,
      '🎯 ULUBIONY RYWAL',
      '#38bdf8',
      wrapped.favoriteVictim ? String(wrapped.favoriteVictim.name || '') : 'BRAK DANYCH H2H',
      wrapped.favoriteVictim
        ? ('Bilans: ' + (wrapped.favoriteVictim.w || 0) + 'W • ' + (wrapped.favoriteVictim.ptsFor || 0) + ' zdobytych pkt')
        : 'Rozegraj więcej meczów z rywalami'
    );

    drawBentoCard(
      552, 686,
      '⚔️ NAJTRUDNIEJSZY KOSZMAR',
      '#fb7185',
      wrapped.nemesis ? String(wrapped.nemesis.name || '') : 'NIEPOKONANY!',
      wrapped.nemesis
        ? ('Stracone punkty: ' + (wrapped.nemesis.ptsAgainst || 0) + ' • Porażki: ' + (wrapped.nemesis.l || 0))
        : 'Nikt jeszcze nie znalazł na Ciebie sposobu!'
    );

    // Row 4: Career All-Time Showcase S1-S56
    var carGrad = ctx.createLinearGradient(56, 900, 1024, 1072);
    carGrad.addColorStop(0, 'rgba(250, 204, 21, 0.14)');
    carGrad.addColorStop(0.6, 'rgba(15, 23, 42, 0.90)');
    carGrad.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
    fillRoundedRect(ctx, 56, 900, 968, 172, 22, carGrad);
    strokeRoundedRect(ctx, 56, 900, 968, 172, 22, 'rgba(250, 204, 21, 0.38)', 1.8);

    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.font = '800 15px ' + FONT_BODY;
    ctx.textAlign = 'left';
    ctx.fillText('🏛️ KARIERA WSZECH CZASÓW (SEZONY S1–S56)', 86, 938);

    if (wrapped.careerEntry) {
      var ce = wrapped.careerEntry;
      var cPts = ce.total != null ? ce.total : (ce.points != null ? ce.points : 0);
      drawPillBadge(ctx, 86, 964, '#' + ce.rank + ' W HISTORII', {
        bg: 'rgba(250, 204, 21, 0.22)', border: '#facc15', color: '#fde047', height: 64, padX: 26, font: '900 30px ' + FONT_DISPLAY
      });

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px ' + FONT_DISPLAY;
      ctx.fillText(String(cPts) + ' PKT', 390, 1004);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 16px ' + FONT_BODY;
      ctx.fillText('Suma punktów S1–S55', 390, 1032);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '900 36px ' + FONT_DISPLAY;
      ctx.fillText(String(ce.matches || 0) + ' M', 626, 1004);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 16px ' + FONT_BODY;
      ctx.fillText('Rozegranych meczów', 626, 1032);

      var medals = '🥇' + (ce.gold || 0) + '  🥈' + (ce.silver || 0) + '  🥉' + (ce.bronze || 0);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 24px ' + FONT_BODY;
      ctx.fillText(medals, 830, 1004);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 16px ' + FONT_BODY;
      ctx.fillText('Medale ligowe', 830, 1032);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px ' + FONT_DISPLAY;
      ctx.fillText('NOWA ERA SMPL — PIERWSZE KROKI W S' + wrapped.season, 86, 1002);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 18px ' + FONT_BODY;
      ctx.fillText('Każdy rozegrany mecz buduje Twój oficjalny dorobek w rankingu wszech czasów!', 86, 1038);
    }
    ctx.restore();

    // Row 5: Bottom Split — Achievements Bar + SMPL Coins Vault
    fillRoundedRect(ctx, 56, 1094, 536, 166, 22, 'rgba(15, 23, 42, 0.88)');
    strokeRoundedRect(ctx, 56, 1094, 536, 166, 22, 'rgba(168, 85, 247, 0.35)', 1.5);
    var achUnl = Number((wrapped.achievements && wrapped.achievements.unlockedCount) || 0);
    var achTot = Math.max(1, Number((wrapped.achievements && wrapped.achievements.totalCount) || 1));
    var achPct = Math.round((achUnl / achTot) * 100);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c084fc';
    ctx.font = '800 15px ' + FONT_BODY;
    ctx.fillText('🎖️ OSIĄGNIĘCIA & ODZNAKI', 84, 1134);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px ' + FONT_DISPLAY;
    ctx.fillText(achUnl + ' / ' + achTot + ' odznak', 84, 1190);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '800 20px ' + FONT_DISPLAY;
    ctx.textAlign = 'right';
    ctx.fillText(achPct + '%', 562, 1190);
    ctx.restore();
    drawStatBar(ctx, 84, 1216, 478, 16, achUnl / achTot, '#a855f7', '#38bdf8');

    fillRoundedRect(ctx, 616, 1094, 408, 166, 22, 'rgba(15, 23, 42, 0.88)');
    strokeRoundedRect(ctx, 616, 1094, 408, 166, 22, 'rgba(250, 204, 21, 0.35)', 1.5);
    var coinBal = Number((wrapped.coins && wrapped.coins.balance) || 0);
    var coinEarn = Number((wrapped.coins && wrapped.coins.earned) || 0);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.font = '800 15px ' + FONT_BODY;
    ctx.fillText('🪙 SKARBIEC SMPL COINS', 644, 1134);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px ' + FONT_DISPLAY;
    ctx.fillText(coinBal + ' COINS', 644, 1192);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 17px ' + FONT_BODY;
    ctx.fillText('Łącznie zdobyte: ' + coinEarn + ' monet', 644, 1232);
    ctx.restore();

    return canvas;
  }

  function generateWrappedPosterPng(wrapped) {
    if (typeof document === 'undefined' || !wrapped) return Promise.resolve({ ok: false, error: 'Brak danych Wrapped.' });
    var outName = 'SMPL-Wrapped-S' + wrapped.season + '-' + foldName((wrapped.player && wrapped.player.name) || 'Gracz').replace(/\s+/g, '-') + '.png';

    return waitFontsBrief().then(function () {
      return loadSafeImage('./img/hall-of-fame-bg.jpg').then(function (bgImg) {
        return loadSafeImage(wrapped.player && wrapped.player.avatar).then(function (img) {
          var res = buildPosterResult(renderWrappedCanvas(wrapped, img, bgImg), outName);
          if (!res.ok && img) {
            res = buildPosterResult(renderWrappedCanvas(wrapped, null, bgImg), outName);
          }
          if (!res.ok && bgImg) {
            res = buildPosterResult(renderWrappedCanvas(wrapped, null, null), outName);
          }
          return res;
        });
      });
    });
  }

  function downloadPngDataUrl(dataUrlOrResult, filename) {
    if (!dataUrlOrResult || typeof document === 'undefined') return false;
    var dataUrl = '';
    var resolvedName = filename;
    if (typeof dataUrlOrResult === 'string') {
      dataUrl = dataUrlOrResult;
    } else if (typeof dataUrlOrResult === 'object') {
      if (dataUrlOrResult.ok === false) return false;
      dataUrl = dataUrlOrResult.dataUrl || '';
      if (!resolvedName && dataUrlOrResult.filename) resolvedName = dataUrlOrResult.filename;
    }
    if (!dataUrl || String(dataUrl).indexOf('data:image/') !== 0) return false;

    var safeName = String(resolvedName || 'smpl-grafika.png').replace(/[\\/:*?"<>|]+/g, '-');
    var hrefUrl = dataUrl;
    var objectUrl = '';
    var blob = dataUrlToBlob(dataUrl);
    if (blob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        objectUrl = URL.createObjectURL(blob);
        if (objectUrl) hrefUrl = objectUrl;
      } catch (e) {
        objectUrl = '';
      }
    }

    var a = document.createElement('a');
    a.href = hrefUrl;
    a.download = safeName;
    if (a.style) a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    if (typeof setTimeout === 'function') {
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        }
      }, 1500);
    } else if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // EKSPORT CSV DLA POLSKIEGO EXCELA (\uFEFF UTF-8 BOM + ;)
  // ---------------------------------------------------------------------------
  function csvCell(val) {
    var s = String(val == null ? '' : val).replace(/\r?\n/g, ' ');
    if (s.indexOf(';') >= 0 || s.indexOf('"') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function buildCsvString(headers, rows) {
    var out = [headers.map(csvCell).join(';')];
    (rows || []).forEach(function (r) {
      out.push((r || []).map(csvCell).join(';'));
    });
    return '\uFEFF' + out.join('\r\n');
  }

  function triggerCsvDownload(filename, csvStr) {
    if (typeof document === 'undefined' || typeof Blob === 'undefined') return false;
    var blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1500);
    return true;
  }

  function exportStandingsCsv(state, leagueId) {
    var s = state || {};
    var lid = leagueId || 'L1';
    var rows = (window.SMPL_ENGINE && typeof window.SMPL_ENGINE.calculateStandings === 'function')
      ? (window.SMPL_ENGINE.calculateStandings(s, lid) || [])
      : [];
    var headers = ['Poz', 'Zawodnik', 'Nick', 'Klan', 'M', 'W', 'R', 'P', 'BZ', 'BS', 'Bilans', 'Kary', 'PKT', 'Czyste Konta'];
    var dataRows = rows.map(function (r, idx) {
      return [
        idx + 1,
        r.name,
        r.nick || '',
        (r.player && r.player.clanTag) ? r.player.clanTag : '',
        r.M || 0, r.W || 0, r.R || 0, r.P || 0,
        r.BZ || 0, r.BS || 0,
        (r.BZ || 0) - (r.BS || 0),
        r.penaltyPoints || 0,
        r.PKT || 0,
        r.cleanSheets || 0
      ];
    });
    var csv = buildCsvString(headers, dataRows);
    triggerCsvDownload('SMPL-Tabela-' + lid + '-S' + (s.season || 56) + '.csv', csv);
    return csv;
  }

  function exportArchiveRankingCsv(rankingKey, rows) {
    var key = String(rankingKey || 'CAREER').toUpperCase();
    var headers = ['Poz', 'Zawodnik', 'Sezony', 'Mecze', 'W', 'R', 'P', 'BZ', 'BS', 'PKT', 'PktPoz', 'Suma', 'Zloto', 'Srebro', 'Braz'];
    var dataRows = (rows || []).map(function (r, idx) {
      return [
        r.rank || r.pos || (idx + 1),
        r.name || '',
        r.seasons || 0,
        r.matches || 0,
        r.wins || 0, r.draws || 0, r.losses || 0,
        r.gf || 0, r.ga || 0,
        r.points || r.pts || r.totalScore || 0,
        r.posPts || 0,
        r.total || r.totalScore || 0,
        r.gold || 0, r.silver || 0, r.bronze || 0
      ];
    });
    var csv = buildCsvString(headers, dataRows);
    triggerCsvDownload('SMPL-Ranking-' + key + '.csv', csv);
    return csv;
  }

  function exportDisciplinaryLogCsv(state) {
    var s = state || {};
    var headers = ['Typ', 'Zawodnik', 'Liga', 'Szczegoly / Powod', 'Punkty Karne / Kartki'];
    var dataRows = [];
    (s.players || []).forEach(function (p) {
      if (!p) return;
      var pen = Number(p.penaltyPoints || 0);
      var yc = Number(p.yellowCards || 0);
      var rc = Number(p.redCards || 0);
      if (pen > 0 || yc > 0 || rc > 0 || p.isSuspended || p.isBlacklisted) {
        dataRows.push([
          p.isBlacklisted ? 'CZARNA LISTA' : (p.isSuspended ? 'ZAWIESZENIE' : 'KARA / KARTKI'),
          p.name || '',
          p.leagueId || '-',
          p.penaltyReason || p.suspensionReason || '-',
          '-' + pen + ' pkt / Z:' + yc + ' C:' + rc
        ]);
      }
    });
    var csv = buildCsvString(headers, dataRows);
    triggerCsvDownload('SMPL-Kartoteka-Dyscyplinarna-S' + (s.season || 56) + '.csv', csv);
    return csv;
  }

  /**
   * OBOWIĄZKOWY DZIENNIK ZMIAN PORTALU DLA GRACZY (Update V + cyfry)
   * ZASADA PROJEKTOWA: Od teraz KAŻDA zmiana widoczna dla graczy na portalu
   * MUSI zostać zapisana jako kolejny numerowany wpis Update V<major>.<minor>
   * (np. V1.0, V1.1, V1.2, V2.0...) tutaj w BUILTIN_PLAYER_UPDATES albo
   * opublikowana w Panelu Admina (portalSettings.playerUpdates).
   * Uwaga: opisujemy wyłącznie funkcje i poprawki dla graczy (zero wewnętrznych detali serwera).
   */
  var BUILTIN_PLAYER_UPDATES = [
    {
      id: 'BUILTIN_V2_7',
      version: 'V2.7',
      date: '2026-11-20',
      category: 'ULEPSZENIA',
      title: 'Nowe, Hardkorowe Kamienie Milowe (18 Wyzwań Legend SMPL!)',
      summary: 'Podnieśliśmy poprzeczkę Kamieni Milowych na Kartach UT i w profilu! Koniec ze zbyt łatwymi progami typu 100 meczów — teraz na weteranów i debiutantów czeka 18 prawdziwych wyzwań kariery oraz sezonu z paskami postępu.',
      highlights: [
        'Nowa drabinka stażu meczowego: Klub 500 → Panteon 1000 → Klub 1500 Tytanów (dziś tylko 4 aktywnych graczy!) → mityczny Nieśmiertelny 2000 (cel na lata dla całej ligi!).',
        'Nowe rekordy kariery: Klub 500 i Legenda 750 Zwycięstw, Kanonier 1200+ i Król Kanonierów 1800 Goli (albo 40/50+ bramek w 1 sezonie!), Potrójny Mistrz (3× Złoto), Dynastia Mistrzów (7× Złoto), Kolekcjoner Podium (10+ medali) oraz Filar Ekstraklasy (20 sezonów w L1).',
        '2×–2,5× trudniejsze wyzwania sezonowe: Żelazna Kurtyna 10+ (10 czystych kont), Niepokonany 10+ (seria 10 meczów bez porażki), Podwójny Perfekt (2 tygodnie z kompletem ≥4 wygranych), Kat Gigantów 3× (3 wygrane z TOP 5 swojej ligi), Żelazny Terminarz 25+ (25 meczów bez WO) oraz Głos Społeczności Pro (Złota Piłka + 5 typów w Typerze).',
        'Każda odznaka na Karcie UT ma teraz wizualny pasek postępu (0–100%) oraz rangę trudności (WETERAN / ELITA / LEGENDA / MITYCZNY / SEZON).'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V2_6',
      version: 'V2.6',
      date: '2026-11-20',
      category: 'NOWOŚCI',
      title: 'Sezon 55 (Półmetek) w Archiwum — Ekstraklasa i 2. Liga na Żywo!',
      summary: 'Wgraliśmy aktualny stan rozgrywek z półmetka Sezonu 55 w Ekstraklasie (51,7% meczów) i 2. Lidze (60,4% meczów), aby wszyscy gracze mogli na bieżąco śledzić walkę o podium, awans i utrzymanie przed startem Sezonu 56.',
      highlights: [
        'Ekstraklasa S55 (124/240 meczów • 247 goli): na czele Krzysztof Dziubak (31 pkt w 14 M) przed Patrykiem Warzybokiem (31 pkt) i Michałem Wu (28 pkt, lider strzelców — 23 gole).',
        '2. Liga S55 (110/182 meczów realnych • 195 goli): prowadzi Patryk Dzierża (47 pkt, 10 czystych kont i tylko 4 stracone bramki!) przed Tomaszem Fałatem (44 pkt, 28 goli) i Adrianem Balińskim (42 pkt).',
        'Przycisk „⏳ Sezon 55 (Półmetek)” na górze portalu przenosi teraz od razu do aktualnej tabeli S55 z podsumowaniem czystych kont, króla strzelców i strefy spadkowej/awansu.',
        'Bezpieczna ochrona historii: dopóki trwa Sezon 55, medale końcowe, Ranking Wszech Czasów, Kariery i Rekordy Sezonowe obejmują wyłącznie ukończone sezony (S1–S54) — po 30. kolejce S55 zostanie zamknięty i doliczony automatycznie.'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V2_5',
      version: 'V2.5',
      date: '2026-11-20',
      category: 'ULEPSZENIA',
      title: 'Studio Mistrzów Royal 2026 — Ekskluzywny, Spójny Wygląd na Smartfon i PC',
      summary: 'Przebudowaliśmy cały wizualny system portalu, rejestracji i paneli do jednego luksusowego wzorca Broadcast Gold & Glass — szybszego, czytelniejszego i idealnie dopasowanego zarówno na telefony, jak i duże monitory.',
      highlights: [
        'Smartfon bez ścisku: odchudzony baner Hero (z 535 px do kompaktowego paska Broadcast), 4-kolumnowy pasek telemetrii i bezbłędne przyciski CTA bez nachodzenia tekstu.',
        'Ekran logowania (Auth Gate) mieści teraz od razu przycisk wejścia bez przewijania na telefonach i PC, a dymek Vanessy AI nie zasłania już pól haseł.',
        'Jednolity królewski wzorzec na wszystkich 4 stronach (Portal, Rejestracja, Panel Admina, Master Panel), medalionowe herby lig, miękkie wygaszanie krawędzi zakładek i dopracowany tryb Jasny Prestiż.',
        'Nowoczesne suwaki, czytelne odznaki XP (Platynowy Taktyk), wyrównane filtry Terminarza oraz szklane toasty dopasowane do każdego z 5 motywów.'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V2_4',
      version: 'V2.4',
      date: '2026-11-17',
      category: 'POPRAWKI',
      title: 'Trwałe Czyszczenie Centrum Powiadomień i Licznika przy Dzwonku',
      summary: 'Naprawiliśmy błąd, przez który po kliknięciu „✅ Przeczytane” lub „🗑️ Wyczyść” i odświeżeniu strony wracały stare powiadomienia oraz czerwona plakietka przy dzwonku 🔔.',
      highlights: [
        'Każde oznaczenie jako przeczytane oraz wyczyszczenie skrzynki zapisuje się teraz trwale zarówno po stronie serwera, jak i lokalnie — po F5 stare alerty już nie wracają.',
        'Licznik przy dzwonku 🔔 zeruje się od razu po wyczyszczeniu lub przeczytaniu powiadomień (również u Administratorów posiadających własny profil zawodnika), a oczekujące akcje zarządu pozostają osobno w Panelu Admina i w sekcji Kolejka Admina.'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V2_3',
      version: 'V2.3',
      date: '2026-11-17',
      category: 'POPRAWKI',
      title: 'Pełny 6-Przyciskowy Pasek na Telefonie — Zakładka „🥇 Konkursy” w Miejsce Pustej Luki',
      summary: 'Zapełniliśmy wolne miejsce w dolnym menu na smartfonach! Zamiast pustej luki po usuniętym czacie każdy gracz i administrator ma teraz wygodny, równo wypełniony pasek z szybkim dostępem do Konkursów Piłkarskich.',
      highlights: [
        'Nowy 3. kafelek „🥇 Konkursy” na dolnym pasku telefonu: 1 kliknięciem otwierasz Złoty But, Puchar Ligi, Typer Kolejki, Nagrodę Puskása i Sklepik SMPL Coins.',
        'Równa siatka 6 przycisków zarówno dla zwykłych graczy i gości (Tabela, Mecze, Konkursy, Wynik, Karta UT, Zapisy), jak i dla Administratorów (Tabela, Mecze, Konkursy, Wynik, Karta UT, Admin).'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V2_2',
      version: 'V2.2',
      date: '2026-11-17',
      category: 'ULEPSZENIA',
      title: 'Koniec Czatu i Priv ➔ Messenger + Obowiązkowy SS dlaczego przy Sporach VAR i W.O.',
      summary: 'Po ankiecie testerów i graczy całkowicie wyłączyliśmy wewnętrzny czat ligowy oraz wiadomości prywatne (Priv/DM) w portalu — wszystkie mecze umawiamy teraz niezawodnie na Messengerze. Ponadto każde zgłoszenie sporu VAR oraz wniosek o walkower (W.O.) wymagają obowiązkowego zrzutu ekranu (SS dlaczego).',
      highlights: [
        'Usunięto wewnętrzny czat ligowy, Priv/DM, @wzmianki, powiadomienia czatowe oraz blokady czatu z całego portalu — zero niedziałających wiadomości w tle.',
        'Przycisk „💬 Napisz na Messengerze” w Terminarzu, na Karcie UT i w profilu gracza jednym kliknięciem kopiuje zaproszenie z kodem słownym bez cyfr i otwiera Messenger rywala.',
        'Odświeżony, równy dolny pasek mobilny (5 przycisków: Tabela, Mecze, Wynik, Karta UT, Zapisy/Admin) oraz zaktualizowany Regulamin SMPL i odpowiedzi Vanessy AI.',
        'Obowiązkowy zrzut ekranu (SS dlaczego) przy każdym Sporze VAR i Walkowerze (W.O.): gracz załącza screen rozmowy z Messengera lub z gry, a podgląd dowodu działa od razu w Terminarzu i Trybunale Admina.'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V2_1',
      version: 'V2.1',
      date: '2026-11-17',
      category: 'POPRAWKI',
      title: 'Powiadomienia PUSH na iPhone (iOS), Centrum Powiadomień (🔔) & Naprawa Warstw Toastów',
      summary: 'Naprawiliśmy powiadomienia na iPhone (iOS 16.4+) oraz ich nakładanie się na elementy strony! Dodaliśmy osobne Centrum Powiadomień pod dzwonkiem 🔔 na górnym pasku oraz pełne wsparcie Apple Web Push z instrukcją instalacji PWA z Safari.',
      highlights: [
        'Naprawa Web Push na iPhone / iOS: wdrożono kryptografię VAPID ES256 + szyfrowanie aes128gcm, wykrywanie przeglądarki wewnątrz Messengera/FB oraz przewodnik „Udostępnij ➔ Do ekranu początkowego” w Safari.',
        'Nowe Centrum Powiadomień pod ikoną dzwonka 🔔: historia alertów o meczach, wynikach, nagrodach i sporach VAR, szybkie włączanie PUSH oraz przycisk testu na telefon.',
        'Naprawiono warstwy powiadomień (z-index): komunikaty toast wyskakują zawsze ponad górnym paskiem, menu ⚙️ i oknami modalnymi.'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V2_0',
      version: 'V2.0',
      date: '2026-11-17',
      category: 'NOWOŚCI',
      title: 'Studio Mistrzów 2026 — Nowy Układ, 5 Prawdziwych Motywów & Grafiki AAA',
      summary: 'Wielka przebudowa wizualna portalu SMPL łącząca królewską elegancję Ligi Mistrzów z hologramami e-sportowymi! Od razu po otwarciu strony widzisz lidera, najbliższy mecz i tabelę bez zbędnego przewijania, a wszystkie 5 motywów kolorystycznych całkowicie odmieniają wygląd kart, stadionów i banerów.',
      highlights: [
        'Układ „Matchday Command Center”: kompaktowy baner Studio Mistrzów z panelem Live HUD po prawej stronie (Lider tabeli, Twój najbliższy mecz / Hit kolejki oraz pasek postępu kolejki) oraz smukłym przełącznikiem lig, dzięki czemu Tabela Główna i Podium TOP 3 są widoczne od razu!',
        '5 w pełni działających motywów w menu ⚙️: Noc Mistrzów (Onyks & Złoto), Jasny Prestiż (Porcelana & Błękit ze stadionem w świetle dnia), Szmaragdowy Pałac VIP, Wieczorne Jupitery (Neon UCL) oraz Poranny Stadion — z przełącznikiem stylu WOW / Klasyczny pod ręką!',
        'Odświeżona oprawa graficzna AAA: nowy puchar w blasku reflektorów (wersja nocna i dzienna), tunel stadionu na ekranie logowania, karty UT w holograficznej folii, pojedynek Ogień vs Lód w H2H, gala Złotej Piłki oraz futurystyczna prezenterka Vanessa AI.'
      ],
      author: 'Szymon Komenda & Zespół SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_9',
      version: 'V1.9',
      date: '2026-11-17',
      category: 'ULEPSZENIA',
      title: 'Długodystansowa Ekonomia SMPL Coins & Przenoszenie Salda Między Sezonami',
      summary: 'Sklepik SMPL Loyalty Coins przeszedł gruntowną przebudowę ekonomiczną na wzór wielosezonowej progresji! Teraz każdy odblokowany element i zarobiona moneta ma prawdziwą wartość kolekcjonerską — nie wykupisz całego katalogu w jeden tydzień, a Twoje saldo i kosmetyki przechodzą płynnie na kolejne sezony.',
      highlights: [
        'Prestiżowe ceny wielosezonowe: przedmioty Klasyk kosztują teraz od 220 do 380 Coins, Rzadkie i Limit S56 od 420 do 900 Coins, Epickie do 1450 Coins, Legendarne do 2600 Coins, a kolekcjonerskie VIP (m.in. Zaćmienie Czempiona) sięgają 5000 Coins.',
        'Wyważone zdobywanie monet: +6 Coins za zatwierdzony mecz, +5 za Czyste Konto, +35 premii terminowości po 10 meczach bez walkowera, +12/+4 w Typerze za trafione mecze (koniec darmowych monet za nierozstrzygnięte typy), +10 za Złotą Piłkę i +15 za Puskása.',
        'Progresywne Wyzwania Tygodniowe (do +65 Coins tygodniowo): progi wyzwań rosną wraz z kolejnymi tygodniami rozgrywkowymi.',
        'Przenoszenie kolekcji i skarbca między sezonami: przy starcie kolejnego sezonu Twoje odblokowane kosmetyki oraz niewydane SMPL Coins automatycznie przenoszą się do nowego sezonu!'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_8',
      version: 'V1.8',
      date: '2026-11-16',
      category: 'ULEPSZENIA',
      title: 'Chowane Menu (⚙️), Motywy Jasny/Ciemny/Pora Dnia, Czyste Kody Pokoju i Pełny Ekran',
      summary: 'Ogromny lifting wygody na telefonie i komputerze po uwagach testerów! Zastąpiliśmy przeładowany górny pasek eleganckim menu ⚙️, dodaliśmy automatyczne motywy kolorystyczne (Jasny/Ciemny/Pora dnia/VIP), poprawiliśmy kody pokoju Score! Match (zero myślników!), ukryliśmy pływającą Vanessę AI z ekranu i dodaliśmy ochronę przed przypadkowym wyjściem przyciskiem Wstecz.',
      highlights: [
        'Eleganckie chowane menu ⚙️ (Ustawienia): góra ekranu zajmuje teraz tylko jeden zgrabny pasek, a profil, Kartę UT, Awatar & Bio, powiadomienia PUSH, Fullscreen i motywy masz pod ręką w trybku ⚙️.',
        '5 Prestiżowych Motywów Kolorystycznych: tryb Auto System (jasny/ciemny z telefonu), Auto Pora Dnia (rano, dzień, wieczorne jupitery, nocna Liga Mistrzów), Nocny Obsidian, Jasny Prestiż oraz Szmaragd & Platyna VIP.',
        'Kody pokoju Score! Match BEZ myślnika (np. SMPL742): przyciski zaproszenia generują wyłącznie czyste znaki akceptowane przez grę oraz 1-klik kopię z automatycznym otwarciem Messengera.',
        'Pełny ekran (⛶), ochrona przycisku Wstecz na telefonie oraz dyskretna Vanessa AI: pływający dymek Vanessy nie zasłania już treści na telefonie (otwierasz ją z menu ⚙️ lub stopki), a zwijany baner startowy od razu pokazuje tabelę i mecze.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_7',
      version: 'V1.7',
      date: '2026-11-15',
      category: 'NOWOŚĆ',
      title: 'Skórki Grafik PNG, Wyzwania Tygodniowe, Prezenty Coins i Limitowany Drop Sezonu 56',
      summary: 'Sklepik SMPL Coins rośnie do 51 unikalnych kosmetyków! Dodaliśmy własne skórki kolorystyczne dla generowanych grafik PNG, limitowaną kolekcję Drop Sezonowy S56, 5 Wyzwań Tygodniowych z odbiorem nagród Coins oraz możliwość wysyłania prezentów Coins i kosmetyków innym graczom.',
      highlights: [
        'Skórki Grafik PNG (5 motywów): Cyber Arena, Złota Gala Mistrzów, Derby Inferno, Arktyczna Noc UCL i Królewskie Zaćmienie — automatycznie zmieniają styl pobieranych grafik Tabeli Ligi, Hitu Kolejki VS oraz SMPL Wrapped PNG.',
        'Limitowany Drop Sezonowy S56 (4 przedmioty): Ramka Król Mrozu, Tło Deszcz Gwiazd, Plakietka Pionier S56 oraz Tytuł Legenda Startu S56 — do kupienia wyłącznie podczas Sezonu 56, ale po odblokowaniu zostają na Twoim koncie na zawsze!',
        'Wyzwania Tygodniowe & Prezenty: odbieraj bonusowe Coins za rozegrane mecze, czyste konta, serie wygranych i głosy w Typerze, a w zakładce 🎁 Wyślij Prezent podaruj znajomemu 10–500 SMPL Coins lub dowolny kosmetyk ze sklepiku.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_6',
      version: 'V1.6',
      date: '2026-11-15',
      category: 'NOWOŚĆ',
      title: 'Wielka Rozbudowa Sklepiku SMPL Coins: 42 Kosmetyki w 6 Kategoriach + Filtry i Odsłuch',
      summary: 'Sklepik Kosmetyczny SMPL Loyalty Coins urósł z 9 do aż 42 unikalnych przedmiotów bez żadnego pay-to-win! Pojawiły się zupełnie nowe kategorie: Odznaki Flair obok nicku, Blask Nicku na Karcie UT, kolekcjonerskie Tytuły oraz 6 dźwięków meczowych z przyciskiem Test przed zakupem.',
      highlights: [
        '10 Ramek Karty UT & PNG (m.in. Lodowiec Arktyczny, Cyber Punk 2099, Nefrytowy Smok, Obsydianowy Prestiż, Zaćmienie Czempiona VIP) + 9 Teł Profilu i Karty UT (Murawa UCL, Zorza Polarna, Krater Ognia, Gwiezdny Kosmos).',
        'Nowe kategorie: 6 Odznak Flair widocznych przy nicku i na Karcie UT PNG (Snajper, Mur, Clutch, Rakieta, Taktyk, Legenda) oraz 5 efektów Blasku Nicku (Złote Światło, Szmaragdowa Aura, Cyjan Pulse, Płomienny Żar, Pryzmatyczny Hologram VIP).',
        '6 Dźwięków Meczowych Web Audio (Retro 8-Bit Level Up, Fanfara Zwycięstwa, Stadionowy Róg Gola, Cyber Laser, Akord Ligi Mistrzów, Cesarski Gong) z podglądem na żywo i odtwarzaniem po zgłoszeniu wyniku, plus 6 Tytułów, zakładki kategorii, tagi rzadkości i opcja Zdejmij.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_5',
      version: 'V1.5',
      date: '2026-11-15',
      category: 'NOWOŚĆ',
      title: 'Nowe Studio Grafik PNG PRO: Karta UT (tarcza EA FC), SMPL Wrapped Bento, Tabela i VS',
      summary: 'Wszystkie 4 generatory grafik PNG przeszły całkowity redesign graficzny! Koniec z surowymi prostokątami — teraz każda grafika wykorzystuje stadionowe tła, zaokrąglone karty glassmorphism, polską typografię i dynamiczne paski postępu.',
      highlights: [
        'Karta Ultimate Team PNG: zupełnie nowy kształt metalicznej tarczy EA FC / FUT dopasowany do ramki ze sklepiku (Złoto, Szmaragd, Diament, Inferno), wyraźny badge OVR, dywizji i klanu oraz 6 pasków postępu statystyk (ATA, DEF, SKT, DOS, FOR, MEN).',
        'SMPL Wrapped PNG: nowoczesny układ kafelków Bento z pierścieniem skuteczności (%), zdjęciem gracza, paskiem zdobytych odznak, bilansem bramkowym oraz gablotą kariery wszech czasów S1–S56 i pełnymi polskimi znakami.',
        'Hit Kolejki VS i Tabela Ligi PNG: dwukolorowe oświetlenie areny, sześciokątna tarcza wyniku, medale TOP 3, kropki formy (Z/R/P) oraz legenda stref awansu i spadku.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_4',
      version: 'V1.4',
      date: '2026-11-15',
      category: 'ULEPSZENIA',
      title: 'Podgląd grafik PNG na żywo, Udostępnij na telefonie i odczyt statystyk UT',
      summary: 'Każda wygenerowana grafika PNG (VS PNG, Tabela, Karta UT, SMPL Wrapped) otwiera się od razu w czytelnym podglądzie na ekranie z przyciskami Pobierz PNG oraz Udostępnij / Zapisz na telefonie — działa teraz niezawodnie także w PWA, Safari i przeglądarce Messengera.',
      highlights: [
        'Dodano okno podglądu wygenerowanej grafiki na żywo: nawet jeśli aplikacja na telefonie blokuje automatyczne pobieranie plików, grafikę zapiszesz przyciskiem Pobierz, Udostępnij lub przytrzymując obrazek palcem.',
        'Karta UT PNG pobiera od teraz prawdziwe atrybuty zawodnika (ATA, DEF, SKT, DOS, FOR, MEN) prosto z silnika statystyk SMPL.',
        'Ulepszono odświeżanie PWA (cache v36), aby przeglądarka zawsze ładowała najnowszą wersję generatora bez ręcznego czyszczenia pamięci.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_3',
      version: 'V1.3',
      date: '2026-11-15',
      category: 'POPRAWKI',
      title: 'Naprawa pobierania grafik PNG (VS PNG, Tabela, Karta UT, SMPL Wrapped)',
      summary: 'Naprawiono błąd pobierania plików graficznych z portalu („Niepowodzenie – Brak pliku”), który uniemożliwiał zapisywanie grafik VS PNG, Tabeli, Karty UT oraz plakatu SMPL Wrapped na telefonie i komputerze.',
      highlights: [
        'Naprawiono przekazywanie wygenerowanego obrazu PNG do pobierania w przeglądarce — wszystkie 4 generatory zapisują teraz poprawny plik .png.',
        'Dodano bezpieczną konwersję grafiki do Blob / URL oraz odporne rysowanie awatarów i nagłówków w Studio Grafik PNG.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_2',
      version: 'V1.2',
      date: '2026-11-15',
      category: 'POPRAWKI',
      title: 'Walkowery 2:0 / 0:2 WO — pełne dopasowanie do zasad Score! Match',
      summary: 'Ponieważ w Score! Match Polska gra się zawsze do 2 bramek, wszystkie walkowery na portalu zostały zmienione z 3:0 na 2:0 / 0:2 WO (walkower obustronny pozostaje 0:0 WO).',
      highlights: [
        'Szybkie walkowery, decyzje VAR w sporach meczowych i generator plakatów przyznają od teraz wynik 2:0 WO lub 0:2 WO.',
        'Całkowicie zablokowano wpisywanie wyników powyżej 2 bramek (także w trybie edycji walkowerów) — w lidze obowiązują wyłącznie gole 0–2.',
        'Zaktualizowano Regulamin, opis zasad oraz podpowiedzi asystentki AI Vanessy do nowej punktacji walkowerowej 2:0 WO.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_1',
      version: 'V1.1',
      date: '2026-11-15',
      category: 'NOWOŚCI',
      title: 'Nowa zakładka „Update V...” — Dziennik Zmian dla Graczy',
      summary: 'Od teraz każdy gracz może na bieżąco sprawdzać co nowego pojawiło się w portalu Score Match Liga. Każda kolejna zmiana i nowość będzie numerowana jako Update V + cyfry (V1.0, V1.1, V1.2...).',
      highlights: [
        'Dodano nową zakładkę „Update” w górnym menu portalu wraz ze znacznikiem NOWE przy świeżej aktualizacji.',
        'Dodano czytelny podział wpisów na kategorie: Nowości, Ulepszenia, Turnieje oraz Poprawki.',
        'Dodano wyszukiwarkę zmian i szybkie filtry, aby błyskawicznie sprawdzić konkretny Update V...',
        'Administracja może publikować kolejne komunikaty Update V... prosto z Panelu Admina po każdej modernizacji strony.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    },
    {
      id: 'BUILTIN_V1_0',
      version: 'V1.0',
      date: '2026-11-15',
      category: 'NOWOŚCI',
      title: 'Wielki Pakiet Nowości Sezonu 56: Studio Grafik UT, Baraże, Sklepik & TOTW',
      summary: 'Największa aktualizacja funkcjonalna portalu SMPL! Gracze zyskali zestaw narzędzi turniejowych, system ekonomii SMPL Coins, powtórki SMPL TV, wykresy kariery i eksport statystyk.',
      highlights: [
        'Studio Grafik PNG & Karta UT: generuj i pobieraj gotowe plakaty PNG (Tabela Ligi, Karta UT, Zapowiedź Dnia Meczowego, SMPL Wrapped) jednym kliknięciem.',
        'Terminarz „Kiedy Gramy?” & Kalendarz .ICS: proponuj rywalowi termin spotkania, akceptuj godziny w terminarzu i dodawaj mecze do Kalendarza Google/telefonu.',
        'Drużyna Kolejki (TOTW): najlepsi zawodnicy tygodnia otrzymują automatyczne wyróżnienie oraz złotą odznakę w Tabeli i na Karcie UT.',
        'Nowe Rozgrywki w zakładce Konkursy: Baraże Awans/Spadek, Superpuchar Mistrzów oraz szybki turniej Weekendowy Blitz Cup.',
        'Sklepik Nagród (SMPL Coins) & Trofea: zbieraj monety za aktywność oraz mecze i odblokowuj unikalne ramki Kart UT oraz tytuły profilowe.',
        'Głos Kibiców 1X2 & System Sporów VAR (48h): typuj wyniki nadchodzących kolejek i zgłaszaj sporne mecze wraz z dowodami wideo/screenem.',
        'Tryb Urlopowy, Badge Rzetelności i Eksport Excel/Druk: zgłaszaj planowaną nieobecność w Profilu i pobieraj tabele oraz rankingi do pliku CSV lub druku.',
        'Wykres Kariery S1–S55, Gazeta Ligi & SMPL TV: sprawdzaj historyczną formę na wykresie SVG, czytaj podsumowania kolejek i udostępniaj najładniejsze gole.'
      ],
      author: 'Administracja SMPL',
      isBuiltin: true
    }
  ];

  function normalizeUpdateVersion(raw) {
    var s = String(raw || '').trim();
    if (!s) return 'V1.0';
    var cleaned = s.replace(/update/gi, '').replace(/[^0-9.]/g, '');
    var rawParts = cleaned.split('.').filter(function (x) { return x !== ''; });
    if (!rawParts.length) return 'V1.0';
    var nums = rawParts.slice(0, 3).map(function (p) {
      var n = parseInt(p, 10);
      return isNaN(n) || n < 0 ? 0 : Math.min(9999, n);
    });
    if (nums.length === 1) nums.push(0);
    return 'V' + nums.join('.');
  }

  function parseUpdateVersionParts(ver) {
    var norm = normalizeUpdateVersion(ver).replace(/^V/i, '');
    var parts = norm.split('.').map(function (p) {
      var n = parseInt(p, 10);
      return isNaN(n) ? 0 : n;
    });
    while (parts.length < 3) parts.push(0);
    return parts;
  }

  function compareUpdateVersionsDesc(a, b) {
    var pa = parseUpdateVersionParts(a && a.version);
    var pb = parseUpdateVersionParts(b && b.version);
    for (var i = 0; i < 3; i++) {
      if (pb[i] !== pa[i]) return pb[i] - pa[i];
    }
    var da = String((a && (a.createdAt || a.date)) || '');
    var db = String((b && (b.createdAt || b.date)) || '');
    if (db !== da) return db > da ? 1 : -1;
    if (a && b && Boolean(a.isBuiltin) !== Boolean(b.isBuiltin)) {
      return a.isBuiltin ? 1 : -1;
    }
    return 0;
  }

  function sanitizeUpdateCategory(rawCat) {
    var c = String(rawCat || '').toUpperCase().trim();
    if (c === 'NOWOSCI' || c === 'NOWOŚCI') return 'NOWOŚCI';
    if (c === 'ULEPSZENIA') return 'ULEPSZENIA';
    if (c === 'TURNIEJE') return 'TURNIEJE';
    if (c === 'POPRAWKI') return 'POPRAWKI';
    return 'NOWOŚCI';
  }

  function getMergedPlayerUpdates(state) {
    var list = [];
    var seenIds = {};
    var ps = state && state.portalSettings && typeof state.portalSettings === 'object' ? state.portalSettings : {};
    var dynamicUpdates = Array.isArray(ps.playerUpdates) ? ps.playerUpdates : [];

    var pushNormalized = function (item, forcedBuiltin) {
      if (!item || typeof item !== 'object') return;
      var ver = normalizeUpdateVersion(item.version);
      var id = String(item.id || ('UPD_' + ver + '_' + list.length));
      if (seenIds[id]) return;
      seenIds[id] = true;
      var rawHighlights = Array.isArray(item.highlights)
        ? item.highlights
        : String(item.highlights || '').split(/\r?\n/);
      var highlights = rawHighlights
        .map(function (line) { return String(line || '').replace(/<[^>]*>/g, '').trim(); })
        .filter(Boolean);
      list.push({
        id: id,
        version: ver,
        date: String(item.date || todayYmd()).slice(0, 20),
        createdAt: String(item.createdAt || item.date || ''),
        category: sanitizeUpdateCategory(item.category),
        title: String(item.title || ('Aktualizacja Portalu ' + ver)).replace(/<[^>]*>/g, '').trim(),
        summary: String(item.summary || '').replace(/<[^>]*>/g, '').trim(),
        highlights: highlights,
        author: String(item.author || 'Administracja SMPL').replace(/<[^>]*>/g, '').trim(),
        isBuiltin: Boolean(forcedBuiltin)
      });
    };

    for (var i = 0; i < dynamicUpdates.length; i++) {
      pushNormalized(dynamicUpdates[i], false);
    }
    for (var j = 0; j < BUILTIN_PLAYER_UPDATES.length; j++) {
      pushNormalized(BUILTIN_PLAYER_UPDATES[j], true);
    }

    list.sort(compareUpdateVersionsDesc);
    return list;
  }

  function getLatestPlayerUpdate(state) {
    var all = getMergedPlayerUpdates(state);
    return all.length ? all[0] : {
      id: 'FALLBACK_V1_0',
      version: 'V1.0',
      date: todayYmd(),
      category: 'NOWOŚCI',
      title: 'Start Sezonu 56',
      summary: '',
      highlights: [],
      author: 'Administracja SMPL',
      isBuiltin: true
    };
  }

  function getLatestPlayerUpdateVersion(state) {
    return getLatestPlayerUpdate(state).version || 'V1.0';
  }

  function getNextUpdateVersionSuggestion(state, bumpType) {
    var latest = getLatestPlayerUpdateVersion(state);
    var parts = parseUpdateVersionParts(latest);
    if (String(bumpType || '').toLowerCase() === 'major') {
      return 'V' + (parts[0] + 1) + '.0';
    }
    return 'V' + parts[0] + '.' + (parts[1] + 1);
  }

  return {
    BUILTIN_PLAYER_UPDATES: BUILTIN_PLAYER_UPDATES,
    SHOP_CATALOG: SHOP_CATALOG,
    POSTER_THEMES_MAP: POSTER_THEMES_MAP,
    WEEKLY_QUESTS_DEF: WEEKLY_QUESTS_DEF,
    BADGE_DISPLAY_MAP: BADGE_DISPLAY_MAP,
    NICKFX_CSS_MAP: NICKFX_CSS_MAP,
    computePlayerWeeklyQuests: computePlayerWeeklyQuests,
    foldName: foldName,
    todayYmd: todayYmd,
    normalizeUpdateVersion: normalizeUpdateVersion,
    compareUpdateVersionsDesc: compareUpdateVersionsDesc,
    getMergedPlayerUpdates: getMergedPlayerUpdates,
    getLatestPlayerUpdate: getLatestPlayerUpdate,
    getLatestPlayerUpdateVersion: getLatestPlayerUpdateVersion,
    getNextUpdateVersionSuggestion: getNextUpdateVersionSuggestion,
    isPlayerOnVacation: isPlayerOnVacation,
    vacationBadgeHtml: vacationBadgeHtml,
    calculateReliabilityBadge: calculateReliabilityBadge,
    reliabilityBadgeHtml: reliabilityBadgeHtml,
    calculatePlayerCoinsBreakdown: calculatePlayerCoinsBreakdown,
    getPlayerCosmetics: getPlayerCosmetics,
    calculatePlayerAchievements: calculatePlayerAchievements,
    computePlayerCareerTrajectory: computePlayerCareerTrajectory,
    renderCareerTrajectorySvg: renderCareerTrajectorySvg,
    computeHistoricalH2H: computeHistoricalH2H,
    computeAllTimeSeasonRecords: computeAllTimeSeasonRecords,
    computeWeeklyTotwCandidates: computeWeeklyTotwCandidates,
    isPlayerInCurrentTotw: isPlayerInCurrentTotw,
    buildSmplWrappedData: buildSmplWrappedData,
    buildOfflineNewsletterText: buildOfflineNewsletterText,
    detectDuplicateScreenshots: detectDuplicateScreenshots,
    buildDraftBuckets: buildDraftBuckets,
    generateStandingsPosterPng: generateStandingsPosterPng,
    generateMatchdayPosterPng: generateMatchdayPosterPng,
    generateUtCardPosterPng: generateUtCardPosterPng,
    generateWrappedPosterPng: generateWrappedPosterPng,
    dataUrlToBlob: dataUrlToBlob,
    downloadPngDataUrl: downloadPngDataUrl,
    buildCsvString: buildCsvString,
    exportStandingsCsv: exportStandingsCsv,
    exportArchiveRankingCsv: exportArchiveRankingCsv,
    exportDisciplinaryLogCsv: exportDisciplinaryLogCsv
  };
})();
