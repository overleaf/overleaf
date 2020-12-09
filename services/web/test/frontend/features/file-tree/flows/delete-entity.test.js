import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import MockedSocket from 'socket.io-mock'

import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'

describe('FileTree Delete Entity Flow', function() {
  const onSelect = sinon.stub()
  const onInit = sinon.stub()

  beforeEach(function() {
    window._ide = {
      socket: new MockedSocket()
    }
  })

  afterEach(function() {
    fetchMock.restore()
    onSelect.reset()
    onInit.reset()
    delete window._ide
  })

  describe('single entity', function() {
    beforeEach(function() {
      const rootFolder = [
        {
          _id: 'root-folder-id',
          docs: [{ _id: '456def', name: 'main.tex' }],
          folders: [],
          fileRefs: []
        }
      ]
      render(
        <FileTreeRoot
          rootFolder={rootFolder}
          projectId="123abc"
          hasWritePermissions
          onSelect={onSelect}
          onInit={onInit}
        />
      )

      const treeitem = screen.getByRole('treeitem', { name: 'main.tex' })
      fireEvent.click(treeitem)

      const deleteButton = screen.getByRole('menuitem', { name: 'Delete' })
      fireEvent.click(deleteButton)
    })

    it('removes item', async function() {
      const fetchMatcher = /\/project\/\w+\/doc\/\w+/
      fetchMock.delete(fetchMatcher, 204)

      const modalDeleteButton = getModalDeleteButton()
      fireEvent.click(modalDeleteButton)

      window._ide.socket.socketClient.emit('removeEntity', '456def')

      await waitFor(() => {
        expect(
          screen.queryByRole('treeitem', {
            name: 'main.tex',
            hidden: true // treeitem might be hidden behind the modal
          })
        ).to.not.exist

        expect(
          screen.queryByRole('treeitem', {
            name: 'main.tex'
          })
        ).to.not.exist
      })

      const [lastFetchPath] = fetchMock.lastCall(fetchMatcher)
      expect(lastFetchPath).to.equal('/project/123abc/doc/456def')
    })

    it('continues delete on 404s', async function() {
      fetchMock.delete(/\/project\/\w+\/doc\/\w+/, 404)

      const modalDeleteButton = getModalDeleteButton()
      fireEvent.click(modalDeleteButton)

      window._ide.socket.socketClient.emit('removeEntity', '456def')

      await waitFor(() => {
        expect(
          screen.queryByRole('treeitem', {
            name: 'main.tex',
            hidden: true // treeitem might be hidden behind the modal
          })
        ).to.not.exist

        expect(
          screen.queryByRole('treeitem', {
            name: 'main.tex'
          })
        ).to.not.exist
      })
    })

    it('aborts delete on error', async function() {
      const fetchMatcher = /\/project\/\w+\/doc\/\w+/
      fetchMock.delete(fetchMatcher, 500)

      const modalDeleteButton = getModalDeleteButton()
      fireEvent.click(modalDeleteButton)

      // The modal should still be open, but the file should not be deleted
      await screen.findByRole('treeitem', { name: 'main.tex', hidden: true })
    })
  })

  describe('multiple entities', function() {
    beforeEach(function() {
      const rootFolder = [
        {
          _id: 'root-folder-id',
          docs: [{ _id: '456def', name: 'main.tex' }],
          folders: [],
          fileRefs: [{ _id: '789ghi', name: 'my.bib' }]
        }
      ]
      render(
        <FileTreeRoot
          rootFolder={rootFolder}
          projectId="123abc"
          hasWritePermissions
          onSelect={onSelect}
          onInit={onInit}
        />
      )

      const treeitemDoc = screen.getByRole('treeitem', { name: 'main.tex' })
      fireEvent.click(treeitemDoc)
      const treeitemFile = screen.getByRole('treeitem', { name: 'my.bib' })
      fireEvent.click(treeitemFile, { ctrlKey: true })

      const deleteButton = screen.getAllByRole('menuitem', {
        name: 'Delete'
      })[0]
      fireEvent.click(deleteButton)
    })

    it('removes all items', async function() {
      const fetchMatcher = /\/project\/\w+\/(doc|file)\/\w+/
      fetchMock.delete(fetchMatcher, 204)

      const modalDeleteButton = getModalDeleteButton()
      fireEvent.click(modalDeleteButton)

      window._ide.socket.socketClient.emit('removeEntity', '456def')
      window._ide.socket.socketClient.emit('removeEntity', '789ghi')

      await waitFor(() => {
        for (const name of ['main.tex', 'my.bib']) {
          expect(
            screen.queryByRole('treeitem', {
              name,
              hidden: true // treeitem might be hidden behind the modal
            })
          ).to.not.exist

          expect(
            screen.queryByRole('treeitem', {
              name
            })
          ).to.not.exist
        }
      })

      const [firstFetchPath, secondFetchPath] = fetchMock
        .calls()
        .map(([url]) => url)
      expect(firstFetchPath).to.equal('/project/123abc/doc/456def')
      expect(secondFetchPath).to.equal('/project/123abc/file/789ghi')
    })
  })

  function getModalDeleteButton() {
    return screen.getAllByRole('button', {
      name: 'Delete',
      hidden: true // FIXME: modal should not be hidden but it has the aria-hidden label due to a react-bootstrap bug
    })[1] // the first matched button is the toolbar button
  }
})
