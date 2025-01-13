import { useTranslation } from 'react-i18next'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import OLButton from '@/features/ui/components/ol/ol-button'

interface ChatFallbackErrorProps {
  reconnect?: () => void
}

function ChatFallbackError({ reconnect }: ChatFallbackErrorProps) {
  const { t } = useTranslation()

  return (
    <aside className="chat">
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
  )
}

export default ChatFallbackError
