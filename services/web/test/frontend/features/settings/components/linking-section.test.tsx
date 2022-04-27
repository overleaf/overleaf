import { expect } from 'chai'
import { screen, render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import LinkingSection from '../../../../../frontend/js/features/settings/components/linking-section'
import { UserProvider } from '../../../../../frontend/js/shared/context/user-context'
import { SSOProvider } from '../../../../../frontend/js/features/settings/context/sso-context'

function renderSectionWithProviders() {
  render(<LinkingSection />, {
    wrapper: ({ children }) => (
      <UserProvider>
        <SSOProvider>{children}</SSOProvider>
      </UserProvider>
    ),
  })
}

const mockOauthProviders = {
  google: {
    descriptionKey: 'login_with_service',
    descriptionOptions: { service: 'Google' },
    name: 'Google',
    linkPath: '/auth/google',
  },
  orcid: {
    descriptionKey: 'oauth_orcid_description',
    descriptionOptions: {
      link: '/blog/434',
      appName: 'Overleaf',
    },
    name: 'Orcid',
    linkPath: '/auth/orcid',
  },
  twitter: {
    hideWhenNotLinked: true,
    name: 'Twitter',
    linkPath: '/auth/twitter',
  },
}

describe('<LinkingSection />', function () {
  beforeEach(function () {
    window.metaAttributesCache = window.metaAttributesCache || new Map()
    window.metaAttributesCache.set('ol-user', {})

    // suppress integrations and references widgets as they cannot be tested in
    // all environments
    window.metaAttributesCache.set('integrationLinkingWidgets', [])
    window.metaAttributesCache.set('referenceLinkingWidgets', [])

    window.metaAttributesCache.set('ol-thirdPartyIds', {
      google: 'google-id',
    })

    window.metaAttributesCache.set('ol-oauthProviders', mockOauthProviders)
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    fetchMock.reset()
  })

  it('shows header', async function () {
    renderSectionWithProviders()

    screen.getByText('Integrations')
    screen.getByText(
      'You can link your Overleaf account with other services to enable the features described below'
    )
  })

  it('lists SSO providers', async function () {
    renderSectionWithProviders()
    screen.getByText('linked accounts')

    screen.getByText('Google')
    screen.getByText('Log in with Google')
    screen.getByRole('button', { name: 'Unlink' })

    screen.getByText('Orcid')
    screen.getByText(
      /Securely establish your identity by linking your ORCID iD/
    )
    const helpLink = screen.getByRole('link', { name: 'Learn more' })
    expect(helpLink.getAttribute('href')).to.equal('/blog/434')
    const linkButton = screen.getByRole('link', { name: 'Link' })
    expect(linkButton.getAttribute('href')).to.equal('/auth/orcid?intent=link')

    expect(screen.queryByText('Twitter')).to.not.exist
  })

  it('does not show providers section when empty', async function () {
    window.metaAttributesCache.delete('ol-oauthProviders')
    renderSectionWithProviders()

    expect(screen.queryByText('linked accounts')).to.not.exist
  })
})
