"use client";

/**
 * Alerts that reach the player OUTSIDE the game.
 *
 *  - In the installed app (Capacitor) they are real phone notifications scheduled with the
 *    system, so they arrive even when GSM is closed. Needs the plugin once in the app project:
 *    `npm i @capacitor/local-notifications && npx cap sync`.
 *  - In a browser they use the Notification API, which only fires while the page is open.
 */

export type AlertState = "granted" | "denied" | "default" | "none";

type Local = {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  createChannel?(c: { id: string; name: string; description?: string; importance: number; vibration?: boolean }): Promise<void>;
  schedule(o: { notifications: { id: number; title: string; body: string; channelId?: string; schedule?: { at: Date; allowWhileIdle?: boolean }; smallIcon?: string; extra?: unknown }[] }): Promise<unknown>;
  cancel(o: { notifications: { id: number }[] }): Promise<void>;
};

const CHANNEL = "gsm-main";
let channelDone = false;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function local(): Local | null {
  try {
    const cap = (window as unknown as { Capacitor?: { Plugins?: { LocalNotifications?: Local } } }).Capacitor;
    return cap?.Plugins?.LocalNotifications ?? null;
  } catch {
    return null;
  }
}

const norm = (s: string): AlertState => (s === "granted" ? "granted" : s === "denied" ? "denied" : "default");

export async function alertState(): Promise<AlertState> {
  if (typeof window === "undefined") return "none";
  const ln = local();
  if (ln) {
    try { return norm((await ln.checkPermissions()).display); } catch { return "none"; }
  }
  return typeof Notification === "undefined" ? "none" : norm(Notification.permission);
}

export async function askAlerts(): Promise<AlertState> {
  const ln = local();
  if (ln) {
    try { return norm((await ln.requestPermissions()).display); } catch { return "none"; }
  }
  if (typeof Notification === "undefined") return "none";
  return norm(await Notification.requestPermission());
}

async function channel(ln: Local) {
  if (channelDone) return;
  channelDone = true;
  try { await ln.createChannel?.({ id: CHANNEL, name: "GSM", description: "Matchdays, the transfer market and your club", importance: 4, vibration: true }); } catch { /* older Android: no channels */ }
}

/** show one right now (the game is open) */
export async function alertNow(title: string, body: string, tag: string) {
  if ((await alertState()) !== "granted") return;
  const ln = local();
  try {
    if (ln) {
      await channel(ln);
      await ln.schedule({ notifications: [{ id: 9000 + (Math.abs(hash(tag)) % 900), title, body, channelId: CHANNEL, schedule: { at: new Date(Date.now() + 400) } }] });
    } else {
      new Notification(title, { body, tag });
    }
  } catch { /* alerts are optional */ }
}

/** ask the phone to show it at a later time, even if the game is closed */
export async function alertAt(id: number, when: number, title: string, body: string) {
  if (typeof window === "undefined") return;
  clearTimeout(timers.get(id));
  const delay = when - Date.now();
  if (delay <= 0 || (await alertState()) !== "granted") return;
  const ln = local();
  try {
    if (ln) {
      await channel(ln);
      await ln.cancel({ notifications: [{ id }] });
      await ln.schedule({ notifications: [{ id, title, body, channelId: CHANNEL, schedule: { at: new Date(when), allowWhileIdle: true } }] });
    } else if (delay < 2 ** 31 - 1) {
      timers.set(id, setTimeout(() => { try { new Notification(title, { body, tag: `gsm-${id}` }); } catch { /* ignore */ } }, delay));
    }
  } catch { /* alerts are optional */ }
}

export async function alertCancel(id: number) {
  clearTimeout(timers.get(id));
  const ln = local();
  try { await ln?.cancel({ notifications: [{ id }] }); } catch { /* ignore */ }
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
