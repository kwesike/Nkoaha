// src/lib/removeBackground.ts
// Client-side background knock-out: turns a near-white, low-saturation
// background into transparency. Ideal for signatures, stamps, logos and
// simple images on a light/plain background — runs instantly in the browser,
// no external service or API key. (For complex photos with busy backgrounds,
// a dedicated ML service would be needed; this targets plain backgrounds.)

export interface RemoveBgOptions {
  /** Min RGB channel value treated as "white" background (0–255). Higher = stricter. */
  threshold?: number;
  /** Feather range below threshold for soft edges. */
  softness?: number;
  /** Max colour spread (max-min channel) still considered greyscale/background. */
  maxSaturation?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image (it may be cross-origin without CORS)."));
    img.src = src;
  });
}

/**
 * Returns a PNG Blob (with alpha) where the near-white background is transparent.
 * Accepts a File/Blob (e.g. a freshly selected signature) or an image URL.
 */
export async function removeWhiteBackground(
  input: Blob | string,
  opts: RemoveBgOptions = {}
): Promise<Blob> {
  const threshold     = opts.threshold ?? 232;
  const softness      = opts.softness ?? 26;
  const maxSaturation = opts.maxSaturation ?? 22;

  const url = typeof input === "string" ? input : URL.createObjectURL(input);
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

    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      const sat = mx - mn;
      if (sat <= maxSaturation) {
        if (mn >= threshold) {
          px[i + 3] = 0;                          // near-white → fully transparent
        } else if (mn >= threshold - softness) {
          // feather near the edge so the signature outline stays smooth
          const t = (mn - (threshold - softness)) / softness; // 0..1
          px[i + 3] = Math.round(px[i + 3] * (1 - t));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not encode PNG."))), "image/png")
    );
  } finally {
    if (typeof input !== "string") URL.revokeObjectURL(url);
  }
}