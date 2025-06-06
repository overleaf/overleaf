import { render, screen } from '@testing-library/react'
import { expect } from 'chai'
import GroupInvite from '../../../../../../frontend/js/features/subscription/components/group-invite/group-invite'

describe('group invite', function () {
  const inviterName = 'example@overleaf.com'
  beforeEach(function () {
    window.metaAttributesCache.set('ol-inviterName', inviterName)
  })

  it('renders header', async function () {
    render(<GroupInvite />)
    await screen.findByText(inviterName)
    screen.getByText(`has invited you to join a group subscription on Overleaf`)
    expect(screen.queryByText('Email link expired, please request a new one.'))
      .to.be.null
  })

  describe('when user has personal subscription', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-hasIndividualPaidSubscription', true)
    })

    it('renders cancel personal subscription view', async function () {
      render(<GroupInvite />)
      await screen.findByText(
        'You already have an individual subscription, would you like us to cancel this first before joining the group licence?'
      )
    })

    describe('and in a managed group', function () {
      // note: this should not be possible but managed user view takes priority over all
      beforeEach(function () {
        window.metaAttributesCache.set(
          'ol-currentManagedUserAdminEmail',
          'example@overleaf.com'
        )
        window.metaAttributesCache.set('ol-cannot-join-subscription', true)
      })

      it('renders managed user cannot join view', async function () {
        render(<GroupInvite />)
        await screen.findByText('You can’t join this group subscription')
        screen.getByText(
          'Your Overleaf account is managed by your current group admin (example@overleaf.com). This means you can’t join additional group subscriptions',
          { exact: false }
        )
        screen.getByRole('link', { name: 'Read more about Managed Users.' })
      })
    })
  })

  describe('when user does not have a personal subscription', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-hasIndividualPaidSubscription', false)
      window.metaAttributesCache.set('ol-inviteToken', 'token123')
    })

    it('does not render cancel personal subscription view', async function () {
      render(<GroupInvite />)
      await screen.findByText(
        'Please click the button below to join the group subscription and enjoy the benefits of an upgraded Overleaf account'
      )
    })
  })

  describe('when the user is already a managed user in another group', function () {
    beforeEach(function () {
      window.metaAttributesCache.set(
        'ol-currentManagedUserAdminEmail',
        'example@overleaf.com'
      )
      window.metaAttributesCache.set('ol-cannot-join-subscription', true)
    })

    it('renders managed user cannot join view', async function () {
      render(<GroupInvite />)
      await screen.findByText(inviterName)
      screen.getByText(
        `has invited you to join a group subscription on Overleaf`
      )
      screen.getByText('You can’t join this group subscription')
      screen.getByText(
        'Your Overleaf account is managed by your current group admin (example@overleaf.com). This means you can’t join additional group subscriptions',
        { exact: false }
      )
      screen.getByRole('link', { name: 'Read more about Managed Users.' })
    })
  })

  describe('expired', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-expired', true)
    })

    it('shows error notification when expired', async function () {
      render(<GroupInvite />)
      await screen.findByText('Email link expired, please request a new one.')
    })
  })

  describe('join view', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-inviteToken', 'token123')
    })

    it('shows view to join group', async function () {
      render(<GroupInvite />)
      await screen.findByText(
        'Please click the button below to join the group subscription and enjoy the benefits of an upgraded Overleaf account'
      )
    })
  })
})
