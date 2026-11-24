# Android APK Output Directory (`android/apk/`)

When compiled locally with Gradle or Android Studio (`gradle assembleDebug` / `gradle assembleRelease`, or `./android/build-apk.sh`), the built `.apk` files are automatically copied into this folder:

- `highway-havoc-wrong-way-debug.apk`
- `highway-havoc-wrong-way-release.apk`

> Note: This cloud workspace does not include Java JDK, Gradle, or the Android SDK, so no binary `.apk` file is generated here. Run `./android/build-apk.sh` (macOS/Linux) or `android\build-apk.bat` (Windows) on a machine with Android Studio / Android SDK 37 + JDK 17 to generate the installable `.apk` here.
