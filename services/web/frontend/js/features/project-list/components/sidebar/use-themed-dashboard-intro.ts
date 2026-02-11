import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useTutorialContext } from '@/shared/context/tutorial-context'
import useTutorial from '@/shared/hooks/promotions/use-tutorial'
import { useCallback, useEffect, useRef } from 'react'

const THEMED_DASHBOARD_TUTORIAL_KEY = 'themed-dashboard-intro'

export const useThemedDashboardIntro = () => {
  const themedDsNav = useFeatureFlag('themed-project-dashboard')
  const targetRef = useRef<HTMLDivElement | null>(null)
  const { inactiveTutorials } = useTutorialContext()
  const {
    tryShowingPopup: tryShowingPopupThemedDashboardIntro,
    showPopup: showingThemedDashboardIntro,
    completeTutorial: completeThemedDashboardIntro,
    dismissTutorial,
  } = useTutorial(THEMED_DASHBOARD_TUTORIAL_KEY, {
    name: THEMED_DASHBOARD_TUTORIAL_KEY,
  })
  const dismissThemedDashboardIntro = useCallback(() => {
    dismissTutorial()
  }, [dismissTutorial])
  useEffect(() => {
    if (
      themedDsNav &&
      !inactiveTutorials.includes(THEMED_DASHBOARD_TUTORIAL_KEY)
    ) {
      tryShowingPopupThemedDashboardIntro()
    }
  }, [inactiveTutorials, tryShowingPopupThemedDashboardIntro, themedDsNav])

  return {
    targetRef,
    showingThemedDashboardIntro,
    completeThemedDashboardIntro,
    dismissThemedDashboardIntro,
  }
}
