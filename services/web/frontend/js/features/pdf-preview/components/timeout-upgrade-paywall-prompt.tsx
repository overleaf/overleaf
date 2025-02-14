import getMeta from '@/utils/meta'
import { useMemo, useState } from 'react'
import TimeoutMessageAfterPaywallDismissal from './timeout-message-after-paywall-dismissal'
import { UpgradePrompt } from '@/shared/components/upgrade-prompt'

const studentRoles = [
  'High-school student',
  'Undergraduate student',
  "Master's student (e.g. MSc, MA)",
  'Doctoral student (e.g. PhD, MD, EngD)',
]

function TimeoutUpgradePaywallPrompt() {
  const odcRole = getMeta('ol-odcRole')
  const planPrices = getMeta('ol-paywallPlans')
  const isStudent = useMemo(() => studentRoles.includes(odcRole), [odcRole])

  const [isPaywallDismissed, setIsPaywallDismissed] = useState<boolean>(false)

  function onClose() {
    setIsPaywallDismissed(true)
  }

  return (
    <div>
      {!isPaywallDismissed ? (
        <UpgradePrompt
          title="Unlock more compile time"
          summary="Your project took too long to compile and timed out."
          onClose={onClose}
          planPricing={{
            student: planPrices?.student,
            standard: planPrices?.collaborator,
          }}
          itmCampaign="storybook"
          isStudent={isStudent}
        />
      ) : (
        <TimeoutMessageAfterPaywallDismissal />
      )}
    </div>
  )
}

export default TimeoutUpgradePaywallPrompt
