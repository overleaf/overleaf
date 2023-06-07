import { FC, memo, useRef } from 'react'
import { Button, ListGroup, Overlay, Popover } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import useDropdown from '../../../../shared/hooks/use-dropdown'
import Tooltip from '../../../../shared/components/tooltip'
import { EditorView } from '@codemirror/view'
import { emitCommandEvent } from '../../extensions/toolbar/utils/analytics'
import { useCodeMirrorViewContext } from '../codemirror-editor'

export const ToolbarButtonMenu: FC<{
  id: string
  label: string
  icon: string
  altCommand?: (view: EditorView) => void
}> = memo(function ButtonMenu({ icon, id, label, altCommand, children }) {
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
          emitCommandEvent(view, id)
          event.preventDefault()
          altCommand(view)
          view.focus()
        } else {
          onToggle(!open)
        }
      }}
      ref={target}
    >
      <Icon type={icon} fw />
    </Button>
  )

  const overlay = (
    <Overlay
      show={open}
      target={target.current}
      placement="bottom"
      container={document.querySelector('.cm-editor')}
      containerPadding={0}
      animation
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
