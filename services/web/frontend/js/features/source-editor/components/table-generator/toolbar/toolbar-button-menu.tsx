import { FC, memo, useRef } from 'react'
import useDropdown from '../../../../../shared/hooks/use-dropdown'
import { ListGroup, Overlay, Popover } from 'react-bootstrap'
import Tooltip from '../../../../../shared/components/tooltip'
import MaterialIcon from '../../../../../shared/components/material-icon'
import { useTabularContext } from '../contexts/tabular-context'

export const ToolbarButtonMenu: FC<{
  id: string
  label: string
  icon: string
  disabled?: boolean
  disabledLabel?: string
}> = memo(function ButtonMenu({
  icon,
  id,
  label,
  children,
  disabled,
  disabledLabel,
}) {
  const target = useRef<any>(null)
  const { open, onToggle, ref } = useDropdown()
  const { ref: tableContainerRef } = useTabularContext()

  const button = (
    <button
      type="button"
      className="table-generator-toolbar-button table-generator-toolbar-button-menu"
      aria-label={label}
      onMouseDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={event => {
        onToggle(!open)
      }}
      disabled={disabled}
      aria-disabled={disabled}
      ref={target}
    >
      <MaterialIcon type={icon} />
      <MaterialIcon type="expand_more" />
    </button>
  )

  const overlay = tableContainerRef.current && (
    <Overlay
      show={open}
      target={target.current}
      placement="bottom"
      container={tableContainerRef.current}
      containerPadding={0}
      animation
      rootClose
      onHide={() => onToggle(false)}
    >
      <Popover
        id={`${id}-menu`}
        ref={ref}
        className="table-generator-button-menu-popover"
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

  return (
    <>
      <Tooltip
        hidden={open}
        id={id}
        description={
          <div>{disabled && disabledLabel ? disabledLabel : label}</div>
        }
        overlayProps={{ placement: 'bottom' }}
      >
        {button}
      </Tooltip>
      {overlay}
    </>
  )
})
