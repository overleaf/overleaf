import { useTranslation } from 'react-i18next'
import { Modal } from 'react-bootstrap'
import AccessibleModal from '@/shared/components/accessible-modal'
import { useEffect, useState } from 'react'

export type LockEditorMessageModalProps = {
  delay: number // In seconds
  show: boolean
}

function LockEditorMessageModal({ delay, show }: LockEditorMessageModalProps) {
  const { t } = useTranslation()
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(0)

  useEffect(() => {
    if (show) {
      setSecondsUntilRefresh(delay)

      const timer = window.setInterval(() => {
        setSecondsUntilRefresh(seconds => Math.max(0, seconds - 1))
      }, 1000)

      return () => {
        window.clearInterval(timer)
      }
    }
  }, [show, delay])

  return (
    <AccessibleModal
      show={show}
      // It's not possible to hide this modal, but it's a required prop
      onHide={() => {}}
      className="lock-editor-modal"
      backdrop={false}
      keyboard={false}
    >
      <Modal.Header>
        <Modal.Title>{t('please_wait')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {t('were_performing_maintenance', { seconds: secondsUntilRefresh })}
      </Modal.Body>
    </AccessibleModal>
  )
}

export default LockEditorMessageModal
