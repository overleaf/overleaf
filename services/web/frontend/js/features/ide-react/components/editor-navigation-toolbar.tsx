import { useState, useCallback } from 'react'
import { useOnlineUsersContext } from '@/features/ide-react/context/online-users-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import * as eventTracking from '@/infrastructure/event-tracking'
import EditorNavigationToolbarRoot from '@/features/editor-navigation-toolbar/components/editor-navigation-toolbar-root'
import ShareProjectModal from '@/features/share-project-modal/components/share-project-modal'
import EditorOverLimitModal from '@/features/share-project-modal/components/editor-over-limit-modal'
import ViewOnlyAccessModal from '@/features/share-project-modal/components/view-only-access-modal'

function EditorNavigationToolbar() {
  const [showShareModal, setShowShareModal] = useState(false)
  const { onlineUsersArray } = useOnlineUsersContext()
  const { openDoc } = useEditorManagerContext()

  const handleOpenShareModal = useCallback(() => {
    eventTracking.sendMBOnce('ide-open-share-modal-once')
    setShowShareModal(true)
  }, [])

  const handleHideShareModal = useCallback(() => {
    setShowShareModal(false)
  }, [])

  return (
    <>
      <EditorNavigationToolbarRoot
        onlineUsersArray={onlineUsersArray}
        openDoc={openDoc}
        openShareProjectModal={handleOpenShareModal}
      />
      <EditorOverLimitModal />
      <ViewOnlyAccessModal />
      <ShareProjectModal
        show={showShareModal}
        handleOpen={handleOpenShareModal}
        handleHide={handleHideShareModal}
      />
    </>
  )
}

export default EditorNavigationToolbar
