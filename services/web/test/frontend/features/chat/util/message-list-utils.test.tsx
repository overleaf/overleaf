import { expect } from 'chai'
import {
  appendMessage,
  prependMessages,
  editMessage,
  deleteMessage,
  confirmMessage,
} from '../../../../../frontend/js/features/chat/utils/message-list-utils'
import { User, UserId } from '@ol-types/user'
import {
  Message,
  ServerMessageEntry,
} from '@/features/chat/context/chat-context'

const testUser: User = {
  id: '123abc' as UserId,
  email: 'test-user@example.com',
}

const otherUser: User = {
  id: '234other' as UserId,
  email: 'other-user@example.com',
}

function createTestMessageList(): Message[] {
  return [
    {
      id: 'msg_1',
      content: 'hello world',
      timestamp: new Date().getTime(),
      user: otherUser,
    },
    {
      id: 'msg_2',
      content: 'foo',
      timestamp: new Date().getTime(),
      user: testUser,
    },
  ]
}
describe('message-list-utils', function () {
  describe('prependMessages()', function () {
    function createTestMessages(): ServerMessageEntry[] {
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
      const uniqueMessageIds: string[] = []

      expect(
        prependMessages([], messages, uniqueMessageIds).messages
      ).to.deep.equal([
        {
          id: messages[0].id,
          timestamp: messages[0].timestamp,
          user: messages[0].user,
          content: messages[0].content,
          edited: false,
        },
        {
          id: messages[1].id,
          timestamp: messages[1].timestamp,
          user: messages[1].user,
          content: messages[1].content,
          edited: false,
        },
      ])
    })

    describe('when the messages to prepend are from the same user', function () {
      let list, messages: ServerMessageEntry[], uniqueMessageIds: string[]

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
        expect(result.length).to.equal(list.length + 2)
        expect(result[0]).to.deep.equal({
          id: messages[0].id,
          timestamp: messages[0].timestamp,
          user: messages[0].user,
          content: messages[0].content,
          edited: false,
        })
        expect(result[1]).to.deep.equal({
          id: messages[1].id,
          timestamp: messages[1].timestamp,
          user: messages[1].user,
          content: messages[1].content,
          edited: false,
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
          content: messages[0].content,
          edited: false,
        })
        expect(result[1]).to.deep.equal({
          id: messages[1].id,
          timestamp: messages[1].timestamp,
          user: messages[1].user,
          content: messages[1].content,
          edited: false,
        })
      })
    })

    describe('when the messages to prepend are from different users', function () {
      let list, messages: ServerMessageEntry[], uniqueMessageIds: string[]

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
          content: messages[0].content,
          edited: false,
        })
        expect(result[1]).to.deep.equal({
          id: messages[1].id,
          timestamp: messages[1].timestamp,
          user: messages[1].user,
          content: messages[1].content,
          edited: false,
        })
      })
    })

    it('should merge the prepended messages into the first existing one when user is same user and are close in time', function () {
      const list = createTestMessageList()
      const messages = createTestMessages()
      messages[0].user = messages[1].user = list[0].user
      const uniqueMessageIds: string[] = []

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
        content: messages[0].content,
        edited: false,
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
        pending: false,
      }
    }

    it('to an empty list', function () {
      const testMessage = createTestMessage()
      const uniqueMessageIds: string[] = []

      expect(
        appendMessage([], testMessage, uniqueMessageIds).messages
      ).to.deep.equal([
        {
          id: 'appended_message',
          timestamp: testMessage.timestamp,
          user: testMessage.user,
          content: testMessage.content,
          pending: false,
          edited: false,
        },
      ])
    })

    describe('messages appended shortly after the last message on the list', function () {
      let list: Message[],
        message: ServerMessageEntry,
        uniqueMessageIds: string[]

      beforeEach(function () {
        list = createTestMessageList()
        message = createTestMessage()
        message.timestamp = list[1].timestamp + 6 * 1000 // 6 seconds after the last message in the list
        uniqueMessageIds = []
      })

      describe('when the author is the same as the last message', function () {
        it('should append the content to the last message', function () {
          const result = appendMessage(list, message, uniqueMessageIds).messages
          expect(result.length).to.equal(list.length + 1)
          expect(result[2]).to.deep.equal({
            id: message.id,
            timestamp: message.timestamp,
            user: message.user,
            content: message.content,
            pending: false,
            edited: false,
          })
        })

        it('should update the last message timestamp', function () {
          const result = appendMessage(list, message, uniqueMessageIds).messages
          expect(result[2].timestamp).to.equal(message.timestamp)
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
            content: message.content,
            pending: false,
            edited: false,
          })
        })
      })
    })

    describe('messages appended later after the last message on the list', function () {
      let list: Message[],
        message: ServerMessageEntry,
        uniqueMessageIds: string[]

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
          content: message.content,
          pending: false,
          edited: false,
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
          content: message.content,
          pending: false,
          edited: false,
        })
      })
    })
  })

  describe('editMessage()', function () {
    it('should edit an existing message', function () {
      const list = createTestMessageList()
      const messageId = 'msg_1'
      const newContent = 'edited content'

      const result = editMessage(messageId, newContent, list)

      expect(result.messages.length).to.equal(list.length)
      expect(result.messages[0]).to.deep.equal({
        id: messageId,
        content: newContent,
        timestamp: list[0].timestamp,
        user: list[0].user,
        edited: true,
      })
      expect(result.messages[1]).to.deep.equal(list[1])
    })

    it('should throw an error if message is not found', function () {
      const list = createTestMessageList()
      const nonExistentId = 'non_existent_id'
      const newContent = 'edited content'

      expect(() => {
        editMessage(nonExistentId, newContent, list)
      }).to.throw(`Message with id ${nonExistentId} not found in message list`)
    })
  })

  describe('deleteMessage()', function () {
    it('should mark an existing message as deleted', function () {
      const list = createTestMessageList()
      const messageId = 'msg_1'

      const result = deleteMessage(messageId, list)

      expect(result.messages.length).to.equal(list.length)
      expect(result.messages[0]).to.deep.equal({
        id: messageId,
        content: list[0].content,
        timestamp: list[0].timestamp,
        user: list[0].user,
        deleted: true,
      })
      expect(result.messages[1]).to.deep.equal(list[1])
    })

    it('should throw an error if message is not found', function () {
      const list = createTestMessageList()
      const nonExistentId = 'non_existent_id'

      expect(() => {
        deleteMessage(nonExistentId, list)
      }).to.throw(`Message with id ${nonExistentId} not found in message list`)
    })
  })

  describe('confirmMessage()', function () {
    function createMessageListWithPendingMessage(): Message[] {
      return [
        {
          id: 'msg_1',
          content: 'hello world',
          timestamp: new Date().getTime(),
          user: otherUser,
        },
        {
          id: 'temp_id',
          content: 'pending message',
          timestamp: new Date().getTime(),
          user: testUser,
          pending: true,
        },
      ]
    }

    it('should confirm a pending message and update its ID', function () {
      const list = createMessageListWithPendingMessage()
      const updatedMessage: Message = {
        id: 'server_id',
        content: 'pending message',
        timestamp: new Date().getTime() + 1000,
        user: testUser,
      }

      const result = confirmMessage(updatedMessage, list)

      expect(result.messages.length).to.equal(list.length)
      expect(result.messages[0]).to.deep.equal(list[0])
      expect(result.messages[1]).to.deep.equal({
        id: 'server_id',
        content: 'pending message',
        timestamp: updatedMessage.timestamp,
        user: testUser,
        pending: false,
      })
      expect(result.uniqueMessageIds).to.deep.equal(['msg_1', 'server_id'])
    })

    it('should throw an error if pending message is not found', function () {
      const list = createTestMessageList() // No pending messages
      const updatedMessage: Message = {
        id: 'server_id',
        content: 'non-existent pending message',
        timestamp: new Date().getTime(),
        user: testUser,
      }

      expect(() => {
        confirmMessage(updatedMessage, list)
      }).to.throw("Couldn't find own message in local state")
    })
  })
})
