const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Resolving a thread', async function () {
  const projectId = ObjectId().toString()
  const userId = ObjectId().toString()
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('with a resolved thread', async function () {
    const threadId = ObjectId().toString()
    const content = 'resolved message'
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.resolveThread(
        projectId,
        threadId,
        userId
      )
      expect(response2.statusCode).to.equal(204)
    })

    it('should then list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].resolved).to.equal(true)
      expect(threads[threadId].resolved_by_user_id).to.equal(userId)
      const resolvedAt = new Date(threads[threadId].resolved_at)
      expect(new Date() - resolvedAt).to.be.below(1000)
    })
  })

  describe('when a thread is not resolved', async function () {
    const threadId = ObjectId().toString()
    const content = 'open message'
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
    })

    it('should not list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].resolved).to.be.undefined
    })
  })

  describe('when a thread is resolved then reopened', async function () {
    const threadId = ObjectId().toString()
    const content = 'resolved message'
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.resolveThread(
        projectId,
        threadId,
        userId
      )
      expect(response2.statusCode).to.equal(204)
      const { response: response3 } = await ChatClient.reopenThread(
        projectId,
        threadId
      )
      expect(response3.statusCode).to.equal(204)
    })

    it('should not list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].resolved).to.be.undefined
    })
  })
})
