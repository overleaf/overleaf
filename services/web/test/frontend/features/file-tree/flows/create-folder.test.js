import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import MockedSocket from 'socket.io-mock'

import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'

describe('FileTree Create Folder Flow', function () {
  const onSelect = sinon.stub()
  const onInit = sinon.stub()

  beforeEach(function () {
    global.requestAnimationFrame = sinon.stub()
    window._ide = {
      socket: new MockedSocket(),
    }
  })

  afterEach(function () {
    delete global.requestAnimationFrame
    fetchMock.restore()
    onSelect.reset()
    onInit.reset()
    delete window._ide
  })

  it('add to root when no files are selected', async function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        hasWritePermissions
        userHasFeature={() => true}
        refProviders={{}}
        reindexReferences={() => null}
        setRefProviderEnabled={() => null}
        setStartedFreeTrial={() => null}
        onSelect={onSelect}
        onInit={onInit}
        isConnected
      />
    )

    const newFolderName = 'Foo Bar In Root'
    const matcher = /\/project\/\w+\/folder/
    const response = {
      folders: [],
      fileRefs: [],
      docs: [],
      _id: fakeId(),
      name: newFolderName,
    }
    fetchMock.post(matcher, response)

    await fireCreateFolder(newFolderName)

    const lastCallBody = JSON.parse(fetchMock.lastCall(matcher)[1].body)
    expect(lastCallBody.name).to.equal(newFolderName)
    expect(lastCallBody.parent_folder_id).to.equal('root-folder-id')

    window._ide.socket.socketClient.emit('reciveNewFolder', 'root-folder-id', {
      _id: fakeId(),
      name: newFolderName,
      docs: [],
      fileRefs: [],
      folders: [],
    })
    await screen.findByRole('treeitem', { name: newFolderName })
  })

  it('add to folder from folder', async function () {
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
            folders: [],
          },
        ],
        fileRefs: [],
      },
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        hasWritePermissions
        userHasFeature={() => true}
        refProviders={{}}
        reindexReferences={() => null}
        setRefProviderEnabled={() => null}
        setStartedFreeTrial={() => null}
        rootDocId="789ghi"
        onSelect={onSelect}
        onInit={onInit}
        isConnected
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
      name: newFolderName,
    }
    fetchMock.post(matcher, response)

    await fireCreateFolder(newFolderName)

    const lastCallBody = JSON.parse(fetchMock.lastCall(matcher)[1].body)
    expect(lastCallBody.name).to.equal(newFolderName)
    expect(lastCallBody.parent_folder_id).to.equal('789ghi')

    window._ide.socket.socketClient.emit('reciveNewFolder', '789ghi', {
      _id: fakeId(),
      name: newFolderName,
      docs: [],
      fileRefs: [],
      folders: [],
    })

    // find the created folder
    await screen.findByRole('treeitem', { name: newFolderName })

    // collapse the parent folder; created folder should not be rendered anymore
    fireEvent.click(expandButton)
    expect(screen.queryByRole('treeitem', { name: newFolderName })).to.not.exist
  })

  it('add to folder from child', async function () {
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
            folders: [],
          },
        ],
        fileRefs: [],
      },
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        hasWritePermissions
        userHasFeature={() => true}
        refProviders={{}}
        reindexReferences={() => null}
        setRefProviderEnabled={() => null}
        setStartedFreeTrial={() => null}
        rootDocId="456def"
        onSelect={onSelect}
        onInit={onInit}
        isConnected
      />
    )

    const newFolderName = 'Foo Bar In thefolder'
    const matcher = /\/project\/\w+\/folder/
    const response = {
      folders: [],
      fileRefs: [],
      docs: [],
      _id: fakeId(),
      name: newFolderName,
    }
    fetchMock.post(matcher, response)

    await fireCreateFolder(newFolderName)

    const lastCallBody = JSON.parse(fetchMock.lastCall(matcher)[1].body)
    expect(lastCallBody.name).to.equal(newFolderName)
    expect(lastCallBody.parent_folder_id).to.equal('789ghi')

    window._ide.socket.socketClient.emit('reciveNewFolder', '789ghi', {
      _id: fakeId(),
      name: newFolderName,
      docs: [],
      fileRefs: [],
      folders: [],
    })

    // find the created folder
    await screen.findByRole('treeitem', { name: newFolderName })

    // collapse the parent folder; created folder should not be rendered anymore
    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.queryByRole('treeitem', { name: newFolderName })).to.not.exist
  })

  it('prevents adding duplicate or invalid names', async function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [{ _id: '456def', name: 'existingFile' }],
        folders: [],
        fileRefs: [],
      },
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        hasWritePermissions
        userHasFeature={() => true}
        refProviders={{}}
        reindexReferences={() => null}
        setRefProviderEnabled={() => null}
        setStartedFreeTrial={() => null}
        rootDocId="456def"
        onSelect={onSelect}
        onInit={onInit}
        isConnected
      />
    )

    var newFolderName = 'existingFile'

    await fireCreateFolder(newFolderName)

    expect(fetchMock.called()).to.be.false

    await screen.findByRole('alert', {
      name: 'A file or folder with this name already exists',
      hidden: true,
    })

    newFolderName = 'in/valid '
    setFolderName(newFolderName)
    await screen.findByRole('alert', {
      name: 'File name is empty or contains invalid characters',
      hidden: true,
    })
  })

  async function fireCreateFolder(name) {
    const createFolderButton = screen.getByRole('button', {
      name: 'New Folder',
    })
    fireEvent.click(createFolderButton)

    setFolderName(name)

    const modalCreateButton = await getModalCreateButton()
    fireEvent.click(modalCreateButton)
  }

  function setFolderName(name) {
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: name } })
  }

  function fakeId() {
    return Math.random().toString(16).replace(/0\./, 'random-test-id-')
  }

  async function getModalCreateButton() {
    return waitFor(() => screen.getByRole('button', { name: 'Create' }))
  }
})
