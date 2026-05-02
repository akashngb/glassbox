import { CommandBar } from '@/components/CommandBar'
import { SpliceTray } from '@/components/SpliceTray'
import { BentoCanvas } from '@/components/BentoCanvas'
import { InspectorRail } from '@/components/InspectorRail'
import { Timeline } from '@/components/Timeline'

export function App() {
  return (
    <div
      className="grid h-screen w-screen text-[var(--color-fg)]"
      style={{
        gridTemplateRows: '52px 1fr 64px',
        gridTemplateColumns: '240px 1fr 320px',
        gridTemplateAreas: `
          "cmd    cmd    cmd"
          "tray   canvas inspector"
          "tline  tline  tline"
        `,
      }}
    >
      <div style={{ gridArea: 'cmd' }} className="border-b border-[var(--color-border)]">
        <CommandBar />
      </div>
      <div style={{ gridArea: 'tray' }} className="border-r border-[var(--color-border)] overflow-y-auto">
        <SpliceTray />
      </div>
      <div style={{ gridArea: 'canvas' }} className="overflow-hidden">
        <BentoCanvas />
      </div>
      <div style={{ gridArea: 'inspector' }} className="border-l border-[var(--color-border)] overflow-y-auto">
        <InspectorRail />
      </div>
      <div style={{ gridArea: 'tline' }} className="border-t border-[var(--color-border)]">
        <Timeline />
      </div>
    </div>
  )
}
