import { eq } from "drizzle-orm";
import { db } from "./client";
import { recipeImages } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Everything about a recipe's photo except the bytes. Cheap: no overflow pages read. */
export type RecipeImageMeta = {
  mime: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  updatedAt: Date;
};

export type RecipeImageBytes = { mime: string; bytes: Buffer; updatedAt: Date };

const metaColumns = {
  mime: recipeImages.mime,
  width: recipeImages.width,
  height: recipeImages.height,
  byteSize: recipeImages.byteSize,
  updatedAt: recipeImages.updatedAt,
};

export function getRecipeImageMeta(recipeId: number): RecipeImageMeta | null {
  return (
    db.select(metaColumns).from(recipeImages).where(eq(recipeImages.recipeId, recipeId)).get() ?? null
  );
}

/** Bytes + mime for the serving route. The only place that reads the blob column. */
export function getRecipeImageBytes(recipeId: number): RecipeImageBytes | null {
  return (
    db
      .select({ mime: recipeImages.mime, bytes: recipeImages.bytes, updatedAt: recipeImages.updatedAt })
      .from(recipeImages)
      .where(eq(recipeImages.recipeId, recipeId))
      .get() ?? null
  );
}

// ---- Writers. Take a `tx` so the image write is atomic with the recipe write. ----
export type RecipeImageWrite = {
  mime: string;
  bytes: Buffer;
  width: number | null;
  height: number | null;
};

export function setRecipeImageTx(tx: Tx, recipeId: number, img: RecipeImageWrite): void {
  tx.insert(recipeImages)
    .values({ recipeId, ...img, byteSize: img.bytes.length, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: recipeImages.recipeId,
      set: { ...img, byteSize: img.bytes.length, updatedAt: new Date() },
    })
    .run();
}

export function deleteRecipeImageTx(tx: Tx, recipeId: number): void {
  tx.delete(recipeImages).where(eq(recipeImages.recipeId, recipeId)).run();
}

/** Copy one recipe's image onto another (used by "Save as variant"). No-op if absent. */
export function copyRecipeImageTx(tx: Tx, fromRecipeId: number, toRecipeId: number): void {
  const src = tx.select().from(recipeImages).where(eq(recipeImages.recipeId, fromRecipeId)).get();
  if (!src) return;
  setRecipeImageTx(tx, toRecipeId, {
    mime: src.mime,
    bytes: src.bytes,
    width: src.width,
    height: src.height,
  });
}
