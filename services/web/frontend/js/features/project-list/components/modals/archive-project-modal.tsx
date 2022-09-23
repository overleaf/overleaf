import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'

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

  return (
    <ProjectsActionModal
      action="archive"
      actionHandler={actionHandler}
      title={t('archive_projects')}
      bodyTop={<p>{t('about_to_archive_projects')}</p>}
      bodyBottom={
        <p>
          {t('archiving_projects_wont_affect_collaborators')}{' '}
          <a
            href="https://www.overleaf.com/blog/new-feature-using-archive-and-trash-to-keep-your-projects-organized"
            target="_blank"
            rel="noreferrer"
          >
            {t('find_out_more_nt')}
          </a>
        </p>
      }
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    />
  )
}

export default ArchiveProjectModal
