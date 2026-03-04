from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
import httpx
import math
from typing import Dict, List, Optional
import asyncio
from datetime import datetime
import os

app = FastAPI(title="Mission Beach Flight Tracker")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the directory where main.py is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Mount static files
app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")

# Mission Beach, San Diego coordinates
MISSION_BEACH = {
    "lat": 32.7708,
    "lon": -117.2500,
    "radius_km": 5.0  # Detection radius
}

# In-memory cache for flight data
flight_cache = {}
last_update = None


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in kilometers."""
    R = 6371  # Earth radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def is_over_mission_beach(lat: float, lon: float) -> bool:
    """Check if coordinates are within Mission Beach detection radius."""
    distance = haversine_distance(
        lat, lon,
        MISSION_BEACH["lat"], MISSION_BEACH["lon"]
    )
    return distance <= MISSION_BEACH["radius_km"]


def decode_callsign(callsign: str) -> Dict:
    """Extract airline info from callsign."""
    if not callsign or callsign.strip() == "":
        return {"airline": "Unknown", "flight_number": "Unknown"}
    
    callsign = callsign.strip()
    
    # Common airline prefixes
    airlines = {
        "AAL": "American Airlines",
        "UAL": "United Airlines",
        "DAL": "Delta Air Lines",
        "SWA": "Southwest Airlines",
        "JBU": "JetBlue",
        "ASA": "Alaska Airlines",
        "FFT": "Frontier Airlines",
        "NKS": "Spirit Airlines",
        "HAL": "Hawaiian Airlines",
        "BAW": "British Airways",
        "QFA": "Qantas",
        "ACA": "Air Canada",
        "AFR": "Air France",
        "DLH": "Lufthansa",
        "KLM": "KLM",
        "UAE": "Emirates",
        "QTR": "Qatar Airways",
        "CPA": "Cathay Pacific",
        "ANA": "ANA",
        "JAL": "Japan Airlines",
        "CAL": "China Airlines",
        "EVA": "EVA Air",
        "VIR": "Virgin Atlantic",
        "AFW": "Air France",
        "ATN": "Air Transport International",
        "FED": "FedEx",
        "UPS": "UPS",
        "FDX": "FedEx",
    }
    
    prefix = callsign[:3].upper()
    airline = airlines.get(prefix, prefix)
    
    return {
        "airline": airline,
        "flight_number": callsign
    }


async def fetch_flight_data():
    """Fetch live flight data from OpenSky Network."""
    global flight_cache, last_update
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get all flights within bounding box around San Diego
            # Approximate box: 32N-33N, -118W to -116W
            url = (
                "https://opensky-network.org/api/states/all"
                "?lamin=32.0&lamax=33.5&lomin=-118.5&lomax=-116.5"
            )
            
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            states = data.get("states", [])
            
            nearby_flights = []
            
            for state in states:
                if state and len(state) >= 17:
                    # OpenSky state vector format:
                    # [0:icao24, 1:callsign, 2:origin_country, 3:last_position,
                    #  4:last_contact, 5:longitude, 6:latitude, 7:baro_altitude,
                    #  8:on_ground, 9:velocity, 10:true_track, 11:vertical_rate,
                    #  12:sensors, 13:geo_altitude, 14:squawk, 15:spi, 16:position_source]
                    
                    lat = state[6]
                    lon = state[5]
                    
                    if lat is None or lon is None:
                        continue
                    
                    callsign = state[1] if state[1] else "Unknown"
                    airline_info = decode_callsign(callsign)
                    
                    distance_to_mb = haversine_distance(
                        lat, lon,
                        MISSION_BEACH["lat"], MISSION_BEACH["lon"]
                    )
                    
                    flight_data = {
                        "icao24": state[0],
                        "callsign": callsign,
                        "airline": airline_info["airline"],
                        "flight_number": airline_info["flight_number"],
                        "origin_country": state[2],
                        "latitude": lat,
                        "longitude": lon,
                        "altitude": state[7] if state[7] else state[13],
                        "velocity": state[9],  # m/s
                        "heading": state[10],  # degrees
                        "on_ground": state[8],
                        "distance_to_mission_beach_km": round(distance_to_mb, 2),
                        "is_over_mission_beach": is_over_mission_beach(lat, lon),
                        "last_update": datetime.now().isoformat()
                    }
                    
                    nearby_flights.append(flight_data)
            
            # Update cache
            flight_cache = {
                "flights": nearby_flights,
                "overhead_flights": [f for f in nearby_flights if f["is_over_mission_beach"]],
                "mission_beach": MISSION_BEACH,
                "last_updated": datetime.now().isoformat(),
                "total_flights_in_area": len(nearby_flights)
            }
            
            last_update = datetime.now()
            
    except Exception as e:
        print(f"Error fetching flight data: {e}")
        # Return cached data if available
        if not flight_cache:
            flight_cache = {
                "flights": [],
                "overhead_flights": [],
                "mission_beach": MISSION_BEACH,
                "last_updated": datetime.now().isoformat(),
                "total_flights_in_area": 0,
                "error": str(e)
            }


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the dashboard HTML."""
    html_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(html_path):
        with open(html_path, "r") as f:
            return f.read()
    return {"message": "Mission Beach Flight Tracker API - index.html not found"}


@app.get("/api/flights")
async def get_flights():
    """Get current flight data."""
    if not flight_cache:
        await fetch_flight_data()
    return flight_cache


@app.get("/api/overhead")
async def get_overhead_flights():
    """Get flights currently over Mission Beach."""
    if not flight_cache:
        await fetch_flight_data()
    return {
        "flights": flight_cache.get("overhead_flights", []),
        "count": len(flight_cache.get("overhead_flights", [])),
        "last_updated": flight_cache.get("last_updated")
    }


@app.get("/api/location")
async def get_location():
    """Get Mission Beach location info."""
    return MISSION_BEACH


# Background task to update flight data
async def update_flights_periodically():
    """Update flight data every 10 seconds."""
    while True:
        try:
            await fetch_flight_data()
        except Exception as e:
            print(f"Error in periodic update: {e}")
        await asyncio.sleep(10)


@app.on_event("startup")
async def startup_event():
    """Start background task on startup."""
    asyncio.create_task(update_flights_periodically())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
