import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useMemo,
} from 'react'
import PropTypes from 'prop-types'
import { v4 as uuid } from 'uuid'

import { useApplicationContext } from '../../../shared/context/application-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { getJSON, postJSON } from '../../../infrastructure/fetch-json'
import { appendMessage, prependMessages } from '../utils/message-list-appender'
import useBrowserWindow from '../../../shared/hooks/use-browser-window'
import { useLayoutContext } from '../../../shared/context/layout-context'

const PAGE_SIZE = 50

export function chatReducer(state, action) {
  switch (action.type) {
    case 'INITIAL_FETCH_MESSAGES':
      return {
        ...state,
        status: 'pending',
        initialMessagesLoaded: true,
      }

    case 'FETCH_MESSAGES':
      return {
        ...state,
        status: 'pending',
      }

    case 'FETCH_MESSAGES_SUCCESS':
      return {
        ...state,
        status: 'idle',
        messages: prependMessages(state.messages, action.messages),
        lastTimestamp: action.messages[0] ? action.messages[0].timestamp : null,
        atEnd: action.messages.length < PAGE_SIZE,
      }

    case 'SEND_MESSAGE':
      return {
        ...state,
        messages: appendMessage(state.messages, {
          // Messages are sent optimistically, so don't have an id (used for
          // React keys). The uuid is valid for this session, and ensures all
          // messages have an id. It will be overwritten by the actual ids on
          // refresh
          id: uuid(),
          user: action.user,
          content: action.content,
          timestamp: Date.now(),
        }),
        messageWasJustSent: true,
      }

    case 'RECEIVE_MESSAGE':
      return {
        ...state,
        messages: appendMessage(state.messages, action.message),
        messageWasJustSent: false,
        unreadMessageCount: state.unreadMessageCount + 1,
      }

    case 'MARK_MESSAGES_AS_READ':
      return {
        ...state,
        unreadMessageCount: 0,
      }

    case 'CLEAR':
      return { ...initialState }

    case 'ERROR':
      return {
        ...state,
        status: 'error',
        error: action.error,
      }

    default:
      throw new Error('Unknown action')
  }
}

const initialState = {
  status: 'idle',
  messages: [],
  initialMessagesLoaded: false,
  lastTimestamp: null,
  atEnd: false,
  messageWasJustSent: false,
  unreadMessageCount: 0,
  error: null,
}

export const ChatContext = createContext()

ChatContext.Provider.propTypes = {
  value: PropTypes.shape({
    status: PropTypes.string.isRequired,
    messages: PropTypes.array.isRequired,
    initialMessagesLoaded: PropTypes.bool.isRequired,
    atEnd: PropTypes.bool.isRequired,
    unreadMessageCount: PropTypes.number.isRequired,
    loadInitialMessages: PropTypes.func.isRequired,
    loadMoreMessages: PropTypes.func.isRequired,
    sendMessage: PropTypes.func.isRequired,
    markMessagesAsRead: PropTypes.func.isRequired,
    reset: PropTypes.func.isRequired,
    error: PropTypes.object,
  }).isRequired,
}

export function ChatProvider({ children }) {
  const { user } = useApplicationContext({
    user: PropTypes.shape({ id: PropTypes.string.isRequired }),
  })
  const { _id: projectId } = useProjectContext({
    _id: PropTypes.string.isRequired,
  })

  const { chatIsOpen } = useLayoutContext({ chatIsOpen: PropTypes.bool })

  const {
    hasFocus: windowHasFocus,
    flashTitle,
    stopFlashingTitle,
  } = useBrowserWindow()

  const [state, dispatch] = useReducer(chatReducer, initialState)

  const { loadInitialMessages, loadMoreMessages, reset } = useMemo(() => {
    function fetchMessages() {
      if (state.atEnd) return

      const query = { limit: PAGE_SIZE }

      if (state.lastTimestamp) {
        query.before = state.lastTimestamp
      }

      const queryString = new URLSearchParams(query)
      const url = `/project/${projectId}/messages?${queryString.toString()}`

      getJSON(url)
        .then((messages = []) => {
          dispatch({
            type: 'FETCH_MESSAGES_SUCCESS',
            messages: messages.reverse(),
          })
        })
        .catch(error => {
          dispatch({
            type: 'ERROR',
            error: error,
          })
        })
    }

    function loadInitialMessages() {
      if (state.initialMessagesLoaded) return

      dispatch({ type: 'INITIAL_FETCH_MESSAGES' })
      fetchMessages()
    }

    function loadMoreMessages() {
      dispatch({ type: 'FETCH_MESSAGES' })
      fetchMessages()
    }

    function reset() {
      dispatch({ type: 'CLEAR' })
      fetchMessages()
    }

    return {
      loadInitialMessages,
      loadMoreMessages,
      reset,
    }
  }, [projectId, state.atEnd, state.initialMessagesLoaded, state.lastTimestamp])

  const sendMessage = useCallback(
    content => {
      if (!content) return

      dispatch({
        type: 'SEND_MESSAGE',
        user,
        content,
      })

      const url = `/project/${projectId}/messages`
      postJSON(url, {
        body: { content },
      }).catch(error => {
        dispatch({
          type: 'ERROR',
          error: error,
        })
      })
    },
    [projectId, user]
  )

  const markMessagesAsRead = useCallback(() => {
    dispatch({ type: 'MARK_MESSAGES_AS_READ' })
  }, [])

  // Handling receiving messages over the socket
  const socket = window._ide?.socket
  useEffect(() => {
    if (!socket) return

    function receivedMessage(message) {
      // If the message is from the current user and they just sent a message,
      // then we are receiving the sent message back from the socket. Ignore it
      // to prevent double message
      const messageIsFromSelf = message?.user?.id === user?.id
      if (messageIsFromSelf && state.messageWasJustSent) return

      dispatch({ type: 'RECEIVE_MESSAGE', message })

      // Temporary workaround to pass state to unread message balloon in Angular
      window.dispatchEvent(
        new CustomEvent('Chat.MessageReceived', { detail: { message } })
      )
    }

    socket.on('new-chat-message', receivedMessage)
    return () => {
      if (!socket) return

      socket.removeListener('new-chat-message', receivedMessage)
    }
    // We're adding and removing the socket listener every time we send a
    // message (and messageWasJustSent changes). Not great, but no good way
    // around it
  }, [socket, state.messageWasJustSent, state.unreadMessageCount, user])

  // Handle unread messages
  useEffect(() => {
    if (windowHasFocus) {
      stopFlashingTitle()
      if (chatIsOpen) {
        markMessagesAsRead()
      }
    }
    if (!windowHasFocus && state.unreadMessageCount > 0) {
      flashTitle('New Message')
    }
  }, [
    windowHasFocus,
    chatIsOpen,
    state.unreadMessageCount,
    flashTitle,
    stopFlashingTitle,
    markMessagesAsRead,
  ])

  const value = useMemo(
    () => ({
      status: state.status,
      messages: state.messages,
      initialMessagesLoaded: state.initialMessagesLoaded,
      atEnd: state.atEnd,
      unreadMessageCount: state.unreadMessageCount,
      loadInitialMessages,
      loadMoreMessages,
      reset,
      sendMessage,
      markMessagesAsRead,
      error: state.error,
    }),
    [
      loadInitialMessages,
      loadMoreMessages,
      markMessagesAsRead,
      reset,
      sendMessage,
      state.atEnd,
      state.error,
      state.initialMessagesLoaded,
      state.messages,
      state.status,
      state.unreadMessageCount,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

ChatProvider.propTypes = {
  children: PropTypes.any,
}

export function useChatContext(propTypes) {
  const data = useContext(ChatContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'ChatContext.Provider')
  return data
}
