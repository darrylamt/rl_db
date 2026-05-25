"use client";

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M3.75 2a.75.75 0 0 0-.75.75v1.5H2.5A1.5 1.5 0 0 0 1 5.75v4.5A1.5 1.5 0 0 0 2.5 11.75H3v1.5A.75.75 0 0 0 3.75 14h8.5a.75.75 0 0 0 .75-.75v-1.5h.5a1.5 1.5 0 0 0 1.5-1.5v-4.5A1.5 1.5 0 0 0 12.75 4H13V2.75A.75.75 0 0 0 12.25 2h-8.5Zm0 1.5h8.5V4h-8.5V3.5Zm0 7h8.5v2.5h-8.5v-2.5ZM4.5 7a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
      </svg>
      Download PDF
    </button>
  );
}
