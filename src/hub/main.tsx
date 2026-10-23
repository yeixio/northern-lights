import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import HubApp from "./HubApp";
import "./hub.css";

// The Northern Lights app (app.yeix.io): every site you belong to in one feed.
// Built separately from the site itself with `npm run build:hub`.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HubApp />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register("/sw.js");
}
