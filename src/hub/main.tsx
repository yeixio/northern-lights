import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { restoreStorage } from "./native";
import "./hub.css";

// The Northern Lights app: every site you belong to in one feed. It ships as
// the iPhone and Android apps (capacitor.config.ts, mobile/); `npm run dev:hub`
// runs it in a browser for development.

// The site list has to be back in place before sites.ts reads it.
void restoreStorage().finally(async () => {
  const { default: HubApp } = await import("./HubApp");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <HubApp />
    </StrictMode>,
  );
});
