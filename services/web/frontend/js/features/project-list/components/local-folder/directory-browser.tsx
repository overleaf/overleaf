import { useCallback, useEffect, useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import {
  browseLocalDirectories,
  createLocalDirectory,
  BrowseDirectoriesResponse,
} from '../../util/api'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'

type DirectoryBrowserProps = {
  currentPath: string
  onSelectPath: (newPath: string) => void
  onClose?: () => void
}

export default function DirectoryBrowser({
  currentPath,
  onSelectPath,
  onClose,
}: DirectoryBrowserProps) {
  const [browseData, setBrowseData] =
    useState<BrowseDirectoriesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)

  const loadDir = useCallback(async (targetPath?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await browseLocalDirectories(targetPath)
      setBrowseData(data)
    } catch (err) {
      setError(String(getUserFacingMessage(err)))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDir(currentPath || undefined)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNavigate = useCallback(
    (dirPath: string) => {
      onSelectPath(dirPath)
      loadDir(dirPath)
    },
    [loadDir, onSelectPath]
  )

  const handleCreateFolder = useCallback(async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed || !browseData?.currentPath) return
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed === '..') {
      setError('Enter a single folder name without slashes.')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const fullNewPath = `${browseData.currentPath.replace(/\/+$/, '')}/${trimmed}`
      const res = await createLocalDirectory(fullNewPath)
      setNewFolderName('')
      setShowNewFolder(false)
      onSelectPath(res.normalizedPath)
      await loadDir(res.normalizedPath)
    } catch (err) {
      setError(String(getUserFacingMessage(err)))
    } finally {
      setCreating(false)
    }
  }, [browseData, loadDir, newFolderName, onSelectPath])

  return (
    <div className="ol-local-dir-browser" aria-label="Folder browser">
      <div className="ol-local-dir-browser-header">
        <div className="ol-local-dir-browser-nav">
          <OLButton
            variant="secondary"
            size="sm"
            type="button"
            disabled={loading || !browseData?.parentPath}
            onClick={() =>
              browseData?.parentPath && handleNavigate(browseData.parentPath)
            }
          >
            <MaterialIcon type="arrow_upward" />
            <span>Up</span>
          </OLButton>
          <span
            className="ol-local-dir-current"
            title={browseData?.currentPath || currentPath}
          >
            {browseData?.currentPath || currentPath || '...'}
          </span>
        </div>
        <div className="ol-local-dir-browser-actions">
          <OLButton
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => {
              setShowNewFolder(v => !v)
              setError(null)
            }}
          >
            <MaterialIcon type="create_new_folder" />
            <span>New Folder</span>
          </OLButton>
          {onClose && (
            <OLButton
              variant="link"
              size="sm"
              type="button"
              onClick={onClose}
              aria-label="Hide folder browser"
            >
              Hide
            </OLButton>
          )}
        </div>
      </div>

      {showNewFolder && (
        <div className="ol-local-dir-create-row">
          <OLFormControl
            type="text"
            size="sm"
            placeholder="New folder name (e.g. ResearchPapers)"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateFolder()
              }
            }}
            disabled={creating}
          />
          <OLButton
            variant="primary"
            size="sm"
            type="button"
            disabled={creating || !newFolderName.trim()}
            onClick={handleCreateFolder}
          >
            {creating ? 'Creating...' : 'Create'}
          </OLButton>
        </div>
      )}

      {error && (
        <div className="ol-local-dir-error" role="alert">
          {error}
        </div>
      )}

      <div className="ol-local-dir-list" role="list">
        {loading ? (
          <div className="ol-local-dir-empty">
            <OLSpinner size="sm" /> <span>Loading folders...</span>
          </div>
        ) : browseData && browseData.directories.length > 0 ? (
          browseData.directories.map(dir => (
            <button
              key={dir.path}
              type="button"
              role="listitem"
              className="ol-local-dir-item"
              onClick={() => handleNavigate(dir.path)}
              title={dir.path}
            >
              <MaterialIcon type="folder" className="ol-local-dir-item-icon" />
              <span className="ol-local-dir-item-name">{dir.name}</span>
              <MaterialIcon
                type="chevron_right"
                className="ol-local-dir-item-chevron"
              />
            </button>
          ))
        ) : (
          <div className="ol-local-dir-empty">
            No subfolders inside this directory. Click &ldquo;New Folder&rdquo;
            to create one or use this folder directly.
          </div>
        )}
      </div>

      {browseData?.currentPath &&
        browseData.currentPath !== browseData.allowedRoot && (
          <div className="ol-local-dir-footer">
            <span className="ol-local-dir-hint">
              Selected: <code>{browseData.currentPath}</code>
            </span>
          </div>
        )}
    </div>
  )
}
