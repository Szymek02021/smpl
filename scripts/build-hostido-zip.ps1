# ==============================================================================
# SMPL Hostido.pl Update Packager (BEZ BAZY DANYCH - ZERO DATA LOSS)
# Tworzy PACZKA-AKTUALIZACJA-BEZ-BAZY.zip z czystymi sciezkami Linux "/"
# ==============================================================================
[CmdletBinding()]
param(
    [string]$OutputName = 'PACZKA-AKTUALIZACJA-BEZ-BAZY.zip'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = Split-Path -Parent $PSScriptRoot
$outZip = Join-Path $repoRoot $OutputName

if (Test-Path -LiteralPath $outZip) {
    Remove-Item -LiteralPath $outZip -Force
}

$includeFiles = @(
    '.htaccess',
    '.user.ini',
    'api.php',
    'manifest.json',
    'sw.js',
    'favicon.ico',
    'index.html',
    'MASTER-SZYMON-KOMENDA.html',
    'PANEL-ADMINA.html',
    'REJESTRACJA.html',
    'REGULAMIN-I-POLITYKA-SMPL.md'
)

$includeDirs = @('css', 'js', 'img')

$zip = [System.IO.Compression.ZipFile]::Open($outZip, [System.IO.Compression.ZipArchiveMode]::Create)
$count = 0

try {
    foreach ($rel in $includeFiles) {
        $full = Join-Path $repoRoot $rel
        if (Test-Path -LiteralPath $full) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $full, $rel, [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
            $count++
        } else {
            Write-Warning "Pominieto brakujacy plik: $rel"
        }
    }

    foreach ($dir in $includeDirs) {
        $dirPath = Join-Path $repoRoot $dir
        if (-not (Test-Path -LiteralPath $dirPath)) { continue }
        Get-ChildItem -LiteralPath $dirPath -Recurse -File | Sort-Object FullName | ForEach-Object {
            $relPath = $_.FullName.Substring($repoRoot.Length + 1).Replace('\', '/')
            if ($relPath -match '(^|/)(Thumbs\.db|\.DS_Store|desktop\.ini)$') { return }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $zip, $_.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
            $count++
        }
    }
}
finally {
    $zip.Dispose()
}

# Weryfikacja bezpieczenstwa paczki
$verifyZip = [System.IO.Compression.ZipFile]::OpenRead($outZip)
try {
    $entries = $verifyZip.Entries | Select-Object -ExpandProperty FullName
    $hasData = @($entries | Where-Object { $_ -match '^data/' -or $_ -match 'smpl-db' -or $_ -match '\.smpl-' }).Count
    $hasBackslash = @($entries | Where-Object { $_ -match '\\' }).Count
    if ($hasData -gt 0) {
        throw "BLAD BEZPIECZENSTWA: Wykryto pliki z folderu data/ lub sekrety wewnatrz paczki!"
    }
    if ($hasBackslash -gt 0) {
        throw "BLAD FORMATU: Wykryto sciezki Windows '\' wewnatrz archiwum ZIP!"
    }
}
finally {
    $verifyZip.Dispose()
}

$sizeMb = [Math]::Round((Get-Item -LiteralPath $outZip).Length / 1MB, 2)
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host " [OK] Paczka aktualizacyjna na Hostido.pl gotowa!" -ForegroundColor Green
Write-Host " Plik:   $outZip"
Write-Host " Pliki:  $count (0 plikow z data/, 100% sciezki Linux /)"
Write-Host " Rozmiar: $sizeMb MB"
Write-Host "==================================================================" -ForegroundColor Green
