import { useEffect } from 'react'
import { useSettingsModalContext } from '../context/settings-modal-context'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

export default function useOpenSettingsViaQueryParam() {
  const { setShow, setActiveTab } = useSettingsModalContext()

  useEffect(() => {
    const inNotificationsSplitTest = isSplitTestEnabled('email-notifications')
    if (!inNotificationsSplitTest) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('open') !== 'project-notifications') {
      return
    }

    setShow(true)
    setActiveTab('project_notifications')

    const url = new URL(window.location.href)
    url.searchParams.delete('open')
    window.history.replaceState(window.history.state, '', url.toString())
  }, [setShow, setActiveTab])
}
