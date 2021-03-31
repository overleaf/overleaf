import React from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'

export default function BetaBadge({ tooltip }) {
  return (
    <OverlayTrigger
      placement="bottom"
      overlay={<Tooltip id={tooltip.id}>{tooltip.text}</Tooltip>}
      delayHide={100}
    >
      <a
        href="/beta/participate"
        target="_blank"
        rel="noopener noreferrer"
        className="badge beta-badge"
      >
        <span className="sr-only">{tooltip.text}</span>
      </a>
    </OverlayTrigger>
  )
}

BetaBadge.propTypes = {
  tooltip: PropTypes.exact({
    id: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired
  })
}
