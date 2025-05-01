import { expect } from 'chai'
import { renderHook, waitFor } from '@testing-library/react'
import {
  SSOProvider,
  useSSOContext,
} from '../../../../../frontend/js/features/settings/context/sso-context'
import fetchMock from 'fetch-mock'

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
    name: 'ORCID',
    linkPath: '/auth/orcid',
  },
}

describe('SSOContext', function () {
  const renderSSOContext = () =>
    renderHook(() => useSSOContext(), {
      wrapper: ({ children }) => <SSOProvider>{children}</SSOProvider>,
    })

  beforeEach(function () {
    window.metaAttributesCache.set('ol-thirdPartyIds', {
      google: 'google-id',
    })
    window.metaAttributesCache.set('ol-oauthProviders', mockOauthProviders)
    fetchMock.removeRoutes().clearHistory()
  })

  it('should initialise subscriptions with their linked status', function () {
    const { result } = renderSSOContext()
    expect(result.current.subscriptions).to.deep.equal({
      google: {
        providerId: 'google',
        provider: mockOauthProviders.google,
        linked: true,
      },
      orcid: {
        providerId: 'orcid',
        provider: mockOauthProviders.orcid,
        linked: false,
      },
    })
  })

  describe('unlink', function () {
    beforeEach(function () {
      fetchMock.post('express:/user/oauth-unlink', 200)
    })

    it('should unlink an existing subscription', async function () {
      const { result } = renderSSOContext()
      result.current.unlink('google')
      await waitFor(
        () => expect(result.current.subscriptions.google.linked).to.be.false
      )
    })

    it('when the provider is not linked, should do nothing', function () {
      const { result } = renderSSOContext()
      result.current.unlink('orcid')
      expect(fetchMock.callHistory.called()).to.be.false
    })

    it('supports unmounting the component while the request is inflight', async function () {
      const { result, unmount } = renderSSOContext()
      result.current.unlink('google')
      expect(fetchMock.callHistory.called()).to.be.true
      unmount()
    })
  })
})
