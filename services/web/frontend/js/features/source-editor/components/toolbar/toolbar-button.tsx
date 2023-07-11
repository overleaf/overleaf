import { memo, useCallback } from 'react'
import { EditorView } from '@codemirror/view'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import { Button } from 'react-bootstrap'
import classnames from 'classnames'
import Tooltip from '../../../../shared/components/tooltip'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import Icon from '../../../../shared/components/icon'

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

  const handleMouseDown = useCallback(event => {
    event.preventDefault()
  }, [])

  const handleClick = useCallback(
    event => {
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
    <Button
      className={classnames('ol-cm-toolbar-button', className, { hidden })}
      aria-label={label}
      onMouseDown={handleMouseDown}
      onClick={!disabled ? handleClick : undefined}
      bsStyle={null}
      active={active}
      aria-disabled={disabled}
      type="button"
    >
      {textIcon ? icon : <Icon type={icon} fw accessibilityLabel={label} />}
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
