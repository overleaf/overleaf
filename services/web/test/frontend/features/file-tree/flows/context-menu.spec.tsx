import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'
import { EditorProviders } from '../../../helpers/editor-providers'

describe('FileTree Context Menu Flow', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', { id: 'user1' })
    })
  })

  it('opens on contextMenu event', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        projectId="123abc"
        rootDocId="456def"
      >
        <FileTreeRoot
          refProviders={{}}
          setRefProviderEnabled={cy.stub()}
          setStartedFreeTrial={cy.stub()}
          onSelect={cy.stub()}
          onInit={cy.stub()}
          isConnected
        />
      </EditorProviders>
    )

    cy.findByRole('menu').should('not.exist')
    cy.findByRole('button', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu')
  })

  it('closes when a new selection is started', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          { _id: '456def', name: 'main.tex' },
          { _id: '456def', name: 'foo.tex' },
        ],
        folders: [],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        projectId="123abc"
        rootDocId="456def"
      >
        <FileTreeRoot
          refProviders={{}}
          setRefProviderEnabled={cy.stub()}
          setStartedFreeTrial={cy.stub()}
          onSelect={cy.stub()}
          onInit={cy.stub()}
          isConnected
        />
      </EditorProviders>
    )

    cy.findByRole('menu').should('not.exist')
    cy.findByRole('button', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu')
    cy.findAllByRole('button', { name: 'foo.tex' }).click()
    cy.findByRole('menu').should('not.exist')
  })

  it("doesn't open in read only mode", function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        projectId="123abc"
        rootDocId="456def"
        permissionsLevel="readOnly"
      >
        <FileTreeRoot
          refProviders={{}}
          setRefProviderEnabled={cy.stub()}
          setStartedFreeTrial={cy.stub()}
          onSelect={cy.stub()}
          onInit={cy.stub()}
          isConnected
        />
      </EditorProviders>
    )

    cy.findAllByRole('button', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu').should('not.exist')
  })

  it('shows "set main document" item when appropriate', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          { _id: 'main-doc', name: 'main.tex' },
          { _id: 'other-doc', name: 'other.tex' },
        ],
        folders: [],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        projectId="123abc"
        rootDocId="main-doc"
      >
        <FileTreeRoot
          refProviders={{}}
          setRefProviderEnabled={cy.stub()}
          setStartedFreeTrial={cy.stub()}
          onSelect={cy.stub()}
          onInit={cy.stub()}
          isConnected
        />
      </EditorProviders>
    )

    cy.findByRole('menu').should('not.exist')

    // main.tex is already the main document
    cy.findByRole('button', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu')
      .findByRole('menuitem', { name: 'Set as main document' })
      .should('not.exist')

    // set other.tex as the main document
    cy.findByRole('button', { name: 'other.tex' }).click({ force: true })
    cy.findByRole('button', { name: 'other.tex' }).trigger('contextmenu')

    cy.intercept('POST', '/project/123abc/settings', { statusCode: 204 }).as(
      'update-settings'
    )

    cy.findByRole('menu')
      .findByRole('menuitem', { name: 'Set as main document' })
      .click()

    cy.wait('@update-settings')
      .its('request.body.rootDocId')
      .should('eq', 'other-doc')

    // main.tex is now not the main document
    cy.findByRole('button', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu').findByRole('menuitem', {
      name: 'Set as main document',
    })
  })
})
