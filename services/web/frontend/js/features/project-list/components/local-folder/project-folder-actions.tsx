import { memo, useCallback, useState } from 'react'
import { Project } from '../../../../../../../types/project/dashboard/api'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import { useProjectListContext } from '../../context/project-list-context'
import { syncProjectToLocalFolder } from '../../util/api'

type CustomizeFolderButtonProps = {
  project: Project
  children: (text: string, openModal: () => void) => React.ReactElement
}

export function CustomizeFolderButton({
  project,
  children,
}: CustomizeFolderButtonProps) {
  const { openProjectFolderModal } = useProjectListContext()
  const handleOpen = useCallback(() => {
    openProjectFolderModal(project)
  }, [openProjectFolderModal, project])

  if (project.trashed) return null
  return children('Folder location', handleOpen)
}

export const CustomizeFolderButtonTooltip = memo(
  function CustomizeFolderButtonTooltip({ project }: { project: Project }) {
    if (project.trashed) return null
    return (
      <CustomizeFolderButton project={project}>
        {(text, handleOpen) => (
          <OLTooltip
            key={`tooltip-folder-location-${project.id}`}
            id={`folder-location-${project.id}`}
            description="Customize local folder location"
            overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
          >
            <span>
              <OLIconButton
                onClick={handleOpen}
                variant="link"
                accessibilityLabel={`${text} for ${project.name}`}
                className="action-btn"
                icon="folder_open"
              />
            </span>
          </OLTooltip>
        )}
      </CustomizeFolderButton>
    )
  }
)

type SyncProjectButtonProps = {
  project: Project
  children: (
    text: string,
    isSyncing: boolean,
    handleSync: () => void
  ) => React.ReactElement
}

export function SyncProjectButton({
  project,
  children,
}: SyncProjectButtonProps) {
  const { updateProjectViewData } = useProjectListContext()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = useCallback(async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      const res = await syncProjectToLocalFolder(project.id)
      if (res.localFolder) {
        updateProjectViewData({
          ...project,
          localFolder: res.localFolder,
        })
      }
    } catch (err: any) {
      if (err?.data?.localFolder) {
        updateProjectViewData({
          ...project,
          localFolder: err.data.localFolder,
        })
      }
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, project, updateProjectViewData])

  if (project.trashed) return null
  return children(
    isSyncing ? 'Syncing...' : 'Sync to local folder',
    isSyncing,
    handleSync
  )
}

export const SyncProjectButtonTooltip = memo(function SyncProjectButtonTooltip({
  project,
}: {
  project: Project
}) {
  if (project.trashed) return null
  return (
    <SyncProjectButton project={project}>
      {(text, isSyncing, handleSync) => (
        <OLTooltip
          key={`tooltip-sync-local-project-${project.id}`}
          id={`sync-local-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <span>
            <OLIconButton
              onClick={handleSync}
              variant="link"
              accessibilityLabel={`${text}: ${project.name}`}
              loadingLabel={text}
              isLoading={isSyncing}
              className="action-btn"
              icon="sync"
            />
          </span>
        </OLTooltip>
      )}
    </SyncProjectButton>
  )
})
