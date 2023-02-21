import { memo } from 'react'
import PropTypes from 'prop-types'
import { useLayoutContext } from '../../../shared/context/layout-context'
import DetachCompileButton from './detach-compile-button'

function DetachCompileButtonWrapper() {
  const { detachRole, detachIsLinked } = useLayoutContext(
    layoutContextPropTypes
  )

  if (detachRole !== 'detacher' || !detachIsLinked) {
    return null
  }

  return <DetachCompileButton />
}

const layoutContextPropTypes = {
  detachRole: PropTypes.string,
  detachIsLinked: PropTypes.bool,
}

export default memo(DetachCompileButtonWrapper)
