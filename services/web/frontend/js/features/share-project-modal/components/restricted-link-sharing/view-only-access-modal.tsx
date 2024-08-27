import { useEffect, useState } from 'react'
import AccessibleModal from '@/shared/components/accessible-modal'
import ViewOnlyAccessModalContent from './view-only-access-modal-content'
import customLocalStorage from '@/infrastructure/local-storage'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorContext } from '@/shared/context/editor-context'
import { sendMB } from '@/infrastructure/event-tracking'

const ViewOnlyAccessModal = () => {
  const [show, setShow] = useState(false)

  const { isProjectOwner, isPendingEditor, permissionsLevel } =
    useEditorContext()
  const { members, features, _id: projectId } = useProjectContext()

  const handleHide = () => {
    setShow(false)
  }

  // split test: link-sharing-enforcement
  // show the view-only access modal if
  // is editor on a project over
  // collaborator limit (once every week)
  useEffect(() => {
    const showModalCooldownHours = 24 * 7 // 7 days
    const shouldShowToPendingEditor = () => {
      if (isProjectOwner || !features) {
        return false
      }

      if (features.collaborators === -1) {
        return false
      }
      return isPendingEditor
    }

    if (shouldShowToPendingEditor()) {
      const localStorageKey = `last-shown-view-only-access-modal.${projectId}`
      const lastShownNeedEditModalTime =
        customLocalStorage.getItem(localStorageKey)
      if (
        !lastShownNeedEditModalTime ||
        lastShownNeedEditModalTime + showModalCooldownHours * 60 * 60 * 1000 <
          Date.now()
      ) {
        setShow(true)
        customLocalStorage.setItem(localStorageKey, Date.now())
        sendMB('notification-prompt', {
          name: 'link-sharing-collaborator-limit',
        })
      }
    }
  }, [
    features,
    isProjectOwner,
    isPendingEditor,
    members,
    permissionsLevel,
    projectId,
  ])

  return show ? (
    <AccessibleModal
      animation
      show={show}
      onHide={() => {
        sendMB('notification-dismiss', {
          name: 'link-sharing-collaborator-limit',
        })
        handleHide()
      }}
      id="editor-over-limit-modal"
    >
      <ViewOnlyAccessModalContent handleHide={handleHide} />
    </AccessibleModal>
  ) : null
}

export default ViewOnlyAccessModal
