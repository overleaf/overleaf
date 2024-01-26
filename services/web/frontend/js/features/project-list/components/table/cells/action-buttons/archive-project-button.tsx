import { useTranslation } from 'react-i18next'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import { memo, useCallback, useState } from 'react'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import ArchiveProjectModal from '../../../modals/archive-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { useProjectListContext } from '../../../../context/project-list-context'
import { archiveProject } from '../../../../util/api'

type ArchiveProjectButtonProps = {
  project: Project
  children: (text: string, handleOpenModal: () => void) => React.ReactElement
}

function ArchiveProjectButton({
  project,
  children,
}: ArchiveProjectButtonProps) {
  const { toggleSelectedProject, updateProjectViewData } =
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

  const handleArchiveProject = useCallback(async () => {
    await archiveProject(project.id)
    toggleSelectedProject(project.id, false)
    updateProjectViewData({
      ...project,
      archived: true,
      trashed: false,
    })
  }, [project, toggleSelectedProject, updateProjectViewData])

  if (project.archived) return null

  return (
    <>
      {children(text, handleOpenModal)}
      <ArchiveProjectModal
        projects={[project]}
        actionHandler={handleArchiveProject}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

const ArchiveProjectButtonTooltip = memo(function ArchiveProjectButtonTooltip({
  project,
}: Pick<ArchiveProjectButtonProps, 'project'>) {
  return (
    <ArchiveProjectButton project={project}>
      {(text, handleOpenModal) => (
        <Tooltip
          key={`tooltip-archive-project-${project.id}`}
          id={`archive-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <button
            className="btn btn-link action-btn"
            aria-label={text}
            onClick={handleOpenModal}
          >
            <Icon type="inbox" fw />
          </button>
        </Tooltip>
      )}
    </ArchiveProjectButton>
  )
})

export default memo(ArchiveProjectButton)
export { ArchiveProjectButtonTooltip }
