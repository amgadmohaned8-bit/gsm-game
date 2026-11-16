"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { FLAGS, MAX_CAPTION, createPost } from "@/lib/football/socialPosts";
import Icon from "@/components/Icon";
import SocialArt from "@/components/SocialArt";
import "./socialx.css";

/** Write a post or a story: words on a flag colour, or a photo with a caption. */
export default function SocialComposer({
  userId, name, club, start = "post", onClose, onPosted,
}: {
  userId: string; name: string; club: string; start?: "post" | "story"; onClose: () => void; onPosted: (kind: "post" | "story") => void;
}) {
  const [kind, setKind] = useState<"post" | "story">(start);
  const [text, setText] = useState("");
  const [bg, setBg] = useState("egypt");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, busy]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Choose a picture file.");
    if (f.size > 15 * 1024 * 1024) return setError("That picture is too big. Choose one under 15 MB.");
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function clear() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    if (pick.current) pick.current.value = "";
  }

  const empty = !text.trim() && !file;

  async function publish() {
    if (empty || busy) return;
    setBusy(true);
    setError("");
    try {
      await createPost(supabase, { userId, kind, caption: text, file, bg, club, name });
      onPosted(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="sx-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sx-sheet" role="dialog" aria-modal="true" aria-label="Create">
        <header className="sx-head">
          <button ref={first} type="button" className="sx-x" onClick={onClose} aria-label="Close" disabled={busy}><Icon name="close" size={20} /></button>
          <div className="sx-seg" role="tablist" aria-label="What to create">
            {(["post", "story"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "is-on" : ""} onClick={() => setKind(k)}>
                {k === "post" ? "Post" : "Story"}
              </button>
            ))}
          </div>
          <button type="button" className="sx-go" onClick={publish} disabled={empty || busy}>{busy ? "Posting..." : "Share"}</button>
        </header>

        <div className="sx-body">
          <div className={`sx-prev ${kind === "story" ? "is-story" : ""}`}>
            <SocialArt image={preview || null} bg={bg} text={text} story={kind === "story"} />
          </div>

          <div className="sx-tools">
            <label className="sx-label" htmlFor="sx-text">{file ? "Caption" : "What is on your mind, coach?"}</label>
            <textarea id="sx-text" dir="auto" value={text} maxLength={MAX_CAPTION} rows={3} onChange={(e) => setText(e.target.value)} placeholder={file ? "Add a caption..." : "Write your post..."} />
            <small className="sx-count">{text.length}/{MAX_CAPTION}</small>

            <div className="sx-photo">
              <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />
              <button type="button" className="sx-add" onClick={() => pick.current?.click()}><Icon name="upload" size={18} /> {file ? "Change photo" : "Add a photo"}</button>
              {file && <button type="button" className="sx-remove" onClick={clear}>Remove photo</button>}
            </div>

            {!file && (
              <>
                <span className="sx-label">Background</span>
                <div className="sx-flags" role="radiogroup" aria-label="Flag background">
                  {FLAGS.map((f) => (
                    <button key={f.key} type="button" role="radio" aria-checked={bg === f.key} aria-label={f.name} title={f.name} className={bg === f.key ? "is-on" : ""} onClick={() => setBg(f.key)}>
                      <i style={{ background: `linear-gradient(155deg, ${f.colors[0]} 0 34%, ${f.colors[1]} 34% 66%, ${f.colors[2]} 66%)` }} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {error && <p className="sx-error" role="alert">{error}</p>}
            <p className="sx-hint">{kind === "story" ? "A story stays for 24 hours." : "Posts stay on your page."} The managers of your league and your friends can see it and reply.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
