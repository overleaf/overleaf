import '../../helpers/bootstrap-3'
import StartFreeTrialButton from '../../../../frontend/js/shared/components/start-free-trial-button'
import getMeta from '@/utils/meta'

describe('start free trial button', function () {
  beforeEach(function () {
    cy.intercept('POST', '/event/paywall-prompt', {
      statusCode: 204,
    }).as('event-paywall-prompt')
    cy.intercept('POST', '/event/paywall-click', {
      statusCode: 204,
    }).as('event-paywall-click')

    getMeta('ol-ExposedSettings').isOverleaf = true
  })

  it('renders the button with default text', function () {
    cy.mount(<StartFreeTrialButton source="cypress-test" />)

    cy.wait('@event-paywall-prompt')
      .its('request.body.paywall-type')
      .should('eq', 'cypress-test')

    cy.get('button').contains('Start Free Trial!')
  })

  it('renders the button with custom text', function () {
    cy.mount(
      <StartFreeTrialButton source="cypress-test">
        Some Custom Text
      </StartFreeTrialButton>
    )

    cy.wait('@event-paywall-prompt')
      .its('request.body.paywall-type')
      .should('eq', 'cypress-test')

    cy.get('button').contains('Some Custom Text')
  })

  it('renders the button with styled button', function () {
    cy.mount(
      <StartFreeTrialButton
        source="cypress-test"
        buttonProps={{
          variant: 'danger',
          size: 'lg',
        }}
      />
    )

    cy.wait('@event-paywall-prompt')

    cy.get('button.btn.btn-danger.btn-lg').contains('Start Free Trial!')
  })

  it('renders the button with custom class', function () {
    cy.mount(
      <StartFreeTrialButton
        source="cypress-test"
        buttonProps={{ className: 'ct-test-class' }}
      />
    )

    cy.wait('@event-paywall-prompt')
      .its('request.body.paywall-type')
      .should('eq', 'cypress-test')

    cy.get('.ct-test-class').contains('Start Free Trial!')
  })

  it('calls onClick callback and opens a new tab to the subscription page on click', function () {
    const onClickStub = cy.stub()
    cy.mount(
      <StartFreeTrialButton source="cypress-test" handleClick={onClickStub} />
    )

    cy.wait('@event-paywall-prompt')

    cy.window().then(win => {
      cy.stub(win, 'open').as('Open')
    })
    cy.get('button.btn').contains('Start Free Trial!').click()

    cy.wrap(null).then(() => {
      cy.wait('@event-paywall-click')
        .its('request.body.paywall-type')
        .should('eq', 'cypress-test')
      cy.get('@Open').should(
        'have.been.calledOnceWithExactly',
        '/user/subscription/choose-your-plan?itm_campaign=cypress-test'
      )
      expect(onClickStub).to.be.called
    })
  })
})
