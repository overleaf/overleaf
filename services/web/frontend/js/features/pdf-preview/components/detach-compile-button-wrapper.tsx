import { memo } from 'react'
import { useLayoutContext } from '../../../shared/context/layout-context'
import DetachCompileButton from './detach-compile-button'

function DetachCompileButtonWrapper() {
  const { detachRole, detachIsLinked } = useLayoutContext()

  if (detachRole !== 'detacher' || !detachIsLinked) {
    return null
  }

  return <DetachCompileButton />
}

export default memo(DetachCompileButtonWrapper)
