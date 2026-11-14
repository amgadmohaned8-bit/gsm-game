import { Suspense, type ReactNode } from "react";
import SettingsApplier from "@/components/SettingsApplier";
import KickoffNotifier from "@/components/KickoffNotifier";

// Pages and the notifier read the URL (params, pathname, search). Next needs those under a Suspense boundary.
export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>{children}</Suspense>
      <Suspense fallback={null}>
        <KickoffNotifier />
      </Suspense>
      <SettingsApplier />
    </>
  );
}
