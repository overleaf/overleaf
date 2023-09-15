import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import LeaveProjectModal from '../../../modals/leave-project-modal'
import { useProjectListContext } from '../../../../context/project-list-context'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { leaveProject } from '../../../../util/api'
import { Project } from '../../../../../../../../types/project/dashboard/api'

type LeaveProjectButtonProps = {
  project: Project
  children: (text: string, handleOpenModal: () => void) => React.ReactElement
}

function LeaveProjectButton({ project, children }: LeaveProjectButtonProps) {
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
      {children(text, handleOpenModal)}
      <LeaveProjectModal
        projects={[project]}
        actionHandler={handleLeaveProject}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

const LeaveProjectButtonTooltip = memo(function LeaveProjectButtonTooltip({
  project,
}: Pick<LeaveProjectButtonProps, 'project'>) {
  return (
    <LeaveProjectButton project={project}>
      {(text, handleOpenModal) => (
        <Tooltip
          key={`tooltip-leave-project-${project.id}`}
          id={`leave-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <button
            className="btn btn-link action-btn"
            aria-label={text}
            onClick={handleOpenModal}
          >
            <Icon type="sign-out" fw />
          </button>
        </Tooltip>
      )}
    </LeaveProjectButton>
  )
})

export default memo(LeaveProjectButton)
export { LeaveProjectButtonTooltip }
