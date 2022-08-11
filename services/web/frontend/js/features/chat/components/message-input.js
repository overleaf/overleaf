import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

function MessageInput({ resetUnreadMessages, sendMessage }) {
  const { t } = useTranslation()

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      sendMessage(event.target.value)
      // wrap the form reset in setTimeout so input sources have time to finish
      // https://github.com/overleaf/internal/pull/9206
      window.setTimeout(() => {
        event.target.blur()
        event.target.closest('form').reset()
        event.target.focus()
      }, 0)
    }
  }

  return (
    <form className="new-message">
      <label htmlFor="chat-input" className="sr-only">
        {t('your_message')}
      </label>
      <textarea
        id="chat-input"
        placeholder={`${t('your_message')}…`}
        onKeyDown={handleKeyDown}
        onClick={resetUnreadMessages}
      />
    </form>
  )
}

MessageInput.propTypes = {
  resetUnreadMessages: PropTypes.func.isRequired,
  sendMessage: PropTypes.func.isRequired,
}

export default MessageInput
