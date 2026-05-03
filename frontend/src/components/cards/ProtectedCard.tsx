import { CardShell, CardHeader, Tone, paletteAccent } from './CardShell'
import type { ProtectedCard as Card } from '@/state/canvas'

export function ProtectedCardView({ card }: { card: Card }) {
  const maxRate = Math.max(...card.groups.map(g => g.positiveRate))
  const minRate = Math.min(...card.groups.map(g => g.positiveRate))
  const spread = maxRate - minRate
  const tone = spread > 0.15 ? 'bad' : spread > 0.08 ? 'warn' : 'good'

  return (
    <CardShell width={244} palette="violet">
      <CardHeader
        eyebrow="Protected attribute"
        title={card.attr}
        right={<Tone label={`spread ${(spread * 100).toFixed(0)}pp`} tone={tone} />}
        accentColor={paletteAccent('violet')}
      />
      <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
        {card.groups.map(g => (
          <div key={g.name} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
              <span className="text-[var(--color-fg-muted)] truncate">{g.name}</span>
              <span className="gb-num text-[var(--color-fg)]">{(g.positiveRate * 100).toFixed(0)}%</span>
            </div>
            <div className="h-[3px] rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${g.positiveRate * 100}%`,
                  background:
                    g.positiveRate >= 0.5 ? 'var(--color-bad)' :
                    g.positiveRate >= 0.4 ? 'var(--color-warn)' :
                    'var(--color-good)',
                }}
              />
            </div>
            <div className="text-[9.5px] text-[var(--color-fg-subtle)] gb-num">
              n={(g.share * 100).toFixed(0)}% of cohort
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  )
}
