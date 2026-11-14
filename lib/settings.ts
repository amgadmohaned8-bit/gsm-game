"use client";

import { useCallback, useEffect, useState } from "react";
import { configureSound } from "@/lib/sound";

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
  /** game sounds */
  sound: boolean;
  /** how loud */
  volume: "low" | "mid" | "high";
  /** visual effects: auto picks light mode on phones and weak devices */
  perf: "auto" | "lite" | "full";
};

export const defaults: Settings = { press: true, studio: true, speed: "normal", voice: false, calm: false, large: false, perf: "auto", sound: true, volume: "mid" };
const KEY = "gsm-settings";

export function readSettings(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return defaults;
  }
}

/** Phones, low memory, few cores or data-saver: draw fewer effects so the game stays smooth. */
export function isWeakDevice(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const phone = window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 900;
    return phone || (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4 || Boolean(nav.connection?.saveData);
  } catch {
    return false;
  }
}

export function applySettings(s: Settings) {
  const root = document.documentElement;
  root.dataset.motion = s.calm ? "calm" : "";
  root.dataset.font = s.large ? "large" : "";
  configureSound(s.sound, s.volume);
  root.dataset.perf = s.perf === "lite" || (s.perf === "auto" && isWeakDevice()) ? "lite" : "full";
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
