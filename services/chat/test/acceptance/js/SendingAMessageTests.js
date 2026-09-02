import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'
import { MAX_MESSAGE_LENGTH } from '../../../app/js/Features/Messages/MessageHttpSchemas.js'

describe('Sending a message', async function () {
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('globally', async function () {
    const projectId = new ObjectId().toString()
    const userId = new ObjectId().toString()
    const content = 'global message'
    before(async function () {
      const { response, body } = await ChatClient.sendGlobalMessage(
        projectId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      expect(body.content).to.equal(content)
      expect(body.user_id).to.equal(userId)
      expect(body.room_id).to.equal(projectId)
    })

    it('should then list the message in the project messages', async function () {
      const { response, body: messages } =
        await ChatClient.getGlobalMessages(projectId)
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(1)
      expect(messages[0].content).to.equal(content)
    })
  })

  describe('to a thread', async function () {
    const projectId = new ObjectId().toString()
    const userId = new ObjectId().toString()
    const threadId = new ObjectId().toString()
    const content = 'thread message'
    before(async function () {
      const { response, body } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      expect(body.content).to.equal(content)
      expect(body.user_id).to.equal(userId)
      expect(body.room_id).to.equal(projectId)
    })

    it('should then list the message in the threads', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].messages.length).to.equal(1)
      expect(threads[threadId].messages[0].content).to.equal(content)
    })

    it('should not appear in the global messages', async function () {
      const { response, body: messages } =
        await ChatClient.getGlobalMessages(projectId)
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(0)
    })
  })

  describe('failure cases', async function () {
    const projectId = new ObjectId().toString()
    const userId = new ObjectId().toString()
    const threadId = new ObjectId().toString()

    describe('with a malformed userId', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          projectId,
          threadId,
          'malformed-user',
          'content'
        )
        expectValidationErrorRaw(response, 400, 'user_id')
        expect(body.error).to.include('Invalid Mongo ObjectId')
      })
    })

    describe('with a malformed projectId', async function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.sendMessage(
          'malformed-project',
          threadId,
          userId,
          'content'
        )
        expectValidationErrorRaw(response, 404, 'projectId')
      })
    })

    describe('with a malformed threadId', async function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.sendMessage(
          projectId,
          'malformed-thread-id',
          userId,
          'content'
        )
        expectValidationErrorRaw(response, 404, 'threadId')
      })
    })

    describe('with no content', async function () {
      it('should return a graceful error', async function () {
        const { response } = await ChatClient.sendMessage(
          projectId,
          threadId,
          userId,
          null
        )
        expectValidationErrorRaw(response, 400, 'No content provided')
      })
    })

    describe('with very long content', async function () {
      it('should return a graceful error', async function () {
        const content = '-'.repeat(MAX_MESSAGE_LENGTH + 1)
        const { response } = await ChatClient.sendMessage(
          projectId,
          threadId,
          userId,
          content
        )
        expectValidationErrorRaw(
          response,
          400,
          `Content too long (> ${MAX_MESSAGE_LENGTH} bytes)`
        )
      })
    })

    describe('with an unknown field in the body', async function () {
      it('should return a graceful error', async function () {
        const { response } = await ChatClient.asyncRequest({
          method: 'post',
          url: `/project/${projectId}/thread/${threadId}/messages`,
          json: {
            user_id: userId,
            content: 'content',
            unknownField: 'x',
          },
        })
        expectValidationErrorRaw(response, 400, 'unknownField')
      })
    })

    describe('with a malformed limit', async function () {
      it('should return a graceful error', async function () {
        const { response } = await ChatClient.asyncRequest({
          method: 'get',
          url: `/project/${projectId}/messages?limit=nope`,
          json: true,
        })
        expectValidationErrorRaw(response, 400, 'limit')
      })
    })
  })

  describe('globally: failure cases', async function () {
    const projectId = new ObjectId().toString()

    describe('with a malformed userId', async function () {
      it('should return a graceful error', async function () {
        const { response } = await ChatClient.sendGlobalMessage(
          projectId,
          'malformed-user',
          'content'
        )
        expectValidationErrorRaw(response, 400, 'user_id')
      })
    })

    describe('with a malformed projectId', async function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.sendGlobalMessage(
          'malformed-project',
          new ObjectId().toString(),
          'content'
        )
        expectValidationErrorRaw(response, 404, 'projectId')
      })
    })
  })
})
