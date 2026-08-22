// Client-only: downscales and re-encodes a picked photo before it's staged into
// the recipe form. Runs entirely in the browser so nothing touches the server
// until the user hits Save. Keeping the result small is what lets the recipe
// image ride along in the normal create/update Server Action instead of needing
// a separate upload endpoint (see next.config.ts's serverActions.bodySizeLimit).

export const MAX_DIMENSION = 1600;
export const TARGET_MAX_BYTES = 900 * 1024;
export const ACCEPTED_INPUT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif";

const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5];

export type PreparedImage = {
  blob: Blob;
  mime: string; // always image/webp or image/jpeg after re-encode
  width: number;
  height: number;
  previewUrl: string; // object URL — caller must revoke when done
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeAtScale(
  bitmap: ImageBitmap,
  scale: number,
): Promise<{ blob: Blob; mime: string; width: number; height: number }> {
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob) continue;
    // Some browsers silently fall back to PNG when WebP encoding isn't
    // supported — a PNG at this size would blow past our byte target, so
    // re-encode as JPEG instead of trusting the requested type.
    const actual = blob.type === "image/webp" ? blob : await canvasToBlob(canvas, "image/jpeg", quality);
    if (!actual) continue;
    if (actual.size <= TARGET_MAX_BYTES) return { blob: actual, mime: actual.type, width, height };
  }

  // Nothing under target at this scale — caller may retry at a smaller scale.
  const fallback = await canvasToBlob(canvas, "image/jpeg", QUALITY_STEPS[QUALITY_STEPS.length - 1]);
  if (!fallback) throw new Error("Could not encode image.");
  return { blob: fallback, mime: fallback.type, width, height };
}

export async function prepareRecipeImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    // `imageOrientation: "from-image"` is required — without it, canvas ignores
    // the EXIF orientation tag and every portrait phone photo renders sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image. Try a JPEG, PNG or WebP.");
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const baseScale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;

  let result = await encodeAtScale(bitmap, baseScale);
  if (result.blob.size > TARGET_MAX_BYTES) {
    // One retry at half the dimensions if we still can't hit the target.
    result = await encodeAtScale(bitmap, baseScale / 2);
  }

  bitmap.close();

  return {
    blob: result.blob,
    mime: result.mime,
    width: result.width,
    height: result.height,
    previewUrl: URL.createObjectURL(result.blob),
  };
}
