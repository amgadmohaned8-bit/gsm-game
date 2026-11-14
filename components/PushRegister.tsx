"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { registerPush } from "@/lib/push";

/** In the installed Android app, tells the server which phone to alert for this manager. */
export default function PushRegister() {
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) await registerPush(supabase);
    })();
  }, []);
  return null;
}
