#!/bin/bash

echo "theARTofFLIGHT - Starting..."

# Prefer Docker only if the daemon is actually running ("command -v docker"
# alone passes when the CLI is installed but the daemon is stopped).
if docker info &> /dev/null; then
    echo "Docker detected - using Docker Compose"
    if docker compose version &> /dev/null; then
        docker compose up -d
    else
        docker-compose up -d
    fi
    echo ""
    echo "theARTofFLIGHT is running!"
    echo "Open http://localhost:3000 in your browser"
    echo ""
    echo "To view on TV:"
    echo "  1. Find this computer's IP address (ifconfig or ip addr)"
    echo "  2. On the TV browser, go to http://[your-ip]:3000"
    echo ""
    echo "To stop: docker compose down"
else
    echo "Docker not available - starting with Node.js"

    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed"
        echo "Please install Node.js from https://nodejs.org/"
        exit 1
    fi

    if [ ! -d "server/node_modules" ]; then
        echo "Installing dependencies..."
        (cd server && npm install)
    fi

    echo "Starting server..."
    echo "Open http://localhost:3000 in your browser"
    echo "To view on TV: find this computer's IP, then open http://[your-ip]:3000 on the TV"
    cd server

    # 24/7 kiosk: restart automatically if the server ever exits
    while true; do
        node server.js
        echo ""
        echo "Server exited - restarting in 5 seconds... (Ctrl+C to stop)"
        sleep 5
    done
fi
