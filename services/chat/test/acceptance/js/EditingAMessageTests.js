const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Editing a message', async function () {
  before(async function () {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    this.thread_id = ObjectId().toString()
    await ChatApp.ensureRunning()
  })

  describe('in a thread', async function () {
    before(async function () {
      this.content = 'thread message'
      this.new_content = 'updated thread message'
      const { response, body: message } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content
      )
      this.message = message
      expect(response.statusCode).to.equal(201)
      expect(this.message.id).to.exist
      expect(this.message.content).to.equal(this.content)
      const { response: response2, body: newMessage } =
        await ChatClient.editMessage(
          this.project_id,
          this.thread_id,
          this.message.id,
          this.new_content
        )
      this.new_message = newMessage
      expect(response2.statusCode).to.equal(204)
    })

    it('should then list the updated message in the threads', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(threads[this.thread_id].messages.length).to.equal(1)
      expect(threads[this.thread_id].messages[0].content).to.equal(
        this.new_content
      )
    })
  })
})
