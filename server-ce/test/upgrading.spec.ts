import { ensureUserExists, login } from './helpers/login'
import { isExcludedBySharding, startWith } from './helpers/config'
import { dockerCompose, runScript } from './helpers/hostAdminClient'
import { createProject, openProjectByName } from './helpers/project'
import { prepareWaitForNextCompileSlot } from './helpers/compile'
import { v4 as uuid } from 'uuid'

const USER = 'user@example.com'
const PROJECT_NAME = 'Old Project'

describe('Upgrading', function () {
  if (isExcludedBySharding('PRO_CUSTOM_3')) return

  let recompile: () => void
  let waitForCompile: (triggerCompile: () => void) => void

  function testUpgrade(
    steps: {
      version: string
      vars?: Object
      newProjectButtonMatcher?: RegExp
      hook?: () => void
    }[]
  ) {
    const startOptions = steps.shift()!

    before(async function () {
      cy.log('Create old instance')
    })
    startWith({
      pro: true,
      version: startOptions.version,
      withDataDir: true,
      resetData: true,
      vars: startOptions.vars,
    })
    before(function () {
      cy.log('Create initial user after deleting it')
    })
    ensureUserExists({ email: USER })
    before(function () {
      cy.log('Populate old instance')
      login(USER)
      ;({ recompile, waitForCompile } = prepareWaitForNextCompileSlot())
      waitForCompile(() => {
        createProject(PROJECT_NAME, {
          newProjectButtonMatcher: startOptions.newProjectButtonMatcher,
        })
      })

      cy.log('Wait for successful compile')
      cy.findByLabelText(/Page.*1/i).findByText(PROJECT_NAME)

      cy.log('Increment the doc version three times')
      for (let i = 0; i < 3; i++) {
        cy.log('Add content')
        cy.findByText('\\maketitle').parent().click()
        cy.findByText('\\maketitle')
          .parent()
          .type(`\n\\section{{}Old Section ${i}}`)

        cy.log('Trigger full flush')
        recompile()
        cy.findByRole('navigation', {
          name: 'Project Layout, Sharing, and Submission',
        })
          .findByRole('button', { name: 'Menu' })
          .click()
        cy.findByRole('link', { name: 'Source' }).click()
        cy.get('body').type('{esc}')
      }

      cy.log('Check compile and history')
      for (let i = 0; i < 3; i++) {
        cy.findByLabelText(/Page.*1/i).findByText(`Old Section ${i}`)
      }
      cy.findByRole('button', { name: 'History' }).click()
      for (let i = 0; i < 3; i++) {
        cy.findByText(new RegExp(`\\\\section{Old Section ${i}}`))
      }
    })

    for (const step of steps) {
      before(function () {
        cy.log(`Upgrade to version ${step.version}`)

        // Navigate way from editor to avoid redirect to /login when the next instance comes up (which slows down tests)
        cy.visit('/project', {})
      })
      before(async function () {
        cy.log('Graceful shutdown: flush all the things')
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
    beforeEach(function () {
      login(USER)
    })

    it('should list the old project', function () {
      cy.visit('/project')
      cy.findByRole('link', { name: PROJECT_NAME })
    })

    it('should open the old project', function () {
      waitForCompile(() => {
        openProjectByName(PROJECT_NAME)
      })

      cy.url().should('match', /\/project\/[a-fA-F0-9]{24}/)
      cy.findByRole('navigation', {
        name: 'Project actions',
      }).within(() => {
        cy.findByText(PROJECT_NAME)
      })

      cy.log('wait for successful compile')
      cy.findByLabelText(/Page.*1/i).findByText(PROJECT_NAME)
      cy.findByLabelText(/Page.*1/i).findByText('Old Section 2')

      cy.log('Add more content')
      const newSection = `New Section ${uuid()}`
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle').parent().type(`\n\\section{{}${newSection}}`)

      cy.log('Check compile and history')
      recompile()
      cy.findByLabelText(/Page.*1/i).findByText(newSection)
      cy.findByRole('button', { name: 'History' }).click()
      cy.findByText(/\\section\{Old Section 2}/)
      cy.findByText(new RegExp(`\\\\section\\{${newSection}}`))
    })
  }

  const optionsFourDotTwo = {
    version: '4.2',
    vars: {
      // Add core vars with old branding
      SHARELATEX_SITE_URL: 'http://sharelatex',
      SHARELATEX_MONGO_URL: 'mongodb://mongo/sharelatex',
      SHARELATEX_REDIS_HOST: 'redis',
    },
    newProjectButtonMatcher: /create first project/i,
  }
  const optionsBinaryFilesMigration = {
    version: '5.5.5',
    hook() {
      before(async function () {
        await runScript({
          cwd: 'services/history-v1',
          script: 'storage/scripts/back_fill_file_hash.mjs',
          args: ['--all'],
        })
      })
    },
  }
  describe('from 4.2 to latest', function () {
    testUpgrade([
      optionsFourDotTwo,
      optionsBinaryFilesMigration,
      { version: 'latest' },
    ])
  })
  describe('from 5.0 to latest', function () {
    testUpgrade([
      { version: '5.0' },
      optionsBinaryFilesMigration,
      { version: 'latest' },
    ])
  })
  describe('doc version recovery', function () {
    testUpgrade([
      optionsFourDotTwo,
      {
        version: '5.0.1-RC1',
        hook() {
          before(function () {
            login(USER)
            waitForCompile(() => {
              openProjectByName(PROJECT_NAME)
            })

            cy.log('Make a change')
            cy.findByText('\\maketitle').parent().click()
            cy.findByText('\\maketitle')
              .parent()
              .type('\n\\section{{}FiveOOne Section}')

            cy.log('Trigger flush')
            recompile()
            cy.findByLabelText(/Page.*1/i).findByText('FiveOOne Section')

            cy.log('Check for broken history, i.e. not synced with latest edit')
            cy.findByRole('button', { name: 'History' }).click()
            cy.findByText(/\\section\{Old Section 2}/) // wait for lazy loading
            cy.findByText(/\\section\{FiveOOne Section}/).should('not.exist')
          })
        },
      },
      optionsBinaryFilesMigration,
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

            cy.log(
              'The edit that was made while the history was broken should be there now.'
            )
            cy.findByRole('button', { name: 'History' }).click()
            cy.findByText(/\\section\{FiveOOne Section}/)

            // TODO(das7pad): restore after https://github.com/overleaf/internal/issues/19588 is fixed.
            // cy.log('Check indicator of force resync')
            // cy.findByText('Overleaf History System')
          })
        },
      },
    ])
  })
})
