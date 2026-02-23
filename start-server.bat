@echo off
setlocal ENABLEDELAYEDEXPANSION
REM D 9marre un petit serveur local et ouvre l'app dans le navigateur

set PORT=5500
pushd "%~dp0"

REM Essayer Python via 'py', sinon 'python'
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  start "Serveur local" cmd /k py -m http.server %PORT%
) else (
  where python >nul 2>nul
  if %ERRORLEVEL%==0 (
    start "Serveur local" cmd /k python -m http.server %PORT%
  ) else (
    echo [Erreur] Python introuvable. Installez Python 3.x depuis https://www.python.org/downloads/ ^& relancez ce script.
    echo Option alternative: installez Node.js puis utilisez npx http-server.
    pause
    exit /b 1
  )
)

REM Ouvrir le navigateur par d 9faut
start "" http://localhost:%PORT%/index.html

popd
endlocal
