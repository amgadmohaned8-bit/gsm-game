// @ts-nocheck  (this file runs on Supabase with Deno, not in the Next.js build)
// Supabase Edge Function: send a phone alert when a friend message is saved.
// Called by a Database Webhook on public.friendly_notices (INSERT).
// Secret needed: FIREBASE_SERVICE_ACCOUNT (the whole service-account JSON file, as text).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function accessToken(sa: { client_email: string; private_key: string; token_uri?: string }) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${b64url(sig)}` }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error("Google sign-in failed: " + JSON.stringify(json));
  return json.access_token as string;
}

const CLUBS: Record<string, string> = {};
const nice = (id: string) => CLUBS[id] ?? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const n = payload.record;
    if (!n || payload.type !== "INSERT") return new Response("ignored");

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: tokens } = await db.from("push_tokens").select("token").eq("user_id", n.to_user);
    if (!tokens?.length) return new Response("no phone registered");

    const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
    const access = await accessToken(sa);
    const where = n.kind === "league" ? `league, matchday ${n.matchday ?? ""}`.trim() : "friendly";
    const title = `${n.from_name || "A friend"} played you`;
    const text = `${nice(n.home_club)} ${n.home_score}-${n.away_score} ${nice(n.away_club)} (${where})`;

    for (const { token } of tokens) {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: { token, notification: { title, body: text }, android: { priority: "HIGH", notification: { sound: "default" } } },
        }),
      });
      if (res.status === 404 || res.status === 400) {
        const err = await res.text();
        if (err.includes("UNREGISTERED") || err.includes("INVALID_ARGUMENT")) await db.from("push_tokens").delete().eq("token", token);
      }
    }
    return new Response("sent");
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
