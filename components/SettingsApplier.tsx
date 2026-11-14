"use client";

import { useEffect } from "react";
import { applySettings, readSettings } from "@/lib/settings";
import { sfx, unlockAudio } from "@/lib/sound";

/** Puts the saved options (calm motion, large text) on every game screen. */
export default function SettingsApplier() {
  useEffect(() => {
    applySettings(readSettings());
    unlockAudio();
    // one soft tap for every button; the main action buttons get the "confirm" chime
    const tap = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.("button, a, [role=button]") as HTMLElement | null;
      if (!el || (el as HTMLButtonElement).disabled || el.closest(".bc-match, .fx-match")) return;
      if (el.classList.contains("gx-btn")) sfx("confirm");
      else if (el.classList.contains("gx-hud-back") || el.getAttribute("aria-label") === "Close") sfx("back");
      else sfx("tap");
    };
    document.addEventListener("pointerdown", tap, { passive: true });
    return () => document.removeEventListener("pointerdown", tap);
  }, []);
  return null;
}
