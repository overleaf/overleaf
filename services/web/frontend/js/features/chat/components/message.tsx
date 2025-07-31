import { getHueForUserId } from '@/shared/utils/colors'
import MessageContent from './message-content'
import type { Message as MessageType } from '@/features/chat/context/chat-context'
import { User } from '../../../../../types/user'
import { useTranslation } from 'react-i18next'

export interface MessageProps {
  message: MessageType
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

function Message({ message, fromSelf }: MessageProps) {
  const { t } = useTranslation()
  return (
    <div className="message-wrapper">
      {!fromSelf && (
        <div className="name" translate="no">
          <span>
            {message.user
              ? message.user.first_name || message.user.email
              : t('deleted_user')}
          </span>
        </div>
      )}
      <div className="message" style={getMessageStyle(message.user)}>
        {!fromSelf && (
          <div className="arrow" style={getArrowStyle(message.user)} />
        )}
        <div className="message-content">
          {message.contents.map((content, index) => (
            <MessageContent key={index} content={content} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Message
