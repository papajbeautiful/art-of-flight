@echo off
setlocal
echo theARTofFLIGHT - Starting...

REM Prefer Docker only if the daemon is actually running ("where docker"
REM alone passes when Docker Desktop is installed but stopped).
docker info >nul 2>nul
if not errorlevel 1 goto :docker

echo Docker not available - starting with Node.js

REM NOTE: dynamic "if errorlevel N" is required here. %ERRORLEVEL% inside
REM a parenthesized block is expanded at parse time and reads the stale
REM value from the docker check above - that bug reported "Node.js is not
REM installed" on machines that had it.
where node >nul 2>nul
if errorlevel 1 (
    echo Error: Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "server\node_modules" (
    echo Installing dependencies...
    pushd server
    call npm install
    popd
)

echo Starting server...
echo Open http://localhost:3000 in your browser
echo To view on TV: run ipconfig, then open http://[your-ip]:3000 on the TV
cd server

:run
node server.js
echo.
echo Server exited - restarting in 5 seconds... (close this window to stop)
timeout /t 5 /nobreak >nul
goto :run

:docker
echo Docker detected - using Docker Compose
docker compose version >nul 2>nul
if errorlevel 1 (
    docker-compose up -d
) else (
    docker compose up -d
)
echo.
echo theARTofFLIGHT is running!
echo Open http://localhost:3000 in your browser
echo.
echo To view on TV:
echo   1. Find this computer's IP address: ipconfig
echo   2. On the TV browser, go to http://[your-ip]:3000
echo.
echo To stop: docker compose down
