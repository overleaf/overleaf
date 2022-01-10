const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Getting messages', async function () {
  before(async function () {
    this.user_id1 = ObjectId().toString()
    this.user_id2 = ObjectId().toString()
    this.content1 = 'foo bar'
    this.content2 = 'hello world'
    await ChatApp.ensureRunning()
  })

  describe('globally', async function () {
    before(async function () {
      this.project_id = ObjectId().toString()
      const { response } = await ChatClient.sendGlobalMessage(
        this.project_id,
        this.user_id1,
        this.content1
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.sendGlobalMessage(
        this.project_id,
        this.user_id2,
        this.content2
      )
      expect(response2.statusCode).to.equal(201)
    })

    it('should contain the messages and populated users when getting the messages', async function () {
      const { response, body: messages } = await ChatClient.getGlobalMessages(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(2)
      messages.reverse()
      expect(messages[0].content).to.equal(this.content1)
      expect(messages[0].user_id).to.equal(this.user_id1)
      expect(messages[1].content).to.equal(this.content2)
      expect(messages[1].user_id).to.equal(this.user_id2)
    })
  })

  describe('from all the threads', async function () {
    before(async function () {
      this.project_id = ObjectId().toString()
      this.thread_id1 = ObjectId().toString()
      this.thread_id2 = ObjectId().toString()
      const { response } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id1,
        this.user_id1,
        'one'
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id2,
        this.user_id2,
        'two'
      )
      expect(response2.statusCode).to.equal(201)
      const { response: response3 } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id1,
        this.user_id1,
        'three'
      )
      expect(response3.statusCode).to.equal(201)
      const { response: response4 } = await ChatClient.sendMessage(
        this.project_id,
        this.thread_id2,
        this.user_id2,
        'four'
      )
      expect(response4.statusCode).to.equal(201)
    })

    it('should contain a dictionary of threads with messages with populated users', async function () {
      const { response, body: threads } = await ChatClient.getThreads(
        this.project_id
      )
      expect(response.statusCode).to.equal(200)
      expect(Object.keys(threads).length).to.equal(2)
      const thread1 = threads[this.thread_id1]
      expect(thread1.messages.length).to.equal(2)
      const thread2 = threads[this.thread_id2]
      expect(thread2.messages.length).to.equal(2)

      expect(thread1.messages[0].content).to.equal('one')
      expect(thread1.messages[0].user_id).to.equal(this.user_id1)
      expect(thread1.messages[1].content).to.equal('three')
      expect(thread1.messages[1].user_id).to.equal(this.user_id1)

      expect(thread2.messages[0].content).to.equal('two')
      expect(thread2.messages[0].user_id).to.equal(this.user_id2)
      expect(thread2.messages[1].content).to.equal('four')
      expect(thread2.messages[1].user_id).to.equal(this.user_id2)
    })
  })
})
