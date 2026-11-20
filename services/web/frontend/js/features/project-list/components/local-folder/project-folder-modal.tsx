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
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { ProjectLocalFolderInfo } from '../../../../../../../types/project/dashboard/api'
import { useProjectListContext } from '../../context/project-list-context'
import {
  syncProjectToLocalFolder,
  updateProjectLocalFolder,
} from '../../util/api'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import DirectoryBrowser from './directory-browser'
import {
  DEFAULT_LOCAL_ALLOWED_ROOT,
  DEFAULT_LOCAL_BASE_DIR,
  formatLocalDisplayPath,
  sanitizePreviewName,
} from './path-display'

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
  const [isSyncingNow, setIsSyncingNow] = useState(false)
  const [copiedPath, setCopiedPath] = useState(false)
  const [liveLocalFolder, setLiveLocalFolder] = useState<
    ProjectLocalFolderInfo | undefined
  >(project?.localFolder)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const allowedRoot =
    localSyncSettings?.allowedRoot || DEFAULT_LOCAL_ALLOWED_ROOT
  const baseDir =
    localSyncSettings?.baseDir ||
    localSyncSettings?.defaultBaseDir ||
    DEFAULT_LOCAL_BASE_DIR

  const defaultPreviewPath = useMemo(() => {
    if (!project) return ''
    return `${baseDir.replace(/\/+$/, '')}/${sanitizePreviewName(project.name, project.id)}`
  }, [baseDir, project])

  useEffect(() => {
    if (project) {
      const lf = project.localFolder
      setLiveLocalFolder(lf)
      const isCustom = Boolean(lf?.customPath)
      setMode(isCustom ? 'custom' : 'default')
      setCustomPath(lf?.customPath || defaultPreviewPath)
      setSyncEnabled(lf ? lf.syncEnabled !== false : true)
      setCleanOld(false)
      setShowBrowser(false)
      setCopiedPath(false)
      setErrorMessage(lf?.error || null)
      setSyncMessage(null)
    }
  }, [project, defaultPreviewPath])

  const targetPreviewPath =
    mode === 'custom' ? customPath.trim() : defaultPreviewPath

  const previousSyncedPath =
    liveLocalFolder?.lastSyncedPath || liveLocalFolder?.effectivePath || null

  const pathWillChange =
    Boolean(previousSyncedPath) &&
    Boolean(targetPreviewPath) &&
    targetPreviewPath !== previousSyncedPath

  const currentEffectivePath =
    liveLocalFolder?.effectivePath || defaultPreviewPath

  const handleCopyCurrentPath = useCallback(() => {
    const pathToCopy = currentEffectivePath
    if (!pathToCopy) return
    navigator.clipboard
      ?.writeText(pathToCopy)
      .then(() => {
        setCopiedPath(true)
        setTimeout(() => setCopiedPath(false), 1600)
      })
      .catch(() => {})
  }, [currentEffectivePath])

  const handleSyncNow = useCallback(async () => {
    if (!project || isSyncingNow || isSaving) return
    setIsSyncingNow(true)
    setErrorMessage(null)
    setSyncMessage(null)
    try {
      const res = await syncProjectToLocalFolder(project.id)
      if (res.localFolder) {
        setLiveLocalFolder(res.localFolder)
        updateProjectViewData({
          ...project,
          localFolder: res.localFolder,
        })
      }
      setSyncMessage('Folder updated.')
    } catch (err: any) {
      if (err?.data?.localFolder) {
        setLiveLocalFolder(err.data.localFolder)
        updateProjectViewData({
          ...project,
          localFolder: err.data.localFolder,
        })
      }
      setErrorMessage(String(getUserFacingMessage(err)))
    } finally {
      setIsSyncingNow(false)
    }
  }, [isSaving, isSyncingNow, project, updateProjectViewData])

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
      setSyncMessage(null)
      try {
        const res = await updateProjectLocalFolder(project.id, {
          customFolderPath: mode === 'custom' ? customPath.trim() : null,
          syncEnabled,
          syncNow: syncEnabled,
          cleanOld: pathWillChange && cleanOld,
        })
        if (res.localFolder) {
          setLiveLocalFolder(res.localFolder)
          updateProjectViewData({
            ...project,
            localFolder: res.localFolder,
          })
        }
        closeProjectFolderModal()
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
      updateProjectViewData,
    ]
  )

  if (!project) return null

  return (
    <OLModal
      animation
      show={Boolean(project)}
      onHide={closeProjectFolderModal}
      id="project-folder-location-modal"
      backdrop="static"
      themed={themed}
      className="project-list-modal ol-local-folder-modal"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>Folder location</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {errorMessage && (
          <div className="notification-list mb-3">
            <Notification type="error" content={errorMessage} />
          </div>
        )}

        {syncMessage && (
          <div className="notification-list mb-3">
            <Notification type="success" content={syncMessage} />
          </div>
        )}

        <OLForm id="project-folder-form" onSubmit={handleSubmit}>
          <OLFormGroup className="mb-3">
            <OLFormLabel>Current location for {project.name}</OLFormLabel>
            <div className="ol-local-current-path-row">
              <code
                className="ol-local-folder-path-code"
                title={currentEffectivePath}
                translate="no"
              >
                {formatLocalDisplayPath(currentEffectivePath, allowedRoot)}
              </code>
              <div className="ol-local-current-path-actions">
                <OLButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={handleCopyCurrentPath}
                >
                  {copiedPath ? 'Copied' : 'Copy'}
                </OLButton>
                <OLButton
                  variant="secondary"
                  size="sm"
                  type="button"
                  isLoading={isSyncingNow}
                  loadingLabel="Syncing..."
                  disabled={isSaving}
                  onClick={handleSyncNow}
                >
                  Sync
                </OLButton>
              </div>
            </div>
          </OLFormGroup>

          <OLFormGroup className="mb-3">
            <OLFormLabel>Save project in</OLFormLabel>
            <div className="ol-local-radio-group">
              <OLFormCheckbox
                type="radio"
                id="project-folder-mode-default"
                name="projectFolderMode"
                label="Default folder"
                description={formatLocalDisplayPath(
                  defaultPreviewPath,
                  allowedRoot
                )}
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
                label="Custom folder"
                description="Choose a dedicated folder for this project"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                disabled={isSaving}
              />
            </div>
          </OLFormGroup>

          {mode === 'custom' && (
            <OLFormGroup controlId="project-custom-folder-input" className="mb-3">
              <OLFormLabel>Custom folder path</OLFormLabel>
              <div className="ol-local-path-input-row">
                <OLFormControl
                  type="text"
                  required
                  className="ol-local-mono-input"
                  value={customPath}
                  onChange={e => setCustomPath(e.target.value)}
                  placeholder={`${allowedRoot.replace(/\/+$/, '')}/MyPaper`}
                  disabled={isSaving}
                />
                <OLButton
                  variant="secondary"
                  type="button"
                  onClick={() => setShowBrowser(v => !v)}
                  disabled={isSaving}
                >
                  {showBrowser ? 'Hide' : 'Browse'}
                </OLButton>
              </div>
              <div className="ol-local-field-help">
                Inside <code>{allowedRoot}</code>. Missing subfolders are created
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

          <OLFormCheckbox
            id="project-folder-sync-enabled"
            label="Keep local files updated automatically"
            checked={syncEnabled}
            onChange={e => setSyncEnabled(e.target.checked)}
            disabled={isSaving}
          />
          {pathWillChange && syncEnabled && (
            <div className="mt-2">
              <OLFormCheckbox
                id="project-folder-clean-old"
                label="Remove Overleaf-managed copies from the previous folder"
                checked={cleanOld}
                onChange={e => setCleanOld(e.target.checked)}
                disabled={isSaving}
              />
            </div>
          )}
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
          isLoading={isSaving}
          loadingLabel="Saving..."
          disabled={isSaving || (mode === 'custom' && !customPath.trim())}
        >
          Save
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(ProjectFolderModal)
