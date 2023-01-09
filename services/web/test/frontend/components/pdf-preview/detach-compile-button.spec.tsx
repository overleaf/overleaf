import { EditorProviders } from '../../helpers/editor-providers'
import DetachCompileButton from '../../../../frontend/js/features/pdf-preview/components/detach-compile-button'
import { mockScope } from './scope'
import { testDetachChannel } from '../../helpers/detach-channel'

describe('<DetachCompileButton/>', function () {
  beforeEach(function () {
    cy.interceptCompile()
    cy.interceptEvents()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('detacher mode and not linked: does not show button ', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detacher']])
    })

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <DetachCompileButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Recompile' }).should('not.exist')
  })

  it('detacher mode and linked: show button', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detacher']])
    })

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <DetachCompileButton />
      </EditorProviders>
    )

    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detached',
        event: 'connected',
      })
    })

    cy.findByRole('button', { name: 'Recompile' })
  })

  it('not detacher mode and linked: does not show button ', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detached']])
    })

    const scope = mockScope()

    cy.mount(
      <EditorProviders scope={scope}>
        <DetachCompileButton />
      </EditorProviders>
    )

    cy.wrap(null).then(() => {
      testDetachChannel.postMessage({
        role: 'detacher',
        event: 'connected',
      })
    })

    cy.findByRole('button', { name: 'Recompile' }).should('not.exist')
  })
})
