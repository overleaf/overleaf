import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuItem } from 'react-bootstrap'
import CloneProjectModal from '../../../../../clone-project-modal/components/clone-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { Project } from '../../../../../../../../types/project/dashboard/api'

function CopyProjectMenuItem() {
  const {
    addClonedProjectToViewData,
    updateProjectViewData,
    selectedProjects,
  } = useProjectListContext()
  const { t } = useTranslation()

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
    (clonedProject: Project) => {
      const project = selectedProjects[0]
      eventTracking.sendMB('project-list-page-interaction', { action: 'clone' })
      addClonedProjectToViewData(clonedProject)
      updateProjectViewData({ ...project, selected: false })

      if (isMounted.current) {
        setShowModal(false)
      }
    },
    [
      isMounted,
      selectedProjects,
      addClonedProjectToViewData,
      updateProjectViewData,
    ]
  )

  if (selectedProjects.length !== 1) return null

  if (selectedProjects[0].archived || selectedProjects[0].trashed) return null

  return (
    <>
      <CloneProjectModal
        show={showModal}
        handleHide={handleCloseModal}
        handleAfterCloned={handleAfterCloned}
        projectId={selectedProjects[0].id}
        projectName={selectedProjects[0].name}
      />
      <MenuItem onClick={handleOpenModal}>{t('make_a_copy')}</MenuItem>
    </>
  )
}

export default memo(CopyProjectMenuItem)
