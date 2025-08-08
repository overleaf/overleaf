import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { secondsUntil } from '@/features/ide-react/connection/utils'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'

type LostConnectionAlertProps = {
  reconnectAt: number
  tryReconnectNow: () => void
}

export function LostConnectionAlert({
  reconnectAt,
  tryReconnectNow,
}: LostConnectionAlertProps) {
  const { t } = useTranslation()
  const [secondsUntilReconnect, setSecondsUntilReconnect] = useState(
    secondsUntil(reconnectAt)
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsUntilReconnect(secondsUntil(reconnectAt))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [reconnectAt])

  return (
    <OLNotification
      type="warning"
      content={
        <>
          <strong>{t('lost_connection')}</strong>{' '}
          {t('reconnecting_in_x_secs', { seconds: secondsUntilReconnect })}.
        </>
      }
      action={
        <OLButton
          id="try-reconnect-now-button"
          onClick={() => tryReconnectNow()}
          size="sm"
          variant="secondary"
        >
          {t('try_now')}
        </OLButton>
      }
    />
  )
}
