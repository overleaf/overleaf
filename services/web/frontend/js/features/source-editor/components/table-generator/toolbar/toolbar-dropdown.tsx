import { ButtonHTMLAttributes, FC, useCallback, useRef } from 'react'
import useDropdown from '../../../../../shared/hooks/use-dropdown'
import { Overlay, Popover } from 'react-bootstrap'
import MaterialIcon from '../../../../../shared/components/material-icon'
import Tooltip from '../../../../../shared/components/tooltip'
import { useTabularContext } from '../contexts/tabular-context'
import { emitTableGeneratorEvent } from '../analytics'
import { useCodeMirrorViewContext } from '../../codemirror-context'
import classNames from 'classnames'

export const ToolbarDropdown: FC<{
  id: string
  label?: string
  btnClassName?: string
  icon?: string
  tooltip?: string
  disabled?: boolean
  disabledTooltip?: string
  showCaret?: boolean
}> = ({
  id,
  label,
  children,
  btnClassName = 'table-generator-toolbar-dropdown-toggle',
  icon = 'expand_more',
  tooltip,
  disabled,
  disabledTooltip,
  showCaret,
}) => {
  const { open, onToggle, ref } = useDropdown()
  const toggleButtonRef = useRef<HTMLButtonElement | null>(null)
  const { ref: tabularRef } = useTabularContext()
  const button = (
    <button
      ref={toggleButtonRef}
      type="button"
      id={id}
      aria-haspopup="true"
      className={btnClassName}
      onMouseDown={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={() => {
        onToggle(!open)
      }}
      aria-label={tooltip}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {label && <span>{label}</span>}
      <MaterialIcon type={icon} />
      {showCaret && <MaterialIcon type="expand_more" />}
    </button>
  )
  const overlay = tabularRef.current && (
    <Overlay
      show={open}
      target={toggleButtonRef.current ?? undefined}
      placement="bottom"
      container={tabularRef.current}
      animation
      rootClose
      containerPadding={0}
      onHide={() => onToggle(false)}
    >
      <Popover
        id={`${id}-popover`}
        ref={ref}
        className="table-generator-toolbar-dropdown-popover"
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions,
                                     jsx-a11y/click-events-have-key-events */}
        <div
          className="table-generator-toolbar-dropdown-menu"
          id={`${id}-menu`}
          aria-labelledby={id}
          onClick={() => {
            onToggle(false)
          }}
        >
          {children}
        </div>
      </Popover>
    </Overlay>
  )

  if (tooltip || (disabled && disabledTooltip)) {
    return (
      <>
        <Tooltip
          hidden={open}
          id={id}
          description={disabled && disabledTooltip ? disabledTooltip : tooltip}
          overlayProps={{ placement: 'bottom' }}
        >
          {button}
        </Tooltip>
        {overlay}
      </>
    )
  }

  return (
    <>
      {button}
      {overlay}
    </>
  )
}

export const ToolbarDropdownItem: FC<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
    command: () => void
    id: string
    icon?: string
    active?: boolean
  }
> = ({ children, command, id, icon, active, ...props }) => {
  const view = useCodeMirrorViewContext()
  const onClick = useCallback(() => {
    emitTableGeneratorEvent(view, id)
    command()
  }, [view, command, id])
  return (
    <button
      className={classNames('ol-cm-toolbar-menu-item', {
        'ol-cm-toolbar-dropdown-option-active': active,
      })}
      role="menuitem"
      type="button"
      {...props}
      onClick={onClick}
    >
      {icon && <MaterialIcon type={icon} />}
      <span className="ol-cm-toolbar-dropdown-option-content">{children}</span>
      {active && <MaterialIcon type="check" />}
    </button>
  )
}
