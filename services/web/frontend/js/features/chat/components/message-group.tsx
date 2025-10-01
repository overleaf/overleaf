import { getHueForUserId } from '@/shared/utils/colors'
import type { Message as MessageType } from '@/features/chat/context/chat-context'
import { User } from '../../../../../types/user'
import classNames from 'classnames'
import { MessageAndDropdown } from '@/features/chat/components/message-and-dropdown'
import { useTranslation } from 'react-i18next'

export interface MessageGroupProps {
  messages: MessageType[]
  user?: User
  fromSelf: boolean
}

function hue(user?: User) {
  return user ? getHueForUserId(user.id) : 0
}

function getMessageStyle(user?: User) {
  return {
    borderColor: `hsl(${hue(user)}, 85%, 40%)`,
    backgroundColor: `hsl(${hue(user)}, 85%, 40%`,
  }
}

function getArrowStyle(user?: User) {
  return {
    borderColor: `hsl(${hue(user)}, 85%, 40%)`,
  }
}

function MessageGroup({ messages, user, fromSelf }: MessageGroupProps) {
  const { t } = useTranslation()

  return (
    <div
      className={classNames('message-wrapper', {
        'own-message-wrapper': fromSelf,
      })}
    >
      {!fromSelf && (
        <div className="name" translate="no">
          <span>
            {user ? user.first_name || user.email : t('deleted_user')}
          </span>
        </div>
      )}
      <div className="message" style={getMessageStyle(user)}>
        {!fromSelf && <div className="arrow" style={getArrowStyle(user)} />}

        {messages.map(message => (
          <MessageAndDropdown
            key={message.id}
            message={message}
            fromSelf={fromSelf}
          />
        ))}
      </div>
    </div>
  )
}

export default MessageGroup
