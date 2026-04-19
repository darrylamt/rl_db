"use client";

import { ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const inputCls =
  "w-full px-3 py-2 rounded border border-slate-300 bg-white text-navy-900 focus:border-navy-700 focus:outline-none disabled:opacity-60";
const labelCls = "block text-xs uppercase tracking-wider text-slate-600 mb-1";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }
) {
  return (
    <select {...props} className={`${inputCls} ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${inputCls} ${props.className ?? ""}`}
    />
  );
}

export function Checkbox({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-navy-900">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-400 text-navy-900 focus:ring-navy-700"
      />
      {label}
    </label>
  );
}

export function FormShell({
  title,
  backHref,
  onSubmit,
  children,
  submitLabel = "Save",
}: {
  title: string;
  backHref: string;
  onSubmit: (formData: FormData) => Promise<void>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      await onSubmit(fd);
      router.push(backHref);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
      setPending(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <nav className="mb-4">
        <Link
          href={backHref}
          className="text-navy-700 text-sm hover:underline"
        >
          ← Back
        </Link>
      </nav>
      <h1 className="font-display text-2xl md:text-3xl font-bold text-navy-900 mb-6">
        {title}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-lg p-4 md:p-6">
        {children}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white px-5 py-2.5 rounded font-medium"
          >
            {pending ? "Saving..." : submitLabel}
          </button>
          <Link
            href={backHref}
            className="px-5 py-2.5 rounded font-medium text-navy-700 hover:bg-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
