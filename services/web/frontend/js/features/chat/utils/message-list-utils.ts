import { Message, ServerMessageEntry } from '../context/chat-context'

export function appendMessage(
  messageList: Message[],
  message: ServerMessageEntry,
  uniqueMessageIds: string[]
) {
  if (uniqueMessageIds.includes(message.id)) {
    return { messages: messageList, uniqueMessageIds }
  }

  uniqueMessageIds = uniqueMessageIds.slice(0)

  uniqueMessageIds.push(message.id)

  messageList = messageList.slice(0).concat({
    id: message.id,
    user: message.user,
    timestamp: message.timestamp,
    content: message.content,
    pending: message.pending,
    edited: Boolean(message.edited_at),
  })

  return { messages: messageList, uniqueMessageIds }
}

export function prependMessages(
  messageList: Message[],
  messages: ServerMessageEntry[],
  uniqueMessageIds: string[]
) {
  const listCopy = messageList.slice(0)

  uniqueMessageIds = uniqueMessageIds.slice(0)

  messages
    .slice(0)
    .reverse()
    .forEach(message => {
      if (uniqueMessageIds.includes(message.id)) {
        return
      }
      uniqueMessageIds.push(message.id)

      listCopy.unshift({
        id: message.id,
        user: message.user,
        timestamp: message.timestamp,
        content: message.content,
        edited: Boolean(message.edited_at),
      })
    })

  return { messages: listCopy, uniqueMessageIds }
}

export function confirmMessage(
  updatedMessage: Message,
  messageList: Message[]
) {
  // Find our message and change its ID from the temporary one we generated
  // on creation to the ID assigned to it by the server. This is so that the
  // message can be deleted later, for which we need the server ID.
  const ownMessageIndex = messageList.findIndex(
    message => message.pending && message.content === updatedMessage.content
  )
  if (ownMessageIndex === -1) {
    throw new Error("Couldn't find own message in local state")
  }
  const messageWithOldId = messageList[ownMessageIndex]

  const newMessageList = [...messageList]
  newMessageList.splice(ownMessageIndex, 1, {
    ...messageWithOldId,
    pending: false,
    id: updatedMessage.id,
    user: updatedMessage.user,
    timestamp: updatedMessage.timestamp,
    content: updatedMessage.content,
  })

  return {
    messages: newMessageList,
    uniqueMessageIds: Array.from(
      new Set(newMessageList.map(message => message.id))
    ),
  }
}

export function deleteMessage(messageId: string, messageList: Message[]) {
  const messageIndex = messageList.findIndex(
    message => message.id === messageId
  )
  if (messageIndex === -1) {
    throw new Error(`Message with id ${messageId} not found in message list`)
  }

  const newMessageList = [...messageList]
  const message = newMessageList[messageIndex]
  newMessageList.splice(messageIndex, 1, {
    ...message,
    deleted: true,
  })

  return {
    messages: newMessageList,
  }
}

export function editMessage(
  messageId: string,
  content: string,
  messageList: Message[]
) {
  const messageIndex = messageList.findIndex(
    message => message.id === messageId
  )
  if (messageIndex === -1) {
    throw new Error(`Message with id ${messageId} not found in message list`)
  }

  const newMessageList = [...messageList]
  const message = newMessageList[messageIndex]
  newMessageList.splice(messageIndex, 1, {
    ...message,
    content,
    edited: true,
  })

  return {
    messages: newMessageList,
  }
}
