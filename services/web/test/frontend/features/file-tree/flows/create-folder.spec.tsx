import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'
import type { Socket } from '@/features/ide-react/connection/types/socket'

describe('FileTree Create Folder Flow', function () {
  let socket: SocketIOMock & Socket
  beforeEach(function () {
    socket = new SocketIOMock() as any
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', { id: 'user1' })
    })
  })

  it('add to root when no files are selected', function () {
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
        socket={socket}
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

    const name = 'Foo Bar In Root'

    cy.intercept('post', '/project/*/folder', {
      body: {
        folders: [],
        fileRefs: [],
        docs: [],
        _id: fakeId(),
        name,
      },
    }).as('createFolder')

    createFolder(name)

    cy.get('@createFolder').its('request.body').should('deep.equal', {
      parent_folder_id: 'root-folder-id',
      name,
    })

    cy.then(() => {
      socket.emitToClient('reciveNewFolder', 'root-folder-id', {
        _id: fakeId(),
        name,
        docs: [],
        fileRefs: [],
        folders: [],
      })
    })

    cy.findByRole('treeitem', { name })
  })

  it('add to folder from folder', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [],
        folders: [
          {
            _id: '789ghi',
            name: 'thefolder',
            docs: [],
            fileRefs: [],
            folders: [],
          },
        ],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        projectId="123abc"
        rootDocId="789ghi"
        socket={socket}
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

    cy.findByRole('button', { name: 'Expand' }).click()

    const name = 'Foo Bar In thefolder'

    cy.intercept('post', '/project/*/folder', {
      body: {
        folders: [],
        fileRefs: [],
        docs: [],
        _id: fakeId(),
        name,
      },
    }).as('createFolder')

    createFolder(name)

    cy.get('@createFolder').its('request.body').should('deep.equal', {
      parent_folder_id: '789ghi',
      name,
    })

    cy.then(() => {
      socket.emitToClient('reciveNewFolder', '789ghi', {
        _id: fakeId(),
        name,
        docs: [],
        fileRefs: [],
        folders: [],
      })
    })

    // find the created folder
    cy.findByRole('treeitem', { name })

    // collapse the parent folder; created folder should not be rendered anymore
    cy.findByRole('button', { name: 'Collapse' }).click()
    cy.findByRole('treeitem', { name }).should('not.exist')
  })

  it('add to folder from child', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [],
        folders: [
          {
            _id: '789ghi',
            name: 'thefolder',
            docs: [],
            fileRefs: [{ _id: '456def', name: 'sub.tex' }],
            folders: [],
          },
        ],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        projectId="123abc"
        rootDocId="456def"
        socket={socket}
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

    const name = 'Foo Bar In thefolder'

    cy.intercept('post', '/project/*/folder', {
      body: {
        folders: [],
        fileRefs: [],
        docs: [],
        _id: fakeId(),
        name,
      },
    }).as('createFolder')

    createFolder(name)

    cy.get('@createFolder').its('request.body').should('deep.equal', {
      parent_folder_id: '789ghi',
      name,
    })

    cy.then(() => {
      socket.emitToClient('reciveNewFolder', '789ghi', {
        _id: fakeId(),
        name,
        docs: [],
        fileRefs: [],
        folders: [],
      })
    })

    // find the created folder
    cy.findByRole('treeitem', { name })

    // collapse the parent folder; created folder should not be rendered anymore
    cy.findByRole('button', { name: 'Collapse' }).click()
    cy.findByRole('treeitem', { name }).should('not.exist')
  })

  it('prevents adding duplicate or invalid names', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'existingFile' }],
        folders: [],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders
        rootFolder={rootFolder as any}
        projectId="123abc"
        rootDocId="456def"
        socket={socket}
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

    const name = 'existingFile'

    cy.intercept('post', '/project/*/folder', cy.spy().as('createFolder'))

    createFolder(name)

    cy.get('@createFolder').should('not.have.been.called')

    cy.findByRole('alert', {
      name: 'A file or folder with this name already exists',
    })

    cy.findByRole('textbox').type('in/valid ')

    cy.findByRole('alert', {
      name: 'File name is empty or contains invalid characters',
    })
  })

  function createFolder(name: string) {
    cy.findByRole('button', { name: 'New folder' }).click()
    cy.findByRole('textbox').type(name)
    cy.findByRole('button', { name: 'Create' }).click()
  }

  function fakeId() {
    return Math.random().toString(16).replace(/0\./, 'random-test-id-')
  }
})
