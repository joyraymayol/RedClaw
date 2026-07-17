import { Wrench } from "lucide-react";

type Gear = { cx: number; cy: number; teeth: number; root: number; tip: number };

const BIG: Gear = { cx: 205, cy: 205, teeth: 12, root: 62, tip: 78 };
const SMALL: Gear = { cx: 300, cy: 138, teeth: 8, root: 40, tip: 52 };

const VITALS_TRACE =
  "M40 348 H150 l8 -9 l9 16 l8 -7 H262 l9 -30 l13 52 l9 -26 H372 q9 -12 18 0 H520";

function gearPath({ cx, cy, teeth, root, tip }: Gear): string {
  const step = (2 * Math.PI) / teeth;
  const rootHalf = step * 0.3;
  const tipHalf = step * 0.16;
  const pt = (r: number, a: number) =>
    `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  const segs: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    segs.push(
      `${i === 0 ? "M" : "L"}${pt(root, c - rootHalf)}`,
      `L${pt(tip, c - tipHalf)}`,
      `L${pt(tip, c + tipHalf)}`,
      `L${pt(root, c + rootHalf)}`
    );
  }
  return segs.join(" ") + " Z";
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

export function HeroSchematic() {
  return (
    <svg
      viewBox="0 0 560 420"
      role="img"
      aria-label="Animated maintenance schematic: meshing gears being serviced with a wrench, a live asset-vitals trace, and a work order progressing through its ticket lifecycle"
      className="rc-schematic h-auto w-full rounded-lg"
    >
      <defs>
        <pattern id="rc-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="var(--border)" strokeWidth="1" />
        </pattern>
        <radialGradient id="rc-glow">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.13" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rc-scangrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--primary)" stopOpacity="0.1" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* blueprint grid + ambient glow */}
      <rect width="560" height="420" fill="url(#rc-grid)" opacity="0.55" />
      <circle cx="240" cy="185" r="175" fill="url(#rc-glow)" />

      {/* scan sweep */}
      <rect className="rc-scan" x="0" y="-48" width="560" height="48" fill="url(#rc-scangrad)" />

      {/* blueprint callouts around the drive gear */}
      <g className="text-muted-foreground" stroke="currentColor" fill="none">
        <circle
          className="rc-dash-crawl"
          cx={BIG.cx}
          cy={BIG.cy}
          r="96"
          strokeWidth="1"
          strokeDasharray="3 7"
          opacity="0.7"
        />
        <path d="M205 193v24M193 205h24" strokeWidth="1" opacity="0.8" />
        <path d="M109 205H70" strokeWidth="1" opacity="0.7" />
      </g>

      {/* drive gear */}
      <g className="rc-gear-cw" style={{ transformOrigin: "205px 205px" }}>
        <g
          className="text-foreground/70"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d={gearPath(BIG)} />
          <circle cx={BIG.cx} cy={BIG.cy} r="26" />
          {[0, 120, 240].map((a) => (
            <circle
              key={a}
              cx={(BIG.cx + 42 * Math.cos((a * Math.PI) / 180)).toFixed(1)}
              cy={(BIG.cy + 42 * Math.sin((a * Math.PI) / 180)).toFixed(1)}
              r="6"
            />
          ))}
        </g>
      </g>

      {/* pinion gear — counter-rotates at the 12:8 tooth ratio */}
      <g className="rc-gear-ccw" style={{ transformOrigin: "300px 138px" }}>
        <g
          className="text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          transform="rotate(22.5 300 138)"
        >
          <path d={gearPath(SMALL)} />
          <circle cx={SMALL.cx} cy={SMALL.cy} r="20" />
        </g>
      </g>

      {/* hex bolt + ratcheting wrench */}
      <polygon
        points={hexPoints(SMALL.cx, SMALL.cy, 12)}
        fill="var(--card)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className="text-foreground/80"
      />
      <g className="rc-ratchet" style={{ transformOrigin: "300px 138px" }}>
        <g transform="rotate(180 300 138)">
          <Wrench
            x={259}
            y={124}
            width={56}
            height={56}
            strokeWidth={1.75}
            fill="var(--card)"
            className="text-primary"
          />
        </g>
      </g>

      {/* asset vitals trace */}
      <path
        d={VITALS_TRACE}
        pathLength={600}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
        className="text-muted-foreground"
      />
      <path
        className="rc-trace"
        d={VITALS_TRACE}
        pathLength={600}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeDasharray="90 510"
      />

      {/* HUD */}
      <g className="font-mono" fontSize="10" letterSpacing="0.08em">
        <text x="40" y="44" fill="var(--muted-foreground)">
          ASSET // EXT-07 · EXTRUDER LINE 2
        </text>
        <text x="40" y="64" fill="var(--foreground)">
          WO TKT-2026-0341{" "}
          <tspan fill="var(--primary)">IN_PROGRESS</tspan>
        </text>
        <rect className="rc-blink" x="216" y="55" width="6" height="11" fill="var(--primary)" />

        <text x="436" y="48" textAnchor="end" fill="var(--muted-foreground)">
          FLOW
        </text>
        {[0, 1, 2, 3, 4].map((i) => (
          <rect
            key={i}
            className="rc-pip"
            style={{ animationDelay: `${i}s` }}
            x={444 + i * 16}
            y="39"
            width="10"
            height="10"
            rx="2"
            fill="var(--muted-foreground)"
            opacity="0.3"
          />
        ))}

        <text x="66" y="208" textAnchor="end" fill="var(--muted-foreground)">
          Ø156
        </text>
        <text x="128" y="292" fill="var(--muted-foreground)">
          Z12
        </text>
        <text x="352" y="92" fill="var(--muted-foreground)">
          Z8
        </text>

        <circle cx="33" cy="380.5" r="3" fill="var(--primary)" className="animate-pulse" />
        <text x="44" y="384" fill="var(--muted-foreground)">
          VITALS // LIVE
        </text>
        <text x="520" y="384" textAnchor="end" fill="var(--muted-foreground)">
          MTBF 128H · MTTR 42M
        </text>
      </g>
    </svg>
  );
}
