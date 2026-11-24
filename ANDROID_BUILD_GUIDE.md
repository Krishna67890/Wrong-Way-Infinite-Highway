# HIGHWAY HAVOC: WRONG WAY — Android Build & Gameplay Guide

> **Environment Note:** This web build environment does not include a Java JDK (`javac`), Gradle, or the Android SDK, so no `.apk` or `.aab` binary was compiled here. All playable 3D game source code, Capacitor config (`capacitor.config.ts`), and the Android Gradle wrapper project (`/android`) are included and ready to compile locally in Android Studio or via Gradle CLI.

---

## 1. Building the Android APK / AAB Locally

### Prerequisites
- **Node.js 20+** and **npm**
- **JDK 17** (`JAVA_HOME` configured)
- **Android Studio** (API Level 37 / `compileSdk 37`, `targetSdk 37`, `minSdk 25` + Build-Tools) or Android command-line tools + Gradle 8.x

### Step-by-Step Instructions

1. **Install dependencies & build the production web bundle:**
   ```bash
   npm install
   npm run build
   ```
   This outputs the optimized production bundle into `dist/`.

2. **Copy `dist/` into the Android assets directory:**
   ```bash
   rm -rf android/app/src/main/assets/public
   mkdir -p android/app/src/main/assets/public
   cp -r dist/* android/app/src/main/assets/public/
   ```
   *(Alternatively, if using Capacitor CLI: `npm i @capacitor/core @capacitor/cli @capacitor/android && npx cap sync android`.)*

3. **Compile the Debug APK directly into `android/apk/`:**
   Run the one-step helper script from the project root:
   ```bash
   ./android/build-apk.sh
   ```
   *(Or on Windows: `android\build-apk.bat`, or inside `/android`: `gradle assembleDebug`.)*
   Gradle automatically copies the compiled APK into:
   `android/apk/highway-havoc-wrong-way-debug.apk`

4. **Compile a Signed Release APK / AAB (for Google Play):**
   Configure your release `signingConfigs` keystore in `android/app/build.gradle`, then run:
   ```bash
   cd android
   gradle assembleRelease bundleRelease
   ```
   Output locations:
   - `android/apk/highway-havoc-wrong-way-release.apk`
   - `android/app/build/outputs/bundle/release/app-release.aab`

5. **Install onto a connected Android device over ADB:**
   ```bash
   adb install -r android/apk/highway-havoc-wrong-way-debug.apk
   ```

---

## 2. Controls & Features

### Touch / Mobile Controls
- **Swipe Left / Right:** Smooth lane switch across the 6-lane wrong-way highway.
- **On-Screen Left / Right Arrows:** Available in `Hybrid` and `Buttons` modes (configurable in Settings).
- **Swipe Up or Hold `NITRO`:** Fires dual-stage nitro flame boost and speed FOV warp.
- **Swipe Down or Hold `BRAKE`:** Decelerates before tight traffic formations.
- **Tilt Steering (Optional):** Toggle **Tilt Steering** in *Settings* to steer via `DeviceOrientationEvent` accelerometer.
- **Garage 360° Preview:** Drag horizontally anywhere on the showroom floor to inspect all 16 vehicles, paint swatches, and decals.

### Keyboard Controls (Desktop / Chromebook / Emulator)
- **`A` / `D` or `Left` / `Right` Arrow:** Change lanes.
- **`Space` / `W` / `Up` Arrow:** Nitro boost.
- **`S` / `Down` Arrow:** Brake.
- **`Esc`:** Pause / Resume.

---

## 3. AdMob Ads & External Services Scope
- **Real Google AdMob SDK Integrated (Android Native):**
  - **App ID:** `ca-app-pub-1889923922299467~6416515245` (configured in `android/app/src/main/AndroidManifest.xml`)
  - **Ad Unit ID:** `ca-app-pub-1889923922299467/9972616872` (loaded via `com.google.android.gms:play-services-ads:23.3.0` in `MainActivity.java` with `AndroidAdsBridge`)
  - Triggers from Game Over **Watch Ad · 2X Coins** and **Watch Ad · Free Revive**. Supports Rewarded, Rewarded Interstitial, and Interstitial units seamlessly.
- **Offline-First Career Storage:** All 16 unlocked vehicles, paints, decals, 8×10 upgrade levels, 8 worlds, daily missions, 28 achievements, daily login streak, and Top 10 run records persist locally in `localStorage`.

---

## 4. Android Verification Checklist
- [ ] Six-lane highway renders smoothly at target FPS across `Low`, `Medium`, and `High` graphics presets.
- [ ] All 16 vehicles across Sports, Supercars, Hypercars, Luxury, Limousines, and Special unlock, save, and equip persistently.
- [ ] 4-stage hull damage (`100–75`, `74–50`, `49–25` engine smoke, `24–1` heavy smoke & flickering headlights) triggers accurately without repeat collision bugs.
- [ ] Boss Chase pursuit (`Boss Escape` mode and 1,400m+ Endless encounters) displays live swerve warnings and 60s countdown.
- [ ] AdMob ads (`ca-app-pub-1889923922299467/9972616872`) display on Game Over for 2X Coins & Free Revive inside the compiled Android APK.
- [ ] App switching / minimizing on Android pauses active runs cleanly (`visibilitychange`) and stops engine audio.
