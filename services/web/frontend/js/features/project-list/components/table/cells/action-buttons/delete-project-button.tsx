import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import DeleteProjectModal from '../../../modals/delete-project-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { deleteProject } from '../../../../util/api'
import { useProjectListContext } from '../../../../context/project-list-context'
import getMeta from '@/utils/meta'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLIconButton from '@/shared/components/ol/ol-icon-button'

type DeleteProjectButtonProps = {
  project: Project
  children: (text: string, handleOpenModal: () => void) => React.ReactElement
}

function DeleteProjectButton({ project, children }: DeleteProjectButtonProps) {
  const { removeProjectFromView } = useProjectListContext()
  const { t } = useTranslation()
  const text = t('delete')
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

  const isOwner = useMemo(() => {
    return project.owner && getMeta('ol-user_id') === project.owner.id
  }, [project])

  const handleDeleteProject = useCallback(async () => {
    await deleteProject(project.id)

    // update view
    removeProjectFromView(project)
  }, [project, removeProjectFromView])

  if (!project.trashed || !isOwner) return null

  return (
    <>
      {children(text, handleOpenModal)}
      <DeleteProjectModal
        projects={[project]}
        actionHandler={handleDeleteProject}
        showModal={showModal}
        handleCloseModal={handleCloseModal}
      />
    </>
  )
}

const DeleteProjectButtonTooltip = memo(function DeleteProjectButtonTooltip({
  project,
}: Pick<DeleteProjectButtonProps, 'project'>) {
  return (
    <DeleteProjectButton project={project}>
      {(text, handleOpenModal) => (
        <OLTooltip
          key={`tooltip-delete-project-${project.id}`}
          id={`delete-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <span>
            <OLIconButton
              onClick={handleOpenModal}
              variant="link"
              accessibilityLabel={text}
              className="action-btn"
              icon="block"
            />
          </span>
        </OLTooltip>
      )}
    </DeleteProjectButton>
  )
})

export default memo(DeleteProjectButton)
export { DeleteProjectButtonTooltip }
