import AccessibleModal from '@/shared/components/accessible-modal'
import { FC, memo } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

const ReviewPanelDeleteCommentModal: FC<{
  onHide: () => void
  onDelete: () => void
  title: string
  message: string
}> = ({ onHide, onDelete, title, message }) => {
  const { t } = useTranslation()

  return (
    <AccessibleModal show onHide={onHide}>
      <Modal.Header>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button bsStyle={null} className="btn-secondary" onClick={onHide}>
          {t('cancel')}
        </Button>
        <Button bsStyle="danger" onClick={onDelete}>
          {t('delete')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default memo(ReviewPanelDeleteCommentModal)
