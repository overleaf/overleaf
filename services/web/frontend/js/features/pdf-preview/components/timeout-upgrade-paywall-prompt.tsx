import getMeta from '@/utils/meta'
import {
  studentRoles,
  StudentRole,
} from '../../../../../modules/onboarding/frontend/js/components/data/roles'
import { useMemo } from 'react'

function TimeoutUpgradePaywallPrompt() {
  const odcRole = getMeta('ol-odcRole')
  const isStudent = useMemo(
    () => studentRoles.includes(odcRole as StudentRole),
    [odcRole]
  )

  return (
    <div>
      <p>Hello world from new paywall component</p>
      <p>Current user is {!isStudent && 'not'} a student.</p>
    </div>
  )
}

export default TimeoutUpgradePaywallPrompt
