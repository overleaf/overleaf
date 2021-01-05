import React from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

import AccessibleModal from '../../../../shared/components/accessible-modal'

import { useFileTreeActionable } from '../../contexts/file-tree-actionable'

function FileTreeModalDelete() {
  const { t } = useTranslation()

  const {
    isDeleting,
    inFlight,
    finishDeleting,
    actionedEntities,
    cancel,
    error
  } = useFileTreeActionable()

  if (!isDeleting) return null // the modal will not be rendered; return early

  function handleHide() {
    cancel()
  }

  function handleDelete() {
    finishDeleting()
  }

  return (
    <AccessibleModal show={isDeleting} onHide={handleHide}>
      <Modal.Header>
        <Modal.Title>{t('delete')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>{t('sure_you_want_to_delete')}</p>
        <ul>
          {actionedEntities.map(entity => (
            <li key={entity._id}>{entity.name}</li>
          ))}
        </ul>
        {error && (
          <div className="alert alert-danger file-tree-modal-alert">
            {t('generic_something_went_wrong')}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {inFlight ? (
          <Button bsStyle="danger" disabled>
            {t('deleting')}…
          </Button>
        ) : (
          <>
            <Button onClick={handleHide}>{t('cancel')}</Button>
            <Button bsStyle="danger" onClick={handleDelete}>
              {t('delete')}
            </Button>
          </>
        )}
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default FileTreeModalDelete
