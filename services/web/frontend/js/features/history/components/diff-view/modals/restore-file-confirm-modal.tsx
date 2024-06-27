import { formatTime } from '@/features/utils/format-date'
import { useMemo } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

type RestoreFileConfirmModalProps = {
  show: boolean
  timestamp: number
  onConfirm: () => void
  onHide: () => void
}

export function RestoreFileConfirmModal({
  show,
  timestamp,
  onConfirm,
  onHide,
}: RestoreFileConfirmModalProps) {
  const { t } = useTranslation()
  const date = useMemo(() => formatTime(timestamp, 'Do MMMM'), [timestamp])
  const time = useMemo(() => formatTime(timestamp, 'h:mm a'), [timestamp])

  return (
    <Modal show={show} onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title>{t('restore_file_confirmation_title')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {t('restore_file_confirmation_message', { date, time })}
      </Modal.Body>
      <Modal.Footer>
        <Button bsStyle={null} className="btn-secondary" onClick={onHide}>
          {t('cancel')}
        </Button>
        <Button bsStyle={null} className="btn-primary" onClick={onConfirm}>
          {t('restore')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
