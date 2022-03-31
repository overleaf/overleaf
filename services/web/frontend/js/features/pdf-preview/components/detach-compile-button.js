import { memo } from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import PdfCompileButtonInner from './pdf-compile-button-inner'

export function DetachCompileButton() {
  const { compiling, hasChanges, startCompile } = useCompileContext()

  return (
    <div
      className={classnames({
        'btn-recompile-group': true,
        'btn-recompile-group-has-changes': hasChanges,
      })}
    >
      <PdfCompileButtonInner
        startCompile={startCompile}
        compiling={compiling}
      />
    </div>
  )
}

export function DetachCompileButtonWrapper() {
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
