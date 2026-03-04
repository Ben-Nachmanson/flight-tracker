# Mission Beach Flight Tracker

A real-time LED sign that lights up when flights pass over Mission Beach, San Diego. Built with Python FastAPI backend and a web-based LED sign simulator.

![Flight Tracker Dashboard](preview.png)

## Features

- 🛫 **Live Flight Tracking**: Uses OpenSky Network ADS-B data
- 💡 **LED Sign Simulation**: CSS-based glowing LED matrix display
- 🗺️ **Interactive Map**: Real-time flight positions with Leaflet.js
- 📊 **Dashboard**: Statistics, flight table, and status indicators
- 🔊 **Audio Alert**: Beep sound when flights enter the detection zone
- 📡 **5km Detection Radius**: Tracks flights within 5km of Mission Beach

## Quick Start

### Option 1: Using the Run Script (Recommended)
```bash
./run.sh
```

Then open: http://localhost:8000

### Option 2: Manual Setup

1. **Create virtual environment and install dependencies:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. **Start the server:**
```bash
# Option A: Using uvicorn (recommended)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Option B: Using Python directly
python main.py
```

3. **Open the dashboard:**
Navigate to http://localhost:8000 in your browser

## How It Works

1. Backend polls OpenSky Network API every 10 seconds
2. Calculates distance from each flight to Mission Beach coordinates (32.7708°N, 117.2500°W)
3. When a flight enters the 5km radius:
   - LED sign lights up with glowing animation
   - Flight info displayed (callsign, airline, altitude, speed, heading)
   - Audio alert plays
   - Map marker turns green
4. Sign turns off when no flights are overhead

## LED Sign Display

The LED sign shows:
- ✈️ Flight callsign (e.g., "AAL123")
- Airline name
- Altitude in feet
- Speed in mph
- Direction (N, NE, E, SE, S, SW, W, NW)

## API Endpoints

- `GET /api/flights` - All flights in San Diego area
- `GET /api/overhead` - Flights currently over Mission Beach
- `GET /api/location` - Mission Beach coordinates

## Data Source

This project uses the [OpenSky Network](https://opensky-network.org/) API, which provides free real-time ADS-B flight data. No API key required for basic usage.

## Files

- `main.py` - FastAPI backend with OpenSky integration
- `index.html` - Dashboard with LED sign and map
- `app.js` - Frontend JavaScript logic
- `requirements.txt` - Python dependencies
- `run.sh` - Quick start script

## Mission Beach, San Diego

Mission Beach is located at:
- Latitude: 32.7708° N
- Longitude: 117.2500° W

The system tracks flights within a 5km (3.1 mile) radius of this location.

## License

MIT License - Feel free to modify and share!
