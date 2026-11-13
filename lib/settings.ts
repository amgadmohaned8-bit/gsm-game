"use client";

import { useCallback, useEffect, useState } from "react";

/** Game options. They live on this device, so they apply before anything loads. */
export type Settings = {
  /** the press conference before a match */
  press: boolean;
  /** play the studio before a match */
  studio: boolean;
  /** how the match runs: full commentary, quicker, or straight to the result */
  speed: "normal" | "fast" | "instant";
  /** the browser reads the commentary aloud */
  voice: boolean;
  /** no movement-heavy animation */
  calm: boolean;
  /** bigger text */
  large: boolean;
};

export const defaults: Settings = { press: true, studio: true, speed: "normal", voice: false, calm: false, large: false };
const KEY = "gsm-settings";

export function readSettings(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

export function applySettings(s: Settings) {
  const root = document.documentElement;
  root.dataset.motion = s.calm ? "calm" : "";
  root.dataset.font = s.large ? "large" : "";
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(defaults);
  useEffect(() => setSettings(readSettings()), []);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* the setting still applies until the page closes */
      }
      applySettings(next);
      return next;
    });
  }, []);
  return [settings, update];
}
