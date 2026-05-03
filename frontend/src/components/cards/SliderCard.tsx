import { CardShell, CardHeader, paletteAccent } from './CardShell'
import type { SliderCard as Card } from '@/state/canvas'
import { sliderEffect } from '@/state/canvas'

type Props = {
  card: Card
  onChange: (id: string, value: number) => void
}

export function SliderCardView({ card, onChange }: Props) {
  const accent = paletteAccent(card.palette)
  const eff = sliderEffect(card)

  const fmt = formatter(card.format)
  const fmtSigned = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(3)
  const fmtPct = (v: number) => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + 'pp'

  const pct = ((card.value - card.min) / (card.max - card.min)) * 100
  const basePct = ((card.baseline - card.min) / (card.max - card.min)) * 100

  return (
    <CardShell width={272} palette={card.palette} loadingHeight={208}>
      <CardHeader
        eyebrow={`Hyperparam · ${card.source}`}
        title={card.groupName}
        accentColor={accent}
      />

      <div className="px-4 pt-3 flex flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <span className="gb-num text-[11px] text-[var(--color-fg-subtle)]">{card.paramKey}</span>
          <span className="gb-num text-[13px] text-[var(--color-fg)]">{fmt(card.value)}</span>
        </div>

        <div
          className="relative mt-3 mb-1"
          style={{ height: 22 }}
        >
          {/* Track and fill — vertically centered behind the thumb */}
          <div
            className="absolute left-0 right-0 rounded-full pointer-events-none"
            style={{
              top: '50%', transform: 'translateY(-50%)',
              height: 3, background: 'var(--color-border)',
            }}
          />
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              top: '50%', transform: 'translateY(-50%)',
              left: 0, width: `${pct}%`,
              height: 3, background: accent, opacity: 0.9,
            }}
          />
          {/* Baseline tick */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '50%', transform: 'translate(-50%, -50%)',
              left: `${basePct}%`,
              width: 2, height: 12,
              background: 'var(--color-fg-subtle)', opacity: 0.7,
              borderRadius: 1,
            }}
          />
          <input
            type="range"
            min={card.min}
            max={card.max}
            step={card.step}
            value={card.value}
            onChange={(e) => onChange(card.id, Number(e.target.value))}
            className="gb-slider absolute inset-0 w-full"
            style={{ ['--gb-slider-accent' as any]: accent }}
            aria-label={card.paramKey}
          />
        </div>

        <div className="flex items-baseline justify-between gap-2 mt-1 text-[10px] text-[var(--color-fg-subtle)] gb-num">
          <span>{fmt(card.min)}</span>
          <span className="opacity-70">baseline {fmt(card.baseline)}</span>
          <span>{fmt(card.max)}</span>
        </div>
      </div>

      <div className="px-4 pt-3 text-[10.5px] leading-snug text-[var(--color-fg-subtle)]">
        {card.description}
      </div>

      <div
        className="mx-3 mt-3 mb-3 px-2 py-1.5 rounded-md flex items-center justify-between gap-2 gb-num text-[10px]"
        style={{ background: 'rgba(255,255,255,0.02)', border: `1px dashed ${accent}66` }}
      >
        <span className="uppercase tracking-wider" style={{ color: accent }}>live</span>
        <span className="text-[var(--color-fg-muted)]">
          ΔDP <span style={{ color: eff.dp <= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>{fmtSigned(eff.dp)}</span>
        </span>
        <span className="text-[var(--color-fg-muted)]">
          ΔAcc <span style={{ color: eff.acc >= 0 ? 'var(--color-good)' : 'var(--color-warn)' }}>{fmtPct(eff.acc)}</span>
        </span>
      </div>
    </CardShell>
  )
}

function formatter(kind: Card['format']): (v: number) => string {
  switch (kind) {
    case 'int':    return v => Math.round(v).toString()
    case 'fixed3': return v => v.toFixed(3)
    case 'fixed2':
    default:       return v => v.toFixed(2)
  }
}
