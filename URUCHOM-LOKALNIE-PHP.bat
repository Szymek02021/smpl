@echo off
chcp 65001 >nul
cd /d "%~dp0"
title SMPL — Lokalny Serwer PHP 8.3 (Podglad identyczny z Hostido.pl)

set "PHP_BIN="
where php >nul 2>&1
if %ERRORLEVEL%==0 (
    set "PHP_BIN=php"
) else (
    for /d %%D in ("C:\laragon\bin\php\php-*") do (
        if exist "%%~D\php.exe" set "PHP_BIN=%%~D\php.exe"
    )
)

if "%PHP_BIN%"=="" (
    echo [BLAD] Nie znaleziono PHP! Zainstaluj Laragon lub dodaj php.exe do zmiennej PATH.
    pause
    exit /b 1
)

echo ============================================================================
echo   SCORE MATCH LIGA POLSKA (SMPL) — LOKALNY PODGLAD PHP
echo   Uzywane PHP: %PHP_BIN%
echo   Adres:       http://127.0.0.1:8080/
echo   Zatrzymanie: zamknij to okno lub nacisnij Ctrl + C
echo ============================================================================
echo.

start "" "http://127.0.0.1:8080/"
"%PHP_BIN%" -S 127.0.0.1:8080
pause
