import { useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'

interface ChatFallbackErrorProps {
  reconnect?: () => void
}

function ChatFallbackError({ reconnect }: ChatFallbackErrorProps) {
  const { t } = useTranslation()

  return (
    <div className="chat-panel">
      <RailPanelHeader title={t('collaborator_chat')} />
      <div className="chat-wrapper">
        <aside className="chat" aria-label={t('chat')}>
          <div className="chat-error">
            <OLNotification type="error" content={t('chat_error')} />
            {reconnect && (
              <p className="text-center">
                <OLButton variant="secondary" onClick={reconnect}>
                  {t('reconnect')}
                </OLButton>
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ChatFallbackError
