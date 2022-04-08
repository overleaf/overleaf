import { expect } from 'chai'
import { renderHook } from '@testing-library/react-hooks'
import {
  SSOProvider,
  useSSOContext,
} from '../../../../../frontend/js/features/user-settings/context/sso-context'
import fetchMock from 'fetch-mock'

describe('SSOContext', function () {
  const renderSSOContext = () =>
    renderHook(() => useSSOContext(), {
      wrapper: ({ children }) => <SSOProvider>{children}</SSOProvider>,
    })

  beforeEach(function () {
    window.oauthProviders = {
      google: {
        descriptionKey: 'login_google',
        name: 'Google',
        linkPath: '/auth/google',
      },
      orcid: {
        descriptionKey: 'login_orcid',
        name: 'Google',
        linkPath: '/auth/google',
      },
    }
    window.thirdPartyIds = {
      google: 'googleId',
    }
    fetchMock.reset()
  })

  it('should initialise subscriptions with their linked status', function () {
    const { result } = renderSSOContext()
    expect(result.current.subscriptions).to.deep.equal({
      google: {
        descriptionKey: 'login_google',
        linkPath: '/auth/google',
        linked: true,
        name: 'Google',
      },
      orcid: {
        descriptionKey: 'login_orcid',
        linkPath: '/auth/google',
        linked: false,
        name: 'Google',
      },
    })
  })

  describe('unlink', function () {
    beforeEach(function () {
      fetchMock.post('express:/user/oauth-unlink', 200)
    })

    it('should unlink an existing subscription', async function () {
      const { result, waitForNextUpdate } = renderSSOContext()
      result.current.unlink('google')
      await waitForNextUpdate()
      expect(result.current.subscriptions.google.linked).to.be.false
    })

    it('when the provider is not linked, should do nothing', function () {
      const { result } = renderSSOContext()
      result.current.unlink('orcid')
      expect(fetchMock.called()).to.be.false
    })

    it('supports unmounting the component while the request is inflight', async function () {
      const { result, unmount } = renderSSOContext()
      result.current.unlink('google')
      expect(fetchMock.called()).to.be.true
      unmount()
    })
  })
})
