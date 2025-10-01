import { MessageGroupProps } from '@/features/chat/components/message-group'
import { MessageAndDropdown } from './message-and-dropdown'
import { useTranslation } from 'react-i18next'

function MessageGroup({ messages, user, fromSelf }: MessageGroupProps) {
  const { t } = useTranslation()

  return (
    <div className="chat-message-redesign">
      <div>
        <div className="message-row">
          <div className="message-avatar-placeholder" />
          {!fromSelf && (
            <div className="message-author">
              <span>
                {user?.id && user.email
                  ? user.first_name || user.email
                  : t('deleted_user')}
              </span>
            </div>
          )}
        </div>
      </div>
      {messages.map((message, index) => {
        const nonDeletedMessages = messages.filter(m => !m.deleted)
        const nonDeletedIndex = nonDeletedMessages.findIndex(
          m => m.id === message.id
        )
        return (
          <MessageAndDropdown
            key={index}
            message={message}
            fromSelf={fromSelf}
            isLast={nonDeletedIndex === nonDeletedMessages.length - 1}
            isFirst={nonDeletedIndex === 0}
          />
        )
      })}
    </div>
  )
}

export default MessageGroup
