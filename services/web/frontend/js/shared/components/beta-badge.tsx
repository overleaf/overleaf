import type { FC, MouseEventHandler, ReactNode } from 'react'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { bsVersion } from '@/features/utils/bootstrap-5'
import BetaBadgeIcon from '@/shared/components/beta-badge-icon'

type TooltipProps = {
  id: string
  text: ReactNode
  className?: string
  placement?: NonNullable<
    React.ComponentProps<typeof OLTooltip>['overlayProps']
  >['placement']
}

type LinkProps = {
  href?: string
  ref?: React.Ref<HTMLAnchorElement>
  className?: string
  onMouseDown?: MouseEventHandler<HTMLAnchorElement>
}

const defaultHref = '/beta/participate'

const BetaBadge: FC<{
  tooltip?: TooltipProps
  link?: LinkProps
  description?: ReactNode
  phase?: string
}> = ({
  tooltip,
  link = { href: defaultHref },
  description,
  phase = 'beta',
}) => {
  const { href, ...linkProps } = link
  const linkedBadge = (
    <a
      target="_blank"
      rel="noopener noreferrer"
      href={href || defaultHref}
      {...linkProps}
    >
      <span className={bsVersion({ bs5: 'visually-hidden', bs3: 'sr-only' })}>
        {description || tooltip?.text}
      </span>
      <BetaBadgeIcon phase={phase} />
    </a>
  )

  return tooltip ? (
    <OLTooltip
      id={tooltip.id}
      description={tooltip.text}
      tooltipProps={{ className: tooltip.className }}
      overlayProps={{
        placement: tooltip.placement || 'bottom',
        delay: 100,
      }}
    >
      {linkedBadge}
    </OLTooltip>
  ) : (
    linkedBadge
  )
}

export default BetaBadge
