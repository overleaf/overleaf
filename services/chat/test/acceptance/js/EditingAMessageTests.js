const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Editing a message', async function () {
  const projectId = ObjectId().toString()
  const userId = ObjectId().toString()
  const threadId = ObjectId().toString()
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('in a thread', async function () {
    const content = 'thread message'
    const newContent = 'updated thread message'
    before(async function () {
      const { response, body: message } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      expect(message.id).to.exist
      expect(message.content).to.equal(content)
      const { response: response2 } = await ChatClient.editMessage(
        projectId,
        threadId,
        message.id,
        newContent
      )
      expect(response2.statusCode).to.equal(204)
    })

    it('should then list the updated message in the threads', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].messages.length).to.equal(1)
      expect(threads[threadId].messages[0].content).to.equal(newContent)
    })
  })
})
