import { ensureUserExists, login } from './helpers/login'
import {
  createProject,
  openProjectById,
  prepareFileUploadTest,
} from './helpers/project'
import { isExcludedBySharding, startWith } from './helpers/config'
import { prepareWaitForNextCompileSlot } from './helpers/compile'
import { beforeWithReRunOnTestRetry } from './helpers/beforeWithReRunOnTestRetry'
import { v4 as uuid } from 'uuid'
import { purgeFilestoreData, runScript } from './helpers/hostAdminClient'

describe('filestore migration', function () {
  if (isExcludedBySharding('CE_CUSTOM_3')) return
  startWith({ withDataDir: true, resetData: true, vars: {} })
  ensureUserExists({ email: 'user@example.com' })

  let projectName: string
  let projectId: string
  let waitForCompileRateLimitCoolOff: (fn: () => void) => void
  const previousBinaryFiles: (() => void)[] = []
  beforeWithReRunOnTestRetry(function () {
    projectName = `project-${uuid()}`
    login('user@example.com')
    createProject(projectName, { type: 'Example project' }).then(
      id => (projectId = id)
    )
    let queueReset
    ;({ waitForCompileRateLimitCoolOff, queueReset } =
      prepareWaitForNextCompileSlot())
    queueReset()
    previousBinaryFiles.push(prepareFileUploadTest(true))
  })

  beforeEach(() => {
    login('user@example.com')
    waitForCompileRateLimitCoolOff(() => {
      openProjectById(projectId)
    })
  })

  function checkFilesAreAccessible() {
    it('can upload new binary file and read previous uploads', function () {
      previousBinaryFiles.push(prepareFileUploadTest(true))
      for (const check of previousBinaryFiles) {
        check()
      }
    })

    it('renders frog jpg', () => {
      cy.findByTestId('file-tree').findByText('frog.jpg').click()
      cy.get('[alt="frog.jpg"]')
        .should('be.visible')
        .and('have.prop', 'naturalWidth')
        .should('be.greaterThan', 0)
    })
  }

  describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL not set', function () {
    startWith({ withDataDir: true, vars: {} })
    checkFilesAreAccessible()
  })

  describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL=0', function () {
    startWith({
      withDataDir: true,
      vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '0' },
    })
    checkFilesAreAccessible()

    describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL=1', function () {
      startWith({
        withDataDir: true,
        vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '1' },
      })
      checkFilesAreAccessible()

      describe('OVERLEAF_FILESTORE_MIGRATION_LEVEL=2', function () {
        startWith({
          withDataDir: true,
          vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '1' },
        })
        before(async function () {
          await runScript({
            cwd: 'services/history-v1',
            script: 'storage/scripts/back_fill_file_hash.mjs',
          })
        })
        startWith({
          withDataDir: true,
          vars: { OVERLEAF_FILESTORE_MIGRATION_LEVEL: '2' },
        })
        checkFilesAreAccessible()

        describe('purge filestore data', function () {
          before(async function () {
            await purgeFilestoreData()
          })
          checkFilesAreAccessible()
        })
      })
    })
  })
})
