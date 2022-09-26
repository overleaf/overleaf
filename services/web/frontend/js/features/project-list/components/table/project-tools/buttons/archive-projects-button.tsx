import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import ArchiveProjectModal from '../../../modals/archive-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { archiveProject } from '../../../../util/api'

function ArchiveProjectsButton() {
  const { selectedProjects, updateProjectViewData } = useProjectListContext()
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

  const handleArchiveProjects = useCallback(async () => {
    for (const project of selectedProjects) {
      await archiveProject(project.id)
      // update view
      project.archived = true
      project.selected = false
      updateProjectViewData(project)
    }
  }, [selectedProjects, updateProjectViewData])

  return (
    <>
      <Tooltip
        id="tooltip-download-projects"
        description={text}
        overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
      >
        <button
          className="btn btn-default"
          aria-label={text}
          onClick={handleOpenModal}
        >
          <Icon type="inbox" />
        </button>
      </Tooltip>
      <ArchiveProjectModal
        projects={selectedProjects}
        actionHandler={handleArchiveProjects}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

export default memo(ArchiveProjectsButton)
