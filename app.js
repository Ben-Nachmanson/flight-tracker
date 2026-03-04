// Mission Beach Flight Tracker - Frontend
const API_BASE_URL = 'http://localhost:8000';

// Mission Beach coordinates
const MISSION_BEACH = {
    lat: 32.7708,
    lon: -117.2500
};

// State
let map = null;
let markers = {};
let overheadFlightIds = new Set();

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing Flight Tracker...');
        initMap();
        updateFlights();
        // Update every 10 seconds
        setInterval(updateFlights, 10000);
        console.log('Flight Tracker initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
    }
});

// Initialize Leaflet map
function initMap() {
    try {
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('Leaflet library not loaded');
            document.getElementById('map').innerHTML = '<div style="padding: 20px; text-align: center; color: #ff6600;">Map library failed to load. Please refresh the page.</div>';
            return;
        }
        
        map = L.map('map').setView([MISSION_BEACH.lat, MISSION_BEACH.lon], 11);
        
        // Dark theme map tiles with error handling
        const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            crossOrigin: true
        });
        
        tileLayer.on('tileerror', function(error) {
            console.warn('Tile failed to load, trying fallback...');
            // Fallback to OpenStreetMap
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                subdomains: 'abc',
                maxZoom: 19
            }).addTo(map);
        });
        
        tileLayer.addTo(map);
        
        // Add Mission Beach marker
        const mbMarker = L.circleMarker([MISSION_BEACH.lat, MISSION_BEACH.lon], {
            radius: 10,
            fillColor: '#00ff00',
            color: '#00ff00',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        mbMarker.bindPopup('<b>Mission Beach</b><br>Flight Detection Zone');
        
        // Add detection radius circle (5km)
        L.circle([MISSION_BEACH.lat, MISSION_BEACH.lon], {
            radius: 5000,
            fillColor: '#00ff00',
            color: '#00ff00',
            weight: 1,
            opacity: 0.5,
            fillOpacity: 0.1
        }).addTo(map);
        
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('map').innerHTML = '<div style="padding: 20px; text-align: center; color: #ff6600;">Error loading map: ' + error.message + '</div>';
    }
}

// Fetch and update flight data
async function updateFlights() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/flights`);
        const data = await response.json();
        
        // Update LED sign
        updateLEDSign(data.overhead_flights);
        
        // Update status
        updateStatus(data);
        
        // Update flight table
        updateFlightTable(data.flights);
        
        // Update statistics
        updateStats(data);
        
        // Update map markers
        updateMapMarkers(data.flights);
        
        // Check for new overhead flights and trigger animation
        checkNewOverheadFlights(data.overhead_flights);
        
    } catch (error) {
        console.error('Error fetching flights:', error);
        showError('Connection lost - retrying...');
    }
}

// Update LED sign display
function updateLEDSign(overheadFlights) {
    const ledSign = document.getElementById('ledSign');
    const ledContent = document.getElementById('ledContent');
    
    if (overheadFlights.length === 0) {
        // No flights overhead - sign is off
        ledSign.className = 'led-sign off';
        ledContent.innerHTML = '<div class="no-flight">NO FLIGHTS OVERHEAD</div>';
        return;
    }
    
    // Flight detected - sign lights up
    ledSign.className = 'led-sign active';
    
    // Show the first overhead flight (or could cycle through multiple)
    const flight = overheadFlights[0];
    const altitude = flight.altitude ? Math.round(flight.altitude * 3.28084) : 'Unknown'; // Convert to feet
    const speed = flight.velocity ? Math.round(flight.velocity * 2.23694) : 'Unknown'; // Convert to mph
    
    let direction = 'N';
    if (flight.heading !== null && flight.heading !== undefined) {
        const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(flight.heading / 45) % 8;
        direction = headings[index];
    }
    
    ledContent.innerHTML = `
        <div class="flight-line">✈️ ${flight.callsign || 'Unknown'}</div>
        <div class="flight-details">
            ${flight.airline} • ${altitude}ft • ${speed}mph • ${direction}
        </div>
    `;
}

// Update status indicator
function updateStatus(data) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const lastUpdate = document.getElementById('lastUpdate');
    
    const overheadCount = data.overhead_flights?.length || 0;
    
    if (overheadCount > 0) {
        statusDot.className = 'status-dot active';
        statusText.textContent = `✈️ ${overheadCount} flight${overheadCount > 1 ? 's' : ''} overhead!`;
    } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Standby - No flights overhead';
    }
    
    lastUpdate.textContent = data.last_updated 
        ? new Date(data.last_updated).toLocaleTimeString() 
        : 'Never';
}

// Update flight table
function updateFlightTable(flights) {
    const tbody = document.getElementById('flightTable');
    
    if (!flights || flights.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; opacity: 0.5;">No flights in area</td>
            </tr>
        `;
        return;
    }
    
    // Sort by distance to Mission Beach
    const sortedFlights = [...flights].sort((a, b) => {
        const distA = a.distance_to_mission_beach_km || 999;
        const distB = b.distance_to_mission_beach_km || 999;
        return distA - distB;
    });
    
    tbody.innerHTML = sortedFlights.slice(0, 20).map(flight => {
        const altitude = flight.altitude 
            ? Math.round(flight.altitude * 3.28084).toLocaleString() 
            : 'N/A';
        const distance = flight.distance_to_mission_beach_km !== undefined 
            ? flight.distance_to_mission_beach_km.toFixed(1) 
            : 'N/A';
        const isOverhead = flight.is_over_mission_beach;
        
        return `
            <tr>
                <td><strong>${flight.callsign || 'Unknown'}</strong></td>
                <td>${flight.airline || 'Unknown'}</td>
                <td>${altitude}</td>
                <td>${distance}</td>
                <td>
                    ${isOverhead 
                        ? '<span class="overhead-badge">OVERHEAD</span>' 
                        : '<span style="opacity: 0.5;">Nearby</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// Update statistics
function updateStats(data) {
    const totalFlights = data.total_flights_in_area || 0;
    const overheadCount = data.overhead_flights?.length || 0;
    
    document.getElementById('totalFlights').textContent = totalFlights;
    document.getElementById('overheadCount').textContent = overheadCount;
}

// Update map markers
function updateMapMarkers(flights) {
    if (!map) return;
    
    // Remove existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};
    
    if (!flights) return;
    
    flights.forEach(flight => {
        if (!flight.latitude || !flight.longitude) return;
        
        const isOverhead = flight.is_over_mission_beach;
        const color = isOverhead ? '#00ff00' : '#ff9900';
        const size = isOverhead ? 12 : 8;
        
        // Create plane icon with rotation
        const planeIcon = L.divIcon({
            className: 'plane-marker',
            html: `<div style="
                transform: rotate(${flight.heading || 0}deg);
                font-size: ${size * 2}px;
                color: ${color};
                text-shadow: 0 0 10px ${color};
            ">✈️</div>`,
            iconSize: [size * 2, size * 2],
            iconAnchor: [size, size]
        });
        
        const marker = L.marker([flight.latitude, flight.longitude], {
            icon: planeIcon
        }).addTo(map);
        
        // Add popup with flight info
        const altitude = flight.altitude 
            ? Math.round(flight.altitude * 3.28084).toLocaleString() + ' ft'
            : 'Unknown';
        const speed = flight.velocity 
            ? Math.round(flight.velocity * 2.23694) + ' mph'
            : 'Unknown';
        
        marker.bindPopup(`
            <strong>${flight.callsign || 'Unknown'}</strong><br>
            ${flight.airline || 'Unknown'}<br>
            Altitude: ${altitude}<br>
            Speed: ${speed}<br>
            Distance to MB: ${flight.distance_to_mission_beach_km?.toFixed(1) || 'N/A'} km
        `);
        
        markers[flight.icao24] = marker;
    });
}

// Check for new overhead flights to trigger animation
function checkNewOverheadFlights(overheadFlights) {
    const currentIds = new Set(overheadFlights.map(f => f.icao24));
    
    // Find new flights that just entered the zone
    const newFlights = overheadFlights.filter(f => !overheadFlightIds.has(f.icao24));
    
    if (newFlights.length > 0) {
        // Trigger sound/visual effect
        playFlightAlert();
    }
    
    // Update tracked flights
    overheadFlightIds = currentIds;
}

// Play alert when flight enters zone
function playFlightAlert() {
    // Create a simple beep using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        console.log('Audio not available');
    }
}

// Show error message
function showError(message) {
    const statusText = document.getElementById('statusText');
    statusText.textContent = `⚠️ ${message}`;
    statusText.style.color = '#ff6600';
}

// Reset error styling when data comes back
function clearError() {
    const statusText = document.getElementById('statusText');
    statusText.style.color = '#00ff00';
}
