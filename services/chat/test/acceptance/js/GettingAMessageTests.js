import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

describe('Getting a message', async function () {
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('globally', async function () {
    const projectId = new ObjectId().toString()
    const userId = new ObjectId().toString()
    const content = 'global message'
    let messageId

    before(async function () {
      const { response, body: message } = await ChatClient.sendGlobalMessage(
        projectId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      messageId = message.id
    })

    it('should return the message', async function () {
      const { response, body: message } = await ChatClient.getGlobalMessage(
        projectId,
        messageId
      )
      expect(response.statusCode).to.equal(200)
      expect(message.content).to.equal(content)
      expect(message.user_id).to.equal(userId)
    })

    describe('when the message does not exist', function () {
      it('should return 404', async function () {
        const { response } = await ChatClient.getGlobalMessage(
          projectId,
          new ObjectId().toString()
        )
        expect(response.statusCode).to.equal(404)
      })
    })

    describe('with a malformed projectId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.getGlobalMessage(
          'malformed-project',
          messageId
        )
        expectValidationErrorRaw(response, 404, 'projectId')
      })
    })

    describe('with a malformed messageId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.getGlobalMessage(
          projectId,
          'malformed-message-id'
        )
        expectValidationErrorRaw(response, 404, 'messageId')
      })
    })
  })

  describe('in a thread', async function () {
    const projectId = new ObjectId().toString()
    const threadId = new ObjectId().toString()
    const userId = new ObjectId().toString()
    const content = 'thread message'
    let messageId

    before(async function () {
      const { response, body: message } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      messageId = message.id
    })

    it('should return the message', async function () {
      const { response, body: message } = await ChatClient.getThreadMessage(
        projectId,
        threadId,
        messageId
      )
      expect(response.statusCode).to.equal(200)
      expect(message.content).to.equal(content)
      expect(message.user_id).to.equal(userId)
    })

    describe('when the message does not exist', function () {
      it('should return 404', async function () {
        const { response } = await ChatClient.getThreadMessage(
          projectId,
          threadId,
          new ObjectId().toString()
        )
        expect(response.statusCode).to.equal(404)
      })
    })

    describe('with a malformed threadId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.getThreadMessage(
          projectId,
          'malformed-thread-id',
          messageId
        )
        expectValidationErrorRaw(response, 404, 'threadId')
      })
    })

    describe('with a malformed messageId', function () {
      it('should return a not found error', async function () {
        const { response } = await ChatClient.getThreadMessage(
          projectId,
          threadId,
          'malformed-message-id'
        )
        expectValidationErrorRaw(response, 404, 'messageId')
      })
    })
  })
})
