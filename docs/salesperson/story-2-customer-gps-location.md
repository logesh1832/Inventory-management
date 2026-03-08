# Story 2: Customer GPS Location Capture with Leaflet Maps

## Overview
Enhance customer management so salespersons can capture the exact GPS location of a customer using an embedded Leaflet + OpenStreetMap map. Customers are linked to the salesperson who created them. Salespersons can only see their own customers.

## Pre-requisites
- Story 1 (Auth & Roles) completed
- Users table with salesperson role exists

## Acceptance Criteria

### 2.1 Database — Customer Table Updates
- [ ] Add `latitude` (DECIMAL 10,8) column to customers table
- [ ] Add `longitude` (DECIMAL 11,8) column to customers table
- [ ] Add `created_by` (UUID, FK to users) column to customers table
- [ ] Existing customers get NULL for these fields (backward compatible)

### 2.2 Backend — Customer Endpoints Update
- [ ] `POST /api/customers` — accepts latitude, longitude, auto-sets created_by from JWT user
- [ ] `PUT /api/customers/:id` — can update GPS coordinates
- [ ] `GET /api/customers` — if role is salesperson, return only customers where `created_by = current_user.id`; if admin/inventory, return all
- [ ] `GET /api/customers/map` — returns all customers with lat/lng for map plotting (admin/inventory: all, salesperson: own)
- [ ] Validate latitude (-90 to 90) and longitude (-180 to 180)

### 2.3 Frontend — Add/Edit Customer Form with Map
- [ ] Customer form fields: Name, Contact Person, Phone, Email, Address (existing)
- [ ] Below address: embedded Leaflet map (400px height)
- [ ] On page load, auto-detect user's GPS location using Browser Geolocation API
- [ ] Center map on detected location
- [ ] User clicks on map to place a marker pin
- [ ] Pin is **draggable** — user can fine-tune position
- [ ] Latitude and longitude fields auto-update when pin is placed/moved
- [ ] Show lat/lng values below map (read-only display)
- [ ] Optional: reverse geocode pin position to auto-fill address using Nominatim API

### 2.4 Frontend — Customer Detail with Map
- [ ] Customer detail page shows all info + embedded map with pin at saved GPS location
- [ ] Map is view-only (not editable) on detail page
- [ ] If no GPS data saved, show message "No location data available"

### 2.5 Frontend — Customer Map View
- [ ] New page/tab: "Customer Map" showing all customers as pins on a Leaflet map
- [ ] Salesperson: shows only their customers
- [ ] Admin/Inventory: shows all customers
- [ ] Click on a pin to see popup with: Customer Name, Phone, Address
- [ ] Click popup link to go to customer detail page

### 2.6 Frontend — My Customers List (Salesperson)
- [ ] Salesperson sees "My Customers" in sidebar (not "Customers")
- [ ] Table shows only customers created by them
- [ ] Columns: Name, Contact Person, Phone, City, Location (Yes/No icon)
- [ ] Search by name or phone
- [ ] "Add Customer" button

## Dependencies
- `react-leaflet` — React wrapper for Leaflet
- `leaflet` — Map library

## Technical Notes
- OpenStreetMap tiles URL: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Nominatim reverse geocoding: `https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json`
- Nominatim has a rate limit of 1 request/second — add debounce
- Default map center if GPS is not available: Chennai (13.0827, 80.2707)
- Map zoom level: 13 (city level) initially, 16 (street level) after GPS detection
- Leaflet CSS must be imported: `import 'leaflet/dist/leaflet.css'`
- Leaflet default marker icon fix needed for Vite (known issue with marker icon paths)
