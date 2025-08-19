import DomainCapture from '../../../../../modules/group-settings/frontend/js/components/domain-capture'

describe('<DomainCapture />', function () {
  beforeEach(function () {
    this.email = 'user@example.com'
    this.groupName = 'test-group'
    this.ssoInitPath = '/sso/init/path'

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', {
        email: this.email,
        first_name: 'Nice',
        last_name: 'Wombat',
      })
      win.metaAttributesCache.set('ol-email', this.email)
      win.metaAttributesCache.set('ol-groupName', this.groupName)
      win.metaAttributesCache.set('ol-ssoInitPath', this.ssoInitPath)
    })

    cy.mount(<DomainCapture />)
  })

  it('renders the heading', function () {
    cy.findByRole('heading', {
      name: new RegExp(
        `your organization ${this.groupName} now has an Overleaf enterprise license`,
        'i'
      ),
    })
  })

  it('renders the description', function () {
    cy.findByTestId('domain-capture-signed-in-as')
      .invoke('text')
      .should(
        'match',
        new RegExp(`you are currently signed in as ${this.email}`, 'i')
      )
    cy.findByText(
      new RegExp(
        `because you are using your organization email on Overleaf, ${this.groupName} would like you to take one of the following actions`,
        'i'
      )
    )
  })

  it('renders the join group card', function () {
    cy.findByTestId('domain-capture-join-card').within(() => {
      cy.findByRole('heading', {
        name: new RegExp(`join ${this.groupName} enterprise group`, 'i'),
      })
      cy.findByText(
        /get access to enterprise features and benefits provided by your organization/i
      )
      cy.findByText(/you’ll continue to have access to all of your projects/i)
      cy.findByRole('link', { name: /join/i }).should(
        'have.attr',
        'href',
        this.ssoInitPath
      )
    })
  })

  it('renders the remove company email card', function () {
    cy.findByTestId('domain-capture-remove-email-card').within(() => {
      cy.findByRole('heading', {
        name: /remove your company email from your personal account/i,
      })
      cy.findByText(
        /switch to a personal email to keep your accounts separate/i
      )
      cy.findByText(/you’ll continue to have access to all of your projects/i)
      cy.findByRole('link', { name: /change your email/i }).should(
        'have.attr',
        'href',
        '/user/settings'
      )
    })
  })
})
