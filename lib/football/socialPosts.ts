/**
 * Real social posts and stories written by managers (supabase/023_social.sql).
 * A post is a photo with a caption, or text on a flag-coloured background.
 * A story is the same thing that disappears after a day.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const STORY_HOURS = 24;
export const MAX_CAPTION = 500;
export const MAX_COMMENT = 300;

/* ---------- flag backgrounds ---------- */

export type Flag = { key: string; name: string; colors: [string, string, string] };

export const FLAGS: Flag[] = [
  { key: "egypt", name: "Egypt", colors: ["#ce1126", "#f4efe3", "#111111"] },
  { key: "england", name: "England", colors: ["#c8102e", "#f4f4f4", "#0b1f4b"] },
  { key: "spain", name: "Spain", colors: ["#aa151b", "#f1bf00", "#aa151b"] },
  { key: "germany", name: "Germany", colors: ["#111111", "#dd0000", "#ffce00"] },
  { key: "italy", name: "Italy", colors: ["#009246", "#f4f5f0", "#ce2b37"] },
  { key: "france", name: "France", colors: ["#0055a4", "#f4f4f4", "#ef4135"] },
  { key: "brazil", name: "Brazil", colors: ["#009c3b", "#ffdf00", "#002776"] },
  { key: "argentina", name: "Argentina", colors: ["#74acdf", "#f6f6f6", "#74acdf"] },
  { key: "morocco", name: "Morocco", colors: ["#c1272d", "#006233", "#c1272d"] },
  { key: "portugal", name: "Portugal", colors: ["#006600", "#ff0000", "#ffcc00"] },
  { key: "netherlands", name: "Netherlands", colors: ["#ae1c28", "#f4f4f4", "#21468b"] },
  { key: "saudi", name: "Saudi Arabia", colors: ["#006c35", "#0b3d22", "#f4f4f4"] },
];

export const flagOf = (key: string | null | undefined) => FLAGS.find((f) => f.key === key) ?? FLAGS[0];

/** Three bold colour fields with a soft light and a dark foot, so white text always reads. */
export function flagBackground(key: string | null | undefined): string {
  const [a, b, c] = flagOf(key).colors;
  return [
    "radial-gradient(120% 70% at 85% 0%, rgba(255,255,255,0.30), transparent 55%)",
    "linear-gradient(0deg, rgba(4,6,10,0.78), rgba(4,6,10,0) 62%)",
    `linear-gradient(155deg, ${a} 0%, ${a} 30%, ${b} 30%, ${b} 62%, ${c} 62%, ${c} 100%)`,
  ].join(", ");
}

/* ---------- types ---------- */

export type RComment = {
  id: string;
  post: string;
  uid: string;
  name: string;
  parent: string | null;
  replyTo: string | null;
  body: string;
  at: number;
};

export type RPost = {
  id: string;
  uid: string;
  kind: "post" | "story";
  caption: string;
  image: string | null;
  bg: string | null;
  club: string | null;
  name: string;
  at: number;
  likes: number;
  liked: boolean;
  comments: RComment[];
};

type PostRow = { id: string; user_id: string; kind: "post" | "story"; caption: string; image_url: string | null; bg: string | null; club_id: string | null; author_name: string | null; created_at: string };
type CommentRow = { id: string; post_id: string; user_id: string; author_name: string | null; parent_id: string | null; reply_to: string | null; body: string; created_at: string };

export type Social = { posts: RPost[]; stories: RPost[]; ready: boolean };
export const emptySocial: Social = { posts: [], stories: [], ready: false };

/* ---------- reading ---------- */

export async function loadSocial(client: SupabaseClient, userId: string): Promise<Social> {
  try {
    const { data: rows, error } = await client.from("social_posts").select("*").order("created_at", { ascending: false }).limit(80);
    if (error) return emptySocial;
    const list = (rows ?? []) as PostRow[];
    const ids = list.map((r) => r.id);
    let comments: CommentRow[] = [];
    let likes: { post_id: string; user_id: string }[] = [];
    if (ids.length) {
      const [c, l] = await Promise.all([
        client.from("social_comments").select("*").in("post_id", ids).order("created_at", { ascending: true }),
        client.from("social_likes").select("post_id, user_id").in("post_id", ids),
      ]);
      comments = (c.data ?? []) as CommentRow[];
      likes = (l.data ?? []) as { post_id: string; user_id: string }[];
    }
    const all: RPost[] = list.map((r) => ({
      id: r.id,
      uid: r.user_id,
      kind: r.kind,
      caption: r.caption,
      image: r.image_url,
      bg: r.bg,
      club: r.club_id,
      name: r.author_name ?? "Manager",
      at: new Date(r.created_at).getTime(),
      likes: likes.filter((x) => x.post_id === r.id).length,
      liked: likes.some((x) => x.post_id === r.id && x.user_id === userId),
      comments: comments
        .filter((x) => x.post_id === r.id)
        .map((x) => ({ id: x.id, post: x.post_id, uid: x.user_id, name: x.author_name ?? "Manager", parent: x.parent_id, replyTo: x.reply_to, body: x.body, at: new Date(x.created_at).getTime() })),
    }));
    const cutoff = Date.now() - STORY_HOURS * 3600 * 1000;
    return {
      posts: all.filter((p) => p.kind === "post"),
      stories: all.filter((p) => p.kind === "story" && p.at >= cutoff).sort((a, b) => a.at - b.at),
      ready: true,
    };
  } catch {
    return emptySocial;
  }
}

/** "now", "5m", "3h", "2d" */
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export type Activity = { id: string; at: number; who: string; text: string; post: string; kind: "comment" | "reply" };

/** What others did on my posts and under my comments, newest first. */
export function activityFor(userId: string, posts: RPost[]): Activity[] {
  const out: Activity[] = [];
  for (const p of posts) {
    for (const c of p.comments) {
      if (c.uid === userId) continue;
      const parent = c.parent ? p.comments.find((x) => x.id === c.parent) : null;
      if (p.uid === userId && !c.parent) out.push({ id: c.id, at: c.at, who: c.name, text: c.body, post: p.id, kind: "comment" });
      else if (parent?.uid === userId || (c.parent && p.uid === userId)) out.push({ id: c.id, at: c.at, who: c.name, text: c.body, post: p.id, kind: "reply" });
    }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 30);
}

/* ---------- writing ---------- */

/** Shrinks a photo to at most 1080px on the long side as a jpeg, so a phone picture is a few hundred KB. */
export async function shrink(file: File, max = 1080): Promise<Blob> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("image"));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * k));
    const h = Math.max(1, Math.round(img.height * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function createPost(
  client: SupabaseClient,
  a: { userId: string; kind: "post" | "story"; caption: string; file: File | null; bg: string; club: string; name: string }
) {
  const caption = a.caption.trim().slice(0, MAX_CAPTION);
  let image: string | null = null;
  if (a.file) {
    const blob = await shrink(a.file);
    const path = `${a.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error: up } = await client.storage.from("social-media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up) throw new Error("The photo could not be uploaded. Run supabase/023_social.sql and try again.");
    image = client.storage.from("social-media").getPublicUrl(path).data.publicUrl;
  }
  if (!caption && !image) throw new Error("Write something or add a photo.");
  const { error } = await client.from("social_posts").insert({
    user_id: a.userId,
    kind: a.kind,
    caption,
    image_url: image,
    bg: image ? null : a.bg,
    club_id: a.club,
    author_name: a.name,
  });
  if (error) throw new Error("Could not publish. Run supabase/023_social.sql and try again.");
}

export async function deletePost(client: SupabaseClient, post: RPost) {
  const { error } = await client.from("social_posts").delete().eq("id", post.id);
  if (error) throw error;
  const marker = "/social-media/";
  const at = post.image ? post.image.indexOf(marker) : -1;
  if (at >= 0) await client.storage.from("social-media").remove([post.image!.slice(at + marker.length)]).catch(() => undefined);
}

export async function addComment(
  client: SupabaseClient,
  a: { userId: string; name: string; post: string; body: string; parent?: string | null; replyTo?: string | null }
) {
  const body = a.body.trim().slice(0, MAX_COMMENT);
  if (!body) return;
  const { error } = await client.from("social_comments").insert({
    post_id: a.post,
    user_id: a.userId,
    author_name: a.name,
    parent_id: a.parent ?? null,
    reply_to: a.replyTo ?? null,
    body,
  });
  if (error) throw error;
}

export async function deleteComment(client: SupabaseClient, id: string) {
  const { error } = await client.from("social_comments").delete().eq("id", id);
  if (error) throw error;
}

export async function setLike(client: SupabaseClient, userId: string, post: string, on: boolean) {
  const { error } = on
    ? await client.from("social_likes").insert({ post_id: post, user_id: userId })
    : await client.from("social_likes").delete().eq("post_id", post).eq("user_id", userId);
  if (error && error.code !== "23505") throw error;
}
