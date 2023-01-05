import { Children, cloneElement, type FC, isValidElement } from 'react'
import { Dropdown, DropdownProps } from 'react-bootstrap'
import useDropdown from '../hooks/use-dropdown'

const ControlledDropdown: FC<
  DropdownProps & { defaultOpen?: boolean }
> = props => {
  const dropdownProps = useDropdown(Boolean(props.defaultOpen))

  return (
    <Dropdown {...props} {...dropdownProps}>
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
