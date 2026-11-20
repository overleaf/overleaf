import { memo } from 'react'
import classNames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import { Project } from '../../../../../../types/project/dashboard/api'
import { useProjectListContext } from '../../context/project-list-context'
import { formatLocalDisplayPath } from './path-display'

type ProjectFolderBadgeProps = {
  project: Project
}

function getFolderLeafName(dirPath: string) {
  const parts = dirPath.replace(/\/+$/, '').split('/').filter(Boolean)
  return parts[parts.length - 1] || dirPath
}

function ProjectFolderBadge({ project }: ProjectFolderBadgeProps) {
  const { openProjectFolderModal, localSyncSettings } = useProjectListContext()

  const lf = project.localFolder
  if (!lf || project.trashed) return null

  const isError = lf.status === 'error'
  const isDisabled = lf.status === 'disabled'
  const shouldShowInlineBadge = lf.isCustom || isError || isDisabled

  if (!shouldShowInlineBadge) return null

  const shortPath = formatLocalDisplayPath(
    lf.effectivePath,
    localSyncSettings?.allowedRoot
  )
  const badgeText = isError
    ? 'Sync error'
    : isDisabled
      ? 'Sync paused'
      : getFolderLeafName(lf.effectivePath)

  const titleText = isError
    ? `${shortPath} (Sync error: ${lf.error || 'Unknown error'})`
    : isDisabled
      ? `${shortPath} (Local folder sync paused)`
      : `Custom local folder: ${shortPath}`

  return (
    <span className="d-none d-md-inline">
      <span
        className={classNames(
          'badge bg-light badge-tag badge-themed ms-2 ol-project-folder-tag-pill',
          { 'is-error': isError }
        )}
      >
        <button
          type="button"
          className="badge-tag-content badge-tag-content-btn"
          onClick={() => openProjectFolderModal(project)}
          title={titleText}
          aria-label={`${titleText} (customize local folder for ${project.name})`}
        >
          <MaterialIcon
            type={isError ? 'error_outline' : 'folder_open'}
            aria-hidden="true"
          />
          <span className="badge-content" translate="no">
            {badgeText}
          </span>
        </button>
      </span>
    </span>
  )
}

export default memo(ProjectFolderBadge)
