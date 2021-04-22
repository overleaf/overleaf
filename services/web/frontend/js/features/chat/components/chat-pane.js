import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

import MessageList from './message-list'
import MessageInput from './message-input'
import InfiniteScroll from './infinite-scroll'
import Icon from '../../../shared/components/icon'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useApplicationContext } from '../../../shared/context/application-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { useChatContext } from '../context/chat-context'

function ChatPane() {
  const { t } = useTranslation()

  const { chatIsOpen } = useLayoutContext({ chatIsOpen: PropTypes.bool })
  const { user } = useApplicationContext()

  const {
    status,
    messages,
    initialMessagesLoaded,
    atEnd,
    loadInitialMessages,
    loadMoreMessages,
    sendMessage,
    markMessagesAsRead
  } = useChatContext()

  useEffect(() => {
    if (chatIsOpen && !initialMessagesLoaded) {
      loadInitialMessages()
    }
  }, [chatIsOpen, loadInitialMessages, initialMessagesLoaded])

  const shouldDisplayPlaceholder = status !== 'pending' && messages.length === 0

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
        isLoading={status === 'pending'}
        itemCount={messageContentCount}
      >
        <div>
          <h2 className="sr-only">{t('chat')}</h2>
          {status === 'pending' && <LoadingSpinner />}
          {shouldDisplayPlaceholder && <Placeholder />}
          <MessageList
            messages={messages}
            userId={user.id}
            resetUnreadMessages={markMessagesAsRead}
          />
        </div>
      </InfiniteScroll>
      <MessageInput
        resetUnreadMessages={markMessagesAsRead}
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

export default withErrorBoundary(ChatPane)
