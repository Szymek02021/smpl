<?php
/**
 * ============================================================================
 * SCORE MATCH LIGA (SMPL) — JEDNORAZOWY SKRYPT NAPRAWCZY BAZY DANYCH (v52)
 * Realizuje w 100% CZĘŚĆ 1 specyfikacji naprawczej bezpośrednio w public_html/
 * ============================================================================
 *
 * BEZPIECZEŃSTWO:
 *  - Wymaga autoryzacji hasłem Master Admina (zweryfikowanym względem bazy SMPL)
 *    lub uruchomienia z linii poleceń (CLI: php napraw-baze-smpl-v52.php --apply).
 *  - Używa blokady plikowej flock(LOCK_EX) na data/.smpl-db.lock.
 *  - Przed jakąkolwiek zmianą zapisuje pełną kopię bezpieczeństwa stanu bieżącego
 *    do data/snapshots/smpl-db-before-full-repair.json.
 *  - Po zakończeniu umożliwia natychmiastowe samousunięcie pliku z serwera.
 */

@ini_set('display_errors', '0');
@ini_set('memory_limit', '256M');
@date_default_timezone_set('Europe/Warsaw');

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('X-LiteSpeed-Cache-Control: no-cache');
    header('X-Robots-Tag: noindex, nofollow');
}

$baseDir      = __DIR__;
$dataDir      = $baseDir . DIRECTORY_SEPARATOR . 'data';
$snapshotsDir = $dataDir . DIRECTORY_SEPARATOR . 'snapshots';
$dbFile       = $dataDir . DIRECTORY_SEPARATOR . 'smpl-db.json';
$backupFile   = $dataDir . DIRECTORY_SEPARATOR . 'smpl-db.backup.json';
$snap16File   = $snapshotsDir . DIRECTORY_SEPARATOR . 'smpl-db-2026-11-16.json';
$snap17File   = $snapshotsDir . DIRECTORY_SEPARATOR . 'smpl-db-2026-11-17.json';
$beforeFile   = $snapshotsDir . DIRECTORY_SEPARATOR . 'smpl-db-before-full-repair.json';
$obsoleteZip  = $baseDir . DIRECTORY_SEPARATOR . 'PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip';

// ----------------------------------------------------------------------------
// Funkcje kryptograficzne zgodne 1:1 z api.php (smplh1$)
// ----------------------------------------------------------------------------
function smpl_rep_i32($v) {
    $v = $v & 0xffffffff;
    if ($v >= 0x80000000) {
        $v -= 0x100000000;
    }
    return $v;
}

function smpl_rep_u32($v) {
    return $v & 0xffffffff;
}

function smpl_rep_hash_secret($plain) {
    $str = 'SMPL-S56-AUTH::' . trim((string)($plain === null ? '' : $plain));
    if (function_exists('mb_convert_encoding')) {
        $utf16 = mb_convert_encoding($str, 'UTF-16LE', 'UTF-8');
    } else {
        $utf16 = '';
        $lenBytes = strlen($str);
        for ($k = 0; $k < $lenBytes; $k++) {
            $utf16 .= $str[$k] . "\x00";
        }
    }
    $units = array();
    $byteLen = strlen($utf16);
    for ($k = 0; $k + 1 < $byteLen; $k += 2) {
        $units[] = ord($utf16[$k]) | (ord($utf16[$k + 1]) << 8);
    }
    $h1 = smpl_rep_i32(0x811c9dc5);
    $h2 = smpl_rep_i32(0x9e3779b9);
    $n = count($units);
    for ($round = 0; $round < 3; $round++) {
        for ($i = 0; $i < $n; $i++) {
            $ch = $units[$i];
            $h1 = smpl_rep_i32($h1 ^ $ch ^ $round);
            $h1 = smpl_rep_i32(
                $h1 +
                smpl_rep_i32($h1 << 1) +
                smpl_rep_i32($h1 << 4) +
                smpl_rep_i32($h1 << 7) +
                smpl_rep_i32($h1 << 8) +
                smpl_rep_i32($h1 << 24)
            );
            $h2 = smpl_rep_i32($h2 ^ (($ch + $i) * 31));
            $u2 = smpl_rep_u32($h2);
            $rot = smpl_rep_i32(smpl_rep_i32($u2 << 7) | (($u2 >> 25) & 0x7f));
            $h2 = smpl_rep_i32($rot ^ $h1);
        }
    }
    $p1 = str_pad(dechex(smpl_rep_u32($h1)), 8, '0', STR_PAD_LEFT);
    $p2 = str_pad(dechex(smpl_rep_u32($h2)), 8, '0', STR_PAD_LEFT);
    return 'smplh1$' . $p1 . $p2;
}

function smpl_rep_verify_secret($record, $plainInput) {
    $clean = trim((string)($plainInput === null ? '' : $plainInput));
    if ($clean === '' || !is_array($record)) {
        return false;
    }
    if (!empty($record['passwordHash'])) {
        $stored = (string)$record['passwordHash'];
        if (strpos($stored, 'smplh1$') === 0) {
            return hash_equals($stored, smpl_rep_hash_secret($clean));
        }
        return hash_equals($stored, $clean);
    }
    if (!empty($record['password'])) {
        return hash_equals((string)$record['password'], $clean);
    }
    return false;
}

function smpl_rep_fold($str) {
    $s = trim((string)($str === null ? '' : $str));
    if (function_exists('mb_strtolower')) {
        $s = mb_strtolower($s, 'UTF-8');
    } else {
        $s = strtolower($s);
    }
    return strtr($s, array(
        'ą' => 'a', 'ć' => 'c', 'ę' => 'e', 'ł' => 'l',
        'ń' => 'n', 'ó' => 'o', 'ś' => 's', 'ź' => 'z', 'ż' => 'z'
    ));
}

function smpl_rep_read_json($path) {
    if (!file_exists($path)) {
        return array(null, null);
    }
    $raw = @file_get_contents($path);
    if ($raw === false || strlen($raw) < 20) {
        return array(null, null);
    }
    $dec = @json_decode($raw, true);
    if (!is_array($dec)) {
        return array(null, $raw);
    }
    return array($dec, $raw);
}

function smpl_rep_authenticate_master($password, $db, $snap16) {
    $clean = trim((string)$password);
    if ($clean === '') {
        return null;
    }
    $sources = array($db, $snap16);
    foreach ($sources as $src) {
        if (!is_array($src) || empty($src['admins']) || !is_array($src['admins'])) {
            continue;
        }
        foreach ($src['admins'] as $adm) {
            if (!is_array($adm)) continue;
            $role = isset($adm['role']) ? strtoupper((string)$adm['role']) : '';
            $status = isset($adm['status']) ? strtoupper((string)$adm['status']) : 'APPROVED';
            if ($role === 'MASTER_ADMIN' && $status !== 'REVOKED' && smpl_rep_verify_secret($adm, $clean)) {
                return $adm;
            }
        }
    }
    return null;
}

function smpl_rep_find_player($players, $targetId, $targetUser, $targetNick, $targetName) {
    $uFold = smpl_rep_fold($targetUser);
    $nFold = smpl_rep_fold($targetNick);
    $nameFold = smpl_rep_fold($targetName);
    foreach ($players as $idx => $p) {
        if (!is_array($p)) continue;
        $pid = isset($p['id']) ? (string)$p['id'] : '';
        $pu  = isset($p['username']) ? smpl_rep_fold($p['username']) : '';
        $pn  = isset($p['nick']) ? smpl_rep_fold($p['nick']) : '';
        $pnm = isset($p['name']) ? smpl_rep_fold($p['name']) : '';
        if ($targetId !== '' && $pid === $targetId) {
            return array($idx, $p);
        }
        if ($uFold !== '' && $pu === $uFold) {
            return array($idx, $p);
        }
        if ($nFold !== '' && $pn === $nFold) {
            return array($idx, $p);
        }
        if ($nameFold !== '' && $pnm === $nameFold) {
            return array($idx, $p);
        }
    }
    return array(-1, null);
}

/**
 * Główna procedura naprawcza realizująca Część 1 (kroki 1–8)
 */
function smpl_execute_full_repair($paths, $dryRun = false) {
    $report = array(
        'ok' => false,
        'dryRun' => (bool)$dryRun,
        'errors' => array(),
        'steps' => array(),
        'playersSummary' => array(),
        'registrationsSummary' => array(),
        'cleanedProposals' => 0,
        'cleanedFanPolls' => 0,
        'preservedCounts' => array(),
        'writtenFiles' => array(),
        'deletedObsoleteZip' => false,
        'maintenanceMode' => null,
        'updatedAt' => null
    );

    if (!is_dir($paths['snapshotsDir'])) {
        @mkdir($paths['snapshotsDir'], 0775, true);
    }

    // Blokada plikowa .smpl-db.lock
    $lockFp = null;
    if (!$dryRun) {
        $lockPath = $paths['dataDir'] . DIRECTORY_SEPARATOR . '.smpl-db.lock';
        $lockFp = @fopen($lockPath, 'c+');
        if ($lockFp) {
            @flock($lockFp, LOCK_EX);
        }
    }

    try {
        // KROK 1: Wczytanie bieżącej bazy i snapshotu 2026-11-16
        list($db, $rawDb) = smpl_rep_read_json($paths['dbFile']);
        if (!is_array($db)) {
            list($db, $rawDb) = smpl_rep_read_json($paths['backupFile']);
        }
        if (!is_array($db)) {
            $report['errors'][] = 'Nie udało się odczytać prawidłowego JSON z data/smpl-db.json ani data/smpl-db.backup.json.';
            return $report;
        }

        $snap16Path = $paths['snap16File'];
        if (!file_exists($snap16Path)) {
            $altSnaps = glob($paths['snapshotsDir'] . DIRECTORY_SEPARATOR . 'smpl-db-2026-11-16*.json');
            if (is_array($altSnaps) && count($altSnaps) > 0) {
                $snap16Path = $altSnaps[0];
            }
        }
        list($snap16, $rawSnap16) = smpl_rep_read_json($snap16Path);
        if (!is_array($snap16)) {
            $report['errors'][] = 'Brak pliku snapshotu data/snapshots/smpl-db-2026-11-16.json (wymaganego do odzyskania 4 kont i 6 trofeów Master Admina).';
            return $report;
        }
        $report['steps'][] = 'Wczytano data/smpl-db.json oraz ' . basename($snap16Path) . '.';

        // KROK 2: Kopia bezpieczeństwa przed naprawą
        if (!$dryRun && $rawDb !== null) {
            $targetBefore = $paths['beforeFile'];
            if (file_exists($targetBefore)) {
                // Zachowaj oryginalny plik before-full-repair i utwórz dodatkową kopię z godziną
                $extraBefore = $paths['snapshotsDir'] . DIRECTORY_SEPARATOR . 'smpl-db-before-full-repair-' . date('His') . '.json';
                @file_put_contents($extraBefore, $rawDb, LOCK_EX);
                $report['writtenFiles'][] = 'data/snapshots/' . basename($extraBefore);
                $report['steps'][] = 'Kopia przed naprawą już istniała — zachowano oryginał i zapisano dodatkową kopię ' . basename($extraBefore) . '.';
            } else {
                if (@file_put_contents($targetBefore, $rawDb, LOCK_EX) === false) {
                    $report['errors'][] = 'Nie udało się zapisać kopii bezpieczeństwa data/snapshots/smpl-db-before-full-repair.json (sprawdź uprawnienia CHMOD katalogu data/snapshots).';
                    return $report;
                }
                $report['writtenFiles'][] = 'data/snapshots/smpl-db-before-full-repair.json';
                $report['steps'][] = 'Zapisano kopię bezpieczeństwa stanu przed naprawą do data/snapshots/smpl-db-before-full-repair.json.';
            }
        } else {
            $report['steps'][] = '[PODGLĄD] Zapisze kopię bezpieczeństwa do data/snapshots/smpl-db-before-full-repair.json.';
        }

        // KROK 3: Wyłączenie Przerwy Technicznej
        if (!isset($db['portalSettings']) || !is_array($db['portalSettings'])) {
            $db['portalSettings'] = array();
        }
        if (!isset($db['portalSettings']['maintenanceMode']) || !is_array($db['portalSettings']['maintenanceMode'])) {
            $db['portalSettings']['maintenanceMode'] = array();
        }
        $db['portalSettings']['maintenanceMode']['enabled']   = false;
        $db['portalSettings']['maintenanceMode']['updatedBy'] = 'Szymon Komenda';
        $db['portalSettings']['maintenanceMode']['updatedAt'] = date('Y-m-d H:i');
        if (!isset($db['portalSettings']['maintenanceMode']['message'])) {
            $db['portalSettings']['maintenanceMode']['message'] = '';
        }
        $report['maintenanceMode'] = $db['portalSettings']['maintenanceMode'];
        $report['steps'][] = 'Wyłączono Przerwę Techniczną (portalSettings.maintenanceMode.enabled = false).';

        // Przygotowanie tablicy players
        if (!isset($db['players']) || !is_array($db['players'])) {
            $db['players'] = array();
        }
        $snapPlayers = (isset($snap16['players']) && is_array($snap16['players'])) ? $snap16['players'] : array();

        // Pola oryginalne do bezwzględnego odtworzenia ze snapshotu 2026-11-16
        $originalFields = array(
            'id', 'name', 'nick', 'username', 'passwordHash', 'fb', 'fbLink',
            'avatar', 'bio', 'clanId', 'clanName', 'clanTag', 'clanLogo',
            'customRank', 'extraCustomRanks', 'trophies', 'notifications',
            'playedBefore', 'historicalArchiveName', 'historicalStats'
        );

        // KROK 4: Przywrócenie wszystkich 4 usuniętych kont graczy
        $restoreSpecs = array(
            array(
                'id' => 'L2_P_4886',
                'name' => 'Krystian Bujak',
                'nick' => 'Dexter Morgan',
                'username' => 'krystian.bujak',
                'leagueId' => 'L2',
                'active' => true,
                'extra' => array()
            ),
            array(
                'id' => 'L2_P_8815',
                'name' => 'Grzegorz Grzegorzyca',
                'nick' => 'GG YCA RTR',
                'username' => 'grzegorz.grzegorzyca',
                'leagueId' => 'L2',
                'active' => true,
                'extra' => array()
            ),
            array(
                'id' => 'L1_P_1915',
                'name' => 'Kacper Kurczewski',
                'nick' => 'ASNODT',
                'username' => 'kacper.kurczewski',
                'leagueId' => 'L1',
                'active' => true,
                'extra' => array(
                    'isAdminPlayer' => true,
                    'adminId' => 'ADM_DIRECT_1794833671841',
                    'adminRole' => 'CO_ADMIN'
                )
            ),
            array(
                'id' => 'L1_P_9736',
                'name' => 'Adrian Baliński',
                'nick' => 'Craciun',
                'username' => 'adrian.balinski',
                'leagueId' => 'L2',
                'active' => true,
                'extra' => array()
            )
        );

        foreach ($restoreSpecs as $spec) {
            list($snapIdx, $snapP) = smpl_rep_find_player($snapPlayers, $spec['id'], $spec['username'], $spec['nick'], $spec['name']);
            list($curIdx, $curP)   = smpl_rep_find_player($db['players'], $spec['id'], $spec['username'], $spec['nick'], $spec['name']);

            if (!is_array($snapP) && !is_array($curP)) {
                $report['errors'][] = 'Nie znaleziono gracza ' . $spec['name'] . ' (' . $spec['id'] . ') w snapshocie 2026-11-16 ani w bieżącej bazie.';
                continue;
            }

            // Bazujemy na pełnym obiekcie ze snapshotu, zachowując ewentualne nowsze pola z bieżącej bazy
            $merged = is_array($snapP) ? $snapP : $curP;
            if (is_array($curP) && is_array($snapP)) {
                // Zachowaj wszystkie oryginalne pola ze snapshotu jeśli brakuje ich w bieżącym obiekcie
                foreach ($originalFields as $field) {
                    if (array_key_exists($field, $snapP) && $snapP[$field] !== null && $snapP[$field] !== '' && $snapP[$field] !== array()) {
                        $merged[$field] = $snapP[$field];
                    } elseif (array_key_exists($field, $curP)) {
                        $merged[$field] = $curP[$field];
                    }
                }
            }

            // Wymuś docelowe wymagane identyfikatory i status ligowy
            $merged['id']           = $spec['id'];
            $merged['name']         = $spec['name'];
            $merged['nick']         = $spec['nick'];
            $merged['username']     = $spec['username'];
            $merged['leagueId']     = $spec['leagueId'];
            $merged['active']       = true;
            $merged['leftLeagueAt'] = null;
            $merged['gdprDeleted']  = false;
            foreach ($spec['extra'] as $ek => $ev) {
                $merged[$ek] = $ev;
            }

            // Usuń ewentualne duplikaty tego gracza w bieżącej tablicy players
            $newPlayers = array();
            $inserted = false;
            foreach ($db['players'] as $existing) {
                if (!is_array($existing)) continue;
                $same = (
                    (isset($existing['id']) && (string)$existing['id'] === $spec['id']) ||
                    (isset($existing['username']) && smpl_rep_fold($existing['username']) === smpl_rep_fold($spec['username'])) ||
                    (isset($existing['nick']) && smpl_rep_fold($existing['nick']) === smpl_rep_fold($spec['nick']))
                );
                if ($same) {
                    if (!$inserted) {
                        $newPlayers[] = $merged;
                        $inserted = true;
                    }
                } else {
                    $newPlayers[] = $existing;
                }
            }
            if (!$inserted) {
                $newPlayers[] = $merged;
            }
            $db['players'] = $newPlayers;
            $report['steps'][] = 'Przywrócono konto: ' . $merged['name'] . ' (' . $merged['id'] . ', ' . $merged['leagueId'] . ').';
        }

        // KROK 5: Przywrócenie pełnego profilu zawodniczego Master Admina (Szymon Komenda)
        $masterTargetId = 'PLR_ADM_ADM_MASTER_1794586150119';
        list($snapMasterIdx, $snapMaster) = smpl_rep_find_player($snapPlayers, $masterTargetId, 'szymon.komenda', '', 'Szymon Komenda');
        list($curMasterIdx, $curMaster)   = smpl_rep_find_player($db['players'], $masterTargetId, 'szymon.komenda', '', 'Szymon Komenda');

        if (!is_array($snapMaster) && !is_array($curMaster)) {
            $report['errors'][] = 'Nie znaleziono profilu zawodniczego Master Admina (Szymon Komenda) w snapshocie 2026-11-16 ani w bieżącej bazie.';
        } else {
            $masterMerged = is_array($snapMaster) ? $snapMaster : $curMaster;
            // Zachowaj aktualny passwordHash z bieżącego profilu (lub z rekordu admins)
            $currentPwHash = '';
            if (is_array($curMaster) && !empty($curMaster['passwordHash'])) {
                $currentPwHash = (string)$curMaster['passwordHash'];
            } elseif (!empty($db['admins']) && is_array($db['admins'])) {
                foreach ($db['admins'] as $adm) {
                    if (is_array($adm) && isset($adm['role']) && strtoupper((string)$adm['role']) === 'MASTER_ADMIN' && !empty($adm['passwordHash'])) {
                        $currentPwHash = (string)$adm['passwordHash'];
                        break;
                    }
                }
            }
            if ($currentPwHash !== '') {
                $masterMerged['passwordHash'] = $currentPwHash;
            }
            // Zachowaj aktualne avatar/bio jeśli puste w snapshocie
            if (is_array($curMaster)) {
                foreach (array('avatar', 'bio', 'fb', 'fbLink') as $optF) {
                    if (empty($masterMerged[$optF]) && !empty($curMaster[$optF])) {
                        $masterMerged[$optF] = $curMaster[$optF];
                    }
                }
            }

            // Wymuś przywrócone pola ze snapshotu 2026-11-16
            $masterMerged['id']                    = $masterTargetId;
            $masterMerged['username']              = 'szymon.komenda';
            $masterMerged['leagueId']              = 'L1';
            $masterMerged['active']                = true;
            $masterMerged['leftLeagueAt']          = null;
            $masterMerged['gdprDeleted']           = false;
            $masterMerged['playedBefore']          = true;
            $masterMerged['historicalArchiveName'] = 'Szymek Komenda';
            $masterMerged['isAdminPlayer']         = true;
            if (empty($masterMerged['adminRole'])) {
                $masterMerged['adminRole'] = 'MASTER_ADMIN';
            }
            if (is_array($snapMaster)) {
                if (!empty($snapMaster['trophies']) && is_array($snapMaster['trophies'])) {
                    $masterMerged['trophies'] = $snapMaster['trophies'];
                }
                if (!empty($snapMaster['historicalStats']) && is_array($snapMaster['historicalStats'])) {
                    $masterMerged['historicalStats'] = $snapMaster['historicalStats'];
                }
            }

            // Podmień profil Szymona i usuń ewentualny duplikat pod nowym/tymczasowym ID
            $newPlayers2 = array();
            $masterPlaced = false;
            foreach ($db['players'] as $existing) {
                if (!is_array($existing)) continue;
                $isSzymon = (
                    (isset($existing['id']) && (string)$existing['id'] === $masterTargetId) ||
                    (isset($existing['username']) && smpl_rep_fold($existing['username']) === 'szymon.komenda') ||
                    (isset($existing['name']) && smpl_rep_fold($existing['name']) === 'szymon komenda')
                );
                if ($isSzymon) {
                    if (!$masterPlaced) {
                        $newPlayers2[] = $masterMerged;
                        $masterPlaced = true;
                    }
                } else {
                    $newPlayers2[] = $existing;
                }
            }
            if (!$masterPlaced) {
                array_unshift($newPlayers2, $masterMerged);
            }
            $db['players'] = $newPlayers2;
            $trophyCnt = (isset($masterMerged['trophies']) && is_array($masterMerged['trophies'])) ? count($masterMerged['trophies']) : 0;
            $report['steps'][] = 'Przywrócono pełny profil Master Admina: Szymon Komenda (' . $masterTargetId . ', L1, puchary: ' . $trophyCnt . ', archiwum: Szymek Komenda).';
        }

        // KROK 6a: Synchronizacja tablicy registrations z aktualnymi graczami
        if (!isset($db['registrations']) || !is_array($db['registrations'])) {
            $db['registrations'] = array();
        }
        $syncedRegs = 0;
        foreach ($db['registrations'] as $rIdx => $reg) {
            if (!is_array($reg)) continue;
            $regPid  = isset($reg['assignedPlayerId']) ? (string)$reg['assignedPlayerId'] : '';
            $regUser = isset($reg['username']) ? (string)$reg['username'] : '';
            $regNick = isset($reg['nick']) ? (string)$reg['nick'] : '';
            $regName = isset($reg['name']) ? (string)$reg['name'] : '';
            list($pIdx, $matchedP) = smpl_rep_find_player($db['players'], $regPid, $regUser, $regNick, $regName);
            if (is_array($matchedP)) {
                $db['registrations'][$rIdx]['status']           = 'ASSIGNED';
                $db['registrations'][$rIdx]['assignedLeague']   = isset($matchedP['leagueId']) ? (string)$matchedP['leagueId'] : 'L1';
                $db['registrations'][$rIdx]['assignedPlayerId'] = (string)$matchedP['id'];
                $syncedRegs++;
                $report['registrationsSummary'][] = array(
                    'name' => isset($reg['name']) ? (string)$reg['name'] : $matchedP['name'],
                    'status' => 'ASSIGNED',
                    'assignedLeague' => $db['registrations'][$rIdx]['assignedLeague'],
                    'assignedPlayerId' => $db['registrations'][$rIdx]['assignedPlayerId']
                );
            }
        }
        $report['steps'][] = 'Zsynchronizowano zgłoszenia w registrations (' . $syncedRegs . ' wpisów ustawiono na status ASSIGNED).';

        // KROK 6b: Czyszczenie osieroconych referencji M_L3_... w competitions.matchProposals i fanPolls
        $existingMatchIds = array();
        if (isset($db['matches']) && is_array($db['matches'])) {
            foreach ($db['matches'] as $m) {
                if (is_array($m) && !empty($m['id'])) {
                    $existingMatchIds[(string)$m['id']] = true;
                }
            }
        }

        if (isset($db['competitions']) && is_array($db['competitions'])) {
            // matchProposals (tablica obiektów)
            if (isset($db['competitions']['matchProposals']) && is_array($db['competitions']['matchProposals'])) {
                $cleanProps = array();
                foreach ($db['competitions']['matchProposals'] as $prop) {
                    if (!is_array($prop)) continue;
                    $mid = isset($prop['matchId']) ? (string)$prop['matchId'] : '';
                    $lid = isset($prop['leagueId']) ? (string)$prop['leagueId'] : '';
                    $isOrphanL3 = (
                        (strpos($mid, 'M_L3_') !== false && !isset($existingMatchIds[$mid])) ||
                        ($lid === 'L3' && $mid !== '' && !isset($existingMatchIds[$mid]))
                    );
                    if ($isOrphanL3) {
                        $report['cleanedProposals']++;
                        continue;
                    }
                    $cleanProps[] = $prop;
                }
                $db['competitions']['matchProposals'] = $cleanProps;
            }

            // fanPolls (mapa obiektowa matchId => {...} lub tablica)
            if (isset($db['competitions']['fanPolls']) && is_array($db['competitions']['fanPolls'])) {
                $cleanPolls = array();
                foreach ($db['competitions']['fanPolls'] as $k => $v) {
                    $kStr = (string)$k;
                    $vMid = (is_array($v) && isset($v['matchId'])) ? (string)$v['matchId'] : '';
                    $isOrphanKey = (strpos($kStr, 'M_L3_') !== false && !isset($existingMatchIds[$kStr]));
                    $isOrphanVal = ($vMid !== '' && strpos($vMid, 'M_L3_') !== false && !isset($existingMatchIds[$vMid]));
                    if ($isOrphanKey || $isOrphanVal) {
                        $report['cleanedFanPolls']++;
                        continue;
                    }
                    $cleanPolls[$k] = $v;
                }
                // Zachowaj typ obiektu JSON {} gdy mapa fanPolls jest pusta
                $db['competitions']['fanPolls'] = (count($cleanPolls) === 0) ? new stdClass() : $cleanPolls;
            }
        }
        $report['steps'][] = 'Wyczyszczono osierocone referencje M_L3_: matchProposals (-' . $report['cleanedProposals'] . '), fanPolls (-' . $report['cleanedFanPolls'] . ').';

        // KROK 7: Zachowanie bieżących kolekcji, deduplikacja ciężkich awatarów base64 w DM/chat (4x mniejsza baza), podbicie updatedAt i zapis do 4 lokalizacji
        if (isset($db['directMessages']) && is_array($db['directMessages'])) {
            foreach ($db['directMessages'] as $dmIdx => $dmItem) {
                if (!is_array($dmItem)) continue;
                if (!empty($dmItem['senderAvatar']) && is_string($dmItem['senderAvatar']) && strlen($dmItem['senderAvatar']) > 512 && strpos($dmItem['senderAvatar'], 'data:image/') === 0) {
                    $db['directMessages'][$dmIdx]['senderAvatar'] = '';
                }
                if (!empty($dmItem['recipientAvatar']) && is_string($dmItem['recipientAvatar']) && strlen($dmItem['recipientAvatar']) > 512 && strpos($dmItem['recipientAvatar'], 'data:image/') === 0) {
                    $db['directMessages'][$dmIdx]['recipientAvatar'] = '';
                }
            }
        }
        if (isset($db['chatMessages']) && is_array($db['chatMessages'])) {
            foreach ($db['chatMessages'] as $cmIdx => $cmItem) {
                if (!is_array($cmItem)) continue;
                if (!empty($cmItem['senderAvatar']) && is_string($cmItem['senderAvatar']) && strlen($cmItem['senderAvatar']) > 512 && strpos($cmItem['senderAvatar'], 'data:image/') === 0) {
                    $db['chatMessages'][$cmIdx]['senderAvatar'] = '';
                }
            }
        }
        $nowMs = (int)round(microtime(true) * 1000);
        $db['updatedAt'] = $nowMs;
        $report['updatedAt'] = $nowMs;

        // Zbierz statystyki zachowanych kolekcji
        $report['preservedCounts'] = array(
            'players'        => count($db['players']),
            'registrations'  => count($db['registrations']),
            'directMessages' => (isset($db['directMessages']) && is_array($db['directMessages'])) ? count($db['directMessages']) : 0,
            'logs'           => (isset($db['logs']) && is_array($db['logs'])) ? count($db['logs']) : 0,
            'activityLog'    => (isset($db['activityLog']) && is_array($db['activityLog'])) ? count($db['activityLog']) : 0,
            'admins'         => (isset($db['admins']) && is_array($db['admins'])) ? count($db['admins']) : 0,
            'clans'          => (isset($db['clans']) && is_array($db['clans'])) ? count($db['clans']) : 0,
            'customRanks'    => (isset($db['customRanks']) && is_array($db['customRanks'])) ? count($db['customRanks']) : 0
        );

        foreach ($db['players'] as $p) {
            if (!is_array($p)) continue;
            $hs = (isset($p['historicalStats']) && is_array($p['historicalStats'])) ? $p['historicalStats'] : array();
            $report['playersSummary'][] = array(
                'id'            => isset($p['id']) ? (string)$p['id'] : '',
                'name'          => isset($p['name']) ? (string)$p['name'] : '',
                'nick'          => isset($p['nick']) ? (string)$p['nick'] : '',
                'username'      => isset($p['username']) ? (string)$p['username'] : '',
                'leagueId'      => isset($p['leagueId']) ? (string)$p['leagueId'] : '',
                'active'        => !empty($p['active']),
                'adminRole'     => isset($p['adminRole']) ? (string)$p['adminRole'] : '',
                'trophiesCount' => (isset($p['trophies']) && is_array($p['trophies'])) ? count($p['trophies']) : 0,
                'seasons'       => isset($hs['seasons']) ? (int)$hs['seasons'] : (isset($hs['seasonsPlayed']) ? (int)$hs['seasonsPlayed'] : 0),
                'matches'       => isset($hs['matches']) ? (int)$hs['matches'] : (isset($hs['M']) ? (int)$hs['M'] : 0),
                'points'        => isset($hs['points']) ? (int)$hs['points'] : (isset($hs['PKT']) ? (int)$hs['PKT'] : 0),
                'archiveName'   => isset($p['historicalArchiveName']) ? (string)$p['historicalArchiveName'] : ''
            );
        }

        $encoded = json_encode($db, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false || strlen($encoded) < 100) {
            $report['errors'][] = 'Błąd serializacji naprawionej bazy do JSON.';
            return $report;
        }

        $todaySnapFile = $paths['snapshotsDir'] . DIRECTORY_SEPARATOR . 'smpl-db-' . date('Y-m-d') . '.json';
        $targets = array(
            'data/smpl-db.json'                           => $paths['dbFile'],
            'data/smpl-db.backup.json'                    => $paths['backupFile'],
            'data/snapshots/smpl-db-2026-11-17.json'      => $paths['snap17File'],
            'data/snapshots/' . basename($todaySnapFile)  => $todaySnapFile
        );

        if (!$dryRun) {
            foreach ($targets as $label => $fullPath) {
                $okW = @file_put_contents($fullPath, $encoded, LOCK_EX);
                if ($okW === false) {
                    $report['errors'][] = 'Nie udało się zapisać pliku: ' . $label;
                    return $report;
                }
                if (!in_array($label, $report['writtenFiles'], true)) {
                    $report['writtenFiles'][] = $label;
                }
            }
            $report['steps'][] = 'Zapisano naprawioną bazę do smpl-db.json, smpl-db.backup.json, smpl-db-2026-11-17.json oraz ' . basename($todaySnapFile) . '.';

            // KROK 8: Usunięcie zbędnego archiwalnego archiwum ZIP z public_html/
            if (file_exists($paths['obsoleteZip'])) {
                if (@unlink($paths['obsoleteZip'])) {
                    $report['deletedObsoleteZip'] = true;
                    $report['steps'][] = 'Usunięto zbędny plik archiwalny PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip.';
                } else {
                    $report['steps'][] = 'Uwaga: nie udało się usunąć PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip (usuń ręcznie z FTP/Menadżera Plików).';
                }
            } else {
                $report['steps'][] = 'Plik PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip nie istniał w public_html/ (czysto).';
            }
        } else {
            $report['steps'][] = '[PODGLĄD] Gotowe do zapisu w 4 lokalizacjach (smpl-db.json, backup, 2026-11-17, ' . basename($todaySnapFile) . ').';
            if (file_exists($paths['obsoleteZip'])) {
                $report['steps'][] = '[PODGLĄD] Zostanie usunięty zbędny plik PACZKA-NA-SERWER-SCORE-MATCH-LIGA.zip.';
            }
        }

        $report['ok'] = (count($report['errors']) === 0);
        return $report;
    } finally {
        if ($lockFp) {
            @flock($lockFp, LOCK_UN);
            @fclose($lockFp);
        }
    }
}

$paths = array(
    'dataDir'      => $dataDir,
    'snapshotsDir' => $snapshotsDir,
    'dbFile'       => $dbFile,
    'backupFile'   => $backupFile,
    'snap16File'   => $snap16File,
    'snap17File'   => $snap17File,
    'beforeFile'   => $beforeFile,
    'obsoleteZip'  => $obsoleteZip
);

// ----------------------------------------------------------------------------
// Tryb CLI (np. php napraw-baze-smpl-v52.php --dry-run lub --apply)
// ----------------------------------------------------------------------------
if ($isCli) {
    $args = isset($argv) && is_array($argv) ? $argv : array();
    $apply = in_array('--apply', $args, true);
    $res = smpl_execute_full_repair($paths, !$apply);
    echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit($res['ok'] ? 0 : 1);
}

// ----------------------------------------------------------------------------
// Tryb WWW (Formularz chroniony hasłem Master Admina)
// ----------------------------------------------------------------------------
$authError = '';
$resultReport = null;
$selfDeleted = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = isset($_POST['master_password']) ? (string)$_POST['master_password'] : '';
    $mode     = isset($_POST['mode']) ? (string)$_POST['mode'] : 'dry_run';
    $autoDel  = !empty($_POST['auto_delete']);

    list($curDbAuth, )  = smpl_rep_read_json($dbFile);
    list($snap16Auth, ) = smpl_rep_read_json($snap16File);
    $masterAdmin = smpl_rep_authenticate_master($password, $curDbAuth, $snap16Auth);

    if (!is_array($masterAdmin)) {
        $authError = 'Nieprawidłowe hasło Master Admina. Wpisz hasło konta Szymon Komenda z portalu SMPL.';
    } else {
        if ($mode === 'self_delete') {
            $selfDeleted = @unlink(__FILE__);
            if (!$selfDeleted) {
                $authError = 'Nie udało się usunąć pliku automatycznie — usuń napraw-baze-smpl-v52.php ręcznie z Menadżera Plików.';
            }
        } else {
            $isDry = ($mode !== 'apply');
            $resultReport = smpl_execute_full_repair($paths, $isDry);
            if (!$isDry && $resultReport['ok'] && $autoDel) {
                $selfDeleted = @unlink(__FILE__);
            }
        }
    }
}

function h($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SMPL v52 — Naprawa i Scalenie Bazy Danych</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px 16px; min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at top, #1e293b 0%, #030712 70%);
      color: #f8fafc;
    }
    .wrap { max-width: 860px; margin: 0 auto; }
    .card {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(251, 191, 36, 0.35);
      border-radius: 20px; padding: 24px; margin-bottom: 18px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
    }
    h1 { margin: 0 0 8px; font-size: 22px; color: #fbbf24; }
    h2 { margin: 0 0 12px; font-size: 16px; color: #34d399; }
    p, li { color: #cbd5e1; font-size: 14px; line-height: 1.55; }
    .badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
      background: rgba(251, 191, 36, 0.16); color: #fcd34d; border: 1px solid rgba(251, 191, 36, 0.4);
      margin-bottom: 10px;
    }
    .alert-err {
      background: rgba(244, 63, 94, 0.18); border: 1px solid rgba(244, 63, 94, 0.5);
      color: #fecdd3; padding: 12px 14px; border-radius: 12px; margin-bottom: 14px; font-weight: 600;
    }
    .alert-ok {
      background: rgba(16, 185, 129, 0.16); border: 1px solid rgba(16, 185, 129, 0.45);
      color: #a7f3d0; padding: 12px 14px; border-radius: 12px; margin-bottom: 14px; font-weight: 600;
    }
    label.fld { display: block; font-size: 12px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px; text-transform: uppercase; }
    input[type="password"] {
      width: 100%; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);
      background: #020617; color: #fff; font-size: 15px; margin-bottom: 14px;
    }
    .chk { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 13px; color: #e2e8f0; cursor: pointer; }
    .btns { display: flex; flex-wrap: wrap; gap: 10px; }
    button {
      border: 0; border-radius: 12px; padding: 12px 18px; font-weight: 800; font-size: 13px;
      cursor: pointer; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .btn-primary { background: linear-gradient(135deg, #f59e0b, #fbbf24); color: #020617; }
    .btn-secondary { background: #1e293b; color: #e2e8f0; border: 1px solid rgba(255,255,255,0.2); }
    .btn-danger { background: #e11d48; color: #fff; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; }
    th { color: #94a3b8; font-size: 11px; text-transform: uppercase; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 14px 0; }
    .stat-box { background: rgba(2,6,23,0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px 12px; }
    .stat-box .k { font-size: 11px; color: #94a3b8; text-transform: uppercase; }
    .stat-box .v { font-size: 18px; font-weight: 800; color: #fbbf24; margin-top: 2px; }
    a.back { display: inline-block; margin-top: 12px; color: #38bdf8; font-weight: 700; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="badge">🛠️ Score Match Liga • Pakiet Naprawczy v52 (Część 1)</div>
      <h1>Bezpośrednia Naprawa i Scalenie Bazy Danych SMPL</h1>
      <p>
        Skrypt łączy bieżącą bazę <code>data/smpl-db.json</code> ze snapshotem <code>data/snapshots/smpl-db-2026-11-16.json</code>:
        wyłącza Przerwę Techniczną, odtwarza 4 usunięte konta graczy oraz pełny profil Szymona Komendy (6 pucharów + S1–S55),
        synchronizuje <code>registrations</code>, czyści osierocone wpisy <code>M_L3_...</code> i zachowuje wszystkie wiadomości (<code>directMessages</code>),
        logi, adminów, klany oraz rangi.
      </p>

      <?php if ($authError !== ''): ?>
        <div class="alert-err">❌ <?php echo h($authError); ?></div>
      <?php endif; ?>

      <?php if ($selfDeleted): ?>
        <div class="alert-ok">
          ✅ Skrypt <code>napraw-baze-smpl-v52.php</code> został bezpiecznie usunięty z serwera!
        </div>
      <?php endif; ?>

      <?php if (!$selfDeleted): ?>
        <form method="post" autocomplete="off">
          <label class="fld" for="master_password">🔐 Hasło Master Admina (Szymon Komenda)</label>
          <input type="password" id="master_password" name="master_password" placeholder="Wpisz hasło Master Admina..." required />
          <label class="chk">
            <input type="checkbox" name="auto_delete" value="1" checked />
            <span>🗑️ Automatycznie usuń ten skrypt z serwera natychmiast po udanej naprawie (zalecane)</span>
          </label>
          <div class="btns">
            <button type="submit" name="mode" value="apply" class="btn-primary">⚡ Wykonaj Pełną Naprawę Bazy</button>
            <button type="submit" name="mode" value="dry_run" class="btn-secondary">🔍 Podgląd (Dry Run — bez zapisu)</button>
            <button type="submit" name="mode" value="self_delete" class="btn-danger">🗑️ Usuń ten skrypt z serwera</button>
          </div>
        </form>
      <?php endif; ?>

      <a class="back" href="/index.html">← Powrót do Portalu Score Match Liga</a>
    </div>

    <?php if (is_array($resultReport)): ?>
      <div class="card">
        <?php if ($resultReport['ok']): ?>
          <div class="alert-ok">
            <?php echo $resultReport['dryRun']
              ? '🔍 PODGLĄD (DRY RUN) ZAKOŃCZONY POMYŚLNIE — żaden plik nie został jeszcze zmodyfikowany.'
              : '✅ PEŁNA NAPRAWA I SCALENIE BAZY ZAKOŃCZONE SUKCESEM!'; ?>
          </div>
        <?php else: ?>
          <div class="alert-err">
            ❌ Wykryto błędy:
            <ul>
              <?php foreach ($resultReport['errors'] as $er): ?>
                <li><?php echo h($er); ?></li>
              <?php endforeach; ?>
            </ul>
          </div>
        <?php endif; ?>

        <h2>📊 Podsumowanie stanu bazy po scaleniu</h2>
        <div class="grid-stats">
          <div class="stat-box">
            <div class="k">Przerwa Tech.</div>
            <div class="v" style="color:#34d399;"><?php echo !empty($resultReport['maintenanceMode']['enabled']) ? 'ON' : 'OFF (false)'; ?></div>
          </div>
          <div class="stat-box">
            <div class="k">Gracze</div>
            <div class="v"><?php echo (int)$resultReport['preservedCounts']['players']; ?></div>
          </div>
          <div class="stat-box">
            <div class="k">Wiadomości DM</div>
            <div class="v"><?php echo (int)$resultReport['preservedCounts']['directMessages']; ?></div>
          </div>
          <div class="stat-box">
            <div class="k">Zgłoszenia</div>
            <div class="v"><?php echo (int)$resultReport['preservedCounts']['registrations']; ?></div>
          </div>
          <div class="stat-box">
            <div class="k">Admini</div>
            <div class="v"><?php echo (int)$resultReport['preservedCounts']['admins']; ?></div>
          </div>
          <div class="stat-box">
            <div class="k">Usunięte M_L3</div>
            <div class="v"><?php echo (int)$resultReport['cleanedProposals'] + (int)$resultReport['cleanedFanPolls']; ?></div>
          </div>
        </div>

        <h2>👥 Zweryfikowani gracze w tablicy players</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Zawodnik / Nick</th>
              <th>Login</th>
              <th>Liga</th>
              <th>Puchary</th>
              <th>Historia S1–S55</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($resultReport['playersSummary'] as $ps): ?>
              <tr>
                <td class="mono"><?php echo h($ps['id']); ?></td>
                <td>
                  <strong><?php echo h($ps['name']); ?></strong>
                  <?php if ($ps['nick'] !== ''): ?> (<?php echo h($ps['nick']); ?>)<?php endif; ?>
                  <?php if ($ps['adminRole'] !== ''): ?> <span style="color:#fbbf24;">[<?php echo h($ps['adminRole']); ?>]</span><?php endif; ?>
                </td>
                <td class="mono"><?php echo h($ps['username']); ?></td>
                <td><strong><?php echo h($ps['leagueId']); ?></strong> <?php echo $ps['active'] ? '✅' : '⏸️'; ?></td>
                <td>🏆 <?php echo (int)$ps['trophiesCount']; ?></td>
                <td><?php echo (int)$ps['seasons']; ?> sez. / <?php echo (int)$ps['matches']; ?> m. / <?php echo (int)$ps['points']; ?> pkt</td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>

        <h2 style="margin-top:18px;">📋 Dziennik wykonanych kroków</h2>
        <ul>
          <?php foreach ($resultReport['steps'] as $st): ?>
            <li><?php echo h($st); ?></li>
          <?php endforeach; ?>
        </ul>

        <?php if (!empty($resultReport['writtenFiles'])): ?>
          <p class="mono" style="color:#94a3b8;margin-top:10px;">
            Zapisane pliki: <?php echo h(implode(', ', $resultReport['writtenFiles'])); ?>
          </p>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
