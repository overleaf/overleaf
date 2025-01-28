import moment from 'moment'
import Message from './message'
import type { Message as MessageType } from '@/features/chat/context/chat-context'
import { useUserContext } from '@/shared/context/user-context'

const FIVE_MINUTES = 5 * 60 * 1000

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
}

function MessageList({ messages, resetUnreadMessages }: MessageListProps) {
  const user = useUserContext()

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

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <ul
      className="list-unstyled"
      onClick={resetUnreadMessages}
      onKeyDown={resetUnreadMessages}
    >
      {messages.map((message, index) => (
        // new messages are added to the beginning of the list, so we use a reversed index
        <li key={message.id} className="message">
          {shouldRenderDate(index) && (
            <div className="date">
              <time
                dateTime={
                  message.timestamp
                    ? moment(message.timestamp).format()
                    : undefined
                }
              >
                {formatTimestamp(message.timestamp)}
              </time>
            </div>
          )}
          <Message
            message={message}
            fromSelf={message.user ? message.user.id === user.id : false}
          />
        </li>
      ))}
    </ul>
  )
}

export default MessageList
