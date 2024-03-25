import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

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
})
