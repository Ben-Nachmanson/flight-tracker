#!/bin/bash

# Mission Beach Flight Tracker - Quick Start Script

echo "🛫 Mission Beach Beach Flight Tracker"
echo "================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt -q

# Kill any existing server
echo "🧹 Cleaning up existing processes..."
pkill -f "uvicorn.*main:app" 2>/dev/null || true
pkill -f "python.*main.py" 2>/dev/null || true
sleep 2

# Start the server
echo ""
echo "🚀 Starting Flight Tracker Server..."
echo ""
echo "Dashboard URL: http://localhost:8000"
echo "API Base URL: http://localhost:8000/api"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Use uvicorn to run the app
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
