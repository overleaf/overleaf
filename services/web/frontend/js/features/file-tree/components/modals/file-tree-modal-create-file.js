import React from 'react'
import { Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import FileTreeCreateFormProvider from '../../contexts/file-tree-create-form'
import FileTreeModalCreateFileBody from '../file-tree-create/file-tree-modal-create-file-body'
import FileTreeModalCreateFileFooter from '../file-tree-create/file-tree-modal-create-file-footer'
import AccessibleModal from '../../../../shared/components/accessible-modal'

export default function FileTreeModalCreateFile() {
  const { t } = useTranslation()

  const { isCreatingFile, cancel } = useFileTreeActionable()

  if (!isCreatingFile) {
    return null
  }

  return (
    <FileTreeCreateFormProvider>
      <AccessibleModal bsSize="large" onHide={cancel} show>
        <Modal.Header closeButton>
          <Modal.Title>{t('add_files')}</Modal.Title>
        </Modal.Header>

        <Modal.Body className="modal-new-file">
          <FileTreeModalCreateFileBody />
        </Modal.Body>

        <Modal.Footer>
          <FileTreeModalCreateFileFooter />
        </Modal.Footer>
      </AccessibleModal>
    </FileTreeCreateFormProvider>
  )
}
