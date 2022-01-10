const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Sending a message', async function () {
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('globally', async function () {
    before(async function () {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.content = 'global message'
      const { response, body } = await ChatClient.sendGlobalMessage(
        this.project_id,
        this.user_id,
        this.content
      )
      expect(response.statusCode).to.equal(201)
      expect(body.content).to.equal(this.content)
      expect(body.user_id).to.equal(this.user_id)
      expect(body.room_id).to.equal(this.project_id)
    })

    it('should then list the message in the project messages', async function () {
      const { response, body: messages } = await ChatClient.getGlobalMessages(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(1)
      expect(messages[0].content).to.equal(this.content)
    })
  })

  describe('to a thread', async function () {
    before(async function () {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.thread_id = ObjectId().toString()
      this.content = 'thread message'
      const { response, body } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content
      )
      expect(response.statusCode).to.equal(201)
      expect(body.content).to.equal(this.content)
      expect(body.user_id).to.equal(this.user_id)
      expect(body.room_id).to.equal(this.project_id)
    })

    it('should then list the message in the threads', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(threads[this.thread_id].messages.length).to.equal(1)
      expect(threads[this.thread_id].messages[0].content).to.equal(this.content)
    })

    it('should not appear in the global messages', async function () {
      const { response, body: messages } = await ChatClient.getGlobalMessages(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(0)
    })
  })

  describe('failure cases', async function () {
    before(async function () {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.thread_id = ObjectId().toString()
    })

    describe('with a malformed user_id', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          'malformed-user',
          'content'
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Invalid userId')
      })
    })

    describe('with a malformed project_id', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          'malformed-project',
          this.thread_id,
          this.user_id,
          'content'
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Invalid projectId')
      })
    })

    describe('with a malformed thread_id', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          this.project_id,
          'malformed-thread-id',
          this.user_id,
          'content'
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Invalid threadId')
      })
    })

    describe('with no content', async function () {
      it('should return a graceful error', async function () {
        const { response, body } = await ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          this.user_id,
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
          this.project_id,
          this.thread_id,
          this.user_id,
          content
        )
        expect(response.statusCode).to.equal(400)
        expect(body).to.equal('Content too long (> 10240 bytes)')
      })
    })
  })
})
