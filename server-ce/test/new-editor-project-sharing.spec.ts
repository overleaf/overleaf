import { v4 as uuid } from 'uuid'
import {
  isExcludedBySharding,
  startWith,
  reloadWith,
  STARTUP_TIMEOUT,
} from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import {
  createProjectAndOpenInNewEditor,
  enableLinkSharing,
  getSpamSafeProjectName,
  openProjectByName,
  openProjectViaLinkSharingAsAnon,
  openProjectViaLinkSharingAsUser,
  shareProjectByEmailAndAcceptInviteViaDash,
  shareProjectByEmailAndAcceptInviteViaEmail,
} from './helpers/project'
import { prepareWaitForNextCompileSlot } from './helpers/compile'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'

describe('new editor.Project Sharing', function () {
  if (isExcludedBySharding('PRO_CUSTOM_4')) return
  ensureUserExists({ email: 'user@example.com' })
  startWith({ withDataDir: true, pro: true })

  let projectName: string
  let recompile: () => void
  let waitForCompile: (triggerCompile: () => void) => void
  beforeWithReRunOnTestRetry(() => {
    projectName = getSpamSafeProjectName()
    ;({ recompile, waitForCompile } = prepareWaitForNextCompileSlot())
    setupTestProject()
  })

  beforeEach(function () {
    // Always start with a fresh session
    cy.session([uuid()], () => {})
  })

  let linkSharingReadOnly: string
  let linkSharingReadAndWrite: string

  function setupTestProject() {
    login('user@example.com')
    waitForCompile(() => {
      createProjectAndOpenInNewEditor(projectName)
    })

    // Add chat message
    cy.findByRole('tab', { name: 'Chat' }).click()
    // wait for lazy loading of the chat pane
    cy.findByText('Start the conversation by saying hello or sharing an update')
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
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'contain.text',
      '\\maketitle'
    )
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'have.attr',
      'contenteditable',
      'false'
    )
  }

  function expectContentWriteAccess() {
    const section = `Test Section ${uuid()}`
    cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
    // wait for the editor to finish loading
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'contain.text',
      '\\maketitle'
    )
    // the editor should be writable
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'have.attr',
      'contenteditable',
      'true'
    )
    cy.findByRole('textbox', { name: 'Source Editor editing' }).within(() => {
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle').parent().type(`\n\\section{{}${section}}`)
    })
    // should have written
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'contain.text',
      `\\section{${section}}`
    )
    // check PDF
    recompile()
    cy.findByRole('region', { name: 'PDF preview' }).within(() => {
      cy.findByLabelText(/Page.*1/i).should('be.visible')
      cy.findByText(projectName).should('be.visible')
    })
    cy.findByRole('region', { name: 'PDF preview' }).within(() => {
      cy.findByLabelText(/Page.*1/i).should('be.visible')
      cy.contains(section)
    })
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
    cy.findByRole('tab', { name: 'Chat' }).click()
    cy.findByText('New Chat Message')
  }

  function expectHistoryAccess() {
    cy.findByRole('button', { name: 'History' }).click()
    // The input is not clickable due to being visually hidden, click its label instead
    cy.findByRole('complementary', {
      name: 'Project history and labels',
    }).within(() => {
      cy.findByRole('group', {
        name: 'Show all of the project history or only labelled versions.',
      }).within(() => {
        cy.findByText('All history').click()
      })
      cy.findByRole('radio', { name: 'Labels' }).should('not.be.checked')
      cy.findByRole('radio', { name: 'All history' }).should('be.checked')
    })
    cy.findByText(/\\begin\{document}/)
    cy.findByRole('complementary', {
      name: 'Project history and labels',
    }).within(() => {
      cy.findAllByTestId('history-version-metadata-users')
        .last()
        .should('have.text', 'user')
    })
    cy.findByRole('button', { name: 'Back to editor' }).click()
  }

  function expectNoChatAccess() {
    cy.findByRole('button', { name: 'Layout options' }) // wait for lazy loading
    cy.findByRole('tab', { name: 'Chat' }).should('not.exist')
  }

  function expectNoHistoryAccess() {
    cy.findByRole('button', { name: 'Layout options' }) // wait for lazy loading
    cy.findByRole('button', { name: 'History' }).should('not.exist')
  }

  function expectCommentAccess() {
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'contain.text',
      '\\maketitle'
    )

    cy.findByText('\\maketitle').parent().dblclick()

    cy.findByRole('button', { name: 'Add comment' }).should('be.visible')

    cy.findByRole('textbox', { name: 'Source Editor editing' }).click()
  }

  function expectNoCommentAccess() {
    cy.findByRole('textbox', { name: 'Source Editor editing' }).should(
      'contain.text',
      '\\maketitle'
    )

    cy.findByText('\\maketitle').parent().dblclick()

    cy.findByRole('button', { name: 'Add comment' }).should('not.exist')
    cy.findByRole('textbox', { name: 'Source Editor editing' }).click()
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
    cy.findByRole('button', { name: 'History' }).click()
    cy.findByRole('complementary', {
      name: 'Project history and labels',
    }).within(() => {
      cy.findAllByTestId('history-version-metadata-users')
        .first()
        .should('contain.text', author) // might have other edits in the same group
    })
  }
  describe('via email', function () {
    const email = 'collaborator-email@example.com'
    ensureUserExists({ email })

    beforeEach(function () {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaEmail(
        projectName,
        email,
        'Viewer',
        true
      )
    })

    it('should grant the collaborator read access', function () {
      expectFullReadOnlyAccess()
      expectProjectDashboardEntry()
    })
  })

  describe('read only', function () {
    const email = 'collaborator-ro@example.com'
    ensureUserExists({ email })

    beforeWithReRunOnTestRetry(() => {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaDash(
        projectName,
        email,
        'Viewer',
        true
      )
    })

    it('should grant the collaborator read access', function () {
      login(email)
      openProjectByName(projectName, true)
      expectFullReadOnlyAccess()
      expectProjectDashboardEntry()
    })
  })

  describe('read and write', function () {
    const email = 'collaborator-rw@example.com'
    ensureUserExists({ email })

    beforeWithReRunOnTestRetry(() => {
      login('user@example.com')
      shareProjectByEmailAndAcceptInviteViaDash(
        projectName,
        email,
        'Editor',
        true
      )
    })

    it('should grant the collaborator write access', function () {
      login(email)
      openProjectByName(projectName, true)
      expectFullReadAndWriteAccess()
      expectEditAuthoredAs('You')
      expectProjectDashboardEntry()
    })
  })

  describe('token access', function () {
    describe('logged in', function () {
      describe('read only', function () {
        const email = 'collaborator-link-ro@example.com'
        ensureUserExists({ email })

        it('should grant restricted read access', function () {
          login(email)
          openProjectViaLinkSharingAsUser(
            linkSharingReadOnly,
            projectName,
            email,
            true
          )
          expectRestrictedReadOnlyAccess()
          expectProjectDashboardEntry()
        })
      })

      describe('read and write', function () {
        const email = 'collaborator-link-rw@example.com'
        ensureUserExists({ email })

        it('should grant full write access', function () {
          login(email)
          openProjectViaLinkSharingAsUser(
            linkSharingReadAndWrite,
            projectName,
            email,
            true
          )
          expectFullReadAndWriteAccess()
          expectEditAuthoredAs('You')
          expectProjectDashboardEntry()
        })
      })
    })

    describe('with OVERLEAF_ALLOW_PUBLIC_ACCESS=false', function () {
      describe('wrap startup', function () {
        startWith({
          pro: true,
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'false',
          },
          withDataDir: true,
        })
        it('should block access', function () {
          expectNoAccess()
        })
      })

      describe('with OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING=true', function () {
        startWith({
          pro: true,
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'false',
            OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING: 'true',
          },
          withDataDir: true,
        })
        it('should block access', function () {
          expectNoAccess()
        })
      })
    })

    describe('with OVERLEAF_ALLOW_PUBLIC_ACCESS=true', function () {
      describe('wrap startup', function () {
        startWith({
          pro: true,
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'true',
          },
          withDataDir: true,
        })
        it('should grant read access with read link', function () {
          openProjectViaLinkSharingAsAnon(linkSharingReadOnly, true)
          expectRestrictedReadOnlyAccess()
        })

        it('should prompt for login with write link', function () {
          cy.visit(linkSharingReadAndWrite)
          cy.url().should('match', /\/login/)
        })
      })

      describe('with OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING=true', function () {
        startWith({
          pro: true,
          vars: {
            OVERLEAF_ALLOW_PUBLIC_ACCESS: 'true',
            OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING: 'true',
          },
          withDataDir: true,
        })

        it('should grant read access with read link', function () {
          openProjectViaLinkSharingAsAnon(linkSharingReadOnly, true)
          expectRestrictedReadOnlyAccess()
        })

        it('should grant write access with write link', function () {
          openProjectViaLinkSharingAsAnon(linkSharingReadAndWrite, true)
          expectAnonymousReadAndWriteAccess()
          expectEditAuthoredAs('Anonymous')
        })
      })
    })

    describe('with OVERLEAF_DISABLE_LINK_SHARING=true', function () {
      const email = 'collaborator-email@example.com'
      ensureUserExists({ email })

      const invitedEmail = 'invited-email@example.com'
      ensureUserExists({ email: invitedEmail })

      const retainedViewerEmail = 'collaborator-retained-viewer@example.com'
      ensureUserExists({ email: retainedViewerEmail })

      const retainedEditorEmail = 'collaborator-retained-editor@example.com'
      ensureUserExists({ email: retainedEditorEmail })

      // Link-sharing urls have to be created before disabling link sharing.
      // We use the `beforeEach` hook to reload the server with link sharing
      // disabled **after** the initial setup which happens in the `before`
      // block. The `before` hook always runs prior to the `beforeEach` hook.

      // Set up retained access before disabling link sharing
      before(function () {
        // Set up retained viewer access
        login(retainedViewerEmail)
        openProjectViaLinkSharingAsUser(
          linkSharingReadOnly,
          projectName,
          retainedViewerEmail,
          true
        )

        // Set up retained editor access
        login(retainedEditorEmail)
        openProjectViaLinkSharingAsUser(
          linkSharingReadAndWrite,
          projectName,
          retainedEditorEmail,
          true
        )
      })

      beforeEach(function () {
        this.timeout(STARTUP_TIMEOUT) // Increase timeout for server reload

        return cy.wrap(
          reloadWith({
            pro: true,
            vars: {
              OVERLEAF_ALLOW_PUBLIC_ACCESS: 'true',
              OVERLEAF_ALLOW_ANONYMOUS_READ_AND_WRITE_SHARING: 'true',
              OVERLEAF_DISABLE_LINK_SHARING: 'true',
            },
            withDataDir: true,
          }),
          { timeout: STARTUP_TIMEOUT }
        )
      })

      it('should not display link sharing in the sharing modal', function () {
        login('user@example.com')
        openProjectByName(projectName, true)
        cy.findByRole('navigation', {
          name: 'Project actions',
        })
          .findByRole('button', { name: 'Share' })
          .click()
        cy.findByRole('button', { name: 'Turn on link sharing' }).should(
          'not.exist'
        )
      })

      it('should block new access to read-only link shared projects', function () {
        login(email)

        // Test read-only link returns 404
        cy.request({
          url: linkSharingReadOnly,
          failOnStatusCode: false,
        }).then(response => {
          expect(response.status).to.eq(404)
        })
      })

      it('should block new access to read-write link shared projects', function () {
        login(email)

        // Test read-write link returns 404
        cy.request({
          url: linkSharingReadAndWrite,
          failOnStatusCode: false,
        }).then(response => {
          expect(response.status).to.eq(404)
        })
      })

      it('should continue to allow email sharing', function () {
        login('user@example.com')
        shareProjectByEmailAndAcceptInviteViaEmail(
          projectName,
          invitedEmail,
          'Viewer',
          true
        )
        expectFullReadOnlyAccess()
        expectProjectDashboardEntry()
      })

      it('should retain read-only access when project was joined via link before link sharing was turned off', function () {
        login(retainedViewerEmail)
        openProjectByName(projectName, true)
        expectRestrictedReadOnlyAccess()
        expectProjectDashboardEntry()
      })

      it('should retain read-write access when project was joined via link before link sharing was turned off', function () {
        login(retainedEditorEmail)
        openProjectByName(projectName, true)
        expectFullReadAndWriteAccess()
        expectProjectDashboardEntry()
      })
    })
  })
})
