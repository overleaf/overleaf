import {
  ensureUserExists,
  login,
  resetCreatedUsersCache,
} from './helpers/login'
import { startWith } from './helpers/config'
import { dockerCompose, resetData, runScript } from './helpers/hostAdminClient'
import { createProject } from './helpers/project'
import { throttledRecompile } from './helpers/compile'

const USER = 'user@example.com'
const PROJECT_NAME = 'Old Project'

describe('Upgrading', function () {
  function testUpgrade(
    steps: {
      version: string
      vars?: Object
      newProjectButtonMatcher?: RegExp
      hook?: () => void
    }[]
  ) {
    const startOptions = steps.shift()!

    // Reset mongo/redis/on-disk data
    before(async () => {
      resetCreatedUsersCache()
      await resetData()
    })

    // Create old instance
    startWith({
      pro: true,
      version: startOptions.version,
      withDataDir: true,
      vars: startOptions.vars,
    })
    ensureUserExists({ email: USER })

    // Populate old instance
    before(() => {
      login(USER)

      cy.visit('/project')
      createProject(PROJECT_NAME, {
        newProjectButtonMatcher: startOptions.newProjectButtonMatcher,
      })
      const recompile = throttledRecompile()
      // // wait for successful compile
      cy.get('.pdf-viewer').should('contain.text', PROJECT_NAME)

      // Increment the doc version three times
      for (let i = 0; i < 3; i++) {
        // Add content
        cy.findByText('\\maketitle').parent().click()
        cy.findByText('\\maketitle')
          .parent()
          .type(`\n\\section{{}Old Section ${i}}`)

        // Trigger full flush
        recompile()
        cy.get('header').findByText('Menu').click()
        cy.findByText('Source').click()
        // close editor menu
        cy.get('#left-menu-modal').click()
      }

      // Check compile and history
      for (let i = 0; i < 3; i++) {
        cy.get('.pdf-viewer').should('contain.text', `Old Section ${i}`)
      }
      cy.findByText('History').click()
      for (let i = 0; i < 3; i++) {
        cy.findByText(new RegExp(`\\\\section\{Old Section ${i}}`))
      }
    })

    // Upgrades
    for (const step of steps) {
      before(() => {
        // Navigate way from editor to avoid redirect to /login when the next instance comes up (which slows down tests)
        cy.visit('/project', {})
      })
      // Graceful shutdown
      before(async function () {
        this.timeout(20 * 1000)
        // Ideally we could use the container shutdown procedure, but it's too slow and unreliable for tests.
        // TODO(das7pad): adopt the below after speeding up the graceful shutdown procedure on all supported releases
        // await dockerCompose('stop', 'sharelatex')

        // For now, we are stuck with manually flushing things
        await runScript({
          cwd: 'services/document-updater',
          script: 'scripts/flush_all.js',
        })
        await runScript({
          cwd: 'services/project-history',
          script: 'scripts/flush_all.js',
        })
      })
      startWith({
        pro: true,
        version: step.version,
        vars: step.vars,
        withDataDir: true,
      })

      step.hook?.()
    }
    beforeEach(() => {
      login(USER)
    })

    it('should list the old project', () => {
      cy.visit('/project')
      cy.findByText(PROJECT_NAME)
    })

    it('should open the old project', () => {
      cy.visit('/project')
      cy.findByText(PROJECT_NAME).click()

      cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
      cy.findByRole('navigation').within(() => {
        cy.findByText(PROJECT_NAME)
      })
      const recompile = throttledRecompile()

      // wait for successful compile
      cy.get('.pdf-viewer').should('contain.text', PROJECT_NAME)
      cy.get('.pdf-viewer').should('contain.text', 'Old Section 2')

      // // Add more content
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle').parent().type('\n\\section{{}New Section}')

      // Check compile and history
      recompile()
      cy.get('.pdf-viewer').should('contain.text', 'New Section')
      cy.findByText('History').click()
      cy.findByText(/\\section\{Old Section 2}/)
      cy.findByText(/\\section\{New Section}/)
    })
  }

  const optionsFourDotTwo = {
    version: '4.2',
    vars: {
      // Add database vars with old branding
      SHARELATEX_MONGO_URL: 'mongodb://mongo/sharelatex',
      SHARELATEX_REDIS_HOST: 'redis',
    },
    newProjectButtonMatcher: /create first project/i,
  }
  describe('from 4.2 to latest', () => {
    testUpgrade([optionsFourDotTwo, { version: 'latest' }])
  })
  describe('from 5.0 to latest', () => {
    testUpgrade([{ version: '5.0' }, { version: 'latest' }])
  })
  describe('doc version recovery', () => {
    testUpgrade([
      optionsFourDotTwo,
      {
        version: '5.0.1-RC1',
        hook() {
          before(function () {
            login(USER)
            cy.visit('/')
            cy.findByText(PROJECT_NAME).click()
            const recompile = throttledRecompile()

            // Make a change
            cy.findByText('\\maketitle').parent().click()
            cy.findByText('\\maketitle')
              .parent()
              .type('\n\\section{{}FiveOOne Section}')

            // Trigger flush
            recompile()
            cy.get('.pdf-viewer').should('contain.text', 'FiveOOne Section')

            // Check for broken history, i.e. not synced with latest edit
            cy.findByText('History').click()
            cy.findByText(/\\section\{Old Section 2}/) // wait for lazy loading
            cy.findByText(/\\section\{FiveOOne Section}/).should('not.exist')
          })
        },
      },
      {
        version: 'latest',
        hook() {
          before(async function () {
            this.timeout(20_000)
            const needle = 'Finished resyncing history for all projects.'
            for (let i = 0; i < 30; i++) {
              const { stdout } = await dockerCompose('logs', 'sharelatex')
              if (stdout.includes(needle)) {
                return
              }
              await new Promise(resolve => setTimeout(resolve, 500))
            }
            const { stdout } = await dockerCompose('logs', 'sharelatex')
            expect(stdout).to.contain(
              needle,
              'Doc version recovery did not finish yet.'
            )
          })

          before(function () {
            login(USER)
            cy.visit('/')
            cy.findByText(PROJECT_NAME).click()

            // The edit that was made while the history was broken should be there now.
            cy.findByText('History').click()
            cy.findByText(/\\section\{FiveOOne Section}/)

            // Check indicator of force resync
            cy.findByText('Overleaf History System')
          })
        },
      },
    ])
  })
})
