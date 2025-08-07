import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import BetaProgramSection from '../../../../../frontend/js/features/settings/components/beta-program-section'
import { UserProvider } from '../../../../../frontend/js/shared/context/user-context'

function renderSectionWithUserProvider() {
  render(<BetaProgramSection />, {
    wrapper: ({ children }) => <UserProvider>{children}</UserProvider>,
  })
}

describe('<BetaProgramSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', {
      betaProgram: true,
    })
  })

  it('shows link to sessions', async function () {
    renderSectionWithUserProvider()

    const link = screen.getByRole('link', {
      name: 'Manage beta program membership',
    })

    expect(link.getAttribute('href')).to.equal('/beta/participate')
  })

  it('shows enrolled status', async function () {
    renderSectionWithUserProvider()
    screen.getByText('You are enrolled in the beta program')
  })

  it('shows not enrolled status', async function () {
    window.metaAttributesCache.set('ol-user', {
      betaProgram: false,
    })
    renderSectionWithUserProvider()
    screen.getByText('You are not enrolled in the beta program')
    screen.getByText(/By joining this program you can have/)
  })
})
