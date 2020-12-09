import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'
import fetchMock from 'fetch-mock'

import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'

describe('<FileTreeRoot/>', function() {
  const onSelect = sinon.stub()
  const onInit = sinon.stub()

  beforeEach(function() {
    global.requestAnimationFrame = sinon.stub()
  })

  afterEach(function() {
    delete global.requestAnimationFrame
    fetchMock.restore()
    onSelect.reset()
    onInit.reset()
  })

  it('renders', function() {
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
        projectId={'123abc'}
        hasWritePermissions={false}
        rootDocId="456def"
        onSelect={onSelect}
        onInit={onInit}
      />
    )

    screen.queryByRole('tree')
    screen.getByRole('treeitem')
    screen.getByRole('treeitem', { name: 'main.tex', selected: true })
  })

  it('fire onSelect', function() {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [
          { _id: '456def', name: 'main.tex' },
          { _id: '789ghi', name: 'other.tex' }
        ],
        folders: [],
        fileRefs: []
      }
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        rootDocId="456def"
        hasWritePermissions={false}
        onSelect={onSelect}
        onInit={onInit}
      />
    )
    sinon.assert.calledOnce(onSelect)
    sinon.assert.calledWithMatch(onSelect, [
      sinon.match({
        entity: {
          _id: '456def',
          name: 'main.tex'
        }
      })
    ])
    onSelect.reset()

    screen.queryByRole('tree')
    const treeitem = screen.getByRole('treeitem', { name: 'other.tex' })
    fireEvent.click(treeitem)
    sinon.assert.calledOnce(onSelect)
    sinon.assert.calledWithMatch(onSelect, [
      sinon.match({
        entity: {
          _id: '789ghi',
          name: 'other.tex'
        }
      })
    ])
  })

  it('listen to editor.openDoc', function() {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [
          { _id: '456def', name: 'main.tex' },
          { _id: '789ghi', name: 'other.tex' }
        ],
        folders: [],
        fileRefs: []
      }
    ]
    render(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        rootDocId="456def"
        hasWritePermissions={false}
        onSelect={onSelect}
        onInit={onInit}
      />
    )

    screen.getByRole('treeitem', { name: 'main.tex', selected: true })

    window.dispatchEvent(
      new CustomEvent('editor.openDoc', { detail: '789ghi' })
    )
    screen.getByRole('treeitem', { name: 'main.tex', selected: false })
    screen.getByRole('treeitem', { name: 'other.tex', selected: true })
  })
})
