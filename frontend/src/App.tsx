import { SparkleCanvas } from '@/components/SparkleCanvas'
import { Workspace } from '@/components/Workspace'

export function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--color-bg)]">
      <SparkleCanvas />
      <Workspace />
    </div>
  )
}
