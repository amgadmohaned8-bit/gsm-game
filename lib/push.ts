"use client";

/**
 * Phone alerts while the game is closed (Android app, through Firebase).
 * Inside the installed app the phone gets a token; we save it for the signed-in
 * manager, and the server sends a message to that token when something happens
 * (a friend played you). In a browser this does nothing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { Capacitor, registerPlugin } from "@capacitor/core";

type PushPlugin = {
  checkPermissions: () => Promise<{ receive: string }>;
  requestPermissions: () => Promise<{ receive: string }>;
  register: () => Promise<void>;
  addListener: (name: string, cb: (e: { value?: string; error?: string }) => void) => Promise<unknown>;
};

let listening = false;

let cached: PushPlugin | null = null;

function plugin(): PushPlugin | null {
  try {
    if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return null;
    return (cached ??= registerPlugin<PushPlugin>("PushNotifications"));
  } catch {
    return null;
  }
}

export async function registerPush(client: SupabaseClient, ask = false): Promise<"unavailable" | "denied" | "ok"> {
  const P = plugin();
  if (!P) return "unavailable";
  try {
    let perm = await P.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      if (!ask) return "denied";
      perm = await P.requestPermissions();
    }
    if (perm.receive !== "granted") return "denied";
    if (!listening) {
      listening = true;
      await P.addListener("registration", async (e) => {
        if (e.value) await client.rpc("save_push_token", { p_token: e.value, p_platform: "android" });
      });
      await P.addListener("registrationError", (e) => console.error("push registration failed:", e.error));
    }
    await P.register();
    return "ok";
  } catch (err) {
    console.error("push error:", err);
    return "unavailable";
  }
}
