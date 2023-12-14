import { useTranslation } from 'react-i18next'
import { Modal } from 'react-bootstrap'
import AccessibleModal from '@/shared/components/accessible-modal'
import { memo } from 'react'

export type GenericMessageModalOwnProps = {
  title: string
  message: string
}

type GenericMessageModalProps = React.ComponentProps<typeof AccessibleModal> &
  GenericMessageModalOwnProps

function GenericMessageModal({
  title,
  message,
  ...modalProps
}: GenericMessageModalProps) {
  const { t } = useTranslation()

  return (
    <AccessibleModal {...modalProps}>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="modal-body-share">{message}</Modal.Body>

      <Modal.Footer>
        <button className="btn btn-info" onClick={() => modalProps.onHide()}>
          {t('ok')}
        </button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default memo(GenericMessageModal)
