import { FC, memo, useRef } from 'react'
import { Button, ListGroup, Overlay, Popover } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import useDropdown from '../../../../shared/hooks/use-dropdown'
import Tooltip from '../../../../shared/components/tooltip'
import { EditorView } from '@codemirror/view'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import MaterialIcon from '../../../../shared/components/material-icon'

export const ToolbarButtonMenu: FC<{
  id: string
  label: string
  icon: string
  materialIcon?: boolean
  altCommand?: (view: EditorView) => void
}> = memo(function ButtonMenu({
  icon,
  id,
  label,
  materialIcon,
  altCommand,
  children,
}) {
  const target = useRef<any>(null)
  const { open, onToggle, ref } = useDropdown()
  const view = useCodeMirrorViewContext()

  const button = (
    <Button
      type="button"
      className="ol-cm-toolbar-button"
      aria-label={label}
      bsStyle={null}
      onMouseDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={event => {
        if (event.altKey && altCommand && open === false) {
          emitToolbarEvent(view, id)
          event.preventDefault()
          altCommand(view)
          view.focus()
        } else {
          onToggle(!open)
        }
      }}
      ref={target}
    >
      {materialIcon ? <MaterialIcon type={icon} /> : <Icon type={icon} fw />}
    </Button>
  )

  const overlay = (
    <Overlay
      show={open}
      target={target.current}
      placement="bottom"
      container={view.dom}
      containerPadding={0}
      animation
      rootClose
      onHide={() => onToggle(false)}
    >
      <Popover
        id={`${id}-menu`}
        ref={ref}
        className="ol-cm-toolbar-button-menu-popover"
      >
        <ListGroup
          role="menu"
          onClick={() => {
            onToggle(false)
          }}
        >
          {children}
        </ListGroup>
      </Popover>
    </Overlay>
  )

  if (!label) {
    return (
      <>
        {button}
        {overlay}
      </>
    )
  }

  return (
    <>
      <Tooltip
        hidden={open}
        id={id}
        description={<div>{label}</div>}
        overlayProps={{ placement: 'bottom' }}
      >
        {button}
      </Tooltip>
      {overlay}
    </>
  )
})
