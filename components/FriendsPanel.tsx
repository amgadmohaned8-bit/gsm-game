"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { answerRequest, loadFriends, removeFriend, searchManagers, sendRequest, type Card } from "@/lib/football/rooms";
import Icon from "./Icon";
import "./friends.css";

type Loaded = Awaited<ReturnType<typeof loadFriends>>;

function Face({ card }: { card: Card }) {
  return card.avatar ? <img className="fr-face" src={card.avatar} alt="" /> : <span className="fr-face fr-ph" aria-hidden="true">{card.manager_name.slice(0, 1).toUpperCase()}</span>;
}

const clubName = (id: string | null) => clubs.find((c) => c.id === id)?.name ?? "No club yet";

export default function FriendsPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<Loaded>({ friends: [], incoming: [], sent: [] });
  const [text, setText] = useState("");
  const [found, setFound] = useState<Card[]>([]);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await loadFriends(supabase, userId));
    } catch {
      setNote("Friends could not load. Run supabase/005_friends_rooms.sql first.");
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setFound([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        setFound(await searchManagers(supabase, userId, text));
      } catch {
        setFound([]);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, userId]);

  async function run(key: string, job: () => Promise<void>, ok?: string) {
    setBusy(key);
    setNote("");
    try {
      await job();
      if (ok) setNote(ok);
      await reload();
    } catch (e: any) {
      setNote(/duplicate|unique/i.test(e?.message ?? "") ? "A request already exists with this manager." : "That did not work. Try again.");
    } finally {
      setBusy("");
    }
  }

  const known = new Set([...data.friends, ...data.incoming, ...data.sent].map((x) => x.card.user_id));

  return (
    <div className="fr">
      <label className="fr-search">
        <Icon name="search" size={18} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Find a manager by name" aria-label="Find a manager by name" />
      </label>

      {found.length > 0 && (
        <ul className="fr-list" aria-label="Search results">
          {found.map((c) => (
            <li key={c.user_id}>
              <Face card={c} />
              <span><strong>{c.manager_name}</strong><small>{clubName(c.selected_club)}</small></span>
              {known.has(c.user_id) ? (
                <em>Added</em>
              ) : (
                <button type="button" disabled={busy === c.user_id} onClick={() => run(c.user_id, () => sendRequest(supabase, userId, c.user_id), "Request sent.")}>
                  Add friend
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {text.trim().length >= 2 && found.length === 0 && <p className="fr-empty">No manager with that name.</p>}

      {data.incoming.length > 0 && (
        <>
          <h4 className="fr-sub">Requests <b>{data.incoming.length}</b></h4>
          <ul className="fr-list">
            {data.incoming.map(({ id, card }) => (
              <li key={id} className="is-new">
                <Face card={card} />
                <span><strong>{card.manager_name}</strong><small>{clubName(card.selected_club)}</small></span>
                <button type="button" onClick={() => run(id, () => answerRequest(supabase, id, true))}>Accept</button>
                <button type="button" className="is-ghost" onClick={() => run(id, () => answerRequest(supabase, id, false))}>Decline</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="fr-sub">Your friends <b>{data.friends.length}</b></h4>
      {data.friends.length === 0 ? (
        <p className="fr-empty">No friends yet. Search a name above, then share your league code from the dashboard to play together.</p>
      ) : (
        <ul className="fr-list">
          {data.friends.map(({ id, card }) => (
            <li key={id}>
              <Face card={card} />
              <span><strong>{card.manager_name}</strong><small>{clubName(card.selected_club)}</small></span>
              <button type="button" className="is-ghost" onClick={() => run(id, () => removeFriend(supabase, id))}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      {data.sent.length > 0 && <p className="fr-empty">Waiting for: {data.sent.map((s) => s.card.manager_name).join(", ")}</p>}
      {note && <p className="fr-note" role="status">{note}</p>}
    </div>
  );
}
