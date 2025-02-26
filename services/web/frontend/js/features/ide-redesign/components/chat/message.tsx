import { MessageProps } from '@/features/chat/components/message'
import { User } from '../../../../../../types/user'
import { getHueForUserId } from '@/shared/utils/colors'
import MessageContent from '@/features/chat/components/message-content'
import classNames from 'classnames'

function hue(user?: User) {
  return user ? getHueForUserId(user.id) : 0
}

function getAvatarStyle(user?: User) {
  return {
    borderColor: `hsl(${hue(user)}, 85%, 40%)`,
    backgroundColor: `hsl(${hue(user)}, 85%, 40%`,
  }
}

function Message({ message, fromSelf }: MessageProps) {
  return (
    <div className="chat-message-redesign">
      <div className="message-row">
        <div className="message-avatar-placeholder" />
        {!fromSelf && (
          <div className="message-author">
            <span>{message.user.first_name || message.user.email}</span>
          </div>
        )}
      </div>
      {message.contents.map((content, index) => (
        <div key={index} className="message-row">
          <>
            {!fromSelf && index === message.contents.length - 1 ? (
              <div className="message-avatar">
                <div className="avatar" style={getAvatarStyle(message.user)}>
                  {message.user.first_name?.charAt(0) ||
                    message.user.email.charAt(0)}
                </div>
              </div>
            ) : (
              <div className="message-avatar-placeholder" />
            )}
            <div
              className={classNames('message-container', {
                'message-from-self': fromSelf,
                'first-row-in-message': index === 0,
                'last-row-in-message': index === message.contents.length - 1,
              })}
            >
              <div className="message-content">
                <MessageContent content={content} />
              </div>
            </div>
          </>
        </div>
      ))}
    </div>
  )
}

export default Message
