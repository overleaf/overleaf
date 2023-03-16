import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EditorCloneProjectModalWrapper from '../../clone-project-modal/components/editor-clone-project-modal-wrapper'
import LeftMenuButton from './left-menu-button'
import { useLocation } from '../../../shared/hooks/use-location'

type ProjectCopyResponse = {
  project_id: string
}

export default function ActionsCopyProject() {
  const [showModal, setShowModal] = useState(false)
  const { t } = useTranslation()
  const location = useLocation()

  const openProject = useCallback(
    ({ project_id: projectId }: ProjectCopyResponse) => {
      location.assign(`/project/${projectId}`)
    },
    [location]
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
