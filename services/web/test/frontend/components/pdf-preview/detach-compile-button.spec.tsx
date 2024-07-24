import '../../helpers/bootstrap-3'
import { EditorProviders } from '../../helpers/editor-providers'
import DetachCompileButtonWrapper from '../../../../frontend/js/features/pdf-preview/components/detach-compile-button-wrapper'
import { mockScope } from './scope'
import { testDetachChannel } from '../../helpers/detach-channel'

describe('<DetachCompileButtonWrapper />', function () {
  beforeEach(function () {
    cy.interceptEvents()
  })

  it('detacher mode and not linked: does not show button ', function () {
    cy.interceptCompile()

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-detachRole', 'detacher')
    })

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <DetachCompileButtonWrapper />
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.findByRole('button', { name: 'Recompile' }).should('not.exist')
  })

  it('detacher mode and linked: show button', function () {
    cy.interceptCompile()

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-detachRole', 'detacher')
    })

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <DetachCompileButtonWrapper />
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detached',
        event: 'connected',
      })
    })

    cy.findByRole('button', { name: 'Recompile' })
  })

  it('not detacher mode and linked: does not show button ', function () {
    cy.interceptCompile()

    cy.window().then(win => {
      win.metaAttributesCache.set('ol-detachRole', 'detached')
    })

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <DetachCompileButtonWrapper />
      </EditorProviders>
    )

    cy.waitForCompile()

    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detacher',
        event: 'connected',
      })
    })

    cy.findByRole('button', { name: 'Recompile' }).should('not.exist')
  })
})
