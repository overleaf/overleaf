import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, fireEvent } from '@testing-library/react'

import {
  renderWithEditorContext,
  cleanUpContext,
} from '../../../helpers/render-with-context'
import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'

describe('FileTree Context Menu Flow', function () {
  const onSelect = sinon.stub()
  const onInit = sinon.stub()

  afterEach(function () {
    onSelect.reset()
    onInit.reset()
    cleanUpContext()
  })

  it('opens on contextMenu event', async function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]
    renderWithEditorContext(
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
    const treeitem = screen.getByRole('button', { name: 'main.tex' })

    expect(screen.queryByRole('menu')).to.be.null

    fireEvent.contextMenu(treeitem)

    screen.getByRole('menu')
  })

  it("doesn't open in read only mode", async function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]
    renderWithEditorContext(
      <FileTreeRoot
        rootFolder={rootFolder}
        projectId="123abc"
        hasWritePermissions={false}
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
    const treeitem = screen.getByRole('button', { name: 'main.tex' })

    fireEvent.contextMenu(treeitem)

    expect(screen.queryByRole('menu')).to.not.exist
  })
})
