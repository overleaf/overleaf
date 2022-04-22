import {
  fireEvent,
  screen,
  waitForElementToBeRemoved,
  render,
} from '@testing-library/react'

import LeaveSection from '../../../../../frontend/js/features/settings/components/leave-section'

describe('<LeaveSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-usersEmail', 'foo@bar.com')
    window.metaAttributesCache.set('ol-ExposedSettings', { isOverleaf: true })
    window.metaAttributesCache.set('ol-hasPassword', true)
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('opens modal', async function () {
    render(<LeaveSection />)

    const button = screen.getByRole('button', {
      name: 'Delete your account',
    })

    fireEvent.click(button)
    await screen.findByText('Delete Account')
  })

  it('closes modal', async function () {
    render(<LeaveSection />)
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Delete your account',
      })
    )

    const cancelButton = screen.getByRole('button', {
      name: 'Close',
    })

    fireEvent.click(cancelButton)

    await waitForElementToBeRemoved(() => screen.getByText('Delete Account'))
  })
})
