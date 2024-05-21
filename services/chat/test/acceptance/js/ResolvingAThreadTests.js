import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

describe('Resolving a thread', async function () {
  const projectId = new ObjectId().toString()
  const userId = new ObjectId().toString()
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('with a resolved thread', async function () {
    const threadId = new ObjectId().toString()
    const content = 'resolved message'
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.resolveThread(
        projectId,
        threadId,
        userId
      )
      expect(response2.statusCode).to.equal(204)
    })

    it('should then list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].resolved).to.equal(true)
      expect(threads[threadId].resolved_by_user_id).to.equal(userId)
      const resolvedAt = new Date(threads[threadId].resolved_at)
      expect(new Date() - resolvedAt).to.be.below(1000)
    })

    it('should list the thread id in the resolved thread ids endpoint', async function () {
      const { response, body } =
        await ChatClient.getResolvedThreadIds(projectId)
      expect(response.statusCode).to.equal(200)
      expect(body.resolvedThreadIds).to.include(threadId)
    })
  })

  describe('when a thread is not resolved', async function () {
    const threadId = new ObjectId().toString()
    const content = 'open message'
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
    })

    it('should not list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].resolved).to.be.undefined
    })

    it('should not list the thread in the resolved thread ids endpoint', async function () {
      const { response, body } =
        await ChatClient.getResolvedThreadIds(projectId)
      expect(response.statusCode).to.equal(200)
      expect(body.resolvedThreadIds).not.to.include(threadId)
    })
  })

  describe('when a thread is resolved then reopened', async function () {
    const threadId = new ObjectId().toString()
    const content = 'resolved message'
    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId,
        userId,
        content
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.resolveThread(
        projectId,
        threadId,
        userId
      )
      expect(response2.statusCode).to.equal(204)
      const { response: response3 } = await ChatClient.reopenThread(
        projectId,
        threadId
      )
      expect(response3.statusCode).to.equal(204)
    })

    it('should not list the thread as resolved', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(threads[threadId].resolved).to.be.undefined
    })

    it('should not list the thread in the resolved thread ids endpoint', async function () {
      const { response, body } =
        await ChatClient.getResolvedThreadIds(projectId)
      expect(response.statusCode).to.equal(200)
      expect(body.resolvedThreadIds).not.to.include(threadId)
    })
  })
})
