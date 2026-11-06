plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val releaseStoreFile = System.getenv("ISK_ANDROID_KEYSTORE")
val releaseStorePassword = System.getenv("ISK_ANDROID_STORE_PASSWORD")
val releaseKeyAlias = System.getenv("ISK_ANDROID_KEY_ALIAS")
val releaseKeyPassword = System.getenv("ISK_ANDROID_KEY_PASSWORD")
val releaseSigningValues = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword)
require(releaseSigningValues.all { it.isNullOrBlank() } || releaseSigningValues.none { it.isNullOrBlank() }) {
    "Set all four ISK_ANDROID_* release signing variables."
}

android {
    namespace = "com.isklenses.isk_lenses_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = "27.1.12297006"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.isklenses.isk_lenses_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (releaseSigningValues.none { it.isNullOrBlank() }) {
            create("iskRelease") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("iskRelease") ?: signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
