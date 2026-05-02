import { CommandBar } from '@/components/CommandBar'
import { SpliceTray } from '@/components/SpliceTray'
import { BentoCanvas } from '@/components/BentoCanvas'
import { InspectorRail } from '@/components/InspectorRail'
import { Timeline } from '@/components/Timeline'
import { ProbeField } from '@/particles/ProbeField'
import { SpliceGesture } from '@/particles/SpliceGesture'
import { SceneRoot } from '@/components/SceneRoot'
import { FieldStateGate } from '@/components/FieldStateGate'

export function App() {
  return (
    <SceneRoot>
      <FieldStateGate />
      <div
        className="grid h-screen w-screen text-[var(--color-fg)] relative"
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
        {/* Bento backdrop: cool + warm radial blooms so glass has something
            nontrivial to refract. Sits below everything else. */}
        <div className="gb-canvas-backdrop" aria-hidden="true" />

        <div style={{ gridArea: 'cmd' }} className="gb-cmd-host">
          <CommandBar />
        </div>
        <div style={{ gridArea: 'tray' }} className="gb-tray-host overflow-y-auto no-scrollbar">
          <SpliceTray />
        </div>
        <div style={{ gridArea: 'canvas' }} className="relative overflow-hidden">
          {/* Backdrop: live adversarial-prober particles, Backboard-orchestrated when wired. */}
          <ProbeField />
          {/* Gesture overlay: drag-to-splice rectangle, sits between particles and panels. */}
          <SpliceGesture />
          {/* Foreground: dashboard panels, above the field via gb-bento-canvas z-index. */}
          <BentoCanvas />
        </div>
        <div style={{ gridArea: 'inspector' }} className="gb-inspector-host overflow-y-auto no-scrollbar">
          <InspectorRail />
        </div>
        <div style={{ gridArea: 'tline' }} className="gb-tline-host">
          <Timeline />
        </div>
      </div>
    </SceneRoot>
  )
}
