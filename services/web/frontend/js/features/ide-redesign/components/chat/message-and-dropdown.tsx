import type { Message } from '@/features/chat/context/chat-context'
import { User } from '../../../../../../types/user'
import {
  getBackgroundColorForUserId,
  hslStringToLuminance,
} from '@/shared/utils/colors'
import MessageContent from '@/features/chat/components/message-content'
import classNames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import MessageDropdown from '@/features/chat/components/message-dropdown'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function getAvatarStyle(user?: User) {
  if (!user?.id) {
    // Deleted user
    return {
      backgroundColor: 'var(--bg-light-disabled)',
      borderColor: 'var(--bg-light-disabled)',
      color: 'var(--content-disabled)',
    }
  }

  const backgroundColor = getBackgroundColorForUserId(user.id)

  return {
    borderColor: backgroundColor,
    backgroundColor,
    color:
      hslStringToLuminance(backgroundColor) < 0.5
        ? 'var(--content-primary-dark)'
        : 'var(--content-primary)',
  }
}

export function MessageAndDropdown({
  message,
  fromSelf,
  isLast,
  isFirst,
}: {
  message: Message
  fromSelf: boolean
  isLast: boolean
  isFirst: boolean
}) {
  const hasChatEditDelete = useFeatureFlag('chat-edit-delete')

  return (
    <div className="message-row">
      <>
        {!fromSelf && isLast ? (
          <div className="message-avatar">
            <div className="avatar" style={getAvatarStyle(message.user)}>
              {message.user?.id && message.user.email ? (
                message.user.first_name?.charAt(0) ||
                message.user.email.charAt(0)
              ) : (
                <MaterialIcon
                  type="delete"
                  className="message-avatar-deleted-user-icon"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="message-avatar-placeholder" />
        )}
        <div
          className={classNames('message-container', {
            'message-from-self': fromSelf,
            'first-row-in-message': isFirst,
            'last-row-in-message': isLast,
            'pending-message': message.pending,
          })}
        >
          <div>
            {hasChatEditDelete && fromSelf ? (
              <MessageDropdown message={message} />
            ) : null}
          </div>
          <div className="message-content">
            <MessageContent
              content={message.content}
              messageId={message.id}
              edited={message.edited}
            />
          </div>
        </div>
      </>
    </div>
  )
}
