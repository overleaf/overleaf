import { Trans, useTranslation } from 'react-i18next'
import { memo, useCallback, useEffect, useState } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import DiffViewer from './diff-viewer'
import getMeta from '@/utils/meta'
import { uploadBatch } from '@/infrastructure/batch-file-uploader'
import { debugConsole } from '@/utils/debugging'
import Notification from '@/shared/components/notification'
import { downloadFileContent } from '@/utils/download-file'
import { useLocation } from '@/shared/hooks/use-location'
import { sendMB } from '@/infrastructure/event-tracking'

export type UnableToSyncModalProps = {
  baseContent: string
  targetContent: string
  docName: string | null
  rootFolderId: string | undefined
  show: boolean
  onHide: () => void
  reloadAfterClose?: boolean
}

// Generates the offline copy filename with a timestamp to avoid duplicates.
// e.g. main.tex -> main(offline-2026-07-27-14-07).tex
function buildOfflineFilename(docName: string | null): string {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('-')
  const suffix = `(offline-${stamp})`
  if (!docName) {
    return `main${suffix}.tex`
  }
  const lastDot = docName.lastIndexOf('.')
  if (lastDot === -1) {
    return `${docName}${suffix}`
  }
  return `${docName.slice(0, lastDot)}${suffix}${docName.slice(lastDot)}`
}

function UnableToSyncModal({
  baseContent,
  targetContent,
  docName,
  rootFolderId,
  show,
  onHide: onHideProp,
  reloadAfterClose = false,
}: UnableToSyncModalProps) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const location = useLocation()

  useEffect(() => {
    if (show) {
      sendMB('unable-to-sync-modal-shown')
    }
  }, [show])

  const onHide = useCallback(() => {
    onHideProp()
    if (reloadAfterClose) {
      location.reload()
    }
  }, [onHideProp, reloadAfterClose, location])

  const handleDiscardChanges = useCallback(() => {
    sendMB('unable-to-sync-modal-click', { action: 'discard-changes' })
    onHide()
  }, [onHide])

  const handleDownload = useCallback(() => {
    sendMB('unable-to-sync-modal-click', { action: 'download' })
    downloadFileContent(targetContent, docName || 'document.txt')
  }, [targetContent, docName])

  const handleSaveAsNewFile = useCallback(async () => {
    sendMB('unable-to-sync-modal-click', { action: 'save-new-file' })
    const projectId = getMeta('ol-project_id')
    const filename = buildOfflineFilename(docName)

    setSaving(true)
    setSaveError(false)
    try {
      if (!rootFolderId) {
        throw new Error('rootFolderId not available')
      }
      const [result] = await uploadBatch(
        [
          {
            file: new Blob([targetContent], { type: 'text/plain' }),
            name: filename,
          },
        ],
        { projectId, folderId: rootFolderId }
      )
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      onHide()
    } catch (error) {
      debugConsole.error('Failed to save offline changes as new file', error)
      sendMB('unable-to-sync-modal-error-shown')
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }, [docName, targetContent, rootFolderId, onHide])

  return (
    <OLModal
      show={show}
      onHide={onHide}
      className="unable-to-sync-modal"
      backdrop="static"
      keyboard={false}
      centered
    >
      <OLModalHeader closeButton={false}>
        <OLModalTitle>{t('your_offline_edits_couldnt_be_synced')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>{t('offline_edits_couldnt_combine')}</p>
        <DiffViewer baseContent={baseContent} targetContent={targetContent} />
        <p className="mt-2">{t('offline_save_explanation')}</p>
        {saveError && (
          <Notification
            type="error"
            content={
              <Trans
                i18nKey="unable_to_save_check_connection_or_download"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content,jsx-a11y/anchor-is-valid,react/jsx-key
                  <a
                    href="#"
                    onClick={e => {
                      e.preventDefault()
                      handleDownload()
                    }}
                  />,
                ]}
              />
            }
          />
        )}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="danger-ghost" onClick={handleDiscardChanges}>
          {t('discard_changes')}
        </OLButton>
        <OLButton
          variant="primary"
          onClick={handleSaveAsNewFile}
          isLoading={saving}
          loadingLabel={t('saving')}
        >
          {t('save_as_new_file')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(UnableToSyncModal)
