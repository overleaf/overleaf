import React from 'react'
import PropTypes from 'prop-types'
import { Button, Tooltip, OverlayTrigger } from 'react-bootstrap'

function TooltipButton({ id, description, onClick, children }) {
  const tooltip = <Tooltip id={`${id}_tooltip`}>{description}</Tooltip>

  return (
    <OverlayTrigger placement="bottom" overlay={tooltip}>
      <Button onClick={onClick}>{children}</Button>
    </OverlayTrigger>
  )
}

TooltipButton.propTypes = {
  id: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
}

export default TooltipButton
