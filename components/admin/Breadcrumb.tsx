import Link from "next/link";

type Crumb = { label: string; href?: string };

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="mb-6 flex items-center gap-2 flex-wrap">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-slate-300 select-none">›</span>}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className={
                i === 0
                  ? "inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-navy-300 hover:bg-slate-50 text-slate-700 hover:text-navy-900 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm transition-colors"
                  : "text-sm text-navy-700 hover:underline font-medium"
              }
            >
              {i === 0 ? <>← {crumb.label}</> : crumb.label}
            </Link>
          ) : (
            <span className="text-sm text-slate-500">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
