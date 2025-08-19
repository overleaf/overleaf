import PdfPreviewDetachedRoot from '../../../../frontend/js/features/pdf-preview/components/pdf-preview-detached-root'
import { detachChannel, testDetachChannel } from '../../helpers/detach-channel'

describe('<PdfPreviewDetachedRoot/>', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', { id: 'user1' })
    window.metaAttributesCache.set('ol-project_id', 'project1')
    window.metaAttributesCache.set('ol-detachRole', 'detached')
    window.metaAttributesCache.set('ol-projectName', 'Project Name')
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-compileSettings', {
      compileTimeout: 240,
    })

    cy.interceptEvents()
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
