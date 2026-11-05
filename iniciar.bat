@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Falta Node.js: instalalo desde https://nodejs.org ^(boton LTS^) y vuelve a abrir. & pause & exit /b 1)
start "" /b cmd /c "timeout /t 1 >nul & start http://127.0.0.1:3000"
node server.js
