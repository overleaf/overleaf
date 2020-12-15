import { useState, useEffect, useRef } from 'react'
import { ChatStore } from './chat-store'
import { useApplicationContext } from '../../../shared/context/application-context'
import { useEditorContext } from '../../../shared/context/editor-context'

export function useChatStore() {
  const { user } = useApplicationContext()
  const { projectId } = useEditorContext()

  const chatStoreRef = useRef(new ChatStore(user, projectId))

  const [atEnd, setAtEnd] = useState(chatStoreRef.current.atEnd)
  const [loading, setLoading] = useState(chatStoreRef.current.loading)
  const [messages, setMessages] = useState(chatStoreRef.current.messages)

  useEffect(() => {
    const chatStore = chatStoreRef.current
    function handleStoreUpdated() {
      setAtEnd(chatStore.atEnd)
      setLoading(chatStore.loading)
      setMessages(chatStore.messages)
    }
    chatStore.on('updated', handleStoreUpdated)
    return () => chatStore.destroy()
  }, [chatStoreRef])

  return {
    userId: user.id,
    atEnd,
    loading,
    messages,
    loadMoreMessages: () => chatStoreRef.current.loadMoreMessages(),
    sendMessage: message => chatStoreRef.current.sendMessage(message)
  }
}
