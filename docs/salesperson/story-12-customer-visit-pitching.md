# Story 12: Customer Visit & Pitching (Onsite Check-in/Check-out)

## Overview
When a salesperson reaches a customer location, they can mark themselves as "Onsite" by selecting the customer from a list. The system verifies the salesperson's current GPS location is within 500m of the customer's saved location. Once verified, the visit timer starts. After the conversation/pitching is done, the salesperson clicks "End Visit" to record the visit duration. Admin can view all visits with time spent, location verification status, and visit notes.

## Pre-requisites
- Story 11 (GPS Tracking) completed
- Story 2 (Customer GPS locations saved) completed

## Acceptance Criteria

### 12.1 Database — Visit Tables
- [ ] Create `customer_visits` table:
  - id (UUID, PK)
  - salesperson_id (FK to users)
  - customer_id (FK to customers)
  - tracking_session_id (FK to gps_tracking_sessions, nullable)
  - check_in_at (TIMESTAMP) — when salesperson clicked "Onsite"
  - check_out_at (TIMESTAMP, nullable) — when salesperson clicked "End Visit"
  - duration_minutes (INTEGER, computed on check-out)
  - check_in_latitude (DECIMAL 10,7)
  - check_in_longitude (DECIMAL 10,7)
  - customer_latitude (DECIMAL 10,7) — customer's saved location at time of visit
  - customer_longitude (DECIMAL 10,7)
  - distance_from_customer_m (DECIMAL 8,2) — distance in meters between SP and customer
  - location_verified (BOOLEAN) — true if distance <= 500m
  - visit_purpose (VARCHAR 50): PITCHING / FOLLOW_UP / ORDER_COLLECTION / COMPLAINT / OTHER
  - notes (TEXT) — salesperson can add notes about the visit
  - outcome (VARCHAR 50): INTERESTED / NOT_INTERESTED / ORDER_PLACED / FOLLOW_UP_NEEDED / null
  - created_at
- [ ] INDEX on (salesperson_id, check_in_at) for history queries
- [ ] INDEX on (customer_id, check_in_at) for customer visit history

### 12.2 Backend — Visit Check-in
- [ ] `POST /api/visits/check-in` — Start a customer visit
  - Salesperson only
  - Accept: customer_id, latitude, longitude, visit_purpose
  - Validations:
    - Customer must exist and belong to this salesperson (created_by check)
    - Customer must have latitude/longitude saved
    - Salesperson must not have another active visit (check_out_at IS NULL)
  - Calculate distance between salesperson's current location and customer's location using Haversine
  - Set location_verified = true if distance <= 500 meters
  - If distance > 500m: still allow check-in but set location_verified = false, return warning "You are X meters away from customer location"
  - Link to active tracking session if one exists
  - Return visit record with distance and verification status

### 12.3 Backend — Visit Check-out
- [ ] `POST /api/visits/check-out/:visit_id` — End a customer visit
  - Salesperson only, must own the visit
  - Accept: notes, outcome (optional)
  - Set check_out_at = NOW()
  - Calculate duration_minutes = EXTRACT(EPOCH FROM (check_out_at - check_in_at)) / 60
  - Return updated visit with duration

### 12.4 Backend — Visit Query APIs
- [ ] `GET /api/visits/active` — Get salesperson's active visit (if any)
  - Returns the visit where check_out_at IS NULL, or null
  - Used to restore UI state on page reload
- [ ] `GET /api/visits/my-visits` — Salesperson's visit history
  - Query params: from_date, to_date, customer_id
  - Returns visits with customer_name, duration, outcome
  - Ordered by check_in_at DESC
- [ ] `GET /api/visits` — Admin: all visits
  - Query params: salesperson_id, customer_id, from_date, to_date, location_verified
  - Returns visits with salesperson_name, customer_name
  - Ordered by check_in_at DESC
- [ ] `GET /api/visits/summary` — Admin: visit summary report
  - Query param: date (default today), salesperson_id
  - Returns per salesperson: total_visits, verified_visits, avg_duration_minutes, total_duration
- [ ] `GET /api/visits/customer/:customer_id` — Visit history for a customer
  - All visits to this customer with salesperson name, duration, outcome

### 12.5 Frontend — Salesperson "Onsite" Button
- [ ] On salesperson dashboard (below GPS toggle), add **"Check-in at Customer"** button
  - Only enabled when GPS tracking is active
  - If GPS tracking is OFF: show tooltip "Start GPS tracking first"
- [ ] On clicking "Check-in":
  - Open a modal/drawer:
    - **Select Customer** dropdown (only salesperson's own customers that have GPS location)
    - **Visit Purpose** dropdown: Pitching, Follow Up, Order Collection, Complaint, Other
    - Current GPS location shown on a mini map
    - "Check In" button
  - On submit:
    - Capture current GPS location
    - Call `POST /api/visits/check-in`
    - If location_verified = true: green banner "Location verified - you are at {customer_name}"
    - If location_verified = false: yellow warning "You are {distance}m away from {customer_name}. Visit recorded but location not verified."
- [ ] When visit is active (checked in):
  - Show active visit banner on dashboard:
    - "Visiting: {customer_name}" with pulsing dot
    - Live timer: "Duration: 00:15:32" (counting up)
    - Visit purpose badge
    - "End Visit" button (red)
  - On clicking "End Visit":
    - Open small modal:
      - Notes textarea (optional): "How did the visit go?"
      - Outcome dropdown: Interested, Not Interested, Order Placed, Follow-up Needed
      - "Complete Visit" button
    - Call `POST /api/visits/check-out/:id`
    - Show summary toast: "Visit to {customer_name} completed. Duration: 25 min"

### 12.6 Frontend — Salesperson Visit History
- [ ] "My Visits" page (or tab on My Customers page)
- [ ] Table: Date, Customer, Purpose, Duration, Location Verified (green check / red X), Outcome, Notes
- [ ] Filter by date range, customer
- [ ] Summary card at top: Total Visits Today, Avg Duration, Verified %

### 12.7 Frontend — Admin Visit Dashboard
- [ ] "Visit Reports" in admin sidebar (or tab in Live Tracking page)
- [ ] Date picker + Salesperson filter
- [ ] Summary cards: Total Visits, Avg Duration, Location Verified %, Unique Customers
- [ ] Table: Date/Time, Salesperson, Customer, Purpose, Check-in Time, Check-out Time, Duration, Verified, Outcome
  - Rows with location_verified = false highlighted in yellow
  - Click row to see visit detail on map (show customer pin + salesperson check-in pin + distance line)
- [ ] Map view option: show all visits for selected date as markers
  - Green markers: verified visits
  - Yellow markers: unverified visits
  - Click marker for visit details popup

### 12.8 Frontend — Customer Visit History (on Customer Detail)
- [ ] On customer detail page or My Customers page, show visit count badge
- [ ] Click to see all visits to this customer:
  - Timeline view: date, salesperson, duration, purpose, outcome
  - Helps track follow-up frequency

### 12.9 Visit Rules & Edge Cases
- [ ] Maximum 1 active visit at a time per salesperson
- [ ] If salesperson forgets to check out:
  - Auto check-out after 4 hours with note "Auto-closed: exceeded maximum visit duration"
  - Lazy check on next check-in or on status API call
- [ ] Location verification is informational — does NOT block check-in
  - Admin can filter unverified visits to review
  - Useful for accountability without being too restrictive
- [ ] 500m radius is configurable (could be changed later)
- [ ] Visit can happen without GPS tracking active (but "Check-in at Customer" button encourages tracking to be on)

## Location Verification

### Distance Check (Server-side)
```javascript
// Haversine distance between salesperson and customer
const distance_m = haversineDistance(sp_lat, sp_lng, cust_lat, cust_lng) * 1000; // km to m
const location_verified = distance_m <= 500; // 500 meter threshold
```

### Frontend Mini Map (Check-in Modal)
```
+---------------------------+
|  [Map]                    |
|    [You] ---- 120m ---- [Customer Pin]  |
|                           |
+---------------------------+
| Customer: Lakshmi Hardware|
| Distance: 120m (Verified) |
+---------------------------+
```

## Technical Notes
- Visit duration is calculated server-side on check-out for accuracy
- Frontend shows a live counting timer (cosmetic — actual duration computed server-side)
- Active visit state stored in localStorage to survive page refresh
- Check-in captures salesperson's CURRENT GPS (not the last tracked point) for maximum accuracy
- Customer's saved location (lat/lng) is copied into the visit record at check-in time — if customer location is later updated, historical visits keep the original location
- Visit purpose and outcome help generate sales activity reports
- This feature pairs with GPS tracking but can technically work independently
- The 500m threshold accounts for GPS accuracy variations and the salesperson being near (parking lot, building entrance) but not exactly at the saved customer pin
