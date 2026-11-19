import { memo, useCallback, useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useProjectListContext } from '../../context/project-list-context'
import { syncAllLocalProjects } from '../../util/api'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'

function LocalFolderBanner() {
  const {
    localSyncSettings,
    openBaseFolderModal,
    refreshProjectsList,
    visibleProjects,
    totalProjectsCount,
  } = useProjectListContext()

  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const baseDir = localSyncSettings?.baseDir || '/home/uzairserver/OverleafProjects'
  const displayBaseDir = baseDir.replace(/^\/home\/[^/]+/, '~')

  const syncedCount = visibleProjects.filter(
    p => p.localFolder?.status === 'synced'
  ).length
  const errorCount = visibleProjects.filter(
    p => p.localFolder?.status === 'error'
  ).length

  const handleCopyPath = useCallback(() => {
    if (!baseDir) return
    navigator.clipboard?.writeText(baseDir).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }, [baseDir])

  const handleSyncAll = useCallback(async () => {
    setIsSyncingAll(true)
    setFeedback(null)
    try {
      const res = await syncAllLocalProjects()
      await refreshProjectsList()
      if (res.failedCount > 0) {
        setFeedback({
          type: 'error',
          text: `Synced ${res.syncedCount}, ${res.failedCount} failed.`,
        })
      } else {
        setFeedback({
          type: 'success',
          text:
            res.syncedCount === 0
              ? 'No active projects to sync.'
              : `Synced ${res.syncedCount} project${res.syncedCount === 1 ? '' : 's'} to disk.`,
        })
      }
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      setFeedback({
        type: 'error',
        text: String(getUserFacingMessage(err)),
      })
    } finally {
      setIsSyncingAll(false)
    }
  }, [refreshProjectsList])

  return (
    <section
      className="ol-local-folder-banner"
      aria-label="Local projects folder location"
    >
      <div className="ol-local-folder-banner-left">
        <div className="ol-local-folder-banner-icon" aria-hidden="true">
          <MaterialIcon type="folder_open" />
        </div>
        <div className="ol-local-folder-banner-info">
          <div className="ol-local-folder-banner-title-row">
            <span className="ol-local-folder-banner-label">
              Projects Folder Location
            </span>
            {totalProjectsCount > 0 && (
              <span
                className={`ol-local-status-pill ${
                  errorCount > 0
                    ? 'ol-local-status-error'
                    : syncedCount > 0
                      ? 'ol-local-status-synced'
                      : 'ol-local-status-not_synced'
                }`}
              >
                {errorCount > 0
                  ? `${errorCount} error`
                  : `${syncedCount}/${visibleProjects.length} synced`}
              </span>
            )}
            {feedback && (
              <span
                role="status"
                className={`ol-local-banner-feedback ol-local-banner-feedback-${feedback.type}`}
              >
                {feedback.text}
              </span>
            )}
          </div>
          <div className="ol-local-folder-banner-path-row">
            <code
              className="ol-local-folder-path-code"
              title={baseDir}
              translate="no"
            >
              {displayBaseDir}
            </code>
            <button
              type="button"
              className="ol-local-copy-btn"
              onClick={handleCopyPath}
              title={copied ? 'Copied!' : `Copy full path (${baseDir})`}
              aria-label={`Copy full path ${baseDir}`}
            >
              <MaterialIcon type={copied ? 'check' : 'content_copy'} />
            </button>
          </div>
        </div>
      </div>

      <div className="ol-local-folder-banner-actions">
        {totalProjectsCount > 0 && (
          <OLButton
            variant="secondary"
            size="sm"
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            data-testid="sync-all-local-projects-btn"
          >
            <MaterialIcon
              type="sync"
              className={isSyncingAll ? 'ol-local-spin' : undefined}
            />
            <span>{isSyncingAll ? 'Syncing...' : 'Sync All'}</span>
          </OLButton>
        )}
        <OLButton
          variant="secondary"
          size="sm"
          type="button"
          onClick={openBaseFolderModal}
          data-testid="change-base-folder-btn"
        >
          <MaterialIcon type="edit" />
          <span>Change Folder</span>
        </OLButton>
      </div>
    </section>
  )
}

export default memo(LocalFolderBanner)
