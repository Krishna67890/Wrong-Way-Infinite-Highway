@echo off
setlocal
cd /d "%~dp0.."

echo [1/3] Building production web bundle...
call npm run build
if errorlevel 1 exit /b 1

echo [2/3] Syncing dist\ to android\app\src\main\assets\public\...
if exist android\app\src\main\assets\public rmdir /s /q android\app\src\main\assets\public
mkdir android\app\src\main\assets\public
xcopy /E /I /Y dist\* android\app\src\main\assets\public\ >nul

echo [3/3] Building Android APK into android\apk\...
cd android
where gradle >nul 2>&1
if errorlevel 1 (
  echo ERROR: gradle not found. Open the android\ folder in Android Studio or install JDK 17 + Gradle 8.x + Android SDK 37.
  exit /b 1
)

call gradle assembleDebug
if errorlevel 1 exit /b 1
echo Done! APK stored at: android\apk\highway-havoc-wrong-way-debug.apk
