import ChatFallbackError from '@/features/chat/components/chat-fallback-error'
import InfiniteScroll from '@/features/chat/components/infinite-scroll'
import MessageInput from '@/features/chat/components/message-input'
import { useChatContext } from '@/features/chat/context/chat-context'
import { FetchError } from '@/infrastructure/fetch-json'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import { useUserContext } from '@/shared/context/user-context'
import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import { RailIndicator } from '../rail/rail-indicator'
import RailPanelHeader from '../rail/rail-panel-header'

const MessageList = lazy(() => import('../../../chat/components/message-list'))

export const ChatIndicator = () => {
  const { unreadMessageCount } = useChatContext()
  if (unreadMessageCount === 0) {
    return null
  }
  return <RailIndicator count={unreadMessageCount} type="info" />
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
    <div className="chat-panel">
      <RailPanelHeader title={t('collaborator_chat')} />
      <div className="chat-wrapper">
        <aside className="chat" aria-label={t('chat')}>
          <InfiniteScroll
            atEnd={atEnd}
            className="messages"
            fetchData={loadMoreMessages}
            isLoading={status === 'pending'}
            itemCount={messages.length}
          >
            <div className={classNames({ 'h-100': shouldDisplayPlaceholder })}>
              <h2 className="visually-hidden">{t('chat')}</h2>
              <Suspense fallback={<Loading />}>
                {status === 'pending' && <Loading />}
                {shouldDisplayPlaceholder && <Placeholder />}
                <MessageList
                  messages={messages}
                  resetUnreadMessages={markMessagesAsRead}
                  newDesign
                />
              </Suspense>
            </div>
          </InfiniteScroll>
          <MessageInput
            resetUnreadMessages={markMessagesAsRead}
            sendMessage={sendMessage}
          />
        </aside>
      </div>
    </div>
  )
}

function Placeholder() {
  const { t } = useTranslation()
  return (
    <div className="chat-empty-state-placeholder">
      <div>
        <span className="chat-empty-state-icon">
          <MaterialIcon type="forum" />
        </span>
      </div>
      <div>
        <div className="chat-empty-state-title">{t('no_messages_yet')}</div>
        <div className="chat-empty-state-body">
          {t('start_the_conversation_by_saying_hello_or_sharing_an_update')}
        </div>
      </div>
    </div>
  )
}
