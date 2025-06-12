import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import getMeta from '@/utils/meta'
import * as eventTracking from '@/infrastructure/event-tracking'
import TimeoutMessageAfterPaywallDismissal from './timeout-message-after-paywall-dismissal'
import { UpgradePrompt } from '@/shared/components/upgrade-prompt'
import { useDetachCompileContext } from '@/shared/context/detach-compile-context'

const studentRoles = [
  'High-school student',
  'Undergraduate student',
  "Master's student (e.g. MSc, MA)",
  'Doctoral student (e.g. PhD, MD, EngD)',
]

interface TimeoutUpgradePaywallPromptProps {
  setIsShowingPrimary?: Dispatch<SetStateAction<boolean>>
}

function TimeoutUpgradePaywallPrompt({
  setIsShowingPrimary,
}: TimeoutUpgradePaywallPromptProps) {
  const odcRole = getMeta('ol-odcRole')
  const planPrices = getMeta('ol-paywallPlans')
  const isStudent = useMemo(() => studentRoles.includes(odcRole), [odcRole])
  const { isProjectOwner } = useDetachCompileContext()

  const [isPaywallDismissed, setIsPaywallDismissed] = useState<boolean>(false)
  const { reducedTimeoutWarning, compileTimeout } =
    getMeta('ol-compileSettings')

  const sharedSegmentation = useMemo(
    () => ({
      '10s-timeout-warning': reducedTimeoutWarning,
      'is-owner': isProjectOwner,
      compileTime: compileTimeout,
    }),
    [isProjectOwner, reducedTimeoutWarning, compileTimeout]
  )

  const sendPaywallEvent = useCallback(
    (event: string, segmentation?: eventTracking.Segmentation) => {
      eventTracking.sendMB(event, {
        'paywall-type': 'compile-timeout',
        'paywall-version': 'primary',
        ...sharedSegmentation,
        ...segmentation,
      })
    },
    [sharedSegmentation]
  )

  function onClose() {
    sendPaywallEvent('paywall-dismiss')
    setIsPaywallDismissed(true)
    if (setIsShowingPrimary) {
      setIsShowingPrimary(false)
    }
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
    if (setIsShowingPrimary) {
      setIsShowingPrimary(true)
    }
  }, [isStudent, setIsShowingPrimary, sendPaywallEvent])

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
        <TimeoutMessageAfterPaywallDismissal
          segmentation={sharedSegmentation}
        />
      )}
    </div>
  )
}

export default TimeoutUpgradePaywallPrompt
