// Shared by the edit form (client) and the detail page (server) so the URL shape
// can't drift between the two. `version` should be the image's `updatedAt` epoch
// ms — it's a pure cache-busting key; the route handler ignores it.
export function recipeImageSrc(recipeId: number, version: number): string {
  return `/api/recipes/${recipeId}/image?v=${version}`;
}
