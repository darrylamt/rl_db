"use client";

/** Waits for every card image to finish loading, then opens the print dialog. */
export function PrintCardsButton() {
  async function go() {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(".idc img"));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? null
          : new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            })
      )
    );
    window.print();
  }
  return (
    <button type="button" onClick={go} className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium">
      Print cards
    </button>
  );
}
