import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { archiveProject } from '../../../../util/api'
import ProjectsActionModal from '../../projects-action-modal'

function ArchiveProjectsButton() {
  const { selectedProjects, updateProjectViewData, setSelectedProjects } =
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

  const handleArchiveProjects = useCallback(async () => {
    for (const project of selectedProjects) {
      await archiveProject(project.id)
      // update view
      project.archived = true
      updateProjectViewData(project)
    }
    setSelectedProjects([])
  }, [selectedProjects, setSelectedProjects, updateProjectViewData])

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
      <ProjectsActionModal
        action="archive"
        actionHandler={handleArchiveProjects}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
        projects={selectedProjects}
      />
    </>
  )
}

export default memo(ArchiveProjectsButton)
