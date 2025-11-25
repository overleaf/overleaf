import {
  fireEvent,
  screen,
  waitForElementToBeRemoved,
  render,
} from '@testing-library/react'

import LeaveSection from '../../../../../frontend/js/features/settings/components/leave-section'
import getMeta from '@/utils/meta'

describe('<LeaveSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-usersEmail', 'foo@bar.com')
    Object.assign(getMeta('ol-ExposedSettings'), { isOverleaf: true })
    window.metaAttributesCache.set('ol-hasPassword', true)
  })

  it('opens modal', async function () {
    render(<LeaveSection />)

    const button = screen.getByRole('button', {
      name: 'Delete your account',
    })

    fireEvent.click(button)
    await screen.findByText('Delete account')
  })

  it('closes modal', async function () {
    render(<LeaveSection />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete your account',
      })
    )

    const cancelButton = screen.getByRole('button', {
      name: 'Cancel',
    })

    fireEvent.click(cancelButton)

    await waitForElementToBeRemoved(() => screen.getByText('Delete account'))
  })
})
