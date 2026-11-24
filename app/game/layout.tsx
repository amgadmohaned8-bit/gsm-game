import { Suspense, type ReactNode } from "react";
import SettingsApplier from "@/components/SettingsApplier";
import KickoffNotifier from "@/components/KickoffNotifier";
import FriendNotices from "@/components/FriendNotices";
import PushRegister from "@/components/PushRegister";
import PrefsSync from "@/components/PrefsSync";
import "./teal.css";

// Pages and the notifier read the URL (params, pathname, search). Next needs those under a Suspense boundary.
export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="gsm-teal">
        <Suspense fallback={null}>{children}</Suspense>
      </div>
      <Suspense fallback={null}>
        <KickoffNotifier />
      </Suspense>
      <Suspense fallback={null}>
        <FriendNotices />
      </Suspense>
      <PushRegister />
      <PrefsSync />
      <SettingsApplier />
    </>
  );
}
