import type { FC } from 'react'
import classnames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import OLBadge from '@/features/ui/components/ol/ol-badge'

function BS5BetaBadgeIcon({
  badgeClass,
}: {
  badgeClass: ReturnType<typeof chooseBadgeClass>
}) {
  if (badgeClass === 'info-badge') {
    return <MaterialIcon type="info" className="align-middle info-badge" />
  } else if (badgeClass === 'alpha-badge') {
    return (
      <OLBadge bg="primary" className="alpha-badge">
        α
      </OLBadge>
    )
  } else {
    return (
      <OLBadge bg="warning" className="beta-badge">
        β
      </OLBadge>
    )
  }
}

const BetaBadgeIcon: FC<{
  phase?: string
}> = ({ phase = 'beta' }) => {
  const badgeClass = chooseBadgeClass(phase)
  return (
    <BootstrapVersionSwitcher
      bs3={<span className={classnames('badge', badgeClass)} />}
      bs5={<BS5BetaBadgeIcon badgeClass={badgeClass} />}
    />
  )
}

function chooseBadgeClass(phase?: string) {
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

export default BetaBadgeIcon
