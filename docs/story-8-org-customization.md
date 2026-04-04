# Story 8: Org-Level Branding & Customization

## Overview

Allow each organization to customize their own branding within the inventory system. An org admin can upload their own sidebar logo, favicon, set a display name, and change the sidebar and accent color codes. All customizations are stored per org and applied dynamically when any user from that org logs in.

Super admin is not affected — their panel always uses the default platform branding.

---

## Terminology

| Term | Description |
|------|-------------|
| **Sidebar Color** | The background color of the left navigation sidebar (default: `#2057A5`) |
| **Accent Color** | The active nav item highlight and button color (default: `#EAB308` — yellow-500) |
| **Sidebar Logo** | The square logo shown at the top-left of the sidebar |
| **Favicon** | The browser tab icon |
| **Display Name** | The org name shown in the sidebar header (defaults to `org_name`) |

---

## Story 8.1: Database — Add Customization Columns to Organizations

**As a** developer,
**I want** to store org branding settings directly on the `organizations` table,
**So that** customizations are loaded alongside org data without a separate table join.

### Schema Changes (migration, add columns if not exist)

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sidebar_color VARCHAR(20) DEFAULT '#2057A5',
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#EAB308',
  ADD COLUMN IF NOT EXISTS sidebar_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
```

- `sidebar_color` — hex color code for sidebar background
- `accent_color` — hex color code for active nav / primary buttons
- `sidebar_logo_url` — path to uploaded logo image (served from `/uploads/`)
- `favicon_url` — path to uploaded favicon image
- `display_name` — optional short name shown in sidebar; falls back to `org_name`

---

## Story 8.2: Backend — Customization API

**As a** org admin,
**I want** API endpoints to read and update my org's branding settings,
**So that** the frontend can persist and apply my customizations.

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/org/customization` | org admin | Get current org's branding |
| `PUT` | `/api/org/customization` | org admin | Update colors + display name |
| `POST` | `/api/org/customization/logo` | org admin | Upload sidebar logo (multipart) |
| `POST` | `/api/org/customization/favicon` | org admin | Upload favicon (multipart) |

### GET `/api/org/customization`
- Returns: `{ sidebar_color, accent_color, sidebar_logo_url, favicon_url, display_name, org_name }`
- `org_id` taken from `req.user.org_id`

### PUT `/api/org/customization`
- Body: `{ sidebar_color?, accent_color?, display_name? }`
- Validates hex color format (`#RRGGBB`) before saving
- Updates only provided fields (COALESCE pattern)
- Returns updated customization object

### POST `/api/org/customization/logo`
- Multipart file upload (field name: `logo`)
- Accepts: `image/png`, `image/jpeg`, `image/svg+xml`, `image/webp`
- Max size: 2MB
- Saves to `server/uploads/orgs/{org_id}/logo.{ext}`
- Updates `sidebar_logo_url` in DB
- Returns: `{ sidebar_logo_url }`

### POST `/api/org/customization/favicon`
- Multipart file upload (field name: `favicon`)
- Accepts: `image/png`, `image/jpeg`, `image/x-icon`, `image/svg+xml`
- Max size: 512KB
- Saves to `server/uploads/orgs/{org_id}/favicon.{ext}`
- Updates `favicon_url` in DB
- Returns: `{ favicon_url }`

### Files to Create/Modify
- `server/src/controllers/orgCustomizationController.js` — NEW
- `server/src/routes/orgCustomizationRoutes.js` — NEW
- `server/src/index.js` — mount at `/api/org/customization`
- `server/src/db/init.sql` — add migration DO block for new columns

---

## Story 8.3: Frontend — Customization Page

**As a** org admin,
**I want** a Customization settings page in the sidebar,
**So that** I can upload my logo, favicon, and set brand colors without touching code.

### Route
- Path: `/customization`
- Access: org admin only (capability: `customization` — add to admin role defaults)
- Nav item: "Customization" with a paintbrush icon, shown only if user has `customization` capability

### Page Layout

```
[ Customization ]

  Sidebar Branding
  ┌─────────────────────────────────────────────────┐
  │ Sidebar Logo      [ Current preview ] [Upload]  │
  │ Favicon           [ Current preview ] [Upload]  │
  │ Display Name      [ text input                ] │
  └─────────────────────────────────────────────────┘

  Colors
  ┌─────────────────────────────────────────────────┐
  │ Sidebar Color   [color picker] [#2057A5 input]  │
  │ Accent Color    [color picker] [#EAB308 input]  │
  └─────────────────────────────────────────────────┘

  Live Preview
  ┌──────────────────┐
  │ [mini sidebar    │
  │  preview with    │
  │  chosen colors   │
  │  and logo]       │
  └──────────────────┘

  [ Save Colors & Name ]
```

### Behavior
- On mount: `GET /api/org/customization` → populate all fields
- Logo/favicon upload: fire immediately on file select (no save button needed)
- Color + display name: saved via "Save Changes" button
- Toast on success/error
- Show current logo/favicon as small preview image; if none, show placeholder

### Files to Create/Modify
- `client/src/pages/Customization.jsx` — NEW
- `client/src/App.jsx` — add `/customization` route
- `client/src/components/Layout.jsx` — read and apply customization
- `server/src/controllers/orgController.js` — add `customization` to `DEFAULT_ADMIN_CAPABILITIES`

---

## Story 8.4: Apply Customization Dynamically in Layout

**As a** org user,
**I want** the sidebar to reflect my organization's branding,
**So that** the app feels like it belongs to our company, not a generic platform.

### Implementation

- `AuthContext` already fetches `/api/auth/me` on login — extend the me response to include `customization: { sidebar_color, accent_color, sidebar_logo_url, favicon_url, display_name }`
- OR: fetch customization separately in `Layout.jsx` via `GET /api/org/customization` once on mount (simpler, no AuthContext change)
- Apply values:
  - `style={{ backgroundColor: customization.sidebar_color }}` on sidebar `<aside>`
  - Replace hardcoded `#2057A5` with the dynamic color
  - Active nav item: replace `bg-yellow-500` with inline `style={{ backgroundColor: customization.accent_color }}`
  - Replace `/gree-logo.png` with `customization.sidebar_logo_url` (fallback to `/gree-logo.png`)
  - Set favicon dynamically: `document.querySelector("link[rel*='icon']").href = customization.favicon_url`
  - Sidebar display name: `customization.display_name || user?.org_name`

### Color application strategy
Since Tailwind classes are static, dynamic colors must use inline `style` props:
```jsx
// Sidebar background
<aside style={{ backgroundColor: branding.sidebar_color || '#2057A5' }}>

// Active nav item (override Tailwind class)
className={isActive ? 'font-semibold' : 'text-blue-100 hover:bg-white/15'}
style={isActive ? { backgroundColor: branding.accent_color || '#EAB308', color: '#1f2937' } : {}}
```

---

## Story 8.5: Super Admin Org Detail — View Org Branding

**As a** super admin,
**I want** to see the current branding settings for any org when I click on it,
**So that** I have visibility into each org's configuration.

### Implementation
- Clicking an org row in the Organizations page opens an **Org Detail panel/modal**
- Shows: org info (name, code, email, phone, address) + branding preview (logo thumbnail, colors swatches) + user list
- Read-only from super admin — org admins manage their own branding
- Reuses the existing `GET /api/orgs/:id` endpoint (extend to include customization fields)

---

## Acceptance Criteria

- [ ] Org admin can upload a logo (PNG/JPG/SVG, max 2MB) and it appears in the sidebar immediately after refresh
- [ ] Org admin can upload a favicon and it appears in the browser tab
- [ ] Org admin can set sidebar and accent colors via color picker or hex input
- [ ] Changes apply to all users in that org (not just the admin)
- [ ] Super admin panel is never affected by org customizations
- [ ] Invalid hex codes are rejected with a 400 error
- [ ] Uploaded files are scoped per org (`/uploads/orgs/{org_id}/`)
- [ ] Fallback to defaults if no customization is set

---

## File Summary

| File | Action |
|------|--------|
| `server/src/db/init.sql` | Add migration block for 5 new columns on `organizations` |
| `server/src/controllers/orgCustomizationController.js` | NEW — 4 functions |
| `server/src/routes/orgCustomizationRoutes.js` | NEW — 4 routes |
| `server/src/index.js` | Mount `/api/org/customization` |
| `server/src/controllers/orgController.js` | Add `customization` capability to defaults; extend `getOrgById` to return branding |
| `client/src/pages/Customization.jsx` | NEW — settings page |
| `client/src/components/Layout.jsx` | Apply dynamic branding (colors, logo, favicon) |
| `client/src/App.jsx` | Add `/customization` route |
