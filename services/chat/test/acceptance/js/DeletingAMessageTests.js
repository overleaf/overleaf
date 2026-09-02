import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

describe('Deleting a message', async function () {
  const projectId = new ObjectId().toString()
  const userId = new ObjectId().toString()
  const threadId = new ObjectId().toString()

  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('in a thread', async function () {
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        'first message'
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2, body: message } =
        await ChatClient.sendMessage(
          projectId,
          threadId,
          userId,
          'deleted message'
        )
      expect(response2.statusCode).to.equal(201)
      const { response: response3 } = await ChatClient.deleteMessage(
        projectId,
        threadId,
        message.id
      )
      expect(response3.statusCode).to.equal(204)
    })

    it('should then remove the message from the threads', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].messages.length).to.equal(1)
    })
  })

  describe('in a thread, with a malformed messageId', function () {
    it('should return a not found error', async function () {
      const { response } = await ChatClient.deleteMessage(
        projectId,
        threadId,
        'malformed-message-id'
      )
      expectValidationErrorRaw(response, 404, 'messageId')
    })
  })

  describe('in a thread, with a malformed threadId', function () {
    it('should return a not found error', async function () {
      const { response } = await ChatClient.deleteMessage(
        projectId,
        'malformed-thread-id',
        new ObjectId().toString()
      )
      expectValidationErrorRaw(response, 404, 'threadId')
    })
  })

  describe('globally', async function () {
    let messageId
    before(async function () {
      const { response, body: message } = await ChatClient.sendGlobalMessage(
        projectId,
        userId,
        'deleted global message'
      )
      expect(response.statusCode).to.equal(201)
      messageId = message.id
      const { response: response2 } = await ChatClient.deleteGlobalMessage(
        projectId,
        messageId
      )
      expect(response2.statusCode).to.equal(204)
    })

    it('should then remove the message from the global messages', async function () {
      const { response, body: messages } =
        await ChatClient.getGlobalMessages(projectId)
      expect(response.statusCode).to.equal(200)
      expect(messages.map(m => m.id)).to.not.include(messageId)
    })
  })

  describe('globally, with a malformed messageId', function () {
    it('should return a not found error', async function () {
      const { response } = await ChatClient.deleteGlobalMessage(
        projectId,
        'malformed-message-id'
      )
      expectValidationErrorRaw(response, 404, 'messageId')
    })
  })

  describe('as a specific user', async function () {
    let messageId
    const otherUserId = new ObjectId().toString()
    before(async function () {
      const { response, body: message } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        'message owned by userId'
      )
      expect(response.statusCode).to.equal(201)
      messageId = message.id
    })

    it('should not remove the message when deleted by a different user', async function () {
      const { response } = await ChatClient.deleteUserMessage(
        projectId,
        threadId,
        otherUserId,
        messageId
      )
      expect(response.statusCode).to.equal(204)
      const { body: threads } = await ChatClient.getThreads(projectId)
      expect(threads[threadId].messages.map(m => m.id)).to.include(messageId)
    })

    it('should remove the message when deleted by its owner', async function () {
      const { response } = await ChatClient.deleteUserMessage(
        projectId,
        threadId,
        userId,
        messageId
      )
      expect(response.statusCode).to.equal(204)
      const { body: threads } = await ChatClient.getThreads(projectId)
      expect(threads[threadId].messages.map(m => m.id)).to.not.include(
        messageId
      )
    })
  })

  describe('as a specific user, with a malformed userId', function () {
    it('should return a not found error', async function () {
      const { response } = await ChatClient.deleteUserMessage(
        projectId,
        threadId,
        'malformed-user',
        new ObjectId().toString()
      )
      expectValidationErrorRaw(response, 404, 'userId')
    })
  })
})
