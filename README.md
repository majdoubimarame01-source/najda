# najda — Your alert. Your safety.

**najda** (نجدة, "help / rescue") is a personal-safety app for Sousse. Hackathon MVP, built with React Native + Expo (SDK 58) + TypeScript, Supabase, and Leaflet/OpenStreetMap. Everything is **free with no credit card**.

> Mariem walks home on Bd du 14 Janvier and gets robbed. The phone is grabbed → najda detects the shake → "Mariem, labes?" countdown → the robber doesn't know her code → a **silent alert** goes to her circle with her position → Maram gets "🚨 Mariem is in danger — 350 m from you" → taps **I'm going** and runs to her → Mariem taps **Rani labes — I'm safe** + code.

---

## 1. Free accounts (≈15 min)

| Service | What for | Where |
|---|---|---|
| Expo | EAS cloud build (APK) + push tokens | https://expo.dev/signup |
| Supabase | Database, Realtime, phone auth | https://supabase.com (free project) |
| Firebase *(optional)* | Push when the receiver's app is **killed** | https://console.firebase.google.com (Spark plan) |
| OpenRouteService *(optional)* | Walking route on the helper map | https://openrouteservice.org/dev/#/signup |

You don't need accounts for the map (Leaflet + CARTO dark tiles, © OpenStreetMap contributors), the address (Nominatim), or Expo Push.

## 2. Supabase setup

1. Create a project, then open **SQL Editor** → paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   This creates `circles`, `users` and `alerts`, plus the `respond_alert` / `resolve_alert` functions, and turns on Realtime. It also seeds the circle **Family** (invite code `SOUSSE`) with **Mariem, Maram, Yassine**. The demo PIN for everyone is **1234**.
2. Go to **Authentication → Sign In / Providers → Phone** and enable it. Supabase asks for an SMS provider: pick Twilio and fill in placeholder values (no SMS is actually sent for test numbers). Then add these **test phone numbers** (field "Test Phone Numbers and OTPs"):
   ```
   21620000001=123456,21620000002=123456,21620000003=123456
   ```
   If phone auth can't be enabled, the **demo profile buttons still work**: they fall back to reading the seeded user directly.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public key**.

> ⚠️ RLS policies in `schema.sql` are **demo-grade** (anyone with the anon key can read and write). Production must restrict them to `auth.uid()` and the same `circle_id`.

## 3. Environment

```powershell
Copy-Item .env.example .env
```
Fill in `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and optionally `EXPO_PUBLIC_ORS_KEY` and `EAS_PROJECT_ID` (see step 5).
`.env` and `google-services.json` are in `.gitignore` (never committed). `.easignore` still uploads them to the EAS build.

Without a `.env`, the app runs in **offline demo mode**: everything works on one phone, and the helper phone uses the local trigger.

## 4. Run in development

```powershell
npm install
```
```powershell
npx expo start
```
Scan the QR code with **Expo Go** on Android. Maps, shake, notifications (local), and Realtime all work in Expo Go. **Remote push does not** (Expo Go limitation on Android since SDK 53); use the APK for that.

## 5. Build the APK (EAS, free)

```powershell
npm install -g eas-cli
```
```powershell
eas login
```
```powershell
eas init
```
`eas init` prints a project ID. Put it in `.env` as `EAS_PROJECT_ID=...` (needed for push tokens).

**Push when the app is killed (optional, Firebase):**
1. In Firebase, create a project, add an **Android app** with package **`tn.najda.app`**, then download **`google-services.json`** into this folder.
2. Go to Firebase → Project settings → **Service accounts** → *Generate new private key* (JSON).
3. Run `eas credentials` → Android → preview → **Google Service Account → FCM V1** and upload that JSON.

Without Firebase the APK still builds, and alerts arrive through Supabase Realtime while najda is open or in the background.

**Build** (this folder isn't a git repo, so tell EAS to skip VCS):
```powershell
$env:EAS_NO_VCS = "1"; eas build -p android --profile preview
```
When the build finishes, EAS prints a **download link + QR code**. Open it on both phones and install the APK (allow "install unknown apps").

**If EAS is slow (local build):** this needs JDK 17 + the Android SDK.
```powershell
npx expo prebuild -p android
```
```powershell
cd android; .\gradlew assembleRelease
```
The APK lands in `android/app/build/outputs/apk/release/app-release.apk`.

### Current setup (already done for this project)
- Expo project: **@marame01/najda** · Supabase: `aiwbhitcrcsyiafzsczj` · Firebase: **najda-7869c** (FCM V1 key attached in EAS).
- After installing a new APK, **log out and back in once** on each phone so its push token is saved.
- Backend check before the demo (two simulated phones against the real database):
  ```powershell
  node scripts/simulate-demo.mjs
  ```

## 6. Two-phone demo (≈2 min)

Prep: install the APK on both phones (or phone B can be an Android emulator). Allow notifications and location.
- **Phone A** → login **Mariem**. **Phone B** → login **Maram**. Demo profiles are one tap.
- Demo mode is **ON by default**. Tap the najda logo **5×** to open the demo panel: role (victim/helper), simulate shake, local fallback, reset.

| # | Phone | Action | What the audience sees |
|---|---|---|---|
| 1 | A | Home → SIGNAL → show the grid → Back | Dark map of Sousse, red SIGNAL, report types |
| 2 | A | Turn **Walk mode ON** | "Shake protection active" |
| 3 | A | "Robber" shakes the phone hard (3 strong jolts) | **"Mariem, labes?"** + 5 s red ring, PIN pad, no cancel |
| 4 | A | Nobody enters the code | Screen goes **black**: "Silent alert sent" (tiny grey text) |
| 5 | B | Notification **"🚨 Mariem is in danger — 350 m from you"** → tap | Red "Mariem needs help" map, 350 m, ≈2 min |
| 6 | B | **I'm going — Route** | Maram's dot runs along the route and the distance shrinks. On A: "Maram is on the way" |
| 7 | A | **Rani labes — I'm safe** → PIN 1234 | B turns green: **"Mariem is safe"**. The location is wiped |

Also show: a long press of 3 s on SIGNAL = instant SOS. Then **My circle** (contacts, battery, invite code `SOUSSE`) and **Settings** (change PIN, shake sensitivity).

**Backups on stage**
- Shake doesn't trigger → demo panel → **Simulate shake**.
- No push → Realtime still delivers if najda is open on B.
- No network at all → on B, demo panel → **Trigger demo alert locally**, which plays the same notification and map.
- Reset between runs → demo panel → **Reset my alerts**.

## 7. What's built vs. pitch only

**Built:** phone OTP login (test numbers), shake detection in Walk mode, 15 s check (5 s in demo) with a 4-digit PIN, 3 tries and no cancel, silent alert, Realtime + Expo Push notifications with distance, helper map (route, distance, running ETA, I'm going, helpers see each other, Call victim, Call 197), PIN-protected resolve, SIGNAL grid + long-press SOS, "Alert sent" screen, My circle (status, battery, invite, join, remove), settings, demo mode with offline fallback.

**Pitch only:** real SMS OTP (Twilio / Tunisian gateway), real alerts to nearby users (the "12 nearby" count is simulated), police integration, detection with the app killed or the phone locked (needs a native foreground service), power-button triple press (Android doesn't allow it), audio/video proof, full Arabic RTL.

## Project map

```
src/app/            screens (expo-router)
  login.tsx         phone + OTP, demo profiles
  index.tsx         home map, Walk mode, SIGNAL (long press = SOS)
  report.tsx        "What's happening?" grid
  sent.tsx          "Alert sent"
  check.tsx         "Mariem, labes?" countdown + PIN (shake)
  silent.tsx        black silent-alert screen
  alert/[id].tsx    helper map
  circle.tsx        My circle
  settings.tsx      PIN, sensitivity, privacy, logout
  demo.tsx          hidden demo panel (tap logo 5×)
src/lib/            supabase, alerts, notify, shake, geo, location, pin, auth, store
src/components/     LeafletMap, PinPad, CountdownRing, Logo, Watchers, SafeResolver, ui
supabase/schema.sql tables, functions, realtime, seed
```

Logo: `src/components/Logo.tsx` is a placeholder pin-with-eye SVG. Replace `assets/icon.png` and `assets/android-icon-*.png` with the official logo files.
