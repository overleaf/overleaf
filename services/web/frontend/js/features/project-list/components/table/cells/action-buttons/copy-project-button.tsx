import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CloneProjectModal from '../../../../../clone-project-modal/components/clone-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import {
  ClonedProject,
  Project,
} from '../../../../../../../../types/project/dashboard/api'
import { useProjectTags } from '@/features/project-list/hooks/use-project-tags'
import { isSmallDevice } from '../../../../../../infrastructure/event-tracking'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'

type CopyButtonProps = {
  project: Project
  children: (
    text: string,
    handleOpenModal: <T extends React.MouseEvent>(
      e?: T,
      fn?: (e?: T) => void
    ) => void
  ) => React.ReactElement
}

function CopyProjectButton({ project, children }: CopyButtonProps) {
  const {
    addClonedProjectToViewData,
    addProjectToTagInView,
    toggleSelectedProject,
    updateProjectViewData,
  } = useProjectListContext()
  const { t } = useTranslation()
  const text = t('copy')
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()
  const projectTags = useProjectTags(project.id)

  const handleOpenModal = useCallback(
    <T extends React.MouseEvent>(e?: T, onOpen?: (e?: T) => void) => {
      setShowModal(true)
      onOpen?.(e)
    },
    []
  )

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  const handleAfterCloned = useCallback(
    (clonedProject: ClonedProject, tags: { _id: string }[]) => {
      eventTracking.sendMB('project-list-page-interaction', {
        action: 'clone',
        projectId: project.id,
        isSmallDevice,
      })
      addClonedProjectToViewData(clonedProject)
      for (const tag of tags) {
        addProjectToTagInView(tag._id, clonedProject.project_id)
      }
      toggleSelectedProject(project.id, false)
      updateProjectViewData({ ...project })
      setShowModal(false)
    },
    [
      addClonedProjectToViewData,
      addProjectToTagInView,
      project,
      toggleSelectedProject,
      updateProjectViewData,
    ]
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
        projectTags={projectTags}
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
        <OLTooltip
          key={`tooltip-copy-project-${project.id}`}
          id={`copy-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <span>
            <OLIconButton
              onClick={handleOpenModal}
              variant="link"
              accessibilityLabel={text}
              className="action-btn"
              icon="file_copy"
            />
          </span>
        </OLTooltip>
      )}
    </CopyProjectButton>
  )
})

export default memo(CopyProjectButton)
export { CopyProjectButtonTooltip }
