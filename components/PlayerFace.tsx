"use client";

import { useState } from "react";
import { photoOf } from "@/lib/football/playerPhotos";
import type { Player } from "@/lib/football/squads";

/** The player's picture, or nothing when there is none (the card keeps its shirt silhouette). */
export default function PlayerFace({ player, className = "" }: { player: Pick<Player, "id" | "name">; className?: string }) {
  const src = photoOf(player);
  const [bad, setBad] = useState(false);
  if (!src || bad) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`pf ${className}`} src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBad(true)} />;
}
