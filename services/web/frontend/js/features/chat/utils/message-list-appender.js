const TIMESTAMP_GROUP_SIZE = 5 * 60 * 1000 // 5 minutes

export function appendMessage(messageList, message) {
  const lastMessage = messageList[messageList.length - 1]

  const shouldGroup =
    lastMessage &&
    message &&
    message.user &&
    message.user.id &&
    message.user.id === lastMessage.user.id &&
    message.timestamp - lastMessage.timestamp < TIMESTAMP_GROUP_SIZE

  if (shouldGroup) {
    return messageList.slice(0, messageList.length - 1).concat({
      ...lastMessage,
      // the `id` is updated to the latest received content when a new
      // message is appended or prepended
      id: message.id,
      timestamp: message.timestamp,
      contents: lastMessage.contents.concat(message.content),
    })
  } else {
    return messageList.slice(0).concat({
      id: message.id,
      user: message.user,
      timestamp: message.timestamp,
      contents: [message.content],
    })
  }
}

export function prependMessages(messageList, messages) {
  const listCopy = messageList.slice(0)
  messages
    .slice(0)
    .reverse()
    .forEach(message => {
      const firstMessage = listCopy[0]
      const shouldGroup =
        firstMessage &&
        message &&
        message.user &&
        message.user.id === firstMessage.user.id &&
        firstMessage.timestamp - message.timestamp < TIMESTAMP_GROUP_SIZE

      if (shouldGroup) {
        firstMessage.id = message.id
        firstMessage.timestamp = message.timestamp
        firstMessage.contents = [message.content].concat(firstMessage.contents)
      } else {
        listCopy.unshift({
          id: message.id,
          user: message.user,
          timestamp: message.timestamp,
          contents: [message.content],
        })
      }
    })
  return listCopy
}
