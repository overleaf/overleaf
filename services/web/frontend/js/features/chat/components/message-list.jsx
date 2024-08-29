import PropTypes from 'prop-types'
import moment from 'moment'
import Message from './message'

const FIVE_MINUTES = 5 * 60 * 1000

function formatTimestamp(date) {
  if (!date) {
    return 'N/A'
  } else {
    return `${moment(date).format('h:mm a')} ${moment(date).calendar()}`
  }
}

function MessageList({ messages, resetUnreadMessages, userId }) {
  function shouldRenderDate(messageIndex) {
    if (messageIndex === 0) {
      return true
    } else {
      const message = messages[messageIndex]
      const previousMessage = messages[messageIndex - 1]
      return message.timestamp - previousMessage.timestamp > FIVE_MINUTES
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
          <Message message={message} userId={userId} />
        </li>
      ))}
    </ul>
  )
}

MessageList.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      timestamp: PropTypes.number,
    })
  ).isRequired,
  resetUnreadMessages: PropTypes.func.isRequired,
  userId: PropTypes.string,
}

export default MessageList
