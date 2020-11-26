import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import {
  ChatStore,
  MESSAGE_LIMIT
} from '../../../../../frontend/js/features/chat/store/chat-store'

describe('ChatStore', function() {
  let store, socket, mockSocketMessage

  const user = {
    id: '123abc'
  }

  const testMessage = {
    content: 'hello',
    timestamp: new Date().getTime(),
    user
  }

  beforeEach(function() {
    fetchMock.reset()

    window.user = user
    window.project_id = 'project-123'
    window.csrfToken = 'csrf_tok'

    socket = { on: sinon.stub() }
    window._ide = { socket }
    mockSocketMessage = message => socket.on.getCall(0).args[1](message)

    store = new ChatStore()
  })

  afterEach(function() {
    fetchMock.restore()
    delete window._ide
    delete window.csrfToken
    delete window.user
    delete window.project_id
  })

  describe('new message events', function() {
    it('subscribes to the socket for new message events', function() {
      expect(socket.on).to.be.calledWith('new-chat-message')
    })

    it('notifies an update event after new messages are received', function() {
      const subscriber = sinon.stub()
      store.on('updated', subscriber)
      mockSocketMessage(testMessage)
      expect(subscriber).to.be.calledOnce
    })

    it('can unsubscribe from events', function() {
      const subscriber = sinon.stub()
      store.on('updated', subscriber)
      store.off('updated', subscriber)
      mockSocketMessage(testMessage)
      expect(subscriber).not.to.be.called
    })

    it('when the message is from other user, it is added to the messages list', function() {
      mockSocketMessage({ ...testMessage, id: 'other_user' })
      expect(store.messages[store.messages.length - 1]).to.deep.equal({
        user: testMessage.user,
        timestamp: testMessage.timestamp,
        contents: [testMessage.content]
      })
    })

    describe('messages sent by the user', function() {
      beforeEach(function() {
        fetchMock.post(/messages/, 204)
      })

      it('are not added to the message list', async function() {
        await store.sendMessage(testMessage.content)
        const originalMessageList = store.messages.slice(0)
        mockSocketMessage(testMessage)
        expect(originalMessageList).to.deep.equal(store.messages)

        // next message by a different user is added normally
        const otherMessage = {
          ...testMessage,
          user: { id: 'other_user' },
          content: 'other'
        }
        mockSocketMessage(otherMessage)
        expect(store.messages.length).to.equal(originalMessageList.length + 1)
        expect(store.messages[store.messages.length - 1]).to.deep.equal({
          user: otherMessage.user,
          timestamp: otherMessage.timestamp,
          contents: [otherMessage.content]
        })
      })

      it("don't notify an update event after new messages are received", async function() {
        await store.sendMessage(testMessage.content)

        const subscriber = sinon.stub()
        store.on('updated', subscriber)
        mockSocketMessage(testMessage)

        expect(subscriber).not.to.be.called
      })
    })
  })

  describe('loadMoreMessages()', function() {
    it('aborts the request when the entire message list is loaded', async function() {
      store.atEnd = true
      await store.loadMoreMessages()
      expect(fetchMock.calls().length).to.equal(0)
      expect(store.loading).to.equal(false)
    })

    it('updates the list of messages', async function() {
      const originalMessageList = store.messages.slice(0)
      fetchMock.get(/messages/, [testMessage])
      await store.loadMoreMessages()
      expect(store.messages.length).to.equal(originalMessageList.length + 1)
      expect(store.messages[store.messages.length - 1]).to.deep.equal({
        user: testMessage.user,
        timestamp: testMessage.timestamp,
        contents: [testMessage.content]
      })
    })

    it('notifies an update event for when the loading starts, and a second one once data is available', async function() {
      const subscriber = sinon.stub()
      store.on('updated', subscriber)
      fetchMock.get(/messages/, [testMessage])
      await store.loadMoreMessages()
      expect(subscriber).to.be.calledTwice
    })

    it('marks `atEnd` flag to true when there are no more messages to retrieve', async function() {
      expect(store.atEnd).to.equal(false)
      fetchMock.get(/messages/, [testMessage])
      await store.loadMoreMessages()
      expect(store.atEnd).to.equal(true)
    })

    it('marks `atEnd` flag to false when there are still messages to retrieve', async function() {
      const messages = []
      for (let i = 0; i < MESSAGE_LIMIT; i++) {
        messages.push({ ...testMessage, content: `message #${i}` })
      }
      expect(store.atEnd).to.equal(false)
      fetchMock.get(/messages/, messages)
      await store.loadMoreMessages()
      expect(store.atEnd).to.equal(false)
    })

    it('subsequent requests for new messages start at the timestamp of the latest message', async function() {
      const messages = []
      for (let i = 0; i < MESSAGE_LIMIT - 1; i++) {
        // sending enough messages so it doesn't mark `atEnd === true`
        messages.push({ ...testMessage, content: `message #${i}` })
      }

      const timestamp = new Date().getTime()
      messages.push({ ...testMessage, timestamp })

      fetchMock.get(/messages/, messages)
      await store.loadMoreMessages()

      fetchMock.get(/messages/, [])
      await store.loadMoreMessages()

      expect(fetchMock.calls().length).to.equal(2)
      const url = fetchMock.lastCall()[0]
      expect(url).to.match(new RegExp(`&before=${timestamp}`))
    })
  })

  describe('sendMessage()', function() {
    beforeEach(function() {
      fetchMock.post(/messages/, 204)
    })

    it('appends the message to the list', async function() {
      const originalMessageList = store.messages.slice(0)
      await store.sendMessage('a message')
      expect(store.messages.length).to.equal(originalMessageList.length + 1)
      const lastMessage = store.messages[store.messages.length - 1]
      expect(lastMessage.contents).to.deep.equal(['a message'])
      expect(lastMessage.user).to.deep.equal(user)
      expect(lastMessage.timestamp).to.be.greaterThan(0)
    })

    it('notifies an update event', async function() {
      const subscriber = sinon.stub()
      store.on('updated', subscriber)
      await store.sendMessage('a message')
      expect(subscriber).to.be.calledOnce
    })

    it('sends an http POST request to the server', async function() {
      await store.sendMessage('a message')
      expect(fetchMock.calls().length).to.equal(1)
      const body = fetchMock.lastCall()[1].body
      expect(JSON.parse(body)).to.deep.equal({
        content: 'a message',
        _csrf: 'csrf_tok'
      })
    })

    it('ignores empty messages', async function() {
      const subscriber = sinon.stub()
      store.on('updated', subscriber)
      await store.sendMessage('')
      await store.sendMessage(null)
      expect(subscriber).not.to.be.called
    })
  })
})
