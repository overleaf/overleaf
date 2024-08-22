import { useState } from 'react'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import DeleteProjectModal from '../../../modals/delete-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { deleteProject } from '../../../../util/api'
import { Project } from '../../../../../../../../types/project/dashboard/api'

function DeleteProjectsButton() {
  const { t } = useTranslation()
  const {
    selectedProjects,
    removeProjectFromView,
    hasLeavableProjectsSelected,
    hasDeletableProjectsSelected,
  } = useProjectListContext()
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()

  const handleOpenModal = () => {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }

  const handleDeleteProject = async (project: Project) => {
    await deleteProject(project.id)

    removeProjectFromView(project)
  }

  return (
    <>
      {hasDeletableProjectsSelected && !hasLeavableProjectsSelected && (
        <OLButton variant="danger" onClick={handleOpenModal}>
          {t('delete')}
        </OLButton>
      )}
      <DeleteProjectModal
        projects={selectedProjects}
        actionHandler={handleDeleteProject}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

export default DeleteProjectsButton
