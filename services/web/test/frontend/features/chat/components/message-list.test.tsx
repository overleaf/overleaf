import sinon from 'sinon'
import { expect } from 'chai'
import { screen, render, fireEvent } from '@testing-library/react'

import MessageList from '../../../../../frontend/js/features/chat/components/message-list'
import { stubMathJax, tearDownMathJaxStubs } from './stubs'
import { UserProvider } from '@/shared/context/user-context'
import { User, UserId } from '@ol-types/user'
import { Message } from '@/features/chat/context/chat-context'

describe('<MessageList />', function () {
  const currentUser: User = {
    id: 'fake_user' as UserId,
    first_name: 'fake_user_first_name',
    email: 'fake@example.com',
  }

  function createMessages(): Message[] {
    return [
      {
        id: '1',
        contents: ['a message'],
        user: currentUser,
        timestamp: new Date().getTime(),
      },
      {
        id: '2',
        contents: ['another message'],
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
      <UserProvider>
        <MessageList
          messages={createMessages()}
          resetUnreadMessages={() => {}}
        />
      </UserProvider>
    )

    screen.getByText('a message')
    screen.getByText('another message')
  })

  it('renders a single timestamp for all messages within 5 minutes', function () {
    const msgs = createMessages()
    msgs[0].timestamp = new Date(2019, 6, 3, 4, 23).getTime()
    msgs[1].timestamp = new Date(2019, 6, 3, 4, 27).getTime()

    render(
      <UserProvider>
        <MessageList messages={msgs} resetUnreadMessages={() => {}} />
      </UserProvider>
    )

    screen.getByText('4:23 am Wed, 3rd Jul 19')
    expect(screen.queryByText('4:27 am Wed, 3rd Jul 19')).to.not.exist
  })

  it('renders a timestamp for each messages separated for more than 5 minutes', function () {
    const msgs = createMessages()
    msgs[0].timestamp = new Date(2019, 6, 3, 4, 23).getTime()
    msgs[1].timestamp = new Date(2019, 6, 3, 4, 31).getTime()

    render(
      <UserProvider>
        <MessageList messages={msgs} resetUnreadMessages={() => {}} />
      </UserProvider>
    )

    screen.getByText('4:23 am Wed, 3rd Jul 19')
    screen.getByText('4:31 am Wed, 3rd Jul 19')
  })

  it('resets the number of unread messages after clicking on the input', function () {
    const resetUnreadMessages = sinon.stub()
    render(
      <UserProvider>
        <MessageList
          messages={createMessages()}
          resetUnreadMessages={resetUnreadMessages}
        />
      </UserProvider>
    )

    fireEvent.click(screen.getByRole('list'))
    expect(resetUnreadMessages).to.be.calledOnce
  })
})
