import { useState, useCallback, useEffect } from 'react'
import { ChatStore } from './chat-store'
import { useApplicationContext } from '../../../shared/context/application-context'
import { useEditorContext } from '../../../shared/context/editor-context'

export function useChatStore() {
  const { user } = useApplicationContext()
  const { projectId } = useEditorContext()

  const [atEnd, setAtEnd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])

  const [store] = useState(() => new ChatStore(user, projectId))
  const loadMoreMessages = useCallback(() => store.loadMoreMessages(), [store])
  const sendMessage = useCallback(message => store.sendMessage(message), [
    store
  ])

  useEffect(() => {
    function handleStoreUpdated() {
      setAtEnd(store.atEnd)
      setLoading(store.loading)
      setMessages(store.messages)
    }
    store.on('updated', handleStoreUpdated)
    return () => store.destroy()
  }, [store])

  return {
    userId: user.id,
    atEnd,
    loading,
    messages,
    loadMoreMessages,
    sendMessage
  }
}
