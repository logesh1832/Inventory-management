# Story 8: Area Assignment & Geo-Fencing

## Overview
Admin defines geographic areas on a map (polygon or circle) and assigns them to salespersons. When a salesperson creates a customer, the system checks if the customer's GPS location falls within the salesperson's assigned area. If outside, customer creation is blocked.

## Pre-requisites
- Story 1 (Auth & Roles) completed
- Story 2 (Customer GPS) completed
- Leaflet + OpenStreetMap already integrated

## Acceptance Criteria

### 8.1 Database — Area Tables
- [ ] Create `sales_areas` table:
  - id (UUID, PK)
  - area_name (VARCHAR 100, e.g., "Chennai North", "Bengaluru Central")
  - description (TEXT, optional)
  - boundary_type: POLYGON or CIRCLE
  - boundary_polygon (JSONB — array of [lat, lng] coordinate pairs for polygon)
  - center_latitude, center_longitude (DECIMAL — for circle type)
  - radius_km (DECIMAL 6,2 — for circle type)
  - is_active (BOOLEAN, default true)
  - created_by (FK to users)
  - created_at
- [ ] Create `salesperson_areas` table:
  - id (UUID, PK)
  - salesperson_id (FK to users)
  - area_id (FK to sales_areas)
  - assigned_at, assigned_by
  - is_active (BOOLEAN)
  - UNIQUE (salesperson_id, area_id)

### 8.2 Backend — Area CRUD (Admin)
- [ ] `POST /api/areas` — create area
  - Admin only
  - Accept: area_name, description, boundary_type
  - If POLYGON: accept boundary_polygon as JSON array of [lat, lng] pairs (minimum 3 points)
  - If CIRCLE: accept center_latitude, center_longitude, radius_km
  - Validate boundary data is present based on type
- [ ] `GET /api/areas` — list all areas
  - Admin: all areas
  - Salesperson: only their assigned areas
  - Include assigned salesperson count per area
- [ ] `PUT /api/areas/:id` — update area (admin only)
  - Can update name, description, boundary
- [ ] `DELETE /api/areas/:id` — soft delete (set is_active = false)
  - Admin only
  - Warn if salespersons are assigned

### 8.3 Backend — Area Assignment (Admin)
- [ ] `POST /api/areas/assign` — assign area to salesperson
  - Admin only
  - Accept: salesperson_id, area_id
  - Validates both exist and are active
  - Duplicate assignment returns error
- [ ] `DELETE /api/areas/assign/:id` — remove assignment
  - Admin only
  - Sets is_active = false
- [ ] `GET /api/areas/salesperson/:id` — get assigned areas for a salesperson
  - Returns area details with boundary data
  - Used by frontend to draw boundaries on map

### 8.4 Backend — Geo-Fence Check
- [ ] `POST /api/areas/check-location` — check if point is in salesperson's area
  - Accept: latitude, longitude, salesperson_id
  - For each assigned area of the salesperson:
    - POLYGON: run point-in-polygon (ray casting algorithm) on server
    - CIRCLE: calculate Haversine distance from center, check if <= radius_km
  - Return: { allowed: true/false, matching_area: "area_name" or null }
- [ ] Integrate check into `POST /api/customers` endpoint:
  - If user is salesperson and latitude/longitude provided:
    - Call geo-fence check
    - If NOT within any assigned area: return 403 with message "This location is outside your assigned area"
    - If no areas assigned to salesperson: allow (no restriction)
  - Admin/Inventory: skip geo-fence check (they can create customers anywhere)

### 8.5 Frontend — Area Management Page (Admin)
- [ ] "Area Management" in admin sidebar
- [ ] Full-page Leaflet map (top half) + area list (bottom half)
- [ ] Map features:
  - **Draw Polygon**: click points on map to draw boundary, double-click to finish
  - **Draw Circle**: click center point, drag to set radius
  - Use `leaflet-draw` plugin for drawing tools
  - Existing areas shown as colored overlays on map
  - Each area in a different color
  - Click area overlay to see name and assigned salespersons
- [ ] Area creation form (appears after drawing):
  - Area Name (text input)
  - Description (optional textarea)
  - Boundary type auto-detected from drawing tool
  - Coordinates auto-captured from drawn shape
  - "Save Area" button
- [ ] Area list table below map:
  - Area Name, Type (Polygon/Circle), Salespersons Assigned, Status
  - Edit button: re-draw boundary on map
  - Delete button (with confirmation)

### 8.6 Frontend — Area Assignment (Admin)
- [ ] Within area management page or separate tab
- [ ] Select Area from dropdown
- [ ] Select Salesperson from dropdown (show only salesperson role users)
- [ ] "Assign" button
- [ ] Table showing current assignments: Area, Salesperson, Assigned Date
- [ ] Remove assignment button (with confirmation)
- [ ] Visual: on map, click an area to see which salespersons are assigned

### 8.7 Frontend — Salesperson Area Visualization
- [ ] On "Add Customer" page map:
  - Draw the salesperson's assigned area boundary as a semi-transparent overlay
  - If customer pin is placed outside the boundary: show red warning before submit
  - If inside: show green confirmation
- [ ] On "My Customers" map view:
  - Show assigned area boundary as background overlay
  - Customer pins shown within the area
- [ ] On Salesperson Dashboard:
  - Small map card showing their assigned area(s)

### 8.8 Frontend — Geo-Fence Block UX
- [ ] When salesperson submits customer form with location outside area:
  - Show error toast/banner: "This location is outside your assigned area. Please contact admin."
  - Highlight the map boundary in red
  - Form is NOT submitted
  - Salesperson can adjust the pin and retry
- [ ] Client-side pre-check (before API call):
  - Run point-in-polygon / Haversine check in the browser
  - Show immediate warning as soon as pin is placed outside area
  - This is a UX enhancement — server-side check is the authoritative block

### 8.9 Admin — Area Reports
- [ ] Number of customers per area
- [ ] Revenue per area (from converted orders)
- [ ] Salesperson performance per area
- [ ] Show on admin dashboard or as part of area management page

## Geo-Fence Algorithms

### Point-in-Polygon (Ray Casting)
```javascript
function isPointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lng) !== (yj > lng))
      && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

### Haversine Distance (Circle Check)
```javascript
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // distance in km
}

function isPointInCircle(lat, lng, centerLat, centerLng, radiusKm) {
  return haversineDistance(lat, lng, centerLat, centerLng) <= radiusKm;
}
```

## Dependencies
- `react-leaflet-draw` or `leaflet-draw` — for polygon/circle drawing tools on map

## Technical Notes
- Geo-fence check runs both client-side (UX) and server-side (security) — server is authoritative
- Polygon boundary_polygon format: `[[lat1, lng1], [lat2, lng2], [lat3, lng3], ...]` (minimum 3 points, closed polygon)
- If a salesperson has NO areas assigned, geo-fence check is skipped (unrestricted) — this allows gradual rollout
- Areas can overlap between salespersons — a location can be valid for multiple salespersons
- Admin and inventory team users are exempt from geo-fencing
- The `leaflet-draw` plugin provides built-in UI for drawing polygons and circles on the map
