import { lazy, Suspense } from 'react'

const CommandPaletteRoot = lazy(() => import('./command-palette-root'))

export default function CommandPalette() {
  return (
    <Suspense fallback={null}>
      <CommandPaletteRoot />
    </Suspense>
  )
}
