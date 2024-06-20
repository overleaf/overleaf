import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import ProjectsList from './projects-list'
import Notification from '@/shared/components/notification'

type LeaveProjectModalProps = Pick<
  React.ComponentProps<typeof ProjectsActionModal>,
  'projects' | 'actionHandler' | 'showModal' | 'handleCloseModal'
>

function LeaveProjectModal({
  projects,
  actionHandler,
  showModal,
  handleCloseModal,
}: LeaveProjectModalProps) {
  const { t } = useTranslation()
  const [projectsToDisplay, setProjectsToDisplay] = useState<typeof projects>(
    []
  )

  useEffect(() => {
    if (showModal) {
      setProjectsToDisplay(displayProjects => {
        return displayProjects.length ? displayProjects : projects
      })
    } else {
      setProjectsToDisplay([])
    }
  }, [showModal, projects])

  return (
    <ProjectsActionModal
      action="leave"
      actionHandler={actionHandler}
      title={t('leave_projects')}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    >
      <p>{t('about_to_leave_projects')}</p>
      <ProjectsList projects={projects} projectsToDisplay={projectsToDisplay} />
      <Notification
        content={t('this_action_cannot_be_undone')}
        type="warning"
      />
    </ProjectsActionModal>
  )
}

export default LeaveProjectModal
