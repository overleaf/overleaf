import { DEFAULT_PASSWORD, ensureUserExists, login } from './helpers/login'
import {
  createProject,
  expectFileExists,
  openProjectById,
  prepareFileUploadTest,
} from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { prepareWaitForNextCompileSlot } from './helpers/compile'
import { v4 as uuid } from 'uuid'
import {
  purgeFilestoreData,
  runGruntTask,
  runScript,
  setMongoFeatureCompatibilityVersion,
} from './helpers/hostAdminClient'

function activateUserVersion1x(url: string, password = DEFAULT_PASSWORD) {
  cy.session(url, () => {
    cy.visit(url)
    cy.url().then(url => {
      if (url.includes('/login')) return
      cy.url().should('contain', '/user/password/set')
      cy.get('input[type="password"]').type(password)
      cy.findByRole('button', { name: 'Set new password' }).click()
    })
  })
}

describe('filestore migration', function () {
  if (isExcludedBySharding('PRO_CUSTOM_5')) return
  const email = 'user@example.com'
  // Branding of env vars changed in 5.x
  const sharelatexBrandedVars = {
    SHARELATEX_SITE_URL: 'http://sharelatex',
    SHARELATEX_MONGO_URL: 'mongodb://mongo/sharelatex',
    SHARELATEX_REDIS_HOST: 'redis',
  }
  const projectName = `project-${uuid()}`
  let defaultImage: string
  let projectId: string
  let waitForCompile: (fn: () => void) => void
  const previousBinaryFiles: (() => void)[] = []

  function avoid502() {
    // The next step will likely restart the instance and any following
    // requests will fail with a 502/bad gateway. Avoid this by navigating
    // away from the editor, which will reload upon receiving a
    // 'forceDisconnect' socket.io message.
    cy.visit('/project')
  }

  function addNewBinaryFileAndCheckPrevious(
    universeSelector = `img[alt="${defaultImage}"]`
  ) {
    before(function () {
      login(email)
      waitForCompile(() => {
        cy.visit(`/project/${projectId}`)
      })
      previousBinaryFiles.push(prepareFileUploadTest(true))
      cy.log('check binary files')
      for (const check of previousBinaryFiles) {
        check()
      }
      cy.findByRole('treeitem', { name: defaultImage }).click()
      cy.get(universeSelector)
        .should('be.visible')
        .and('have.prop', 'naturalWidth')
        .should('be.greaterThan', 0)

      avoid502()
    })
  }

  if (Cypress.env('FULL_FILESTORE_MIGRATION')) {
    // --------------
    // Server Pro 1.x
    startWith({
      pro: true,
      resetData: true,
      withDataDir: true,
      vars: sharelatexBrandedVars,
      version: '1.2.4',
      mongoVersion: '5.0',
    })
    defaultImage = 'universe.jpg'

    let activateURL: string
    before(async function () {
      const { stdout } = await runGruntTask({
        task: 'user:create-admin',
        args: ['--email', email],
      })
      ;[activateURL] = stdout.match(
        /http:\/\/.+\/user\/password\/set\?passwordResetToken=\S+/
      )!
    })
    before(function () {
      activateUserVersion1x(activateURL)
      login(email)
      cy.visit('/project')

      // Legacy angular based UI uses links instead of buttons
      cy.findByRole('link', {
        name: /Create First Project|New Project/,
      }).click()
      cy.findByRole('link', { name: 'Example Project' }).click()
      cy.findByLabelText('Project name').type(projectName)
      cy.findByRole('button', { name: 'Create' }).click()
      cy.url()
        .should('match', /\/project\/[a-fA-F0-9]{24}/)
        .then(url => (projectId = url.split('/').pop()!))
      let queueReset
      ;({ waitForCompile, queueReset } = prepareWaitForNextCompileSlot())
      queueReset()

      // Create a new binary file
      cy.get(`a[tooltip="Upload"]`).click()
      const name = `${uuid()}.txt`
      // Binary file detection is not sophisticated in version 1.x
      const binName = name.replace('.txt', '.bin')
      const content = `Test File Content ${name} \x00`
      cy.get('input[type=file]')
        .first()
        .selectFile(
          {
            contents: Cypress.Buffer.from(content),
            fileName: binName,
            lastModified: Date.now(),
          },
          { force: true }
        )
      // Rename back to .txt to enable preview
      cy.findByText(binName).click()
      cy.findByText(binName).dblclick()
      cy.focused().type(name + '{del}'.repeat('.bin'.length) + '{enter}')
      // Switch back and forth
      cy.findByText('universe.jpg').click()
      cy.findByText(name).click()
      cy.findByText(content)
        .parent()
        .parent()
        .should('have.class', 'text-preview')

      previousBinaryFiles.push(() => expectFileExists(name, true, content))
      avoid502()
    })

    // --------------
    // Server Pro 2.x
    startWith({
      pro: true,
      withDataDir: true,
      vars: sharelatexBrandedVars,
      version: '2.7.1',
      mongoVersion: '5.0',
    })
    before(function () {
      // Cypress strips the Content-Length header: https://github.com/cypress-io/cypress/issues/16469
      // Server Pro 2.x does not gracefully handle a missing value.
      cy.intercept(
        {
          method: 'HEAD',
          url: `http://sharelatex/project/${projectId}/file/*`,
          times: previousBinaryFiles.length + 1,
        },
        req => {
          req.continue(res => {
            res.headers['Content-Length'] = '60'
          })
        }
      )
    })
    // Server Pro 2.x does not have alt tags on images.
    addNewBinaryFileAndCheckPrevious('img')

    // ----------------------------------
    // Server Pro 3.x + history migration
    startWith({
      pro: true,
      withDataDir: true,
      vars: sharelatexBrandedVars,
      version: '3.5.13',
      mongoVersion: '5.0',
    })
    addNewBinaryFileAndCheckPrevious() // before history migration
    before(async function () {
      await runScript({
        cwd: 'services/web',
        script: 'scripts/history/migrate_history.js',
        args: [
          '--force-clean',
          '--fix-invalid-characters',
          '--convert-large-docs-to-file',
        ],
        hasOverleafEnv: false,
        user: 'root',
      })
    })
    before(async function () {
      await runScript({
        cwd: 'services/web',
        script: 'scripts/history/clean_sl_history_data.js',
        hasOverleafEnv: false,
      })
    })
    addNewBinaryFileAndCheckPrevious() // after history migration

    // ------------------------------
    // Server Pro 4.x + mongo upgrade
    startWith({
      pro: true,
      withDataDir: true,
      vars: sharelatexBrandedVars,
      version: '4.2.9',
      mongoVersion: '5.0',
    })
    startWith({
      pro: true,
      withDataDir: true,
      vars: sharelatexBrandedVars,
      version: '4.2.9',
      mongoVersion: '6.0',
    })
    before(async function () {
      await setMongoFeatureCompatibilityVersion('6.0')
    })
    addNewBinaryFileAndCheckPrevious()

    // ------------------------------------------
    // Server Pro 5.x + mongo upgrade 6 -> 7 -> 8
    startWith({
      version: '5.5.5',
      pro: true,
      withDataDir: true,
      mongoVersion: '6.0',
    })
    startWith({
      version: '5.5.5',
      pro: true,
      withDataDir: true,
      mongoVersion: '7.0',
    })
    before(async function () {
      await setMongoFeatureCompatibilityVersion('7.0')
    })
    startWith({
      version: '5.5.5',
      pro: true,
      withDataDir: true,
      // implicit mongo upgrade to 8.0
    })
    before(async function () {
      await setMongoFeatureCompatibilityVersion('8.0')
    })
  } else {
    // 5.x
    startWith({ version: '5.5.5', pro: true, withDataDir: true })
    defaultImage = 'frog.jpg'
    ensureUserExists({ email })
    before(function () {
      login(email)
      createProject(projectName, { type: 'Example project', open: false }).then(
        id => (projectId = id)
      )
      ;({ waitForCompile } = prepareWaitForNextCompileSlot())
    })
  }
  addNewBinaryFileAndCheckPrevious()

  function ensureStopOnFirstErrorIsActive() {
    cy.findByRole('button', { name: 'Toggle compile options menu' }).click()
    cy.findByRole('menuitem', {
      name: 'Stop on first error',
    }).then(el => {
      // NOTE: THIS IS BAD, but the selected option is otherwise not accessible :/
      if (
        el.get()[0]?.querySelector('.material-symbol')?.textContent !== 'check'
      ) {
        cy.findByRole('menuitem', {
          name: 'Stop on first error',
        }).click()
        // Clicking on "Stop on first error" closes the mode. Open it again.
        cy.findByRole('button', { name: 'Toggle compile options menu' }).click()
      }
    })
    cy.findByRole('menuitem', {
      name: 'Stop on first error',
    }).within(() => {
      cy.findByText('check').should('be.visible')
    })
    cy.findByRole('button', { name: 'Toggle compile options menu' }).click()
  }

  // -------------------
  // filestore-migration
  beforeEach(function () {
    login(email)
    waitForCompile(() => {
      openProjectById(projectId)
    })
    ensureStopOnFirstErrorIsActive()
  })

  function checkFilesAreAccessible() {
    it('can upload new binary file and read previous uploads', function () {
      previousBinaryFiles.push(prepareFileUploadTest(true))
      for (const check of previousBinaryFiles) {
        check()
      }
    })

    it('renders image of example project', function () {
      cy.findByTestId('file-tree').findByText(defaultImage).click()
      cy.get(`[alt="${defaultImage}"]`)
        .should('be.visible')
        .and('have.prop', 'naturalWidth')
        .should('be.greaterThan', 0)
    })

    it('can recompile from scratch', function () {
      const id = uuid()
      cy.findByText('\\maketitle').parent().click()
      cy.findByText('\\maketitle')
        .parent()
        .type(`\n\\section{{}Test Section ${id}}`)

      waitForCompile(() => {
        cy.findByRole('button', { name: 'Toggle compile options menu' }).click()

        cy.findByRole('menuitem', {
          name: 'Recompile from scratch',
        }).trigger('click')
      })

      cy.get('.pdf-viewer').should('contain.text', `Test Section ${id}`)
    })
  }

  describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL not set', function () {
    startWith({ version: '5.5.5', pro: true, withDataDir: true, vars: {} })
    checkFilesAreAccessible()
  })

  describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL=0', function () {
    startWith({
      version: '5.5.5',
      pro: true,
      withDataDir: true,
      vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '0' },
    })
    checkFilesAreAccessible()

    describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL=1', function () {
      startWith({
        version: '5.5.5',
        pro: true,
        withDataDir: true,
        vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '1' },
      })
      checkFilesAreAccessible()

      describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL=2', function () {
        startWith({
          version: '5.5.5',
          pro: true,
          withDataDir: true,
          vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '1' },
        })
        before(async function () {
          await runScript({
            cwd: 'services/history-v1',
            script: 'storage/scripts/back_fill_file_hash.mjs',
            args: ['--all'],
          })
        })
        startWith({
          version: '5.5.5',
          pro: true,
          withDataDir: true,
          vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '2' },
        })
        checkFilesAreAccessible()

        describe('purge filestore data', function () {
          before(async function () {
            const deleted = await purgeFilestoreData()
            expect(deleted).to.have.length.greaterThan(
              previousBinaryFiles.length
            )
            expect(deleted).to.include(
              "removed directory '/var/lib/overleaf/data/user_files'"
            )
          })
          checkFilesAreAccessible()

          describe('after next restart', function () {
            startWith({
              version: '5.5.5',
              pro: true,
              withDataDir: true,
              vars: {
                OVERLEAF_APP_NAME: 'change-config',
                OVERLEAF_FILESTORE_MIGRATION_LEVEL: '2',
              },
            })
            it('should not recreate the user_files folder', async function () {
              expect(await purgeFilestoreData()).to.deep.equal([])
            })
          })

          describe('latest', function () {
            startWith({
              pro: true,
              withDataDir: true,
              vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '2' },
            })
            it('should not recreate the user_files folder', async function () {
              expect(await purgeFilestoreData()).to.deep.equal([])
            })
            checkFilesAreAccessible()
          })
        })
      })
    })
  })
})
