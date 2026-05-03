import { BorderRotate } from './BorderRotate'

type Stage = {
  id: string
  kind: 'data' | 'preprocess' | 'feature' | 'model' | 'eval'
  title: string
  subtitle: string
  meta: string
  badge?: { label: string; tone: 'good' | 'warn' | 'bad' }
  image?: string
}

const STAGES: Stage[] = [
  {
    id: 'data',
    kind: 'data',
    title: 'COMPAS recidivism',
    subtitle: 'Data Source',
    meta: '7 214 rows · 12 cols',
    image: 'https://placehold.co/520x260/1a1410/c7a03c?text=Dataset+Preview',
  },
  {
    id: 'preprocess',
    kind: 'preprocess',
    title: 'Encode race · gender',
    subtitle: 'Preprocessing',
    meta: 'OneHotEncoder · StandardScaler',
  },
  {
    id: 'feature',
    kind: 'feature',
    title: 'Feature engineering',
    subtitle: 'Feature Eng',
    meta: '11 → 23 features',
    badge: { label: 'proxy: zip_code', tone: 'warn' },
  },
  {
    id: 'model',
    kind: 'model',
    title: 'LogisticRegression',
    subtitle: 'Model',
    meta: 'C=1.0 · class_weight=balanced',
    badge: { label: 'acc 91.2%', tone: 'good' },
  },
  {
    id: 'eval',
    kind: 'eval',
    title: 'Bias scorecard',
    subtitle: 'Evaluation',
    meta: 'DP 0.61 · EO 0.58',
    badge: { label: 'DP -0.39', tone: 'bad' },
  },
]

export function PipelineCards() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-12">
      <div className="pointer-events-auto flex flex-wrap items-stretch justify-center gap-6">
        {STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-4">
            <PipelineCard stage={stage} />
            {i < STAGES.length - 1 && <Connector />}
          </div>
        ))}
      </div>
    </div>
  )
}

function PipelineCard({ stage }: { stage: Stage }) {
  return (
    <BorderRotate
      animationMode="auto-rotate"
      animationSpeed={8}
      borderRadius={16}
      borderWidth={1.5}
      backgroundColor="#16191f"
      gradientColors={{
        primary: '#262b35',
        secondary: '#ffb86b',
        accent: '#f9de90',
      }}
      style={{ width: stage.image ? 280 : 232 }}
    >
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
          {stage.subtitle}
        </div>
        <div className="text-[15px] font-semibold leading-tight text-[var(--color-fg)]">
          {stage.title}
        </div>
        {stage.image && (
          <div
            className="rounded-md overflow-hidden border border-[var(--color-border)] aspect-[2/1] bg-[var(--color-elevated)]"
            style={{
              backgroundImage: `url(${stage.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-label={`${stage.title} preview`}
          />
        )}
        <div className="gb-num text-[11px] text-[var(--color-fg-muted)]">{stage.meta}</div>
        {stage.badge && (
          <div
            className="self-start text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
            style={{
              color: toneColor(stage.badge.tone),
              borderColor: toneColor(stage.badge.tone),
            }}
          >
            {stage.badge.label}
          </div>
        )}
      </div>
    </BorderRotate>
  )
}

function Connector() {
  return (
    <div className="flex items-center">
      <div className="h-px w-8 bg-[var(--color-border)]" />
      <div className="text-[var(--color-fg-subtle)] text-xs -mx-1">›</div>
      <div className="h-px w-2 bg-[var(--color-border)]" />
    </div>
  )
}

function toneColor(tone: 'good' | 'warn' | 'bad'): string {
  switch (tone) {
    case 'good': return 'var(--color-good)'
    case 'warn': return 'var(--color-warn)'
    case 'bad':  return 'var(--color-bad)'
  }
}
