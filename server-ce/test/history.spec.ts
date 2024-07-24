import { createProject } from './helpers/project'
import { throttledRecompile } from './helpers/compile'
import { ensureUserExists, login } from './helpers/login'
import { isExcludedBySharding, startWith } from './helpers/config'

describe('History', function () {
  if (isExcludedBySharding('CE_DEFAULT')) return
  startWith({})
  ensureUserExists({ email: 'user@example.com' })
  beforeEach(function () {
    login('user@example.com')
  })

  function addLabel(name: string) {
    cy.log(`add label ${JSON.stringify(name)}`)
    cy.findByText('Labels').click()
    cy.findAllByTestId('history-version-details')
      .first()
      .within(() => {
        cy.get('button').click() // TODO: add test-id or aria-label
        cy.findByText('Label this version').click()
      })
    cy.findByRole('dialog').within(() => {
      cy.get('input[placeholder="New label name"]').type(`${name}{enter}`)
    })
  }

  function downloadVersion(name: string) {
    cy.log(`download version ${JSON.stringify(name)}`)
    cy.findByText('Labels').click()
    cy.findByText(name)
      .closest('[data-testid="history-version-details"]')
      .within(() => {
        cy.get('.history-version-dropdown-menu-btn').click()
        cy.findByText('Download this version').click()
      })
  }

  const CLASS_ADDITION = 'ol-cm-addition-marker'
  const CLASS_DELETION = 'ol-cm-deletion-marker'

  it('should support labels, comparison and download', () => {
    cy.visit('/project')
    createProject('labels')
    const recompile = throttledRecompile()

    cy.log('add content, including a line that will get removed soon')
    cy.findByText('\\maketitle').parent().click()
    cy.findByText('\\maketitle').parent().type('\n% added')
    cy.findByText('\\maketitle').parent().type('\n% to be removed')
    recompile()
    cy.findByText('History').click()

    cy.log('expect to see additions in history')
    cy.get('.document-diff-container').within(() => {
      cy.findByText('% to be removed').should('have.class', CLASS_ADDITION)
      cy.findByText('% added').should('have.class', CLASS_ADDITION)
    })

    addLabel('Before removal')

    cy.log('remove content')
    cy.findByText('Back to editor').click()
    cy.findByText('% to be removed').parent().type('{end}{shift}{upArrow}{del}')
    recompile()
    cy.findByText('History').click()

    cy.log('expect to see annotation for newly removed content in history')
    cy.get('.document-diff-container').within(() => {
      cy.findByText('% to be removed').should('have.class', CLASS_DELETION)
      cy.findByText('% added').should('not.have.class', CLASS_ADDITION)
    })

    addLabel('After removal')

    cy.log('add more content after labeling')
    cy.findByText('Back to editor').click()
    cy.findByText('\\maketitle').parent().click()
    cy.findByText('\\maketitle').parent().type('\n% more')
    recompile()

    cy.log('compare non current versions')
    cy.findByText('History').click()
    cy.findByText('Labels').click()
    cy.findAllByTestId('compare-icon-version').last().click()
    cy.findAllByTestId('compare-icon-version').filter(':visible').click()
    cy.findByText('Compare up to this version').click()

    cy.log(
      'expect to see annotation for removed content between the two versions'
    )
    cy.get('.document-diff-container').within(() => {
      cy.findByText('% to be removed').should('have.class', CLASS_DELETION)
      cy.findByText('% added').should('not.have.class', CLASS_ADDITION)
      cy.findByText('% more').should('not.exist')
    })

    downloadVersion('Before removal')
    cy.task('readFileInZip', {
      pathToZip: `cypress/downloads/labels (Version 2).zip`,
      fileToRead: 'main.tex',
    })
      .should('contain', '% added')
      .should('contain', '% to be removed')
      .should('not.contain', '% more')

    downloadVersion('After removal')
    cy.task('readFileInZip', {
      pathToZip: `cypress/downloads/labels (Version 3).zip`,
      fileToRead: 'main.tex',
    })
      .should('contain', '% added')
      .should('not.contain', '% to be removed')
      .should('not.contain', '% more')

    downloadVersion('Current state')
    cy.task('readFileInZip', {
      pathToZip: `cypress/downloads/labels (Version 4).zip`,
      fileToRead: 'main.tex',
    })
      .should('contain', '% added')
      .should('not.contain', '% to be removed')
      .should('contain', '% more')
  })
})
