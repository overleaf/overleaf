import { memo, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import TrashProjectModal from '../../../modals/trash-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { trashProject } from '../../../../util/api'

function TrashProjectsButton() {
  const { selectedProjects, updateProjectViewData } = useProjectListContext()
  const { t } = useTranslation()
  const text = t('trash')

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

  const handleTrashProjects = useCallback(async () => {
    for (const project of selectedProjects) {
      await trashProject(project.id)
      updateProjectViewData({
        ...project,
        trashed: true,
        archived: false,
        selected: false,
      })
    }
  }, [selectedProjects, updateProjectViewData])

  return (
    <>
      <Tooltip
        id="tooltip-trash-projects"
        description={text}
        overlayProps={{ placement: 'bottom', trigger: ['hover', 'focus'] }}
      >
        <button
          className="btn btn-secondary"
          aria-label={text}
          onClick={handleOpenModal}
        >
          <Icon type="trash" />
        </button>
      </Tooltip>
      <TrashProjectModal
        projects={selectedProjects}
        actionHandler={handleTrashProjects}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

export default memo(TrashProjectsButton)
