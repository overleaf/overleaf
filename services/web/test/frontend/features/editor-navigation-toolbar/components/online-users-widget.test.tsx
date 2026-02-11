import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, render, screen } from '@testing-library/react'
import { OnlineUsersWidget } from '@/features/editor-navigation-toolbar/components/online-users-widget'

const names = ['alice', 'bob', 'charlie', 'dave', 'erin', 'frank', 'grace']

function makeUsers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `user_${index + 1}`,
    user_id: `user_id_${index + 1}`,
    name: names[index % names.length],
    email: `${names[index % names.length]}_email`,
  }))
}

describe('<OnlineUsersWidget />', function () {
  const defaultProps = {
    onlineUsers: makeUsers(2),
    goToUser: sinon.stub(),
  }

  describe('with less than 5 users', function () {
    it('displays user initials', function () {
      render(<OnlineUsersWidget {...defaultProps} />)
      screen.getByText('a')
      screen.getByText('b')
    })

    it('displays user name in a tooltip', async function () {
      render(<OnlineUsersWidget {...defaultProps} />)
      const icon = screen.getByText('a')
      fireEvent.mouseOver(icon)
      await screen.findByRole('tooltip', { name: 'alice' })
    })

    it('calls "goToUser" when the user initial is clicked', function () {
      render(<OnlineUsersWidget {...defaultProps} />)

      const icon = screen.getByText('a')
      fireEvent.click(icon)

      expect(defaultProps.goToUser).to.be.calledWith({
        id: 'user_1',
        user_id: 'user_id_1',
        name: 'alice',
        email: 'alice_email',
      })
    })
  })

  describe('with 5 users', function () {
    const props = {
      ...defaultProps,
      onlineUsers: makeUsers(5),
    }

    it('displays user initials', function () {
      render(<OnlineUsersWidget {...props} />)
      screen.getByText('a')
      screen.getByText('b')
      screen.getByText('c')
      screen.getByText('d')
      screen.getByText('e')
    })
  })

  describe('with more than 5 users', function () {
    const props = {
      ...defaultProps,
      onlineUsers: makeUsers(7),
    }

    it('displays a maximum of 4 user initials and an overflow icon', function () {
      render(<OnlineUsersWidget {...props} />)
      screen.getByText('a')
      screen.getByText('b')
      screen.getByText('c')
      screen.getByText('d')
      screen.getByText('+3')
    })

    it('displays the remaining users in a dropdown when the overflow icon is clicked', async function () {
      render(<OnlineUsersWidget {...props} />)
      const overflowButton = screen.getByText('+3')
      fireEvent.click(overflowButton)

      await screen.findByText('erin')
      await screen.findByText('frank')
      await screen.findByText('grace')
    })

    it('calls "goToUser" when a user in the overflow dropdown is clicked', async function () {
      const props = {
        ...defaultProps,
        onlineUsers: makeUsers(7),
      }

      render(<OnlineUsersWidget {...props} />)
      const overflowButton = screen.getByText('+3')
      fireEvent.click(overflowButton)

      const frankButton = await screen.findByText('frank')
      fireEvent.click(frankButton)

      expect(props.goToUser).to.be.calledWith({
        id: 'user_6',
        user_id: 'user_id_6',
        name: 'frank',
        email: 'frank_email',
      })
    })
  })
})
