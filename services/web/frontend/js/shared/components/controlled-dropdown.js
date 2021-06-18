import React, { useCallback, useState } from 'react'
import { Dropdown } from 'react-bootstrap'
import PropTypes from 'prop-types'

export default function ControlledDropdown(props) {
  const [open, setOpen] = useState(Boolean(props.defaultOpen))

  const handleClick = useCallback(event => {
    event.stopPropagation()
  }, [])

  const handleToggle = useCallback(value => {
    setOpen(value)
  }, [])

  return (
    <Dropdown
      {...props}
      open={open}
      onToggle={handleToggle}
      onClick={handleClick}
    >
      {React.Children.map(props.children, child => {
        if (!React.isValidElement(child)) {
          return child
        }

        // Dropdown.Menu
        if ('open' in child.props) {
          return React.cloneElement(child, { open })
        }

        // Overlay
        if ('show' in child.props) {
          return React.cloneElement(child, { show: open })
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
