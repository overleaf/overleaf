import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import ProjectsList from './projects-list'

type TrashProjectPropsModalProps = Pick<
  React.ComponentProps<typeof ProjectsActionModal>,
  'projects' | 'actionHandler' | 'showModal' | 'handleCloseModal'
>

function TrashProjectModal({
  projects,
  actionHandler,
  showModal,
  handleCloseModal,
}: TrashProjectPropsModalProps) {
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
      action="trash"
      actionHandler={actionHandler}
      title={t('trash_projects')}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    >
      <p>{t('about_to_trash_projects')}</p>
      <ProjectsList projects={projects} projectsToDisplay={projectsToDisplay} />
      <p>
        {t('trashing_projects_wont_affect_collaborators')}{' '}
        <a
          href="https://www.overleaf.com/blog/new-feature-using-archive-and-trash-to-keep-your-projects-organized"
          target="_blank"
          rel="noreferrer"
        >
          {t('find_out_more_nt')}
        </a>
      </p>
    </ProjectsActionModal>
  )
}

export default TrashProjectModal
