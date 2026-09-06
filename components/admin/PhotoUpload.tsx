"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pick a picture, then frame it.
 *
 * Photos arrive from phones at every shape and crop — a head in the corner of
 * a landscape shot, a full-length team photo. Uploading them raw meant the
 * square everything is displayed in was decided by chance.
 *
 * Zooming happens around the point you are pointing at: the pixel under the
 * cursor, or the middle of a pinch, stays where it is while everything else
 * grows away from it. An earlier version scaled about the middle of the frame
 * instead, which meant lining a face up and then zooming pushed it straight
 * back out — you could only ever enlarge whatever happened to be in the
 * centre. The slider still works from the centre, because a slider has no
 * point to aim at.
 *
 * The picture is also held to the frame: it cannot be dragged far enough to
 * leave a white edge, so there is no way to save a crop with a corner missing.
 *
 * The cropped result replaces the file on the input itself, so nothing on the
 * server changes: the form still posts a single image file under the same
 * name, as it always did.
 */

/** What gets written, regardless of what came in. Square, and big enough. */
const OUTPUT = 600;

/** How far in you can go. Past four times, phone photos turn to porridge. */
const MAX_ZOOM = 4;

type Point = { x: number; y: number };

export function PhotoUpload({
  name,
  currentUrl,
  label = "Photo",
  shape = "round",
}: {
  name: string;
  currentUrl?: string | null;
  label?: string;
  shape?: "round" | "square";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  /** Live pointers, so two fingers can be told from one. */
  const pointers = useRef(new Map<number, Point>());
  /** The span and midpoint of a pinch as it started. */
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const [source, setSource] = useState<string | null>(null);
  const [fileName, setFileName] = useState("photo.jpg");
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState(176);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const round = shape === "round";

  // The frame is what every measurement is in, so it has to be known rather
  // than assumed — it changes with the breakpoint.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => setBox(el.clientWidth || 176);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Revoke the object URL when it is replaced or the field goes away, so a
  // form somebody edits a few times does not leak every picture they tried.
  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  /** The smallest scale that still covers the frame. Zoom multiplies it. */
  const cover = nat ? Math.max(box / nat.w, box / nat.h) : 1;
  const scale = cover * zoom;
  const drawn = nat
    ? { w: nat.w * scale, h: nat.h * scale }
    : { w: box, h: box };

  /** Keep the picture over the frame — no dragging a white corner into view. */
  const clamp = useCallback(
    (o: Point, s = scale): Point => {
      if (!nat) return { x: 0, y: 0 };
      const limitX = Math.max(0, (nat.w * s - box) / 2);
      const limitY = Math.max(0, (nat.h * s - box) / 2);
      return {
        x: Math.min(limitX, Math.max(-limitX, o.x)),
        y: Math.min(limitY, Math.max(-limitY, o.y)),
      };
    },
    [nat, box, scale]
  );

  /**
   * Zoom while holding one point still.
   *
   * `at` is measured from the middle of the frame. The image point under it
   * is worked out at the old scale and put back under it at the new one,
   * which is what makes the pixel you are aiming at stay put.
   */
  const zoomAround = useCallback(
    (next: number, at: Point) => {
      if (!nat) return;
      const target = Math.min(MAX_ZOOM, Math.max(1, next));
      const from = cover * zoom;
      const to = cover * target;
      setOffset((o) =>
        clamp(
          {
            x: at.x - ((at.x - o.x) * to) / from,
            y: at.y - ((at.y - o.y) * to) / from,
          },
          to
        )
      );
      setZoom(target);
    },
    [nat, cover, zoom, clamp]
  );

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSource(null);
      setNat(null);
      return;
    }
    setFileName(file.name.replace(/\.[^.]+$/, "") + ".jpg");
    setNat(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSource(URL.createObjectURL(file));
  }

  /**
   * Draw what the frame is showing and put it back on the input.
   *
   * The same geometry as the preview, multiplied up to output size — so what
   * is saved is what was on the screen, not an approximation of it.
   */
  const commit = useCallback(() => {
    const img = imageRef.current;
    if (!img || !nat || !img.naturalWidth) return;

    const ratio = OUTPUT / box;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);

    const w = nat.w * scale * ratio;
    const h = nat.h * scale * ratio;
    const x = (OUTPUT - w) / 2 + offset.x * ratio;
    const y = (OUTPUT - h) / 2 + offset.y * ratio;
    ctx.drawImage(img, x, y, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob || !inputRef.current) return;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(file);
        inputRef.current.files = dt.files;
      },
      "image/jpeg",
      0.9
    );
  }, [nat, box, scale, offset, fileName]);

  // Re-cut whenever the framing settles rather than on every pixel of a drag.
  useEffect(() => {
    if (!source || !nat || dragging) return;
    const id = setTimeout(commit, 80);
    return () => clearTimeout(id);
  }, [source, nat, dragging, commit]);

  /** Where a pointer is, measured from the middle of the frame. */
  function fromCentre(e: { clientX: number; clientY: number }): Point {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!source) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      setDragging(false);
    } else {
      setDragging(true);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two fingers: zoom about the point between them.
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.distance > 0) {
        zoomAround(
          (pinch.current.zoom * distance) / pinch.current.distance,
          fromCentre({
            clientX: (a.x + b.x) / 2,
            clientY: (a.y + b.y) / 2,
          })
        );
      }
      return;
    }

    if (!dragging) return;
    setOffset((o) => clamp({ x: o.x + e.movementX, y: o.y + e.movementY }));
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) setDragging(false);
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // The pointer was already gone. Nothing to release.
    }
  }

  // Registered by hand rather than through onWheel, because React attaches
  // wheel listeners passively and a passive listener cannot stop the page
  // scrolling behind the frame.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !source) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAround(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), fromCentre(e));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [source, zoom, zoomAround]);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4 flex-wrap">
        {/* The frame — what is inside it is what gets saved */}
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative w-44 h-44 shrink-0 overflow-hidden bg-slate-100 border border-slate-300 select-none touch-none ${
            round ? "rounded-full" : "rounded-lg"
          } ${source ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        >
          {source ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={source}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNat({ w: el.naturalWidth, h: el.naturalHeight });
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                className="absolute pointer-events-none max-w-none"
                style={{
                  width: drawn.w,
                  height: drawn.h,
                  left: (box - drawn.w) / 2 + offset.x,
                  top: (box - drawn.h) / 2 + offset.y,
                  // Until the picture has loaded there is no natural size to
                  // scale from, and drawing it before then shows it squashed
                  // to a square for a frame.
                  visibility: nat ? "visible" : "hidden",
                }}
              />
              {/* A quiet centre mark, so there is something to aim with. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, transparent calc(50% - 0.5px), rgba(255,255,255,.9) calc(50% - 0.5px), rgba(255,255,255,.9) calc(50% + 0.5px), transparent calc(50% + 0.5px)), linear-gradient(to bottom, transparent calc(50% - 0.5px), rgba(255,255,255,.9) calc(50% - 0.5px), rgba(255,255,255,.9) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
                }}
              />
            </>
          ) : currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-[11px] text-slate-400 text-center px-3">
              No {label.toLowerCase()} yet
            </span>
          )}
        </div>

        <div className="flex-1 min-w-[13rem] space-y-2">
          <input
            ref={inputRef}
            type="file"
            name={name}
            accept="image/*"
            onChange={pick}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-navy-900 file:text-white hover:file:bg-navy-800 cursor-pointer"
          />

          {source && (
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="block text-[11px] uppercase tracking-wider text-slate-500">
                  Zoom
                </label>
                <span className="text-[11px] tabular-nums text-slate-400">
                  {zoom.toFixed(1)}&times;
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.02}
                value={zoom}
                onChange={(e) =>
                  zoomAround(Number(e.target.value), { x: 0, y: 0 })
                }
                className="w-full accent-navy-900"
                aria-label="Zoom"
              />
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-xs text-slate-500">
                  Scroll or pinch over the picture to zoom where you are
                  pointing. Drag to move it.
                </p>
                {(zoom !== 1 || offset.x !== 0 || offset.y !== 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className="text-xs text-slate-500 hover:text-navy-800 underline shrink-0"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {currentUrl && !source && (
            <p className="text-xs text-slate-400">
              Leave empty to keep the existing {label.toLowerCase()}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
