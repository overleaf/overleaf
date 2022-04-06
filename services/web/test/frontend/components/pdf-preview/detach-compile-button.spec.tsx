import { mount } from '@cypress/react'
import sysendTestHelper from '../../helpers/sysend'
import { EditorProviders } from '../../helpers/editor-providers'
import DetachCompileButton from '../../../../frontend/js/features/pdf-preview/components/detach-compile-button'
import { mockScope } from './scope'

describe('<DetachCompileButton/>', function () {
  beforeEach(function () {
    cy.interceptCompile()
    cy.interceptEvents()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sysendTestHelper.resetHistory()
  })

  it('detacher mode and not linked: does not show button ', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detacher']])
    })

    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <DetachCompileButton />
      </EditorProviders>
    )

    cy.findByRole('button', { name: 'Recompile' }).should('not.exist')
  })

  it('detacher mode and linked: show button ', function () {
    cy.window().then(win => {
      win.metaAttributesCache = new Map([['ol-detachRole', 'detacher']])
    })

    const scope = mockScope()

    mount(
      <EditorProviders scope={scope}>
        <DetachCompileButton />
      </EditorProviders>
    ).then(() => {
      sysendTestHelper.receiveMessage({
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

    mount(
      <EditorProviders scope={scope}>
        <DetachCompileButton />
      </EditorProviders>
    ).then(() => {
      sysendTestHelper.receiveMessage({
        role: 'detacher',
        event: 'connected',
      })
    })

    cy.findByRole('button', { name: 'Recompile' }).should('not.exist')
  })
})
