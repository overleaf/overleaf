import PropTypes from 'prop-types'
import { useLayoutContext } from '../../../shared/context/layout-context'
import PdfSynctexControls from './pdf-synctex-controls'

export function DetacherSynctexControl() {
  const { detachRole, detachIsLinked } = useLayoutContext(
    layoutContextPropTypes
  )
  if (detachRole === 'detacher' && detachIsLinked) {
    return <PdfSynctexControls />
  }
  return null
}

export function DetachedSynctexControl() {
  const { detachRole, detachIsLinked } = useLayoutContext(
    layoutContextPropTypes
  )
  if (detachRole === 'detached' && detachIsLinked) {
    return <PdfSynctexControls />
  }
  return null
}

const layoutContextPropTypes = {
  detachRole: PropTypes.string,
  detachIsLinked: PropTypes.bool,
}
