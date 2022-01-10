const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Deleting a thread', async function () {
  const projectId = ObjectId().toString()
  const userId = ObjectId().toString()
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('with a thread that is deleted', async function () {
    const threadId = ObjectId().toString()
    const content = 'deleted thread message'
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.deleteThread(
        projectId,
        threadId
      )
      expect(response2.statusCode).to.equal(204)
    })

    it('should then not list the thread for the project', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(Object.keys(threads).length).to.equal(0)
    })
  })
})
