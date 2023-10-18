import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { secondsUntil } from '@/features/ide-react/connection/utils'
import { Alert } from 'react-bootstrap'

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
    <Alert bsStyle="warning" className="small">
      <strong>{t('lost_connection')}</strong>{' '}
      {t('reconnecting_in_x_secs', { seconds: secondsUntilReconnect })}.
      <button
        id="try-reconnect-now-button"
        className="pull-right"
        onClick={() => tryReconnectNow()}
      >
        {t('try_now')}
      </button>
    </Alert>
  )
}
