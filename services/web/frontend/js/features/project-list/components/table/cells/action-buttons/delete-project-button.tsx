import { useTranslation } from 'react-i18next'
import { memo, useCallback, useMemo, useState } from 'react'
import { Project } from '../../../../../../../../types/project/dashboard/api'
import Icon from '../../../../../../shared/components/icon'
import Tooltip from '../../../../../../shared/components/tooltip'
import ProjectsActionModal from '../../projects-action-modal'
import useIsMounted from '../../../../../../shared/hooks/use-is-mounted'
import { deleteProject } from '../../../../util/api'
import { useProjectListContext } from '../../../../context/project-list-context'

type DeleteProjectButtonProps = {
  project: Project
}

function DeleteProjectButton({ project }: DeleteProjectButtonProps) {
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
    return project.owner && window.user_id === project.owner.id
  }, [project])

  const handleDeleteProject = useCallback(async () => {
    await deleteProject(project.id)

    // update view
    removeProjectFromView(project)
  }, [project, removeProjectFromView])

  if (!project.trashed || !isOwner) return null

  return (
    <>
      <Tooltip
        key={`tooltip-delete-project-${project.id}`}
        id={`tooltip-delete-project-${project.id}`}
        description={text}
        overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
      >
        <button
          className="btn btn-link action-btn"
          aria-label={text}
          onClick={handleOpenModal}
        >
          <Icon type="ban" />
        </button>
      </Tooltip>

      <ProjectsActionModal
        title={t('delete_projects')}
        action="delete"
        actionHandler={handleDeleteProject}
        bodyTop={<p>{t('about_to_delete_projects')}</p>}
        bodyBottom={
          <div className="project-action-alert alert alert-warning">
            <Icon type="exclamation-triangle" fw />{' '}
            {t('this_action_cannot_be_undone')}
          </div>
        }
        showModal={showModal}
        handleCloseModal={handleCloseModal}
        projects={[project]}
      />
    </>
  )
}

export default memo(DeleteProjectButton)
