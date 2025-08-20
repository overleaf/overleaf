import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EditorCloneProjectModalWrapper from '../../clone-project-modal/components/editor-clone-project-modal-wrapper'
import LeftMenuButton from './left-menu-button'
import * as eventTracking from '../../../infrastructure/event-tracking'
import useOpenProject from '@/shared/hooks/use-open-project'

export default function ActionsCopyProject() {
  const [showModal, setShowModal] = useState(false)
  const { t } = useTranslation()
  const openProject = useOpenProject()

  const handleShowModal = useCallback(() => {
    eventTracking.sendMB('left-menu-copy')
    setShowModal(true)
  }, [])

  return (
    <>
      <LeftMenuButton onClick={handleShowModal} icon="file_copy">
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
