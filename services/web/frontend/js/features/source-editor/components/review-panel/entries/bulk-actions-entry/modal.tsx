import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal as BootstrapModal } from 'react-bootstrap'
import AccessibleModal from '../../../../../../shared/components/accessible-modal'
import { useReviewPanelUpdaterFnsContext } from '../../../../context/review-panel/review-panel-context'

type BulkActionsModalProps = {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  isAccept: boolean
  nChanges: number
  onConfirm: () => void
}

function Modal({
  show,
  setShow,
  isAccept,
  nChanges,
  onConfirm,
}: BulkActionsModalProps) {
  const { t } = useTranslation()

  return (
    <AccessibleModal show={show} onHide={() => setShow(false)}>
      <BootstrapModal.Header closeButton>
        <h3>{isAccept ? t('accept_all') : t('reject_all')}</h3>
      </BootstrapModal.Header>
      <BootstrapModal.Body>
        <p>
          {isAccept
            ? t('bulk_accept_confirm', { nChanges })
            : t('bulk_reject_confirm', { nChanges })}
        </p>
      </BootstrapModal.Body>
      <BootstrapModal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary"
          onClick={() => setShow(false)}
        >
          {t('cancel')}
        </Button>
        <Button bsStyle={null} className="btn-primary" onClick={onConfirm}>
          {t('ok')}
        </Button>
      </BootstrapModal.Footer>
    </AccessibleModal>
  )
}

export function useBulkActionsModal() {
  const [show, setShow] = useState(false)
  const [isAccept, setIsAccept] = useState(false)
  const { bulkAcceptActions, bulkRejectActions } =
    useReviewPanelUpdaterFnsContext()

  const handleShowBulkAcceptDialog = useCallback(() => {
    setIsAccept(true)
    setShow(true)
  }, [])

  const handleShowBulkRejectDialog = useCallback(() => {
    setIsAccept(false)
    setShow(true)
  }, [])

  const handleConfirmDialog = useCallback(() => {
    if (isAccept) {
      bulkAcceptActions()
    } else {
      bulkRejectActions()
    }

    setShow(false)
  }, [bulkAcceptActions, bulkRejectActions, isAccept])

  return {
    show,
    setShow,
    isAccept,
    handleShowBulkAcceptDialog,
    handleShowBulkRejectDialog,
    handleConfirmDialog,
  }
}

export default Modal
