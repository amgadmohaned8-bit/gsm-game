/**
 * The lineup, the tactic and the cards of a manager live on the device they were made on.
 * This copies them to the database too, so another phone or computer shows the same ones.
 * Every call is safe to fail: without the table (supabase/030_manager_prefs.sql) the game just keeps using this device.
 */

const TABLE = "manager_prefs";
const DISCIPLINE = "gsm-discipline";
const stamp = (k: string) => `gsm-ts:${k}`;

type Row = { k: string; v: string; ts: number };
type Card = { id: string; season: string; matchday: number; kind: string };

function read(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

async function client() {
  const mod = await import("@/lib/supabase");
  const { data } = await mod.supabase.auth.getUser();
  return data.user ? { supabase: mod.supabase, userId: data.user.id } : null;
}

/** Call after a lineup, a tactic or the cards were saved on this device. */
export function pushPref(key: string) {
  void (async () => {
    try {
      const v = read(key);
      if (v === null) return;
      const ts = Date.now();
      localStorage.setItem(stamp(key), String(ts));
      const c = await client();
      if (!c) return;
      await c.supabase.from(TABLE).upsert({ user_id: c.userId, k: key, v, ts }, { onConflict: "user_id,k" });
    } catch {
      /* this device keeps it */
    }
  })();
}

/**
 * Brings the newest copy of every saved lineup and tactic onto this device, and sends up the ones only this device has.
 * Returns true when something on this device was replaced (the page then reloads to show it).
 */
export async function syncPrefs(): Promise<boolean> {
  try {
    const c = await client();
    if (!c) return false;
    const { data, error } = await c.supabase.from(TABLE).select("k, v, ts").eq("user_id", c.userId);
    if (error) return false;
    const remote = new Map(((data ?? []) as Row[]).map((r) => [r.k, r]));
    let changed = false;

    const mine = (k: string) => k.startsWith(`gsm-lineup:${c.userId}:`) || k.startsWith(`gsm-tactic:${c.userId}:`);
    const localKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && mine(k)) localKeys.push(k);
    }
    const keys = new Set<string>([...localKeys, ...[...remote.keys()].filter(mine)]);

    for (const k of keys) {
      const r = remote.get(k);
      const local = read(k);
      const localTs = Number(read(stamp(k)) ?? 0);
      if (r && (local === null || r.ts > localTs)) {
        if (local !== r.v) changed = true;
        localStorage.setItem(k, r.v);
        localStorage.setItem(stamp(k), String(r.ts));
      } else if (local !== null && (!r || r.ts < localTs) && (!r || r.v !== local)) {
        pushPref(k);
      }
    }

    // cards: both lists count, nothing is lost
    const r = remote.get(DISCIPLINE);
    const localCards = JSON.parse(read(DISCIPLINE) ?? "[]") as Card[];
    const remoteCards = r ? (JSON.parse(r.v) as Card[]) : [];
    const seen = new Set(localCards.map((x) => `${x.id}|${x.season}|${x.matchday}`));
    const extra = remoteCards.filter((x) => !seen.has(`${x.id}|${x.season}|${x.matchday}`));
    if (extra.length) {
      localStorage.setItem(DISCIPLINE, JSON.stringify([...localCards, ...extra].slice(-400)));
      changed = true;
    }
    if (localCards.length && (!r || localCards.length > remoteCards.length)) pushPref(DISCIPLINE);

    // the style each match was played with: both logs count
    const rs = remote.get("gsm-styles");
    const localLog = JSON.parse(read("gsm-styles") ?? "{}") as Record<string, string>;
    const remoteLog = rs ? (JSON.parse(rs.v) as Record<string, string>) : {};
    const missing = Object.keys(remoteLog).filter((k) => !(k in localLog));
    if (missing.length) {
      for (const k of missing) localLog[k] = remoteLog[k];
      localStorage.setItem("gsm-styles", JSON.stringify(localLog));
      changed = true;
    }
    if (Object.keys(localLog).length && (!rs || Object.keys(localLog).length > Object.keys(remoteLog).length)) pushPref("gsm-styles");

    return changed;
  } catch {
    return false;
  }
}
