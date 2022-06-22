import Tooltip from './tooltip'
import { OverlayTriggerProps } from 'react-bootstrap'

type TooltipProps = {
  id: string
  text: React.ReactNode
  placement?: OverlayTriggerProps['placement']
  className?: string
}

type BetaBadgeProps = {
  tooltip: TooltipProps
  url?: string
  phase?: string
}

function BetaBadge({
  tooltip,
  url = '/beta/participate',
  phase = 'beta',
}: BetaBadgeProps) {
  let badgeClass
  switch (phase) {
    case 'release':
      badgeClass = 'info-badge'
      break
    default:
      badgeClass = 'beta-badge'
  }

  return (
    <Tooltip
      id={tooltip.id}
      description={tooltip.text}
      tooltipProps={{ className: tooltip.className }}
      overlayProps={{
        placement: tooltip.placement || 'bottom',
        delayHide: 100,
      }}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`badge ${badgeClass}`}
      >
        <span className="sr-only">{tooltip.text}</span>
      </a>
    </Tooltip>
  )
}

export default BetaBadge
