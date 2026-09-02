import { useEffect } from 'react'
import { useSettingsModalContext } from '../context/settings-modal-context'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { useDeepLinkContext } from '@/features/ide-react/context/deep-link-context'

export default function useOpenSettingsViaQueryParam() {
  const { setShow, setActiveTab } = useSettingsModalContext()
  const { deepLinkedSettings } = useDeepLinkContext()

  useEffect(() => {
    const inNotificationsSplitTest = isSplitTestEnabled('email-notifications')
    if (!inNotificationsSplitTest) {
      return
    }

    if (deepLinkedSettings !== 'project-notifications') {
      return
    }

    setShow(true)
    setActiveTab('project_notifications')
  }, [deepLinkedSettings, setShow, setActiveTab])
}
