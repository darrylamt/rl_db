/**
 * The club crests, drifting behind the sign-in card.
 *
 * Server-rendered and animated in CSS alone — no client component, no
 * JavaScript, nothing to hydrate on the one screen that should come up
 * instantly on a phone at a ground.
 *
 * Each row is its own marquee: the crests are laid out twice and the row
 * slides exactly half its width, so the loop has no seam. Rows alternate
 * direction and run at different speeds, which stops the whole field reading
 * as one sliding sheet.
 */
const ROWS = 6;
const PER_ROW = 9;

export function CrestField({ logos }: { logos: string[] }) {
  if (logos.length === 0) return null;

  // Repeat the crests until each row is full. A federation with six clubs and
  // one with thirty should both get a full field.
  const rows = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: PER_ROW }, (_, i) => logos[(r * PER_ROW + i) % logos.length])
  );

  return (
    <div className="crest-field" aria-hidden="true">
      <div className="crest-plane">
        {rows.map((row, r) => (
          <div
            key={r}
            className={`crest-row ${r % 2 ? "crest-row--rtl" : "crest-row--ltr"}`}
            style={{ animationDuration: `${70 + r * 13}s` }}
          >
            {/* Laid out twice — the second copy is what the first slides into. */}
            {[...row, ...row].map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="crest" loading="lazy" />
            ))}
          </div>
        ))}
      </div>
      <div className="crest-veil" />
    </div>
  );
}

export function crestFieldStyles() {
  return `
.crest-field {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
/* Tilted and oversized so no row ever shows an end. */
.crest-plane {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 190vmax;
  height: 150vmax;
  transform: translate(-50%, -50%) rotate(-14deg);
  display: flex;
  flex-direction: column;
  justify-content: space-around;
}
.crest-row {
  display: flex;
  align-items: center;
  gap: 7vmin;
  width: max-content;
  will-change: transform;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.crest-row--ltr { animation-name: crest-drift-left; }
.crest-row--rtl { animation-name: crest-drift-right; }
.crest {
  width: 11vmin;
  height: 11vmin;
  object-fit: contain;
  opacity: 0.13;
  filter: grayscale(1) brightness(2.4);
  flex: none;
}
/* Half the row's width is exactly one full copy of the crests. */
@keyframes crest-drift-left {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
}
@keyframes crest-drift-right {
  from { transform: translate3d(-50%, 0, 0); }
  to   { transform: translate3d(0, 0, 0); }
}
/* Keeps the card legible over whatever happens to drift behind it. */
.crest-veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(3, 10, 26, 0.82) 0%,
    rgba(3, 10, 26, 0.62) 45%,
    rgba(3, 10, 26, 0.9) 100%
  );
}
/* Motion is decoration here — if it is unwelcome, the pattern still stands. */
@media (prefers-reduced-motion: reduce) {
  .crest-row { animation: none; }
}
`;
}
