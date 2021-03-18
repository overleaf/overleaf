import React from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button } from 'react-bootstrap'
import { useFileTreeCreateForm } from '../../contexts/file-tree-create-form'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { useFileTreeMutable } from '../../contexts/file-tree-mutable'
import PropTypes from 'prop-types'

export default function FileTreeModalCreateFileFooter() {
  const { valid } = useFileTreeCreateForm()
  const { newFileCreateMode, inFlight, cancel } = useFileTreeActionable()
  const { fileCount } = useFileTreeMutable()

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
  cancel
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
        <Alert bsStyle="warning" className="at-file-limit">
          {/* TODO: add parameter for fileCount.limit */}
          {t('project_has_too_many_files')}
        </Alert>
      )}

      <Button
        bsStyle="default"
        type="button"
        disabled={inFlight}
        onClick={cancel}
      >
        {t('cancel')}
      </Button>

      {newFileCreateMode !== 'upload' && (
        <Button
          bsStyle="primary"
          type="submit"
          form="create-file"
          disabled={inFlight || !valid}
        >
          <span>{inFlight ? `${t('creating')}…` : t('create')}</span>
        </Button>
      )}
    </>
  )
}
FileTreeModalCreateFileFooterContent.propTypes = {
  cancel: PropTypes.func.isRequired,
  fileCount: PropTypes.shape({
    limit: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired
  }).isRequired,
  inFlight: PropTypes.bool.isRequired,
  newFileCreateMode: PropTypes.string,
  valid: PropTypes.bool.isRequired
}
