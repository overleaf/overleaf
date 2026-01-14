import { createProjectAndOpenInNewEditor } from './helpers/project'
import { prepareWaitForNextCompileSlot } from './helpers/compile'
import { ensureUserExists, login } from './helpers/login'
import { isExcludedBySharding, startWith } from './helpers/config'

describe('new editor.History', function () {
  if (isExcludedBySharding('CE_DEFAULT')) return
  startWith({})
  ensureUserExists({ email: 'user@example.com' })
  beforeEach(function () {
    login('user@example.com')
  })

  function addLabel(name: string) {
    cy.log(`add label ${JSON.stringify(name)}`)
    // The input is not clickable due to being visually hidden, click its label instead
    cy.findByRole('complementary', {
      name: 'Project history and labels',
    }).within(() => {
      cy.findByRole('group', {
        name: 'Show all of the project history or only labelled versions.',
      }).within(() => {
        cy.findByText('Labels').click()
      })
      cy.findByRole('radio', { name: 'Labels' }).should('be.checked')
      cy.findByRole('radio', { name: 'All history' }).should('not.be.checked')
      cy.findAllByTestId('history-version-details')
        .first()
        .within(() => {
          cy.findByRole('button', { name: 'More actions' }).click()
          cy.findByRole('menuitem', { name: 'Label this version' }).click()
        })
    })
    cy.findByRole('dialog').within(() => {
      cy.findByLabelText('New label name').type(`${name}{enter}`)
    })
  }

  function downloadVersion(name: string) {
    cy.log(`download version ${JSON.stringify(name)}`)
    // The input is not clickable due to being visually hidden, click its label instead
    cy.findByRole('complementary', {
      name: 'Project history and labels',
    }).within(() => {
      cy.findByRole('group', {
        name: 'Show all of the project history or only labelled versions.',
      }).within(() => {
        cy.findByText('Labels').click()
      })
      cy.findByRole('radio', { name: 'Labels' }).should('be.checked')
      cy.findByRole('radio', { name: 'All history' }).should('not.be.checked')
      cy.findByText(name)
        .closest('[data-testid="history-version-details"]')
        .within(() => {
          cy.findByRole('button', { name: 'More actions' }).click()
          cy.findByRole('menuitem', { name: 'Download this version' }).click()
        })
    })
  }

  const CLASS_ADDITION = 'ol-cm-addition-marker'
  const CLASS_DELETION = 'ol-cm-deletion-marker'

  it('should support labels, comparison and download', function () {
    const { recompile, waitForCompile } = prepareWaitForNextCompileSlot()
    waitForCompile(() => {
      createProjectAndOpenInNewEditor('labels')
    })

    cy.log('add content, including a line that will get removed soon')
    cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() => {
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle').parent().type('\n% added')
      cy.findByText('\\maketitle').parent().type('\n% to be removed')
    })
    recompile()
    cy.findByRole('button', { name: 'History' }).click()

    cy.log('expect to see additions in history')
    cy.get('.document-diff-container').within(() => {
      cy.findByText('% to be removed').should('have.class', CLASS_ADDITION)
      cy.findByText('% added').should('have.class', CLASS_ADDITION)
    })

    addLabel('Before removal')

    cy.log('remove content')
    cy.findByRole('button', { name: 'Back to editor' }).click()
    cy.findByText('% to be removed').parent().type('{end}{shift}{upArrow}{del}')
    recompile()
    cy.findByRole('button', { name: 'History' }).click()

    cy.log('expect to see annotation for newly removed content in history')
    cy.get('.document-diff-container').within(() => {
      cy.findByText('% to be removed').should('have.class', CLASS_DELETION)
      cy.findByText('% added').should('not.have.class', CLASS_ADDITION)
    })

    addLabel('After removal')

    cy.log('add more content after labeling')
    cy.findByRole('button', { name: 'Back to editor' }).click()
    cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() => {
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle').parent().type('\n% more')
    })
    recompile()

    cy.log('compare non current versions')
    cy.findByRole('button', { name: 'History' }).click()
    // The input is not clickable due to being visually hidden, click its label instead
    cy.findByRole('complementary', {
      name: 'Project history and labels',
    }).within(() => {
      cy.findByRole('group', {
        name: 'Show all of the project history or only labelled versions.',
      }).within(() => {
        cy.findByText('Labels').click()
      })
      cy.findByRole('radio', { name: 'Labels' }).should('be.checked')
      cy.findByRole('radio', { name: 'All history' }).should('not.be.checked')
      cy.findAllByTestId('compare-icon-version').last().click()
      cy.findAllByTestId('compare-icon-version').filter(':visible').click()
      cy.findByRole('menuitem', {
        name: 'Compare up to this version',
      }).click()
    })
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
