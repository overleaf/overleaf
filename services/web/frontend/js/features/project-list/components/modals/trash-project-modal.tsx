import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'

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

  return (
    <ProjectsActionModal
      action="trash"
      actionHandler={actionHandler}
      title={t('trash_projects')}
      bodyTop={<p>{t('about_to_trash_projects')}</p>}
      bodyBottom={
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
      }
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    />
  )
}

export default TrashProjectModal
