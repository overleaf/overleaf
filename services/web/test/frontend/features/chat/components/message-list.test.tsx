import sinon from 'sinon'
import { expect } from 'chai'
import { screen, render, fireEvent } from '@testing-library/react'
import React from 'react'
import MessageList from '../../../../../frontend/js/features/chat/components/message-list'
import { stubMathJax, tearDownMathJaxStubs } from './stubs'
import { UserProvider } from '@/shared/context/user-context'
import { User, UserId } from '@ol-types/user'
import { Message, ChatContext } from '@/features/chat/context/chat-context'
import { ModalsContextProvider } from '@/features/ide-react/context/modals-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

describe('<MessageList />', function () {
  function ChatProviders({ children }: { children: React.ReactNode }) {
    const mockContextValue = {
      idOfMessageBeingEdited: null,
    }

    return (
      <UserProvider>
        <ModalsContextProvider>
          <SplitTestProvider>
            <ChatContext.Provider value={mockContextValue as any}>
              {children}
            </ChatContext.Provider>
          </SplitTestProvider>
        </ModalsContextProvider>
      </UserProvider>
    )
  }

  const currentUser: User = {
    id: 'fake_user' as UserId,
    first_name: 'fake_user_first_name',
    email: 'fake@example.com',
  }

  function createMessages(): Message[] {
    return [
      {
        id: '1',
        content: 'a message',
        user: currentUser,
        timestamp: new Date().getTime(),
      },
      {
        id: '2',
        content: 'another message',
        user: currentUser,
        timestamp: new Date().getTime(),
      },
    ]
  }

  before(function () {
    stubMathJax()
  })

  after(function () {
    tearDownMathJaxStubs()
  })

  let olUser: User
  beforeEach(function () {
    olUser = window.metaAttributesCache.get('ol-user')
    window.metaAttributesCache.set('ol-user', currentUser)
  })

  afterEach(function () {
    window.metaAttributesCache.set('ol-user', olUser)
  })

  it('renders multiple messages', function () {
    render(
      <ChatProviders>
        <MessageList
          messages={createMessages()}
          resetUnreadMessages={() => {}}
        />
      </ChatProviders>
    )

    screen.getByText('a message')
    screen.getByText('another message')
  })

  it('renders a single timestamp for all messages within 5 minutes', function () {
    const msgs = createMessages()
    msgs[0].timestamp = new Date(2019, 6, 3, 4, 23).getTime()
    msgs[1].timestamp = new Date(2019, 6, 3, 4, 27).getTime()

    render(
      <ChatProviders>
        <MessageList messages={msgs} resetUnreadMessages={() => {}} />
      </ChatProviders>
    )

    screen.getByText('4:23 am Wed, 3rd Jul 19')
    expect(screen.queryByText('4:27 am Wed, 3rd Jul 19')).to.not.exist
  })

  it('renders a timestamp for each messages separated for more than 5 minutes', function () {
    const msgs = createMessages()
    msgs[0].timestamp = new Date(2019, 6, 3, 4, 23).getTime()
    msgs[1].timestamp = new Date(2019, 6, 3, 4, 31).getTime()

    render(
      <ChatProviders>
        <MessageList messages={msgs} resetUnreadMessages={() => {}} />
      </ChatProviders>
    )

    screen.getByText('4:23 am Wed, 3rd Jul 19')
    screen.getByText('4:31 am Wed, 3rd Jul 19')
  })

  it('resets the number of unread messages after clicking on the input', function () {
    const resetUnreadMessages = sinon.stub()
    render(
      <ChatProviders>
        <MessageList
          messages={createMessages()}
          resetUnreadMessages={resetUnreadMessages}
        />
      </ChatProviders>
    )

    fireEvent.click(screen.getByRole('list'))
    expect(resetUnreadMessages).to.be.calledOnce
  })

  it('groups messages from different users separately', function () {
    const anotherUser: User = {
      id: 'another_user' as UserId,
      first_name: 'another_user_first_name',
      email: 'another@example.com',
    }

    const messages: Message[] = [
      {
        id: '1',
        content: 'first message from current user',
        user: currentUser,
        timestamp: new Date('2025-09-01 4:20:10').getTime(),
      },
      {
        id: '2',
        content: 'second message from current user',
        user: currentUser,
        timestamp: new Date('2025-09-01 4:20:11').getTime(),
      },
      {
        id: '3',
        content: 'first message from another user',
        user: anotherUser,
        timestamp: new Date('2025-09-01 4:20:12').getTime(),
      },
      {
        id: '4',
        content: 'second message from another user',
        user: anotherUser,
        timestamp: new Date('2025-09-01 4:20:13').getTime(),
      },
    ]

    render(
      <ChatProviders>
        <MessageList messages={messages} resetUnreadMessages={() => {}} />
      </ChatProviders>
    )

    const messageGroups = screen.getAllByRole('listitem')

    // Should have 2 message groups
    expect(messageGroups).to.have.length(2)

    screen.getByText('first message from current user')
    screen.getByText('second message from current user')
    screen.getByText('first message from another user')
    screen.getByText('second message from another user')
  })

  it('does not show deleted messages', function () {
    const messages: Message[] = [
      {
        id: '1',
        content: 'visible message',
        user: currentUser,
        timestamp: new Date().getTime(),
      },
      {
        id: '2',
        content: 'deleted message',
        user: currentUser,
        timestamp: new Date().getTime() + 1000,
        deleted: true,
      },
      {
        id: '3',
        content: 'another visible message',
        user: currentUser,
        timestamp: new Date().getTime() + 2000,
      },
    ]

    render(
      <ChatProviders>
        <MessageList messages={messages} resetUnreadMessages={() => {}} />
      </ChatProviders>
    )

    screen.getByText('visible message')
    screen.getByText('another visible message')

    expect(screen.queryByText('deleted message')).to.not.exist
  })
})
