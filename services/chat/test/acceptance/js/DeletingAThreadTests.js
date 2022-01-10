const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Deleting a thread', async function () {
  before(async function () {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    await ChatApp.ensureRunning()
  })

  describe('with a thread that is deleted', async function () {
    before(async function () {
      this.thread_id = ObjectId().toString()
      this.content = 'deleted thread message'
      const { response } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.deleteThread(
        this.project_id,
        this.thread_id
      )
      expect(response2.statusCode).to.equal(204)
    })

    it('should then not list the thread for the project', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(Object.keys(threads).length).to.equal(0)
    })
  })
})
