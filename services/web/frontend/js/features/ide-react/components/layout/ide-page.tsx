import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { useEffect, useState } from 'react'
import { Alerts } from '@/features/ide-react/components/alerts/alerts'
import { useLayoutContext } from '@/shared/context/layout-context'
import MainLayout from '@/features/ide-react/components/layout/main-layout'
import { EditorAndSidebar } from '@/features/ide-react/components/editor-and-sidebar'
import EditorLeftMenu from '@/features/editor-left-menu/components/editor-left-menu'
import EditorNavigationToolbar from '@/features/ide-react/components/editor-navigation-toolbar'
import ChatPane from '@/features/chat/components/chat-pane'
import { useLayoutEventTracking } from '@/features/ide-react/hooks/use-layout-event-tracking'
import useSocketListeners from '@/features/ide-react/hooks/use-socket-listeners'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { useOpenFile } from '@/features/ide-react/hooks/use-open-file'
import { useEditingSessionHeartbeat } from '@/features/ide-react/hooks/use-editing-session-heartbeat'
import { useRegisterUserActivity } from '@/features/ide-react/hooks/use-register-user-activity'
import { useHasLintingError } from '@/features/ide-react/hooks/use-has-linting-error'

// This is filled with placeholder content while the real content is migrated
// away from Angular
export default function IdePage() {
  useLayoutEventTracking()
  useSocketListeners()
  useEditingSessionHeartbeat()
  useRegisterUserActivity()
  useHasLintingError()

  // This returns a function to open a binary file but for now we just use the
  // fact that it also patches in ide.binaryFilesManager. Once Angular is gone,
  // we can remove this hook from here and use it in the history file restore
  // component instead.
  useOpenFile()

  const [leftColumnDefaultSize, setLeftColumnDefaultSize] = useState(20)
  const { connectionState } = useConnectionContext()
  const { showLockEditorMessageModal } = useModalsContext()

  // Show modal when editor is forcefully disconnected
  useEffect(() => {
    if (connectionState.forceDisconnected) {
      showLockEditorMessageModal(connectionState.forcedDisconnectDelay)
    }
  }, [
    connectionState.forceDisconnected,
    connectionState.forcedDisconnectDelay,
    showLockEditorMessageModal,
  ])

  const { chatIsOpen } = useLayoutContext()

  const mainContent = (
    <EditorAndSidebar
      leftColumnDefaultSize={leftColumnDefaultSize}
      setLeftColumnDefaultSize={setLeftColumnDefaultSize}
      shouldPersistLayout
    />
  )

  return (
    <>
      <Alerts />
      <EditorLeftMenu />
      <MainLayout
        headerContent={<EditorNavigationToolbar />}
        chatContent={<ChatPane />}
        mainContent={mainContent}
        chatIsOpen={chatIsOpen}
        shouldPersistLayout
      />
    </>
  )
}
