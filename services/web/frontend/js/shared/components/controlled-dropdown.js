import React from 'react'
import { Dropdown } from 'react-bootstrap'
import PropTypes from 'prop-types'
import useDropdown from '../hooks/use-dropdown'

export default function ControlledDropdown(props) {
  const dropdownProps = useDropdown(Boolean(props.defaultOpen))

  return (
    <Dropdown {...props} {...dropdownProps}>
      {React.Children.map(props.children, child => {
        if (!React.isValidElement(child)) {
          return child
        }

        // Dropdown.Menu
        if ('open' in child.props) {
          return React.cloneElement(child, { open: dropdownProps.open })
        }

        // Overlay
        if ('show' in child.props) {
          return React.cloneElement(child, { show: dropdownProps.open })
        }

        // anything else
        return React.cloneElement(child)
      })}
    </Dropdown>
  )
}
ControlledDropdown.propTypes = {
  children: PropTypes.any,
  defaultOpen: PropTypes.bool,
}
