import { lazy, Suspense } from 'react'
import { Alerts } from '@/features/ide-react/components/alerts/alerts'
import { MainLayout } from '@/features/ide-react/components/layout/main-layout'
import EditorLeftMenu from '@/features/editor-left-menu/components/editor-left-menu'
import { useLayoutEventTracking } from '@/features/ide-react/hooks/use-layout-event-tracking'
import useSocketListeners from '@/features/ide-react/hooks/use-socket-listeners'
import { useEditingSessionHeartbeat } from '@/features/ide-react/hooks/use-editing-session-heartbeat'
import { useRegisterUserActivity } from '@/features/ide-react/hooks/use-register-user-activity'
import { useHasLintingError } from '@/features/ide-react/hooks/use-has-linting-error'
import { Modals } from '@/features/ide-react/components/modals/modals'
import { GlobalAlertsProvider } from '@/features/ide-react/context/global-alerts-context'
import { GlobalToasts } from '../global-toasts'
import { useFeatureFlag } from '@/shared/context/split-test-context'

const MainLayoutNew = lazy(
  () => import('@/features/ide-redesign/components/main-layout')
)
const SettingsModalNew = lazy(
  () => import('@/features/ide-redesign/components/settings/settings-modal')
)

export default function IdePage() {
  useLayoutEventTracking() // sent event when the layout changes
  useSocketListeners() // listen for project-related websocket messages
  useEditingSessionHeartbeat() // send a batched event when user is active
  useRegisterUserActivity() // record activity and ensure connection when user is active
  useHasLintingError() // pass editor:lint hasLintingError to the compiler

  const newEditor = useFeatureFlag('editor-redesign')

  return (
    <GlobalAlertsProvider>
      <Alerts />
      <Modals />
      {newEditor ? (
        <Suspense fallback={null}>
          <SettingsModalNew />
          <MainLayoutNew />
        </Suspense>
      ) : (
        <>
          <EditorLeftMenu />
          <MainLayout />
        </>
      )}
      <GlobalToasts />
    </GlobalAlertsProvider>
  )
}
