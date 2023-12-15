import { useTranslation } from 'react-i18next'
import { Modal } from 'react-bootstrap'
import AccessibleModal from '@/shared/components/accessible-modal'
import { memo, useEffect, useState } from 'react'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'

// show modal when editor is forcefully disconnected
function ForceDisconnected() {
  const { connectionState } = useConnectionContext()
  const { t } = useTranslation()
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (connectionState.forceDisconnected) {
      setShow(true)
    }
  }, [connectionState.forceDisconnected])

  useEffect(() => {
    if (connectionState.forceDisconnected) {
      setSecondsUntilRefresh(connectionState.forcedDisconnectDelay)
    }
  }, [connectionState.forceDisconnected, connectionState.forcedDisconnectDelay])

  useEffect(() => {
    if (show) {
      const timer = window.setInterval(() => {
        setSecondsUntilRefresh(seconds => Math.max(0, seconds - 1))
      }, 1000)

      return () => {
        window.clearInterval(timer)
      }
    }
  }, [show])

  if (!show) {
    return null
  }

  return (
    <AccessibleModal
      show
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

export default memo(ForceDisconnected)
