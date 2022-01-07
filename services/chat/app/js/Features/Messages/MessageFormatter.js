// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MessageFormatter
module.exports = MessageFormatter = {
  formatMessageForClientSide(message) {
    if (message._id) {
      message.id = message._id.toString()
      delete message._id
    }
    const formattedMessage = {
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
      user_id: message.user_id,
    }
    if (message.edited_at) {
      formattedMessage.edited_at = message.edited_at
    }
    return formattedMessage
  },

  formatMessagesForClientSide(messages) {
    return Array.from(messages).map(message =>
      this.formatMessageForClientSide(message)
    )
  },

  groupMessagesByThreads(rooms, messages) {
    let room, thread
    const roomsById = {}
    for (room of Array.from(rooms)) {
      roomsById[room._id.toString()] = room
    }

    const threads = {}
    const getThread = function (room) {
      const threadId = room.thread_id.toString()
      if (threads[threadId]) {
        return threads[threadId]
      } else {
        const thread = { messages: [] }
        if (room.resolved) {
          thread.resolved = true
          thread.resolved_at = room.resolved.ts
          thread.resolved_by_user_id = room.resolved.user_id
        }
        threads[threadId] = thread
        return thread
      }
    }

    for (const message of Array.from(messages)) {
      room = roomsById[message.room_id.toString()]
      if (room) {
        thread = getThread(room)
        thread.messages.push(
          MessageFormatter.formatMessageForClientSide(message)
        )
      }
    }

    for (const threadId in threads) {
      thread = threads[threadId]
      thread.messages.sort((a, b) => a.timestamp - b.timestamp)
    }

    return threads
  },
}
