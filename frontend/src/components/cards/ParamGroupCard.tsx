import { CardShell, CardHeader, paletteAccent } from './CardShell'
import type { ParamGroupCard as Card } from '@/state/canvas'

const GROUP_HINT: Record<Card['groupId'], string> = {
  features: 'Drag to trash to remove protected attributes from the model.',
  unlearn:  'SISA unlearning thresholds — looser policy = more aggressive purge.',
  cw:       'Class weighting — defaults are neutral; balanced narrows DP.',
  reg:      'L2 regularization. Removing this may overfit — bias may worsen.',
  preproc:  'Encoders + scaling. Mostly cosmetic; small bias effect.',
  sisa:     'Sharding controls. More shards → cheaper future unlearning.',
}

export function ParamGroupCardView({ card }: { card: Card }) {
  return (
    <CardShell width={252} palette={card.palette} loadingHeight={188}>
      <CardHeader
        eyebrow={`Param group · ${card.source}`}
        title={card.groupName}
        accentColor={paletteAccent(card.palette)}
      />

      <div className="px-4 pt-3 flex flex-col">
        <div className="rounded-md border border-[var(--color-border)] overflow-hidden divide-y divide-[var(--color-border)]">
          {card.params.map(p => (
            <div key={p.key} className="flex items-baseline justify-between gap-3 px-2.5 py-1.5">
              <span className="gb-num text-[11px] text-[var(--color-fg-subtle)] truncate">{p.key}</span>
              <span className="gb-num text-[11px] text-[var(--color-fg)] truncate">{p.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 text-[10.5px] leading-snug text-[var(--color-fg-subtle)]">
        {GROUP_HINT[card.groupId]}
      </div>

      <ImpactStrip impact={card.trashImpact} accent={paletteAccent(card.palette)} />
    </CardShell>
  )
}

function ImpactStrip({
  impact, accent,
}: { impact: { dp: number; eod: number; acc: number }; accent: string }) {
  const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2)
  const fmtPct = (v: number) => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + 'pp'
  return (
    <div
      className="mx-3 mb-3 px-2 py-1.5 rounded-md flex items-center justify-between gap-2 gb-num text-[10px]"
      style={{ background: 'rgba(255,255,255,0.02)', border: `1px dashed ${accent}66` }}
    >
      <span className="uppercase tracking-wider text-[var(--color-fg-subtle)]" style={{ color: accent }}>if trashed</span>
      <span className="text-[var(--color-fg-muted)]">
        ΔDP <span style={{ color: impact.dp < 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>{fmt(impact.dp)}</span>
      </span>
      <span className="text-[var(--color-fg-muted)]">
        ΔAcc <span style={{ color: impact.acc >= 0 ? 'var(--color-good)' : 'var(--color-warn)' }}>{fmtPct(impact.acc)}</span>
      </span>
    </div>
  )
}
