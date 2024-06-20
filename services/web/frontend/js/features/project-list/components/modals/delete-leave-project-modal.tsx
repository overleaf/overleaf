import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import ProjectsList from './projects-list'
import { isLeavableProject, isDeletableProject } from '../../util/project'
import Notification from '@/shared/components/notification'

type DeleteLeaveProjectModalProps = Pick<
  React.ComponentProps<typeof ProjectsActionModal>,
  'projects' | 'actionHandler' | 'showModal' | 'handleCloseModal'
>

function DeleteLeaveProjectModal({
  projects,
  actionHandler,
  showModal,
  handleCloseModal,
}: DeleteLeaveProjectModalProps) {
  const { t } = useTranslation()
  const [projectsToDeleteDisplay, setProjectsToDeleteDisplay] = useState<
    typeof projects
  >([])
  const [projectsToLeaveDisplay, setProjectsToLeaveDisplay] = useState<
    typeof projects
  >([])

  const projectsToDelete = useMemo(() => {
    return projects.filter(isDeletableProject)
  }, [projects])
  const projectsToLeave = useMemo(() => {
    return projects.filter(isLeavableProject)
  }, [projects])

  useEffect(() => {
    if (showModal) {
      setProjectsToDeleteDisplay(displayProjects => {
        return displayProjects.length ? displayProjects : projectsToDelete
      })
    } else {
      setProjectsToDeleteDisplay([])
    }
  }, [showModal, projectsToDelete])

  useEffect(() => {
    if (showModal) {
      setProjectsToLeaveDisplay(displayProjects => {
        return displayProjects.length ? displayProjects : projectsToLeave
      })
    } else {
      setProjectsToLeaveDisplay([])
    }
  }, [showModal, projectsToLeave])

  return (
    <ProjectsActionModal
      action="leaveOrDelete"
      actionHandler={actionHandler}
      title={t('delete_and_leave_projects')}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={[...projectsToDelete, ...projectsToLeave]}
    >
      <p>{t('about_to_delete_projects')}</p>
      <ProjectsList
        projects={projectsToDelete}
        projectsToDisplay={projectsToDeleteDisplay}
      />
      <p>{t('about_to_leave_projects')}</p>
      <ProjectsList
        projects={projectsToLeave}
        projectsToDisplay={projectsToLeaveDisplay}
      />
      <Notification
        content={t('this_action_cannot_be_undone')}
        type="warning"
      />
    </ProjectsActionModal>
  )
}

export default DeleteLeaveProjectModal
