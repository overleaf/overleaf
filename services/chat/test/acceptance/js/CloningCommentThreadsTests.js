import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

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

  describe('with an orphaned (non-existent) thread', async function () {
    it('should report an error for that thread without failing the request', async function () {
      const missingThreadId = new ObjectId().toString()
      const { response, body: result } =
        await ChatClient.duplicateCommentThreads(projectId, [missingThreadId])
      expect(response.statusCode).to.equal(200)
      expect(result.newThreads[missingThreadId]).to.deep.equal({
        error: 'not found',
      })
    })
  })

  describe('with a malformed thread id in the body', async function () {
    it('should return a graceful error', async function () {
      const { response } = await ChatClient.duplicateCommentThreads(projectId, [
        'malformed-thread-id',
      ])
      expectValidationErrorRaw(response, 400, 'threads')
    })
  })

  describe('with a malformed projectId', async function () {
    it('should return a not found error', async function () {
      const { response } = await ChatClient.duplicateCommentThreads(
        'malformed-project',
        [this.thread1Id]
      )
      expectValidationErrorRaw(response, 404, 'projectId')
    })
  })

  describe('with a thread whose room has no messages', async function () {
    before(async function () {
      this.emptyThreadId = new ObjectId().toString()
      const { response: deleteResponse } = await ChatClient.deleteMessage(
        projectId,
        this.emptyThreadId,
        new ObjectId().toString()
      )
      expect(deleteResponse.statusCode).to.equal(204)

      const {
        response: { body: result, statusCode },
      } = await ChatClient.duplicateCommentThreads(projectId, [
        this.emptyThreadId,
      ])
      this.result = result
      expect(statusCode).to.equal(200)
    })

    it('should duplicate the thread', function () {
      expect(this.result.newThreads[this.emptyThreadId]).to.have.property(
        'duplicateId'
      )
    })
  })
})

describe('Cloning comment threads to another project', async function () {
  const sourceProjectId = new ObjectId().toString()
  const targetProjectId = new ObjectId().toString()
  const userId = new ObjectId().toString()
  const threadId = new ObjectId().toString()

  before(async function () {
    await ChatApp.ensureRunning()
    const { response } = await ChatClient.sendMessage(
      sourceProjectId,
      threadId,
      userId,
      'source message'
    )
    expect(response.statusCode).to.equal(201)
  })

  describe('with a valid source and target project', function () {
    before(async function () {
      const { response } = await ChatClient.cloneCommentThreads(
        sourceProjectId,
        targetProjectId
      )
      expect(response.statusCode).to.equal(204)
    })

    it('should copy the threads and messages into the target project', async function () {
      const { response, body: threads } =
        await ChatClient.getThreads(targetProjectId)
      expect(response.statusCode).to.equal(200)
      const threadIds = Object.keys(threads)
      expect(threadIds.length).to.equal(1)
      expect(threads[threadIds[0]].messages.length).to.equal(1)
      expect(threads[threadIds[0]].messages[0].content).to.equal(
        'source message'
      )
    })

    it('should not remove the threads from the source project', async function () {
      const { response, body: threads } =
        await ChatClient.getThreads(sourceProjectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].messages.length).to.equal(1)
    })
  })

  describe('with a malformed source projectId', function () {
    it('should return a not found error', async function () {
      const { response } = await ChatClient.cloneCommentThreads(
        'malformed-project',
        targetProjectId
      )
      expectValidationErrorRaw(response, 404, 'projectId')
    })
  })

  describe('with a malformed target projectId', function () {
    it('should return a graceful error', async function () {
      const { response } = await ChatClient.cloneCommentThreads(
        sourceProjectId,
        'malformed-target-project'
      )
      expectValidationErrorRaw(response, 400, 'targetProjectId')
    })
  })

  describe('with a source project that has no comment threads', function () {
    it('should clone no threads into the target project', async function () {
      const emptySourceProjectId = new ObjectId().toString()
      const freshTargetProjectId = new ObjectId().toString()
      const { response } = await ChatClient.cloneCommentThreads(
        emptySourceProjectId,
        freshTargetProjectId
      )
      expect(response.statusCode).to.equal(204)

      const { response: getResponse, body: threads } =
        await ChatClient.getThreads(freshTargetProjectId)
      expect(getResponse.statusCode).to.equal(200)
      expect(threads).to.deep.equal({})
    })
  })
})
