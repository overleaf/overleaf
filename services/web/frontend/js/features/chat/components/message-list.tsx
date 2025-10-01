import moment from 'moment'
import type { Message as MessageType } from '@/features/chat/context/chat-context'
import { useUserContext } from '@/shared/context/user-context'
import { User } from '../../../../../types/user'
import MessageGroup from '@/features/chat/components/message-group'
import MessageGroupRedesign from '@/features/ide-redesign/components/chat/message-group'

const FIVE_MINUTES = 5 * 60 * 1000
const TIMESTAMP_GROUP_SIZE = FIVE_MINUTES

function formatTimestamp(date: moment.MomentInput) {
  if (!date) {
    return 'N/A'
  } else {
    return `${moment(date).format('h:mm a')} ${moment(date).calendar()}`
  }
}

interface MessageListProps {
  messages: MessageType[]
  resetUnreadMessages(...args: unknown[]): unknown
  newDesign?: boolean
}

type MessageGroupType = {
  messages: MessageType[]
  id: string
  user?: User
}

// Group messages by the same author that were sent within 5 minutes of each
// other
function groupMessages(messages: MessageType[]) {
  const groups: MessageGroupType[] = []
  let currentGroup: MessageGroupType | null = null
  let previousMessage: MessageType | null = null

  for (const message of messages) {
    if (message.deleted) {
      continue
    }
    if (
      currentGroup &&
      previousMessage &&
      !message.pending &&
      message.user &&
      message.user.id &&
      message.user.id === previousMessage.user?.id &&
      message.timestamp - previousMessage.timestamp < TIMESTAMP_GROUP_SIZE
    ) {
      currentGroup.messages.push(message)
    } else {
      currentGroup = {
        messages: [message],
        id: String(message.timestamp),
        user: message.user,
      }
      groups.push(currentGroup)
    }
    previousMessage = message
  }

  return groups
}

function MessageList({
  messages,
  resetUnreadMessages,
  newDesign,
}: MessageListProps) {
  const user = useUserContext()

  const MessageGroupComponent = newDesign ? MessageGroupRedesign : MessageGroup

  function shouldRenderDate(messageIndex: number) {
    if (messageIndex === 0) {
      return true
    } else {
      const message = messages[messageIndex]
      const previousMessage = messages[messageIndex - 1]
      return (
        message.timestamp &&
        previousMessage.timestamp &&
        message.timestamp - previousMessage.timestamp > FIVE_MINUTES
      )
    }
  }

  const messageGroups = groupMessages(messages)

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <ul
      className="list-unstyled"
      onClick={resetUnreadMessages}
      onKeyDown={resetUnreadMessages}
    >
      {messageGroups.map((group, index) => (
        <li key={group.id} className="message">
          {shouldRenderDate(index) && (
            <div className="date">
              <time
                dateTime={
                  group.messages[0].timestamp
                    ? moment(group.messages[0].timestamp).format()
                    : undefined
                }
              >
                {formatTimestamp(group.messages[0].timestamp)}
              </time>
            </div>
          )}
          <MessageGroupComponent
            messages={group.messages}
            user={group.user}
            fromSelf={user ? group.user?.id === user.id : false}
          />
        </li>
      ))}
    </ul>
  )
}

export default MessageList
