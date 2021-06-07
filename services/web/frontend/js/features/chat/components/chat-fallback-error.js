import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Button, Alert } from 'react-bootstrap'

function ChatFallbackError({ reconnect }) {
  const { t } = useTranslation()

  return (
    <aside className="chat">
      <div className="chat-error">
        <Alert bsStyle="danger">{t('chat_error')}</Alert>
        {reconnect && (
          <p className="text-center">
            <Button bsStyle="info" type="button" onClick={reconnect}>
              {t('reconnect')}
            </Button>
          </p>
        )}
      </div>
    </aside>
  )
}

ChatFallbackError.propTypes = {
  reconnect: PropTypes.any,
}

export default ChatFallbackError
