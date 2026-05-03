import { CardShell, CardHeader, Tone, paletteAccent } from './CardShell'
import type { DatapointCard as Card } from '@/state/canvas'

export function DatapointCardView({ card }: { card: Card }) {
  const correct = card.predicted === card.trueLabel
  return (
    <CardShell width={224} palette="cyan">
      <CardHeader
        eyebrow="Datapoint"
        title={card.label}
        right={
          <Tone
            label={correct ? 'correct' : 'misclassified'}
            tone={correct ? 'good' : 'bad'}
          />
        }
        accentColor={paletteAccent('cyan')}
      />
      <div className="px-4 pb-4 pt-3 flex flex-col gap-1.5">
        {card.features.map(f => (
          <div key={f.key} className="flex items-baseline justify-between gap-3 text-[11.5px]">
            <span className="text-[var(--color-fg-subtle)] gb-num">{f.key}</span>
            <span className="text-[var(--color-fg)] truncate">{f.value}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-baseline justify-between gap-3 text-[11.5px]">
          <span className="text-[var(--color-fg-subtle)]">y_true · ŷ</span>
          <span className="gb-num text-[var(--color-fg)]">
            {card.trueLabel} · <span style={{ color: correct ? 'var(--color-good)' : 'var(--color-bad)' }}>{card.predicted}</span>
          </span>
        </div>
      </div>
    </CardShell>
  )
}
