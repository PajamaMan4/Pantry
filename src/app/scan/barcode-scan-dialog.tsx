"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScanBarcodeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { createInventoryItemAction } from "@/app/ingredients/actions";
import { lookupBarcodeAction } from "./actions";
import type { BarcodeProduct } from "@/lib/import/open-food-facts";

const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-sm";

type Phase = "scan" | "looking-up" | "confirm";

/** Distinct camera failure reasons, mapped to an actionable message. */
function describeCameraError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (!window.isSecureContext) {
    return "Camera needs HTTPS or localhost. Type the barcode below instead.";
  }
  if (name === "NotAllowedError") {
    return "Camera permission was blocked. Allow it in your browser's site settings, or type the barcode below.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera found. Type the barcode below.";
  }
  if (name === "NotReadableError") {
    return "The camera is in use by another app. Type the barcode below.";
  }
  return "Couldn't start the camera. Type the barcode below.";
}

export function BarcodeScanButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("scan");
  const [manualCode, setManualCode] = React.useState("");
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [barcode, setBarcode] = React.useState<string | null>(null);
  const [product, setProduct] = React.useState<BarcodeProduct | null>(null);
  const [name, setName] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unit, setUnit] = React.useState("each");
  const [pending, startTransition] = React.useTransition();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<{ stop: () => void } | null>(null);

  function reset() {
    setPhase("scan");
    setManualCode("");
    setScanError(null);
    setCameraError(null);
    setBarcode(null);
    setProduct(null);
    setName("");
    setQuantity("1");
    setUnit("each");
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      stopCamera();
      reset();
    }
    setOpen(next);
  }

  function submitCode(code: string) {
    const digits = code.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 14) {
      setScanError("That doesn't look like a barcode (expected 8–14 digits).");
      return;
    }
    stopCamera();
    setScanError(null);
    setPhase("looking-up");
    startTransition(async () => {
      const res = await lookupBarcodeAction(digits);
      setBarcode(digits);
      if (res.ok) {
        setProduct(res.product);
        setName(res.product.name);
        setQuantity(res.product.amount != null ? String(res.product.amount) : "1");
        setUnit(res.product.unit ?? "each");
        setPhase("confirm");
      } else if (res.notFound) {
        // Don't dead-end on an unknown product — let the user type the name.
        setProduct(null);
        setName("");
        setQuantity("1");
        setUnit("each");
        setPhase("confirm");
      } else {
        setScanError(res.error);
        setPhase("scan");
      }
    });
  }

  function backToScan() {
    setPhase("scan");
    setProduct(null);
  }

  function submitInventory() {
    if (!name.trim() || !unit || quantity === "") return;
    startTransition(async () => {
      const res = await createInventoryItemAction({
        ingredientId: null,
        name: name.trim(),
        quantity,
        unit,
        locationId: null,
        locationName: null,
        expiryDate: "",
        openedDate: "",
        notes: barcode ? `Scanned ${barcode}` : null,
      });
      if (res.ok) {
        toast.success(`Added ${name.trim()} to inventory`);
        handleOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Camera decode loop — lazily imports ZXing so it never lands in the home
  // page's initial bundle, and only starts once the dialog is open and on the
  // scan phase. Native BarcodeDetector isn't used: on Chrome it only works on
  // macOS/ChromeOS/Android, so ZXing is the one path that works everywhere,
  // including this Windows dev box.
  React.useEffect(() => {
    if (!open || phase !== "scan") return;

    let cancelled = false;
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("insecure-context");
        }

        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);

        const hints = new Map<number, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        if (cancelled || !videoRef.current) return;

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment", width: { ideal: 1280 } } },
          videoRef.current,
          (result, _err, ctl) => {
            if (!result) return; // _err fires on every empty frame — not a real error.
            ctl.stop();
            submitCode(result.getText());
          },
        );
        controlsRef.current = controls;
        if (cancelled) controls.stop();
        else setCameraError(null);
      } catch (err) {
        if (!cancelled) setCameraError(describeCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  const canSubmit = name.trim().length > 0 && unit.length > 0 && quantity !== "" && !pending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Card>
        <CardHeader>
          <CardTitle>Scan a barcode</CardTitle>
          <CardDescription>Test: look up a product and add it to inventory.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <DialogTrigger
            render={<button type="button" className="font-medium text-primary underline-offset-4 hover:underline" />}
          >
            <ScanBarcodeIcon className="mr-1 inline size-4 align-text-bottom" />
            Scan now →
          </DialogTrigger>
        </CardContent>
      </Card>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan a barcode</DialogTitle>
          <DialogDescription>
            {phase === "confirm"
              ? "Review the product, then add it to inventory."
              : "Point the camera at a barcode, or type the number below."}
          </DialogDescription>
        </DialogHeader>

        {phase !== "confirm" && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-lg border bg-muted">
              <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
            </div>
            {cameraError && <p className="text-xs text-muted-foreground">{cameraError}</p>}
            {phase === "looking-up" && <p className="text-sm text-muted-foreground">Looking up…</p>}

            <div className="grid gap-1">
              <Label htmlFor="manual-barcode" className="text-xs">
                Or enter the barcode number
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manual-barcode"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="e.g. 5449000000996"
                  value={manualCode}
                  disabled={phase === "looking-up"}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitCode(manualCode);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={phase === "looking-up" || !manualCode.trim()}
                  onClick={() => submitCode(manualCode)}
                >
                  Look up
                </Button>
              </div>
              {scanError && <p className="text-sm text-destructive">{scanError}</p>}
            </div>
          </div>
        )}

        {phase === "confirm" && (
          <div className="space-y-3">
            {product?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="h-20 w-20 rounded-md border object-contain" />
            )}
            {!product && barcode && (
              <p className="text-sm text-muted-foreground">
                That barcode isn&apos;t in Open Food Facts. Type a name to add it anyway.
              </p>
            )}
            <div className="grid gap-1">
              <Label htmlFor="scan-name" className="text-xs">
                Name
              </Label>
              <Input id="scan-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              {product?.brand && <p className="text-xs text-muted-foreground">{product.brand}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="scan-quantity" className="text-xs">
                  Quantity
                </Label>
                <Input
                  id="scan-quantity"
                  type="number"
                  min={0}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="scan-unit" className="text-xs">
                  Unit
                </Label>
                <select
                  id="scan-unit"
                  className={selectClass}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          {phase === "confirm" && (
            <>
              <Button type="button" variant="outline" onClick={backToScan} disabled={pending}>
                Scan another
              </Button>
              <Button type="button" onClick={submitInventory} disabled={!canSubmit}>
                {pending ? "Adding…" : "Add to inventory"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
