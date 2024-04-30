import { useCallback, useState } from 'react'
import * as eventTracking from '@/infrastructure/event-tracking'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { useEditorContext } from '@/shared/context/editor-context'

export const useTutorial = (
  tutorialKey: string,
  eventData: Record<string, any> = {}
) => {
  const [showPopup, setShowPopup] = useState(false)

  const { deactivateTutorial, currentPopup, setCurrentPopup } =
    useEditorContext()

  const completeTutorial = useCallback(
    async ({
      event = 'promo-click',
      action = 'complete',
      ...rest
    }: {
      event: 'promo-click' | 'promo-dismiss'
      action: 'complete' | 'postpone'
    } & Record<string, any>) => {
      eventTracking.sendMB(event, { ...eventData, ...rest })
      try {
        await postJSON(`/tutorial/${tutorialKey}/${action}`)
      } catch (err) {
        debugConsole.error(err)
      }
      setShowPopup(false)
      deactivateTutorial(tutorialKey)
    },
    [deactivateTutorial, eventData, tutorialKey]
  )

  const dismissTutorial = useCallback(async () => {
    await completeTutorial({
      event: 'promo-dismiss',
      action: 'complete',
    })
  }, [completeTutorial])

  const maybeLater = useCallback(async () => {
    await completeTutorial({
      event: 'promo-click',
      action: 'postpone',
      button: 'maybe-later',
    })
  }, [completeTutorial])

  // try to show the popup if we don't already have one showing, returns true if it can show, false if it can't
  const tryShowingPopup = useCallback(() => {
    if (currentPopup === null) {
      setCurrentPopup(tutorialKey)
      setShowPopup(true)
      eventTracking.sendMB('promo-prompt', eventData)
      return true
    }
    return false
  }, [currentPopup, setCurrentPopup, tutorialKey, eventData])

  const clearPopup = useCallback(
    (force: boolean = false) => {
      // popups should only clear themselves, in cases they need to cleanup or shouldnt show anymore
      // allow forcing the clear if needed, eg: higher prio alert needs to show
      if (force || currentPopup === tutorialKey) {
        setCurrentPopup(null)
        setShowPopup(false)
      }
    },
    [setCurrentPopup, setShowPopup, currentPopup, tutorialKey]
  )

  return {
    completeTutorial,
    dismissTutorial,
    maybeLater,
    tryShowingPopup,
    clearPopup,
    showPopup,
  }
}

export default useTutorial
