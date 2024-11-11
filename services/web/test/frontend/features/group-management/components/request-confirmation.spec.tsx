import '../../../helpers/bootstrap-5'
import RequestConfirmation from '@/features/group-management/components/request-confirmation'

describe('request confirmation page', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
    })
    cy.mount(<RequestConfirmation />)
  })

  it('renders the back button', function () {
    cy.findByTestId('group-heading').within(() => {
      cy.findByRole('button', { name: /back to subscription/i }).should(
        'have.attr',
        'href',
        '/user/subscription'
      )
    })
  })

  it('shows the group name', function () {
    cy.findByTestId('group-heading').within(() => {
      cy.findByRole('heading', { name: 'My Awesome Team' })
    })
  })

  it('indicates the message was received', function () {
    cy.findByRole('heading', { name: /we’ve got your request/i })
    cy.findByText(/our team will get back to you shortly/i)
  })

  it('renders the link to subscriptions', function () {
    cy.findByRole('button', { name: /go to subscriptions/i }).should(
      'have.attr',
      'href',
      '/user/subscription'
    )
  })
})
