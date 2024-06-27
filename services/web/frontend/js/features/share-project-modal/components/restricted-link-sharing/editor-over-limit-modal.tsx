import { useEffect, useState } from 'react'
import AccessibleModal from '@/shared/components/accessible-modal'
import EditorOverLimitModalContent from './editor-over-limit-modal-content'
import customLocalStorage from '@/infrastructure/local-storage'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorContext } from '@/shared/context/editor-context'

const EditorOverLimitModal = () => {
  const [show, setShow] = useState(false)

  const { isProjectOwner, permissionsLevel } = useEditorContext()
  const { members, features, _id: projectId } = useProjectContext()

  const handleHide = () => {
    setShow(false)
  }

  // split test: link-sharing-warning
  // show the over-limit warning if user
  // is editor on a project over
  // collaborator limit (once every 24 hours)
  useEffect(() => {
    const showModalCooldownHours = 24
    const hasExceededCollaboratorLimit = () => {
      if (isProjectOwner || !features || permissionsLevel === 'readOnly') {
        return false
      }

      if (features.collaborators === -1) {
        return false
      }
      return (
        members.filter(member => member.privileges === 'readAndWrite').length >
        (features.collaborators ?? 1)
      )
    }

    if (hasExceededCollaboratorLimit()) {
      const localStorageKey = `last-shown-need-edit-modal.${projectId}`
      const lastShownNeedEditModalTime =
        customLocalStorage.getItem(localStorageKey)
      if (
        !lastShownNeedEditModalTime ||
        lastShownNeedEditModalTime + showModalCooldownHours * 60 * 60 * 1000 <
          Date.now()
      ) {
        setShow(true)
        customLocalStorage.setItem(localStorageKey, Date.now())
      }
    }
  }, [features, isProjectOwner, members, permissionsLevel, projectId])

  return show ? (
    <AccessibleModal
      animation
      show={show}
      onHide={handleHide}
      id="editor-over-limit-modal"
    >
      <EditorOverLimitModalContent handleHide={handleHide} />
    </AccessibleModal>
  ) : null
}

export default EditorOverLimitModal
