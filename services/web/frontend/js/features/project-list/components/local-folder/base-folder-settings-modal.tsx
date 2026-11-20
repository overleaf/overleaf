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
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useProjectListContext } from '../../context/project-list-context'
import { updateLocalSyncBaseDir } from '../../util/api'
import { getUserFacingMessage } from '../../../../infrastructure/fetch-json'
import DirectoryBrowser from './directory-browser'
import {
  DEFAULT_LOCAL_ALLOWED_ROOT,
  DEFAULT_LOCAL_BASE_DIR,
  formatLocalDisplayPath,
} from './path-display'

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

  const allowedRoot =
    localSyncSettings?.allowedRoot || DEFAULT_LOCAL_ALLOWED_ROOT
  const fallbackBaseDir =
    localSyncSettings?.defaultBaseDir ||
    `${allowedRoot.replace(/\/+$/, '')}/OverleafProjects` ||
    DEFAULT_LOCAL_BASE_DIR

  useEffect(() => {
    if (showBaseFolderModal) {
      setBaseDir(localSyncSettings?.baseDir || fallbackBaseDir)
      setSyncAll(true)
      setCleanOld(false)
      setShowBrowser(false)
      setErrorMessage(null)
    }
  }, [showBaseFolderModal, localSyncSettings?.baseDir, fallbackBaseDir])

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
            `Saved folder location, but ${res.failedCount} project(s) failed to copy.`
          )
        } else {
          closeBaseFolderModal()
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
    fallbackBaseDir,
    `${allowedRoot.replace(/\/+$/, '')}/Papers`,
  ]

  return (
    <OLModal
      animation
      show={showBaseFolderModal}
      onHide={closeBaseFolderModal}
      id="base-folder-settings-modal"
      backdrop="static"
      themed={themed}
      className="project-list-modal ol-local-folder-modal"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>Local folder location</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {localSyncSettings && !localSyncSettings.serviceHealthy && (
          <div className="notification-list mb-3">
            <Notification
              type="error"
              content="Local folder sync service is unavailable. Restart Overleaf to restore syncing."
            />
          </div>
        )}

        {errorMessage && (
          <div className="notification-list mb-3">
            <Notification type="error" content={errorMessage} />
          </div>
        )}

        <OLForm id="base-folder-settings-form" onSubmit={handleSubmit}>
          <OLFormGroup controlId="base-folder-path-input" className="mb-3">
            <OLFormLabel>Default folder for projects</OLFormLabel>
            <div className="ol-local-path-input-row">
              <OLFormControl
                type="text"
                required
                className="ol-local-mono-input"
                value={baseDir}
                onChange={e => setBaseDir(e.target.value)}
                placeholder={fallbackBaseDir}
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
              Files (<code>.tex</code>, <code>.bib</code>, images, and{' '}
              <code>.pdf</code>) are kept readable under{' '}
              <code>{allowedRoot}</code>.
            </div>
          </OLFormGroup>

          <div className="ol-local-presets mb-3">
            <span className="ol-local-presets-label">Presets:</span>
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
                {formatLocalDisplayPath(preset, allowedRoot)}
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

          <OLFormCheckbox
            id="base-folder-sync-all"
            label="Update existing projects in this folder now"
            checked={syncAll}
            onChange={e => setSyncAll(e.target.checked)}
            disabled={isSaving}
          />
          {pathChanged && (
            <div className="mt-2">
              <OLFormCheckbox
                id="base-folder-clean-old"
                label="Remove Overleaf-managed copies from the previous folder"
                checked={cleanOld}
                onChange={e => setCleanOld(e.target.checked)}
                disabled={isSaving || !syncAll}
              />
            </div>
          )}
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
          isLoading={isSaving}
          loadingLabel="Saving..."
          disabled={isSaving || !baseDir.trim()}
        >
          Save
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(BaseFolderSettingsModal)
