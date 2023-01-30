import React, {
  Children,
  cloneElement,
  type FC,
  isValidElement,
  useCallback,
} from 'react'
import { Dropdown, DropdownProps } from 'react-bootstrap'
import useDropdown from '../hooks/use-dropdown'

type ControlledDropdownProps = DropdownProps & {
  defaultOpen?: boolean
  onMainButtonClick?: (dropdownOpen: boolean) => void
}

const ControlledDropdown: FC<ControlledDropdownProps> = ({
  defaultOpen,
  onMainButtonClick,
  ...props
}) => {
  const { onClick, ...dropdownProps } = useDropdown(Boolean(defaultOpen))

  const handleClick = useCallback(
    (e: React.MouseEvent<Dropdown, MouseEvent>) => {
      onClick(e)

      if (onMainButtonClick) {
        onMainButtonClick(dropdownProps.open)
      }
    },
    [onClick, onMainButtonClick, dropdownProps.open]
  )

  return (
    <Dropdown {...props} {...dropdownProps} onClick={handleClick}>
      {Children.map(props.children, child => {
        if (!isValidElement(child)) {
          return child
        }

        // Dropdown.Menu
        if ('open' in child.props) {
          return cloneElement(child, { open: dropdownProps.open })
        }

        // Overlay
        if ('show' in child.props) {
          return cloneElement(child, { show: dropdownProps.open })
        }

        // anything else
        return cloneElement(child)
      })}
    </Dropdown>
  )
}

export default ControlledDropdown
