"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Drop into any server component page. Subscribes to Postgres changes on the
// given tables and refreshes the server-rendered page when something changes,
// without a full reload.
//
// Changes are gathered for two seconds and refreshed once: a recorder entering
// a match fires many changes, and each refresh re-renders the whole page on
// the server. A tab nobody is looking at doesn't refresh at all; it catches up
// once, when it is looked at again.
export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-${tables.join("-")}`);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let missed = false;

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        missed = true;
        return;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        router.refresh();
      }, 2000);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && missed) {
        missed = false;
        router.refresh();
      }
    };

    tables.forEach((table) => {
      channel.on("postgres_changes" as any, { event: "*", schema: "public", table }, refresh);
    });
    channel.subscribe();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [tables, router]);
  return null;
}
