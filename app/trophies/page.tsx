
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TrophyCabinet from "@/components/trophy-cabinet/TrophyCabinet";
import { fetchManagerTrophies } from "@/lib/trophies/queries";
import { supabase } from "@/lib/supabase";
import type { TrophyWin } from "@/lib/trophies/aggregate";

export default function TrophiesPage() {
  const router = useRouter();

  const [wins, setWins] = useState<TrophyWin[]>([]);
  const [managerName, setManagerName] = useState("Manager");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadTrophies() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/");
          return;
        }

        const [trophies] = await Promise.all([
          fetchManagerTrophies(supabase, user.id),
        ]);

        if (!active) return;

        setManagerName(
          user.user_metadata?.manager_name ?? "Manager"
        );

        setAvatarUrl(
          user.user_metadata?.avatar_url ?? null
        );

        setWins(trophies);
      } catch (err) {
        console.error("Trophies loading error:", err);

        if (active) {
          setError("Failed to load trophies. Please try again.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTrophies();

    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#09060F] text-white">
        Loading trophy cabinet...
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#09060F] text-white">
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-purple-600 px-5 py-3"
        >
          Try Again
        </button>
      </main>
    );
  }

  return (
    <TrophyCabinet
      managerName={managerName}
      avatarUrl={avatarUrl}
      wins={wins}
    />
  );
}
