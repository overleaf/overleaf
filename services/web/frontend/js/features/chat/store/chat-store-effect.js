import { useState, useEffect } from 'react'
import { ChatStore } from './chat-store'

let chatStore

export function resetChatStore() {
  chatStore = undefined
}

export function useChatStore() {
  if (!chatStore) {
    chatStore = new ChatStore()
  }

  function getStateFromStore() {
    return {
      userId: window.user.id,
      atEnd: chatStore.atEnd,
      loading: chatStore.loading,
      messages: chatStore.messages,
      loadMoreMessages: () => chatStore.loadMoreMessages(),
      sendMessage: message => chatStore.sendMessage(message)
    }
  }

  const [storeState, setStoreState] = useState(getStateFromStore())

  useEffect(() => {
    function handleStoreUpdated() {
      setStoreState(getStateFromStore())
    }
    chatStore.on('updated', handleStoreUpdated)
    return () => chatStore.off('updated', handleStoreUpdated)
  }, [])

  return storeState
}
