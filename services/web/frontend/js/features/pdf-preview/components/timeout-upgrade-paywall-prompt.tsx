import getMeta from '@/utils/meta'
import { useMemo } from 'react'

const studentRoles = [
  'High-school student',
  'Undergraduate student',
  "Master's student (e.g. MSc, MA)",
  'Doctoral student (e.g. PhD, MD, EngD)',
]

function TimeoutUpgradePaywallPrompt() {
  const odcRole = getMeta('ol-odcRole')
  const isStudent = useMemo(() => studentRoles.includes(odcRole), [odcRole])

  return (
    <div>
      <p>Hello world from new paywall component</p>
      <p>Current user is {!isStudent && 'not'} a student.</p>
    </div>
  )
}

export default TimeoutUpgradePaywallPrompt
