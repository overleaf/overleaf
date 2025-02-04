import ChatFallbackError from '@/features/chat/components/chat-fallback-error'
import InfiniteScroll from '@/features/chat/components/infinite-scroll'
import MessageInput from '@/features/chat/components/message-input'
import { useChatContext } from '@/features/chat/context/chat-context'
import OLBadge from '@/features/ui/components/ol/ol-badge'
import { FetchError } from '@/infrastructure/fetch-json'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import { useUserContext } from '@/shared/context/user-context'
import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const MessageList = lazy(() => import('../../chat/components/message-list'))

export const ChatIndicator = () => {
  const { unreadMessageCount } = useChatContext()
  if (unreadMessageCount === 0) {
    return null
  }
  return <OLBadge bg="info">{unreadMessageCount}</OLBadge>
}

const Loading = () => <FullSizeLoadingSpinner delay={500} className="pt-4" />

export const ChatPane = () => {
  const { t } = useTranslation()

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
    if (!initialMessagesLoaded) {
      loadInitialMessages()
    }
  }, [loadInitialMessages, initialMessagesLoaded])

  const shouldDisplayPlaceholder = status !== 'pending' && messages.length === 0

  const messageContentCount = messages.reduce(
    (acc, { contents }) => acc + contents.length,
    0
  )

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
}

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
