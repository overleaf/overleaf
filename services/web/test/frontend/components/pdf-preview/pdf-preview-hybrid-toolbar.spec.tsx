import { mount } from '@cypress/react'
import sysendTestHelper from '../../helpers/sysend'
import { EditorProviders } from '../../helpers/editor-providers'
import PdfPreviewHybridToolbar from '../../../../frontend/js/features/pdf-preview/components/pdf-preview-hybrid-toolbar'

describe('<PdfPreviewHybridToolbar/>', function () {
  beforeEach(function () {
    cy.interceptCompile()
    cy.interceptEvents()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sysendTestHelper.resetHistory()
  })

  it('shows normal mode', function () {
    mount(
      <EditorProviders>
        <PdfPreviewHybridToolbar />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Recompile' })
  })

  describe('orphan mode', function () {
    it('shows connecting message  on load', function () {
      cy.window().then(win => {
        win.metaAttributesCache = new Map([['ol-detachRole', 'detached']])
      })

      mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      )

      cy.contains('Connecting with the editor')
    })

    it('shows compile UI when connected', function () {
      cy.window().then(win => {
        win.metaAttributesCache = new Map([['ol-detachRole', 'detached']])
      })

      mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      ).then(() => {
        sysendTestHelper.receiveMessage({
          role: 'detacher',
          event: 'connected',
        })
      })

      cy.findByRole('button', { name: 'Recompile' })
    })

    it('shows connecting message when disconnected', function () {
      cy.window().then(win => {
        win.metaAttributesCache = new Map([['ol-detachRole', 'detached']])
      })

      mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      ).then(() => {
        sysendTestHelper.receiveMessage({
          role: 'detacher',
          event: 'connected',
        })
        sysendTestHelper.receiveMessage({
          role: 'detacher',
          event: 'closed',
        })
      })

      cy.contains('Connecting with the editor')
    })

    it('shows redirect button after timeout', function () {
      cy.window().then(win => {
        win.metaAttributesCache = new Map([['ol-detachRole', 'detached']])
      })

      cy.clock()

      mount(
        <EditorProviders>
          <PdfPreviewHybridToolbar />
        </EditorProviders>
      )

      cy.tick(6000)

      cy.findByRole('button', { name: 'Redirect to editor' })
    })
  })
})
