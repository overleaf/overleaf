import { expect } from 'chai'
import {
  appendMessage,
  prependMessages,
} from '../../../../../frontend/js/features/chat/utils/message-list-appender'

const testUser = {
  id: '123abc',
}

const otherUser = {
  id: '234other',
}

function createTestMessageList() {
  return [
    {
      id: 'msg_1',
      contents: ['hello', 'world'],
      timestamp: new Date().getTime(),
      user: otherUser,
    },
    {
      id: 'msg_2',
      contents: ['foo'],
      timestamp: new Date().getTime(),
      user: testUser,
    },
  ]
}

describe('prependMessages()', function () {
  function createTestMessages() {
    const message1 = {
      id: 'prepended_message',
      content: 'hello',
      timestamp: new Date().getTime(),
      user: testUser,
    }
    const message2 = { ...message1, id: 'prepended_message_2' }
    return [message1, message2]
  }

  it('to an empty list', function () {
    const messages = createTestMessages()
    const uniqueMessageIds = []

    expect(
      prependMessages([], messages, uniqueMessageIds).messages
    ).to.deep.equal([
      {
        id: messages[0].id,
        timestamp: messages[0].timestamp,
        user: messages[0].user,
        contents: [messages[0].content, messages[1].content],
      },
    ])
  })

  describe('when the messages to prepend are from the same user', function () {
    let list, messages, uniqueMessageIds

    beforeEach(function () {
      list = createTestMessageList()
      messages = createTestMessages()
      messages[0].user = testUser // makes all the messages have the same author
      uniqueMessageIds = []
    })

    it('when the prepended messages are close in time, contents should be merged into the same message', function () {
      const result = prependMessages(
        createTestMessageList(),
        messages,
        uniqueMessageIds
      ).messages
      expect(result.length).to.equal(list.length + 1)
      expect(result[0]).to.deep.equal({
        id: messages[0].id,
        timestamp: messages[0].timestamp,
        user: messages[0].user,
        contents: [messages[0].content, messages[1].content],
      })
    })

    it('when the prepended messages are separated in time, each message is prepended', function () {
      messages[0].timestamp = messages[1].timestamp - 6 * 60 * 1000 // 6 minutes before the next message
      const result = prependMessages(
        createTestMessageList(),
        messages,
        uniqueMessageIds
      ).messages
      expect(result.length).to.equal(list.length + 2)
      expect(result[0]).to.deep.equal({
        id: messages[0].id,
        timestamp: messages[0].timestamp,
        user: messages[0].user,
        contents: [messages[0].content],
      })
      expect(result[1]).to.deep.equal({
        id: messages[1].id,
        timestamp: messages[1].timestamp,
        user: messages[1].user,
        contents: [messages[1].content],
      })
    })
  })

  describe('when the messages to prepend are from different users', function () {
    let list, messages, uniqueMessageIds

    beforeEach(function () {
      list = createTestMessageList()
      messages = createTestMessages()
      uniqueMessageIds = []
    })

    it('should prepend separate messages to the list', function () {
      messages[0].user = otherUser
      const result = prependMessages(
        createTestMessageList(),
        messages,
        uniqueMessageIds
      ).messages
      expect(result.length).to.equal(list.length + 2)
      expect(result[0]).to.deep.equal({
        id: messages[0].id,
        timestamp: messages[0].timestamp,
        user: messages[0].user,
        contents: [messages[0].content],
      })
      expect(result[1]).to.deep.equal({
        id: messages[1].id,
        timestamp: messages[1].timestamp,
        user: messages[1].user,
        contents: [messages[1].content],
      })
    })
  })

  it('should merge the prepended messages into the first existing one when user is same user and are close in time', function () {
    const list = createTestMessageList()
    const messages = createTestMessages()
    messages[0].user = messages[1].user = list[0].user
    const uniqueMessageIds = []

    const result = prependMessages(
      createTestMessageList(),
      messages,
      uniqueMessageIds
    ).messages
    expect(result.length).to.equal(list.length)
    expect(result[0]).to.deep.equal({
      id: messages[0].id,
      timestamp: messages[0].timestamp,
      user: messages[0].user,
      contents: [messages[0].content, messages[1].content, ...list[0].contents],
    })
  })
})

describe('appendMessage()', function () {
  function createTestMessage() {
    return {
      id: 'appended_message',
      content: 'hi!',
      timestamp: new Date().getTime(),
      user: testUser,
    }
  }

  it('to an empty list', function () {
    const testMessage = createTestMessage()
    const uniqueMessageIds = []

    expect(
      appendMessage([], testMessage, uniqueMessageIds).messages
    ).to.deep.equal([
      {
        id: 'appended_message',
        timestamp: testMessage.timestamp,
        user: testMessage.user,
        contents: [testMessage.content],
      },
    ])
  })

  describe('messages appended shortly after the last message on the list', function () {
    let list, message, uniqueMessageIds

    beforeEach(function () {
      list = createTestMessageList()
      message = createTestMessage()
      message.timestamp = list[1].timestamp + 6 * 1000 // 6 seconds after the last message in the list
      uniqueMessageIds = []
    })

    describe('when the author is the same as the last message', function () {
      it('should append the content to the last message', function () {
        const result = appendMessage(list, message, uniqueMessageIds).messages
        expect(result.length).to.equal(list.length)
        expect(result[1].contents).to.deep.equal(
          list[1].contents.concat(message.content)
        )
      })

      it('should update the last message timestamp', function () {
        const result = appendMessage(list, message, uniqueMessageIds).messages
        expect(result[1].timestamp).to.equal(message.timestamp)
      })
    })

    describe('when the author is different than the last message', function () {
      beforeEach(function () {
        message.user = otherUser
      })

      it('should append the new message to the list', function () {
        const result = appendMessage(list, message, uniqueMessageIds).messages
        expect(result.length).to.equal(list.length + 1)
        expect(result[2]).to.deep.equal({
          id: 'appended_message',
          timestamp: message.timestamp,
          user: message.user,
          contents: [message.content],
        })
      })
    })
  })

  describe('messages appended later after the last message on the list', function () {
    let list, message, uniqueMessageIds

    beforeEach(function () {
      list = createTestMessageList()
      message = createTestMessage()
      message.timestamp = list[1].timestamp + 6 * 60 * 1000 // 6 minutes after the last message in the list
      uniqueMessageIds = []
    })

    it('when the author is the same as the last message, should be appended as new message', function () {
      const result = appendMessage(list, message, uniqueMessageIds).messages
      expect(result.length).to.equal(3)
      expect(result[2]).to.deep.equal({
        id: 'appended_message',
        timestamp: message.timestamp,
        user: message.user,
        contents: [message.content],
      })
    })

    it('when the author is the different than the last message, should be appended as new message', function () {
      message.user = otherUser

      const result = appendMessage(list, message, uniqueMessageIds).messages
      expect(result.length).to.equal(3)
      expect(result[2]).to.deep.equal({
        id: 'appended_message',
        timestamp: message.timestamp,
        user: message.user,
        contents: [message.content],
      })
    })
  })
})
