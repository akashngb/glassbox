import { CardShell, CardHeader, Tone, paletteAccent } from './CardShell'
import type { ProxyCard as Card } from '@/state/canvas'

export function ProxyCardView({ card }: { card: Card }) {
  const severity = card.correlation * card.shapImportance
  const tone = severity > 0.12 ? 'bad' : severity > 0.06 ? 'warn' : 'neutral'

  return (
    <CardShell width={244} active={tone === 'bad'} palette="red">
      <CardHeader
        eyebrow="Proxy warning"
        title={card.feature}
        right={<Tone label={tone === 'bad' ? 'high risk' : 'flagged'} tone={tone} />}
        accentColor={paletteAccent('red')}
      />
      <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
          <span className="text-[var(--color-fg-muted)]">corr · {card.protectedAttr}</span>
          <span className="gb-num text-[var(--color-fg)]">{card.correlation.toFixed(2)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
          <span className="text-[var(--color-fg-muted)]">SHAP importance</span>
          <span className="gb-num text-[var(--color-fg)]">{card.shapImportance.toFixed(2)}</span>
        </div>
        <div className="text-[10.5px] text-[var(--color-fg-subtle)] leading-snug pt-1">
          High predictive weight + high correlation with <span className="gb-num">{card.protectedAttr}</span> → likely encoding bias as a proxy.
        </div>
      </div>
    </CardShell>
  )
}
