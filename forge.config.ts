import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

// Helper function to get notarization configuration
function getNotarizationConfig() {
  // App-specific password method
  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    const config: {
      appleId: string;
      appleIdPassword: string;
      teamId: string;
    } = {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID || "",
    };
    // Only return if teamId is provided (required for this method)
    if (process.env.APPLE_TEAM_ID) {
      return config;
    }
    // If teamId is missing, fall through to API key method or return undefined
  }

  // App Store Connect API key method (recommended)
  if (
    process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER
  ) {
    return {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
    };
  }

  return undefined;
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "iHosts",
    executableName: "iHosts",
    appBundleId: "com.nasraldin.ihosts",
    appCategoryType: "public.app-category.utilities",
    // macOS specific configuration
    darwinDarkModeSupport: true,
    // Code signing configuration
    osxSign: process.env.CSC_IDENTITY
      ? {
          identity: process.env.CSC_IDENTITY,
          optionsForFile: (filePath: string) => {
            return {
              entitlements: "entitlements.mac.plist",
            };
          },
        }
      : undefined,
    // Notarization configuration
    osxNotarize: getNotarizationConfig(),
    // This ensures the app name appears correctly in menu bar and dock
    extendInfo: {
      CFBundleName: "iHosts",
      CFBundleDisplayName: "iHosts",
      CFBundleGetInfoString: "iHosts - Modern macOS hosts file manager",
      CFBundleShortVersionString: "1.0.0",
      CFBundleVersion: "1.0.0",
      NSHumanReadableCopyright:
        "Copyright © 2026 Nasr Aldin. All rights reserved.",
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
