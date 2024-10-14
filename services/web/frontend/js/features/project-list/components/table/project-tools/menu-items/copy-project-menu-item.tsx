import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import OLDropdownMenuItem from '@/features/ui/components/ol/ol-dropdown-menu-item'
import CloneProjectModal from '../../../../../clone-project-modal/components/clone-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { ClonedProject } from '../../../../../../../../types/project/dashboard/api'
import { useProjectTags } from '@/features/project-list/hooks/use-project-tags'
import { isSmallDevice } from '../../../../../../infrastructure/event-tracking'

function CopyProjectMenuItem() {
  const {
    addClonedProjectToViewData,
    addProjectToTagInView,
    toggleSelectedProject,
    selectedProjects,
  } = useProjectListContext()
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()
  const projectTags = useProjectTags(selectedProjects[0]?.id)

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  const handleAfterCloned = useCallback(
    (clonedProject: ClonedProject, tags: { _id: string }[]) => {
      const project = selectedProjects[0]
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

      if (isMounted.current) {
        setShowModal(false)
      }
    },
    [
      isMounted,
      selectedProjects,
      addClonedProjectToViewData,
      addProjectToTagInView,
      toggleSelectedProject,
    ]
  )

  if (selectedProjects.length !== 1) return null

  if (selectedProjects[0].archived || selectedProjects[0].trashed) return null

  return (
    <>
      <OLDropdownMenuItem onClick={handleOpenModal} as="button" tabIndex={-1}>
        {t('make_a_copy')}
      </OLDropdownMenuItem>
      <CloneProjectModal
        show={showModal}
        handleHide={handleCloseModal}
        handleAfterCloned={handleAfterCloned}
        projectId={selectedProjects[0].id}
        projectName={selectedProjects[0].name}
        projectTags={projectTags}
      />
    </>
  )
}

export default memo(CopyProjectMenuItem)
