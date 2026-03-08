/**
 * Vaultia — Firebase SDK Loader
 * Dynamically loads Firebase compat SDKs with localStorage fallback
 */

import { FIREBASE_SDK_URLS } from "./config.js";

let _loadPromise = null;

/**
 * Loads Firebase SDKs sequentially from CDN.
 * Returns true if all loaded, false if any failed.
 */
export function loadFirebaseSDKs() {
  if (_loadPromise) return _loadPromise;

  _loadPromise = new Promise((resolve) => {
    let index = 0;

    function loadNext() {
      if (index >= FIREBASE_SDK_URLS.length) {
        resolve(true);
        return;
      }
      const url = FIREBASE_SDK_URLS[index++];
      const script = document.createElement("script");
      script.src = url;
      script.onload = loadNext;
      script.onerror = () => {
        console.warn(`[Vaultia] Failed to load Firebase SDK: ${url}`);
        resolve(false);
      };
      document.head.appendChild(script);
    }

    loadNext();
  });

  return _loadPromise;
}
