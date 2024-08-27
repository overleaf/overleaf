import { useState, useCallback } from 'react'
import { useOnlineUsersContext } from '@/features/ide-react/context/online-users-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import * as eventTracking from '@/infrastructure/event-tracking'
import EditorNavigationToolbarRoot from '@/features/editor-navigation-toolbar/components/editor-navigation-toolbar-root'
import NewShareProjectModal from '@/features/share-project-modal/components/restricted-link-sharing/share-project-modal'
import ShareProjectModal from '@/features/share-project-modal/components/share-project-modal'
import EditorOverLimitModal from '@/features/share-project-modal/components/restricted-link-sharing/editor-over-limit-modal'
import ViewOnlyAccessModal from '@/features/share-project-modal/components/restricted-link-sharing/view-only-access-modal'
import getMeta from '@/utils/meta'

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

  const showNewShareModal = getMeta('ol-linkSharingWarning')

  return (
    <>
      <EditorNavigationToolbarRoot
        onlineUsersArray={onlineUsersArray}
        openDoc={openDoc}
        openShareProjectModal={handleOpenShareModal}
      />
      {showNewShareModal ? (
        <>
          <EditorOverLimitModal />
          <ViewOnlyAccessModal />
          <NewShareProjectModal
            show={showShareModal}
            handleOpen={handleOpenShareModal}
            handleHide={handleHideShareModal}
          />
        </>
      ) : (
        <ShareProjectModal
          show={showShareModal}
          handleHide={handleHideShareModal}
        />
      )}
    </>
  )
}

export default EditorNavigationToolbar
