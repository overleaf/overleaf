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
    cy.findByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu')
  })

  it('should not open on Shift+right-click', function () {
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
    cy.findByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu', {
      button: 2,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
      force: true,
    })
    cy.findByRole('menu').should('not.exist')
  })

  it('should close an already-open menu on Shift+right-click', function () {
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

    cy.findByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu').should('exist')

    cy.findByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu', {
      button: 2,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
      force: true,
    })
    cy.findByRole('menu').should('not.exist')
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
    cy.findByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu')
    cy.findAllByRole('treeitem', { name: 'foo.tex' }).click()
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

    cy.findAllByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu').should('not.exist')
  })

  it('copies entity path to clipboard when clicking "Copy path"', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: 'main-doc', name: 'main.tex' }],
        folders: [
          {
            _id: 'sub-folder-id',
            name: 'images',
            docs: [],
            folders: [],
            fileRefs: [{ _id: 'img-file', name: 'figure.png', hash: '123' }],
          },
        ],
        fileRefs: [],
      },
    ]

    cy.window().then(win => {
      cy.stub(win.navigator.clipboard, 'writeText').as('writeText')
    })

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

    cy.findByRole('treeitem', { name: 'images' }).click()
    cy.findByRole('treeitem', { name: 'figure.png' }).trigger('contextmenu')
    cy.findByRole('menu').findByRole('menuitem', { name: 'Copy path' }).click()

    cy.get('@writeText').should(
      'have.been.calledOnceWithExactly',
      'images/figure.png'
    )
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
    cy.findByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu')
      .findByRole('menuitem', { name: 'Set as main document' })
      .should('not.exist')

    // set other.tex as the main document
    cy.findByRole('treeitem', { name: 'other.tex' }).click({ force: true })
    cy.findByRole('treeitem', { name: 'other.tex' }).trigger('contextmenu')

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
    cy.findByRole('treeitem', { name: 'main.tex' }).trigger('contextmenu')
    cy.findByRole('menu').findByRole('menuitem', {
      name: 'Set as main document',
    })
  })
})
