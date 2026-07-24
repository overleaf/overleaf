import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'
import { MAX_MESSAGE_LENGTH } from '../../../app/js/Features/Messages/MessageHttpSchemas.js'

describe('Editing a message', async function () {
  let projectId, userId, threadId
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('in a thread', async function () {
    const content = 'thread message'
    const newContent = 'updated thread message'
    let messageId
    beforeEach(async function () {
      projectId = new ObjectId().toString()
      userId = new ObjectId().toString()
      threadId = new ObjectId().toString()

      const { response, body: message } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      expect(message.id).to.exist
      expect(message.content).to.equal(content)
      messageId = message.id
    })

    describe('with a malformed messageId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.editMessage(
          projectId,
          threadId,
          'malformed-message-id',
          newContent
        )
        expectValidationErrorRaw(response, 404, 'messageId')
      })
    })

    describe('with a malformed projectId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.editMessage(
          'malformed-project',
          threadId,
          messageId,
          newContent
        )
        expectValidationErrorRaw(response, 404, 'projectId')
      })
    })

    describe('with a malformed threadId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.editMessage(
          projectId,
          'malformed-thread-id',
          messageId,
          newContent
        )
        expectValidationErrorRaw(response, 404, 'threadId')
      })
    })

    describe('with no content', function () {
      it('should return a graceful error', async function () {
        const { response } = await ChatClient.editMessage(
          projectId,
          threadId,
          messageId,
          ''
        )
        expectValidationErrorRaw(response, 400, 'No content provided')
      })
    })

    describe('with very long content', function () {
      it('should return a graceful error', async function () {
        const tooLongContent = '-'.repeat(MAX_MESSAGE_LENGTH + 1)
        const { response } = await ChatClient.editMessage(
          projectId,
          threadId,
          messageId,
          tooLongContent
        )
        expectValidationErrorRaw(
          response,
          400,
          `Content too long (> ${MAX_MESSAGE_LENGTH} bytes)`
        )
      })
    })

    describe('without user', function () {
      beforeEach(async function () {
        const { response } = await ChatClient.editMessage(
          projectId,
          threadId,
          messageId,
          newContent
        )
        expect(response.statusCode).to.equal(204)
      })

      it('should then list the updated message in the threads', async function () {
        const { response, body: threads } =
          await ChatClient.getThreads(projectId)
        expect(response.statusCode).to.equal(200)
        expect(threads[threadId].messages.length).to.equal(1)
        expect(threads[threadId].messages[0].content).to.equal(newContent)
      })
    })

    describe('with the same user', function () {
      beforeEach(async function () {
        const { response } = await ChatClient.editMessageWithUser(
          projectId,
          threadId,
          messageId,
          userId,
          newContent
        )
        expect(response.statusCode).to.equal(204)
      })

      it('should then list the updated message in the threads', async function () {
        const { response, body: threads } =
          await ChatClient.getThreads(projectId)
        expect(response.statusCode).to.equal(200)
        expect(threads[threadId].messages.length).to.equal(1)
        expect(threads[threadId].messages[0].content).to.equal(newContent)
      })
    })

    describe('with another user', function () {
      beforeEach(async function () {
        const { response } = await ChatClient.editMessageWithUser(
          projectId,
          threadId,
          messageId,
          new ObjectId(),
          newContent
        )
        expect(response.statusCode).to.equal(404)
      })

      it('should then list the old message in the threads', async function () {
        const { response, body: threads } =
          await ChatClient.getThreads(projectId)
        expect(response.statusCode).to.equal(200)
        expect(threads[threadId].messages.length).to.equal(1)
        expect(threads[threadId].messages[0].content).to.equal(content)
      })
    })
  })

  describe('globally', async function () {
    const content = 'global message'
    const newContent = 'updated global message'
    let messageId
    beforeEach(async function () {
      projectId = new ObjectId().toString()
      userId = new ObjectId().toString()

      const { response, body: message } = await ChatClient.sendGlobalMessage(
        projectId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      expect(message.id).to.exist
      messageId = message.id
    })

    describe('with a malformed messageId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.editGlobalMessage(
          projectId,
          'malformed-message-id',
          newContent
        )
        expectValidationErrorRaw(response, 404, 'messageId')
      })
    })

    describe('with a malformed projectId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.editGlobalMessage(
          'malformed-project',
          messageId,
          newContent
        )
        expectValidationErrorRaw(response, 404, 'projectId')
      })
    })

    describe('with very long content', function () {
      it('should return a graceful error', async function () {
        const tooLongContent = '-'.repeat(MAX_MESSAGE_LENGTH + 1)
        const { response } = await ChatClient.editGlobalMessage(
          projectId,
          messageId,
          tooLongContent
        )
        expectValidationErrorRaw(
          response,
          400,
          `Content too long (> ${MAX_MESSAGE_LENGTH} bytes)`
        )
      })
    })

    describe('without user', function () {
      beforeEach(async function () {
        const { response } = await ChatClient.editGlobalMessage(
          projectId,
          messageId,
          newContent
        )
        expect(response.statusCode).to.equal(204)
      })

      it('should then list the updated message in the global messages', async function () {
        const { response, body: messages } =
          await ChatClient.getGlobalMessages(projectId)
        expect(response.statusCode).to.equal(200)
        expect(messages.length).to.equal(1)
        expect(messages[0].content).to.equal(newContent)
      })
    })

    describe('with another user', function () {
      beforeEach(async function () {
        const { response } = await ChatClient.editGlobalMessageWithUser(
          projectId,
          messageId,
          new ObjectId(),
          newContent
        )
        expect(response.statusCode).to.equal(404)
      })

      it('should then list the old message in the global messages', async function () {
        const { response, body: messages } =
          await ChatClient.getGlobalMessages(projectId)
        expect(response.statusCode).to.equal(200)
        expect(messages.length).to.equal(1)
        expect(messages[0].content).to.equal(content)
      })
    })
  })
})
