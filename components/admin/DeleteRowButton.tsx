"use client";

import { useTransition } from "react";

export function DeleteRowButton({
  id,
  action,
  label = "Delete",
  confirmText = "Delete this row? This cannot be undone.",
}: {
  id: string;
  action: (id: string) => Promise<void>;
  label?: string;
  confirmText?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm(confirmText)) return;
        start(async () => {
          await action(id);
        });
      }}
      disabled={pending}
      className="text-red-600 hover:text-red-700 hover:underline text-sm disabled:opacity-50"
    >
      {pending ? "Deleting..." : label}
    </button>
  );
}
