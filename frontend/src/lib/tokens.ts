/**
 * Typed reads of the CSS @theme tokens. CSS is the single source of truth;
 * this module reads at module-load and exposes typed numbers / objects for
 * gsap durations and motion springs.
 *
 * Never write back to a token. If a value needs to change at runtime, set a
 * CSS custom property on a parent element (state-driven), and re-read here.
 */

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

function readVar(name: string): string {
  if (!isBrowser) return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function readMs(name: string, fallback: number): number {
  const raw = readVar(name)
  if (!raw) return fallback
  if (raw.endsWith('ms')) return parseFloat(raw)
  if (raw.endsWith('s')) return parseFloat(raw) * 1000
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

function readNumber(name: string, fallback: number): number {
  const raw = readVar(name)
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

function readSec(name: string, fallback: number): number {
  return readMs(name, fallback * 1000) / 1000
}

export interface MotionSpring {
  type: 'spring'
  stiffness: number
  damping: number
  mass: number
}

/**
 * Read all numeric tokens once at first call. Re-reads on hot reload because
 * the module re-evaluates. In a dev-server hot edit, refresh.
 */
function load() {
  return {
    /* durations (ms) */
    durInstant: readMs('--dur-instant', 80),
    durQuick:   readMs('--dur-quick',   180),
    durBase:    readMs('--dur-base',    320),
    durEvent:   readMs('--dur-event',   620),
    durBoot:    readMs('--dur-boot',    1100),
    durScrub:   readMs('--dur-scrub',   500),

    /* same durations in seconds (gsap convenience) */
    durQuickSec: readSec('--dur-quick',   0.18),
    durBaseSec:  readSec('--dur-base',    0.32),
    durEventSec: readSec('--dur-event',   0.62),
    durBootSec:  readSec('--dur-boot',    1.10),
    durScrubSec: readSec('--dur-scrub',   0.50),

    /* easing strings (matched to CustomEase names registered in gsapInit) */
    easeOut:    'power3.out',
    easeIn:     'power3.in',
    easeInOut:  'power2.inOut',
    easeSettle: 'settle',
    easeDampen: 'dampen',

    /* CSS easing for direct use in CSS-property animations */
    easeOutCss:    readVar('--ease-out')    || 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeInCss:     readVar('--ease-in')     || 'cubic-bezier(0.7, 0, 0.84, 0)',
    easeInOutCss:  readVar('--ease-in-out') || 'cubic-bezier(0.65, 0, 0.35, 1)',
    easeSettleCss: readVar('--ease-settle') || 'cubic-bezier(0.20, 0.80, 0.30, 1.05)',
    easeDampenCss: readVar('--ease-dampen') || 'cubic-bezier(0.4, 0, 0.6, 1)',

    /* motion springs (motion/react) */
    springChrome: {
      type: 'spring' as const,
      stiffness: readNumber('--motion-stiff', 280),
      damping:   readNumber('--motion-damp', 22),
      mass:      1,
    } satisfies MotionSpring,

    springWave: {
      type: 'spring' as const,
      stiffness: readNumber('--motion-stiff', 280),
      damping:   readNumber('--motion-damp-wave', 35),
      mass:      1,
    } satisfies MotionSpring,

    springSoft: {
      type: 'spring' as const,
      stiffness: readNumber('--motion-stiff-soft', 180),
      damping:   readNumber('--motion-damp-soft', 26),
      mass:      1,
    } satisfies MotionSpring,

    springSnap: {
      type: 'spring' as const,
      stiffness: readNumber('--motion-stiff-snap', 380),
      damping:   readNumber('--motion-damp-snap', 18),
      mass:      1,
    } satisfies MotionSpring,

    /* stagger (seconds — gsap convention) */
    staggerPanelSec:    readMs('--stagger-panel', 60) / 1000,
    staggerTraySec:     readMs('--stagger-tray', 40) / 1000,
    staggerCaptionSec:  readMs('--stagger-caption', 12) / 1000,
    staggerTimelineSec: readMs('--stagger-timeline', 28) / 1000,

    /* probe field */
    probeDensity:       Math.round(readNumber('--probe-density', 120)),
    probeDensityRich:   Math.round(readNumber('--probe-density-rich', 220)),
    probeDriftSpeed:    readNumber('--probe-drift-speed', 0.06),
    probePulseMs:       readMs('--probe-pulse-ms', 1200),
    probeDampenFactor:  readNumber('--probe-dampen-factor', 0.40),

    /* drag */
    dragArmDistancePx:  readNumber('--drag-arm-distance', 6),
    dragMinArea:        readNumber('--drag-min-area', 0.0036),
    dragMinProbes:      Math.max(1, Math.round(readNumber('--drag-min-probes', 3))),
  }
}

export const tokens = load()
export type Tokens = typeof tokens
