import { useTranslation } from 'react-i18next'
import { LostConnectionAlert } from './lost-connection-alert'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import { debugging } from '@/utils/debugging'
import { Alert } from 'react-bootstrap'
import useScopeValue from '@/shared/hooks/use-scope-value'
import { createPortal } from 'react-dom'
import { useGlobalAlertsContainer } from '@/features/ide-react/context/global-alerts-context'

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
      {connectionState.forceDisconnected ? (
        <Alert bsStyle="danger" className="small">
          <strong>{t('disconnected')}</strong>
        </Alert>
      ) : null}

      {connectionState.reconnectAt ? (
        <LostConnectionAlert
          reconnectAt={connectionState.reconnectAt}
          tryReconnectNow={tryReconnectNow}
        />
      ) : null}

      {isStillReconnecting ? (
        <Alert bsStyle="warning" className="small">
          <strong>{t('reconnecting')}…</strong>
        </Alert>
      ) : null}

      {synctexError ? (
        <Alert bsStyle="warning" className="small">
          <strong>{t('synctex_failed')}</strong>
          <a
            href="/learn/how-to/SyncTeX_Errors"
            target="_blank"
            id="synctex-more-info-button"
            className="alert-link-as-btn pull-right"
          >
            {t('more_info')}
          </a>
        </Alert>
      ) : null}

      {connectionState.inactiveDisconnect ||
      (connectionState.readyState === WebSocket.CLOSED &&
        (connectionState.error === 'rate-limited' ||
          connectionState.error === 'unable-to-connect') &&
        !secondsUntilReconnect()) ? (
        <Alert bsStyle="warning" className="small">
          <strong>{t('editor_disconected_click_to_reconnect')}</strong>
        </Alert>
      ) : null}

      {debugging ? (
        <Alert bsStyle="warning" className="small">
          <strong>Connected: {isConnected.toString()}</strong>
        </Alert>
      ) : null}
    </>,
    globalAlertsContainer
  )
}
