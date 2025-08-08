import { useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import { useTranslation } from 'react-i18next'
import DeleteLeaveProjectModal from '../../../modals/delete-leave-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { deleteProject, leaveProject } from '../../../../util/api'
import { Project } from '../../../../../../../../types/project/dashboard/api'

function DeleteLeaveProjectsButton() {
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

  const handleDeleteAndLeaveProject = async (project: Project) => {
    if (project.accessLevel === 'owner') {
      await deleteProject(project.id)
    } else {
      await leaveProject(project.id)
    }

    removeProjectFromView(project)
  }

  return (
    <>
      {hasDeletableProjectsSelected && hasLeavableProjectsSelected && (
        <OLButton variant="danger" onClick={handleOpenModal}>
          {t('delete_and_leave')}
        </OLButton>
      )}
      <DeleteLeaveProjectModal
        projects={selectedProjects}
        actionHandler={handleDeleteAndLeaveProject}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

export default DeleteLeaveProjectsButton
