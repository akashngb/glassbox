import { useAnalysis } from '@/lib/useAnalysis'
import { Panel } from './Panel'
import { Wave } from './Wave'

export function BentoCanvas() {
  const { head, ghost } = useAnalysis()

  return (
    <div
      className="gb-bento-canvas grid h-full gap-3 p-4"
      style={{
        gridTemplateColumns: '1fr 1.4fr',
        gridTemplateRows: '1fr 1fr 1fr',
        gridTemplateAreas: `
          "dpd      accuracy"
          "dir      accuracy"
          "eod      flags"
        `,
      }}
    >
      <div style={{ gridArea: 'dpd' }}>
        <Panel
          id="dpd"
          title="Demographic Parity Diff"
          unit="DPD"
          metric={fmtPct(head.panels.dpd.value)}
          subline="ideally 0"
        >
          <Wave
            baseline={spread(head.panels.dpd.value, 12)}
            ghost={ghost ? spread(ghost.panels.dpd.value, 12) : null}
          />
        </Panel>
      </div>

      <div style={{ gridArea: 'dir' }}>
        <Panel
          id="dir"
          title="Disparate Impact Ratio"
          unit="DIR · 80% rule"
          metric={head.panels.dir.value.toFixed(3)}
          subline={head.panels.dir.value < 0.8 ? 'below threshold' : 'within rule'}
        >
          <Wave
            baseline={spread(head.panels.dir.value, 12)}
            ghost={ghost ? spread(ghost.panels.dir.value, 12) : null}
          />
        </Panel>
      </div>

      <div style={{ gridArea: 'eod' }}>
        <Panel
          id="eod"
          title="Equal Opportunity Diff"
          unit="EOD"
          metric={fmtPct(head.panels.eod.value)}
          subline="ideally 0"
        >
          <Wave
            baseline={spread(head.panels.eod.value, 12)}
            ghost={ghost ? spread(ghost.panels.eod.value, 12) : null}
          />
        </Panel>
      </div>

      <div style={{ gridArea: 'accuracy' }}>
        <Panel
          id="accuracy"
          title="Accuracy by Group"
          unit="privileged · unprivileged"
          metric={
            <span>
              {(head.panels.accuracy.privileged * 100).toFixed(1)}
              <span className="text-[var(--color-fg-subtle)] mx-1.5 text-[20px]">·</span>
              {(head.panels.accuracy.unprivileged * 100).toFixed(1)}
            </span>
          }
          subline="%"
        >
          <Wave
            baseline={[head.panels.accuracy.privileged, head.panels.accuracy.unprivileged, head.panels.accuracy.privileged, head.panels.accuracy.unprivileged].flatMap(v => [v, v, v])}
            ghost={ghost ? [ghost.panels.accuracy.privileged, ghost.panels.accuracy.unprivileged, ghost.panels.accuracy.privileged, ghost.panels.accuracy.unprivileged].flatMap(v => [v, v, v]) : null}
          />
        </Panel>
      </div>

      <div style={{ gridArea: 'flags' }}>
        <Panel
          id="flags"
          title="Bias Flags"
          unit={`${head.panels.flags.length} active`}
          metric={head.panels.flags.length}
          subline="violations"
        >
          <ul className="text-[11px] text-[var(--color-fg-muted)] space-y-1">
            {head.panels.flags.slice(0, 3).map((f, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={severityDot(f.severity)} />
                <span>{f.message}</span>
              </li>
            ))}
            {head.panels.flags.length === 0 && (
              <li className="text-[var(--color-good)]">no violations</li>
            )}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}pp`
}

function spread(value: number, n: number): number[] {
  /** Generate a deterministic-but-shaped wave around `value` for visual texture. */
  const out = []
  for (let i = 0; i < n; i++) {
    const phase = (i / (n - 1)) * Math.PI * 2
    const wobble = Math.sin(phase * 1.7) * 0.12 + Math.sin(phase * 0.5) * 0.05
    const y = clamp(value + wobble * (1 - Math.abs(value - 0.5)), 0.05, 0.95)
    out.push(y)
  }
  return out
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function severityDot(sev: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  const color = sev === 'HIGH'
    ? 'var(--color-bad)'
    : sev === 'MEDIUM'
      ? 'var(--color-warn)'
      : 'var(--color-fg-subtle)'
  return `inline-block w-2 h-2 rounded-full bg-[${color}]`
}
