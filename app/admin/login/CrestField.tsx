/**
 * The club crests, running behind the sign-in card as three reels.
 *
 * Server-rendered and animated in CSS alone — no client component, no
 * JavaScript, nothing to hydrate on the one screen that should come up
 * instantly on a phone at a ground.
 *
 * Each reel lists its crests twice and travels exactly half its own height,
 * so the loop has no seam. The three run at different speeds, which is what
 * stops them reading as one sliding sheet.
 */
const REELS = 3;
const PER_REEL = 7;

export function CrestField({ logos }: { logos: string[] }) {
  if (logos.length === 0) return null;

  // Each reel starts at a different point in the list so neighbouring reels
  // are not showing the same crest at the same height.
  const reels = Array.from({ length: REELS }, (_, c) =>
    Array.from(
      { length: PER_REEL },
      (_, i) => logos[(c * 3 + i) % logos.length]
    )
  );

  return (
    <div className="crest-field" aria-hidden="true">
      <div className="crest-reels">
        {reels.map((reel, c) => (
          <div
            key={c}
            className="crest-reel"
            style={{ animationDuration: `${34 + c * 11}s` }}
          >
            {/* Listed twice — the second copy is what the first travels into. */}
            {[...reel, ...reel].map((src, i) => (
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
/* Taller than the screen, so a crest is always part-way in at top and bottom
   rather than the reels appearing to start and stop at the edges. */
.crest-reels {
  position: absolute;
  top: -20%;
  left: 0;
  right: 0;
  height: 140%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: start;
  justify-items: center;
}
.crest-reel {
  display: flex;
  flex-direction: column;
  align-items: center;
  will-change: transform;
  animation-name: crest-reel-up;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.crest {
  width: min(30vmin, 30vw);
  height: min(30vmin, 30vw);
  object-fit: contain;
  /* The spacing is margin rather than a flex gap on purpose: it makes one
     copy of the list exactly half the reel's height, which is what lets the
     50% travel below loop without a jump. */
  margin-bottom: 7vmin;
  opacity: 0.17;
  filter: grayscale(1) brightness(2.2);
  flex: none;
}
@keyframes crest-reel-up {
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(0, -50%, 0); }
}
/* Keeps the card legible over whatever happens to be passing behind it. */
.crest-veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(4, 11, 26, 0.88) 0%,
    rgba(4, 11, 26, 0.7) 42%,
    rgba(4, 11, 26, 0.95) 100%
  );
}
/* Motion is decoration here — without it the crests still stand as a pattern. */
@media (prefers-reduced-motion: reduce) {
  .crest-reel { animation: none; }
}
`;
}
