import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

describe('Deleting a thread', async function () {
  const projectId = new ObjectId().toString()
  const userId = new ObjectId().toString()
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('with a thread that is deleted', async function () {
    const threadId = new ObjectId().toString()
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
