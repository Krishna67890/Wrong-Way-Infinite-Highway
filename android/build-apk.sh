#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/3] Building production web bundle..."
npm run build

echo "[2/3] Syncing dist/ -> android/app/src/main/assets/public/..."
rm -rf android/app/src/main/assets/public
mkdir -p android/app/src/main/assets/public
cp -r dist/* android/app/src/main/assets/public/

echo "[3/3] Building Android APK into android/apk/..."
cd android
if [ -x "./gradlew" ]; then
  ./gradlew assembleDebug
elif command -v gradle >/dev/null 2>&1; then
  gradle assembleDebug
else
  echo "ERROR: Neither ./gradlew nor 'gradle' is runnable here. Open /android in Android Studio or install JDK 17 + Android SDK 37."
  exit 1
fi

echo "Done! APK stored at: android/apk/highway-havoc-wrong-way-debug.apk"
