import MaterialIcon from '@/shared/components/material-icon'
import unfilledIconTypes from '../../../../frontend/fonts/material-symbols/unfilled-symbols.mjs'

const FONT_SIZE = 40

describe('MaterialIcon', function () {
  describe('Filled', function () {
    it('contains symbols', function () {
      cy.mount(<MaterialIcon type="home" style={{ fontSize: FONT_SIZE }} />)
      cy.get('.material-symbols').as('icon')
      cy.get('@icon')
        .invoke('width')
        .should('be.within', FONT_SIZE - 1, FONT_SIZE + 1)
    })
  })

  describe('Unfilled', function () {
    it('Contain all unfilled symbol', function () {
      for (const type of unfilledIconTypes) {
        cy.mount(
          <MaterialIcon type={type} unfilled style={{ fontSize: FONT_SIZE }} />
        )
        cy.get('.material-symbols').as('icon')
        cy.get('@icon')
          .invoke('width')
          .should('be.within', FONT_SIZE - 1, FONT_SIZE + 1)
      }
    })
  })
})
