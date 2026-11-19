import { FormEvent, memo, useCallback, useEffect, useState } from 'react'
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
import { updateLocalSyncBaseDir } from '../../util/api'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import DirectoryBrowser from './directory-browser'

function BaseFolderSettingsModal() {
  const {
    showBaseFolderModal,
    closeBaseFolderModal,
    localSyncSettings,
    setLocalSyncSettings,
    refreshProjectsList,
  } = useProjectListContext()
  const themed = useFeatureFlag('themed-modals')

  const [baseDir, setBaseDir] = useState('')
  const [syncAll, setSyncAll] = useState(true)
  const [cleanOld, setCleanOld] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (showBaseFolderModal) {
      setBaseDir(
        localSyncSettings?.baseDir || '/home/uzairserver/OverleafProjects'
      )
      setSyncAll(true)
      setCleanOld(false)
      setShowBrowser(false)
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [showBaseFolderModal, localSyncSettings?.baseDir])

  const pathChanged =
    Boolean(localSyncSettings?.baseDir) &&
    baseDir.trim() !== localSyncSettings?.baseDir

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      const trimmed = baseDir.trim()
      if (!trimmed) return

      setIsSaving(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      try {
        const res = await updateLocalSyncBaseDir({
          baseDir: trimmed,
          syncAll,
          cleanOld: pathChanged && cleanOld,
        })
        if (res.settings) {
          setLocalSyncSettings(res.settings)
        }
        await refreshProjectsList()
        if (res.failedCount > 0) {
          setErrorMessage(
            `Saved folder location, but ${res.failedCount} project(s) failed to sync (${res.syncedCount} synced).`
          )
        } else {
          setSuccessMessage(
            syncAll
              ? `Default folder updated to ${res.settings?.baseDir || trimmed} (${res.syncedCount} project${res.syncedCount === 1 ? '' : 's'} synced).`
              : `Default folder updated to ${res.settings?.baseDir || trimmed}.`
          )
          setTimeout(() => {
            closeBaseFolderModal()
          }, 900)
        }
      } catch (err) {
        setErrorMessage(String(getUserFacingMessage(err)))
      } finally {
        setIsSaving(false)
      }
    },
    [
      baseDir,
      cleanOld,
      closeBaseFolderModal,
      pathChanged,
      refreshProjectsList,
      setLocalSyncSettings,
      syncAll,
    ]
  )

  const presets = localSyncSettings?.presets || [
    '/home/uzairserver/OverleafProjects',
    '/home/uzairserver/Documents/Overleaf',
    '/home/uzairserver/Desktop/Overleaf',
  ]

  return (
    <OLModal
      animation
      show={showBaseFolderModal}
      onHide={closeBaseFolderModal}
      id="base-folder-settings-modal"
      backdrop="static"
      themed={themed}
      size="lg"
      className="project-list-modal ol-local-folder-modal"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>
          <span className="ol-local-modal-title-row">
            <MaterialIcon type="folder_open" />
            <span>Projects Folder Location</span>
          </span>
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p className="ol-local-modal-intro">
          Choose where Overleaf saves readable copies of your listed projects (
          <code>.tex</code>, <code>.bib</code>, figures, and compiled{' '}
          <code>.pdf</code> files). Projects without a custom override are
          automatically saved in a subfolder here, while Overleaf&apos;s
          internal database remains safely intact.
        </p>

        {localSyncSettings && !localSyncSettings.serviceHealthy && (
          <div className="notification-list mb-3">
            <Notification
              type="error"
              content="Local folder sync helper is currently unreachable. Restart Overleaf to restore syncing."
            />
          </div>
        )}

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

        <OLForm id="base-folder-settings-form" onSubmit={handleSubmit}>
          <OLFormGroup controlId="base-folder-path-input" className="mb-3">
            <OLFormLabel>Default Projects Base Folder</OLFormLabel>
            <div className="ol-local-path-input-row">
              <OLFormControl
                type="text"
                required
                className="ol-local-mono-input"
                value={baseDir}
                onChange={e => setBaseDir(e.target.value)}
                placeholder="/home/uzairserver/OverleafProjects"
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
              Must be a subfolder under{' '}
              <code>
                {localSyncSettings?.allowedRoot || '/home/uzairserver'}
              </code>{' '}
              (you can also use <code>~/...</code>). You can override any
              individual project&apos;s folder from the projects table.
            </div>
          </OLFormGroup>

          <div className="ol-local-presets mb-3">
            <span className="ol-local-presets-label">Quick locations:</span>
            {presets.map(preset => (
              <button
                key={preset}
                type="button"
                className={`ol-local-preset-chip ${
                  baseDir.trim() === preset ? 'active' : ''
                }`}
                onClick={() => setBaseDir(preset)}
                disabled={isSaving}
              >
                {preset.replace(/^\/home\/[^/]+/, '~')}
              </button>
            ))}
          </div>

          {showBrowser && (
            <div className="mb-3">
              <DirectoryBrowser
                currentPath={baseDir}
                onSelectPath={p => setBaseDir(p)}
                onClose={() => setShowBrowser(false)}
              />
            </div>
          )}

          <div className="ol-local-options-box">
            <OLFormCheckbox
              id="base-folder-sync-all"
              label="Sync all default-location projects to this folder now"
              checked={syncAll}
              onChange={e => setSyncAll(e.target.checked)}
              disabled={isSaving}
            />
            {pathChanged && (
              <div className="mt-2">
                <OLFormCheckbox
                  id="base-folder-clean-old"
                  label="Clean up old Overleaf-synced files from the previous default folder after verifying the new copy"
                  checked={cleanOld}
                  onChange={e => setCleanOld(e.target.checked)}
                  disabled={isSaving || !syncAll}
                />
                <div className="ol-local-field-help ms-4">
                  Safe cleanup: only removes files tracked in{' '}
                  <code>.overleaf-sync.json</code>; any personal files you added
                  are never deleted.
                </div>
              </div>
            )}
          </div>
        </OLForm>
      </OLModalBody>
      <OLModalFooter>
        <OLButton
          variant="secondary"
          onClick={closeBaseFolderModal}
          disabled={isSaving}
        >
          Cancel
        </OLButton>
        <OLButton
          variant="primary"
          type="submit"
          form="base-folder-settings-form"
          disabled={isSaving || !baseDir.trim()}
        >
          {isSaving ? 'Saving & Syncing...' : 'Save Folder Location'}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(BaseFolderSettingsModal)
