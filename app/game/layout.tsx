import type { ReactNode } from "react";
import SettingsApplier from "@/components/SettingsApplier";
import KickoffNotifier from "@/components/KickoffNotifier";

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <KickoffNotifier />
      <SettingsApplier />
    </>
  );
}
