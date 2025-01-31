import { useTranslation } from 'react-i18next'
import { memo, useEffect, useState } from 'react'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import OLModal, {
  OLModalBody,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

// show modal when editor is forcefully disconnected
function ForceDisconnected() {
  const { connectionState } = useConnectionContext()
  const { t } = useTranslation()
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (
      connectionState.forceDisconnected &&
      // out of sync has its own modal
      connectionState.error !== 'out-of-sync'
    ) {
      setShow(true)
    }
  }, [connectionState.forceDisconnected, connectionState.error])

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
    <OLModal
      show
      // It's not possible to hide this modal, but it's a required prop
      onHide={() => {}}
      className="lock-editor-modal"
      backdrop={false}
      keyboard={false}
    >
      <OLModalHeader>
        <OLModalTitle>{t('please_wait')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        {t('were_performing_maintenance', { seconds: secondsUntilRefresh })}
      </OLModalBody>
    </OLModal>
  )
}

export default memo(ForceDisconnected)
