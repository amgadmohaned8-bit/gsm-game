"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { activeSeason } from "@/lib/football/season";
import { loadFeed, type Feed, type Post, type Slide, type Story } from "@/lib/football/social";
import type { Tone } from "@/lib/football/press";
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
        {shown.map((c, i) => <li key={i} dir="auto"><b>{c.who}</b> {c.text}</li>)}
      </ul>
      <form className="sc-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment..." dir="auto" maxLength={160} aria-label="Add a comment" />
        <button type="submit" disabled={!text.trim()}>Post</button>
      </form>
    </article>
  );
}

const tabs: { icon: IconName; label: string; href: string }[] = [
  { icon: "home", label: "Home", href: "/game/dashboard" },
  { icon: "calendar", label: "Fixtures", href: "/game/fixtures" },
  { icon: "news", label: "Feed", href: "/game/social" },
  { icon: "table", label: "League", href: "/game/standings" },
  { icon: "squad", label: "Squad", href: "/game/squad" },
];

export default function SocialPage() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [mine, setMine] = useState<Mine>({ liked: [], saved: [], comments: {} });
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => {
    setMine(readMine());
    try { setSeen(JSON.parse(localStorage.getItem("gsm-social-seen") || "[]")); } catch { /* ignore */ }
    let off = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return router.replace("/");
        const { data: c } = await supabase
          .from("manager_contracts")
          .select("manager_name, selected_club, selected_league, room_id")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (!c?.selected_club) return router.replace("/game/dashboard");
        const league = c.selected_league || "premier-league";
        const season = await activeSeason(supabase, data.user.id, league);
        const f = await loadFeed(supabase, data.user.id, { club: c.selected_club, league, season, name: c.manager_name ?? "Manager", roomId: c.room_id ?? null });
        if (!off) setFeed(f);
      } catch {
        if (!off) setError("Could not load the feed. Check your connection and try again.");
      }
    })();
    return () => { off = true; };
  }, [router]);

  const save = (m: Mine) => { setMine(m); writeMine(m); };
  const open = (s: Story) => {
    const next = filter === s.account ? null : s.account;
    setFilter(next);
    if (next && !seen.includes(next)) {
      const list = [...seen, next];
      setSeen(list);
      try { localStorage.setItem("gsm-social-seen", JSON.stringify(list)); } catch { /* ignore */ }
    }
  };
  const posts = useMemo(() => (feed ? feed.posts.filter((p) => !filter || p.account === filter) : []), [feed, filter]);

  return (
    <main className="sc">
      <div className="sc-bg" aria-hidden="true" />
      <div className="sc-col">
        <header className="sc-top">
          <button type="button" className="sc-brand" onClick={() => router.push("/game/dashboard")} aria-label="Back to the game">
            <GsmMark size={30} /><span>Social</span>
          </button>
          <button type="button" className="sc-icon" aria-label="Back" onClick={() => router.back()}><Icon name="arrow-left" size={22} /></button>
        </header>

        {!feed && !error && <div className="sc-state" role="status">Loading the feed…</div>}
        {error && <div className="sc-state" role="alert">{error}</div>}

        {feed && (
          <>
            <div className="sc-stories" role="list" aria-label="Stories">
              {feed.stories.map((s) => {
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

            {posts.length === 0 ? (
              <div className="sc-state">Nothing posted here yet. Play a match and face the press to start the conversation.</div>
            ) : (
              posts.map((p) => <PostCard key={p.id} post={p} mine={mine} update={save} meName={feed.me.name.split(" ")[0].toLowerCase()} />)
            )}
          </>
        )}
      </div>

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
