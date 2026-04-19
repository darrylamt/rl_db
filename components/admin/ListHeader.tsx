import Link from "next/link";

export function ListHeader({
  title,
  addHref,
  addLabel = "Add New",
  eyebrow = "ADMIN",
}: {
  title: string;
  addHref?: string;
  addLabel?: string;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-wrap justify-between items-end gap-3 mb-6">
      <div className="min-w-0">
        <p className="text-gold-600 font-display tracking-widest text-xs">
          {eyebrow}
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900">
          {title}
        </h1>
      </div>
      {addHref && (
        <Link
          href={addHref}
          className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2.5 rounded font-medium text-sm whitespace-nowrap"
        >
          + {addLabel}
        </Link>
      )}
    </header>
  );
}
