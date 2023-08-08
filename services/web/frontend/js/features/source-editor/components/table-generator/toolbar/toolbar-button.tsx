import { EditorView } from '@codemirror/view'
import classNames from 'classnames'
import { memo, useCallback } from 'react'
import { Button } from 'react-bootstrap'
import Tooltip from '../../../../../shared/components/tooltip'
import MaterialIcon from '../../../../../shared/components/material-icon'
import { useCodeMirrorViewContext } from '../../codemirror-editor'

export const ToolbarButton = memo<{
  id: string
  className?: string
  label: string
  command?: (view: EditorView) => void
  active?: boolean
  disabled?: boolean
  icon: string
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
  hidden = false,
  shortcut,
}) {
  const view = useCodeMirrorViewContext()
  const handleMouseDown = useCallback(event => {
    event.preventDefault()
  }, [])

  const handleClick = useCallback(
    event => {
      if (command) {
        event.preventDefault()
        command(view)
        view.focus()
      }
    },
    [command, view]
  )

  const button = (
    <Button
      className={classNames('table-generator-toolbar-button', className, {
        hidden,
      })}
      aria-label={label}
      onMouseDown={handleMouseDown}
      onClick={!disabled ? handleClick : undefined}
      bsStyle={null}
      active={active}
      disabled={disabled}
      type="button"
    >
      <MaterialIcon type={icon} />
    </Button>
  )

  if (!label) {
    return button
  }

  const description = (
    <>
      <div>{label}</div>
      {shortcut && <div>{shortcut}</div>}
    </>
  )

  return (
    <Tooltip
      id={id}
      description={description}
      overlayProps={{ placement: 'bottom' }}
    >
      {button}
    </Tooltip>
  )
})
