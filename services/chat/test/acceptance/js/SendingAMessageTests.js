const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Sending a message', async function () {
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('globally', async function () {
    const projectId = ObjectId().toString()
    const userId = ObjectId().toString()
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
      const { response, body: messages } = await ChatClient.getGlobalMessages(
        projectId
      )
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(1)
      expect(messages[0].content).to.equal(content)
    })
  })

  describe('to a thread', async function () {
    const projectId = ObjectId().toString()
    const userId = ObjectId().toString()
    const threadId = ObjectId().toString()
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
      const { response, body: messages } = await ChatClient.getGlobalMessages(
        projectId
      )
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(0)
    })
  })

  describe('failure cases', async function () {
    const projectId = ObjectId().toString()
    const userId = ObjectId().toString()
    const threadId = ObjectId().toString()

    describe('with a malformed userId', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          projectId,
          threadId,
          'malformed-user',
          'content'
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Invalid userId')
      })
    })

    describe('with a malformed projectId', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          'malformed-project',
          threadId,
          userId,
          'content'
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Invalid projectId')
      })
    })

    describe('with a malformed threadId', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          projectId,
          'malformed-thread-id',
          userId,
          'content'
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Invalid threadId')
      })
    })

    describe('with no content', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          projectId,
          threadId,
          userId,
          null
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('No content provided')
      })
    })

    describe('with very long content', async function () {
      it('should return a graceful error', async function () {
        const content = '-'.repeat(10 * 1024 + 1)
        const { response, body } = await ChatClient.sendMessage(
          projectId,
          threadId,
          userId,
          content
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Content too long (> 10240 bytes)')
      })
    })
  })
})
