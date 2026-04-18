"use client";

import { ReactNode } from "react";

const labelCls = "block text-xs uppercase tracking-wider text-navy-200 mb-1";
const inputCls =
  "w-full px-3 py-2.5 rounded bg-navy-800 border border-navy-600 text-white focus:border-gold-400 focus:outline-none disabled:opacity-60";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={inputCls + " " + (props.className ?? "")} />;
}

export function NumberInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <input
      type="number"
      inputMode="numeric"
      {...props}
      className={inputCls + " " + (props.className ?? "")}
    />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    children: ReactNode;
  }
) {
  return (
    <select {...props} className={inputCls + " " + (props.className ?? "")}>
      {props.children}
    </select>
  );
}

export function SubmitButton({
  loading,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || rest.disabled}
      className="w-full bg-gold-500 hover:bg-gold-400 disabled:bg-gold-700 text-navy-900 font-semibold px-4 py-3 rounded transition"
      {...rest}
    >
      {loading ? "Saving..." : children}
    </button>
  );
}

export function Notice({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: ReactNode;
}) {
  const cls =
    kind === "error"
      ? "bg-red-900/40 border-red-700 text-red-200"
      : "bg-emerald-900/40 border-emerald-700 text-emerald-200";
  return (
    <div className={`border px-3 py-2 rounded text-sm ${cls}`}>{children}</div>
  );
}
