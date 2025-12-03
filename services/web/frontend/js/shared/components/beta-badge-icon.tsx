import type { FC } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import OLBadge from '@/shared/components/ol/ol-badge'

const BetaBadgeIcon: FC<{
  phase?: string
}> = ({ phase = 'beta' }) => {
  const badgeClass = chooseBadgeClass(phase)
  if (badgeClass === 'info-badge') {
    return <MaterialIcon type="info" className="align-middle info-badge" />
  } else if (badgeClass === 'alpha-badge') {
    return (
      <OLBadge bg="primary" className="alpha-badge">
        α
      </OLBadge>
    )
  } else if (badgeClass === 'labs-badge') {
    return <MaterialIcon type="science" className="align-middle labs-badge" />
  } else {
    return (
      <OLBadge className="beta-badge" bg="beta">
        β
      </OLBadge>
    )
  }
}

function chooseBadgeClass(phase?: string) {
  switch (phase) {
    case 'labs':
      return 'labs-badge'
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
