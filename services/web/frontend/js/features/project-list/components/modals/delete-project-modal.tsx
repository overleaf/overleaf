import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import Icon from '../../../../shared/components/icon'
import ProjectsList from './projects-list'

type DeleteProjectModalProps = Pick<
  React.ComponentProps<typeof ProjectsActionModal>,
  'projects' | 'actionHandler' | 'showModal' | 'handleCloseModal'
>

function DeleteProjectModal({
  projects,
  actionHandler,
  showModal,
  handleCloseModal,
}: DeleteProjectModalProps) {
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
      action="delete"
      actionHandler={actionHandler}
      title={t('delete_projects')}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    >
      <p>{t('about_to_delete_projects')}</p>
      <ProjectsList projects={projects} projectsToDisplay={projectsToDisplay} />
      <div className="project-action-alert alert alert-warning">
        <Icon type="exclamation-triangle" fw />{' '}
        {t('this_action_cannot_be_undone')}
      </div>
    </ProjectsActionModal>
  )
}

export default DeleteProjectModal
