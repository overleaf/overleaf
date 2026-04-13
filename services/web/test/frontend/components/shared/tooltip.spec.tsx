import { useState } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'

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

  it('hides the tooltip when Escape key is pressed', function () {
    const description = 'Press Escape to close'
    const btnText = 'Hover me!'

    cy.mount(
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <OLTooltip id="esc" description={description}>
          <button>{btnText}</button>
        </OLTooltip>
      </div>
    )

    cy.findByRole('button', { name: btnText }).as('button')
    cy.get('@button').trigger('mouseover')
    cy.findByText(description)
    cy.get('@button').trigger('mouseout')
    cy.get('@button').focus()
    cy.findByText(description)
    cy.get('body').type('{esc}')
    cy.findByText(description).should('not.exist')
  })

  it('does not re-show the tooltip when the hidden prop transitions from true to false', function () {
    const description = 'tooltip content'

    function Wrapper() {
      const [hidden, setHidden] = useState(false)
      return (
        <OLTooltip id="abc" description={description} hidden={hidden}>
          <button onClick={() => setHidden(h => !h)}>button</button>
        </OLTooltip>
      )
    }

    cy.mount(
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <Wrapper />
      </div>
    )

    cy.findByRole('button', { name: 'button' }).as('tooltip-btn')
    cy.get('@tooltip-btn').trigger('mouseover')
    cy.findByText(description)
    cy.get('@tooltip-btn').click()
    cy.findByText(description).should('not.exist')
    cy.get('@tooltip-btn').trigger('mouseout')
    cy.get('@tooltip-btn').click()
    cy.findByText(description).should('not.exist')
    cy.get('@tooltip-btn').trigger('mouseover')
    cy.findByText(description)
  })
})
