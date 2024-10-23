import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useReviewPanelUpdaterFnsContext } from '../../../../context/review-panel/review-panel-context'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'

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
    <OLModal show={show} onHide={() => setShow(false)}>
      <OLModalHeader closeButton>
        <OLModalTitle>
          {isAccept ? t('accept_all') : t('reject_all')}
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>
          {isAccept
            ? t('bulk_accept_confirm', { nChanges })
            : t('bulk_reject_confirm', { nChanges })}
        </p>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={() => setShow(false)}>
          {t('cancel')}
        </OLButton>
        <OLButton variant="primary" onClick={onConfirm}>
          {t('ok')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
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
