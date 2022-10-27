import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assign } from '../../../shared/components/location'
import EditorCloneProjectModalWrapper from '../../clone-project-modal/components/editor-clone-project-modal-wrapper'
import LeftMenuButton from './left-menu-button'

type ProjectCopyResponse = {
  project_id: string
}

export default function ActionsCopyProject() {
  const [showModal, setShowModal] = useState(false)
  const { t } = useTranslation()

  const openProject = useCallback(
    ({ project_id: projectId }: ProjectCopyResponse) => {
      assign(`/project/${projectId}`)
    },
    []
  )

  return (
    <>
      <LeftMenuButton
        onClick={() => setShowModal(true)}
        icon={{
          type: 'copy',
          fw: true,
        }}
      >
        {t('copy_project')}
      </LeftMenuButton>
      <EditorCloneProjectModalWrapper
        show={showModal}
        handleHide={() => setShowModal(false)}
        openProject={openProject}
      />
    </>
  )
}
