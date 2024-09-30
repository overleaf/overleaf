import type { FC, ReactNode } from 'react'
import classnames from 'classnames'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type TooltipProps = {
  id: string
  text: ReactNode
  className?: string
  placement?: NonNullable<
    React.ComponentProps<typeof OLTooltip>['overlayProps']
  >['placement']
}

const BetaBadge: FC<{
  tooltip: TooltipProps
  url?: string
  phase?: string
}> = ({ tooltip, url = '/beta/participate', phase = 'beta' }) => {
  let badgeClass: 'info-badge' | 'alpha-badge' | 'beta-badge'
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
    <OLTooltip
      id={tooltip.id}
      description={tooltip.text}
      tooltipProps={{ className: tooltip.className }}
      overlayProps={{
        placement: tooltip.placement || 'bottom',
        delay: 100,
      }}
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        <span className="sr-only">{tooltip.text}</span>
        <BootstrapVersionSwitcher
          bs3={<span className={classnames('badge', badgeClass)} />}
          bs5={
            <MaterialIcon
              type="info"
              className={classnames('align-middle', badgeClass)}
            />
          }
        />
      </a>
    </OLTooltip>
  )
}

export default BetaBadge
