import AccessibleModal from '@/shared/components/accessible-modal'
import { formatDate } from '@/utils/dates'
import { useCallback } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

type RestoreProjectModalProps = {
  setShow: React.Dispatch<React.SetStateAction<boolean>>
  show: boolean
  isRestoring: boolean
  endTimestamp: number
  onRestore: () => void
}

export const RestoreProjectModal = ({
  setShow,
  show,
  endTimestamp,
  isRestoring,
  onRestore,
}: RestoreProjectModalProps) => {
  const { t } = useTranslation()

  const onCancel = useCallback(() => {
    setShow(false)
  }, [setShow])

  return (
    <AccessibleModal onHide={() => setShow(false)} show={show}>
      <Modal.Header>
        <Modal.Title>{t('restore_this_version')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>
          {t('your_current_project_will_revert_to_the_version_from_time', {
            timestamp: formatDate(endTimestamp),
          })}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          className="btn btn-secondary"
          bsStyle={null}
          onClick={onCancel}
          disabled={isRestoring}
        >
          {t('cancel')}
        </Button>
        <Button
          className="btn btn-primary"
          bsStyle={null}
          onClick={onRestore}
          disabled={isRestoring}
        >
          {isRestoring ? t('restoring') : t('restore')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}
