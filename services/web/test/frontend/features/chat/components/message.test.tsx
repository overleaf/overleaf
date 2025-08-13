import { expect } from 'chai'
import { render, screen } from '@testing-library/react'

import Message from '../../../../../frontend/js/features/chat/components/message'
import { stubMathJax, tearDownMathJaxStubs } from './stubs'
import { User, UserId } from '@ol-types/user'
import { Message as MessageType } from '@/features/chat/context/chat-context'

describe('<Message />', function () {
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
      contents: ['a message'],
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    render(<Message message={message} fromSelf />)

    screen.getByText('a message')
  })

  it('renders a message with multiple contents', function () {
    const message: MessageType = {
      contents: ['a message', 'another message'],
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    render(<Message message={message} fromSelf />)

    screen.getByText('a message')
    screen.getByText('another message')
  })

  it('renders HTML links within messages', function () {
    const message: MessageType = {
      contents: [
        'a message with a <a href="https://overleaf.com">link to Overleaf</a>',
      ],
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    render(<Message message={message} fromSelf />)

    screen.getByRole('link', { name: 'https://overleaf.com' })
  })

  describe('when the message is from the user themselves', function () {
    const message: MessageType = {
      contents: ['a message'],
      user: currentUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    it('does not render the user name nor the email', function () {
      render(<Message message={message} fromSelf />)

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
      contents: ['a message'],
      user: otherUser,
      id: 'msg_1',
      timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
    }

    it('should render the other user name', function () {
      render(<Message message={message} fromSelf={false} />)

      screen.getByText(otherUser.first_name!)
    })

    it('should render the other user email when their name is not available', function () {
      const msg: MessageType = {
        contents: message.contents,
        user: {
          id: otherUser.id,
          email: 'other@example.com',
        },
        id: 'msg_1',
        timestamp: new Date('2025-01-01T00:00:00.000Z').getTime(),
      }

      render(<Message message={msg} fromSelf={false} />)

      expect(screen.queryByText(otherUser.first_name!)).to.not.exist
      screen.getByText(msg.user!.email)
    })
  })
})
