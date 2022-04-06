import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import PropTypes from 'prop-types'

export default function BetaBadge({ tooltip, url = '/beta/participate' }) {
  return (
    <OverlayTrigger
      placement={tooltip.placement || 'bottom'}
      overlay={
        <Tooltip id={tooltip.id} className={tooltip.className}>
          {tooltip.text}
        </Tooltip>
      }
      delayHide={100}
    >
      <a
        href={url}
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
  tooltip: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
    placement: PropTypes.string,
    className: PropTypes.string,
  }),
  url: PropTypes.string,
}
