import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useMemo,
  useRef,
  FC,
} from 'react'
import { v4 as uuid } from 'uuid'

import { useUserContext } from '../../../shared/context/user-context'
import { useProjectContext } from '../../../shared/context/project-context'
import { getJSON, postJSON } from '../../../infrastructure/fetch-json'
import { appendMessage, prependMessages } from '../utils/message-list-appender'
import useBrowserWindow from '../../../shared/hooks/use-browser-window'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useIdeContext } from '@/shared/context/ide-context'
import getMeta from '@/utils/meta'
import { debugConsole } from '@/utils/debugging'
import { User } from '../../../../../types/user'

const PAGE_SIZE = 50

export type Message = {
  id: string
  timestamp: number
  contents: string[]
  user: User
}

type State = {
  status: 'idle' | 'pending' | 'error'
  messages: Message[]
  initialMessagesLoaded: boolean
  lastTimestamp: number | null
  atEnd: boolean
  unreadMessageCount: number
  error?: Error | null
  uniqueMessageIds: string[]
}

type Action =
  | {
      type: 'INITIAL_FETCH_MESSAGES'
    }
  | {
      type: 'FETCH_MESSAGES'
    }
  | {
      type: 'FETCH_MESSAGES_SUCCESS'
      messages: Message[]
    }
  | {
      type: 'SEND_MESSAGE'
      user: any
      content: any
    }
  | {
      type: 'RECEIVE_MESSAGE'
      message: any
    }
  | {
      type: 'MARK_MESSAGES_AS_READ'
    }
  | {
      type: 'CLEAR'
    }
  | {
      type: 'ERROR'
      error: any
    }

// Wrap uuid in an object method so that it can be stubbed
export const chatClientIdGenerator = {
  generate: () => uuid(),
}

let nextChatMessageId = 1

function generateChatMessageId() {
  return '' + nextChatMessageId++
}

function chatReducer(state: State, action: Action): State {
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
        ...prependMessages(
          state.messages,
          action.messages,
          state.uniqueMessageIds
        ),
        lastTimestamp: action.messages[0] ? action.messages[0].timestamp : null,
        atEnd: action.messages.length < PAGE_SIZE,
      }

    case 'SEND_MESSAGE':
      return {
        ...state,
        ...appendMessage(
          state.messages,
          {
            // Messages are sent optimistically, so don't have an id (used for
            // React keys). The id is valid for this session, and ensures all
            // messages have an id. It will be overwritten by the actual ids on
            // refresh
            id: generateChatMessageId(),
            user: action.user,
            content: action.content,
            timestamp: Date.now(),
          },
          state.uniqueMessageIds
        ),
      }

    case 'RECEIVE_MESSAGE':
      return {
        ...state,
        ...appendMessage(
          state.messages,
          action.message,
          state.uniqueMessageIds
        ),
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

const initialState: State = {
  status: 'idle',
  messages: [],
  initialMessagesLoaded: false,
  lastTimestamp: null,
  atEnd: false,
  unreadMessageCount: 0,
  error: null,
  uniqueMessageIds: [],
}

export const ChatContext = createContext<
  | {
      status: 'idle' | 'pending' | 'error'
      messages: Message[]
      initialMessagesLoaded: boolean
      atEnd: boolean
      unreadMessageCount: number
      loadInitialMessages: () => void
      loadMoreMessages: () => void
      sendMessage: (message: any) => void
      markMessagesAsRead: () => void
      reset: () => void
      error?: Error | null
    }
  | undefined
>(undefined)

export const ChatProvider: FC = ({ children }) => {
  const chatEnabled = getMeta('ol-chatEnabled')

  const clientId = useRef<string>()
  if (clientId.current === undefined) {
    clientId.current = chatClientIdGenerator.generate()
  }
  const user = useUserContext()
  const { _id: projectId } = useProjectContext()

  const { chatIsOpen } = useLayoutContext()

  const {
    hasFocus: windowHasFocus,
    flashTitle,
    stopFlashingTitle,
  } = useBrowserWindow()

  const [state, dispatch] = useReducer(chatReducer, initialState)

  const { loadInitialMessages, loadMoreMessages, reset } = useMemo(() => {
    function fetchMessages() {
      if (state.atEnd) return

      const query: Record<string, string> = {
        limit: String(PAGE_SIZE),
      }

      if (state.lastTimestamp) {
        query.before = String(state.lastTimestamp)
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
            error,
          })
        })
    }

    function loadInitialMessages() {
      if (!chatEnabled) {
        debugConsole.warn(`chat is disabled, won't load initial messages`)
        return
      }
      if (state.initialMessagesLoaded) return

      dispatch({ type: 'INITIAL_FETCH_MESSAGES' })
      fetchMessages()
    }

    function loadMoreMessages() {
      if (!chatEnabled) {
        debugConsole.warn(`chat is disabled, won't load messages`)
        return
      }
      dispatch({ type: 'FETCH_MESSAGES' })
      fetchMessages()
    }

    function reset() {
      if (!chatEnabled) {
        debugConsole.warn(`chat is disabled, won't reset chat`)
        return
      }
      dispatch({ type: 'CLEAR' })
      fetchMessages()
    }

    return {
      loadInitialMessages,
      loadMoreMessages,
      reset,
    }
  }, [
    chatEnabled,
    projectId,
    state.atEnd,
    state.initialMessagesLoaded,
    state.lastTimestamp,
  ])

  const sendMessage = useCallback(
    content => {
      if (!chatEnabled) {
        debugConsole.warn(`chat is disabled, won't send message`)
        return
      }
      if (!content) return

      dispatch({
        type: 'SEND_MESSAGE',
        user,
        content,
      })

      const url = `/project/${projectId}/messages`
      postJSON(url, {
        body: { content, client_id: clientId.current },
      }).catch(error => {
        dispatch({
          type: 'ERROR',
          error,
        })
      })
    },
    [chatEnabled, projectId, user]
  )

  const markMessagesAsRead = useCallback(() => {
    if (!chatEnabled) {
      debugConsole.warn(`chat is disabled, won't mark messages as read`)
      return
    }
    dispatch({ type: 'MARK_MESSAGES_AS_READ' })
  }, [chatEnabled])

  // Handling receiving messages over the socket
  const { socket } = useIdeContext()
  useEffect(() => {
    if (!chatEnabled || !socket) return

    function receivedMessage(message: any) {
      // If the message is from the current client id, then we are receiving the sent message back from the socket.
      // Ignore it to prevent double message.
      if (message.clientId === clientId.current) return

      dispatch({ type: 'RECEIVE_MESSAGE', message })
    }

    socket.on('new-chat-message', receivedMessage)
    return () => {
      if (!socket) return

      socket.removeListener('new-chat-message', receivedMessage)
    }
  }, [chatEnabled, socket])

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

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext is only available inside ChatProvider')
  }
  return context
}
