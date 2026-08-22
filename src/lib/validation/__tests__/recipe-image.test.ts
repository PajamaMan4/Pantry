import { describe, expect, it } from "vitest";
import { recipeImageEditSchema, sniffImageMime } from "@/lib/validation/recipe-image";

describe("recipeImageEditSchema", () => {
  it("accepts a keep action", () => {
    expect(recipeImageEditSchema.safeParse({ action: "keep" }).success).toBe(true);
  });

  it("accepts a remove action", () => {
    expect(recipeImageEditSchema.safeParse({ action: "remove" }).success).toBe(true);
  });

  it("accepts a set action with a Blob, valid mime, and dimensions", () => {
    const r = recipeImageEditSchema.safeParse({
      action: "set",
      blob: new Blob(["fake bytes"], { type: "image/webp" }),
      mime: "image/webp",
      width: 800,
      height: 600,
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown action", () => {
    expect(recipeImageEditSchema.safeParse({ action: "delete" }).success).toBe(false);
  });

  it("rejects a set action with a disallowed mime", () => {
    const r = recipeImageEditSchema.safeParse({
      action: "set",
      blob: new Blob(["x"], { type: "image/svg+xml" }),
      mime: "image/svg+xml",
      width: 10,
      height: 10,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a set action whose blob field isn't a Blob", () => {
    const r = recipeImageEditSchema.safeParse({
      action: "set",
      blob: "not-a-blob",
      mime: "image/jpeg",
      width: 10,
      height: 10,
    });
    expect(r.success).toBe(false);
  });
});

describe("sniffImageMime", () => {
  it("identifies JPEG by its magic bytes", () => {
    expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
  });

  it("identifies PNG by its magic bytes", () => {
    expect(
      sniffImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])),
    ).toBe("image/png");
  });

  it("identifies WebP by its RIFF/WEBP header", () => {
    const buf = Buffer.alloc(16);
    buf.write("RIFF", 0, "ascii");
    buf.write("WEBP", 8, "ascii");
    expect(sniffImageMime(buf)).toBe("image/webp");
  });

  it("returns null for an SVG", () => {
    expect(sniffImageMime(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
  });

  it("returns null for a GIF", () => {
    expect(sniffImageMime(Buffer.from("GIF89a"))).toBeNull();
  });

  it("returns null for truncated input", () => {
    expect(sniffImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
  });
});
