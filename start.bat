@echo off
echo 🎨 theARTofFLIGHT - Starting...

REM Check if Docker is available
where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo 🐳 Docker detected - Using Docker Compose
    docker-compose up -d
    echo.
    echo ✨ theARTofFLIGHT is running!
    echo 📡 Open http://localhost:3000 in your browser
    echo.
    echo To view on TV:
    echo 1. Find your computer's IP address: ipconfig
    echo 2. On TV browser, go to http://[your-ip]:3000
    echo.
    echo To stop: docker-compose down
) else (
    echo 📦 Docker not found - Starting with Node.js

    REM Check if Node.js is available
    where node >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ Error: Node.js is not installed
        echo Please install Node.js from https://nodejs.org/
        pause
        exit /b 1
    )

    REM Install dependencies if needed
    if not exist "server\node_modules" (
        echo 📥 Installing dependencies...
        cd server
        call npm install
        cd ..
    )

    REM Start the server
    echo 🚀 Starting server...
    cd server
    node server.js
)
