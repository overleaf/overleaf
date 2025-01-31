import { useTranslation } from 'react-i18next'
import { LostConnectionAlert } from './lost-connection-alert'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugging } from '@/utils/debugging'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { createPortal } from 'react-dom'
import { useGlobalAlertsContainer } from '@/features/ide-react/context/global-alerts-context'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import OLButton from '@/features/ui/components/ol/ol-button'

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

  const [synctexError] = useScopeValue('sync_tex_error')

  if (!globalAlertsContainer) {
    return null
  }

  return createPortal(
    <>
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

      {synctexError ? (
        <OLNotification
          type="warning"
          content={<strong>{t('synctex_failed')}</strong>}
          action={
            <OLButton
              href="/learn/how-to/SyncTeX_Errors"
              target="_blank"
              id="synctex-more-info-button"
              variant="secondary"
              size="sm"
              bs3Props={{ className: 'alert-link-as-btn pull-right' }}
            >
              {t('more_info')}
            </OLButton>
          }
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
