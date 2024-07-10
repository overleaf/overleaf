import { isExcludedBySharding, startWith } from './helpers/config'

describe('Customization', () => {
  if (isExcludedBySharding('CE_CUSTOM_1')) return
  startWith({
    vars: {
      OVERLEAF_APP_NAME: 'CUSTOM APP NAME',
      OVERLEAF_LEFT_FOOTER: JSON.stringify([{ text: 'CUSTOM LEFT FOOTER' }]),
      OVERLEAF_RIGHT_FOOTER: JSON.stringify([{ text: 'CUSTOM RIGHT FOOTER' }]),
    },
  })

  it('should display custom name', () => {
    cy.visit('/')
    cy.get('nav').findByText('CUSTOM APP NAME')
  })

  it('should display custom left footer', () => {
    cy.visit('/')
    cy.get('footer').findByText('CUSTOM LEFT FOOTER')
  })
  it('should display custom right footer', () => {
    cy.visit('/')
    cy.get('footer').findByText('CUSTOM RIGHT FOOTER')
  })
})
