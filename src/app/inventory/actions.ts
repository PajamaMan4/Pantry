"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inventoryItemSchema, logPurchaseSchema } from "@/lib/validation/inventory";
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  logPurchase,
  type InventoryItemInput,
  type LogPurchaseInput,
} from "@/lib/db/inventory";

export type InventoryActionError = { ok: false; error: string };

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Please check the form and try again.";
}

export async function createInventoryItemAction(input: unknown): Promise<InventoryActionError> {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  createInventoryItem(parsed.data as InventoryItemInput);
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function updateInventoryItemAction(id: number, input: unknown): Promise<InventoryActionError> {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  updateInventoryItem(id, parsed.data as InventoryItemInput);
  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function deleteInventoryItemAction(id: number): Promise<void> {
  deleteInventoryItem(id);
  revalidatePath("/inventory");
}

export async function logPurchaseAction(input: unknown): Promise<InventoryActionError> {
  const parsed = logPurchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  logPurchase(parsed.data as LogPurchaseInput);
  revalidatePath("/inventory");
  redirect("/inventory");
}
