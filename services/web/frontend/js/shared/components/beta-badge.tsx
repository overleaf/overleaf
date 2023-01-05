import type { FC, ReactNode } from 'react'
import classnames from 'classnames'
import Tooltip from './tooltip'
import { OverlayTriggerProps } from 'react-bootstrap'

type TooltipProps = {
  id: string
  text: ReactNode
  placement?: OverlayTriggerProps['placement']
  className?: string
}

const BetaBadge: FC<{
  tooltip: TooltipProps
  url?: string
  phase?: string
}> = ({ tooltip, url = '/beta/participate', phase = 'beta' }) => {
  let badgeClass
  switch (phase) {
    case 'release':
      badgeClass = 'info-badge'
      break
    case 'alpha':
      badgeClass = 'alpha-badge'
      break
    case 'beta':
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
        className={classnames('badge', badgeClass)}
      >
        <span className="sr-only">{tooltip.text}</span>
      </a>
    </Tooltip>
  )
}

export default BetaBadge
