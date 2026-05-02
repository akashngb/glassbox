import type { SplicePrimitive, PanelId } from '@/types/analysis'

export type PaletteName = 'cyan' | 'violet' | 'mint'

export interface Palette {
  primary: string
  secondary: string
  accent: string
}

export const palettes: Record<PaletteName, Palette> = {
  cyan: {
    primary: '#0a2942',
    secondary: '#3b9eff',
    accent: '#a8dcff',
  },
  violet: {
    primary: '#1f1442',
    secondary: '#8b6fff',
    accent: '#c4b5ff',
  },
  mint: {
    primary: '#0a3a2a',
    secondary: '#34d399',
    accent: '#a7f3d0',
  },
}

const PRIMITIVE_PALETTE: Record<SplicePrimitive, PaletteName> = {
  reweight:  'cyan',
  threshold: 'cyan',
  unlearn:   'violet',
  smote:     'violet',
  fairlearn: 'mint',
}

const PANEL_PALETTE: Record<PanelId, PaletteName> = {
  dpd:      'cyan',
  dir:      'violet',
  eod:      'cyan',
  accuracy: 'mint',
  flags:    'violet',
}

export function paletteForPrimitive(p: SplicePrimitive): PaletteName {
  return PRIMITIVE_PALETTE[p]
}

export function paletteForPanel(id: PanelId): PaletteName {
  return PANEL_PALETTE[id]
}
