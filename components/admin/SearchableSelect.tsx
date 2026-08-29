"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Option = { value: string; label: string; hint?: string };

const inputCls =
  "w-full px-3 py-2 rounded border border-slate-300 bg-white text-navy-900 focus:border-navy-700 focus:outline-none disabled:opacity-60";

/**
 * A <select> you can type into.
 *
 * Picking a player used to mean scrolling a list of 516. This filters as you
 * type and submits through a hidden input, so the surrounding form and its
 * server action are unchanged — the field arrives in FormData under the same
 * name a <select> would have used.
 */
export function SearchableSelect({
  name,
  options,
  defaultValue = "",
  required = false,
  placeholder = "Search…",
  emptyLabel = "—",
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [options, query]);

  // Close when the click lands outside, so the list does not sit over the
  // rest of the form.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(o: Option) {
    setValue(o.value);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const o = matches[active];
      if (o) choose(o);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      {/* What the form actually submits. */}
      <input type="hidden" name={name} value={value} required={required} />

      {open ? (
        <input
          autoFocus
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={inputCls}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${inputCls} text-left flex items-center justify-between gap-2`}
        >
          <span className={selected ? "" : "text-slate-400"}>
            {selected ? selected.label : emptyLabel}
          </span>
          <span className="text-slate-400 text-xs shrink-0">▾</span>
        </button>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded border border-slate-300 bg-white shadow-lg">
          {!required && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose({ value: "", label: emptyLabel })}
              className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              {emptyLabel}
            </button>
          )}
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">No match.</p>
          ) : (
            matches.map((o, i) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(o)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  i === active ? "bg-slate-100" : ""
                } ${o.value === value ? "font-medium text-navy-900" : "text-slate-700"}`}
              >
                {o.label}
                {o.hint && (
                  <span className="block text-xs text-slate-500">{o.hint}</span>
                )}
              </button>
            ))
          )}
          {/* The list is capped so a 516-option field stays quick to render. */}
          {matches.length === 50 && (
            <p className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">
              Showing the first 50 — keep typing to narrow.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
