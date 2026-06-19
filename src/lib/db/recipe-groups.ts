import { asc } from "drizzle-orm";
import { db } from "./client";
import { recipeGroups, type RecipeGroup } from "./schema";

/** All variant groups, alphabetical — used to suggest existing groups in the form. */
export function listRecipeGroups(): RecipeGroup[] {
  return db.select().from(recipeGroups).orderBy(asc(recipeGroups.name)).all();
}
