import { FC, useRef } from 'react'
import useDropdown from '../../../../../shared/hooks/use-dropdown'
import { Overlay, Popover } from 'react-bootstrap'
import MaterialIcon from '../../../../../shared/components/material-icon'
import Tooltip from '../../../../../shared/components/tooltip'
import { useTabularContext } from '../contexts/tabular-context'

export const ToolbarDropdown: FC<{
  id: string
  label?: string
  btnClassName?: string
  icon?: string
  tooltip?: string
  disabled?: boolean
}> = ({
  id,
  label,
  children,
  btnClassName = 'table-generator-toolbar-dropdown-toggle',
  icon = 'expand_more',
  tooltip,
  disabled,
}) => {
  const { open, onToggle } = useDropdown()
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const { ref: tabularRef } = useTabularContext()

  const button = (
    <button
      ref={toggleButtonRef}
      type="button"
      id={id}
      aria-haspopup="true"
      className={btnClassName}
      onMouseDown={event => event.preventDefault()}
      onClick={() => onToggle(!open)}
      aria-label={tooltip}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {label && <span>{label}</span>}
      <MaterialIcon type={icon} />
    </button>
  )
  const overlay = open && tabularRef.current && (
    <Overlay
      show
      onHide={() => onToggle(false)}
      animation={false}
      container={tabularRef.current}
      containerPadding={0}
      placement="bottom"
      rootClose
      target={toggleButtonRef.current ?? undefined}
    >
      <Popover
        id={`${id}-popover`}
        className="table-generator-toolbar-dropdown-popover"
      >
        <div
          className="table-generator-toolbar-dropdown-menu"
          id={`${id}-menu`}
          role="menu"
          aria-labelledby={id}
        >
          {children}
        </div>
      </Popover>
    </Overlay>
  )

  if (!tooltip) {
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
        id={`${id}-tooltip`}
        description={tooltip}
        overlayProps={{ placement: 'bottom' }}
      >
        {button}
      </Tooltip>
      {overlay}
    </>
  )
}
