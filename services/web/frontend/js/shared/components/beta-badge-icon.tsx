import type { FC } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import OLBadge from '@/features/ui/components/ol/ol-badge'

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
  } else {
    return <OLBadge bg="warning">β</OLBadge>
  }
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
