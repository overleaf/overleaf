import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
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
            <div className="notification-list">
              <Notification type="error" content={t('chat_error')} />
            </div>
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
