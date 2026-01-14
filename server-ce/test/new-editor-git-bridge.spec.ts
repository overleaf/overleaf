import { v4 as uuid } from 'uuid'
import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import {
  createProject,
  createProjectAndOpenInNewEditor,
  enableLinkSharing,
  openProjectByName,
  openProjectViaLinkSharingAsUser,
  shareProjectByEmailAndAcceptInviteViaDash,
} from './helpers/project'

import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import LightningFS from '@isomorphic-git/lightning-fs'
import { prepareWaitForNextCompileSlot } from './helpers/compile'

const USER = 'user@example.com'

describe('new editor.git-bridge', function () {
  const ENABLED_VARS = {
    GIT_BRIDGE_ENABLED: 'true',
    GIT_BRIDGE_HOST: 'git-bridge',
    GIT_BRIDGE_PORT: '8000',
    V1_HISTORY_URL: 'http://sharelatex:3100/api',
  }

  function gitURL(projectId: string) {
    const url = new URL(Cypress.config().baseUrl!)
    url.username = 'git'
    url.pathname = `/git/${projectId}`
    return url
  }

  describe('enabled in Server Pro', function () {
    if (isExcludedBySharding('PRO_CUSTOM_1')) return
    startWith({
      pro: true,
      vars: ENABLED_VARS,
    })
    ensureUserExists({ email: USER })

    function clearAllTokens() {
      cy.findAllByRole('button', { name: 'Remove' })
        .not('[disabled]')
        .each($button => {
          cy.wrap($button).click()
          cy.findByRole('button', { name: 'Delete token' }).click()
        })
      cy.findByRole('dialog').should('not.exist')
    }

    function maybeClearAllTokens() {
      cy.visit('/user/settings')
      cy.findByRole('heading', { name: 'Git integration' })
      cy.findByRole('button', {
        name: /Generate token|Add another token/i,
      }).then(btn => {
        if (btn.text() === 'Add another token') {
          clearAllTokens()
        }
      })
    }

    beforeEach(function () {
      login(USER)
    })

    it('should render the git-bridge UI in the settings', function () {
      maybeClearAllTokens()
      cy.visit('/user/settings')
      cy.findByRole('heading', { name: 'Git integration' })
      cy.findByRole('button', {
        name: 'Git integration Generate token',
      }).click()
      cy.findByRole('dialog').within(() => {
        cy.findByLabelText('Git authentication token')
          .contains(/olp_[a-zA-Z0-9]{16}/)
          .then(el => el.text())
          .as('newToken')
        cy.findByRole('button', { name: 'Close dialog' }).click()
      })
      cy.get('@newToken').then(token => {
        // There can be more than one token with the same prefix when retrying
        cy.findAllByText(
          `${token.slice(0, 'olp_1234'.length)}${'*'.repeat(12)}`
        ).should('have.length.at.least', 1)
      })
      cy.findByRole('button', {
        name: 'Git integration Generate token',
      }).should('not.exist')
      cy.findByRole('button', { name: 'Add another token' }).should('exist')
      clearAllTokens()
      cy.findByRole('button', {
        name: 'Git integration Generate token',
      }).should('exist')
      cy.findByRole('button', { name: 'Add another token' }).should('not.exist')
    })

    it('should render the git-bridge UI in the editor', function () {
      maybeClearAllTokens()
      createProjectAndOpenInNewEditor('git').as('projectId')
      cy.findByRole('tab', { name: 'Integrations' }).click()
      cy.findByText('Git clone this project.').click()

      cy.findByTestId('git-bridge-modal').within(() => {
        cy.get('@projectId').then(id => {
          cy.findByLabelText('Git clone project command').contains(
            `git clone ${gitURL(id.toString())}`
          )
        })
        cy.findByRole('button', {
          name: 'Generate token',
        }).click()
        cy.findByLabelText('Git authentication token').contains(
          /olp_[a-zA-Z0-9]{16}/
        )
      })

      // Re-open
      cy.url().then(url => cy.visit(url))
      cy.findByText('Git clone this project.').click()

      cy.findByTestId('git-bridge-modal').within(() => {
        cy.get('@projectId').then(id => {
          cy.findByLabelText('Git clone project command').contains(
            `git clone ${gitURL(id.toString())}`
          )
        })
        cy.findByRole('button', {
          name: 'Generate token',
        }).should('not.exist')
        cy.findByText(/generate a new one in Account settings/)
        cy.findByRole('link', { name: 'Go to settings' })
          .should('have.attr', 'target', '_blank')
          .and('have.attr', 'href', '/user/settings')
      })
    })

    describe('git access', function () {
      ensureUserExists({ email: 'collaborator-rw@example.com' })
      ensureUserExists({ email: 'collaborator-ro@example.com' })
      ensureUserExists({ email: 'collaborator-link-rw@example.com' })
      ensureUserExists({ email: 'collaborator-link-ro@example.com' })

      let projectName: string
      let recompile: () => void
      let waitForCompile: (triggerCompile: () => void) => void
      beforeEach(function () {
        projectName = uuid()
        createProject(projectName, { open: false }).as('projectId')
        ;({ recompile, waitForCompile } = prepareWaitForNextCompileSlot())
      })

      it('should expose r/w interface to owner', function () {
        maybeClearAllTokens()
        waitForCompile(() => {
          openProjectByName(projectName, true)
        })
        checkGitAccess('readAndWrite')
      })

      it('should expose r/w interface to invited r/w collaborator', function () {
        shareProjectByEmailAndAcceptInviteViaDash(
          projectName,
          'collaborator-rw@example.com',
          'Editor',
          true
        )
        maybeClearAllTokens()
        waitForCompile(() => {
          openProjectByName(projectName, true)
        })
        checkGitAccess('readAndWrite')
      })

      it('should expose r/o interface to invited r/o collaborator', function () {
        shareProjectByEmailAndAcceptInviteViaDash(
          projectName,
          'collaborator-ro@example.com',
          'Viewer',
          true
        )
        maybeClearAllTokens()
        waitForCompile(() => {
          openProjectByName(projectName, true)
        })
        checkGitAccess('readOnly')
      })

      it('should expose r/w interface to link-sharing r/w collaborator', function () {
        openProjectByName(projectName, true)
        enableLinkSharing().then(({ linkSharingReadAndWrite }) => {
          const email = 'collaborator-link-rw@example.com'
          login(email)
          maybeClearAllTokens()
          waitForCompile(() => {
            openProjectViaLinkSharingAsUser(
              linkSharingReadAndWrite,
              projectName,
              email,
              true
            )
          })
          checkGitAccess('readAndWrite')
        })
      })

      it('should expose r/o interface to link-sharing r/o collaborator', function () {
        waitForCompile(() => {
          openProjectByName(projectName, true)
        })
        enableLinkSharing().then(({ linkSharingReadOnly }) => {
          const email = 'collaborator-link-ro@example.com'
          login(email)
          maybeClearAllTokens()
          waitForCompile(() => {
            openProjectViaLinkSharingAsUser(
              linkSharingReadOnly,
              projectName,
              email,
              true
            )
          })
          checkGitAccess('readOnly')
        })
      })

      function checkGitAccess(access: 'readOnly' | 'readAndWrite') {
        cy.findByRole('tab', { name: 'Integrations' }).click()
        cy.findByText('Git clone this project.').click()

        cy.get('@projectId').then(projectId => {
          cy.findByTestId('git-bridge-modal').within(() => {
            cy.findByLabelText('Git clone project command').contains(
              `git clone ${gitURL(projectId.toString())}`
            )
            cy.findByRole('heading', { name: 'Clone with Git' })
            cy.findByRole('button', {
              name: 'Generate token',
            }).click()
          })
          cy.findByLabelText('Git authentication token')
            .contains(/olp_[a-zA-Z0-9]{16}/)
            .then(async tokenEl => {
              const token = tokenEl.text()

              // close Git modal
              cy.findByRole('button', { name: 'Close dialog' }).click()
              cy.findByTestId('git-bridge-modal').should('not.exist')
              // close the modal
              cy.get('body').type('{esc}')
              cy.findByTestId('left-menu').should('not.exist')
              const fs = new LightningFS('fs')
              const dir = `/${projectId}`

              async function readFile(path: string): Promise<string> {
                return await new Promise((resolve, reject) => {
                  fs.readFile(path, { encoding: 'utf8' }, (err, blob) => {
                    if (err) return reject(err)
                    resolve(blob as string)
                  })
                })
              }

              async function writeFile(path: string, data: string) {
                return await new Promise<void>((resolve, reject) => {
                  fs.writeFile(path, data, undefined, err => {
                    if (err) return reject(err)
                    resolve()
                  })
                })
              }

              const commonOptions = {
                dir,
                fs,
              }
              const url = gitURL(projectId.toString())
              url.username = '' // basic auth is specified separately.
              const httpOptions = {
                http,
                url: url.toString(),
                headers: {
                  Authorization: `Basic ${Buffer.from(`git:${token}`).toString('base64')}`,
                },
              }
              const authorOptions = {
                author: { name: 'user', email: USER },
                committer: { name: 'user', email: USER },
              }
              const mainTex = `${dir}/main.tex`

              // Clone
              cy.then({ timeout: 10_000 }, async () => {
                await git.clone({
                  ...commonOptions,
                  ...httpOptions,
                })
              })
              cy.findByText(/\\documentclass/)
                .parent()
                .parent()
                .then(async editor => {
                  const onDisk = await readFile(mainTex)
                  expect(onDisk.replaceAll('\n', '')).to.equal(editor.text())
                })
              const text = `
\\documentclass{article}
\\begin{document}
Hello world
\\end{document}
`

              // Make a change
              cy.then(async () => {
                await writeFile(mainTex, text)
                await git.add({
                  ...commonOptions,
                  filepath: 'main.tex',
                })
                await git.commit({
                  ...commonOptions,
                  ...authorOptions,
                  message: 'Swap main.tex',
                })
              })

              if (access === 'readAndWrite') {
                // check history before push
                cy.findByRole('navigation', {
                  name: 'Project actions',
                })
                  .findByRole('button', { name: 'History' })
                  .click()
                cy.findByText('(via Git)').should('not.exist')
                cy.findAllByText('Back to editor').last().click()
                cy.then(async () => {
                  await git.push({
                    ...commonOptions,
                    ...httpOptions,
                  })
                })
              } else {
                cy.then(async () => {
                  try {
                    await git.push({
                      ...commonOptions,
                      ...httpOptions,
                    })
                    expect.fail('push should have failed')
                  } catch (err) {
                    expect(err).to.match(/branches were not updated/)
                    expect(err).to.match(/forbidden/)
                  }
                })

                return // return early, below are write access bits
              }

              // check push in editor
              cy.findByText(/\\documentclass/)
                .parent()
                .parent()
                .should('have.text', text.replaceAll('\n', ''))

              // Wait for history sync - trigger flush by toggling the UI
              cy.findByRole('navigation', {
                name: 'Project actions',
              })
                .findByRole('button', { name: 'History' })
                .click()
              cy.findAllByText('Back to editor').last().click()

              // check push in history
              cy.findByRole('navigation', {
                name: 'Project actions',
              })
                .findByRole('button', { name: 'History' })
                .click()
              cy.findByText(/Hello world/)
              cy.findByText('(via Git)').should('exist')

              // Back to the editor
              cy.findAllByText('Back to editor').last().click()
              cy.findByText(/\\documentclass/)
                .parent()
                .parent()
                .as('editor')
                .click()
              cy.get('@editor').type('% via editor{enter}')

              // Trigger flush via compile
              recompile()

              // Back into the history, check what we just added
              cy.findByRole('navigation', {
                name: 'Project actions',
              })
                .findByRole('button', { name: 'History' })
                .click()
              cy.findByText(/% via editor/)

              // Pull the change
              cy.then(async () => {
                await git.pull({
                  ...commonOptions,
                  ...httpOptions,
                  ...authorOptions,
                })

                expect(await readFile(mainTex)).to.equal(
                  text + '% via editor\n'
                )
              })
            })
        })
      }
    })
  })

  function checkDisabled() {
    ensureUserExists({ email: USER })

    it('should not render the git-bridge UI in the settings', function () {
      login(USER)
      cy.visit('/user/settings')
      cy.findByRole('heading', { name: 'Git integration' }).should('not.exist')
    })
    it('should not render the git-bridge UI in the editor', function () {
      login(USER)
      createProjectAndOpenInNewEditor('maybe git')
      cy.findByRole('tab', {
        name: 'File tree',
      }).should('exist') // Wait for load
      cy.findByRole('tab', {
        name: 'Integrations',
      }).should('not.exist')
    })
  }

  describe('disabled in Server Pro', function () {
    if (isExcludedBySharding('PRO_DEFAULT_1')) return
    startWith({
      pro: true,
    })
    checkDisabled()
  })

  describe('unavailable in CE', function () {
    if (isExcludedBySharding('CE_CUSTOM_1')) return
    startWith({
      pro: false,
      vars: ENABLED_VARS,
    })
    checkDisabled()
  })
})
