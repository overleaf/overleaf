import { memo, useCallback, useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
import { Project } from '../../../../../../../types/project/dashboard/api'
import { useProjectListContext } from '../../context/project-list-context'

type ProjectFolderBadgeProps = {
  project: Project
}

function ProjectFolderBadge({ project }: ProjectFolderBadgeProps) {
  const { openProjectFolderModal } = useProjectListContext()
  const [copied, setCopied] = useState(false)

  const lf = project.localFolder
  if (!lf || project.trashed) return null

  const shortPath = lf.effectivePath.replace(/^\/home\/[^/]+/, '~')
  const statusLabel =
    lf.status === 'synced'
      ? `Synced${lf.fileCount != null ? ` (${lf.fileCount} files)` : ''}`
      : lf.status === 'error'
        ? `Sync error: ${lf.error || 'Unknown error'}`
        : lf.status === 'disabled'
          ? 'Local folder sync paused'
          : 'Not synced yet'

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard?.writeText(lf.effectivePath).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    },
    [lf.effectivePath]
  )

  return (
    <div className="ol-project-folder-row">
      <button
        type="button"
        className={`ol-project-folder-chip ol-project-folder-chip-${lf.status}`}
        onClick={() => openProjectFolderModal(project)}
        title={`${lf.effectivePath} — ${statusLabel} (click to customize folder location)`}
        aria-label={`Customize folder location for ${project.name}: ${lf.effectivePath}`}
      >
        <span
          className={`ol-project-folder-dot ol-project-folder-dot-${lf.status}`}
          aria-hidden="true"
        />
        <MaterialIcon type="folder_open" className="ol-project-folder-icon" />
        <span className="ol-project-folder-path" translate="no">
          {shortPath}
        </span>
        {lf.isCustom && (
          <span className="ol-project-folder-tag">Custom</span>
        )}
        {lf.hasPdf && <span className="ol-project-folder-tag-pdf">PDF</span>}
      </button>
      <button
        type="button"
        className="ol-local-copy-btn ol-project-folder-copy"
        onClick={handleCopy}
        title={copied ? 'Copied!' : `Copy path: ${lf.effectivePath}`}
        aria-label={`Copy folder path for ${project.name}`}
      >
        <MaterialIcon type={copied ? 'check' : 'content_copy'} />
      </button>
    </div>
  )
}

export default memo(ProjectFolderBadge)
