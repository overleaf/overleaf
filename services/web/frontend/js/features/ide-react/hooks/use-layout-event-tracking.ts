import { useLayoutContext } from '@/shared/context/layout-context'
import { useEffect } from 'react'
import { sendMBOnce } from '@/infrastructure/event-tracking'

export function useLayoutEventTracking() {
  const { view, settingsShown, chatIsOpen } = useLayoutContext()

  useEffect(() => {
    if (view && view !== 'editor' && view !== 'pdf') {
      sendMBOnce(`ide-open-view-${view}-once`)
    }
  }, [view])

  useEffect(() => {
    if (settingsShown) {
      sendMBOnce(`ide-open-left-menu-once`)
    }
  }, [settingsShown])

  useEffect(() => {
    if (chatIsOpen) {
      sendMBOnce(`ide-open-chat-once`)
    }
  }, [chatIsOpen])
}
