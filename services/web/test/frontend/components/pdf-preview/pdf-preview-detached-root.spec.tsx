import PdfPreviewDetachedRoot from '../../../../frontend/js/features/pdf-preview/components/pdf-preview-detached-root'
import { User } from '../../../../types/user'
import { detachChannel, testDetachChannel } from '../../helpers/detach-channel'

describe('<PdfPreviewDetachedRoot/>', function () {
  beforeEach(function () {
    window.user = { id: 'user1' } as User

    window.metaAttributesCache = new Map<string, unknown>([
      ['ol-user', window.user],
      ['ol-project_id', 'project1'],
      ['ol-detachRole', 'detached'],
      ['ol-projectName', 'Project Name'],
      ['ol-preventCompileOnLoad', true],
    ])

    cy.interceptEvents()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('syncs compiling state', function () {
    cy.interceptCompile()

    cy.mount(<PdfPreviewDetachedRoot />)

    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detacher',
        event: 'connected',
      })

      testDetachChannel.postMessage({
        role: 'detacher',
        event: 'state-compiling',
        data: { value: true },
      })
    })

    cy.findByRole('button', { name: 'Compiling…' })
    cy.findByRole('button', { name: 'Recompile' }).should('not.exist')
    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detacher',
        event: 'state-compiling',
        data: { value: false },
      })
    })
    cy.findByRole('button', { name: 'Recompile' })
    cy.findByRole('button', { name: 'Compiling…' }).should('not.exist')
  })

  it('sends a clear cache request when the button is pressed', function () {
    cy.interceptCompile()

    cy.mount(<PdfPreviewDetachedRoot />)

    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detacher',
        event: 'state-showLogs',
        data: { value: true },
      })
    })

    cy.spy(detachChannel, 'postMessage').as('postDetachMessage')

    cy.findByRole('button', { name: 'Clear cached files' })
      .should('not.be.disabled')
      .click()

    cy.get('@postDetachMessage').should('have.been.calledWith', {
      role: 'detached',
      event: 'action-clearCache',
      data: {
        args: [],
      },
    })
  })
})
