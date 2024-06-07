import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

const user1Id = new ObjectId().toString()
const user2Id = new ObjectId().toString()

async function createCommentThread(projectId, threadId = new ObjectId()) {
  const { response: response1 } = await ChatClient.sendMessage(
    projectId,
    threadId.toString(),
    user1Id,
    'message 1'
  )
  expect(response1.statusCode).to.equal(201)
  const { response: response2 } = await ChatClient.sendMessage(
    projectId,
    threadId,
    user2Id,
    'message 2'
  )
  expect(response2.statusCode).to.equal(201)
  return threadId.toString()
}

describe('Cloning comment threads', async function () {
  const projectId = new ObjectId().toString()

  before(async function () {
    await ChatApp.ensureRunning()
    this.thread1Id = await createCommentThread(projectId)
    this.thread2Id = await createCommentThread(projectId)
    this.thread3Id = await createCommentThread(projectId)
  })

  describe('with non-orphaned threads', async function () {
    before(async function () {
      const {
        response: { body: result, statusCode },
      } = await ChatClient.duplicateCommentThreads(projectId, [this.thread3Id])
      this.result = result
      expect(statusCode).to.equal(200)
      expect(this.result).to.have.property('newThreads')
      this.newThreadId = this.result.newThreads[this.thread3Id].duplicateId
    })

    it('should duplicate threads', function () {
      expect(this.result.newThreads).to.have.property(this.thread3Id)
      expect(this.result.newThreads[this.thread3Id]).to.have.property(
        'duplicateId'
      )
      expect(this.result.newThreads[this.thread3Id].duplicateId).to.not.equal(
        this.thread3Id
      )
    })

    it('should not duplicate other threads threads', function () {
      expect(this.result.newThreads).to.not.have.property(this.thread1Id)
      expect(this.result.newThreads).to.not.have.property(this.thread2Id)
    })

    it('should duplicate the messages in the thread', async function () {
      const {
        response: { body: threads },
      } = await ChatClient.getThreads(projectId)
      function ignoreId(comment) {
        return {
          ...comment,
          id: undefined,
        }
      }
      expect(threads[this.thread3Id].messages.map(ignoreId)).to.deep.equal(
        threads[this.newThreadId].messages.map(ignoreId)
      )
    })

    it('should have two separate unlinked threads', async function () {
      await ChatClient.sendMessage(
        projectId,
        this.newThreadId,
        user1Id,
        'third message'
      )
      const {
        response: { body: threads },
      } = await ChatClient.getThreads(projectId)
      expect(threads[this.thread3Id].messages.length).to.equal(2)
      expect(threads[this.newThreadId].messages.length).to.equal(3)
    })
  })
})
