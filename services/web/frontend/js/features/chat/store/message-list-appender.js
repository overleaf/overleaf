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
      timestamp: message.timestamp,
      contents: lastMessage.contents.concat(message.content)
    })
  } else {
    return messageList.slice(0).concat({
      user: message.user,
      timestamp: message.timestamp,
      contents: [message.content]
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
        firstMessage.timestamp = message.timestamp
        firstMessage.contents = [message.content].concat(firstMessage.contents)
      } else {
        listCopy.unshift({
          user: message.user,
          timestamp: message.timestamp,
          contents: [message.content]
        })
      }
    })
  return listCopy
}
