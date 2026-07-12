import Link from "next/link";

import { cn } from "@/lib/utils";

// Pixel claw mark — echoes the 1-bit workshop artwork.
function ClawMark({ className }: { className?: string }) {
  const cells: [number, number][] = [
    [3, 0], [4, 0], [5, 0],
    [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [1, 2], [2, 2], [6, 2], [7, 2],
    [1, 3], [2, 3],
    [1, 4], [2, 4], [6, 4], [7, 4],
    [2, 5], [3, 5], [6, 5], [7, 5],
    [3, 6], [4, 6], [5, 6], [6, 6],
  ];
  return (
    <svg
      viewBox="0 0 9 7"
      aria-hidden="true"
      shapeRendering="crispEdges"
      className={cn("fill-current", className)}
    >
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("group flex items-center gap-2.5", className)}
      aria-label="RedClaw home"
    >
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground transition-transform duration-300 group-hover:-rotate-6">
        <ClawMark className="w-4" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        <span className="text-primary">Red</span>Claw
      </span>
      <span className="hidden rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground sm:inline">
        CMMS
      </span>
    </Link>
  );
}
