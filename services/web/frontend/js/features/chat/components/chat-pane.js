import React, { useEffect, useState } from 'react'
import MessageList from './message-list'
import MessageInput from './message-input'
import InfiniteScroll from './infinite-scroll'
import Icon from '../../../shared/components/icon'
import { useTranslation } from 'react-i18next'
import { useEditorContext } from '../../../shared/context/editor-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { useChatContext } from '../context/chat-context'

function ChatPane() {
  const { t } = useTranslation()

  const {
    ui: { chatIsOpen }
  } = useEditorContext()

  const {
    userId,
    atEnd,
    loading,
    loadMoreMessages,
    messages,
    sendMessage,
    resetUnreadMessageCount
  } = useChatContext()

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
            resetUnreadMessages={resetUnreadMessageCount}
          />
        </div>
      </InfiniteScroll>
      <MessageInput
        resetUnreadMessages={resetUnreadMessageCount}
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
