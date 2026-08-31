import { normaliseType } from "@/lib/matchStats";

/**
 * The event icons the public website already uses.
 *
 * Ported from rlfgweb's components/icons so a try looks the same on the
 * federation's own live page as it does on the site — the same rugby ball,
 * the same posts. Inline SVG rather than a sprite or an icon package: three
 * shapes are not worth a dependency on a page built to load fast on a phone
 * at a ground.
 *
 * Cards have no icon in that set, so they keep the coloured block the site
 * gives them.
 */

const TRY_D = "M20.49 3.51c-.56-.56-2.15-.97-4.16-.97c-3.08 0-7.15.96-9.98 3.79c-4.69 4.7-4.25 12.74-2.84 14.16c.56.56 2.15.97 4.16.97c3.08 0 7.15-.96 9.98-3.79c4.69-4.7 4.25-12.74 2.84-14.16M7.76 7.76c2.64-2.64 6.35-3.12 8.03-3.19c-2.05.94-4.46 2.45-6.61 4.61a23.2 23.2 0 0 0-4.61 6.63c.09-2.48.87-5.74 3.19-8.05m8.48 8.48c-2.64 2.64-6.35 3.12-8.03 3.19c2.05-.94 4.46-2.45 6.61-4.61c2.16-2.16 3.67-4.58 4.62-6.63c-.1 2.48-.88 5.74-3.2 8.05";
const CONVERSION_D = "M247 18v135.193a466 466 0 0 1 18-8.89V18zm192 0v247.6l-174-.688v-60.457a554 554 0 0 0-18 18V311h18v-28.088l174 .688V311h18V18zm-80.1 71.914c-7.024-.18-15.588 2.472-20.54 6.463c-7.925 6.386-14.468 22.533-9.155 29.127s22.48 3.634 30.406-2.752s14.47-22.533 9.158-29.127c-1.993-2.473-5.653-3.602-9.868-3.71zm-54.125 57.334C168.5 198.266 48.38 324.17 25.043 471.803l17.316 3.365c15.157-100.106 61.737-149.502 92.28-179.856C120.173 337.77 79.376 405.92 78.27 482.145l21.605 4.2c4.238-108.047 78.028-244.59 204.902-339.097zM241.068 329v158h30V329zm191.618 0v158h30V329z";
const MISSED_D = "M9.15 16.25L12 13.4l2.85 2.85l1.4-1.4L13.4 12l2.85-2.85l-1.4-1.4L12 10.6L9.15 7.75l-1.4 1.4L10.6 12l-2.85 2.85zM5 19V5zm-2 2V3h18v10.35q-.475-.175-.975-.262T19 13V5H5v14h8q0 .525.088 1.025t.262.975zm16 2l-1.4-1.4l1.575-1.6H15v-2h4.175L17.6 16.4L19 15l4 4z";

function Svg({ viewBox, d, className }: { viewBox: string; d: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width="1em"
      height="1em"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d={d} />
    </svg>
  );
}

/** The icon for one event type, or null where the set has none. */
export function EventIcon({
  type,
  className = "",
}: {
  type: string;
  className?: string;
}) {
  const t = normaliseType(type);

  if (t === "try") {
    return <Svg viewBox="0 0 24 24" d={TRY_D} className={`text-emerald-400 ${className}`} />;
  }
  // A conversion, a penalty goal and a drop goal are all a kick at the posts.
  if (t === "conversion" || t === "penalty_goal" || t === "drop_goal") {
    return <Svg viewBox="0 0 512 512" d={CONVERSION_D} className={`text-ghanaYellow-500 ${className}`} />;
  }
  if (t === "missed_conversion") {
    return <Svg viewBox="0 0 24 24" d={MISSED_D} className={`text-slate-500 ${className}`} />;
  }
  // Not in the website's set, so arrows rather than an invented crest.
  if (t === "sub_on") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"
        className={`text-emerald-400 ${className}`} aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 4l6 7h-4v9h-4v-9H6z" />
      </svg>
    );
  }
  if (t === "sub_off") {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"
        className={`text-red-400 ${className}`} aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M12 20l-6-7h4V4h4v9h4z" />
      </svg>
    );
  }
  if (t === "yellow_card" || t === "sin_bin") {
    return <span className={`inline-block w-3 h-4 rounded-sm bg-yellow-400 ${className}`} aria-hidden="true" />;
  }
  if (t === "red_card") {
    return <span className={`inline-block w-3 h-4 rounded-sm bg-red-600 ${className}`} aria-hidden="true" />;
  }
  return null;
}
