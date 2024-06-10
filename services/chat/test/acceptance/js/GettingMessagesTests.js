import { ObjectId } from '../../../app/js/mongodb.js'
import { expect } from 'chai'

import * as ChatClient from './helpers/ChatClient.js'
import * as ChatApp from './helpers/ChatApp.js'

async function getCount() {
  return await ChatClient.getMetric(line => {
    return (
      line.includes('timer_http_request_count') &&
      line.includes('path="project_{projectId}_messages"') &&
      line.includes('method="POST"')
    )
  })
}

describe('Getting messages', async function () {
  const userId1 = new ObjectId().toString()
  const userId2 = new ObjectId().toString()
  const content1 = 'foo bar'
  const content2 = 'hello world'
  before(async function () {
    await ChatApp.ensureRunning()
  })

  describe('globally', async function () {
    const projectId = new ObjectId().toString()
    before(async function () {
      const previousCount = await getCount()
      const { response } = await ChatClient.sendGlobalMessage(
        projectId,
        userId1,
        content1
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.sendGlobalMessage(
        projectId,
        userId2,
        content2
      )
      expect(response2.statusCode).to.equal(201)
      const { response: response3, body } = await ChatClient.checkStatus()
      expect(response3.statusCode).to.equal(200)
      expect(body).to.equal('chat is alive')
      expect(await getCount()).to.equal(previousCount + 2)
    })

    it('should contain the messages and populated users when getting the messages', async function () {
      const { response, body: messages } =
        await ChatClient.getGlobalMessages(projectId)
      expect(response.statusCode).to.equal(200)
      expect(messages.length).to.equal(2)
      messages.reverse()
      expect(messages[0].content).to.equal(content1)
      expect(messages[0].user_id).to.equal(userId1)
      expect(messages[1].content).to.equal(content2)
      expect(messages[1].user_id).to.equal(userId2)
    })
  })

  describe('from all the threads', async function () {
    const projectId = new ObjectId().toString()
    const threadId1 = new ObjectId().toString()
    const threadId2 = new ObjectId().toString()

    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId1,
        userId1,
        'one'
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.sendMessage(
        projectId,
        threadId2,
        userId2,
        'two'
      )
      expect(response2.statusCode).to.equal(201)
      const { response: response3 } = await ChatClient.sendMessage(
        projectId,
        threadId1,
        userId1,
        'three'
      )
      expect(response3.statusCode).to.equal(201)
      const { response: response4 } = await ChatClient.sendMessage(
        projectId,
        threadId2,
        userId2,
        'four'
      )
      expect(response4.statusCode).to.equal(201)
    })

    it('should contain a dictionary of threads with messages with populated users', async function () {
      const { response, body: threads } = await ChatClient.getThreads(projectId)
      expect(response.statusCode).to.equal(200)
      expect(Object.keys(threads).length).to.equal(2)
      const thread1 = threads[threadId1]
      expect(thread1.messages.length).to.equal(2)
      const thread2 = threads[threadId2]
      expect(thread2.messages.length).to.equal(2)

      expect(thread1.messages[0].content).to.equal('one')
      expect(thread1.messages[0].user_id).to.equal(userId1)
      expect(thread1.messages[1].content).to.equal('three')
      expect(thread1.messages[1].user_id).to.equal(userId1)

      expect(thread2.messages[0].content).to.equal('two')
      expect(thread2.messages[0].user_id).to.equal(userId2)
      expect(thread2.messages[1].content).to.equal('four')
      expect(thread2.messages[1].user_id).to.equal(userId2)
    })
  })

  describe('from a list of threads', function () {
    const projectId = new ObjectId().toString()
    const threadId1 = new ObjectId().toString()
    const threadId2 = new ObjectId().toString()
    const threadId3 = new ObjectId().toString()

    before(async function () {
      const { response } = await ChatClient.sendMessage(
        projectId,
        threadId1,
        userId1,
        'one'
      )
      expect(response.statusCode).to.equal(201)
      const { response: response2 } = await ChatClient.sendMessage(
        projectId,
        threadId2,
        userId2,
        'two'
      )
      expect(response2.statusCode).to.equal(201)
      const { response: response3 } = await ChatClient.sendMessage(
        projectId,
        threadId1,
        userId1,
        'three'
      )
      expect(response3.statusCode).to.equal(201)
    })

    it('should contain a dictionary of threads with messages with populated users', async function () {
      const { response, body: threads } = await ChatClient.generateThreadData(
        projectId,
        [threadId1, threadId3]
      )
      expect(response.statusCode).to.equal(200)
      expect(Object.keys(threads).length).to.equal(1)
      const thread1 = threads[threadId1]
      expect(thread1.messages.length).to.equal(2)

      expect(thread1.messages[0].content).to.equal('one')
      expect(thread1.messages[0].user_id).to.equal(userId1)
      expect(thread1.messages[1].content).to.equal('three')
      expect(thread1.messages[1].user_id).to.equal(userId1)
    })
  })
})
