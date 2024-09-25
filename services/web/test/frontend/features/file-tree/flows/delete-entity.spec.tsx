import '../../../helpers/bootstrap-3'
import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SocketIOMock } from '@/ide/connection/SocketIoShim'

describe('FileTree Delete Entity Flow', function () {
  beforeEach(function () {
    cy.window().then(win => {
      win.metaAttributesCache.set('ol-user', { id: 'user1' })
    })
  })

  describe('single entity', function () {
    let socket: SocketIOMock
    beforeEach(function () {
      socket = new SocketIOMock()
      const rootFolder = [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [
            { _id: '123abc', name: 'foo.tex' },
            { _id: '456def', name: 'main.tex' },
          ],
          folders: [],
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
              onSelect={cy.stub()}
              onInit={cy.stub()}
              isConnected
            />
          </EditorProviders>
        </div>
      )

      cy.findByRole('treeitem', { name: 'main.tex' }).click()
      cy.findByRole('button', { name: 'Open main.tex action menu' }).click()
      cy.findByRole('menuitem', { name: 'Delete' }).click()
    })

    it('removes item', function () {
      cy.intercept('delete', '/project/*/doc/*', { statusCode: 204 }).as(
        'deleteDoc'
      )

      // check that the confirmation modal is open
      cy.findByText(
        'Are you sure you want to permanently delete the following files?'
      )

      cy.findByRole('button', { name: 'Delete' }).click()

      cy.wait('@deleteDoc')

      cy.then(() => {
        socket.emitToClient('removeEntity', '456def')
      })

      cy.findByRole('treeitem', {
        name: 'main.tex',
        hidden: true, // treeitem might be hidden behind the modal
      }).should('not.exist')

      cy.findByRole('treeitem', {
        name: 'main.tex',
      }).should('not.exist')

      // check that the confirmation modal is closed
      cy.findByText(
        'Are you sure you want to permanently delete the following files?'
      ).should('not.exist')

      cy.get('@deleteDoc.all').should('have.length', 1)
    })

    it('continues delete on 404s', function () {
      cy.intercept('delete', '/project/*/doc/*', { statusCode: 404 }).as(
        'deleteDoc'
      )

      // check that the confirmation modal is open
      cy.findByText(
        'Are you sure you want to permanently delete the following files?'
      )

      cy.findByRole('button', { name: 'Delete' }).click()

      cy.then(() => {
        socket.emitToClient('removeEntity', '456def')
      })

      cy.findByRole('treeitem', {
        name: 'main.tex',
        hidden: true, // treeitem might be hidden behind the modal
      }).should('not.exist')

      cy.findByRole('treeitem', {
        name: 'main.tex',
      }).should('not.exist')

      // check that the confirmation modal is closed
      // is not, the 404 probably triggered a bug
      cy.findByText(
        'Are you sure you want to permanently delete the following files?'
      ).should('not.exist')
    })

    it('aborts delete on error', function () {
      cy.intercept('delete', '/project/*/doc/*', { statusCode: 500 }).as(
        'deleteDoc'
      )

      cy.findByRole('button', { name: 'Delete' }).click()

      // The modal should still be open, but the file should not be deleted
      cy.findByRole('treeitem', { name: 'main.tex', hidden: true })
    })
  })

  describe('folders', function () {
    let socket: SocketIOMock
    beforeEach(function () {
      socket = new SocketIOMock()
      const rootFolder = [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [{ _id: '456def', name: 'main.tex' }],
          folders: [
            {
              _id: '123abc',
              name: 'folder',
              docs: [],
              folders: [],
              fileRefs: [{ _id: '789ghi', name: 'my.bib' }],
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
              onSelect={cy.stub()}
              onInit={cy.stub()}
              isConnected
            />
          </EditorProviders>
        </div>
      )

      cy.findByRole('button', { name: 'Expand' }).click()
      cy.findByRole('treeitem', { name: 'main.tex' }).click()
      cy.findByRole('treeitem', { name: 'my.bib' }).click({
        ctrlKey: true,
        cmdKey: true,
      })

      cy.then(() => {
        socket.emitToClient('removeEntity', '123abc')
      })
    })

    it('removes the folder', function () {
      cy.findByRole('treeitem', { name: 'folder' }).should('not.exist')
    })

    it('leaves the main file selected', function () {
      cy.findByRole('treeitem', { name: 'main.tex', selected: true })
    })

    it('unselect the child entity', function () {
      // as a proxy to check that the child entity has been unselect we start
      // a delete and ensure the modal is displayed (the cancel button can be
      // selected) This is needed to make sure the test fail.
      cy.findByRole('button', { name: 'Open main.tex action menu' }).click()
      cy.findByRole('menuitem', { name: 'Delete' }).click()
      cy.findByRole('button', { name: 'Cancel' })
    })
  })

  describe('multiple entities', function () {
    let socket: SocketIOMock
    beforeEach(function () {
      socket = new SocketIOMock()
      const rootFolder = [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [{ _id: '456def', name: 'main.tex' }],
          folders: [],
          fileRefs: [{ _id: '789ghi', name: 'my.bib' }],
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
              onSelect={cy.stub()}
              onInit={cy.stub()}
              isConnected
            />
          </EditorProviders>
        </div>
      )

      // select two files
      cy.findByRole('treeitem', { name: 'main.tex' }).click()
      cy.findByRole('treeitem', { name: 'my.bib' }).click({
        ctrlKey: true,
        cmdKey: true,
      })

      // open the context menu
      cy.findByRole('button', { name: 'my.bib' }).trigger('contextmenu')

      // make sure the menu has opened, with only a "Delete" item (as multiple files are selected)
      cy.findByRole('menu')
      cy.findAllByRole('menuitem').should('have.length', 1)

      // select the Delete menu item
      cy.findByRole('menuitem', { name: 'Delete' }).click()
    })

    it('removes all items and reindexes references after deleting .bib file', function () {
      cy.intercept('delete', '/project/123abc/doc/456def', {
        statusCode: 204,
      }).as('deleteDoc')

      cy.intercept('delete', '/project/123abc/file/789ghi', {
        statusCode: 204,
      }).as('deleteFile')

      cy.findByRole('button', { name: 'Delete' }).click()

      cy.then(() => {
        socket.emitToClient('removeEntity', '456def')
        socket.emitToClient('removeEntity', '789ghi')
      })

      for (const name of ['main.tex', 'my.bib']) {
        for (const hidden of [true, false]) {
          cy.findByRole('treeitem', { name, hidden }).should('not.exist')
        }
      }

      // check that the confirmation modal is closed
      cy.findByText('Are you sure').should('not.exist')

      cy.get('@deleteDoc.all').should('have.length', 1)
      cy.get('@deleteFile.all').should('have.length', 1)
    })
  })
})
