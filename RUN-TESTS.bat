@echo off
title TechNest - API Security Tests
color 0A

echo.
echo  TechNest Security Test Suite
echo  ─────────────────────────────
echo  Make sure the server is running first!
echo  (Run START-SERVER.bat in another window)
echo.
pause

cd /d "%~dp0backend"
node test-api.js

echo.
pause
