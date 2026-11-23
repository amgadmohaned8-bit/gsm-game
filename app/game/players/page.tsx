"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTransfers } from "@/lib/football/useTransfers";
import GsmMark from "@/components/GsmMark";

/** "Squad" in the game menu: your own players, with Sell, are on your club page. */
export default function PlayersPage() {
  const router = useRouter();
  const { ctx, error } = useTransfers();
  useEffect(() => {
    if (ctx) router.replace(`/game/club/${ctx.clubId}`);
  }, [ctx, router]);
  return (
    <main className="fx-loading">
      <GsmMark size={60} />
      <p role={error ? "alert" : undefined}>{error || "Opening your squad..."}</p>
    </main>
  );
}
