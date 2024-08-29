import PropTypes from 'prop-types'
import { getHueForUserId } from '../../../shared/utils/colors'
import MessageContent from './message-content'

function Message({ message, userId }) {
  function hue(user) {
    return user ? getHueForUserId(user.id, userId) : 0
  }

  function getMessageStyle(user) {
    return {
      borderColor: `hsl(${hue(user)}, 85%, 40%)`,
      backgroundColor: `hsl(${hue(user)}, 85%, 40%`,
    }
  }

  function getArrowStyle(user) {
    return {
      borderColor: `hsl(${hue(user)}, 85%, 40%)`,
    }
  }

  const isMessageFromSelf = message.user ? message.user.id === userId : false

  return (
    <div className="message-wrapper">
      {!isMessageFromSelf && (
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

Message.propTypes = {
  message: PropTypes.shape({
    contents: PropTypes.arrayOf(PropTypes.string).isRequired,
    user: PropTypes.shape({
      id: PropTypes.string,
      email: PropTypes.string,
      first_name: PropTypes.string,
    }),
  }),
  userId: PropTypes.string,
}

export default Message
