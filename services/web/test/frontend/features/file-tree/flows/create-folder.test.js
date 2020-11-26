import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import MockedSocket from 'socket.io-mock'

import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'

describe('FileTree Create Folder Flow', function() {
  const onSelect = sinon.stub()
  const onInit = sinon.stub()

  beforeEach(function() {
    global.requestAnimationFrame = sinon.stub()
    window._ide = {
      socket: new MockedSocket()
    }
  })

  afterEach(function() {
    delete global.requestAnimationFrame
    fetchMock.restore()
    onSelect.reset()
    onInit.reset()
    delete window._ide
  })

  it('add to root', async function() {
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
        rootDocId="456def"
        onSelect={onSelect}
        onInit={onInit}
      />
    )

    const newFolderName = 'Foo Bar In Root'
    const matcher = /\/project\/\w+\/folder/
    const response = {
      folders: [],
      fileRefs: [],
      docs: [],
      _id: fakeId(),
      name: newFolderName
    }
    fetchMock.post(matcher, response)

    fireCreateFolder(newFolderName)

    const lastCallBody = JSON.parse(fetchMock.lastCall(matcher)[1].body)
    expect(lastCallBody.name).to.equal(newFolderName)
    expect(lastCallBody.parent_folder_id).to.equal('root-folder-id')

    window._ide.socket.socketClient.emit('reciveNewFolder', 'root-folder-id', {
      _id: fakeId(),
      name: newFolderName,
      docs: [],
      fileRefs: [],
      folders: []
    })
    await screen.findByRole('treeitem', { name: newFolderName })
  })

  it('add to folder from folder', async function() {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [],
        folders: [
          {
            _id: '789ghi',
            name: 'thefolder',
            docs: [],
            fileRefs: [],
            folders: []
          }
        ],
        fileRefs: []
      }
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        hasWritePermissions
        rootDocId="789ghi"
        onSelect={onSelect}
        onInit={onInit}
      />
    )

    const expandButton = screen.getByRole('button', { name: 'Expand' })
    fireEvent.click(expandButton)

    const newFolderName = 'Foo Bar In thefolder'
    const matcher = /\/project\/\w+\/folder/
    const response = {
      folders: [],
      fileRefs: [],
      docs: [],
      _id: fakeId(),
      name: newFolderName
    }
    fetchMock.post(matcher, response)

    fireCreateFolder(newFolderName)

    const lastCallBody = JSON.parse(fetchMock.lastCall(matcher)[1].body)
    expect(lastCallBody.name).to.equal(newFolderName)
    expect(lastCallBody.parent_folder_id).to.equal('789ghi')

    window._ide.socket.socketClient.emit('reciveNewFolder', '789ghi', {
      _id: fakeId(),
      name: newFolderName,
      docs: [],
      fileRefs: [],
      folders: []
    })

    // find the created folder
    await screen.findByRole('treeitem', { name: newFolderName })

    // collapse the parent folder; created folder should not be rendered anymore
    fireEvent.click(expandButton)
    expect(screen.queryByRole('treeitem', { name: newFolderName })).to.not.exist
  })

  it('add to folder from child', async function() {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [],
        folders: [
          {
            _id: '789ghi',
            name: 'thefolder',
            docs: [],
            fileRefs: [{ _id: '456def', name: 'sub.tex' }],
            folders: []
          }
        ],
        fileRefs: []
      }
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        hasWritePermissions
        rootDocId="456def"
        onSelect={onSelect}
        onInit={onInit}
      />
    )

    const expandButton = screen.getByRole('button', { name: 'Expand' })
    fireEvent.click(expandButton)

    const newFolderName = 'Foo Bar In thefolder'
    const matcher = /\/project\/\w+\/folder/
    const response = {
      folders: [],
      fileRefs: [],
      docs: [],
      _id: fakeId(),
      name: newFolderName
    }
    fetchMock.post(matcher, response)

    fireCreateFolder(newFolderName)

    const lastCallBody = JSON.parse(fetchMock.lastCall(matcher)[1].body)
    expect(lastCallBody.name).to.equal(newFolderName)
    expect(lastCallBody.parent_folder_id).to.equal('789ghi')

    window._ide.socket.socketClient.emit('reciveNewFolder', '789ghi', {
      _id: fakeId(),
      name: newFolderName,
      docs: [],
      fileRefs: [],
      folders: []
    })

    // find the created folder
    await screen.findByRole('treeitem', { name: newFolderName })

    // collapse the parent folder; created folder should not be rendered anymore
    fireEvent.click(expandButton)
    expect(screen.queryByRole('treeitem', { name: newFolderName })).to.not.exist
  })

  function fireCreateFolder(name) {
    const createFolderButton = screen.getByRole('button', {
      name: 'New Folder'
    })
    fireEvent.click(createFolderButton)

    const input = screen.getByRole('textbox', {
      hidden: true // FIXME: modal should not be hidden but it has the aria-hidden label due to a react-bootstrap bug
    })
    fireEvent.change(input, { target: { value: name } })

    const modalCreateButton = getModalCreateButton()
    fireEvent.click(modalCreateButton)
  }

  function fakeId() {
    return Math.random()
      .toString(16)
      .replace(/0\./, 'random-test-id-')
  }

  function getModalCreateButton() {
    return screen.getAllByRole('button', {
      name: 'Create',
      hidden: true // FIXME: modal should not be hidden but it has the aria-hidden label due to a react-bootstrap bug
    })[0] // the first matched button is the toolbar button
  }
})
