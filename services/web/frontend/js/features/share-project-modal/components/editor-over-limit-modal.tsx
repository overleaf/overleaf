import { useEffect, useState } from 'react'
import EditorOverLimitModalContent from './editor-over-limit-modal-content'
import customLocalStorage from '@/infrastructure/local-storage'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorContext } from '@/shared/context/editor-context'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { sendMB } from '@/infrastructure/event-tracking'
import { OLModal } from '@/shared/components/ol/ol-modal'

const EditorOverLimitModal = () => {
  const [show, setShow] = useState(false)

  const { isProjectOwner } = useEditorContext()
  const { permissionsLevel } = useIdeReactContext()
  const { project, features, projectId } = useProjectContext()
  const members = project?.members

  const handleHide = () => {
    setShow(false)
  }

  // show the over-limit warning if user
  // is editor on a project over
  // collaborator limit (once every 24 hours)
  useEffect(() => {
    const showModalCooldownHours = 24
    const hasExceededCollaboratorLimit = () => {
      if (
        isProjectOwner ||
        !features ||
        !members ||
        permissionsLevel === 'readOnly'
      ) {
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
        sendMB('notification-prompt', {
          name: 'link-sharing-collaborator-limit',
        })
      }
    }
  }, [features, isProjectOwner, members, permissionsLevel, projectId])

  return show ? (
    <OLModal
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
      <EditorOverLimitModalContent handleHide={handleHide} />
    </OLModal>
  ) : null
}

export default EditorOverLimitModal
