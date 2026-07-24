import { expect } from 'chai'
import { render, screen } from '@testing-library/react'

import MessageGroup from '../../../../../frontend/js/features/chat/components/message-group'
import { stubMathJax, tearDownMathJaxStubs } from './stubs'
import { User, UserId } from '@ol-types/user'
import {
  ChatContext,
  Message as MessageType,
} from '@/features/chat/context/chat-context'
import { UserProvider } from '@/shared/context/user-context'
import { ModalsContextProvider } from '@/features/ide-react/context/modals-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'

describe('<MessageGroup />', function () {
  function ChatProviders({
    children,
    idOfMessageBeingEdited = null,
  }: {
    children: React.ReactNode
    idOfMessageBeingEdited?: string | null
  }) {
    const mockContextValue = {
      idOfMessageBeingEdited,
      cancelMessageEdit: () => {},
      editMessage: () => {},
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

  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', currentUser)
    stubMathJax()
  })

  afterEach(function () {
    tearDownMathJaxStubs()
  })

  it('renders a basic message', function () {
    const message: MessageType = {
      content: 'a message',
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    render(
      <ChatProviders>
        <MessageGroup messages={[message]} fromSelf />
      </ChatProviders>
    )

    screen.getByText('a message')
  })

  it('renders a message with multiple contents', function () {
    const messages: MessageType[] = [
      {
        content: 'a message',
        user: currentUser,
        id: 'msg_1',
        timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
      },
      {
        content: 'another message',
        user: currentUser,
        id: 'msg_2',
        timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
      },
    ]

    render(
      <ChatProviders>
        <MessageGroup messages={messages} fromSelf />
      </ChatProviders>
    )
    screen.getByText('a message')
    screen.getByText('another message')
  })

  it('renders HTML links within messages', function () {
    const message: MessageType = {
      content:
        'a message with a <a href="https://overleaf.com">link to Overleaf</a>',
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    render(
      <ChatProviders>
        <MessageGroup messages={[message]} fromSelf />
      </ChatProviders>
    )

    screen.getByRole('link', { name: 'https://overleaf.com' })
  })

  it('renders edited message with "(edited)" indicator', function () {
    const editedMessage: MessageType = {
      content: 'this message has been edited',
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
      edited: true,
    }

    render(
      <ChatProviders>
        <MessageGroup messages={[editedMessage]} fromSelf />
      </ChatProviders>
    )

    screen.getByText('this message has been edited')
    screen.getByText('(edited)')
  })

  it('does not render "(edited)" indicator for non-edited message', function () {
    const message: MessageType = {
      content: 'this message was not edited',
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
      edited: false,
    }

    render(
      <ChatProviders>
        <MessageGroup messages={[message]} fromSelf />
      </ChatProviders>
    )

    screen.getByText('this message was not edited')
    expect(screen.queryByText('(edited)')).to.not.exist
  })

  it('renders message being edited with textarea and action buttons', function () {
    const messageBeingEdited: MessageType = {
      content: 'original message content',
      user: currentUser,
      id: 'msg_being_edited',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    render(
      <ChatProviders idOfMessageBeingEdited="msg_being_edited">
        <MessageGroup messages={[messageBeingEdited]} fromSelf />
      </ChatProviders>
    )

    const textarea = screen.getByDisplayValue('original message content')
    expect(textarea.tagName.toLowerCase()).to.equal('textarea')

    screen.getByRole('button', { name: 'Cancel' })
    screen.getByRole('button', { name: 'Save' })

    const paragraphs = screen.queryAllByText('original message content', {
      selector: 'p',
    })
    expect(paragraphs).to.have.length(0)
  })

  describe('when the message is from the user themselves', function () {
    const message: MessageType = {
      content: 'a message',
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    it('does not render the user name nor the email', function () {
      render(
        <ChatProviders>
          <MessageGroup messages={[message]} fromSelf />
        </ChatProviders>
      )

      expect(screen.queryByText(currentUser.first_name!)).to.not.exist
      expect(screen.queryByText(currentUser.email)).to.not.exist
    })
  })

  describe('when the message is from other user', function () {
    const otherUser: User = {
      id: 'other_user' as UserId,
      first_name: 'other_user_first_name',
      email: 'other@example.com',
    }

    const message: MessageType = {
      content: 'a message',
      user: otherUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    it('should render the other user name', function () {
      render(
        <ChatProviders>
          <MessageGroup
            messages={[message]}
            user={otherUser}
            fromSelf={false}
          />
        </ChatProviders>
      )

      screen.getByText(otherUser.first_name!)
    })

    it('should render the other user email when their name is not available', function () {
      const msg: MessageType = {
        content: message.content,
        user: {
          id: otherUser.id,
          email: 'other@example.com',
        },
        id: 'msg_1',
        timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
      }

      render(
        <ChatProviders>
          <MessageGroup messages={[msg]} user={msg.user} fromSelf={false} />
        </ChatProviders>
      )

      expect(screen.queryByText(otherUser.first_name!)).to.not.exist
      screen.getByText(msg.user!.email)
    })
  })
})
