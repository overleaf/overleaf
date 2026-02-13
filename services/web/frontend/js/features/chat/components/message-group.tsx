import { MessageAndDropdown } from './message-and-dropdown'
import { useTranslation } from 'react-i18next'
import type { Message as MessageType } from '@/features/chat/context/chat-context'
import { User } from '../../../../../types/user'

export interface MessageGroupProps {
  messages: MessageType[]
  user?: User
  fromSelf: boolean
}

function MessageGroup({ messages, user, fromSelf }: MessageGroupProps) {
  const { t } = useTranslation()

  return (
    <div className="chat-message">
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
      {messages.map(message => {
        const nonDeletedMessages = messages.filter(m => !m.deleted)
        const nonDeletedIndex = nonDeletedMessages.findIndex(
          m => m.id === message.id
        )
        return (
          <MessageAndDropdown
            key={message.id}
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
