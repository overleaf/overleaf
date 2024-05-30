import { ensureUserExists, login } from './helpers/login'
import { createProject } from './helpers/project'
import { startWith } from './helpers/config'
import { throttledRecompile } from './helpers/compile'

describe('SandboxedCompiles', function () {
  ensureUserExists({ email: 'user@example.com' })

  const enabledVars = {
    DOCKER_RUNNER: 'true',
    SANDBOXED_COMPILES: 'true',
    SANDBOXED_COMPILES_SIBLING_CONTAINERS: 'true',
    ALL_TEX_LIVE_DOCKER_IMAGE_NAMES: '2023,2022',
  }

  describe('enabled in Server Pro', () => {
    startWith({
      pro: true,
      vars: enabledVars,
    })
    beforeEach(function () {
      login('user@example.com')
    })

    it('should offer TexLive images and switch the compiler', () => {
      cy.visit('/project')
      createProject('sandboxed')
      const recompile = throttledRecompile()
      // check produced PDF
      cy.get('.pdf-viewer').should('contain.text', 'sandboxed')
      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2023\) /)
      cy.get('header').findByText('Menu').click()
      cy.findByText('TeX Live version')
        .parent()
        .findByText('2023')
        .parent()
        .select('2022')

      // close editor menu
      cy.get('#left-menu-modal').click()

      // Trigger compile with other TexLive version
      recompile()

      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2022\) /)
    })
  })

  function checkUsesDefaultCompiler() {
    beforeEach(function () {
      login('user@example.com')
    })

    it('should not offer TexLive images and use default compiler', () => {
      cy.visit('/project')
      createProject('sandboxed')
      // check produced PDF
      cy.get('.pdf-viewer').should('contain.text', 'sandboxed')
      cy.get('[aria-label="View logs"]').click()
      cy.findByText(/This is pdfTeX, Version .+ \(TeX Live 2024\) /)
      cy.get('header').findByText('Menu').click()
      cy.findByText('TeX Live version').should('not.exist')
    })
  }

  describe('disabled in Server Pro', () => {
    startWith({ pro: true })

    checkUsesDefaultCompiler()
  })

  describe.skip('unavailable in CE', () => {
    startWith({ pro: false, vars: enabledVars })

    checkUsesDefaultCompiler()
  })
})
