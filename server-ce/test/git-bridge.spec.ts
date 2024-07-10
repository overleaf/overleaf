import { isExcludedBySharding, startWith } from './helpers/config'
import { ensureUserExists, login } from './helpers/login'
import { createProject } from './helpers/project'

import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import LightningFS from '@isomorphic-git/lightning-fs'
import { throttledRecompile } from './helpers/compile'

describe('git-bridge', function () {
  const ENABLED_VARS = {
    GIT_BRIDGE_ENABLED: 'true',
    GIT_BRIDGE_HOST: 'git-bridge',
    GIT_BRIDGE_PORT: '8000',
    V1_HISTORY_URL: 'http://sharelatex:3100/api',
  }

  const gitBridgePublicHost =
    Cypress.env('GIT_BRIDGE_PUBLIC_HOST') || 'sharelatex'

  describe('enabled in Server Pro', function () {
    if (isExcludedBySharding('PRO_CUSTOM_1')) return
    startWith({
      pro: true,
      vars: ENABLED_VARS,
    })
    ensureUserExists({ email: 'user@example.com' })

    function clearAllTokens() {
      cy.get('button.linking-git-bridge-revoke-button').each(el => {
        cy.wrap(el).click()
        cy.findByText('Delete token').click()
      })
    }
    function maybeClearAllTokens() {
      cy.visit('/user/settings')
      cy.findByText('Git Integration')
      cy.get('button')
        .contains(/Generate token|Add another token/)
        .then(btn => {
          if (btn.text() === 'Add another token') {
            clearAllTokens()
          }
        })
    }

    beforeEach(function () {
      login('user@example.com')
      maybeClearAllTokens()
    })

    it('should render the git-bridge UI in the settings', () => {
      cy.visit('/user/settings')
      cy.findByText('Git Integration')
      cy.get('button').contains('Generate token').click()
      cy.get('code')
        .contains(/olp_[a-zA-Z0-9]{16}/)
        .as('newToken')
      cy.findAllByText('Close').last().click()
      cy.get('@newToken').then(token => {
        // There can be more than one token with the same prefix when retrying
        cy.findAllByText(
          `${token.text().slice(0, 'olp_1234'.length)}${'*'.repeat(12)}`
        ).should('have.length.at.least', 1)
      })
      cy.get('button').contains('Generate token').should('not.exist')
      cy.get('button').contains('Add another token').should('exist')
      clearAllTokens()
      cy.get('button').contains('Generate token').should('exist')
      cy.get('button').contains('Add another token').should('not.exist')
    })

    it('should render the git-bridge UI in the editor', function () {
      cy.visit('/project')
      createProject('git').as('projectId')
      cy.get('header').findByText('Menu').click()
      cy.findByText('Sync')
      cy.findByText('Git').click()
      cy.findByRole('dialog').within(() => {
        cy.get('@projectId').then(id => {
          cy.get('code').contains(
            `git clone http://git@${gitBridgePublicHost}/git/${id}`
          )
        })
        cy.findByRole('button', {
          name: 'Generate token',
        }).click()
        cy.get('code').contains(/olp_[a-zA-Z0-9]{16}/)
      })

      // Re-open
      cy.url().then(url => cy.visit(url))
      cy.get('header').findByText('Menu').click()
      cy.findByText('Git').click()
      cy.findByRole('dialog').within(() => {
        cy.get('@projectId').then(id => {
          cy.get('code').contains(
            `git clone http://git@${gitBridgePublicHost}/git/${id}`
          )
        })
        cy.findByText('Generate token').should('not.exist')
        cy.findByText(/generate a new one in Account Settings/)
        cy.findByText('Go to settings')
          .should('have.attr', 'target', '_blank')
          .and('have.attr', 'href', '/user/settings')
      })
    })

    it('should expose interface for git', () => {
      cy.visit('/project')
      createProject('git').as('projectId')
      const recompile = throttledRecompile()

      cy.get('header').findByText('Menu').click()
      cy.findByText('Sync')
      cy.findByText('Git').click()
      cy.get('@projectId').then(projectId => {
        cy.findByRole('dialog').within(() => {
          cy.get('code').contains(
            `git clone http://git@${gitBridgePublicHost}/git/${projectId}`
          )
        })
        cy.findByRole('button', {
          name: 'Generate token',
        }).click()
        cy.get('code')
          .contains(/olp_[a-zA-Z0-9]{16}/)
          .then(async tokenEl => {
            const token = tokenEl.text()

            // close Git modal
            cy.findAllByText('Close').last().click()
            // close editor menu
            cy.get('#left-menu-modal').click()

            // check history
            cy.findAllByText('History').last().click()
            cy.findByText('(via Git)').should('not.exist')
            cy.findAllByText('Back to editor').last().click()

            const fs = new LightningFS('fs')
            const dir = `/${projectId}`

            async function readFile(path: string) {
              return new Promise((resolve, reject) => {
                fs.readFile(path, { encoding: 'utf8' }, (err, blob) => {
                  if (err) return reject(err)
                  resolve(blob)
                })
              })
            }
            async function writeFile(path: string, data: string) {
              return new Promise<void>((resolve, reject) => {
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
            const httpOptions = {
              http,
              url: `http://sharelatex/git/${projectId}`,
              headers: {
                Authorization: `Basic ${Buffer.from(`git:${token}`).toString('base64')}`,
              },
            }
            const authorOptions = {
              author: { name: 'user', email: 'user@example.com' },
              committer: { name: 'user', email: 'user@example.com' },
            }

            // Clone
            cy.then({ timeout: 10_000 }, async () => {
              await git.clone({
                ...commonOptions,
                ...httpOptions,
              })
            })

            const mainTex = `${dir}/main.tex`
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
              await git.push({
                ...commonOptions,
                ...httpOptions,
              })
            })

            // check push in editor
            cy.findByText(/\\documentclass/)
              .parent()
              .parent()
              .should('have.text', text.replaceAll('\n', ''))

            // Wait for history sync - trigger flush by toggling the UI
            cy.findAllByText('History').last().click()
            cy.findAllByText('Back to editor').last().click()

            // check push in history
            cy.findAllByText('History').last().click()
            cy.findByText(/Hello world/)
            cy.findByText('(via Git)').should('exist')

            // Back to the editor
            cy.findAllByText('Back to editor').last().click()
            cy.findByText(/\\documentclass/)
              .parent()
              .parent()
              .click()
              .type('% via editor{enter}')

            // Trigger flush via compile
            recompile()

            // Back into the history, check what we just added
            cy.findAllByText('History').last().click()
            cy.findByText(/% via editor/)

            // Pull the change
            cy.then(async () => {
              await git.pull({
                ...commonOptions,
                ...httpOptions,
                ...authorOptions,
              })

              expect(await readFile(mainTex)).to.equal(text + '% via editor\n')
            })
          })
      })
    })
  })

  function checkDisabled() {
    ensureUserExists({ email: 'user@example.com' })

    it('should not render the git-bridge UI in the settings', () => {
      login('user@example.com')
      cy.visit('/user/settings')
      cy.findByText('Git Integration').should('not.exist')
    })
    it('should not render the git-bridge UI in the editor', function () {
      login('user@example.com')
      cy.visit('/project')
      createProject('maybe git')
      cy.get('header').findByText('Menu').click()
      cy.findByText('Word Count') // wait for lazy loading
      cy.findByText('Sync').should('not.exist')
      cy.findByText('Git').should('not.exist')
    })
  }

  describe('disabled in Server Pro', () => {
    if (isExcludedBySharding('PRO_DEFAULT_1')) return
    startWith({
      pro: true,
    })
    checkDisabled()
  })

  describe('unavailable in CE', () => {
    if (isExcludedBySharding('CE_CUSTOM_1')) return
    startWith({
      pro: false,
      vars: ENABLED_VARS,
    })
    checkDisabled()
  })
})
