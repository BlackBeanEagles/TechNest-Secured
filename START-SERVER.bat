@echo off
title TechNest - Secure Shop Server
color 0B

echo.
echo  ████████╗███████╗ ██████╗██╗  ██╗███╗   ██╗███████╗███████╗████████╗
echo     ██╔══╝██╔════╝██╔════╝██║  ██║████╗  ██║██╔════╝██╔════╝╚══██╔══╝
echo     ██║   █████╗  ██║     ███████║██╔██╗ ██║█████╗  ███████╗   ██║
echo     ██║   ██╔══╝  ██║     ██╔══██║██║╚██╗██║██╔══╝  ╚════██║   ██║
echo     ██║   ███████╗╚██████╗██║  ██║██║ ╚████║███████╗███████║   ██║
echo     ╚═╝   ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝   ╚═╝
echo.
echo  Secure E-Commerce — Cybersecurity Demo Project
echo  ─────────────────────────────────────────────
echo.

cd /d "%~dp0backend"

echo  [1/2] Checking dependencies...
if not exist "node_modules" (
    echo  Installing npm packages...
    call npm install
)

echo  [2/2] Starting server...
echo.
echo  ┌─────────────────────────────────────────┐
echo  │  Server: http://localhost:5000           │
echo  │  Admin:  http://localhost:5000/admin.html│
echo  │  Login:  http://localhost:5000/login.html│
echo  │                                          │
echo  │  Admin login: admin / Admin@1234         │
echo  │  User  login: johndoe / User@1234        │
echo  └─────────────────────────────────────────┘
echo.
echo  Press CTRL+C to stop the server
echo.

call npm run dev

pause
