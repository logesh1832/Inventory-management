# Story 13: Single Session Enforcement & Login Activity Tracking

## Overview
Restrict salesperson accounts to one active session at a time. When a salesperson logs in on a new device, the previous device is automatically force-logged out and any active GPS session is stopped cleanly. All login activity is logged and visible to admin across existing pages (User Management, Live Tracking, Dashboard).

## Problem
- Salesperson may log in on multiple devices simultaneously
- GPS tracking gets confused with location data from two different cities
- Distance calculation becomes inaccurate (e.g., Koyambedu to Madurai jump in 5 minutes)
- No visibility for admin on login patterns or device switches

## Solution
- One active session per salesperson at a time
- New login auto-stops previous GPS session (distance calculated up to last valid point)
- New login force-logouts previous device (token invalidation)
- Fresh GPS session starts on new device independently
- All login activity logged with device/IP info
- Admin sees login activity in existing pages (no new sidebar menu)

---

## Database Changes

### New Table: `login_sessions`
```sql
CREATE TABLE login_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id VARCHAR(64) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address VARCHAR(45),
    is_active BOOLEAN DEFAULT true,
    logged_out_reason VARCHAR(30) CHECK (logged_out_reason IN ('MANUAL', 'DEVICE_SWITCH', 'EXPIRED', 'ADMIN_FORCE')),
    logged_in_at TIMESTAMP NOT NULL DEFAULT NOW(),
    logged_out_at TIMESTAMP
);
```

### Indexes
```sql
CREATE INDEX idx_login_sessions_user ON login_sessions(user_id, is_active);
CREATE INDEX idx_login_sessions_token ON login_sessions(token_id);
```

---

## Backend Changes

### 1. Auth Controller — Login Flow (`POST /api/auth/login`)

**Current:** Generates JWT token and returns it.

**Updated flow:**
1. Validate email/password as before
2. Generate a unique `token_id` (UUID) and embed it in the JWT payload
3. Check for existing active session for this user:
   - If found:
     a. Mark previous `login_sessions` row as `is_active = false`, `logged_out_reason = 'DEVICE_SWITCH'`, `logged_out_at = NOW()`
     b. Auto-stop any active GPS tracking session (calculate distance, set status to STOPPED)
     c. Auto-close any active customer visit (set check_out with note "Auto-closed: device switch")
4. Insert new row into `login_sessions` with device_info and ip_address
5. Return token as before

### 2. Auth Middleware — Token Validation

**Updated flow:**
1. Decode JWT as before
2. Extract `token_id` from payload
3. Check `login_sessions` table: if `token_id` is not active → return 401 with `{ error: "Session expired. You have been logged out.", reason: "DEVICE_SWITCH" }`
4. This forces old device to redirect to login page

### 3. Auth Controller — Logout (`POST /api/auth/logout`)

**New endpoint:**
1. Extract `token_id` from JWT
2. Mark `login_sessions` row as `is_active = false`, `logged_out_reason = 'MANUAL'`
3. Auto-stop GPS session if active
4. Auto-close customer visit if active

### 4. Login Activity Endpoints

**`GET /api/auth/login-activity/:user_id`** (Admin only)
- Returns login history for a specific user
- Fields: device_info, ip_address, logged_in_at, logged_out_at, logged_out_reason, is_active
- Sorted by logged_in_at DESC, limit 50

**`GET /api/auth/device-switches`** (Admin only)
- Returns today's device switches across all salespersons
- Query param: `date` (defaults to today)
- Returns: user_name, old_device, new_device, switched_at, old_session_location

---

## Frontend Changes

### 1. Login Page — Device Info Capture
- Capture `navigator.userAgent` on login
- Send as `device_info` in login request body

### 2. API Interceptor — Force Logout Handling
- On 401 response with `reason: "DEVICE_SWITCH"`:
  - Clear token from localStorage
  - Show alert: "You have been logged out because your account was logged in on another device"
  - Redirect to login page

### 3. Salesperson Dashboard — GPS Auto-Recovery
- On mount, check `/tracking/status`
- If no active session (because device switch stopped it), GPS toggle shows as OFF
- Salesperson can start a new GPS session on the new device

### 4. User Management Page — Login Activity
- Add a "Login History" button/expandable row per user
- Shows recent logins: time, device (parsed from user agent — Mobile/Desktop/Browser), IP, status (Active/Logged Out), reason
- Active session highlighted in green
- Device switch entries highlighted in yellow

### 5. Admin Dashboard — Device Switch Alert Card
- New card in dashboard (only shown when there are device switches today)
- Shows: "2 device switches today"
- Expandable list: "Rajesh Kumar switched at 10:05 AM (Koyambedu → Madurai)"
- Links to User Management for full details

### 6. Live Tracking Page — Device Switch Indicator
- In the active salesperson sidebar, show a small icon/badge if a device switch happened today
- Tooltip: "Switched devices at 10:05 AM"

---

## User Flows

### Flow 1: Normal Login
1. Salesperson opens app on phone → logs in
2. `login_sessions` entry created
3. GPS tracking starts → locations logged
4. End of day → salesperson logs out or GPS auto-stops

### Flow 2: Device Switch
1. Salesperson is logged in on Device A (Koyambedu), GPS active
2. Salesperson logs in on Device B (Madurai)
3. Backend:
   - Marks Device A session as inactive (reason: DEVICE_SWITCH)
   - Stops GPS session — distance calculated up to last Koyambedu point
   - Closes any active customer visit
   - Creates new session for Device B
4. Device A:
   - Next API call returns 401 with reason "DEVICE_SWITCH"
   - Shows alert and redirects to login
   - GPS interval stops (API calls fail)
5. Device B:
   - Login successful, dashboard loads
   - Salesperson starts new GPS session (fresh, from Madurai)
6. Admin sees:
   - Two GPS sessions in tracking history (Koyambedu + Madurai)
   - Device switch alert on dashboard
   - Login activity in User Management

### Flow 3: Admin Force Logout
1. Admin sees suspicious activity in User Management
2. Clicks "Force Logout" button on that user
3. Backend marks session inactive (reason: ADMIN_FORCE)
4. Salesperson's next API call fails with 401
5. Must re-login

---

## GPS Session Handling on Device Switch

**Critical: No distance mixing between devices**

```
Daily Summary — Rajesh Kumar, March 7:
  Session 1: 8:00 AM – 10:05 AM  |  Koyambedu  |  10.2 km  |  Auto-stopped (device switch)
  Session 2: 10:05 AM – 6:00 PM  |  Madurai    |  25.3 km  |  Manual stop
  Total: 35.5 km across 2 sessions
```

---

## Acceptance Criteria

1. Salesperson can only have one active session at a time
2. Logging in on Device B auto-logouts Device A within seconds (next API call)
3. Active GPS session is cleanly stopped on device switch (distance calculated correctly)
4. Active customer visit is auto-closed on device switch
5. No distance jump between devices — separate GPS sessions
6. Old device shows clear message: "Logged out — account active on another device"
7. Admin can see login history per user in User Management
8. Admin dashboard shows device switch alerts for today
9. Live Tracking shows device switch indicator
10. Admin can force-logout any user
11. All login activity persists in `login_sessions` table for audit

---

## Technical Notes

- JWT token now includes a `token_id` field for session validation
- Every authenticated API call checks `login_sessions` for active status (add DB query to auth middleware — cache if needed)
- Device info parsed from User-Agent: categorize as "Mobile (Chrome)", "Desktop (Firefox)", etc.
- IP address captured from `req.ip` or `x-forwarded-for` header
- Consider adding a short in-memory cache (Map) for token_id validation to reduce DB hits on every request
