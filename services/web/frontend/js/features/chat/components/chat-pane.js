import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import MessageList from './message-list'
import MessageInput from './message-input'
import InfiniteScroll from './infinite-scroll'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '../store/chat-store-effect'
import withErrorBoundary from '../../../infrastructure/error-boundary'

function ChatPane({ resetUnreadMessages, chatIsOpen }) {
  const { t } = useTranslation()

  const {
    atEnd,
    loading,
    loadMoreMessages,
    messages,
    sendMessage,
    userId
  } = useChatStore()

  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false)

  useEffect(() => {
    if (chatIsOpen && !initialMessagesLoaded) {
      loadMoreMessages()
      setInitialMessagesLoaded(true)
    }
  }, [initialMessagesLoaded, loadMoreMessages, chatIsOpen])

  const shouldDisplayPlaceholder = !loading && messages.length === 0

  const messageContentCount = messages.reduce(
    (acc, { contents }) => acc + contents.length,
    0
  )

  return (
    <aside className="chat">
      <InfiniteScroll
        atEnd={atEnd}
        className="messages"
        fetchData={loadMoreMessages}
        isLoading={loading}
        itemCount={messageContentCount}
      >
        <div>
          <h2 className="sr-only">{t('chat')}</h2>
          {loading && <LoadingSpinner />}
          {shouldDisplayPlaceholder && <Placeholder />}
          <MessageList
            messages={messages}
            userId={userId}
            resetUnreadMessages={resetUnreadMessages}
          />
        </div>
      </InfiniteScroll>
      <MessageInput
        resetUnreadMessages={resetUnreadMessages}
        sendMessage={sendMessage}
      />
    </aside>
  )
}

function LoadingSpinner() {
  const { t } = useTranslation()
  return (
    <div className="loading">
      <Icon type="fw" modifier="refresh" spin />
      {`  ${t('loading')}…`}
    </div>
  )
}

function Placeholder() {
  const { t } = useTranslation()
  return (
    <>
      <div className="no-messages text-center small">{t('no_messages')}</div>
      <div className="first-message text-center">
        {t('send_first_message')}
        <br />
        <Icon type="arrow-down" />
      </div>
    </>
  )
}

ChatPane.propTypes = {
  resetUnreadMessages: PropTypes.func.isRequired,
  chatIsOpen: PropTypes.bool
}

export default withErrorBoundary(ChatPane)
