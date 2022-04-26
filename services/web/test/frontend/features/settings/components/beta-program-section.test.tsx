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

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('shows link to sessions', async function () {
    renderSectionWithUserProvider(<BetaProgramSection />)

    const link = screen.getByRole('link', {
      name: 'Manage Beta Program Membership',
    })

    expect(link.getAttribute('href')).to.equal('/beta/participate')
  })

  it('shows enrolled status', async function () {
    renderSectionWithUserProvider(<BetaProgramSection />)
    screen.getByText('You are enrolled in the Beta Program')
  })

  it('shows not enrolled status', async function () {
    window.metaAttributesCache.set('ol-user', {
      betaProgram: false,
    })
    renderSectionWithUserProvider(<BetaProgramSection />)
    screen.getByText(/By joining our Beta program you can have early access/)
  })
})
