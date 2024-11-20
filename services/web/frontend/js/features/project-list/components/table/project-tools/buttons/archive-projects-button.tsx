import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLIconButton from '@/features/ui/components/ol/ol-icon-button'
import ArchiveProjectModal from '../../../modals/archive-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { archiveProject } from '../../../../util/api'
import { Project } from '../../../../../../../../types/project/dashboard/api'

function ArchiveProjectsButton() {
  const { selectedProjects, toggleSelectedProject, updateProjectViewData } =
    useProjectListContext()
  const { t } = useTranslation()
  const text = t('archive')

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

  const handleArchiveProject = async (project: Project) => {
    await archiveProject(project.id)

    toggleSelectedProject(project.id, false)
    updateProjectViewData({
      ...project,
      archived: true,
      trashed: false,
    })
  }

  return (
    <>
      <OLTooltip
        id="tooltip-archive-projects"
        description={text}
        overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
      >
        <OLIconButton
          onClick={handleOpenModal}
          variant="secondary"
          accessibilityLabel={text}
          icon="inbox"
        />
      </OLTooltip>
      <ArchiveProjectModal
        projects={selectedProjects}
        actionHandler={handleArchiveProject}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

export default memo(ArchiveProjectsButton)
