@echo off
:: ==============================================================================
:: StayVista Rate Parity Engine - Windows Auto-Launcher
:: Zero-Prerequisite Launcher for non-technical users
:: ==============================================================================
title StayVista Rate Parity Engine
setlocal enabledelayedexpansion

:: Navigate to the directory where this script is located (handles spaces in path)
cd /d "%~dp0"

echo ================================================================
echo         StayVista Rate Parity Engine - Auto Launcher
echo ================================================================
echo.

:: Safeguard: Check if port 3000 is already active
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1', 3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo  [INFO] StayVista Rate Parity Engine is already active on http://localhost:3000.
    echo  [INFO] Opening your default web browser...
    start http://localhost:3000
    timeout /t 3 >nul
    exit /b 0
)

:: [1/4] Check & Bootstrap Node.js Runtime
echo [1/4] Checking Node.js runtime...

set "NODE_CMD="
if exist "%~dp0.runtime\node\node.exe" (
    set "PATH=%~dp0.runtime\node;!PATH!"
    set "NODE_CMD=%~dp0.runtime\node\node.exe"
    echo       Using portable local Node.js.
) else (
    where node >nul 2>&1
    if %errorlevel% equ 0 (
        for /f "tokens=1 delims=." %%v in ('node -v') do set "RAW_VER=%%v"
        set "VER_NUM=!RAW_VER:v=!"
        if defined VER_NUM (
            if !VER_NUM! geq 18 (
                set "NODE_CMD=node"
                echo       Found system Node.js.
            )
        )
    )
)

:: If Node.js >= 18 is not found, download official portable standalone package
if "!NODE_CMD!"=="" (
    echo       Node.js ^>= v18 not found on your system.
    echo       Downloading portable standalone Node.js ^(v20.18.3 LTS^)...
    echo       ^(No administrator rights required - installs locally into .runtime^)

    if "%PROCESSOR_ARCHITECTURE%"=="ARM64" (
        set "NODE_ARCH=win-arm64"
    ) else (
        set "NODE_ARCH=win-x64"
    )

    set "NODE_URL=https://nodejs.org/dist/v20.18.3/node-v20.18.3-!NODE_ARCH!.zip"
    
    if not exist "%~dp0.runtime\temp" mkdir "%~dp0.runtime\temp"
    if not exist "%~dp0.runtime\node" mkdir "%~dp0.runtime\node"

    echo       Downloading official Node.js package...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ProgressPreference = 'SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('!NODE_URL!', '%~dp0.runtime\temp\node.zip')"
    
    if not exist "%~dp0.runtime\temp\node.zip" (
        echo  [ERROR] Failed to download Node.js. Please check your internet connection.
        pause
        exit /b 1
    )

    echo       Extracting Node.js package...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('%~dp0.runtime\temp\node.zip', '%~dp0.runtime\temp\unzipped')"

    for /d %%D in ("%~dp0.runtime\temp\unzipped\node-*") do (
        xcopy "%%D\*" "%~dp0.runtime\node\" /E /I /H /Y /Q >nul
    )

    rmdir /s /q "%~dp0.runtime\temp" >nul 2>&1
    set "PATH=%~dp0.runtime\node;!PATH!"
    set "NODE_CMD=%~dp0.runtime\node\node.exe"

    if not exist "%~dp0.runtime\node\node.exe" (
        echo  [ERROR] Could not configure local Node.js. Please contact support.
        pause
        exit /b 1
    )
    echo       Successfully configured local Node.js.
)

:: [2/4] Check & Install Application Dependencies
echo [2/4] Checking dependencies...
if not exist "%~dp0node_modules\" (
    echo       Dependencies not found. Installing packages ^(npm install^)...
    echo       ^(This only happens on first run and takes about 1-2 minutes^)
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to install dependencies. Please check network connectivity.
        pause
        exit /b 1
    )
) else (
    echo       Dependencies found.
)

:: [3/4] Setup Database & Playwright Browser Engine
echo [3/4] Preparing database and browser engines...

call npx prisma generate >nul 2>&1

if not exist "%~dp0prisma\dev.db" (
    echo       Initializing local database schema...
    call npx prisma db push --skip-generate >nul 2>&1
)

echo       Checking Playwright Chromium browser...
call npx playwright install chromium

:: [4/4] Launch Application & Auto-Open Web Browser
echo.
echo [4/4] Starting StayVista Rate Parity Engine...
echo       Server starting on http://localhost:3000
echo       Opening browser automatically when ready...
echo.
echo ----------------------------------------------------------------
echo  TIP: Keep this window open while using the application.
echo       To stop the engine, press Ctrl+C or close this window.
echo ----------------------------------------------------------------
echo.

:: Background watcher to open browser once port 3000 responds
start "" /B powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "for ($i=0; $i -lt 45; $i++) { Start-Sleep -Seconds 1; try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 3000); $c.Close(); Start-Process 'http://localhost:3000'; break } catch {} }"

:: Run Next.js server
call npm run dev
if %errorlevel% neq 0 (
    pause
)
