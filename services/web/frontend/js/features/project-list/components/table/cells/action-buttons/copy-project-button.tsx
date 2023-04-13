import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import CloneProjectModal from '../../../../../clone-project-modal/components/clone-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { Project } from '../../../../../../../../types/project/dashboard/api'

type CopyButtonProps = {
  project: Project
  children: (text: string, handleOpenModal: () => void) => React.ReactElement
}

function CopyProjectButton({ project, children }: CopyButtonProps) {
  const { addClonedProjectToViewData, updateProjectViewData } =
    useProjectListContext()
  const { t } = useTranslation()
  const text = t('copy')
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

  const handleAfterCloned = useCallback(
    clonedProject => {
      eventTracking.sendMB('project-list-page-interaction', { action: 'clone' })
      addClonedProjectToViewData(clonedProject)
      updateProjectViewData({ ...project, selected: false })
      setShowModal(false)
    },
    [addClonedProjectToViewData, project, updateProjectViewData]
  )

  if (project.archived || project.trashed) return null

  return (
    <>
      {children(text, handleOpenModal)}
      <CloneProjectModal
        show={showModal}
        handleHide={handleCloseModal}
        handleAfterCloned={handleAfterCloned}
        projectId={project.id}
        projectName={project.name}
      />
    </>
  )
}

const CopyProjectButtonTooltip = memo(function CopyProjectButtonTooltip({
  project,
}: Pick<CopyButtonProps, 'project'>) {
  return (
    <CopyProjectButton project={project}>
      {(text, handleOpenModal) => (
        <Tooltip
          key={`tooltip-copy-project-${project.id}`}
          id={`copy-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <button
            className="btn btn-link action-btn"
            aria-label={text}
            onClick={handleOpenModal}
          >
            <Icon type="files-o" />
          </button>
        </Tooltip>
      )}
    </CopyProjectButton>
  )
})

export default memo(CopyProjectButton)
export { CopyProjectButtonTooltip }
