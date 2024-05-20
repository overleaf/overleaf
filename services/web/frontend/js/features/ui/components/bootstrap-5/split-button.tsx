import classNames from 'classnames'
import Button from './button'
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from './dropdown-menu'
import MaterialIcon from '@/shared/components/material-icon'
import type { SplitButtonProps } from '@/features/ui/components/types/split-button-props'

export function SplitButton({
  accessibilityLabel,
  align,
  id,
  items,
  text,
  variant,
  ...props
}: SplitButtonProps) {
  const buttonClassName = classNames('split-button')

  return (
    <div>
      <Dropdown align={align}>
        <Button className={buttonClassName} variant={variant} {...props}>
          <span className="split-button-content">{text}</span>
        </Button>
        <DropdownToggle
          bsPrefix="dropdown-button-toggle"
          id={id}
          variant={variant}
          {...props}
        >
          <MaterialIcon
            className="split-button-caret"
            type="expand_more"
            accessibilityLabel={accessibilityLabel}
          />
        </DropdownToggle>
        <DropdownMenu>
          {items.map((item, index) => (
            <li key={index}>
              <DropdownItem eventKey={item.eventKey}>{item.label}</DropdownItem>
            </li>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  )
}
