import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import Icon from '../../../../shared/components/icon'

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

  return (
    <ProjectsActionModal
      action="leave"
      actionHandler={actionHandler}
      title={t('leave_projects')}
      bodyTop={<p>{t('about_to_leave_projects')}</p>}
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

export default LeaveProjectModal
