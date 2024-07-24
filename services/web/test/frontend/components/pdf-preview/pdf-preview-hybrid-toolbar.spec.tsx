import '../../helpers/bootstrap-3'
import { EditorProviders } from '../../helpers/editor-providers'
import PdfPreviewHybridToolbar from '../../../../frontend/js/features/pdf-preview/components/pdf-preview-hybrid-toolbar'
import { testDetachChannel } from '../../helpers/detach-channel'

describe('<PdfPreviewHybridToolbar/>', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
  })

  it('shows normal mode', function () {
    cy.mount(
      <EditorProviders>
        <PdfPreviewHybridToolbar />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Recompile' })
  })

  describe('orphan mode', function () {
    it('shows connecting message  on load', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-detachRole', 'detached')
      })

      cy.mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      )

      cy.contains('Connecting with the editor')
    })

    it('shows compile UI when connected', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-detachRole', 'detached')
      })

      cy.mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      )

      cy.wrap(null).then(() => {
        testDetachChannel.postMessage({
          role: 'detacher',
          event: 'connected',
        })
      })

      cy.findByRole('button', { name: 'Recompile' })
    })

    it('shows connecting message when disconnected', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-detachRole', 'detached')
      })

      cy.mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      )

      cy.wrap(null).then(() => {
        testDetachChannel.postMessage({
          role: 'detacher',
          event: 'connected',
        })
        testDetachChannel.postMessage({
          role: 'detacher',
          event: 'closed',
        })
      })

      cy.contains('Connecting with the editor')
    })

    it('shows redirect button after timeout', function () {
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-detachRole', 'detached')
      })

      cy.clock()

      cy.mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      )

      cy.tick(6000)

      cy.findByRole('button', { name: 'Redirect to editor' })
    })
  })
})
