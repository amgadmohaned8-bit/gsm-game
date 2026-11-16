import { flagBackground } from "@/lib/football/socialPosts";
import "./socialx.css";

/** What a post or a story looks like: a photo, or words on a flag. */
export default function SocialArt({ image, bg, text, story = false }: { image: string | null; bg: string | null; text: string; story?: boolean }) {
  if (image) {
    return (
      <div className={`sx-art is-photo ${story ? "is-story" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" loading="lazy" />
        {story && text && <p className="sx-over" dir="auto">{text}</p>}
      </div>
    );
  }
  const size = text.length < 40 ? "lg" : text.length < 140 ? "md" : "sm";
  return (
    <div className={`sx-art is-flag ${story ? "is-story" : ""}`} style={{ background: flagBackground(bg) }}>
      <div className="sx-glass">
        <p className={`is-${size}`} dir="auto">{text || "Write something..."}</p>
      </div>
    </div>
  );
}
