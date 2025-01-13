import { getHueForUserId } from '../../../shared/utils/colors'
import MessageContent from './message-content'
import type { Message as MessageType } from '@/features/chat/context/chat-context'
import { User } from '../../../../../types/user'

interface MessageProps {
  message: MessageType
  userId: string | null
}

function Message({ message, userId }: MessageProps) {
  function hue(user?: User) {
    return user ? getHueForUserId(user.id, userId) : 0
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

  const isMessageFromSelf = message.user ? message.user.id === userId : false

  return (
    <div className="message-wrapper">
      {!isMessageFromSelf && message.user.id && (
        <div className="name">
          <span>{message.user.first_name || message.user.email}</span>
        </div>
      )}
      <div className="message" style={getMessageStyle(message.user)}>
        {!isMessageFromSelf && (
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
