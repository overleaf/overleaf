import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ProjectsActionModal from './projects-action-modal'
import ProjectsList from './projects-list'
import Notification from '@/shared/components/notification'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import { unlinkWebDAV } from '../../util/api'
import { Project } from '../../../../../../types/project/dashboard/api'

type DeleteProjectModalProps = Pick<
  React.ComponentProps<typeof ProjectsActionModal>,
  'projects' | 'actionHandler' | 'showModal' | 'handleCloseModal'
>

function DeleteProjectModal({
  projects,
  actionHandler,
  showModal,
  handleCloseModal,
}: DeleteProjectModalProps) {
  const { t } = useTranslation()
  const [projectsToDisplay, setProjectsToDisplay] = useState<typeof projects>(
    []
  )
  const [keepCloudStorage, setKeepCloudStorage] = useState(true)

  // Check if any project has WebDAV enabled
  const hasWebDAVProject = projects.some(
    project => project.webdavConfig?.enabled
  )

  useEffect(() => {
    if (showModal) {
      setProjectsToDisplay(displayProjects => {
        return displayProjects.length ? displayProjects : projects
      })
    } else {
      setProjectsToDisplay([])
      // Reset keepCloudStorage when modal closes, so it's true next time it opens
      setKeepCloudStorage(true)
    }
  }, [showModal, projects])

  const handleAction = async (project: Project) => {
    if (project.webdavConfig?.enabled) {
      // Unlink WebDAV first, deleting remote content if user didn't choose to keep it
      await unlinkWebDAV(project.id, !keepCloudStorage)
    }
    // Then delete the project
    await actionHandler(project)
  }

  return (
    <ProjectsActionModal
      action="delete"
      actionHandler={handleAction}
      title={t('delete_projects')}
      showModal={showModal}
      handleCloseModal={handleCloseModal}
      projects={projects}
    >
      <p>{t('about_to_delete_projects')}</p>
      <ProjectsList projects={projects} projectsToDisplay={projectsToDisplay} />
      {hasWebDAVProject && (
        <div className="mb-3">
          <OLFormCheckbox
            label={t('keep_cloud_storage_content')}
            checked={keepCloudStorage}
            onChange={e => setKeepCloudStorage(e.target.checked)}
          />
        </div>
      )}
      <Notification
        content={t('this_action_cannot_be_undone')}
        type="warning"
      />
    </ProjectsActionModal>
  )
}

export default DeleteProjectModal
