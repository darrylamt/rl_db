"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pick a picture, then frame it.
 *
 * Photos arrive from phones at every shape and crop — a head in the corner of
 * a landscape shot, a full-length team photo. Uploading them raw meant the
 * square everything is displayed in was decided by chance. Drag to move, pull
 * the slider to zoom, and what is inside the frame is what gets saved.
 *
 * The cropped result replaces the file on the input itself, so nothing on the
 * server changes: the form still posts a single image file under the same
 * name, as it always did.
 */

/** What gets written, regardless of what came in. Square, and big enough. */
const OUTPUT = 600;

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

  const [source, setSource] = useState<string | null>(null);
  const [fileName, setFileName] = useState("photo.jpg");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const round = shape === "round";

  // Revoke the object URL when it is replaced or the field goes away, so a
  // form somebody edits a few times does not leak every picture they tried.
  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSource(null);
      return;
    }
    setFileName(file.name.replace(/\.[^.]+$/, "") + ".jpg");
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSource(URL.createObjectURL(file));
  }

  /**
   * Draw what the frame is showing and put it back on the input.
   *
   * The frame is a square of `box` pixels showing the image scaled to cover
   * it and then moved by the offset; the canvas repeats that at output size.
   */
  function commit() {
    const img = imageRef.current;
    const frame = frameRef.current;
    if (!img || !frame || !img.naturalWidth) return;

    const box = frame.clientWidth;
    const cover = Math.max(box / img.naturalWidth, box / img.naturalHeight);
    const scale = cover * zoom;
    const ratio = OUTPUT / box;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);

    const drawW = img.naturalWidth * scale * ratio;
    const drawH = img.naturalHeight * scale * ratio;
    const x = (OUTPUT - drawW) / 2 + offset.x * ratio;
    const y = (OUTPUT - drawH) / 2 + offset.y * ratio;
    ctx.drawImage(img, x, y, drawW, drawH);

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
  }

  // Re-cut whenever the framing settles rather than on every pixel of a drag.
  useEffect(() => {
    if (!source || dragging) return;
    const id = setTimeout(commit, 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, zoom, offset, dragging]);

  function onPointerDown(e: React.PointerEvent) {
    if (!source) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setOffset((o) => ({ x: o.x + e.movementX, y: o.y + e.movementY }));
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    setDragging(false);
  }

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
          className={`relative w-32 h-32 shrink-0 overflow-hidden bg-slate-100 border border-slate-300 select-none ${
            round ? "rounded-full" : "rounded-lg"
          } ${source ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        >
          {source ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={source}
              alt=""
              draggable={false}
              onLoad={commit}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
            />
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
              <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                Zoom
              </label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-navy-900"
                aria-label="Zoom"
              />
              <p className="text-xs text-slate-500 mt-1">
                Drag the picture to move it. What you can see is what gets
                saved.
              </p>
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
