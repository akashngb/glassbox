"use client";

import { useRef, useState, type RefObject } from "react";
import { BorderRotate } from "@/components/border-rotate";

const palettes = {
  cyan: {
    primary: "#0a2942",
    secondary: "#3b9eff",
    accent: "#a8dcff",
  },
  violet: {
    primary: "#1f1442",
    secondary: "#8b6fff",
    accent: "#c4b5ff",
  },
  mint: {
    primary: "#0a3a2a",
    secondary: "#34d399",
    accent: "#a7f3d0",
  },
};

export function HeroFlow() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState<number>(2);

  return (
    <div ref={canvasRef} className="relative aspect-[5/6] w-full select-none">
      <DotField className="pointer-events-none absolute -inset-[28%]" />
      <div className="absolute inset-0">
        <Draggable
          canvasRef={canvasRef}
          isActive={activeIdx === 0}
          onActivate={() => setActiveIdx(0)}
          className="absolute left-[2%] top-[4%] w-[58%]"
        >
          <DatapointsCard />
        </Draggable>
        <Draggable
          canvasRef={canvasRef}
          isActive={activeIdx === 1}
          onActivate={() => setActiveIdx(1)}
          className="absolute right-[2%] top-[36%] w-[62%]"
        >
          <ParametersCard />
        </Draggable>
        <Draggable
          canvasRef={canvasRef}
          isActive={activeIdx === 2}
          onActivate={() => setActiveIdx(2)}
          className="absolute left-[4%] bottom-[4%] w-[64%]"
        >
          <BiasDeltaCard />
        </Draggable>
      </div>
    </div>
  );
}

function Draggable({
  canvasRef,
  isActive,
  onActivate,
  className = "",
  children,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  isActive: boolean;
  onActivate: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ dx: 0, dy: 0 });
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current || !canvasRef.current) return;
    onActivate();
    e.preventDefault();

    const cardRect = cardRef.current.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    // Position of the card *before* any current transform offset
    const baseLeft = cardRect.left - canvasRect.left - offset.dx;
    const baseTop = cardRect.top - canvasRect.top - offset.dy;
    const cardW = cardRect.width;
    const cardH = cardRect.height;
    const maxLeftDelta = canvasRect.width - cardW - baseLeft;
    const minLeftDelta = -baseLeft;
    const maxTopDelta = canvasRect.height - cardH - baseTop;
    const minTopDelta = -baseTop;

    setDragging(true);
    let raf = 0;
    let pendingDx = offset.dx;
    let pendingDy = offset.dy;

    const flush = () => {
      raf = 0;
      setOffset({ dx: pendingDx, dy: pendingDy });
    };

    const handleMove = (ev: PointerEvent) => {
      const wantDx = ev.clientX - startMouseX;
      const wantDy = ev.clientY - startMouseY;
      pendingDx = Math.max(minLeftDelta, Math.min(maxLeftDelta, wantDx));
      pendingDy = Math.max(minTopDelta, Math.min(maxTopDelta, wantDy));
      if (!raf) raf = requestAnimationFrame(flush);
    };

    const handleUp = () => {
      if (raf) cancelAnimationFrame(raf);
      setOffset({ dx: pendingDx, dy: pendingDy });
      setDragging(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      className={`${className} ${isActive ? "z-30" : "z-10"} ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        transform: `translate3d(${offset.dx}px, ${offset.dy}px, 0)${
          dragging ? " scale(1.025)" : ""
        }`,
        transition: dragging
          ? "transform 0s, filter 200ms"
          : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), filter 200ms",
        filter: dragging
          ? "drop-shadow(0 22px 32px rgba(0,0,0,0.8))"
          : "drop-shadow(0 8px 18px rgba(0,0,0,0.55))",
        touchAction: "none",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}

function CardShell({
  palette,
  speed = 6,
  children,
}: {
  palette: keyof typeof palettes;
  speed?: number;
  children: React.ReactNode;
}) {
  return (
    <BorderRotate
      gradientColors={palettes[palette]}
      backgroundColor="#0a0a0b"
      borderWidth={1}
      borderRadius={12}
      animationSpeed={speed}
      className="shadow-[0_8px_32px_-12px_rgba(0,0,0,0.9)] backdrop-blur-sm"
    >
      <div className="px-3.5 py-3">{children}</div>
    </BorderRotate>
  );
}

function CardHeader({
  label,
  value,
  dotColor,
}: {
  label: string;
  value: string;
  dotColor: string;
}) {
  return (
    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-zinc-500">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
        />
        {label}
      </div>
      <span className="font-mono text-[10px] text-zinc-400">{value}</span>
    </div>
  );
}

function DatapointsCard() {
  const bars = [0.35, 0.62, 0.88, 0.95, 0.78, 0.55, 0.42, 0.32, 0.2, 0.15];
  return (
    <CardShell palette="cyan" speed={7}>
      <CardHeader label="Datapoints" value="48,210" dotColor="#3b9eff" />
      <div className="mt-2.5 flex h-[54px] items-end gap-[3px]">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-[2px]"
            style={{
              height: `${h * 100}%`,
              background: `linear-gradient(180deg, #6cc0ff 0%, #3b9eff 60%, #1a4a78 100%)`,
              opacity: 0.6 + h * 0.4,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[9px] font-mono text-zinc-600">
        <span>group A</span>
        <span>group B</span>
      </div>
    </CardShell>
  );
}

function ParametersCard() {
  const cols = 14;
  const rows = 5;
  const cells: number[] = [];
  for (let i = 0; i < cols * rows; i++) {
    cells.push(((i * 37) % 41) / 41);
  }
  return (
    <CardShell palette="violet" speed={5.5}>
      <CardHeader label="Parameters" value="1.2M" dotColor="#8b6fff" />
      <div
        className="mt-2.5 grid h-[54px] gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {cells.map((v, i) => (
          <div
            key={i}
            className="rounded-[1px]"
            style={{
              backgroundColor: `rgba(139, 111, 255, ${0.08 + v * 0.75})`,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-zinc-500">
        <span>layer.W₃ · 14×5</span>
        <span className="text-violet-300">μ 0.041</span>
      </div>
    </CardShell>
  );
}

function BiasDeltaCard() {
  // Two lines: bias before (rising) and bias after (falling)
  const before = [0.18, 0.22, 0.26, 0.31, 0.35, 0.39, 0.42];
  const after = [0.18, 0.16, 0.13, 0.1, 0.07, 0.05, 0.03];
  const w = 200;
  const h = 48;
  const toPath = (vals: number[]) =>
    vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * w;
        const y = h - v * h * 1.6;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  return (
    <CardShell palette="mint" speed={6.5}>
      <CardHeader label="Bias Δ" value="−86%" dotColor="#34d399" />
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2.5 h-[54px] w-full">
        {[0.25, 0.5, 0.75].map((y) => (
          <line
            key={y}
            x1="0"
            x2={w}
            y1={h * y}
            y2={h * y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        <path
          d={toPath(before)}
          fill="none"
          stroke="#7f7f8a"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
        <path
          d={toPath(after)}
          fill="none"
          stroke="#34d399"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle
          cx={w}
          cy={h - after[after.length - 1] * h * 1.6}
          r="2.5"
          fill="#34d399"
        />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-zinc-500">
        <span>before / after mitigation</span>
        <span className="text-emerald-300">p &lt; 0.01</span>
      </div>
    </CardShell>
  );
}

function DotField({ className }: { className?: string }) {
  // Wider, denser grid that extends past the card cluster
  const cols = 26;
  const rows = 32;
  const stepX = 14;
  const stepY = 14;
  const offsetX = 8;
  const offsetY = 8;
  const vbW = offsetX * 2 + (cols - 1) * stepX;
  const vbH = offsetY * 2 + (rows - 1) * stepY;

  type Cell = {
    r: number;
    c: number;
    tier: "dim" | "mid" | "bright";
    sparkle: boolean;
    delay: number;
    duration: number;
  };
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Two independent pseudo-random streams from position
      const a = (r * 53 + c * 29) % 97;
      const b = (r * 17 + c * 41 + 7) % 89;
      const tier: Cell["tier"] =
        a % 23 === 0 ? "bright" : a % 7 === 0 ? "mid" : "dim";
      // Sparkle ~ every ~28th dot, only on bright/mid tiers
      const sparkle = tier !== "dim" && b % 7 === 0;
      const delay = (b / 89) * 6; // 0..6s
      const duration = 3 + ((a * 13) % 50) / 12; // 3..7.2s
      cells.push({ r, c, tier, sparkle, delay, duration });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id="hf-dotFade" cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="38%" stopColor="white" stopOpacity="0.95" />
          <stop offset="78%" stopColor="white" stopOpacity="0.18" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="hf-dotFadeMask">
          <rect width={vbW} height={vbH} fill="url(#hf-dotFade)" />
        </mask>
      </defs>
      <g mask="url(#hf-dotFadeMask)">
        {cells.map(({ r, c, tier, sparkle, delay, duration }) => {
          const radius = tier === "bright" ? 1.6 : tier === "mid" ? 1.1 : 0.7;
          const baseOpacity =
            tier === "bright" ? 1 : tier === "mid" ? 0.6 : 0.32;
          const peak = tier === "bright" ? 1 : 0.9;
          return (
            <circle
              key={`${r}-${c}`}
              cx={offsetX + c * stepX}
              cy={offsetY + r * stepY}
              r={radius}
              fill="white"
              opacity={baseOpacity}
              className={sparkle ? "dot-sparkle" : undefined}
              style={
                sparkle
                  ? ({
                      "--sparkle-base": baseOpacity,
                      "--sparkle-peak": peak,
                      "--sparkle-min": 0.04,
                      "--sparkle-delay": `${delay.toFixed(2)}s`,
                      "--sparkle-duration": `${duration.toFixed(2)}s`,
                    } as React.CSSProperties)
                  : undefined
              }
            />
          );
        })}
      </g>
    </svg>
  );
}
