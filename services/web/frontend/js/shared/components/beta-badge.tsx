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
  const badgeClass = chooseBadgeClass(phase)
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

export const chooseBadgeClass = (phase?: string) => {
  switch (phase) {
    case 'release':
      return 'info-badge'
    case 'alpha':
      return 'alpha-badge'
    case 'beta':
    default:
      return 'beta-badge'
  }
}

export default BetaBadge
