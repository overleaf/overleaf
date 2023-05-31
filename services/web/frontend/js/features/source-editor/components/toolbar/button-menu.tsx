import { FC, memo, useRef } from 'react'
import { Button, ListGroup, Overlay, Popover } from 'react-bootstrap'
import Icon from '../../../../shared/components/icon'
import useDropdown from '../../../../shared/hooks/use-dropdown'
import Tooltip from '../../../../shared/components/tooltip'

export const ToolbarButtonMenu: FC<{
  id: string
  label: string
  icon: string
}> = memo(function ButtonMenu({ icon, id, label, children }) {
  const target = useRef<any>(null)
  const { open, onToggle, ref } = useDropdown()
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
      onClick={() => {
        onToggle(!open)
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
