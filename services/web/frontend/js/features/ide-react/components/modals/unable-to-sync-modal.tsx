import { useTranslation } from 'react-i18next'
import { memo, useCallback } from 'react'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import { downloadFileContent } from '@/utils/download-file'

export type UnableToSyncModalProps = {
  editorContent: string
  docName: string | null
  show: boolean
  onHide: () => void
}

function UnableToSyncModal({
  editorContent,
  docName,
  show,
  onHide,
}: UnableToSyncModalProps) {
  const { t } = useTranslation()

  const handleDownload = useCallback(() => {
    downloadFileContent(editorContent, docName ?? 'document.txt')
  }, [editorContent, docName])

  return (
    <OLModal
      show={show}
      onHide={onHide}
      backdrop="static"
      keyboard={false}
      centered
    >
      <OLModalHeader>
        <OLModalTitle>{t('your_offline_edits_couldnt_be_synced')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>{t('offline_edits_couldnt_be_synced_detail')}</OLModalBody>
      <OLModalFooter>
        <OLButton variant="primary" onClick={handleDownload}>
          {t('download_local_version')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(UnableToSyncModal)
