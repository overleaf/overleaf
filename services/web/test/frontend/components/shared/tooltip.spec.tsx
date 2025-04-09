import OLTooltip from '@/features/ui/components/ol/ol-tooltip'

describe('<OLTooltip />', function () {
  it('calls the bound handler and blur then hides text on click', function () {
    const clickHandler = cy.stub().as('clickHandler')
    const blurHandler = cy.stub().as('blurHandler')
    const description = 'foo'
    const btnText = 'Click me!'

    cy.mount(
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <OLTooltip id="abc" description={description}>
          <button onClick={clickHandler} onBlur={blurHandler}>
            {btnText}
          </button>
        </OLTooltip>
      </div>
    )

    cy.findByRole('button', { name: btnText }).as('button')
    cy.get('@button').trigger('mouseover')
    cy.findByText(description)
    cy.get('@button').click()
    cy.get('@clickHandler').should('have.been.calledOnce')
    cy.get('@blurHandler').should('have.been.calledOnce')
    cy.findByText(description).should('not.exist')
  })
})
