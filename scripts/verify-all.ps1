# ==============================================================================
# SMPL Local Quality & Security Verification Script
# Sprawdza: PHP syntax (php -l), JS syntax (node --check), JSON, Git secret safety
# ==============================================================================
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$failures = 0

function Find-Tool([string]$CmdName, [string[]]$ExtraGlobs) {
    $inPath = Get-Command $CmdName -ErrorAction SilentlyContinue
    if ($inPath) { return $inPath.Source }
    foreach ($g in $ExtraGlobs) {
        $found = Get-ChildItem -Path $g -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    return $null
}

$phpExe = Find-Tool 'php' @('C:\laragon\bin\php\php-*\php.exe', 'C:\xampp\php\php.exe')
$nodeExe = Find-Tool 'node' @('C:\laragon\bin\nodejs\node-*\node.exe', 'C:\Program Files\nodejs\node.exe')
$gitExe = Find-Tool 'git' @('C:\Program Files\Git\cmd\git.exe')

Write-Host "=== SMPL VERIFY ===" -ForegroundColor Cyan
Write-Host ("PHP:  " + $(if ($phpExe) { $phpExe } else { 'NIE ZNALEZIONO' }))
Write-Host ("Node: " + $(if ($nodeExe) { $nodeExe } else { 'NIE ZNALEZIONO' }))
Write-Host ("Git:  " + $(if ($gitExe) { $gitExe } else { 'NIE ZNALEZIONO' }))
Write-Host ""

# 1. PHP syntax check
if ($phpExe) {
    $phpFiles = Get-ChildItem -LiteralPath $repoRoot -Filter '*.php' -File
    foreach ($f in $phpFiles) {
        & $phpExe -l $f.FullName | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[PASS] php -l $($f.Name)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] php -l $($f.Name)" -ForegroundColor Red
            $failures++
        }
    }
} else {
    Write-Warning "Pominieto php -l (brak php.exe w PATH ani Laragon)."
}

# 2. JS syntax check
if ($nodeExe) {
    $jsFiles = @()
    foreach ($rootJs in @('sw.js', 'server.js')) {
        $p = Join-Path $repoRoot $rootJs
        if (Test-Path -LiteralPath $p) { $jsFiles += Get-Item -LiteralPath $p }
    }
    $jsDir = Join-Path $repoRoot 'js'
    if (Test-Path -LiteralPath $jsDir) {
        $jsFiles += Get-ChildItem -LiteralPath $jsDir -Filter '*.js' -File | Sort-Object Name
    }
    foreach ($f in $jsFiles) {
        & $nodeExe --check $f.FullName
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[PASS] node --check $($f.Name)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] node --check $($f.Name)" -ForegroundColor Red
            $failures++
        }
    }
} else {
    Write-Warning "Pominieto node --check (brak node.exe w PATH ani Laragon)."
}

# 3. JSON parse check
foreach ($jf in @('manifest.json', 'package.json')) {
    $jp = Join-Path $repoRoot $jf
    if (Test-Path -LiteralPath $jp) {
        try {
            Get-Content -LiteralPath $jp -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
            Write-Host "[PASS] JSON valid: $jf" -ForegroundColor Green
        } catch {
            Write-Host "[FAIL] JSON invalid: $jf -> $($_.Exception.Message)" -ForegroundColor Red
            $failures++
        }
    }
}

# 4. Git secret leak check
if ($gitExe -and (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) {
    $tracked = & $gitExe -C $repoRoot ls-files
    $leaks = @($tracked | Where-Object { $_ -match '^data/(smpl-db|\.smpl-|snapshots/|audit\.log)' -or $_ -match '\.(zip|mp4|env)$' })
    if ($leaks.Count -eq 0) {
        Write-Host "[PASS] Git secret audit: 0 wrazliwych plikow sledzonych w repo" -ForegroundColor Green
    } else {
        Write-Host ("[FAIL] Git secret audit: WYKRYTO WRAZLIWE PLIKI: " + ($leaks -join ', ')) -ForegroundColor Red
        $failures++
    }
}

Write-Host ""
if ($failures -eq 0) {
    Write-Host "=== WSZYSTKO OK! 0 BLEDOW ===" -ForegroundColor Green
    exit 0
} else {
    Write-Host "=== WYKRYTO BLEDY: $failures ===" -ForegroundColor Red
    exit 1
}
