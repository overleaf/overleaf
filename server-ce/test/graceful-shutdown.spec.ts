import { ensureUserExists, login } from './helpers/login'
import {
  isExcludedBySharding,
  STARTUP_TIMEOUT,
  startWith,
} from './helpers/config'
import { dockerCompose, getRedisKeys } from './helpers/hostAdminClient'
import { createProject } from './helpers/project'
import { throttledRecompile } from './helpers/compile'

const USER = 'user@example.com'
const PROJECT_NAME = 'Old Project'

function bringServerProBackUp() {
  cy.log('bring server pro back up')
  cy.then({ timeout: STARTUP_TIMEOUT }, async () => {
    await dockerCompose('up', '--detach', '--wait', 'sharelatex')
  })
}

describe('GracefulShutdown', function () {
  if (isExcludedBySharding('PRO_CUSTOM_1')) return
  startWith({
    pro: true,
    withDataDir: true,
    resetData: true,
  })
  ensureUserExists({ email: USER })

  let projectId: string
  it('should display banner and flush changes out of redis', () => {
    bringServerProBackUp()
    login(USER)

    cy.visit('/project')
    createProject(PROJECT_NAME).then(id => {
      projectId = id
    })
    const recompile = throttledRecompile()

    cy.log('add additional content')
    cy.findByText('\\maketitle').parent().click()
    cy.findByText('\\maketitle').parent().type(`\n\\section{{}New Section}`)
    recompile()

    cy.log(
      'check flush from frontend to backend: should include new section in PDF'
    )
    cy.get('.pdf-viewer').should('contain.text', 'New Section')

    cy.log('should have unflushed content in redis before shutdown')
    cy.then(async () => {
      const keys = await getRedisKeys()
      expect(keys).to.contain(`DocsIn:${projectId}`)
      expect(keys).to.contain(`ProjectHistory:Ops:{${projectId}}`)
    })

    cy.log('trigger graceful shutdown')
    let pendingShutdown: Promise<any>
    cy.then(() => {
      pendingShutdown = dockerCompose('stop', '--timeout=60', 'sharelatex')
    })

    cy.log('wait for banner')
    cy.findByText(/performing maintenance/)
    cy.log('wait for page reload')
    cy.findByText(/is currently down for maintenance/)

    cy.log('wait for shutdown to complete')
    cy.then({ timeout: 60 * 1000 }, async () => {
      await pendingShutdown
    })

    cy.log('should not have any unflushed content in redis after shutdown')
    cy.then(async () => {
      const keys = await getRedisKeys()
      expect(keys).to.not.contain(`DocsIn:${projectId}`)
      expect(keys).to.not.contain(`ProjectHistory:Ops:{${projectId}}`)
    })

    bringServerProBackUp()

    cy.then(() => {
      cy.visit(`/project/${projectId}?trick-cypress-into-page-reload=true`)
    })

    cy.log('check loading doc from mongo')
    cy.findByText('New Section')

    cy.log('check PDF')
    cy.get('.pdf-viewer').should('contain.text', 'New Section')

    cy.log('check history')
    cy.findByText('History').click()
    cy.findByText(/\\section\{New Section}/)
  })
})
