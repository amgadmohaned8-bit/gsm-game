"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { activeSeason } from "@/lib/football/season";
import { loadFeed, type Feed, type Post, type Slide, type Story } from "@/lib/football/social";
import type { Tone } from "@/lib/football/press";
import {
  activityFor, addComment, ago, deleteComment, deletePost, emptySocial, loadSocial, setLike, MAX_COMMENT,
  type RComment, type RPost, type Social,
} from "@/lib/football/socialPosts";
import SocialArt from "@/components/SocialArt";
import SocialComposer from "@/components/SocialComposer";
import StoryViewer from "@/components/StoryViewer";
import Icon, { type IconName } from "@/components/Icon";
import GsmMark from "@/components/GsmMark";
import "./social.css";

const toneName: Record<Tone, string> = { confident: "Confident", humble: "Humble", fiery: "Fiery", calm: "Calm", silent: "No comment" };
const nameOf = (id: string) => clubs.find((c) => c.id === id)?.name ?? id;
const logoOf = (id: string) => clubs.find((c) => c.id === id)?.logo ?? "";
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

type Mine = { liked: string[]; saved: string[]; comments: Record<string, string[]> };
const KEY = "gsm-social";
function readMine(): Mine {
  try { return { liked: [], saved: [], comments: {}, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { liked: [], saved: [], comments: {} }; }
}
function writeMine(m: Mine) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode */ } }

const svg = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Heart = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...svg} fill={on ? "currentColor" : "none"}>
    <path d="M12 20.5s-7.5-4.6-9-9.6C2 7.500 4.200 5 7 5c2 0 3.700 1.100 5 3 1.300-1.900 3-3 5-3 2.800 0 5 2.500 4 5.900-1.500 5-9 9.600-9 9.600z" />
  </svg>
);
const Bubble = () => (<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...svg}><path d="M20.500 12a8.500 8.500 0 0 1-12.300 7.600L3.500 20.500l1-4.400A8.500 8.500 0 1 1 20.500 12z" /></svg>);
const Send = () => (<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...svg}><path d="M21 3 10 14M21 3l-6.500 18-4-7-7-4z" /></svg>);
const Mark = ({ on }: { on: boolean }) => (<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" {...svg} fill={on ? "currentColor" : "none"}><path d="M6 3.500h12v17l-6-4.500-6 4.500z" /></svg>);

function SlideView({ s }: { s: Slide }) {
  if (s.kind === "score") {
    return (
      <div className="sc-slide sc-score">
        <small>{s.label} · Full time</small>
        <div>
          <figure><img src={logoOf(s.home)} alt="" /><figcaption>{nameOf(s.home)}</figcaption></figure>
          <strong><b>{s.hs}</b><i>-</i><b>{s.as}</b></strong>
          <figure><img src={logoOf(s.away)} alt="" /><figcaption>{nameOf(s.away)}</figcaption></figure>
        </div>
      </div>
    );
  }
  return (
    <div className="sc-slide sc-quote">
      <img className="sc-hall" src="/studio/press-hall.jpg" alt="" loading="lazy" />
      <div className="sc-glass">
        <p className="sc-q" dir="rtl" lang="ar">{s.q}</p>
        <blockquote dir="rtl" lang="ar">“{s.a}”</blockquote>
        <span className={`sc-tone is-${s.tone}`}>{toneName[s.tone]}</span>
      </div>
    </div>
  );
}

function PostCard({ post, mine, update, meName }: { post: Post; mine: Mine; update: (m: Mine) => void; meName: string }) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const rail = useRef<HTMLDivElement>(null);
  const liked = mine.liked.includes(post.id);
  const saved = mine.saved.includes(post.id);
  const extra = mine.comments[post.id] ?? [];
  const toggle = (key: "liked" | "saved") => {
    const list = mine[key];
    update({ ...mine, [key]: list.includes(post.id) ? list.filter((x) => x !== post.id) : [...list, post.id] });
  };
  const add = () => {
    const t = text.trim();
    if (!t) return;
    update({ ...mine, comments: { ...mine.comments, [post.id]: [...extra, t.slice(0, 160)] } });
    setText("");
    setOpen(true);
  };
  const all = [...post.comments, ...extra.map((t) => ({ who: meName, text: t, me: true }))];
  const inputRef = useRef<HTMLInputElement>(null);
  const reply = (who: string) => { setText(`@${who} `); setOpen(true); inputRef.current?.focus(); };
  const shown = open ? all : all.slice(-2);

  return (
    <article className="sc-post">
      <header>
        <span className={`sc-ava is-${post.role}`}><img src={post.logo} alt="" /></span>
        <div>
          <strong>{post.handle}</strong>
          <small>{post.name} · Matchday {post.matchday}</small>
        </div>
        {post.tag && <em className="sc-tag">{post.tag}</em>}
      </header>

      <div className="sc-media">
        <div className="sc-rail" ref={rail} onScroll={(e) => { const el = e.currentTarget; setIdx(Math.round(el.scrollLeft / el.clientWidth)); }}>
          {post.slides.map((s, i) => <SlideView key={i} s={s} />)}
        </div>
        {post.slides.length > 1 && <span className="sc-count">{idx + 1}/{post.slides.length}</span>}
        {post.slides.length > 1 && idx < post.slides.length - 1 && (
          <button type="button" className="sc-next" aria-label="Next slide" onClick={() => rail.current?.scrollTo({ left: (idx + 1) * rail.current.clientWidth, behavior: "smooth" })}>
            <Icon name="chevron-right" size={18} />
          </button>
        )}
      </div>

      {post.slides.length > 1 && (
        <div className="sc-dots" aria-hidden="true">{post.slides.map((_, i) => <i key={i} className={i === idx ? "is-on" : ""} />)}</div>
      )}

      <div className="sc-actions">
        <button type="button" className={liked ? "is-liked" : ""} aria-pressed={liked} aria-label="Like" onClick={() => toggle("liked")}><Heart on={liked} /></button>
        <button type="button" aria-label="Comments" onClick={() => setOpen(true)}><Bubble /></button>
        <button type="button" aria-label="Share"><Send /></button>
        <button type="button" className={`sc-save ${saved ? "is-liked" : ""}`} aria-pressed={saved} aria-label="Save" onClick={() => toggle("saved")}><Mark on={saved} /></button>
      </div>

      <p className="sc-likes">{(post.likes + (liked ? 1 : 0)).toLocaleString("en")} likes</p>
      <p className="sc-caption" dir="auto"><b>{post.handle}</b> {post.caption}</p>
      {all.length > 2 && !open && <button type="button" className="sc-more" onClick={() => setOpen(true)}>View all {all.length} comments</button>}
      <ul className="sc-comments">
        {shown.map((c, i) => (
          <li key={i} dir="auto"><b>{c.who}</b> {c.text}{!c.me && <button type="button" className="sx-reply" onClick={() => reply(c.who)}>Reply</button>}</li>
        ))}
      </ul>
      <form className="sc-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..." dir="auto" maxLength={160} aria-label="Add a comment" />
        <button type="submit" disabled={!text.trim()}>Post</button>
      </form>
    </article>
  );
}


function RealPostCard({
  post, me, meName, club, refresh, onDelete,
}: {
  post: RPost; me: string; meName: string; club: string; refresh: () => Promise<void>; onDelete: (p: RPost) => void;
}) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<RComment | null>(null);
  const [open, setOpen] = useState(false);
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setLiked(post.liked); setLikes(post.likes); }, [post.liked, post.likes]);

  const tops = post.comments.filter((c) => !c.parent);
  const repliesOf = (id: string) => post.comments.filter((c) => c.parent === id);
  const shownTops = open ? tops : tops.slice(-2);
  const mineOwn = post.uid === me;

  async function like() {
    const on = !liked;
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    try { await setLike(supabase, me, post.id, on); } catch { await refresh(); }
  }
  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setErr("");
    try {
      await addComment(supabase, { userId: me, name: meName, post: post.id, body, parent: target ? target.parent ?? target.id : null, replyTo: target?.name ?? null });
      setText("");
      setTarget(null);
      setOpen(true);
      await refresh();
    } catch {
      setErr("The comment was not sent. Run supabase/023_social.sql and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(c: RComment) {
    try { await deleteComment(supabase, c.id); await refresh(); } catch { setErr("Could not delete that comment."); }
  }
  const line = (c: RComment, reply = false) => (
    <li key={c.id} className={reply ? "sx-rep" : ""} dir="auto">
      <b>{c.name}</b> {c.replyTo && <em className="sx-to">@{c.replyTo}</em>} {c.body}
      <span className="sx-meta">{ago(c.at)}
        <button type="button" onClick={() => { setTarget(c); setOpen(true); inputRef.current?.focus(); }}>Reply</button>
        {(c.uid === me || mineOwn) && <button type="button" onClick={() => remove(c)}>Delete</button>}
      </span>
    </li>
  );

  return (
    <article className="sc-post">
      <header>
        <span className={`sc-ava ${mineOwn ? "is-you" : "is-manager"}`}><img src={logoOf(post.club ?? club)} alt="" /></span>
        <div>
          <strong>{post.name}</strong>
          <small>{nameOf(post.club ?? club)} · {ago(post.at)}</small>
        </div>
        {mineOwn && <button type="button" className="sx-del" aria-label="Delete this post" onClick={() => onDelete(post)}>Delete</button>}
      </header>
      <div className="sc-media"><div className="sc-rail"><div className="sc-slide"><SocialArt image={post.image} bg={post.bg} text={post.image ? "" : post.caption} /></div></div></div>
      <div className="sc-actions">
        <button type="button" className={liked ? "is-liked" : ""} aria-pressed={liked} aria-label="Like" onClick={like}><Heart on={liked} /></button>
        <button type="button" aria-label="Comments" onClick={() => { setOpen(true); inputRef.current?.focus(); }}><Bubble /></button>
      </div>
      <p className="sc-likes">{likes.toLocaleString("en")} {likes === 1 ? "like" : "likes"}</p>
      {post.image && post.caption && <p className="sc-caption" dir="auto"><b>{post.name}</b> {post.caption}</p>}
      {tops.length > 2 && !open && <button type="button" className="sc-more" onClick={() => setOpen(true)}>View all {post.comments.length} comments</button>}
      <ul className="sc-comments">
        {shownTops.map((c) => (
          <li key={c.id} className="sx-thread">
            <ul>{[line(c), ...(open || tops.length <= 2 ? repliesOf(c.id).map((r) => line(r, true)) : [])]}</ul>
          </li>
        ))}
      </ul>
      {target && (
        <p className="sx-target">Replying to <b>{target.name}</b> <button type="button" onClick={() => setTarget(null)}>Cancel</button></p>
      )}
      <form className="sc-add" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={target ? `Reply to ${target.name}...` : "Add a comment..."} dir="auto" maxLength={MAX_COMMENT} aria-label="Add a comment" />
        <button type="submit" disabled={!text.trim() || busy}>{busy ? "..." : "Post"}</button>
      </form>
      {err && <p className="sx-err" role="alert">{err}</p>}
    </article>
  );
}

const tabs: { icon: IconName; label: string; href: string }[] = [
  { icon: "home", label: "Home", href: "/game/dashboard" },
  { icon: "calendar", label: "Fixtures", href: "/game/fixtures" },
  { icon: "news", label: "Feed", href: "/game/social" },
  { icon: "table", label: "League", href: "/game/standings" },
  { icon: "squad", label: "Lineups", href: "/game/squad" },
];

export default function SocialPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [soc, setSoc] = useState<Social>(emptySocial);
  const [uid, setUid] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [mine, setMine] = useState<Mine>({ liked: [], saved: [], comments: {} });
  const [seen, setSeen] = useState<string[]>([]);
  const [seenStories, setSeenStories] = useState<string[]>([]);
  const [compose, setCompose] = useState<null | "post" | "story">(null);
  const [viewer, setViewer] = useState<null | { list: RPost[]; mine: boolean }>(null);
  const [bell, setBell] = useState(false);
  const [lastLook, setLastLook] = useState(0);
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) setSoc(await loadSocial(supabase, data.user.id));
  }, []);

  useEffect(() => {
    setMine(readMine());
    try { setSeen(JSON.parse(localStorage.getItem("gsm-social-seen") || "[]")); } catch { /* ignore */ }
    try { setSeenStories(JSON.parse(localStorage.getItem("gsm-story-seen") || "[]")); } catch { /* ignore */ }
    try { setLastLook(Number(localStorage.getItem("gsm-social-look") || "0")); } catch { /* ignore */ }
    let off = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return router.replace("/");
        setUid(data.user.id);
        const { data: c } = await supabase
          .from("manager_contracts")
          .select("manager_name, selected_club, selected_league, room_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!c?.selected_club) return router.replace("/game/dashboard");
        const league = c.selected_league || "premier-league";
        const season = await activeSeason(supabase, data.user.id, league);
        const [f, sc] = await Promise.all([
          loadFeed(supabase, data.user.id, { club: c.selected_club, league, season, name: c.manager_name ?? "Manager", roomId: c.room_id ?? null }),
          loadSocial(supabase, data.user.id),
        ]);
        if (off) return;
        setFeed(f);
        setSoc(sc);
      } catch {
        if (!off) setError("Could not load the feed. Check your connection and try again.");
      }
    })();
    // other coaches post and reply while this page is open
    const timer = window.setInterval(() => { if (!document.hidden) refresh().catch(() => undefined); }, 25000);
    return () => { off = true; window.clearInterval(timer); };
  }, [router, refresh]);

  const save = (m: Mine) => { setMine(m); writeMine(m); };
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(""), 2600); };

  const myStories = useMemo(() => soc.stories.filter((p) => p.uid === uid), [soc.stories, uid]);
  const groups = useMemo(() => {
    const map = new Map<string, RPost[]>();
    soc.stories.filter((p) => p.uid !== uid).forEach((p) => map.set(p.uid, [...(map.get(p.uid) ?? []), p]));
    return [...map.entries()].map(([id, list]) => ({ id, list }));
  }, [soc.stories, uid]);
  const activity = useMemo(() => activityFor(uid, soc.posts), [uid, soc.posts]);
  const unread = activity.filter((a) => a.at > lastLook).length;

  function markStories(list: RPost[]) {
    const ids = [...new Set([...seenStories, ...list.map((p) => p.id)])].slice(-200);
    setSeenStories(ids);
    try { localStorage.setItem("gsm-story-seen", JSON.stringify(ids)); } catch { /* ignore */ }
  }
  function watch(list: RPost[], own: boolean) {
    if (!list.length) return;
    setViewer({ list, mine: own });
    markStories(list);
  }
  const open = (s: Story) => {
    const real = groups.find((g) => `m:${g.id}` === s.account);
    if (real) return watch(real.list, false);
    const next = filter === s.account ? null : s.account;
    setFilter(next);
    if (next && !seen.includes(next)) {
      const list = [...seen, next];
      setSeen(list);
      try { localStorage.setItem("gsm-social-seen", JSON.stringify(list)); } catch { /* ignore */ }
    }
  };
  function openBell() {
    setBell((v) => !v);
    const now = Date.now();
    setLastLook(now);
    try { localStorage.setItem("gsm-social-look", String(now)); } catch { /* ignore */ }
  }
  async function removePost(p: RPost) {
    if (!window.confirm(p.kind === "story" ? "Delete this story?" : "Delete this post?")) return;
    try {
      await deletePost(supabase, p);
      if (viewer) setViewer(null);
      await refresh();
    } catch {
      flash("Could not delete. Try again.");
    }
  }

  const meName = feed?.me.name ?? "Manager";
  const meClub = feed?.me.club ?? "";
  const shortName = meName.split(" ")[0].toLowerCase();

  const generated = useMemo(() => (feed ? feed.posts.filter((p) => !filter || p.account === filter) : []), [feed, filter]);
  const real = useMemo(() => soc.posts.filter((p) => !filter || filter === `m:${p.uid}`), [soc.posts, filter]);
  const generatedStories = (feed?.stories ?? []).filter((s) => s.account !== `m:${uid}` && !groups.some((g) => `m:${g.id}` === s.account));

  return (
    <main className="sc">
      <div className="sc-bg" aria-hidden="true" />
      <div className="sc-col">
        <header className="sc-top">
          <button type="button" className="sc-brand" onClick={() => router.push("/game/dashboard")} aria-label="Back to the game">
            <GsmMark size={30} /><span>Social</span>
          </button>
          <div className="sx-top-act">
            <button type="button" className="sc-icon sx-bell" aria-label={`Activity${unread ? `, ${unread} new` : ""}`} onClick={openBell}>
              <Icon name="mail" size={22} />
              {unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
            </button>
            <button type="button" className="sc-icon" aria-label="Back" onClick={() => router.back()}><Icon name="arrow-left" size={22} /></button>
          </div>
        </header>

        {bell && (
          <section className="sx-bellbox" aria-label="Activity">
            {activity.length === 0 ? (
              <p>Comments and replies from other coaches will show here.</p>
            ) : (
              <ul>
                {activity.map((a) => (
                  <li key={a.id}>
                    <b>{a.who}</b> {a.kind === "reply" ? "replied to you" : "commented on your post"}: <span dir="auto">{a.text}</span>
                    <small>{ago(a.at)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!feed && !error && <div className="sc-state" role="status">Loading the feed…</div>}
        {error && <div className="sc-state" role="alert">{error}</div>}

        {feed && (
          <>
            <div className="sc-stories" role="list" aria-label="Stories">
              <div role="listitem" className="sc-story sx-mine">
                <button type="button" className={`sx-mine-btn ${myStories.length && !myStories.every((p) => seenStories.includes(p.id)) ? "" : "is-seen"}`} onClick={() => (myStories.length ? watch(myStories, true) : setCompose("story"))} aria-label={myStories.length ? "View your story" : "Add to your story"}>
                  <span className="sc-ring"><span><img src={logoOf(meClub)} alt="" /></span></span>
                </button>
                <button type="button" className="sx-plus" onClick={() => setCompose("story")} aria-label="Add a story">+</button>
                <small>Your story</small>
              </div>
              {groups.map((g) => {
                const first = g.list[0];
                const fresh = !g.list.every((p) => seenStories.includes(p.id));
                return (
                  <button type="button" role="listitem" key={g.id} className={`sc-story ${fresh ? "" : "is-seen"}`} onClick={() => watch(g.list, false)}>
                    <span className="sc-ring"><span><img src={logoOf(first.club ?? "")} alt="" /></span></span>
                    <small>{first.name}</small>
                    <em>New</em>
                  </button>
                );
              })}
              {generatedStories.map((s) => {
                const isSeen = seen.includes(s.account) || !s.fresh;
                return (
                  <button type="button" role="listitem" key={s.account} className={`sc-story ${isSeen ? "is-seen" : ""} ${filter === s.account ? "is-on" : ""}`} onClick={() => open(s)} aria-pressed={filter === s.account}>
                    <span className="sc-ring"><span><img src={s.logo} alt="" /></span></span>
                    <small>{s.name}</small>
                    {s.label && <em>{s.label}</em>}
                  </button>
                );
              })}
            </div>

            <div className="sx-bar">
              <span className="sc-ava is-you"><img src={logoOf(meClub)} alt="" /></span>
              <button type="button" className="sx-prompt" onClick={() => setCompose("post")}>What is on your mind, coach?</button>
              <button type="button" className="sx-photo-btn" onClick={() => setCompose("post")} aria-label="Post a photo"><Icon name="upload" size={20} /></button>
            </div>

            <div className="sc-feed">
              {filter && (
                <button type="button" className="sx-clear" onClick={() => setFilter(null)}>Showing one account. Show everything</button>
              )}
              {real.map((p) => <RealPostCard key={p.id} post={p} me={uid} meName={meName} club={meClub} refresh={refresh} onDelete={removePost} />)}
              {generated.length === 0 && real.length === 0 ? (
                <div className="sc-state">Nothing posted here yet. Share your first post, or play a match and face the press.</div>
              ) : (
                generated.map((p) => <PostCard key={p.id} post={p} mine={mine} update={save} meName={shortName} />)
              )}
            </div>
          </>
        )}
      </div>

      {compose && uid && (
        <SocialComposer
          userId={uid}
          name={meName}
          club={meClub}
          start={compose}
          onClose={() => setCompose(null)}
          onPosted={async (kind) => {
            setCompose(null);
            await refresh();
            flash(kind === "story" ? "Your story is up for 24 hours." : "Posted. Your league can see it now.");
          }}
        />
      )}
      {viewer && (
        <StoryViewer stories={viewer.list} mine={viewer.mine} onClose={() => setViewer(null)} onDelete={removePost} />
      )}
      {toast && <div className="sx-toast" role="status">{toast}</div>}

      <nav className="sc-tabs" aria-label="Game">
        {tabs.map((t) => (
          <button type="button" key={t.label} aria-current={t.label === "Feed" ? "page" : undefined} onClick={() => t.label !== "Feed" && router.push(t.href)}>
            <Icon name={t.icon} size={24} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
