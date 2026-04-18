"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Drop into any server component page. Subscribes to Postgres changes on the
// given tables and calls router.refresh() whenever something changes — so the
// server-rendered UI re-fetches and updates without a full page reload.
export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-${tables.join("-")}`);
    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => router.refresh()
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tables, router]);
  return null;
}
