import { useCallback, useMemo, useState } from 'react'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'

const AI_CONSENT_TUTORIAL_KEY = 'workbench-consent-release'
const eventData = { name: AI_CONSENT_TUTORIAL_KEY }

export { AI_CONSENT_TUTORIAL_KEY }

export default function useAiConsent() {
  const { completeTutorial, checkCompletion } = useTutorial(
    AI_CONSENT_TUTORIAL_KEY,
    eventData
  )

  const hasGivenAiConsent = useMemo(() => checkCompletion(), [checkCompletion])
  const [consentError, setConsentError] = useState(false)

  const giveAiConsent = useCallback(async () => {
    setConsentError(false)
    try {
      await completeTutorial(
        { event: 'promo-click', action: 'complete' },
        { failSilently: false }
      )
      return true
    } catch {
      setConsentError(true)
      return false
    }
  }, [completeTutorial])

  return { hasGivenAiConsent, giveAiConsent, consentError }
}
