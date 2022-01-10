const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Deleting a message', async function () {
  before(async function () {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    this.thread_id = ObjectId().toString()
    await ChatApp.ensureRunning()
  })

  describe('in a thread', async function () {
    before(async function () {
      const { response, body: message } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        'first message'
      )
      this.message = message
      expect(response.statusCode).to.equal(201)
      const { response: response2, body: message2 } =
        await ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          this.user_id,
          'deleted message'
        )
      this.message = message2
      expect(response2.statusCode).to.equal(201)
      const { response: response3 } = await ChatClient.deleteMessage(
        this.project_id,
        this.thread_id,
        this.message.id
      )
      expect(response3.statusCode).to.equal(204)
    })

    it('should then remove the message from the threads', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(threads[this.thread_id].messages.length).to.equal(1)
    })
  })
})
