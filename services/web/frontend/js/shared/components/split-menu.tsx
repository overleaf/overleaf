import { Button, Dropdown, MenuItem } from 'react-bootstrap'
import type {
  ButtonProps,
  MenuItemProps,
  DropdownButtonProps,
  DropdownProps,
} from 'react-bootstrap'
import type { PropsWithChildren } from 'react'
import classNames from 'classnames'
import Tooltip, { type TooltipProps } from './tooltip'
import Icon, { type IconProps } from './icon'
import type { BsSize, BsStyle } from '../../../../types/bootstrap'

type SplitMenuBsStyle = Extract<BsStyle, 'primary' | 'secondary' | 'danger'>

type SplitMenuBsSize = Extract<BsSize, 'md' | 'sm' | 'xs'>

type SplitMenuButtonProps = {
  tooltip?: Omit<TooltipProps, 'children'>
  bsStyle?: SplitMenuBsStyle
  text: string
  icon?: IconProps
} & Pick<ButtonProps, 'aria-label' | 'onClick' | 'className' | 'disabled'>

type SplitMenuDropdownToggleProps = {
  handleAnimationEnd?: () => void
} & Pick<DropdownButtonProps, 'className' | 'aria-label'>

type SplitMenuDropdownProps = Pick<DropdownProps, 'id' | 'className'>

type SplitMenuProps = PropsWithChildren<{
  bsStyle: SplitMenuBsStyle
  bsSize?: SplitMenuBsSize
  button: Omit<SplitMenuButtonProps, 'disabled'>
  dropdown: SplitMenuDropdownProps
  dropdownToggle?: SplitMenuDropdownToggleProps
  disabled?: boolean
}>

function SplitMenu({
  bsStyle,
  bsSize = 'md',
  button,
  dropdown,
  dropdownToggle,
  disabled = false,
  children,
}: SplitMenuProps) {
  const { tooltip, icon, ...buttonProps } = button

  const splitMenuClassName = classNames('split-menu', {
    [`btn-${bsSize}`]: true,
  })

  const dropdownToggleClassName = classNames(
    'split-menu-dropdown-toggle',
    dropdownToggle?.className
  )

  return (
    <div className={splitMenuClassName}>
      <SplitMenuButton
        // eslint-disable-next-line react/jsx-handler-names
        onClick={buttonProps.onClick}
        className={buttonProps.className}
        disabled={disabled}
        tooltip={tooltip}
        bsStyle={bsStyle}
      >
        {icon ? (
          <Icon className="split-menu-icon" type={icon.type} spin={icon.spin} />
        ) : null}
        <span className="split-menu-button">{buttonProps.text}</span>
      </SplitMenuButton>
      <Dropdown
        className={classNames('split-menu-dropdown', dropdown.className)}
        id={dropdown.id}
      >
        <Dropdown.Toggle
          aria-label={dropdownToggle?.['aria-label']}
          className={dropdownToggleClassName}
          bsStyle={bsStyle}
          onAnimationEnd={dropdownToggle?.handleAnimationEnd}
          data-ol-loading={disabled}
        />

        <Dropdown.Menu>{children}</Dropdown.Menu>
      </Dropdown>
    </div>
  )
}

function SplitMenuButton({
  onClick,
  disabled,
  tooltip,
  bsStyle,
  children,
  className,
  ...props
}: PropsWithChildren<Omit<SplitMenuButtonProps, 'text' | 'icon'>>) {
  const buttonClassName = classNames('split-menu-button', className)

  if (tooltip) {
    return (
      <Tooltip
        id={tooltip.id}
        description={tooltip.description}
        tooltipProps={tooltip.tooltipProps}
        overlayProps={tooltip.overlayProps}
      >
        <Button
          className={buttonClassName}
          bsStyle={bsStyle}
          onClick={onClick}
          aria-label={props['aria-label']}
          disabled={disabled}
          data-ol-loading={disabled}
        >
          {children}
        </Button>
      </Tooltip>
    )
  }

  return (
    <Button
      className={buttonClassName}
      bsStyle={bsStyle}
      onClick={onClick}
      aria-label={props['aria-label']}
      disabled={disabled}
      data-ol-loading={disabled}
    >
      {children}
    </Button>
  )
}

function SplitMenuItem(props: MenuItemProps) {
  return <MenuItem {...props} />
}

SplitMenu.Item = SplitMenuItem

export default SplitMenu
