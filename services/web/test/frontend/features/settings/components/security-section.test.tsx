import SecuritySection from '@/features/settings/components/security-section'
import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'

describe('<SecuritySection />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows Group SSO rows in security section', async function () {
    window.metaAttributesCache.set('ol-memberOfSSOEnabledGroups', [
      {
        groupId: 'abc123abc123',
        linked: true,
      },
      {
        groupId: 'fff999fff999',
        linked: false,
      },
    ])
    render(<SecuritySection />)

    expect(screen.getAllByText('Single Sign-On (SSO)').length).to.equal(2)
    const link = screen.getByRole('link', {
      name: /Set up SSO/i,
    })
    expect(link).to.exist
    expect(link.getAttribute('href')).to.equal(
      '/subscription/fff999fff999/sso_enrollment'
    )
  })

  it('does not show the security section with no groups with SSO enabled', async function () {
    window.metaAttributesCache.set('ol-memberOfSSOEnabledGroups', [])
    render(<SecuritySection />)

    expect(screen.queryByText('Security')).to.not.exist
  })
})
