// src/lib/removeBackground.ts
// Client-side background knock-out to transparency. It samples the IMAGE
// CORNERS to detect the actual background colour (white, cream, light grey, a
// scanned page tint…) and removes pixels close to it, with a feathered edge.
// Ideal for signatures, stamps and logos on a plain background — instant, in
// the browser, no API key. Busy photo backgrounds need a dedicated ML service.

export interface RemoveBgOptions {
  /** Colour distance (0–441) within which a pixel counts as background. */
  tolerance?: number;
  /** Extra distance beyond tolerance over which alpha fades to 0 (soft edge). */
  feather?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = src;
  });
}

// Fetch a URL to a blob so we can load it from a same-origin object URL — this
// avoids the canvas being "tainted" (which would block reading its pixels).
async function toObjectUrl(input: Blob | string): Promise<{ url: string; revoke: boolean }> {
  if (typeof input !== "string") return { url: URL.createObjectURL(input), revoke: true };
  try {
    const res = await fetch(input, { mode: "cors" });
    if (res.ok) { const b = await res.blob(); return { url: URL.createObjectURL(b), revoke: true }; }
  } catch { /* fall back to direct URL below */ }
  return { url: input, revoke: false };
}

export async function removeWhiteBackground(
  input: Blob | string,
  opts: RemoveBgOptions = {}
): Promise<Blob> {
  const tolerance = opts.tolerance ?? 48;
  const feather   = opts.feather ?? 32;

  const { url, revoke } = await toObjectUrl(input);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error("Image has no dimensions.");

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas not available.");
    ctx.drawImage(img, 0, 0);

    let imgData: ImageData;
    try { imgData = ctx.getImageData(0, 0, w, h); }
    catch { throw new Error("The image is cross-origin and its pixels can't be read."); }
    const px = imgData.data;

    // ── Detect background colour from the four corners ──
    const box = Math.max(3, Math.round(Math.min(w, h) * 0.06));
    let rs = 0, gs = 0, bs = 0, n = 0;
    const sampleAt = (x0: number, y0: number) => {
      for (let y = y0; y < y0 + box && y < h; y++) {
        for (let x = x0; x < x0 + box && x < w; x++) {
          const i = (y * w + x) * 4;
          if (px[i + 3] < 8) continue; // skip already-transparent
          rs += px[i]; gs += px[i + 1]; bs += px[i + 2]; n++;
        }
      }
    };
    sampleAt(0, 0); sampleAt(w - box, 0); sampleAt(0, h - box); sampleAt(w - box, h - box);
    if (n === 0) throw new Error("Could not sample the background.");
    const br = rs / n, bg = gs / n, bb = bs / n;

    // ── Remove pixels close to that background colour, with a feathered edge ──
    for (let i = 0; i < px.length; i += 4) {
      const dr = px[i] - br, dg = px[i + 1] - bg, db = px[i + 2] - bb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= tolerance) {
        px[i + 3] = 0;
      } else if (dist <= tolerance + feather) {
        const t = (dist - tolerance) / feather; // 0..1
        px[i + 3] = Math.round(px[i + 3] * t);
      }
    }
    ctx.putImageData(imgData, 0, 0);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not encode PNG."))), "image/png")
    );
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}