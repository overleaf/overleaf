import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

describe('Deleting a message', async function () {
  const projectId = new ObjectId().toString()
  const userId = new ObjectId().toString()
  const threadId = new ObjectId().toString()

  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('in a thread', async function () {
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        'first message'
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2, body: message } =
        await ChatClient.sendMessage(
          projectId,
          threadId,
          userId,
          'deleted message'
        )
      expect(response2.statusCode).to.equal(201)
      const { response: response3 } = await ChatClient.deleteMessage(
        projectId,
        threadId,
        message.id
      )
      expect(response3.statusCode).to.equal(204)
    })

    it('should then remove the message from the threads', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].messages.length).to.equal(1)
    })
  })
})
