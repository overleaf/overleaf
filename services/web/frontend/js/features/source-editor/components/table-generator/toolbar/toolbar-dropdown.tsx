import { ButtonHTMLAttributes, FC, useCallback, useRef } from 'react'
import useDropdown from '../../../../../shared/hooks/use-dropdown'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLOverlay from '@/shared/components/ol/ol-overlay'
import OLPopover from '@/shared/components/ol/ol-popover'
import MaterialIcon from '../../../../../shared/components/material-icon'
import { useTabularContext } from '../contexts/tabular-context'
import { emitTableGeneratorEvent } from '../analytics'
import { useCodeMirrorViewContext } from '../../codemirror-context'
import classNames from 'classnames'

export const ToolbarDropdown: FC<
  React.PropsWithChildren<{
    id: string
    label?: string
    btnClassName?: string
    icon?: string
    tooltip?: string
    disabled?: boolean
    disabledTooltip?: string
    showCaret?: boolean
  }>
> = ({
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
    <OLOverlay
      show={open}
      target={toggleButtonRef.current}
      placement="bottom"
      container={tabularRef.current}
      transition
      rootClose
      containerPadding={0}
      onHide={() => onToggle(false)}
    >
      <OLPopover
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
      </OLPopover>
    </OLOverlay>
  )

  if (tooltip || (disabled && disabledTooltip)) {
    return (
      <>
        <OLTooltip
          hidden={open}
          id={id}
          description={disabled && disabledTooltip ? disabledTooltip : tooltip}
          overlayProps={{ placement: 'bottom' }}
        >
          {button}
        </OLTooltip>
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
  React.PropsWithChildren<
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
      command: () => void
      id: string
      icon?: string
      active?: boolean
    }
  >
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
