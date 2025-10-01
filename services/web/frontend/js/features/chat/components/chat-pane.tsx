import React, { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import MessageInput from './message-input'
import InfiniteScroll from './infinite-scroll'
import ChatFallbackError from './chat-fallback-error'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useUserContext } from '../../../shared/context/user-context'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { FetchError } from '../../../infrastructure/fetch-json'
import { useChatContext } from '../context/chat-context'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'

const MessageList = lazy(() => import('./message-list'))

const Loading = () => <FullSizeLoadingSpinner delay={500} className="pt-4" />

const ChatPane = React.memo(function ChatPane() {
  const { t } = useTranslation()

  const { chatIsOpen } = useLayoutContext()
  const user = useUserContext()

  const {
    status,
    messages,
    initialMessagesLoaded,
    atEnd,
    loadInitialMessages,
    loadMoreMessages,
    reset,
    sendMessage,
    markMessagesAsRead,
    error,
  } = useChatContext()

  useEffect(() => {
    if (chatIsOpen && !initialMessagesLoaded) {
      loadInitialMessages()
    }
  }, [chatIsOpen, loadInitialMessages, initialMessagesLoaded])

  const shouldDisplayPlaceholder = status !== 'pending' && messages.length === 0

  const messageContentCount = messages.length

  // Keep the chat pane in the DOM to avoid resetting the form input and re-rendering MathJax content.
  const [chatOpenedOnce, setChatOpenedOnce] = useState(chatIsOpen)
  useEffect(() => {
    if (chatIsOpen) {
      setChatOpenedOnce(true)
    }
  }, [chatIsOpen])

  if (error) {
    // let user try recover from fetch errors
    if (error instanceof FetchError) {
      return <ChatFallbackError reconnect={reset} />
    }
    throw error
  }

  if (!user) {
    return null
  }
  if (!chatOpenedOnce) {
    return null
  }

  return (
    <aside className="chat" aria-label={t('chat')}>
      <InfiniteScroll
        atEnd={atEnd}
        className="messages"
        fetchData={loadMoreMessages}
        isLoading={status === 'pending'}
        itemCount={messageContentCount}
      >
        <div>
          <h2 className="visually-hidden">{t('chat')}</h2>
          <Suspense fallback={<Loading />}>
            {status === 'pending' && <Loading />}
            {shouldDisplayPlaceholder && <Placeholder />}
            <MessageList
              messages={messages}
              resetUnreadMessages={markMessagesAsRead}
            />
          </Suspense>
        </div>
      </InfiniteScroll>
      <MessageInput
        resetUnreadMessages={markMessagesAsRead}
        sendMessage={sendMessage}
      />
    </aside>
  )
})

function Placeholder() {
  const { t } = useTranslation()
  return (
    <>
      <div className="no-messages text-center small">{t('no_messages')}</div>
      <div className="first-message text-center">
        {t('send_first_message')}
        <br />
        <MaterialIcon type="arrow_downward" />
      </div>
    </>
  )
}

export default withErrorBoundary(ChatPane, () => <ChatFallbackError />)
