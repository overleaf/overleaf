import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

const db = ChatApp.db

async function getMessage(messageId) {
  return await db.messages.findOne({
    _id: new ObjectId(messageId),
  })
}

describe('Destroying a project', async function () {
  const projectId = new ObjectId().toString()
  const userId = new ObjectId().toString()
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('with a project that has threads and messages', async function () {
    const threadId = new ObjectId().toString()
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        'destroyed thread message'
      )
      expect(response.statusCode).to.equal(201)
      this.threadMessageId = response.body.id
      const { response: response2 } = await ChatClient.sendGlobalMessage(
        projectId,
        userId,
        'destroyed global message'
      )
      expect(response2.statusCode).to.equal(201)
      this.globalThreadMessageId = response2.body.id

      const threadRooms = await db.rooms
        .find({ project_id: new ObjectId(projectId) })
        .toArray()
      expect(threadRooms.length).to.equal(2)
      const threadMessage = await getMessage(this.threadMessageId)
      expect(threadMessage).to.exist
      const globalThreadMessage = await getMessage(this.globalThreadMessageId)
      expect(globalThreadMessage).to.exist

      const { response: responseDestroy } =
        await ChatClient.destroyProject(projectId)
      expect(responseDestroy.statusCode).to.equal(204)
    })

    it('should remove the messages and threads from the database', async function () {
      const threadRooms = await db.rooms
        .find({ project_id: new ObjectId(projectId) })
        .toArray()
      expect(threadRooms.length).to.equal(0)
      const threadMessage = await getMessage(this.threadMessageId)
      expect(threadMessage).to.be.null
      const globalThreadMessage = await getMessage(this.globalThreadMessageId)
      expect(globalThreadMessage).to.be.null
    })
  })
})
