import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/** True inside the iPhone and Android apps, false in a browser (`npm run dev:hub`). */
export const isNative = Capacitor.isNativePlatform();

/**
 * Keys copied to the phone's own app storage. A WebView's localStorage can be
 * cleared by the system when space runs low, and losing the site list would
 * sign the person out of every site at once.
 */
const KEPT = ["nl-hub-sites"];

/** Before the app starts: put back anything the WebView lost. */
export async function restoreStorage() {
  if (!isNative) return;
  for (const key of KEPT) {
    const { value } = await Preferences.get({ key }).catch(() => ({ value: null }));
    if (value !== null && localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }
}

export function keep(key: string, value: string) {
  if (isNative && KEPT.includes(key)) void Preferences.set({ key, value }).catch(() => undefined);
}
