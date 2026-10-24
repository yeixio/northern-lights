import type { CapacitorConfig } from "@capacitor/cli";

// The iPhone and Android apps: the Northern Lights app (hub/, src/hub/) in a
// native shell. `npm run build:hub` then `npx cap sync` copies it in.
const config: CapacitorConfig = {
  appId: "com.yeix.northernlights",
  appName: "Northern Lights",
  webDir: "dist/hub",
  ios: { path: "mobile/ios", contentInset: "never" },
  android: { path: "mobile/android" },
};

export default config;
