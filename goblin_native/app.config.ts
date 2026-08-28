import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "gobkin",
  slug: "gobkin",
  scheme: "gobkin",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/images/splash-fortress-defense.png",
    resizeMode: "cover",
    backgroundColor: "#07111C",
  },
  ios: {
    supportsTablet: true,
    appleTeamId: "C554RLNNG7",
    bundleIdentifier: "com.astapi.gobkin",
    buildNumber: process.env.IOS_BUILD_NUMBER ?? "1",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
    splash: {
      image: "./assets/images/splash-fortress-defense.png",
      resizeMode: "cover",
      backgroundColor: "#07111C",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#07111C",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.astapi.gobkin",
    splash: {
      image: "./assets/images/splash-fortress-defense.png",
      resizeMode: "cover",
      backgroundColor: "#07111C",
    },
  },
  web: {
    favicon: "./assets/images/favicon.png",
    bundler: "metro",
  },
  plugins: [
    "expo-router",
    "expo-splash-screen",
    "expo-sqlite",
    "expo-notifications",
  ],
  experiments: {
    typedRoutes: true,
  },
});
