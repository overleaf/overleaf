import { memo, useCallback } from 'react'
import PropTypes from 'prop-types'
import classnames from 'classnames'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useCompileContext } from '../../../shared/context/compile-context'
import useDetachAction from '../../../shared/hooks/use-detach-action'
import PdfCompileButtonInner from './pdf-compile-button-inner'

export function DetachCompileButton() {
  const { compiling, hasChanges, startCompile } = useCompileContext()

  const startOrTriggerCompile = useDetachAction(
    'start-compile',
    startCompile,
    'detacher',
    'detached'
  )

  const handleStartCompile = useCallback(() => startOrTriggerCompile(), [
    startOrTriggerCompile,
  ])

  return (
    <div
      className={classnames({
        'btn-recompile-group': true,
        'btn-recompile-group-has-changes': hasChanges,
      })}
    >
      <PdfCompileButtonInner
        startCompile={handleStartCompile}
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
