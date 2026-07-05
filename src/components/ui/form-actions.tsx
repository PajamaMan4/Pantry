import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Standard action row for non-dialog forms.
 *
 * Layout-only — agnostic to how the form submits (works with both
 * `<form action>` / `useActionState` and `<div>` + `onClick` / `useTransition`).
 * It does not own button `size` or sticky-footer chrome.
 *
 * Convention: pass buttons as children in DOM order Cancel → primary. CSS
 * right-aligns the pair on desktop and stacks them vertically with the primary
 * on top on mobile. Tertiary/utility buttons (e.g. "Save as variant", "Add row")
 * go in the far-left `extra` slot.
 */
function FormActions({
  extra,
  error,
  className,
  children,
}: {
  extra?: React.ReactNode
  error?: string | null
  className?: string
  children: React.ReactNode
}) {
  return (
    <>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <div
        data-slot="form-actions"
        className={cn(
          "flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end",
          className,
        )}
      >
        {extra && (
          <div className="flex items-center gap-2 sm:mr-auto">{extra}</div>
        )}
        {children}
      </div>
    </>
  )
}

export { FormActions }
