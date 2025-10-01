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
import clientIdGenerator from '@/utils/client-id'
import { useUserContext } from '../../../shared/context/user-context'
import { useProjectContext } from '../../../shared/context/project-context'
import {
  deleteJSON,
  getJSON,
  postJSON,
} from '../../../infrastructure/fetch-json'
import {
  appendMessage,
  confirmMessage,
  deleteMessage,
  editMessage,
  prependMessages,
} from '../utils/message-list-utils'
import useBrowserWindow from '../../../shared/hooks/use-browser-window'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { useIdeContext } from '@/shared/context/ide-context'
import getMeta from '@/utils/meta'
import { debugConsole } from '@/utils/debugging'
import { User } from '../../../../../types/user'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

const PAGE_SIZE = 50

export type Message = {
  id: string
  timestamp: number
  content: string
  user?: User
  edited?: boolean
  deleted?: boolean
  pending?: boolean
}

export type ServerMessageEntry = Message & {
  content: string
  edited_at?: number
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
  idOfMessageBeingEdited: Message['id'] | null
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
      messages: ServerMessageEntry[]
    }
  | {
      type: 'SEND_MESSAGE'
      user: any
      content: string
    }
  | {
      type: 'RECEIVE_MESSAGE'
      message: ServerMessageEntry
    }
  | {
      type: 'RECEIVE_OWN_MESSAGE'
      message: any
    }
  | {
      type: 'MARK_MESSAGES_AS_READ'
    }
  | {
      type: 'DELETE_MESSAGE'
      messageId: Message['id']
    }
  | {
      type: 'START_EDITING_MESSAGE'
      messageId: Message['id']
    }
  | {
      type: 'CANCEL_MESSAGE_EDIT'
    }
  | {
      type: 'RECEIVE_MESSAGE_EDIT'
      messageId: Message['id']
      content: string
    }
  | {
      type: 'CLEAR'
    }
  | {
      type: 'ERROR'
      error: any
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
            pending: true,
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

    case 'RECEIVE_OWN_MESSAGE':
      return {
        ...state,
        ...confirmMessage(action.message, state.messages),
      }

    case 'DELETE_MESSAGE':
      return {
        ...state,
        ...deleteMessage(action.messageId, state.messages),
      }

    case 'START_EDITING_MESSAGE':
      return {
        ...state,
        idOfMessageBeingEdited: action.messageId,
      }

    case 'CANCEL_MESSAGE_EDIT':
      return {
        ...state,
        idOfMessageBeingEdited: null,
      }

    case 'RECEIVE_MESSAGE_EDIT':
      return {
        ...state,
        ...editMessage(action.messageId, action.content, state.messages),
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
  idOfMessageBeingEdited: null,
}

export const ChatContext = createContext<
  | {
      status: 'idle' | 'pending' | 'error'
      messages: Message[]
      initialMessagesLoaded: boolean
      atEnd: boolean
      unreadMessageCount: number
      idOfMessageBeingEdited: State['idOfMessageBeingEdited']
      loadInitialMessages: () => void
      loadMoreMessages: () => void
      sendMessage: (message: any) => void
      markMessagesAsRead: () => void
      deleteMessage: (messageId: Message['id']) => void
      startedEditingMessage: (messageId: Message['id']) => void
      cancelMessageEdit: () => void
      editMessage: (messageId: Message['id'], content: string) => void
      reset: () => void
      error?: Error | null
    }
  | undefined
>(undefined)

export const ChatProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const chatEnabled = getMeta('ol-capabilities')?.includes('chat')

  const clientId = useRef<string>()
  if (clientId.current === undefined) {
    clientId.current = clientIdGenerator.get()
  }
  const user = useUserContext()
  const { projectId } = useProjectContext()

  const { chatIsOpen: chatIsOpenOldEditor } = useLayoutContext()
  const { selectedTab: selectedRailTab, isOpen: railIsOpen } = useRailContext()
  const newEditor = useIsNewEditorEnabled()
  const chatIsOpen = newEditor
    ? selectedRailTab === 'chat' && railIsOpen
    : chatIsOpenOldEditor

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
    (content: string) => {
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

  const startedEditingMessage = useCallback(
    (messageId: Message['id']) => {
      if (!chatEnabled) {
        debugConsole.warn(`chat is disabled, won't send message`)
        return
      }

      dispatch({
        type: 'START_EDITING_MESSAGE',
        messageId,
      })
    },
    [chatEnabled]
  )

  const cancelMessageEdit = useCallback(() => {
    if (!chatEnabled) {
      debugConsole.warn(`chat is disabled, won't cancel message edit`)
      return
    }

    dispatch({
      type: 'CANCEL_MESSAGE_EDIT',
    })
  }, [chatEnabled])

  const markMessagesAsRead = useCallback(() => {
    if (!chatEnabled) {
      debugConsole.warn(`chat is disabled, won't mark messages as read`)
      return
    }
    dispatch({ type: 'MARK_MESSAGES_AS_READ' })
  }, [chatEnabled])

  const deleteMessage = useCallback(
    (messageId: Message['id']) => {
      if (!chatEnabled) {
        debugConsole.warn(`chat is disabled, won't delete message`)
        return
      }
      if (!messageId) return

      dispatch({
        type: 'DELETE_MESSAGE',
        messageId,
      })

      deleteJSON(`/project/${projectId}/messages/${messageId}`).catch(error => {
        dispatch({
          type: 'ERROR',
          error,
        })
      })
    },
    [chatEnabled, projectId]
  )

  const editMessage = useCallback(
    (messageId: Message['id'], content: string) => {
      if (!chatEnabled) {
        debugConsole.warn(`chat is disabled, won't edit message`)
        return
      }
      if (!messageId || !content) return

      dispatch({
        type: 'RECEIVE_MESSAGE_EDIT',
        messageId,
        content,
      })

      dispatch({
        type: 'CANCEL_MESSAGE_EDIT',
      })

      postJSON(`/project/${projectId}/messages/${messageId}/edit`, {
        body: { content },
      }).catch(error => {
        dispatch({
          type: 'ERROR',
          error,
        })
      })
    },
    [chatEnabled, projectId]
  )

  // Handling receiving and deleting messages over the socket
  const { socket } = useIdeContext()
  useEffect(() => {
    if (!chatEnabled || !socket) return

    function receivedMessage(message: any) {
      // If the message is from the current client id, then we are receiving the
      // sent message back from the socket. In this case, we want to update the
      // message in our local state with the ID of the message on the server.
      // Ignore it to prevent double message.
      if (message.clientId === clientId.current) {
        dispatch({ type: 'RECEIVE_OWN_MESSAGE', message })
      } else {
        dispatch({ type: 'RECEIVE_MESSAGE', message })
      }
    }

    function deletedMessage(message: {
      messageId: Message['id']
      userId: User['id']
    }) {
      if (message.userId === user.id) return

      dispatch({
        type: 'DELETE_MESSAGE',
        messageId: message.messageId,
      })
    }

    function editedMessage(message: {
      messageId: Message['id']
      userId: User['id']
      content: string
    }) {
      if (message.userId === user.id) return

      dispatch({
        type: 'RECEIVE_MESSAGE_EDIT',
        messageId: message.messageId,
        content: message.content,
      })
    }

    socket.on('new-chat-message', receivedMessage)
    socket.on('delete-global-message', deletedMessage)
    socket.on('edit-global-message', editedMessage)

    return () => {
      if (!socket) return

      socket.removeListener('new-chat-message', receivedMessage)
      socket.removeListener('delete-global-message', deletedMessage)
      socket.removeListener('edit-global-message', editedMessage)
    }
  }, [chatEnabled, socket, user.id])

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
      idOfMessageBeingEdited: state.idOfMessageBeingEdited,
      loadInitialMessages,
      loadMoreMessages,
      reset,
      sendMessage,
      markMessagesAsRead,
      deleteMessage,
      startedEditingMessage,
      cancelMessageEdit,
      editMessage,
      error: state.error,
    }),
    [
      loadInitialMessages,
      loadMoreMessages,
      markMessagesAsRead,
      deleteMessage,
      startedEditingMessage,
      cancelMessageEdit,
      editMessage,
      reset,
      sendMessage,
      state.atEnd,
      state.error,
      state.initialMessagesLoaded,
      state.messages,
      state.status,
      state.unreadMessageCount,
      state.idOfMessageBeingEdited,
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
