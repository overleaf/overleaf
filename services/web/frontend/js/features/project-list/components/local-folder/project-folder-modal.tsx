import { FormEvent, memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import Notification from '@/shared/components/notification'
import MaterialIcon from '@/shared/components/material-icon'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useProjectListContext } from '../../context/project-list-context'
import { updateProjectLocalFolder } from '../../util/api'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import DirectoryBrowser from './directory-browser'

function sanitizePreviewName(name: string, id: string) {
  const cleaned = (name || '')
    .replace(/[\0-\x1f\x7f]/g, '')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim()
  return cleaned.slice(0, 120).trim() || `project_${id.slice(-6)}`
}

function ProjectFolderModal() {
  const {
    activeProjectForFolderModal: project,
    closeProjectFolderModal,
    localSyncSettings,
    updateProjectViewData,
  } = useProjectListContext()
  const themed = useFeatureFlag('themed-modals')

  const [mode, setMode] = useState<'default' | 'custom'>('default')
  const [customPath, setCustomPath] = useState('')
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [cleanOld, setCleanOld] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const baseDir =
    localSyncSettings?.baseDir || '/home/uzairserver/OverleafProjects'

  const defaultPreviewPath = useMemo(() => {
    if (!project) return ''
    return `${baseDir.replace(/\/+$/, '')}/${sanitizePreviewName(project.name, project.id)}`
  }, [baseDir, project])

  useEffect(() => {
    if (project) {
      const lf = project.localFolder
      const isCustom = Boolean(lf?.customPath)
      setMode(isCustom ? 'custom' : 'default')
      setCustomPath(lf?.customPath || defaultPreviewPath)
      setSyncEnabled(lf ? lf.syncEnabled !== false : true)
      setCleanOld(false)
      setShowBrowser(false)
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [project, defaultPreviewPath])

  const targetPreviewPath =
    mode === 'custom' ? customPath.trim() : defaultPreviewPath

  const previousSyncedPath =
    project?.localFolder?.lastSyncedPath ||
    project?.localFolder?.effectivePath ||
    null

  const pathWillChange =
    Boolean(previousSyncedPath) &&
    Boolean(targetPreviewPath) &&
    targetPreviewPath !== previousSyncedPath

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!project) return
      if (mode === 'custom' && !customPath.trim()) {
        setErrorMessage('Please enter or browse to a custom folder path.')
        return
      }

      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      try {
        const res = await updateProjectLocalFolder(project.id, {
          customFolderPath: mode === 'custom' ? customPath.trim() : null,
          syncEnabled,
          syncNow: syncEnabled,
          cleanOld: pathWillChange && cleanOld,
        })
        if (res.localFolder) {
          updateProjectViewData({
            ...project,
            localFolder: res.localFolder,
          })
        }
        const syncedFiles = res.syncResult?.syncedFilesCount
        setSuccessMessage(
          syncEnabled
            ? `Saved & synced${typeof syncedFiles === 'number' ? ` (${syncedFiles} file${syncedFiles === 1 ? '' : 's'})` : ''} to ${res.localFolder?.effectivePath || targetPreviewPath}.`
            : 'Saved folder settings (auto-sync paused for this project).'
        )
        setTimeout(() => {
          closeProjectFolderModal()
        }, 850)
      } catch (err) {
        setErrorMessage(String(getUserFacingMessage(err)))
      } finally {
        setIsSaving(false)
      }
    },
    [
      cleanOld,
      closeProjectFolderModal,
      customPath,
      mode,
      pathWillChange,
      project,
      syncEnabled,
      targetPreviewPath,
      updateProjectViewData,
    ]
  )

  if (!project) return null

  const lf = project.localFolder

  return (
    <OLModal
      animation
      show={Boolean(project)}
      onHide={closeProjectFolderModal}
      id="project-folder-location-modal"
      backdrop="static"
      themed={themed}
      size="lg"
      className="project-list-modal ol-local-folder-modal"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>
          <span className="ol-local-modal-title-row">
            <MaterialIcon type="folder_open" />
            <span>Project Folder Location</span>
          </span>
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <div className="ol-local-project-summary mb-3">
          <div className="ol-local-project-summary-name" translate="no">
            {project.name}
          </div>
          {lf && (
            <div className="ol-local-project-summary-meta">
              <span
                className={`ol-local-status-pill ol-local-status-${lf.status}`}
              >
                {lf.status === 'synced'
                  ? 'Synced'
                  : lf.status === 'error'
                    ? 'Sync Error'
                    : lf.status === 'disabled'
                      ? 'Paused'
                      : 'Not synced yet'}
              </span>
              {lf.lastSyncedAt && (
                <span>
                  Last synced: {new Date(lf.lastSyncedAt).toLocaleString()}
                </span>
              )}
              {typeof lf.fileCount === 'number' && (
                <span>
                  {lf.fileCount} file{lf.fileCount === 1 ? '' : 's'}
                  {lf.hasPdf ? ' (incl. PDF)' : ''}
                </span>
              )}
            </div>
          )}
          {lf?.error && (
            <div className="ol-local-inline-err mt-2">{lf.error}</div>
          )}
        </div>

        {errorMessage && (
          <div className="notification-list mb-3">
            <Notification type="error" content={errorMessage} />
          </div>
        )}

        {successMessage && (
          <div className="ol-local-success-alert mb-3" role="status">
            <MaterialIcon type="check_circle" />
            <span>{successMessage}</span>
          </div>
        )}

        <OLForm id="project-folder-form" onSubmit={handleSubmit}>
          <OLFormGroup className="mb-3">
            <OLFormLabel>Folder Mode</OLFormLabel>
            <div className="ol-local-radio-group">
              <OLFormCheckbox
                type="radio"
                id="project-folder-mode-default"
                name="projectFolderMode"
                label="Use default projects folder"
                description={defaultPreviewPath}
                checked={mode === 'default'}
                onChange={() => {
                  setMode('default')
                  setShowBrowser(false)
                }}
                disabled={isSaving}
              />
              <OLFormCheckbox
                type="radio"
                id="project-folder-mode-custom"
                name="projectFolderMode"
                label="Use a custom folder location for this project"
                description="Choose any dedicated folder under your home directory"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                disabled={isSaving}
              />
            </div>
          </OLFormGroup>

          {mode === 'custom' && (
            <OLFormGroup controlId="project-custom-folder-input" className="mb-3">
              <OLFormLabel>Custom Folder Path</OLFormLabel>
              <div className="ol-local-path-input-row">
                <OLFormControl
                  type="text"
                  required
                  className="ol-local-mono-input"
                  value={customPath}
                  onChange={e => setCustomPath(e.target.value)}
                  placeholder="/home/uzairserver/Documents/MyPaper"
                  disabled={isSaving}
                />
                <OLButton
                  variant="secondary"
                  type="button"
                  onClick={() => setShowBrowser(v => !v)}
                  disabled={isSaving}
                >
                  <MaterialIcon type="folder_open" />
                  <span>{showBrowser ? 'Hide Browser' : 'Browse'}</span>
                </OLButton>
              </div>
              <div className="ol-local-field-help">
                Enter an absolute path under{' '}
                <code>
                  {localSyncSettings?.allowedRoot || '/home/uzairserver'}
                </code>{' '}
                (or <code>~/...</code>). Non-existent subfolders are created
                automatically.
              </div>
              {showBrowser && (
                <div className="mt-2">
                  <DirectoryBrowser
                    currentPath={customPath || baseDir}
                    onSelectPath={p => setCustomPath(p)}
                    onClose={() => setShowBrowser(false)}
                  />
                </div>
              )}
            </OLFormGroup>
          )}

          <div className="ol-local-options-box">
            <OLFormCheckbox
              id="project-folder-sync-enabled"
              label="Automatically keep this project's files (.tex, .bib, assets, compiled PDF) synced to this folder"
              checked={syncEnabled}
              onChange={e => setSyncEnabled(e.target.checked)}
              disabled={isSaving}
            />
            {pathWillChange && syncEnabled && (
              <div className="mt-2">
                <OLFormCheckbox
                  id="project-folder-clean-old"
                  label="Remove Overleaf-synced files from the previous folder after verifying the new folder"
                  checked={cleanOld}
                  onChange={e => setCleanOld(e.target.checked)}
                  disabled={isSaving}
                />
                <div className="ol-local-field-help ms-4">
                  Previous folder: <code>{previousSyncedPath}</code>. Only
                  Overleaf-tracked files are cleaned up.
                </div>
              </div>
            )}
          </div>
        </OLForm>
      </OLModalBody>
      <OLModalFooter>
        <OLButton
          variant="secondary"
          onClick={closeProjectFolderModal}
          disabled={isSaving}
        >
          Cancel
        </OLButton>
        <OLButton
          variant="primary"
          type="submit"
          form="project-folder-form"
          disabled={isSaving || (mode === 'custom' && !customPath.trim())}
        >
          {isSaving
            ? 'Saving & Syncing...'
            : syncEnabled
              ? 'Save & Sync Now'
              : 'Save Settings'}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(ProjectFolderModal)
