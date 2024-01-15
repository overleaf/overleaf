import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import ProjectsList from './projects-list'

type ArchiveProjectModalProps = Pick<
  React.ComponentProps<typeof ProjectsActionModal>,
  'projects' | 'actionHandler' | 'showModal' | 'handleCloseModal'
>

function ArchiveProjectModal({
  projects,
  actionHandler,
  showModal,
  handleCloseModal,
}: ArchiveProjectModalProps) {
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
      action="archive"
      actionHandler={actionHandler}
      title={t('archive_projects')}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    >
      <p>{t('about_to_archive_projects')}</p>
      <ProjectsList projects={projects} projectsToDisplay={projectsToDisplay} />
      <p>
        {t('archiving_projects_wont_affect_collaborators')}{' '}
        <a
          href="https://www.overleaf.com/learn/how-to/How_do_I_archive_and_unarchive_projects%3F"
          target="_blank"
          rel="noreferrer"
        >
          {t('find_out_more_nt')}
        </a>
      </p>
    </ProjectsActionModal>
  )
}

export default ArchiveProjectModal
