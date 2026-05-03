import { useEffect, useMemo, useRef, useState } from 'react'
import type { BiasReading } from '@/state/canvas'
import { BorderRotate } from './BorderRotate'

type Props = {
  series: BiasReading[]
  latest: BiasReading
}

const W = 340
const H = 380
const CHART_H = 120

// Subtle white→gray→white gradient so the rotating border reads as a soft halo
// rather than a colored accent. Matches the "white border" the user asked for.
const WHITE_BORDER = {
  primary:   '#ffffff',
  secondary: '#a8acb5',
  accent:    '#ffffff',
}

export function BiasMeter({ series, latest }: Props) {
  const tone = scoreTone(latest.dp)

  return (
    <div className="absolute top-6 right-6 z-40 select-none" style={{ width: W }}>
      <BorderRotate
        animationMode="rotate-on-hover"
        animationSpeed={6}
        borderRadius={16}
        borderWidth={1}
        backgroundColor="#16191f"
        gradientColors={WHITE_BORDER}
        style={{ width: W, height: H }}
      >
        <div className="px-5 pt-5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
            Bias
          </div>
        </div>

        <div className="px-5 pt-2">
          <Gauge value={latest.dp} tone={tone} />
        </div>

        <div className="px-5 pt-3">
          <Trend series={series} />
        </div>
      </BorderRotate>
    </div>
  )
}

function Gauge({ value, tone }: { value: number; tone: ToneKey }) {
  const radius = 100
  const stroke = 14
  const cx = (W - 40) / 2
  const cy = radius + 8
  const start = polar(cx, cy, radius, -180)
  const end   = polar(cx, cy, radius, 0)

  const valuePct = clamp(value, 0, 1)
  const valueAngle = -180 + valuePct * 180
  const valueEnd = polar(cx, cy, radius, valueAngle)
  const tip      = polar(cx, cy, radius, valueAngle)

  // SVG ids must be stable but unique — Math.random would flicker on every render.
  const gradId  = `gb-gauge-grad`
  const glowId  = `gb-gauge-glow`
  const arcColor = TONE[tone]

  return (
    <svg width={W - 40} height={radius + 24} className="block" overflow="visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-good)" />
          <stop offset="50%" stopColor="var(--color-warn)" />
          <stop offset="100%" stopColor="var(--color-bad)" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track — faint full arc */}
      <path
        d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`}
        stroke="var(--color-border)" strokeWidth={stroke} fill="none" strokeLinecap="round"
      />
      {/* Filled value arc — gradient + glow so the reading reads as the focal point */}
      <path
        d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${valuePct > 0.5 ? 1 : 0} 1 ${valueEnd.x} ${valueEnd.y}`}
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        filter={`url(#${glowId})`}
        opacity={0.95}
      />
      {/* Crisp tip — pulled out of the glow so the head of the arc reads sharp */}
      <circle cx={tip.x} cy={tip.y} r={stroke / 2 + 1.5} fill={arcColor} opacity={0.95} />
      <circle cx={tip.x} cy={tip.y} r={stroke / 2 - 2} fill="var(--color-fg)" opacity={0.95} />

      <Tick cx={cx} cy={cy} r={radius} angleDeg={-180 + 0.1 * 180} stroke="var(--color-good)" />
      <Tick cx={cx} cy={cy} r={radius} angleDeg={-180 + 0.2 * 180} stroke="var(--color-warn)" />

      <text
        x={cx} y={cy - 6}
        textAnchor="middle"
        className="gb-num"
        fontSize="42"
        fontWeight="700"
        fill="var(--color-fg)"
        style={{ textShadow: `0 0 16px ${arcColor}55` }}
      >
        {value.toFixed(2)}
      </text>
      <text
        x={cx} y={cy + 16}
        textAnchor="middle"
        fontSize="9"
        letterSpacing="2"
        fill={arcColor}
        opacity={0.85}
      >
        DP DIFF
      </text>
    </svg>
  )
}

function Tick({ cx, cy, r, angleDeg, stroke }: { cx: number; cy: number; r: number; angleDeg: number; stroke: string }) {
  const inner = polar(cx, cy, r - 10, angleDeg)
  const outer = polar(cx, cy, r + 3,  angleDeg)
  return <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
}

function Trend({ series }: { series: BiasReading[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const [w, setW] = useState(W - 40)

  useEffect(() => {
    if (!ref.current) return
    setW(ref.current.clientWidth)
  }, [])

  const { dpPath, eodPath, accPath } = useMemo(() => buildPaths(series, w, CHART_H), [series, w])

  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] mb-1 flex items-center gap-3">
        <span>trend</span>
        <span className="ml-auto flex items-center gap-2 normal-case tracking-normal">
          <Legend color="var(--color-bad)"  label="DP"  />
          <Legend color="var(--color-warn)" label="EOD" />
          <Legend color="var(--color-good)" label="Acc" />
        </span>
      </div>
      <svg ref={ref} width="100%" height={CHART_H} className="block">
        <defs>
          <linearGradient id="gb-trend-dp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-bad)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--color-bad)" stopOpacity="0" />
          </linearGradient>
          <filter id="gb-trend-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <Grid w={w} h={CHART_H} />
        <FillArea d={dpPath} h={CHART_H} fill="url(#gb-trend-dp)" />
        <Series d={accPath} stroke="var(--color-good)" width={1.3} opacity={0.7} />
        <Series d={eodPath} stroke="var(--color-warn)" width={1.3} opacity={0.85} />
        <Series d={dpPath}  stroke="var(--color-bad)"  width={1.9} glow />
        <EndDot path={dpPath} color="var(--color-bad)" />
      </svg>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[9px] text-[var(--color-fg-subtle)]">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function Grid({ w, h }: { w: number; h: number }) {
  const lines = []
  for (let i = 0; i <= 3; i++) {
    const y = (h / 3) * i
    lines.push(
      <line key={i} x1={0} y1={y} x2={w} y2={y}
        stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="2 4" />,
    )
  }
  return <g>{lines}</g>
}

function Series({
  d, stroke, width = 1.4, opacity = 1, glow = false,
}: { d: string; stroke: string; width?: number; opacity?: number; glow?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      filter={glow ? 'url(#gb-trend-glow)' : undefined}
    />
  )
}

function FillArea({ d, h, fill }: { d: string; h: number; fill: string }) {
  if (!d) return null
  // Close the line path to form a polygon down to the chart baseline.
  // Pull last point from path; cheap parse — paths are M x y L x y ...
  const matches = [...d.matchAll(/[ML]\s*([\d.]+)\s+([\d.]+)/g)]
  if (matches.length === 0) return null
  const lastX = matches[matches.length - 1][1]
  const firstX = matches[0][1]
  return <path d={`${d} L ${lastX} ${h} L ${firstX} ${h} Z`} fill={fill} stroke="none" />
}

function EndDot({ path, color }: { path: string; color: string }) {
  if (!path) return null
  const matches = [...path.matchAll(/[ML]\s*([\d.]+)\s+([\d.]+)/g)]
  if (matches.length === 0) return null
  const last = matches[matches.length - 1]
  const x = Number(last[1]); const y = Number(last[2])
  return (
    <g>
      <circle cx={x} cy={y} r={4.5} fill={color} opacity={0.18} />
      <circle cx={x} cy={y} r={2.4} fill={color} />
    </g>
  )
}

function buildPaths(series: BiasReading[], w: number, h: number) {
  const n = series.length
  if (n === 0) return { dpPath: '', eodPath: '', accPath: '' }
  const xStep = n === 1 ? 0 : w / (n - 1)
  const yFor = (v: number, lo: number, hi: number) => h - ((v - lo) / (hi - lo)) * h

  const toPath = (ys: number[]) =>
    ys.map((y, i) => `${i === 0 ? 'M' : 'L'} ${(i * xStep).toFixed(2)} ${y.toFixed(2)}`).join(' ')

  return {
    dpPath:  toPath(series.map(s => yFor(s.dp,  0,   1))),
    eodPath: toPath(series.map(s => yFor(s.eod, 0,   1))),
    accPath: toPath(series.map(s => yFor(s.acc, 0.5, 1))),
  }
}

type ToneKey = 'good' | 'warn' | 'bad'

const TONE: Record<ToneKey, string> = {
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  bad:  'var(--color-bad)',
}

function scoreTone(dp: number): ToneKey {
  if (dp <= 0.10) return 'good'
  if (dp <= 0.20) return 'warn'
  return 'bad'
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
