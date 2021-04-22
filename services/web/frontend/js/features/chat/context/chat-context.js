import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect
} from 'react'
import PropTypes from 'prop-types'
import { useApplicationContext } from '../../../shared/context/application-context'
import { useEditorContext } from '../../../shared/context/editor-context'
import { ChatStore } from '../store/chat-store'
import useBrowserWindow from '../../../infrastructure/browser-window-hook'
import { useLayoutContext } from '../../../shared/context/layout-context'

export const ChatContext = createContext()

ChatContext.Provider.propTypes = {
  value: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    atEnd: PropTypes.bool,
    loading: PropTypes.bool,
    messages: PropTypes.array.isRequired,
    unreadMessageCount: PropTypes.number.isRequired,
    resetUnreadMessageCount: PropTypes.func.isRequired,
    loadMoreMessages: PropTypes.func.isRequired,
    sendMessage: PropTypes.func.isRequired
  }).isRequired
}

export function ChatProvider({ children }) {
  const {
    hasFocus: windowHasFocus,
    flashTitle,
    stopFlashingTitle
  } = useBrowserWindow()
  const { user } = useApplicationContext({
    user: PropTypes.shape({ id: PropTypes.string.isRequired }.isRequired)
  })
  const { projectId } = useEditorContext({
    projectId: PropTypes.string.isRequired
  })

  const { chatIsOpen } = useLayoutContext({ chatIsOpen: PropTypes.bool })

  const [unreadMessageCount, setUnreadMessageCount] = useState(0)
  function resetUnreadMessageCount() {
    setUnreadMessageCount(0)
  }

  const [atEnd, setAtEnd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])

  const [store] = useState(() => new ChatStore(user, projectId))

  useEffect(() => {
    if (windowHasFocus) {
      stopFlashingTitle()
      if (chatIsOpen) {
        setUnreadMessageCount(0)
      }
    }
    if (!windowHasFocus && unreadMessageCount > 0) {
      flashTitle('New Message')
    }
  }, [
    windowHasFocus,
    chatIsOpen,
    unreadMessageCount,
    flashTitle,
    stopFlashingTitle
  ])

  useEffect(() => {
    function updateState() {
      setAtEnd(store.atEnd)
      setLoading(store.loading)
      setMessages(store.messages)
    }

    function handleNewMessage() {
      setUnreadMessageCount(prevCount => prevCount + 1)
    }

    store.on('updated', updateState)
    store.on('message-received', handleNewMessage)

    updateState()

    return () => store.destroy()
  }, [store])

  const loadMoreMessages = useCallback(() => store.loadMoreMessages(), [store])
  const sendMessage = useCallback(message => store.sendMessage(message), [
    store
  ])

  const value = {
    userId: user.id,
    atEnd,
    loading,
    messages,
    unreadMessageCount,
    resetUnreadMessageCount,
    loadMoreMessages,
    sendMessage
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

ChatProvider.propTypes = {
  children: PropTypes.any
}

export function useChatContext(propTypes) {
  const data = useContext(ChatContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'ChatContext.Provider')
  return data
}
