import '../../../helpers/bootstrap-5'
import RequestStatus from '@/features/group-management/components/request-status'

describe('<RequestStatus />', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-groupName', 'My Awesome Team')
    })
    cy.mount(
      <RequestStatus icon="email" title="Test title" content="Test content" />
    )
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

  it('shows the title', function () {
    cy.findByTestId('title').should('contain.text', 'Test title')
  })

  it('shows the content', function () {
    cy.findByText('Test content')
  })

  it('renders the link to subscriptions', function () {
    cy.findByRole('button', { name: /go to subscriptions/i }).should(
      'have.attr',
      'href',
      '/user/subscription'
    )
  })
})
