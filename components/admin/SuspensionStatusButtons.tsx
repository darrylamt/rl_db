"use client";

import { useTransition } from "react";

export function SuspensionStatusButtons({
  id,
  status,
  action,
}: {
  id: string;
  status: string;
  action: (id: string, status: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();

  if (status !== "active") return null;

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => action(id, "served"))}
        className="text-emerald-700 hover:underline text-sm disabled:opacity-50"
      >
        Mark served
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(() => action(id, "overturned"))}
        className="text-slate-500 hover:underline text-sm disabled:opacity-50"
      >
        Overturn
      </button>
    </>
  );
}
