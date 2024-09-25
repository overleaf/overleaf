import { useTranslation } from 'react-i18next'
import { useFileTreeCreateForm } from '../../contexts/file-tree-create-form'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useFileTreeData } from '../../../../shared/context/file-tree-data-context'
import PropTypes from 'prop-types'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLNotification from '@/features/ui/components/ol/ol-notification'

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
  newFileCreateMode,
  cancel,
}) {
  const { t } = useTranslation()

  return (
    <>
      {fileCount.status === 'warning' && (
        <div className="modal-footer-left approaching-file-limit">
          {t('project_approaching_file_limit')} ({fileCount.value}/
          {fileCount.limit})
        </div>
      )}

      {fileCount.status === 'error' && (
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
          bs3Props={{ loading: inFlight ? `${t('creating')}…` : t('create') }}
        >
          {t('create')}
        </OLButton>
      )}
    </>
  )
}
FileTreeModalCreateFileFooterContent.propTypes = {
  cancel: PropTypes.func.isRequired,
  fileCount: PropTypes.shape({
    limit: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
  }).isRequired,
  inFlight: PropTypes.bool.isRequired,
  newFileCreateMode: PropTypes.string,
  valid: PropTypes.bool.isRequired,
}
