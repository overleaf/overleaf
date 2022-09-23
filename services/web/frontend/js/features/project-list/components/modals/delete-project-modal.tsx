import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import Icon from '../../../../shared/components/icon'

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

  return (
    <ProjectsActionModal
      action="delete"
      actionHandler={actionHandler}
      title={t('delete_projects')}
      bodyTop={<p>{t('about_to_delete_projects')}</p>}
      bodyBottom={
        <div className="project-action-alert alert alert-warning">
          <Icon type="exclamation-triangle" fw />{' '}
          {t('this_action_cannot_be_undone')}
        </div>
      }
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    />
  )
}

export default DeleteProjectModal
