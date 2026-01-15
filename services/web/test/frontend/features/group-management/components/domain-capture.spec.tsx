import DomainCapture from '../../../../../modules/group-settings/frontend/js/components/domain-capture'

describe('<DomainCapture />', function () {
  beforeEach(function () {
    this.email = 'user@example.com'
    this.groupName = 'test-group'
    this.ssoInitPath = '/sso/init/path'
    this.notificationsInstitution = []

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', {
        email: this.email,
        first_name: 'Nice',
        last_name: 'Wombat',
      })
      win.metaAttributesCache.set('ol-email', this.email)
      win.metaAttributesCache.set('ol-groupName', this.groupName)
      win.metaAttributesCache.set('ol-ssoInitPath', this.ssoInitPath)
      win.metaAttributesCache.set(
        'ol-notificationsInstitution',
        this.notificationsInstitution
      )
      win.metaAttributesCache.set('ol-managedUsersEnabled', false)
    })

    cy.mount(<DomainCapture />)
  })

  it('renders the heading', function () {
    cy.findByRole('heading', {
      name: new RegExp(
        `your account is associated with ${this.groupName}`,
        'i'
      ),
    })
  })

  it('renders the description', function () {
    cy.findByTestId('domain-capture-signed-in-as')
      .invoke('text')
      .should(
        'match',
        new RegExp(
          `you’re signed in using your organization email ${this.email}. ` +
            'this means you need to take one of the following actions',
          'i'
        )
      )
  })

  describe('join group card', function () {
    describe('title', function () {
      it('renders with managed users disabled', function () {
        cy.findByTestId('domain-capture-join-card').within(() => {
          cy.findByRole('heading', {
            name: new RegExp(`join ${this.groupName} enterprise group`, 'i'),
          })
        })
      })

      it('renders with managed users enabled', function () {
        cy.window().then(win => {
          win.metaAttributesCache.set('ol-managedUsersEnabled', true)
        })

        cy.mount(<DomainCapture />)

        cy.findByTestId('domain-capture-join-card').within(() => {
          cy.findByRole('heading', {
            name: new RegExp(
              `join ${this.groupName} managed enterprise group`,
              'i'
            ),
          })
        })
      })
    })

    it('renders the body', function () {
      cy.findByTestId('domain-capture-join-card').within(() => {
        cy.findByText(
          /get access to enterprise features and benefits provided by your organization/i
        )
        cy.findByRole('link', { name: /join group/i }).should(
          'have.attr',
          'href',
          this.ssoInitPath
        )
      })
    })
  })

  it('renders the remove company email card', function () {
    cy.findByTestId('domain-capture-remove-email-card').within(() => {
      cy.findByRole('heading', {
        name: /remove your organization email address from this account/i,
      })
      cy.findByText(
        /if this is a personal .* account, you should change your email address to keep ownership of your personal projects/i
      )
      cy.findByRole('link', { name: /change email address/i }).should(
        'have.attr',
        'href',
        '/user/settings'
      )
    })
  })

  describe('notifications', function () {
    it('renders missing email on account error message', function () {
      const institutionEmail = 'email@example.com'
      const notificationsInstitution = [
        {
          templateKey: 'notification_email_not_in_account',
          institutionEmail,
        },
      ]
      cy.window().then(win => {
        win.metaAttributesCache.set(
          'ol-notificationsInstitution',
          notificationsInstitution
        )
      })
      cy.mount(<DomainCapture />)

      cy.findByRole('alert').should(
        'contain.text',
        `Your organization’s identity provider returned ${institutionEmail}. ` +
          `You will need to use this address to create an account via SSO. You can ` +
          `transfer your existing projects to the new account.`
      )
      cy.findByRole('link', {
        name: /transfer your existing projects/i,
      }).should(
        'have.attr',
        'href',
        '/learn/how-to/How_to_Transfer_Project_Ownership'
      )
    })

    it('renders group limit reached error message', function () {
      const notificationsInstitution = [
        { templateKey: 'notification_group_member_limit_reached' },
      ]
      cy.window().then(win => {
        win.metaAttributesCache.set(
          'ol-notificationsInstitution',
          notificationsInstitution
        )
      })
      cy.mount(<DomainCapture />)

      cy.findByRole('alert').should(
        'contain.text',
        'Sorry, your group has no licenses available. ' +
          'Please contact your administrator to request a license.'
      )
    })

    it('renders institution error message', function () {
      const errorMsg = 'Error message'
      const notificationsInstitution = [
        {
          templateKey: 'notification_institution_sso_error',
          error: {
            message: errorMsg,
          },
        },
      ]
      cy.window().then(win => {
        win.metaAttributesCache.set(
          'ol-notificationsInstitution',
          notificationsInstitution
        )
      })
      cy.mount(<DomainCapture />)

      cy.findByRole('alert').should('contain.text', errorMsg)
    })
  })
})
