import { useCallback, useState } from 'react'
import * as eventTracking from '@/infrastructure/event-tracking'
import { postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { useEditorContext } from '@/shared/context/editor-context'

type CompleteTutorialParams = {
  event: string
  action: 'complete' | 'postpone'
} & Record<string, any>

type CompleteTutorialOptions = {
  // Whether to ignore errors if the request fails. Defaults to true. If
  // successfull completion is required, set this to false.
  failSilently?: boolean
}

const useTutorial = (
  tutorialKey: string,
  eventData: Record<string, any> = {}
) => {
  const [showPopup, setShowPopup] = useState(false)

  const { deactivateTutorial, currentPopup, setCurrentPopup } =
    useEditorContext()

  const completeTutorial = useCallback(
    async (
      {
        event = 'promo-click',
        action = 'complete',
        ...rest
      }: CompleteTutorialParams,
      options: CompleteTutorialOptions = {}
    ) => {
      eventTracking.sendMB(event, { ...eventData, ...rest })
      try {
        await postJSON(`/tutorial/${tutorialKey}/${action}`)
      } catch (err) {
        const failSilently = options.failSilently ?? true
        if (!failSilently) {
          throw err
        }
        debugConsole.error(err)
      }
      setShowPopup(false)
      deactivateTutorial(tutorialKey)
    },
    [deactivateTutorial, eventData, tutorialKey]
  )

  const dismissTutorial = useCallback(
    async (eventName: string = 'promo-dismiss') => {
      await completeTutorial({
        event: eventName,
        action: 'complete',
      })
    },
    [completeTutorial]
  )

  const maybeLater = useCallback(async () => {
    await completeTutorial({
      event: 'promo-click',
      action: 'postpone',
      button: 'maybe-later',
    })
  }, [completeTutorial])

  // try to show the popup if we don't already have one showing, returns true if it can show, false if it can't
  const tryShowingPopup = useCallback(
    (eventName: string = 'promo-prompt') => {
      if (currentPopup === null) {
        setCurrentPopup(tutorialKey)
        setShowPopup(true)
        eventTracking.sendMB(eventName, eventData)
        return true
      }
      return false
    },
    [currentPopup, setCurrentPopup, tutorialKey, eventData]
  )

  const clearPopup = useCallback(() => {
    // popups should only clear themselves, in cases they need to cleanup or shouldnt show anymore
    // allow forcing the clear if needed, eg: higher prio alert needs to show
    if (currentPopup === tutorialKey) {
      setCurrentPopup(null)
      setShowPopup(false)
    }
  }, [setCurrentPopup, setShowPopup, currentPopup, tutorialKey])

  const clearAndShow = useCallback(
    (eventName: string = 'promo-prompt') => {
      setCurrentPopup(tutorialKey)
      setShowPopup(true)
      eventTracking.sendMB(eventName, eventData)
    },
    [setCurrentPopup, setShowPopup, tutorialKey, eventData]
  )

  const hideUntilReload = useCallback(() => {
    clearPopup()
    deactivateTutorial(tutorialKey)
  }, [clearPopup, deactivateTutorial, tutorialKey])

  return {
    completeTutorial,
    dismissTutorial,
    maybeLater,
    tryShowingPopup,
    clearPopup,
    clearAndShow,
    showPopup,
    hideUntilReload,
  }
}

export default useTutorial
