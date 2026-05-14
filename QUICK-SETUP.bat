@echo off
title TechNest — Database Setup
color 0B

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║   TechNest — Cyber Project Setup           ║
echo  ║   Location: Desktop\cyber project          ║
echo  ╚════════════════════════════════════════════╝
echo.
echo  This will set up the database and start the server.
echo.

:: Ask for MySQL root password
set /p MYSQL_PASS=  Enter your MySQL root password:

echo.
echo  Setting up database...
cd /d "%~dp0"
node setup-database.js "%MYSQL_PASS%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ❌ Setup failed. Check the error above.
    pause
    exit /b 1
)

echo.
echo  Starting the server...
echo.
cd /d "%~dp0backend"
start "TechNest Server" cmd /k "npm run dev"

:: Wait for server to start
timeout /t 3 /nobreak >nul

echo  Opening browser...
start http://localhost:5000

echo.
echo  ✅ Everything is running!
echo  Browser should open automatically.
echo  Admin Panel: http://localhost:5000/admin.html
echo.
pause
