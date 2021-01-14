import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'

import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'

describe('FileTree Context Menu Flow', function() {
  const onSelect = sinon.stub()
  const onInit = sinon.stub()

  it('opens on contextMenu event', async function() {
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
        isConnected
      />
    )
    const treeitem = screen.getByRole('button', { name: 'main.tex' })

    expect(screen.getAllByRole('menu').length).to.equal(1) // toolbar

    fireEvent.contextMenu(treeitem)

    expect(screen.getAllByRole('menu').length).to.equal(2) // toolbar + menu
  })

  it("doesn't open in read only mode", async function() {
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
        hasWritePermissions={false}
        rootDocId="456def"
        onSelect={onSelect}
        onInit={onInit}
        isConnected
      />
    )
    const treeitem = screen.getByRole('button', { name: 'main.tex' })

    fireEvent.contextMenu(treeitem)

    expect(screen.queryByRole('menu')).to.not.exist
  })
})
