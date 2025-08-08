import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LeaveProjectModal from '../../../modals/leave-project-modal'
import { useProjectListContext } from '../../../../context/project-list-context'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { leaveProject } from '../../../../util/api'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import getMeta from '@/utils/meta'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLIconButton from '@/shared/components/ol/ol-icon-button'

type LeaveProjectButtonProps = {
  project: Project
  children: (text: string, handleOpenModal: () => void) => React.ReactElement
}

function LeaveProjectButton({ project, children }: LeaveProjectButtonProps) {
  const { removeProjectFromView } = useProjectListContext()
  const { t } = useTranslation()
  const text = t('leave')
  const isOwner = useMemo(() => {
    return project.owner && getMeta('ol-user_id') === project.owner.id
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
        <OLTooltip
          key={`tooltip-leave-project-${project.id}`}
          id={`leave-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <span>
            <OLIconButton
              onClick={handleOpenModal}
              variant="link"
              accessibilityLabel={text}
              className="action-btn"
              icon="logout"
            />
          </span>
        </OLTooltip>
      )}
    </LeaveProjectButton>
  )
})

export default memo(LeaveProjectButton)
export { LeaveProjectButtonTooltip }
