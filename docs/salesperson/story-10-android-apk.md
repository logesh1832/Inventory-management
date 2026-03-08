# Story 10: Android APK with Capacitor

## Overview
Package the React web app as an Android APK using Capacitor. The APK provides a native app experience with reliable GPS access, home screen icon, and offline-capable shell. The same codebase serves both web and mobile.

## Pre-requisites
- Stories 1-9 completed (all web features working)
- Android Studio installed on development machine
- Java JDK 17+ installed

## Acceptance Criteria

### 10.1 Capacitor Setup
- [ ] Install Capacitor core and CLI in the client project:
  - `@capacitor/core`
  - `@capacitor/cli`
- [ ] Initialize Capacitor: `npx cap init "GREE Inventory" "com.gree.inventory"`
- [ ] Configure `capacitor.config.ts`:
  - App ID: `com.gree.inventory`
  - App Name: "GREE Inventory"
  - Web dir: `dist` (Vite build output)
  - Server URL for development: `http://10.0.2.2:5173` (Android emulator localhost alias)

### 10.2 Android Platform
- [ ] Add Android platform: `npx cap add android`
- [ ] Build React app: `npm run build`
- [ ] Sync to Android: `npx cap sync android`
- [ ] Open in Android Studio: `npx cap open android`
- [ ] Configure Android minimum SDK: API 26 (Android 8.0)
- [ ] Set target SDK: API 34 (Android 14)

### 10.3 App Icon & Splash Screen
- [ ] Use GREE logo as app icon (generate all required sizes)
- [ ] Generate adaptive icon (foreground + background layers)
- [ ] Splash screen with GREE logo centered on brand color background
- [ ] Use `@capacitor/splash-screen` plugin

### 10.4 Native GPS Plugin
- [ ] Install `@capacitor/geolocation` plugin
- [ ] Configure Android permissions in AndroidManifest.xml:
  - `ACCESS_FINE_LOCATION`
  - `ACCESS_COARSE_LOCATION`
- [ ] Update GPS code in the app to use Capacitor Geolocation when running as APK:
  ```javascript
  import { Geolocation } from '@capacitor/geolocation';
  // Use Capacitor API when in native context, Browser API for web
  ```
- [ ] Handle permission request flow:
  - Request permission on first use
  - If denied: show message explaining why GPS is needed
  - If permanently denied: guide user to app settings

### 10.5 API Base URL Configuration
- [ ] The APK connects to the backend server via network (not localhost)
- [ ] Configure environment-based API URL:
  - Web (development): `http://localhost:5000/api`
  - APK (production): `http://<server-ip>:5000/api` or deployed server URL
- [ ] Store API URL in Capacitor config or environment variable
- [ ] Ensure CORS allows requests from the APK origin

### 10.6 Status Bar & Navigation
- [ ] Use `@capacitor/status-bar` for status bar styling:
  - Background color matching app header (#2057A5)
  - Light text (white icons)
- [ ] Handle Android back button:
  - Navigate back in app history
  - Confirm exit on last page: "Press back again to exit"
- [ ] Use `@capacitor/app` plugin for app lifecycle events

### 10.7 Build APK
- [ ] Generate debug APK for testing:
  - Android Studio → Build → Build Bundle(s) / APK(s) → Build APK(s)
  - Output: `android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] Test on physical Android device:
  - Install via USB or file transfer
  - Verify all features work: login, maps, GPS, quotations
- [ ] Generate signed release APK (for distribution):
  - Create keystore file
  - Configure signing in build.gradle
  - Build signed APK

### 10.8 Feature Testing on APK
- [ ] Login works correctly
- [ ] GPS location capture works (more accurate than browser)
- [ ] Leaflet maps render correctly
- [ ] Customer creation with GPS and geo-fence check works
- [ ] Quotation create/edit/submit works
- [ ] Product catalog loads
- [ ] Dashboard renders with all cards and charts
- [ ] Target progress displays correctly
- [ ] Area boundary shows on map
- [ ] Print/share invoice works (using native share)
- [ ] Navigation and back button work correctly
- [ ] App works on WiFi and mobile data

### 10.9 PWA Fallback (Optional)
- [ ] Add PWA manifest for web users who don't want the APK:
  - manifest.json with app name, icons, theme color
  - Service worker for basic caching (offline shell)
- [ ] "Add to Home Screen" support in mobile browser

## Build & Deploy Commands

```bash
# Development workflow
cd client
npm run build                    # Build React app
npx cap sync android             # Copy build to Android project
npx cap open android             # Open in Android Studio

# Quick run on connected device
npx cap run android

# Live reload during development
# In capacitor.config.ts, set:
# server: { url: 'http://<your-ip>:5173', cleartext: true }
npx cap run android --livereload
```

## File Structure After Capacitor Setup

```
client/
  android/                    # Generated Android project
    app/
      src/
        main/
          AndroidManifest.xml
          java/com/gree/inventory/
          res/
            mipmap-*/         # App icons
            drawable/         # Splash screen
      build.gradle
    gradle/
  capacitor.config.ts         # Capacitor configuration
  dist/                       # Vite build output (synced to Android)
```

## Dependencies
- `@capacitor/core` — Capacitor runtime
- `@capacitor/cli` — Capacitor CLI tools
- `@capacitor/geolocation` — Native GPS
- `@capacitor/splash-screen` — Splash screen
- `@capacitor/status-bar` — Status bar styling
- `@capacitor/app` — App lifecycle & back button

## Technical Notes
- Capacitor uses a WebView to run the React app — same code, native wrapper
- GPS via Capacitor is more reliable and accurate than Browser Geolocation API (especially for background/continuous tracking)
- The APK needs network access to reach the backend server — no offline data support in POC
- For production deployment, the backend should be hosted on a cloud server with a proper domain/IP
- Android Studio is required for building the APK — cannot build from command line alone on first setup
- APK signing keystore should be kept safe — losing it means you cannot update the app on Play Store
- Minimum device requirement: Android 8.0 (Oreo), ~95% of active Android devices
- Estimated APK size: 10-15 MB (includes WebView assets + Leaflet map tiles are loaded online)
