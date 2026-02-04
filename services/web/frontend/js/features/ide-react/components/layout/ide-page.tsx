import { Alerts } from '@/features/ide-react/components/alerts/alerts'
import { useLayoutEventTracking } from '@/features/ide-react/hooks/use-layout-event-tracking'
import useSocketListeners from '@/features/ide-react/hooks/use-socket-listeners'
import { useEditingSessionHeartbeat } from '@/features/ide-react/hooks/use-editing-session-heartbeat'
import { useRegisterUserActivity } from '@/features/ide-react/hooks/use-register-user-activity'
import { useHasLintingError } from '@/features/ide-react/hooks/use-has-linting-error'
import { Modals } from '@/features/ide-react/components/modals/modals'
import { GlobalAlertsProvider } from '@/features/ide-react/context/global-alerts-context'
import { GlobalToasts } from '../global-toasts'
import EditorSurvey from '../editor-survey'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useStatusFavicon } from '@/features/ide-react/hooks/use-status-favicon'
import useThemedPage from '@/shared/hooks/use-themed-page'

import MainLayout from '@/features/ide-react/components/layout/main-layout'
import SettingsModalNew from '@/features/ide-redesign/components/settings/settings-modal'

export default function IdePage() {
  useLayoutEventTracking() // sent event when the layout changes
  useSocketListeners() // listen for project-related websocket messages
  useEditingSessionHeartbeat() // send a batched event when user is active
  useRegisterUserActivity() // record activity and ensure connection when user is active
  useHasLintingError() // pass editor:lint hasLintingError to the compiler
  useStatusFavicon() // update the favicon based on the compile status
  useThemedPage() // set the page theme based on user settings

  const editorSurveyFlag = useFeatureFlag('editor-popup-ux-survey')
  const showEditorSurvey = editorSurveyFlag

  return (
    <GlobalAlertsProvider>
      <Alerts />
      <Modals />
      <SettingsModalNew />
      <MainLayout />
      <GlobalToasts />
      {showEditorSurvey && <EditorSurvey />}
    </GlobalAlertsProvider>
  )
}
