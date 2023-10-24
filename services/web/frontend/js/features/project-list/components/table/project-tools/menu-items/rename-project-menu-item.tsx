import { memo, useCallback, useState } from 'react'
import { MenuItem } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../../context/project-list-context'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import RenameProjectModal from '../../../modals/rename-project-modal'

function RenameProjectMenuItem() {
  const { selectedProjects } = useProjectListContext()
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()
  const { t } = useTranslation()

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  if (selectedProjects.length !== 1) {
    return null
  }

  const [selectedProject] = selectedProjects

  // only show Rename if the current user is the project owner
  if (selectedProject.accessLevel !== 'owner') {
    return null
  }

  return (
    <>
      <MenuItem onClick={handleOpenModal}>{t('rename')}</MenuItem>
      <RenameProjectModal
        handleCloseModal={handleCloseModal}
        showModal={showModal}
        project={selectedProject}
      />
    </>
  )
}

export default memo(RenameProjectMenuItem)
