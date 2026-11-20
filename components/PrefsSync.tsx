"use client";

import { useEffect } from "react";
import { syncPrefs } from "@/lib/prefsSync";

/** Once per visit: the lineup, tactic and cards follow the manager to whatever device they play on. */
export default function PrefsSync() {
  useEffect(() => {
    let done = false;
    try {
      done = sessionStorage.getItem("gsm-prefs-synced") === "1";
    } catch {
      /* try anyway */
    }
    if (done) return;
    void syncPrefs().then((changed) => {
      try {
        sessionStorage.setItem("gsm-prefs-synced", "1");
      } catch {
        /* a reload below would loop only if this keeps failing, so skip it */
        return;
      }
      if (changed) window.location.reload();
    });
  }, []);
  return null;
}
