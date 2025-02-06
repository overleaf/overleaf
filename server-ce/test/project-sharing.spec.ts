import { v4 as uuid } from 'uuid'
import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import {
  createProject,
  enableLinkSharing,
  shareProjectByEmailAndAcceptInviteViaDash,
  shareProjectByEmailAndAcceptInviteViaEmail,
} from './helpers/project'
import { throttledRecompile } from './helpers/compile'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'

describe('Project Sharing', function () {
  if (isExcludedBySharding('CE_CUSTOM_2')) return
  ensureUserExists({ email: 'user@example.com' })
  startWith({ withDataDir: true })

  let projectName: string
  beforeWithReRunOnTestRetry(function () {
    projectName = `Project ${uuid()}`
    setupTestProject()
  })

  beforeEach(() => {
    // Always start with a fresh session
    cy.session([uuid()], () => {})
  })

  let linkSharingReadOnly: string
  let linkSharingReadAndWrite: string

  function setupTestProject() {
    login('user@example.com')
    cy.visit('/project')
    createProject(projectName)

    // Add chat message
    cy.findByText('Chat').click()
    // wait for lazy loading of the chat pane
    cy.findByText('Send your first message to your collaborators')
    cy.get(
      'textarea[placeholder="Send a message to your collaborators…"]'
    ).type('New Chat Message{enter}')

    // Get link sharing links
    enableLinkSharing().then(
      ({ linkSharingReadOnly: ro, linkSharingReadAndWrite: rw }) => {
        linkSharingReadAndWrite = rw
        linkSharingReadOnly = ro
      }
    )
  }

  function expectContentReadOnlyAccess() {
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    cy.get('.cm-content').should('contain.text', '\\maketitle')
    cy.get('.cm-content').should('have.attr', 'contenteditable', 'false')
  }

  function expectContentWriteAccess() {
    const section = `Test Section ${uuid()}`
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    const recompile = throttledRecompile()
    // wait for the editor to finish loading
    cy.get('.cm-content').should('contain.text', '\\maketitle')
    // the editor should be writable
    cy.get('.cm-content').should('have.attr', 'contenteditable', 'true')
    cy.findByText('\\maketitle').parent().click()
    cy.findByText('\\maketitle').parent().type(`\n\\section{{}${section}}`)
    // should have written
    cy.get('.cm-content').should('contain.text', `\\section{${section}}`)
    // check PDF
    recompile()
    cy.get('.pdf-viewer').should('contain.text', projectName)
    cy.get('.pdf-viewer').should('contain.text', section)
  }

  function expectNoAccess() {
    // try read only access link
    cy.visit(linkSharingReadOnly)
    cy.url().should('match', /\/login/)

    // Cypress bugs: cypress resolves the link-sharing link outside the browser, and it carries over the hash of the link-sharing link to the login page redirect (bug 1).
    // Effectively, cypress then instructs the browser to change the page from /login#read-only-hash to /login#read-and-write-hash.
    // This is turn does not trigger a "page load", but rather just "scrolling", which in turn trips up the "page loaded" detection in cypress (bug 2).
    // Work around this by navigating away from the /login page in between checks.
    cy.visit('/user/password/reset')

    // try read and write access link
    cy.visit(linkSharingReadAndWrite)
    cy.url().should('match', /\/login/)
  }

  function expectChatAccess() {
    cy.findByText('Chat').click()
    cy.findByText('New Chat Message')
  }

  function expectHistoryAccess() {
    cy.findByText('History').click()
    cy.findByText('Labels')
    cy.findByText(/\\begin\{document}/)
    cy.findAllByTestId('history-version-metadata-users')
      .last()
      .should('have.text', 'user')
    cy.findByText('Back to editor').click()
  }

  function expectNoChatAccess() {
    cy.findByText('Layout') // wait for lazy loading
    cy.findByText('Chat').should('not.exist')
  }

  function expectNoHistoryAccess() {
    cy.findByText('Layout') // wait for lazy loading
    cy.findByText('History').should('not.exist')
  }

  function expectFullReadOnlyAccess() {
    expectContentReadOnlyAccess()
    expectChatAccess()
    expectHistoryAccess()
  }

  function expectRestrictedReadOnlyAccess() {
    expectContentReadOnlyAccess()
    expectNoChatAccess()
    expectNoHistoryAccess()
  }

  function expectReadAndWriteAccess() {
    expectContentWriteAccess()
    expectChatAccess()
    expectHistoryAccess()
  }

  function expectProjectDashboardEntry() {
    cy.visit('/project')
    cy.findByText(projectName)
  }

  function expectEditAuthoredAs(author: string) {
    cy.findByText('History').click()
    cy.findAllByTestId('history-version-metadata-users')
      .first()
      .should('contain.text', author) // might have other edits in the same group
  }

  describe('via email', function () {
    const email = 'collaborator-email@example.com'
    ensureUserExists({ email })

    beforeEach(function () {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaEmail(projectName, email, 'Can view')
    })

    it('should grant the collaborator read access', () => {
      cy.visit('/project')
      cy.findByText(projectName).click()
      expectFullReadOnlyAccess()
      expectProjectDashboardEntry()
    })
  })

  describe('read only', () => {
    const email = 'collaborator-ro@example.com'
    ensureUserExists({ email })

    beforeWithReRunOnTestRetry(function () {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaDash(projectName, email, 'Can view')
    })

    it('should grant the collaborator read access', () => {
      login(email)
      cy.visit('/project')
      cy.findByText(projectName).click()
      expectFullReadOnlyAccess()
      expectProjectDashboardEntry()
    })
  })

  describe('read and write', () => {
    const email = 'collaborator-rw@example.com'
    ensureUserExists({ email })

    beforeWithReRunOnTestRetry(function () {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaDash(projectName, email, 'Can edit')
    })

    it('should grant the collaborator write access', () => {
      login(email)
      cy.visit('/project')
      cy.findByText(projectName).click()
      expectReadAndWriteAccess()
      expectEditAuthoredAs('You')
      expectProjectDashboardEntry()
    })
  })

  describe('token access', () => {
    describe('logged in', () => {
      describe('read only', () => {
        const email = 'collaborator-link-ro@example.com'
        ensureUserExists({ email })

        it('should grant restricted read access', () => {
          login(email)
          cy.visit(linkSharingReadOnly)
          cy.findByText(projectName) // wait for lazy loading
          cy.findByText('OK, join project').click()
          expectRestrictedReadOnlyAccess()
          expectProjectDashboardEntry()
        })
      })

      describe('read and write', () => {
        const email = 'collaborator-link-rw@example.com'
        ensureUserExists({ email })

        it('should grant full write access', () => {
          login(email)
          cy.visit(linkSharingReadAndWrite)
          cy.findByText(projectName) // wait for lazy loading
          cy.findByText('OK, join project').click()
          expectReadAndWriteAccess()
          expectEditAuthoredAs('You')
          expectProjectDashboardEntry()
        })
      })
    })

    describe('with OVERLEAF_ALLOW_PUBLIC_ACCESS=false', () => {
      describe('wrap startup', () => {
        startWith({
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'false',
          },
          withDataDir: true,
        })
        it('should block access', () => {
          expectNoAccess()
        })
      })

      describe('with OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING=true', () => {
        startWith({
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'false',
            OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING: 'true',
          },
          withDataDir: true,
        })
        it('should block access', () => {
          expectNoAccess()
        })
      })
    })

    describe('with OVERLEAF_ALLOW_PUBLIC_ACCESS=true', () => {
      describe('wrap startup', () => {
        startWith({
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'true',
          },
          withDataDir: true,
        })
        it('should grant read access with read link', () => {
          cy.visit(linkSharingReadOnly)
          expectRestrictedReadOnlyAccess()
        })

        it('should prompt for login with write link', () => {
          cy.visit(linkSharingReadAndWrite)
          cy.url().should('match', /\/login/)
        })
      })

      describe('with OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING=true', () => {
        startWith({
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'true',
            OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING: 'true',
          },
          withDataDir: true,
        })

        it('should grant read access with read link', () => {
          cy.visit(linkSharingReadOnly)
          expectRestrictedReadOnlyAccess()
        })

        it('should grant write access with write link', () => {
          cy.visit(linkSharingReadAndWrite)
          expectReadAndWriteAccess()
          expectEditAuthoredAs('Anonymous')
        })
      })
    })
  })
})
