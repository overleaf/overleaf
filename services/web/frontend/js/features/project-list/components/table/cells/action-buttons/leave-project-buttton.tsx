import { useTranslation } from 'react-i18next'
import { memo, useCallback, useMemo, useState } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import { useProjectListContext } from '../../../../context/project-list-context'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import ProjectsActionModal from '../../projects-action-modal'
import { leaveProject } from '../../../../util/api'

type LeaveProjectButtonProps = {
  project: Project
}

function LeaveProjectButton({ project }: LeaveProjectButtonProps) {
  const { removeProjectFromView } = useProjectListContext()
  const { t } = useTranslation()
  const text = t('leave')
  const isOwner = useMemo(() => {
    return project.owner && window.user_id === project.owner.id
  }, [project])
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  const handleLeaveProject = useCallback(async () => {
    await leaveProject(project.id)

    // update view
    removeProjectFromView(project)
  }, [project, removeProjectFromView])

  if (!project.trashed || isOwner) return null

  return (
    <>
      <Tooltip
        key={`tooltip-leave-project-${project.id}`}
        id={`tooltip-leave-project-${project.id}`}
        description={text}
        overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
      >
        <button
          className="btn btn-link action-btn"
          aria-label={text}
          onClick={handleOpenModal}
        >
          <Icon type="sign-out" />
        </button>
      </Tooltip>

      <ProjectsActionModal
        title={t('leave_projects')}
        action="trash"
        actionHandler={handleLeaveProject}
        bodyTop={<p>{t('about_to_leave_projects')}</p>}
        bodyBottom={
          <div className="project-action-alert alert alert-warning">
            <Icon type="exclamation-triangle" fw />{' '}
            {t('this_action_cannot_be_undone')}
          </div>
        }
        showModal={showModal}
        handleCloseModal={handleCloseModal}
        projects={[project]}
      />
    </>
  )
}

export default memo(LeaveProjectButton)
