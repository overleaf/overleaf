import { render, screen } from '@testing-library/react'
import AcceptedInvite from '../../../../../../frontend/js/features/subscription/components/group-invite/accepted-invite'
import { expect } from 'chai'

describe('accepted group invite', function () {
  it('renders', async function () {
    window.metaAttributesCache.set('ol-inviterName', 'example@overleaf.com')
    render(<AcceptedInvite />)
    await screen.findByText(
      'You have joined the group subscription managed by example@overleaf.com'
    )
  })

  it('links to SSO enrollment page for SSO groups', async function () {
    window.metaAttributesCache.set('ol-inviterName', 'example@overleaf.com')
    window.metaAttributesCache.set('ol-groupSSOActive', true)
    window.metaAttributesCache.set('ol-subscriptionId', 'group123')
    render(<AcceptedInvite />)
    const linkBtn = (await screen.findByRole('link', {
      name: 'Done',
    })) as HTMLLinkElement
    expect(linkBtn.href).to.equal(
      'https://www.test-overleaf.com/subscription/group123/sso_enrollment'
    )
  })

  it('links to dash for non-SSO groups', async function () {
    window.metaAttributesCache.set('ol-inviterName', 'example@overleaf.com')
    render(<AcceptedInvite />)
    const linkBtn = (await screen.findByRole('link', {
      name: 'Done',
    })) as HTMLLinkElement
    expect(linkBtn.href).to.equal('https://www.test-overleaf.com/project')
  })
})
