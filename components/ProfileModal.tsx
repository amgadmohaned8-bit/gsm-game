"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import FriendsPanel from "./FriendsPanel";
import Icon from "./Icon";
import Link from "next/link";
import type { SeasonSummary } from "@/lib/football/achievements";
import "./profile.css";

export type TrophyCounts = { league: number; league_cup: number; objective: number };

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  name: string;
  avatar: string | null;
  clubName: string;
  counts: TrophyCounts;
  summary: SeasonSummary | null;
  onSaved: (next: { name: string; avatar: string | null }) => void;
};

const trophies: {
  key: keyof TrophyCounts;
  title: string;
  note: string;
  image: string;
}[] = [
  { key: "league", title: "League champion", note: "Finish first in the league", image: "/trophies/premier-league.png" },
  { key: "league_cup", title: "League Cup", note: "Win the knockout cup", image: "/trophies/league-cup.png" },
  { key: "objective", title: "Board objective", note: "Reach the target the board set", image: "/trophies/board-objective.png" },
];

export default function ProfileModal({
  open,
  onClose,
  userId,
  name,
  avatar,
  clubName,
  counts,
  summary,
  onSaved,
}: Props) {
  const [draftName, setDraftName] = useState(name);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [cached, setCached] = useState<{ done: number; level: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraftName(name);
    setFile(null);
    setPreview("");
    setMessage(null);
    try {
      const c = JSON.parse(localStorage.getItem(`gsm-ach:${userId}`) ?? "null");
      if (c) setCached({ done: c.done, level: Math.min(40, Math.floor(Math.sqrt(c.xp / 20)) + 1) });
    } catch {
      /* no cache yet */
    }
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, name, onClose, userId]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  const shown = preview || avatar;
  const changed = draftName.trim() !== name || !!file;

  function pick(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setMessage({ tone: "bad", text: "Choose an image file." });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setMessage({ tone: "bad", text: "The photo must be under 5 MB." });
      return;
    }
    setMessage(null);
    setFile(f);
  }

  async function save() {
    const clean = draftName.trim();
    if (clean.length < 2) {
      setMessage({ tone: "bad", text: "The name needs at least 2 letters." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      let nextAvatar = avatar;

      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upError } = await supabase.storage
          .from("manager-avatars")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upError) throw upError;
        nextAvatar = supabase.storage.from("manager-avatars").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase
        .from("manager_contracts")
        .update({ manager_name: clean, avatar: nextAvatar, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;

      onSaved({ name: clean, avatar: nextAvatar });
      setFile(null);
      setMessage({ tone: "ok", text: "Profile saved." });
    } catch (err) {
      console.error("Profile save error:", err);
      setMessage({ tone: "bad", text: "Could not save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pf" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pf-panel gx-cut" role="dialog" aria-modal="true" aria-labelledby="pf-title">
        <header className="pf-head">
          <div>
            <p>Manager profile</p>
            <h2 id="pf-title">
              <span className="gx-slant">{name}</span>
            </h2>
            <small>{clubName}</small>
          </div>
          <button ref={closeRef} type="button" className="pf-close" onClick={onClose} aria-label="Close profile">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="pf-scroll">
          {/* achievements first */}
          <section aria-labelledby="pf-ach">
            <h3 id="pf-ach" className="pf-h">
              Achievements
            </h3>
            <Link href="/game/achievements" className="pf-ach-link" onClick={onClose}>
              <span aria-hidden="true">🏅</span>
              <strong>All achievements</strong>
              <small>{cached ? `${cached.done} of 500 unlocked · coach level ${cached.level}` : "500 to unlock. Each one raises your coach level."}</small>
            </Link>
            <ul className="pf-trophies">
              {trophies.map((t) => {
                const n = counts[t.key];
                return (
                  <li key={t.key} className={n > 0 ? "is-won" : "is-locked"}>
                    <div className="pf-trophy-img">
                      <img src={t.image} alt="" loading="lazy" />
                    </div>
                    <strong>{t.title}</strong>
                    <span className="pf-count">{n > 0 ? `x${n}` : "Not yet"}</span>
                    <small>{t.note}</small>
                  </li>
                );
              })}
            </ul>

            {summary && (
              <p className="pf-objective">
                <Icon name="flag" size={16} />
                <span>
                  Board objective this season: <b>{summary.objective.label}</b>
                  {" · "}
                  {summary.played === 0
                    ? "season not started"
                    : summary.complete
                      ? summary.objectiveMet
                        ? "achieved"
                        : "missed"
                      : `currently ${summary.position}${ordinal(summary.position)}`}
                </span>
              </p>
            )}
          </section>

          <section aria-labelledby="pf-edit">
            <h3 id="pf-edit" className="pf-h">
              Your details
            </h3>
            <div className="pf-edit">
              <label className="pf-photo">
                {shown ? <img src={shown} alt="Your photo" /> : <span>GSM</span>}
                <i>
                  <Icon name="upload" size={16} /> Change
                </i>
                <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
              </label>

              <div className="pf-field">
                <label htmlFor="pf-name">Manager name</label>
                <input
                  id="pf-name"
                  value={draftName}
                  maxLength={40}
                  onChange={(e) => setDraftName(e.target.value)}
                />
                <button type="button" className="gx-btn" onClick={save} disabled={saving || !changed}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
                {message && (
                  <p className={`pf-msg is-${message.tone}`} role="status">
                    {message.text}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="pf-friends">
            <h3 id="pf-friends" className="pf-h">
              Friends
            </h3>
            <FriendsPanel userId={userId} />
          </section>
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number) {
  if ([11, 12, 13].includes(n % 100)) return "th";
  return ["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10];
}
