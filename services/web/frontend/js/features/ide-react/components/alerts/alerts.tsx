import { useTranslation } from 'react-i18next'
import { LostConnectionAlert } from './lost-connection-alert'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugging } from '@/utils/debugging'
import { ElementType } from 'react'
import { createPortal } from 'react-dom'
import { useGlobalAlertsContainer } from '@/features/ide-react/context/global-alerts-context'
import OLNotification from '@/shared/components/ol/ol-notification'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'

const rollingBuildsUpdatedAlert: Array<{
  import: { default: ElementType }
  path: string
}> = importOverleafModules('rollingBuildsUpdatedAlert')

export function Alerts() {
  const { t } = useTranslation()
  const {
    connectionState,
    isConnected,
    isStillReconnecting,
    tryReconnectNow,
    secondsUntilReconnect,
  } = useConnectionContext()
  const globalAlertsContainer = useGlobalAlertsContainer()

  if (!globalAlertsContainer) {
    return null
  }

  return createPortal(
    <>
      {rollingBuildsUpdatedAlert.map(
        ({ import: { default: Component }, path }) => (
          <Component key={path} />
        )
      )}

      {connectionState.forceDisconnected &&
      // hide "disconnected" banner when displaying out of sync modal
      connectionState.error !== 'out-of-sync' ? (
        <OLNotification
          type="error"
          content={<strong>{t('disconnected')}</strong>}
        />
      ) : null}

      {connectionState.reconnectAt ? (
        <LostConnectionAlert
          reconnectAt={connectionState.reconnectAt}
          tryReconnectNow={tryReconnectNow}
        />
      ) : null}

      {isStillReconnecting ? (
        <OLNotification
          type="warning"
          content={<strong>{t('reconnecting')}…</strong>}
        />
      ) : null}

      {connectionState.inactiveDisconnect ||
      (connectionState.readyState === WebSocket.CLOSED &&
        (connectionState.error === 'rate-limited' ||
          connectionState.error === 'unable-to-connect') &&
        !secondsUntilReconnect()) ? (
        <OLNotification
          type="warning"
          content={
            <strong>{t('editor_disconected_click_to_reconnect')}</strong>
          }
        />
      ) : null}

      {debugging ? (
        <OLNotification
          type="warning"
          content={<strong>Connected: {isConnected.toString()}</strong>}
        />
      ) : null}
    </>,
    globalAlertsContainer
  )
}
