import { expect } from 'chai'
import { render, screen } from '@testing-library/react'

import ChatToggleButton from '../../../../../frontend/js/features/editor-navigation-toolbar/components/chat-toggle-button'

describe('<ChatToggleButton />', function () {
  const defaultProps = {
    chatIsOpen: false,
    unreadMessageCount: 0,
    onClick: () => {},
  }

  it('displays the number of unread messages', function () {
    const props = {
      ...defaultProps,
      unreadMessageCount: 113,
    }
    render(<ChatToggleButton {...props} />)
    screen.getByText('113')
  })

  it("doesn't display the unread messages badge when the number of unread messages is zero", function () {
    render(<ChatToggleButton {...defaultProps} />)
    expect(screen.queryByText('0')).to.not.exist
  })
})
