import { v4 as uuid } from 'uuid'
import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import {
  createProject,
  enableLinkSharing,
  getSpamSafeProjectName,
  openProjectByName,
  openProjectViaLinkSharingAsAnon,
  openProjectViaLinkSharingAsUser,
  shareProjectByEmailAndAcceptInviteViaDash,
  shareProjectByEmailAndAcceptInviteViaEmail,
} from './helpers/project'
import { throttledRecompile } from './helpers/compile'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'

describe('Project Sharing', function () {
  if (isExcludedBySharding('PRO_CUSTOM_4')) return
  ensureUserExists({ email: 'user@example.com' })
  startWith({ withDataDir: true, pro: true })

  let projectName: string
  beforeWithReRunOnTestRetry(function () {
    projectName = getSpamSafeProjectName()
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
    cy.findByRole('textbox', { name: /Source Editor editing/i }).should(
      'contain.text',
      '\\maketitle'
    )
    cy.findByRole('textbox', { name: /Source Editor editing/i }).should(
      'have.attr',
      'contenteditable',
      'false'
    )
  }

  function expectContentWriteAccess() {
    const section = `Test Section ${uuid()}`
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    const recompile = throttledRecompile()
    // wait for the editor to finish loading
    cy.findByRole('textbox', { name: /Source Editor editing/i }).should(
      'contain.text',
      '\\maketitle'
    )
    // the editor should be writable
    cy.findByRole('textbox', { name: /Source Editor editing/i }).should(
      'have.attr',
      'contenteditable',
      'true'
    )
    cy.findByText('\\maketitle').parent().click()
    cy.findByText('\\maketitle').parent().type(`\n\\section{{}${section}}`)
    // should have written
    cy.findByRole('textbox', { name: /Source Editor editing/i }).should(
      'contain.text',
      `\\section{${section}}`
    )
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

  function expectCommentAccess() {
    cy.findByRole('textbox', { name: /Source Editor editing/i }).should(
      'contain.text',
      '\\maketitle'
    )

    cy.findByText('\\maketitle').parent().dblclick()

    cy.findByRole('button', { name: 'Add comment' }).should('be.visible')

    cy.findByRole('textbox', { name: /Source Editor editing/i }).click()
  }

  function expectNoCommentAccess() {
    cy.findByRole('textbox', { name: /Source Editor editing/i }).should(
      'contain.text',
      '\\maketitle'
    )

    cy.findByText('\\maketitle').parent().dblclick()

    cy.findByRole('button', { name: 'Add comment' }).should('not.exist')
    cy.findByRole('textbox', { name: /Source Editor editing/i }).click()
  }

  function expectFullReadOnlyAccess() {
    expectContentReadOnlyAccess()
    expectChatAccess()
    expectHistoryAccess()
    expectNoCommentAccess()
  }

  function expectRestrictedReadOnlyAccess() {
    expectContentReadOnlyAccess()
    expectNoChatAccess()
    expectNoHistoryAccess()
    expectNoCommentAccess()
  }

  function expectFullReadAndWriteAccess() {
    expectContentWriteAccess()
    expectChatAccess()
    expectHistoryAccess()
    expectCommentAccess()
  }

  function expectAnonymousReadAndWriteAccess() {
    expectContentWriteAccess()
    expectChatAccess()
    expectHistoryAccess()
    expectNoCommentAccess()
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
      shareProjectByEmailAndAcceptInviteViaEmail(projectName, email, 'Viewer')
    })

    it('should grant the collaborator read access', () => {
      expectFullReadOnlyAccess()
      expectProjectDashboardEntry()
    })
  })

  describe('read only', () => {
    const email = 'collaborator-ro@example.com'
    ensureUserExists({ email })

    beforeWithReRunOnTestRetry(function () {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaDash(projectName, email, 'Viewer')
    })

    it('should grant the collaborator read access', () => {
      login(email)
      openProjectByName(projectName)
      expectFullReadOnlyAccess()
      expectProjectDashboardEntry()
    })
  })

  describe('read and write', () => {
    const email = 'collaborator-rw@example.com'
    ensureUserExists({ email })

    beforeWithReRunOnTestRetry(function () {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaDash(projectName, email, 'Editor')
    })

    it('should grant the collaborator write access', () => {
      login(email)
      openProjectByName(projectName)
      expectFullReadAndWriteAccess()
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
          openProjectViaLinkSharingAsUser(
            linkSharingReadOnly,
            projectName,
            email
          )
          expectRestrictedReadOnlyAccess()
          expectProjectDashboardEntry()
        })
      })

      describe('read and write', () => {
        const email = 'collaborator-link-rw@example.com'
        ensureUserExists({ email })

        it('should grant full write access', () => {
          login(email)
          openProjectViaLinkSharingAsUser(
            linkSharingReadAndWrite,
            projectName,
            email
          )
          expectFullReadAndWriteAccess()
          expectEditAuthoredAs('You')
          expectProjectDashboardEntry()
        })
      })
    })

    describe('with OVERLEAF_ALLOW_PUBLIC_ACCESS=false', () => {
      describe('wrap startup', () => {
        startWith({
          pro: true,
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
          pro: true,
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
          pro: true,
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'true',
          },
          withDataDir: true,
        })
        it('should grant read access with read link', () => {
          openProjectViaLinkSharingAsAnon(linkSharingReadOnly)
          expectRestrictedReadOnlyAccess()
        })

        it('should prompt for login with write link', () => {
          cy.visit(linkSharingReadAndWrite)
          cy.url().should('match', /\/login/)
        })
      })

      describe('with OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING=true', () => {
        startWith({
          pro: true,
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'true',
            OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING: 'true',
          },
          withDataDir: true,
        })

        it('should grant read access with read link', () => {
          openProjectViaLinkSharingAsAnon(linkSharingReadOnly)
          expectRestrictedReadOnlyAccess()
        })

        it('should grant write access with write link', () => {
          openProjectViaLinkSharingAsAnon(linkSharingReadAndWrite)
          expectAnonymousReadAndWriteAccess()
          expectEditAuthoredAs('Anonymous')
        })
      })
    })
  })
})
