// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import { renderHook, act, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import clientIdGenerator from '@/utils/client-id'
import {
  useChatContext,
  ServerMessageEntry,
} from '@/features/chat/context/chat-context'
import { stubMathJax, tearDownMathJaxStubs } from '../components/stubs'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'
import {
  EditorProviders,
  EditorProvidersProps,
} from '../../../helpers/editor-providers'
import { User, UserId } from '@ol-types/user'
import { Socket } from '@/features/ide-react/connection/types/socket'

describe('ChatContext', function () {
  const user: User = {
    id: 'fake_user' as UserId,
    first_name: 'fake_user_first_name',
    email: 'fake@example.com',
  }
  const uuidValue = '00000000-0000-0000-0000-000000000000'

  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()

    stubMathJax()

    window.metaAttributesCache.set('ol-user', user)
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)

    this.stub = sinon.stub(clientIdGenerator, 'get').returns(uuidValue)
  })

  afterEach(function () {
    tearDownMathJaxStubs()

    this.stub.restore()
  })

  describe('socket connection', function () {
    beforeEach(function () {
      // Mock GET messages to return no messages
      fetchMock.get('express:/project/:projectId/messages', [], {
        name: 'fetchMessages',
      })

      // Mock POST new message to return 200
      fetchMock.post('express:/project/:projectId/messages', 200)
    })

    afterEach(function () {
      fetchMock.removeRoutes().clearHistory()
    })

    it('subscribes when mounted', function () {
      const socket = new SocketIOMock()
      renderChatContextHook({
        socket: socket as any as Socket,
      })
      expect(socket.countEventListeners('new-chat-message')).to.equal(1)
    })

    it('unsubscribes when unmounted', function () {
      const socket = new SocketIOMock()
      const { unmount } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      unmount()

      expect(socket.countEventListeners('new-chat-message')).to.equal(0)
    })

    it('adds received messages to the list', async function () {
      // Mock socket: we only need to emit events, not mock actual connections
      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      // Wait until initial messages have loaded
      result.current.loadInitialMessages()
      await waitFor(
        () => expect(result.current.initialMessagesLoaded).to.be.true
      )

      // No messages shown at first
      expect(result.current.messages).to.deep.equal([])

      // Mock message being received from another user
      socket.emitToClient('new-chat-message', {
        id: 'msg_1',
        content: 'new message',
        timestamp: Date.now(),
        user: {
          id: 'another_fake_user',
          first_name: 'another_fake_user_first_name',
          email: 'another_fake@example.com',
        },
      })

      await waitFor(() => {
        const message = result.current.messages[0]
        expect(message.id).to.equal('msg_1')
        expect(message.contents).to.deep.equal(['new message'])
      })
    })

    it('deduplicate messages from preloading', async function () {
      // Mock socket: we only need to emit events, not mock actual connections
      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      fetchMock.modifyRoute('fetchMessages', {
        response: () => [
          {
            id: 'msg_1',
            content: 'new message',
            timestamp: Date.now(),
            user: {
              id: 'another_fake_user',
              first_name: 'another_fake_user_first_name',
              email: 'another_fake@example.com',
            },
          },
        ],
      })

      // Mock message being received from another user
      socket.emitToClient('new-chat-message', {
        id: 'msg_1',
        content: 'new message',
        timestamp: Date.now(),
        user: {
          id: 'another_fake_user',
          first_name: 'another_fake_user_first_name',
          email: 'another_fake@example.com',
        },
      })

      // Check if received the message ID
      await waitFor(() => expect(result.current.messages).to.have.length(1))

      // Wait until initial messages have loaded
      result.current.loadInitialMessages()
      await waitFor(
        () => expect(result.current.initialMessagesLoaded).to.be.true
      )

      // Check if there are no message duplication
      expect(result.current.messages).to.have.length(1)

      const message = result.current.messages[0]
      expect(message.id).to.equal('msg_1')
      expect(message.contents).to.deep.equal(['new message'])
    })

    it('deduplicate messages from websocket', async function () {
      // Mock socket: we only need to emit events, not mock actual connections
      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      fetchMock.modifyRoute('fetchMessages', {
        response: [
          {
            id: 'msg_1',
            content: 'new message',
            timestamp: Date.now(),
            user: {
              id: 'another_fake_user',
              first_name: 'another_fake_user_first_name',
              email: 'another_fake@example.com',
            },
          },
        ],
      })

      // Wait until initial messages have loaded
      result.current.loadInitialMessages()

      // Check if received the message ID
      await waitFor(() => expect(result.current.messages).to.have.length(1))

      // Mock message being received from another user
      socket.emitToClient('new-chat-message', {
        id: 'msg_1',
        content: 'new message',
        timestamp: Date.now(),
        user: {
          id: 'another_fake_user',
          first_name: 'another_fake_user_first_name',
          email: 'another_fake@example.com',
        },
      })

      // Check if there are no message duplication
      expect(result.current.messages).to.have.length(1)

      const message = result.current.messages[0]
      expect(message.id).to.equal('msg_1')
      expect(message.contents).to.deep.equal(['new message'])
    })

    it("doesn't add received messages from the current user if a message was just sent", async function () {
      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      // Wait until initial messages have loaded
      result.current.loadInitialMessages()
      await waitFor(
        () => expect(result.current.initialMessagesLoaded).to.be.true
      )

      // Send a message from the current user
      const sentMsg = 'sent message'
      result.current.sendMessage(sentMsg)

      act(() => {
        // Receive a message from the current user
        socket.emitToClient('new-chat-message', {
          id: 'msg_1',
          content: 'received message',
          timestamp: Date.now(),
          user,
          clientId: uuidValue,
        })
      })

      await waitFor(() => expect(result.current.messages).to.have.length(1))

      const [message] = result.current.messages

      expect(message.contents).to.deep.equal([sentMsg])
    })

    it('adds the new message from the current user if another message was received after sending', async function () {
      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      // Wait until initial messages have loaded
      result.current.loadInitialMessages()
      await waitFor(
        () => expect(result.current.initialMessagesLoaded).to.be.true
      )

      // Send a message from the current user
      const sentMsg = 'sent message from current user'
      act(() => {
        result.current.sendMessage(sentMsg)
      })

      const [sentMessageFromCurrentUser] = result.current.messages
      expect(sentMessageFromCurrentUser.contents).to.deep.equal([sentMsg])

      const otherMsg = 'new message from other user'

      act(() => {
        // Receive a message from another user.
        socket.emitToClient('new-chat-message', {
          id: 'msg_1',
          content: otherMsg,
          timestamp: Date.now(),
          user: {
            id: 'another_fake_user',
            first_name: 'another_fake_user_first_name',
            email: 'another_fake@example.com',
          },
          clientId: '123',
        })
      })

      const [, messageFromOtherUser] = result.current.messages
      expect(messageFromOtherUser.contents).to.deep.equal([otherMsg])

      act(() => {
        // Receive a message from the current user
        socket.emitToClient('new-chat-message', {
          id: 'msg_2',
          content: 'received message from current user',
          timestamp: Date.now(),
          user,
          clientId: uuidValue,
        })
      })

      // Since the current user didn't just send a message, it is now shown
      expect(result.current.messages).to.deep.equal([
        sentMessageFromCurrentUser,
        messageFromOtherUser,
      ])
    })
  })

  describe('loadInitialMessages', function () {
    beforeEach(function () {
      fetchMock.get('express:/project/:projectId/messages', [
        {
          id: 'msg_1',
          content: 'a message',
          user,
          timestamp: Date.now(),
        },
      ])
    })

    it('adds messages to the list', async function () {
      const { result } = renderChatContextHook({})

      result.current.loadInitialMessages()
      await waitFor(() =>
        expect(result.current.messages[0].contents).to.deep.equal(['a message'])
      )
    })

    it("won't load messages a second time", async function () {
      const { result } = renderChatContextHook({})

      result.current.loadInitialMessages()

      await waitFor(() =>
        expect(result.current.initialMessagesLoaded).to.equal(true)
      )

      // Calling a second time won't do anything
      result.current.loadInitialMessages()
      await waitFor(
        () => expect(result.current.initialMessagesLoaded).to.be.true
      )

      expect(
        fetchMock.callHistory.calls('express:/project/:projectId/messages')
      ).to.have.lengthOf(1)
    })

    it('provides an error on failure', async function () {
      fetchMock.removeRoutes().clearHistory()
      fetchMock.get('express:/project/:projectId/messages', 500)
      const { result } = renderChatContextHook({})

      result.current.loadInitialMessages()
      await waitFor(() => expect(result.current.error).to.exist)
      expect(result.current.status).to.equal('error')
    })
  })

  describe('loadMoreMessages', function () {
    it('adds messages to the list', async function () {
      // Mock a GET request for an initial message
      fetchMock.getOnce('express:/project/:projectId/messages', [
        {
          id: 'msg_1',
          content: 'first message',
          user,
          timestamp: new Date('2021-03-04T10:00:00').getTime(),
        },
      ])

      const { result } = renderChatContextHook({})

      result.current.loadMoreMessages()
      await waitFor(() =>
        expect(result.current.messages[0].contents).to.deep.equal([
          'first message',
        ])
      )

      // The before query param is not set
      expect(getLastFetchMockQueryParam('before')).to.be.null
    })

    it('adds more messages if called a second time', async function () {
      // Mock 2 GET requests, with different content
      fetchMock
        .getOnce(
          'express:/project/:projectId/messages',
          // Resolve a full "page" of messages (50)
          createMessages(50, user, new Date('2021-03-04T10:00:00').getTime())
        )
        .getOnce('express:/project/:projectId/messages', [
          {
            id: 'msg_51',
            content: 'message from second page',
            user,
            timestamp: new Date('2021-03-04T11:00:00').getTime(),
          },
        ])

      const { result } = renderChatContextHook({})

      result.current.loadMoreMessages()
      await waitFor(() =>
        expect(result.current.messages[0].contents).to.have.length(50)
      )

      // Call a second time
      result.current.loadMoreMessages()

      // The second request is added to the list
      // Since both messages from the same user, they are collapsed into the
      // same "message"
      await waitFor(() =>
        expect(result.current.messages[0].contents).to.include(
          'message from second page'
        )
      )

      // The before query param for the second request matches the timestamp
      // of the first message
      const beforeParamRaw = getLastFetchMockQueryParam('before')
      expect(beforeParamRaw).to.not.be.null
      const beforeParam = parseInt(beforeParamRaw!, 10)
      expect(beforeParam).to.equal(new Date('2021-03-04T10:00:00').getTime())
    })

    it("won't load more messages if there are no more messages", async function () {
      // Mock a GET request for 49 messages. This is less than the full page
      // size (50 messages), meaning that there are no further messages to be
      // loaded
      fetchMock.getOnce(
        'express:/project/:projectId/messages',
        createMessages(49, user)
      )

      const { result } = renderChatContextHook({})

      result.current.loadMoreMessages()
      await waitFor(() =>
        expect(result.current.messages[0].contents).to.have.length(49)
      )

      result.current.loadMoreMessages()

      await waitFor(() => expect(result.current.atEnd).to.be.true)

      expect(
        fetchMock.callHistory.calls('express:/project/:projectId/messages')
      ).to.have.lengthOf(1)
    })

    it('handles socket messages while loading', async function () {
      // Mock GET messages so that we can control when the promise is resolved
      let resolveLoadingMessages: (messages: ServerMessageEntry[]) => void
      fetchMock.get(
        'express:/project/:projectId/messages',
        new Promise(resolve => {
          resolveLoadingMessages = resolve
        })
      )

      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      // Start loading messages
      result.current.loadMoreMessages()

      // Mock message being received from the socket while the request is in
      // flight
      socket.emitToClient('new-chat-message', {
        id: 'socket_msg',
        content: 'socket message',
        timestamp: Date.now(),
        user: {
          id: 'another_fake_user',
          first_name: 'another_fake_user_first_name',
          email: 'another_fake@example.com',
        },
      })

      // Resolve messages being loaded
      resolveLoadingMessages!([
        {
          id: 'fetched_msg',
          content: 'loaded message',
          user,
          timestamp: Date.now(),
        },
      ])

      await waitFor(() => {
        // Although the loaded message was resolved last, it appears first (since
        // requested messages must have come first)
        const messageContents = result.current.messages.map(
          ({ contents }) => contents[0]
        )
        expect(messageContents).to.deep.equal([
          'loaded message',
          'socket message',
        ])
      })
    })

    it('provides an error on failures', async function () {
      fetchMock.removeRoutes().clearHistory()
      fetchMock.get('express:/project/:projectId/messages', 500)
      const { result } = renderChatContextHook({})

      result.current.loadMoreMessages()
      await waitFor(() => expect(result.current.error).to.exist)
      expect(result.current.status).to.equal('error')
    })
  })

  describe('sendMessage', function () {
    beforeEach(function () {
      // Mock GET messages to return no messages and POST new message to be
      // successful
      fetchMock
        .get('express:/project/:projectId/messages', [])
        .postOnce('express:/project/:projectId/messages', 200)
    })

    it('optimistically adds the message to the list', async function () {
      const { result } = renderChatContextHook({})

      result.current.sendMessage('sent message')

      await waitFor(() =>
        expect(result.current.messages[0].contents).to.deep.equal([
          'sent message',
        ])
      )
    })

    it('POSTs the message to the backend', function () {
      const { result } = renderChatContextHook({})

      result.current.sendMessage('sent message')

      const calls = fetchMock.callHistory.calls(
        'express:/project/:projectId/messages',
        { method: 'POST' }
      )
      expect(calls.length).to.be.greaterThanOrEqual(1)

      const {
        options: { body },
      } = calls.at(-1)!
      expect(body).to.not.be.undefined
      expect(JSON.parse(body!.toString())).to.deep.include({
        content: 'sent message',
      })
    })

    it("doesn't send if the content is empty", function () {
      const { result } = renderChatContextHook({})

      result.current.sendMessage('')

      expect(result.current.messages).to.be.empty
      expect(
        fetchMock.callHistory.called('express:/project/:projectId/messages', {
          method: 'post',
        })
      ).to.be.false
    })

    it('provides an error on failure', async function () {
      fetchMock.removeRoutes().clearHistory()
      fetchMock
        .get('express:/project/:projectId/messages', [])
        .postOnce('express:/project/:projectId/messages', 500)
      const { result } = renderChatContextHook({})

      result.current.sendMessage('sent message')
      await waitFor(() => expect(result.current.error).to.exist)

      expect(result.current.status).to.equal('error')
    })
  })

  describe('unread messages', function () {
    beforeEach(function () {
      // Mock GET messages to return no messages
      fetchMock.get('express:/project/:projectId/messages', [])
    })

    it('increments unreadMessageCount when a new message is received', function () {
      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      // Receive a new message from the socket
      act(() => {
        socket.emitToClient('new-chat-message', {
          id: 'msg_1',
          content: 'new message',
          timestamp: Date.now(),
          user,
        })
      })

      expect(result.current.unreadMessageCount).to.equal(1)
    })

    it('resets unreadMessageCount when markMessagesAsRead is called', function () {
      const socket = new SocketIOMock()
      const { result } = renderChatContextHook({
        socket: socket as any as Socket,
      })

      // Receive a new message from the socket, incrementing unreadMessageCount
      // by 1
      socket.emitToClient('new-chat-message', {
        id: 'msg_1',
        content: 'new message',
        timestamp: Date.now(),
        user,
      })

      result.current.markMessagesAsRead()

      expect(result.current.unreadMessageCount).to.equal(0)
    })
  })
})

function renderChatContextHook(props: EditorProvidersProps) {
  return renderHook(() => useChatContext(), {
    // Wrap with ChatContext.Provider (and the other editor context providers)
    // eslint-disable-next-line react/display-name
    wrapper: ({ children }) => (
      <EditorProviders {...props}>{children}</EditorProviders>
    ),
  })
}

function createMessages(
  number: number,
  user: User,
  timestamp = Date.now()
): ServerMessageEntry[] {
  return Array.from({ length: number }, (_m, idx) => ({
    id: `msg_${idx + 1}`,
    content: `message ${idx + 1}`,
    user,
    timestamp,
  }))
}

/*
 * Get query param by key from the last fetchMock response
 */
function getLastFetchMockQueryParam(key: string) {
  const calls = fetchMock.callHistory.calls()
  if (calls.length === 0) {
    throw new Error('No fetchMock calls found')
  }
  const { url } = calls.at(-1)!
  const { searchParams } = new URL(url, 'https://www.overleaf.com')
  return searchParams.get(key)
}
