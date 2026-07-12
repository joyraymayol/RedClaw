import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same 9x7 pixel grid as the claw mark in components/logo.tsx, kept in
// sync by hand since Satori (used here) can't import the SVG component.
const CLAW_CELLS = new Set([
  "3,0", "4,0", "5,0",
  "2,1", "3,1", "4,1", "5,1", "6,1",
  "1,2", "2,2", "6,2", "7,2",
  "1,3", "2,3",
  "1,4", "2,4", "6,4", "7,4",
  "2,5", "3,5", "6,5", "7,5",
  "3,6", "4,6", "5,6", "6,6",
]);

const COLS = 9;
const ROWS = 7;
const CELL = 17;

export default function AppleIcon() {
  return new ImageResponse(
    (
      // No border-radius: iOS applies its own continuous-corner mask to
      // home-screen icons, so a square, edge-to-edge source looks right.
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e7000b",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Array.from({ length: ROWS }).map((_, y) => (
            <div key={y} style={{ display: "flex", flexDirection: "row" }}>
              {Array.from({ length: COLS }).map((_, x) => (
                <div
                  key={x}
                  style={{
                    width: CELL,
                    height: CELL,
                    background: CLAW_CELLS.has(`${x},${y}`)
                      ? "white"
                      : "transparent",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
