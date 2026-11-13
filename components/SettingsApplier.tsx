"use client";

import { useEffect } from "react";
import { applySettings, readSettings } from "@/lib/settings";

/** Puts the saved options (calm motion, large text) on every game screen. */
export default function SettingsApplier() {
  useEffect(() => applySettings(readSettings()), []);
  return null;
}
