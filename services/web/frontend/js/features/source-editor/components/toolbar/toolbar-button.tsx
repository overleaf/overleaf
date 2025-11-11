import { memo, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { useCodeMirrorViewContext } from '../codemirror-context'
import classnames from 'classnames'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import MaterialIcon from '@/shared/components/material-icon'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

export const ToolbarButton = memo<{
  id: string
  className?: string
  label: string
  command?: (view: EditorView) => void
  active?: boolean
  disabled?: boolean
  icon: string
  textIcon?: boolean
  hidden?: boolean
  shortcut?: string
}>(function ToolbarButton({
  id,
  className,
  label,
  command,
  active = false,
  disabled,
  icon,
  textIcon = false,
  hidden = false,
  shortcut,
}) {
  const view = useCodeMirrorViewContext()

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
  }, [])

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      emitToolbarEvent(view, id)
      if (command) {
        event.preventDefault()
        command(view)
        view.focus()
      }
    },
    [command, view, id]
  )

  const button = (
    <button
      className={classnames('ol-cm-toolbar-button', className, {
        active,
        hidden,
      })}
      aria-label={label}
      onMouseDown={handleMouseDown}
      onClick={!disabled ? handleClick : undefined}
      aria-disabled={disabled}
      type="button"
    >
      {textIcon ? (
        icon
      ) : (
        <MaterialIcon type={icon} accessibilityLabel={label} />
      )}
    </button>
  )

  if (!label) {
    return button
  }

  const description = (
    <>
      <div>
        {label}
        {shortcut && <span> ({shortcut})</span>}
      </div>
    </>
  )

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
