import { useTranslation } from 'react-i18next'
import { memo, useCallback, useState } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import CloneProjectModal from '../../../../../clone-project-modal/components/clone-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'

type CopyButtonProps = {
  project: Project
}

function CopyProjectButton({ project }: CopyButtonProps) {
  const { addClonedProjectToViewData } = useProjectListContext()
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
    project => {
      eventTracking.send(
        'project-list-page-interaction',
        'project action',
        'Clone'
      )
      addClonedProjectToViewData(project)
      setShowModal(false)
    },
    [addClonedProjectToViewData]
  )

  if (project.archived || project.trashed) return null

  return (
    <>
      <Tooltip
        key={`tooltip-copy-project-${project.id}`}
        id={`tooltip-copy-project-${project.id}`}
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

export default memo(CopyProjectButton)
