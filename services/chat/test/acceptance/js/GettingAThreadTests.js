import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

describe('Getting a thread', async function () {
  const userId1 = new ObjectId().toString()
  const userId2 = new ObjectId().toString()
  const content1 = 'first message'
  const content2 = 'second message'
  const projectId = new ObjectId().toString()
  const threadId = new ObjectId().toString()

  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('when thread exists', async function () {
    before(async function () {
      // Send first message to create thread
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId1,
        content1
      )
      expect(response.statusCode).to.equal(201)

      // Send second message to the same thread
      const { response: response2 } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId2,
        content2
      )
      expect(response2.statusCode).to.equal(201)
    })

    it('should return the thread with all messages', async function () {
      const { response, body: thread } = await ChatClient.getThread(
        projectId,
        threadId
      )
      expect(response.statusCode).to.equal(200)
      expect(thread).to.exist
      expect(thread.messages).to.exist
      expect(thread.messages.length).to.equal(2)

      expect(thread.messages[0].content).to.equal(content1)
      expect(thread.messages[0].user_id).to.equal(userId1)
      expect(thread.messages[1].content).to.equal(content2)
      expect(thread.messages[1].user_id).to.equal(userId2)
    })
  })

  describe('when thread does not exist', async function () {
    it('should return 404', async function () {
      const nonExistentThreadId = new ObjectId().toString()
      const { response } = await ChatClient.getThread(
        projectId,
        nonExistentThreadId
      )
      expect(response.statusCode).to.equal(404)
    })
  })
})
