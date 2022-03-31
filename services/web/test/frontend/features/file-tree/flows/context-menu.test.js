import { expect } from 'chai'
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

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-user', { id: 'user1' })
  })

  afterEach(function () {
    onSelect.reset()
    onInit.reset()
    cleanUpContext()
    window.metaAttributesCache = new Map()
  })

  it('opens on contextMenu event', async function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]
    renderWithEditorContext(
      <FileTreeRoot
        refProviders={{}}
        reindexReferences={() => null}
        setRefProviderEnabled={() => null}
        setStartedFreeTrial={() => null}
        onSelect={onSelect}
        onInit={onInit}
        isConnected
      />,
      {
        rootFolder,
        projectId: '123abc',
        rootDocId: '456def',
      }
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
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]
    renderWithEditorContext(
      <FileTreeRoot
        refProviders={{}}
        reindexReferences={() => null}
        setRefProviderEnabled={() => null}
        setStartedFreeTrial={() => null}
        onSelect={onSelect}
        onInit={onInit}
        isConnected
      />,
      {
        rootFolder,
        projectId: '123abc',
        rootDocId: '456def',
        permissionsLevel: 'readOnly',
      }
    )
    const treeitem = screen.getByRole('button', { name: 'main.tex' })

    fireEvent.contextMenu(treeitem)

    expect(screen.queryByRole('menu')).to.not.exist
  })
})
