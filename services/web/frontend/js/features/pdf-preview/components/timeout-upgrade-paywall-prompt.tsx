import getMeta from '@/utils/meta'
import { useMemo } from 'react'
import TimeoutMessageAfterPaywallDismissal from './timeout-message-after-paywall-dismissal'

const studentRoles = [
  'High-school student',
  'Undergraduate student',
  "Master's student (e.g. MSc, MA)",
  'Doctoral student (e.g. PhD, MD, EngD)',
]

// We can display TimeoutMessageAfterPaywallDismissal after the user has dismissed the paywall. That logic can be implemented in this file or somewhere else?
function TimeoutUpgradePaywallPrompt() {
  const odcRole = getMeta('ol-odcRole')
  const isStudent = useMemo(() => studentRoles.includes(odcRole), [odcRole])

  return (
    <div>
      <p>Current user is {!isStudent && 'not'} a student.</p>
      <TimeoutMessageAfterPaywallDismissal />
    </div>
  )
}

export default TimeoutUpgradePaywallPrompt
