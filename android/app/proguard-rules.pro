-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.krishna.highwayhavocwrongway.MainActivity** { *; }
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**
