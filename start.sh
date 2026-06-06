#!/bin/bash

echo "🎨 theARTofFLIGHT - Starting..."

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected - Using Docker Compose"
    docker-compose up -d
    echo ""
    echo "✨ theARTofFLIGHT is running!"
    echo "📡 Open http://localhost:3000 in your browser"
    echo ""
    echo "To view on TV:"
    echo "1. Find your computer's IP address (ipconfig or ifconfig)"
    echo "2. On TV browser, go to http://[your-ip]:3000"
    echo ""
    echo "To stop: docker-compose down"
else
    echo "📦 Docker not found - Starting with Node.js"

    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        echo "❌ Error: Node.js is not installed"
        echo "Please install Node.js from https://nodejs.org/"
        exit 1
    fi

    # Install dependencies if needed
    if [ ! -d "server/node_modules" ]; then
        echo "📥 Installing dependencies..."
        cd server
        npm install
        cd ..
    fi

    # Start the server
    echo "🚀 Starting server..."
    cd server
    node server.js
fi
