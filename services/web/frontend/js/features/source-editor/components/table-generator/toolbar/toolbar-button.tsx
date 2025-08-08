import { EditorView } from '@codemirror/view'
import classNames from 'classnames'
import { memo, useCallback } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import MaterialIcon from '../../../../../shared/components/material-icon'
import { useCodeMirrorViewContext } from '../../codemirror-context'
import { emitTableGeneratorEvent } from '../analytics'

export const ToolbarButton = memo<{
  id: string
  className?: string
  label: string
  command?: (view: EditorView) => void
  active?: boolean
  disabled?: boolean
  disabledLabel?: string
  icon: string
  hidden?: boolean
}>(function ToolbarButton({
  id,
  className,
  label,
  command,
  active = false,
  disabled,
  icon,
  hidden = false,
  disabledLabel,
}) {
  const view = useCodeMirrorViewContext()
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
  }, [])

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      if (command) {
        emitTableGeneratorEvent(view, id)
        event.preventDefault()
        command(view)
      }
    },
    [command, view, id]
  )

  const button = (
    <button
      className={classNames('table-generator-toolbar-button', className, {
        hidden,
        active,
      })}
      aria-label={label}
      onMouseDown={handleMouseDown}
      onClick={!disabled ? handleClick : undefined}
      disabled={disabled}
      aria-disabled={disabled}
      type="button"
    >
      <MaterialIcon type={icon} />
    </button>
  )

  const description =
    disabled && disabledLabel ? <div>{disabledLabel}</div> : <div>{label}</div>

  return (
    <OLTooltip
      id={id}
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      {button}
    </OLTooltip>
  )
})
