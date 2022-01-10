const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Resolving a thread', async function () {
  before(async function () {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    await ChatApp.ensureRunning()
  })

  describe('with a resolved thread', async function () {
    before(async function () {
      this.thread_id = ObjectId().toString()
      this.content = 'resolved message'
      const { response } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.resolveThread(
        this.project_id,
        this.thread_id,
        this.user_id
      )
      expect(response2.statusCode).to.equal(204)
    })

    it('should then list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(threads[this.thread_id].resolved).to.equal(true)
      expect(threads[this.thread_id].resolved_by_user_id).to.equal(this.user_id)
      const resolvedAt = new Date(threads[this.thread_id].resolved_at)
      expect(new Date() - resolvedAt).to.be.below(1000)
    })
  })

  describe('when a thread is not resolved', async function () {
    before(async function () {
      this.thread_id = ObjectId().toString()
      this.content = 'open message'
      const { response } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content
      )
      expect(response.statusCode).to.equal(201)
    })

    it('should not list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(threads[this.thread_id].resolved).to.be.undefined
    })
  })

  describe('when a thread is resolved then reopened', async function () {
    before(async function () {
      this.thread_id = ObjectId().toString()
      this.content = 'resolved message'
      const { response } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.resolveThread(
        this.project_id,
        this.thread_id,
        this.user_id
      )
      expect(response2.statusCode).to.equal(204)
      const { response: response3 } = await ChatClient.reopenThread(
        this.project_id,
        this.thread_id
      )
      expect(response3.statusCode).to.equal(204)
    })

    it('should not list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(threads[this.thread_id].resolved).to.be.undefined
    })
  })
})
