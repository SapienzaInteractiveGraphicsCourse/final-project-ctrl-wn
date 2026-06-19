@echo off
title Breeze & Blades - Local Web Server
echo ===================================================
echo   Breeze ^& Blades - Simulatore Parco Eolico 3D
echo   Avvio del Server Web Locale...
echo ===================================================
echo.
echo [1/2] Apertura del browser all'indirizzo http://localhost:8080 ...
start http://localhost:8080
echo.
echo [2/2] Avvio del server http-server...
echo (Premi CTRL+C per arrestare il server)
echo.
npx http-server -p 8080
pause
