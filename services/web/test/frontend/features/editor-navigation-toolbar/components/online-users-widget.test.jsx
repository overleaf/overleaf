import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, render, screen } from '@testing-library/react'

import OnlineUsersWidget from '../../../../../frontend/js/features/editor-navigation-toolbar/components/online-users-widget'

describe('<OnlineUsersWidget />', function () {
  const defaultProps = {
    onlineUsers: [
      {
        user_id: 'test_user',
        name: 'test_user',
      },
      {
        user_id: 'another_test_user',
        name: 'another_test_user',
      },
    ],
    goToUser: () => {},
  }

  describe('with less than 4 users', function () {
    it('displays user initials', function () {
      render(<OnlineUsersWidget {...defaultProps} />)
      screen.getByText('t')
      screen.getByText('a')
    })

    it('displays user name in a tooltip', async function () {
      render(<OnlineUsersWidget {...defaultProps} />)
      const icon = screen.getByText('t')
      fireEvent.mouseOver(icon)
      await screen.findByRole('tooltip', { name: 'test_user' })
    })

    it('calls "goToUser" when the user initial is clicked', function () {
      const props = {
        ...defaultProps,
        goToUser: sinon.stub(),
      }
      render(<OnlineUsersWidget {...props} />)

      const icon = screen.getByText('t')
      fireEvent.click(icon)

      expect(props.goToUser).to.be.calledWith({
        name: 'test_user',
        user_id: 'test_user',
      })
    })
  })

  describe('with 4 users and more', function () {
    const props = {
      ...defaultProps,
      onlineUsers: defaultProps.onlineUsers.concat([
        {
          user_id: 'user_3',
          name: 'user_3',
        },
        {
          user_id: 'user_4',
          name: 'user_4',
        },
      ]),
    }

    it('displays the count of users', function () {
      render(<OnlineUsersWidget {...props} />)
      screen.getByText('4')
    })

    it('displays user names on hover', function () {
      render(<OnlineUsersWidget {...props} />)

      const toggleButton = screen.getByRole('button')
      fireEvent.click(toggleButton)

      screen.getByText('test_user')
      screen.getByText('another_test_user')
      screen.getByText('user_3')
      screen.getByText('user_4')
    })

    it('calls "goToUser" when the user name is clicked', function () {
      const testProps = {
        ...props,
        goToUser: sinon.stub(),
      }
      render(<OnlineUsersWidget {...testProps} />)

      const toggleButton = screen.getByRole('button')
      fireEvent.click(toggleButton)

      const icon = screen.getByText('user_3')
      fireEvent.click(icon)

      expect(testProps.goToUser).to.be.calledWith({
        name: 'user_3',
        user_id: 'user_3',
      })
    })
  })
})
