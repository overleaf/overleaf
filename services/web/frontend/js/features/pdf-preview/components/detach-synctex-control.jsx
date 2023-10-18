import { useLayoutContext } from '../../../shared/context/layout-context'
import PdfSynctexControls from './pdf-synctex-controls'

export function DefaultSynctexControl() {
  const { detachRole } = useLayoutContext()
  if (!detachRole) {
    return <PdfSynctexControls />
  }
  return null
}

export function DetacherSynctexControl() {
  const { detachRole, detachIsLinked } = useLayoutContext()
  if (detachRole === 'detacher' && detachIsLinked) {
    return <PdfSynctexControls />
  }
  return null
}

export function DetachedSynctexControl() {
  const { detachRole, detachIsLinked } = useLayoutContext()
  if (detachRole === 'detached' && detachIsLinked) {
    return <PdfSynctexControls />
  }
  return null
}
