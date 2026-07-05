"use client";

import * as React from "react";
import type { DisplaySystem } from "@/lib/domain/scaling";

/** Unit-display options, shared by the scaler and the actions menu. */
export const SYSTEMS: { value: DisplaySystem; label: string }[] = [
  { value: "original", label: "As written" },
  { value: "imperial", label: "Imperial" },
  { value: "metric", label: "Metric" },
];

type RecipeView = {
  system: DisplaySystem;
  setSystem: (s: DisplaySystem) => void;
};

const RecipeViewContext = React.createContext<RecipeView | null>(null);

export function RecipeViewProvider({
  defaultSystem,
  children,
}: {
  defaultSystem: DisplaySystem;
  children: React.ReactNode;
}) {
  const [system, setSystem] = React.useState<DisplaySystem>(defaultSystem);
  const value = React.useMemo(() => ({ system, setSystem }), [system]);
  return <RecipeViewContext.Provider value={value}>{children}</RecipeViewContext.Provider>;
}

export function useRecipeView(): RecipeView {
  const ctx = React.useContext(RecipeViewContext);
  if (!ctx) throw new Error("useRecipeView must be used within a RecipeViewProvider");
  return ctx;
}
