import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'
import type { Socket } from '@/features/ide-react/connection/types/socket'

describe('FileTree Rename Entity Flow', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', { id: 'user1' })
    })
  })

  let socket: SocketIOMock & Socket
  beforeEach(function () {
    socket = new SocketIOMock() as any
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'a.tex' }],
        folders: [
          {
            _id: '987jkl',
            name: 'folder',
            docs: [],
            fileRefs: [
              { _id: '789ghi', name: 'c.tex' },
              { _id: '981gkp', name: 'e.tex' },
            ],
            folders: [],
          },
        ],
        fileRefs: [],
      },
    ]

    cy.mount(
      <div style={{ width: 400 }}>
        <EditorProviders
          rootFolder={rootFolder as any}
          projectId="123abc"
          socket={socket}
        >
          <FileTreeRoot
            refProviders={{}}
            setRefProviderEnabled={cy.stub()}
            setStartedFreeTrial={cy.stub()}
            onSelect={cy.stub().as('onSelect')}
            onInit={cy.stub()}
            isConnected
          />
        </EditorProviders>
      </div>
    )
  })

  it('renames doc', function () {
    cy.intercept('/project/*/doc/*/rename', { statusCode: 204 }).as('renameDoc')

    renameItem('a.tex', 'b.tex')

    cy.findByRole('treeitem', { name: 'b.tex' })

    cy.get('@renameDoc').its('request.body').should('deep.equal', {
      name: 'b.tex',
    })
  })

  it('renames folder', function () {
    cy.intercept('/project/*/folder/*/rename', { statusCode: 204 }).as(
      'renameFolder'
    )

    renameItem('folder', 'new folder name')

    cy.findByRole('treeitem', { name: 'new folder name' })

    cy.get('@renameFolder').its('request.body').should('deep.equal', {
      name: 'new folder name',
    })
  })

  it('renames file in subfolder', function () {
    cy.intercept('/project/*/file/*/rename', { statusCode: 204 }).as(
      'renameFile'
    )

    cy.findByRole('button', { name: 'Expand' }).click()

    renameItem('c.tex', 'd.tex')

    cy.findByRole('treeitem', { name: 'folder' })
    cy.findByRole('treeitem', { name: 'd.tex' })

    cy.get('@renameFile').its('request.body').should('deep.equal', {
      name: 'd.tex',
    })
  })

  it('reverts rename on error', function () {
    cy.intercept('/project/*/doc/*/rename', { statusCode: 500 })

    renameItem('a.tex', 'b.tex')

    cy.findByRole('treeitem', { name: 'a.tex' })
  })

  it('shows error modal on invalid filename', function () {
    renameItem('a.tex', '///')

    cy.findByText('File name is empty or contains invalid characters', {
      selector: '[role="alert"]',
    })
  })

  it('shows error modal on duplicate filename', function () {
    renameItem('a.tex', 'folder')

    cy.findByText('A file or folder with this name already exists', {
      selector: '[role="alert"]',
    })
  })

  it('shows error modal on duplicate filename in subfolder', function () {
    cy.findByRole('button', { name: 'Expand' }).click()

    renameItem('c.tex', 'e.tex')

    cy.findByText('A file or folder with this name already exists', {
      selector: '[role="alert"]',
    })
  })

  it('shows error modal on blocked filename', function () {
    renameItem('a.tex', 'prototype')

    cy.findByText('This file name is blocked.', {
      selector: '[role="alert"]',
    })
  })

  describe('via socket event', function () {
    it('renames doc', function () {
      cy.findByRole('treeitem', { name: 'a.tex' })

      cy.then(() => {
        socket.emitToClient('reciveEntityRename', '456def', 'socket.tex')
      })

      cy.findByRole('treeitem', { name: 'socket.tex' })
    })
  })

  function renameItem(from: string, to: string) {
    cy.findByRole('treeitem', { name: from }).click()
    cy.findByRole('button', { name: `Open ${from} action menu` }).click()
    cy.findByRole('menuitem', { name: 'Rename' }).click()
    cy.findByRole('textbox').clear()
    cy.findByRole('textbox').type(to + '{enter}')
  }
})
