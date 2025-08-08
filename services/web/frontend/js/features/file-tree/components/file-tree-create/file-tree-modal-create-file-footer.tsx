import { useTranslation } from 'react-i18next'
import { useFileTreeCreateForm } from '../../contexts/file-tree-create-form'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useFileTreeData } from '../../../../shared/context/file-tree-data-context'
import OLButton from '@/shared/components/ol/ol-button'
import OLNotification from '@/shared/components/ol/ol-notification'

export default function FileTreeModalCreateFileFooter() {
  const { valid } = useFileTreeCreateForm()
  const { newFileCreateMode, inFlight, cancel } = useFileTreeActionable()
  const { fileCount } = useFileTreeData()

  return (
    <FileTreeModalCreateFileFooterContent
      valid={valid}
      cancel={cancel}
      newFileCreateMode={newFileCreateMode}
      inFlight={inFlight}
      fileCount={fileCount}
    />
  )
}

export function FileTreeModalCreateFileFooterContent({
  valid,
  fileCount,
  inFlight,
  cancel,
  newFileCreateMode,
}: {
  valid: boolean
  fileCount:
    | {
        limit: number
        status: string
        value: number
      }
    | number
  inFlight: boolean
  cancel: () => void
  newFileCreateMode?: string
}) {
  const { t } = useTranslation()

  return (
    <>
      {typeof fileCount !== 'number' && fileCount.status === 'warning' && (
        <div className="modal-footer-left approaching-file-limit">
          {t('project_approaching_file_limit')} ({fileCount.value}/
          {fileCount.limit})
        </div>
      )}

      {typeof fileCount !== 'number' && fileCount.status === 'error' && (
        <OLNotification
          type="error"
          className="at-file-limit"
          content={t('project_has_too_many_files')}
        >
          {/* TODO: add parameter for fileCount.limit */}
        </OLNotification>
      )}

      <OLButton
        variant="secondary"
        type="button"
        disabled={inFlight}
        onClick={cancel}
      >
        {t('cancel')}
      </OLButton>

      {newFileCreateMode !== 'upload' && (
        <OLButton
          variant="primary"
          type="submit"
          form="create-file"
          disabled={inFlight || !valid}
          isLoading={inFlight}
        >
          {t('create')}
        </OLButton>
      )}
    </>
  )
}
