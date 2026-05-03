type Props = {
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomChange: (zoom: number) => void
  zoomMin?: number
  zoomMax?: number
  zoomStep?: number
}

export function HistoryControls({
  canUndo, canRedo, onUndo, onRedo,
  zoom, onZoomChange,
  zoomMin = 0.4, zoomMax = 1.6, zoomStep = 0.05,
}: Props) {
  return (
    <div
      className="absolute top-6 left-6 z-40 select-none flex items-center gap-2 p-1 pr-3 rounded-md"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <Btn enabled={canUndo} onClick={onUndo} ariaLabel="Undo last action">
        <Arrow direction="undo" />
      </Btn>
      <Btn enabled={canRedo} onClick={onRedo} ariaLabel="Redo">
        <Arrow direction="redo" />
      </Btn>

      <span className="block w-px h-5 mx-1" style={{ background: 'var(--color-border)' }} />

      <ZoomSlider
        zoom={zoom} onZoomChange={onZoomChange}
        min={zoomMin} max={zoomMax} step={zoomStep}
      />
    </div>
  )
}

function ZoomSlider({
  zoom, onZoomChange, min, max, step,
}: {
  zoom: number; onZoomChange: (z: number) => void; min: number; max: number; step: number
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onZoomChange(Math.max(min, +(zoom - step).toFixed(2)))}
        className="w-5 h-5 flex items-center justify-center text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
        aria-label="Zoom out"
        title="Zoom out"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={zoom}
        onChange={e => onZoomChange(Number(e.target.value))}
        className="gb-slider"
        style={{
          width: 96,
          ['--gb-slider-accent' as any]: 'var(--color-fg-muted)',
        }}
        aria-label="Zoom"
      />

      <button
        type="button"
        onClick={() => onZoomChange(Math.min(max, +(zoom + step).toFixed(2)))}
        className="w-5 h-5 flex items-center justify-center text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
        aria-label="Zoom in"
        title="Zoom in"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onZoomChange(1)}
        className="gb-num text-[10px] tracking-wider text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors min-w-[2.4em] text-right"
        aria-label="Reset zoom to 100%"
        title="Reset zoom"
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  )
}

function Btn({
  enabled, onClick, ariaLabel, children,
}: { enabled: boolean; onClick: () => void; ariaLabel: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      aria-label={ariaLabel}
      className="w-8 h-8 rounded flex items-center justify-center
                 text-[var(--color-fg-muted)]
                 hover:text-[var(--color-fg)] hover:bg-[var(--color-elevated)]
                 disabled:text-[var(--color-fg-subtle)] disabled:opacity-40 disabled:cursor-not-allowed
                 disabled:hover:bg-transparent
                 transition-colors"
    >
      {children}
    </button>
  )
}

function Arrow({ direction }: { direction: 'undo' | 'redo' }) {
  if (direction === 'undo') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h11a5 5 0 010 10h-3" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9a5 5 0 000 10h3" />
    </svg>
  )
}
