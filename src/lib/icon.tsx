import { ImageResponse } from "next/og";

// Shared app-icon renderer used by the favicon, apple-touch icon, and the PWA
// manifest icon routes. Full-bleed background so it works as a maskable icon.
export function renderAppIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f59e0b",
          color: "#1c1917",
          fontSize: Math.round(size * 0.62),
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        P
      </div>
    ),
    { width: size, height: size },
  );
}
