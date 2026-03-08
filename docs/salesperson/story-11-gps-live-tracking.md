# Story 11: Salesperson GPS Live Tracking & Daily Route

## Overview
Salesperson can toggle a "GPS Tracking" button on their dashboard. When turned ON, the app captures their GPS location every 5 minutes and sends it to the server. Admin can see all active salesperson locations on a live map. At end of day, the system calculates total travel distance and shows the route on a map.

## Pre-requisites
- Story 1 (Auth & Roles) completed
- Story 2 (Customer GPS / Leaflet) completed
- Story 9 (Dashboards) completed

## Acceptance Criteria

### 11.1 Database — Tracking Tables
- [ ] Create `gps_tracking_sessions` table:
  - id (UUID, PK)
  - salesperson_id (FK to users)
  - started_at (TIMESTAMP)
  - ended_at (TIMESTAMP, nullable — null means still active)
  - total_distance_km (DECIMAL 8,2, default 0)
  - status: ACTIVE / STOPPED
  - created_at
- [ ] Create `gps_location_logs` table:
  - id (UUID, PK)
  - session_id (FK to gps_tracking_sessions)
  - salesperson_id (FK to users)
  - latitude (DECIMAL 10,7)
  - longitude (DECIMAL 10,7)
  - accuracy (DECIMAL — GPS accuracy in meters, from device)
  - recorded_at (TIMESTAMP DEFAULT NOW())
  - INDEX on (session_id, recorded_at) for fast route queries
  - INDEX on (salesperson_id, recorded_at) for admin live view

### 11.2 Backend — Tracking Session APIs
- [ ] `POST /api/tracking/start` — Start tracking session
  - Salesperson only
  - If already has an ACTIVE session, return error "Session already active"
  - Creates new session with status = ACTIVE
  - Returns session ID
- [ ] `POST /api/tracking/stop` — Stop tracking session
  - Salesperson only
  - Sets ended_at = NOW(), status = STOPPED
  - Calculates total_distance_km from all location logs in this session using Haversine
  - Returns session summary (duration, distance, point count)
- [ ] `GET /api/tracking/status` — Get current tracking status
  - Returns active session if exists, or null
  - Used by frontend to restore toggle state on page reload

### 11.3 Backend — Location Log APIs
- [ ] `POST /api/tracking/log` — Record GPS location
  - Salesperson only
  - Accept: latitude, longitude, accuracy
  - Must have an active session, else return error
  - Insert into gps_location_logs
  - Return { logged: true }
- [ ] `POST /api/tracking/log-batch` — Record multiple GPS points at once
  - Accept: array of { latitude, longitude, accuracy, recorded_at }
  - Useful when device was offline and needs to sync queued points
  - Insert all into gps_location_logs

### 11.4 Backend — Admin Live View & History
- [ ] `GET /api/tracking/live` — Admin: get all active salespersons with latest location
  - Admin/Inventory only
  - Returns array: salesperson_name, phone, latest_latitude, latest_longitude, last_updated, session_started_at
  - Only salespersons with ACTIVE sessions
- [ ] `GET /api/tracking/history/:salesperson_id` — Admin: get tracking history
  - Query params: date (default today)
  - Returns all sessions for that date with location points
  - Includes total_distance_km per session
- [ ] `GET /api/tracking/route/:session_id` — Get full route for a session
  - Returns ordered array of [lat, lng] points
  - Used to draw polyline on map
- [ ] `GET /api/tracking/daily-summary` — Admin: daily summary of all salespersons
  - Query param: date (default today)
  - Returns: salesperson_name, total_sessions, total_distance_km, first_start, last_stop, total_duration

### 11.5 Frontend — Salesperson GPS Toggle Button
- [ ] On salesperson dashboard, add a prominent **"Start GPS"** / **"Stop GPS"** toggle button
  - When OFF: shows "Start GPS" in green, GPS icon
  - When ON: shows "Stop GPS" in red, pulsing GPS icon, "Tracking active..." text
- [ ] On clicking "Start GPS":
  - Request browser GPS permission (navigator.geolocation)
  - If permission denied: show error "GPS permission required. Please allow location access."
  - If granted: call `POST /api/tracking/start` to create session
  - Start `setInterval` to capture location every 5 minutes (300000ms)
  - Also capture immediately on start
  - Send each location to `POST /api/tracking/log`
- [ ] On clicking "Stop GPS":
  - Clear the interval
  - Call `POST /api/tracking/stop`
  - Show summary toast: "Tracking stopped. Distance: X.X km, Duration: X hrs"
- [ ] On page reload:
  - Call `GET /api/tracking/status` to check if session is active
  - If active: auto-resume interval (re-start the 5-minute timer)
  - This ensures tracking survives page refresh
- [ ] Show small status bar below the button:
  - "Last updated: 2:35 PM" (time of last GPS log)
  - "Points logged: 24"
  - "Duration: 2h 15m"

### 11.6 Frontend — Admin Live Tracking Map
- [ ] New page: "Live Tracking" in admin sidebar
- [ ] Full-page Leaflet map showing all active salespersons
  - Each salesperson as a marker with their name label
  - Different colored markers per salesperson
  - Click marker to see: name, phone, last updated time, session start time
  - Auto-refresh every 60 seconds (poll `GET /api/tracking/live`)
- [ ] Sidebar panel listing active salespersons:
  - Name, status (active/inactive), last location time
  - Click to center map on that salesperson
- [ ] If no salespersons active: show "No salespersons currently being tracked"

### 11.7 Frontend — Admin Daily Route & Distance
- [ ] Within live tracking page or separate "Tracking History" tab
- [ ] Date picker (default: today)
- [ ] Salesperson dropdown
- [ ] On selecting salesperson + date:
  - Fetch route data from `GET /api/tracking/history/:id?date=YYYY-MM-DD`
  - Draw polyline on map connecting all GPS points in order
  - Show start point (green marker) and end point (red marker)
  - Show total distance, duration, number of stops
- [ ] Daily summary table:
  - Salesperson | Sessions | Distance (km) | Start Time | End Time | Duration
  - Sortable by distance or duration

### 11.8 Background Handling
- [ ] When app tab is inactive (background):
  - The setInterval continues to fire in modern browsers
  - If the browser suspends the timer (mobile), on tab focus, immediately capture location
- [ ] Store last session_id in localStorage so it survives page refresh
- [ ] If location capture fails (GPS timeout), skip that point and retry next interval
- [ ] Queue failed API calls and retry on next successful interval (basic offline support)

## Distance Calculation

### Haversine Formula (Server-side)
```javascript
function calculateTotalDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i-1].latitude, points[i-1].longitude,
      points[i].latitude, points[i].longitude
    );
  }
  return Math.round(total * 100) / 100; // round to 2 decimal places
}
```

## Technical Notes
- GPS interval: 5 minutes (300,000ms) — balances battery life vs tracking accuracy
- Browser Geolocation API with `enableHighAccuracy: true` for best GPS accuracy
- Admin live map refreshes every 60 seconds via polling (not WebSocket — simpler for POC)
- Distance calculation happens server-side when session stops
- Location logs are append-only — never updated or deleted
- Session auto-stops if no location logged for 2 hours (lazy cleanup on next status check)
- All timestamps stored in UTC, displayed in local time on frontend
