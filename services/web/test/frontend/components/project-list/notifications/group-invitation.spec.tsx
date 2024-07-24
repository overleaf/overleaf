import '../../../helpers/bootstrap-3'
import GroupInvitationNotification from '@/features/project-list/components/notifications/groups/group-invitation/group-invitation'
import { NotificationGroupInvitation } from '../../../../../types/project/dashboard/notification'

type Props = {
  notification: NotificationGroupInvitation
}

function GroupInvitation({ notification }: Props) {
  return (
    <div className="user-notifications">
      <ul className="list-unstyled">
        <GroupInvitationNotification notification={notification} />
      </ul>
    </div>
  )
}

describe('<GroupInvitationNotification />', function () {
  const notification: NotificationGroupInvitation = {
    _id: 1,
    templateKey: 'notification_group_invitation',
    messageOpts: {
      inviterName: 'inviter@overleaf.com',
      token: '123abc',
      managedUsersEnabled: false,
    },
  }

  beforeEach(function () {
    cy.intercept(
      'PUT',
      `/subscription/invites/${notification.messageOpts.token}`,
      {
        statusCode: 204,
      }
    ).as('acceptInvite')
  })

  describe('user without existing personal subscription', function () {
    it('is able to join group successfully', function () {
      cy.mount(<GroupInvitation notification={notification} />)

      cy.findByRole('alert')

      cy.contains(
        'inviter@overleaf.com has invited you to join a group subscription on Overleaf'
      )

      cy.findByRole('button', { name: 'Join now' }).click()

      cy.wait('@acceptInvite')

      cy.findByText(
        'Congratulations! You‘ve successfully joined the group subscription.'
      )

      cy.findByRole('button', { name: /close/i }).click()

      cy.findByRole('alert').should('not.exist')
    })
  })

  describe('user with existing personal subscription', function () {
    beforeEach(function () {
      window.metaAttributesCache.set(
        'ol-hasIndividualRecurlySubscription',
        true
      )
    })

    it('is able to join group successfully without cancelling personal subscription', function () {
      cy.mount(<GroupInvitation notification={notification} />)

      cy.findByRole('alert')

      cy.contains(
        'inviter@overleaf.com has invited you to join a group Overleaf subscription. If you join this group, you may not need your individual subscription. Would you like to cancel it?'
      )

      cy.findByRole('button', { name: 'Not now' }).click()

      cy.contains(
        'inviter@overleaf.com has invited you to join a group subscription on Overleaf'
      )

      cy.findByRole('button', { name: 'Join now' }).click()

      cy.wait('@acceptInvite')

      cy.findByText(
        'Congratulations! You‘ve successfully joined the group subscription.'
      )

      cy.findByRole('button', { name: /close/i }).click()

      cy.findByRole('alert').should('not.exist')
    })

    it('is able to join group successfully after cancelling personal subscription', function () {
      cy.intercept('POST', '/user/subscription/cancel', {
        statusCode: 204,
      }).as('cancelPersonalSubscription')

      cy.mount(<GroupInvitation notification={notification} />)

      cy.findByRole('alert')

      cy.contains(
        'inviter@overleaf.com has invited you to join a group Overleaf subscription. If you join this group, you may not need your individual subscription. Would you like to cancel it?'
      )

      cy.findByRole('button', { name: 'Cancel my subscription' }).click()

      cy.wait('@cancelPersonalSubscription')

      cy.contains(
        'inviter@overleaf.com has invited you to join a group subscription on Overleaf'
      )

      cy.findByRole('button', { name: 'Join now' }).click()

      cy.wait('@acceptInvite')

      cy.findByText(
        'Congratulations! You‘ve successfully joined the group subscription.'
      )

      cy.findByRole('button', { name: /close/i }).click()

      cy.findByRole('alert').should('not.exist')
    })
  })
})
