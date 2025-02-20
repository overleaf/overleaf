import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'
import getMeta from '@/utils/meta'
import * as eventTracking from '@/infrastructure/event-tracking'
import TimeoutMessageAfterPaywallDismissal from './timeout-message-after-paywall-dismissal'
import { UpgradePrompt } from '@/shared/components/upgrade-prompt'

const studentRoles = [
  'High-school student',
  'Undergraduate student',
  "Master's student (e.g. MSc, MA)",
  'Doctoral student (e.g. PhD, MD, EngD)',
]

type Segmentation = Record<
  string,
  string | number | boolean | undefined | unknown | any
>

interface TimeoutUpgradePaywallPromptProps {
  setIsShowingPrimary: Dispatch<SetStateAction<boolean>>
}

function TimeoutUpgradePaywallPrompt({
  setIsShowingPrimary,
}: TimeoutUpgradePaywallPromptProps) {
  const odcRole = getMeta('ol-odcRole')
  const planPrices = getMeta('ol-paywallPlans')
  const isStudent = useMemo(() => studentRoles.includes(odcRole), [odcRole])

  const [isPaywallDismissed, setIsPaywallDismissed] = useState<boolean>(false)

  function sendPaywallEvent(event: string, segmentation?: Segmentation) {
    eventTracking.sendMB(event, {
      'paywall-type': 'compile-timeout',
      'paywall-version': 'primary',
      ...segmentation,
    })
  }

  function onClose() {
    sendPaywallEvent('paywall-dismiss')
    setIsPaywallDismissed(true)
    setIsShowingPrimary(false)
  }

  function onClickInfoLink() {
    sendPaywallEvent('paywall-info-click', { content: 'plans' })
  }

  function onClickPaywall() {
    sendPaywallEvent('paywall-click', {
      plan: isStudent ? 'student' : 'collaborator',
    })
  }

  useEffect(() => {
    sendPaywallEvent('paywall-prompt', {
      plan: isStudent ? 'student' : 'collaborator',
    })
    setIsShowingPrimary(true)
  }, [isStudent, setIsShowingPrimary])

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
          itmCampaign="compile-timeout"
          isStudent={isStudent}
          onClickInfoLink={onClickInfoLink}
          onClickPaywall={onClickPaywall}
        />
      ) : (
        <TimeoutMessageAfterPaywallDismissal />
      )}
    </div>
  )
}

export default TimeoutUpgradePaywallPrompt
