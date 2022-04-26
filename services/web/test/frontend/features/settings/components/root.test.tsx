import sinon from 'sinon'
import { screen, render, waitFor } from '@testing-library/react'
import * as eventTracking from '../../../../../frontend/js/infrastructure/event-tracking'
import SettingsPageRoot from '../../../../../frontend/js/features/settings/components/root'

describe('<SettingsPageRoot />', function () {
  let sendMBSpy
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-usersEmail', 'foo@bar.com')
    window.metaAttributesCache.set('ol-ExposedSettings', { isOverleaf: true })
    window.metaAttributesCache.set('ol-hasPassword', true)
    window.metaAttributesCache.set('ol-ExposedSettings', {
      hasAffiliationsFeature: false,
    })
    window.metaAttributesCache.set('ol-user', {
      features: { github: true, dropbox: true, mendeley: true, zotero: true },
      refProviders: {
        mendeley: true,
        zotero: true,
      },
    })
    window.metaAttributesCache.set('ol-github', { enabled: true })
    window.metaAttributesCache.set('ol-dropbox', { registered: true })
    window.metaAttributesCache.set('ol-oauthProviders', {})
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sendMBSpy.restore()
  })

  it('displays page', async function () {
    render(<SettingsPageRoot />)

    await waitFor(() => {
      screen.getByText('Account Settings')
    })

    screen.getByRole('button', {
      name: 'Delete your account',
    })
  })

  it('sends tracking event on load', async function () {
    render(<SettingsPageRoot />)

    sinon.assert.calledOnce(sendMBSpy)
    sinon.assert.calledWith(sendMBSpy, 'settings-view')
  })
})
