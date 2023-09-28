import { expect } from 'chai'
import sinon from 'sinon'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import MockedSocket from 'socket.io-mock'

import {
  renderWithEditorContext,
  cleanUpContext,
} from '../../../helpers/render-with-context'
import FileTreeRoot from '../../../../../frontend/js/features/file-tree/components/file-tree-root'

describe('<FileTreeRoot/>', function () {
  const onSelect = sinon.stub()
  const onInit = sinon.stub()

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-user', { id: 'user1' })
  })

  afterEach(function () {
    fetchMock.restore()
    onSelect.reset()
    onInit.reset()
    cleanUpContext()
    global.localStorage.clear()
    window.metaAttributesCache = new Map()
  })

  it('renders', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]
    const { container } = renderWithEditorContext(
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
        features: {},
        permissionsLevel: 'owner',
      }
    )

    screen.queryByRole('tree')
    screen.getByRole('treeitem')
    screen.getByRole('treeitem', { name: 'main.tex', selected: true })
    expect(container.querySelector('.disconnected-overlay')).to.not.exist
  })

  it('renders with invalid selected doc in local storage', async function () {
    global.localStorage.setItem(
      'doc.open_id.123abc',
      JSON.stringify('not-a-valid-id')
    )
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
        features: {},
        permissionsLevel: 'owner',
      }
    )

    // as a proxy to check that the invalid entity ha not been select we start
    // a delete and ensure the modal is displayed (the cancel button can be
    // selected) This is needed to make sure the test fail.
    const treeitemFile = screen.getByRole('treeitem', { name: 'main.tex' })
    fireEvent.click(treeitemFile, { ctrlKey: true })
    const toggleButton = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(toggleButton)
    const deleteButton = screen.getByRole('menuitem', { name: 'Delete' })
    fireEvent.click(deleteButton)
    await waitFor(() => screen.getByRole('button', { name: 'Cancel' }))
  })

  it('renders disconnected overlay', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]

    const { container } = renderWithEditorContext(
      <FileTreeRoot
        onSelect={onSelect}
        onInit={onInit}
        isConnected={false}
        refProviders={{}}
        reindexReferences={() => null}
        setRefProviderEnabled={() => null}
        setStartedFreeTrial={() => null}
      />,
      {
        rootFolder,
        projectId: '123abc',
        rootDocId: '456def',
        features: {},
        permissionsLevel: 'owner',
      }
    )

    expect(container.querySelector('.disconnected-overlay')).to.exist
  })

  it('fire onSelect', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          { _id: '456def', name: 'main.tex' },
          { _id: '789ghi', name: 'other.tex' },
        ],
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
        features: {},
        permissionsLevel: 'readOnly',
      }
    )
    sinon.assert.calledOnce(onSelect)
    sinon.assert.calledWithMatch(onSelect, [
      sinon.match({
        entity: {
          _id: '456def',
          name: 'main.tex',
        },
      }),
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
          name: 'other.tex',
        },
      }),
    ])
  })

  it('listen to editor.openDoc', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          { _id: '456def', name: 'main.tex' },
          { _id: '789ghi', name: 'other.tex' },
        ],
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
        features: {},
        permissionsLevel: 'owner',
      }
    )

    screen.getByRole('treeitem', { name: 'main.tex', selected: true })

    // entities not found should be ignored
    window.dispatchEvent(
      new CustomEvent('editor.openDoc', { detail: 'not-an-id' })
    )
    screen.getByRole('treeitem', { name: 'main.tex', selected: true })

    window.dispatchEvent(
      new CustomEvent('editor.openDoc', { detail: '789ghi' })
    )
    screen.getByRole('treeitem', { name: 'main.tex', selected: false })
    screen.getByRole('treeitem', { name: 'other.tex', selected: true })
  })

  it('only shows a menu button when a single item is selected', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [
          { _id: '456def', name: 'main.tex' },
          { _id: '789ghi', name: 'other.tex' },
        ],
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
        features: {},
        permissionsLevel: 'owner',
      }
    )

    const main = screen.getByRole('treeitem', {
      name: 'main.tex',
      selected: true,
    })
    const other = screen.getByRole('treeitem', {
      name: 'other.tex',
      selected: false,
    })

    // single item selected: menu button is visible
    expect(screen.queryAllByRole('button', { name: 'Menu' })).to.have.length(1)

    // select the other item
    fireEvent.click(other)

    screen.getByRole('treeitem', { name: 'main.tex', selected: false })
    screen.getByRole('treeitem', { name: 'other.tex', selected: true })

    // single item selected: menu button is visible
    expect(screen.queryAllByRole('button', { name: 'Menu' })).to.have.length(1)

    // multi-select the main item
    fireEvent.click(main, { ctrlKey: true })

    screen.getByRole('treeitem', { name: 'main.tex', selected: true })
    screen.getByRole('treeitem', { name: 'other.tex', selected: true })

    // multiple items selected: no menu button is visible
    expect(screen.queryAllByRole('button', { name: 'Menu' })).to.have.length(0)
  })

  describe('when deselecting files', function () {
    beforeEach(function () {
      const rootFolder = [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [{ _id: '123abc', name: 'main.tex' }],
          folders: [
            {
              _id: '789ghi',
              name: 'thefolder',
              docs: [{ _id: '456def', name: 'sub.tex' }],
              fileRefs: [],
              folders: [],
            },
          ],
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
          features: {},
          permissionsLevel: 'owner',
          socket: new MockedSocket(),
        }
      )

      // select the sub file
      const mainDoc = screen.getByRole('treeitem', { name: 'sub.tex' })
      fireEvent.click(mainDoc)
      expect(mainDoc.getAttribute('aria-selected')).to.equal('true')

      // click on empty area
      fireEvent.click(screen.getByTestId('file-tree-inner'))
    })

    afterEach(function () {
      fetchMock.reset()
    })

    it('removes the selected indicator', function () {
      expect(screen.queryByRole('treeitem', { selected: true })).to.be.null
    })

    it('disables the "rename" and "delete" buttons', function () {
      expect(screen.queryByRole('button', { name: 'Rename' })).to.be.null
      expect(screen.queryByRole('button', { name: 'Delete' })).to.be.null
    })

    it('creates new file in the root folder', async function () {
      fetchMock.post('express:/project/:projectId/doc', () => 200)

      fireEvent.click(screen.getByRole('button', { name: /new file/i }))
      fireEvent.click(screen.getByRole('button', { name: /create/i }))

      const socketData = {
        _id: '12345',
        name: 'abcdef.tex',
        docs: [],
        fileRefs: [],
        folders: [],
      }
      window._ide.socket.socketClient.emit(
        'reciveNewDoc',
        'root-folder-id',
        socketData
      )

      await fetchMock.flush(true)

      const newItem = screen.getByRole('treeitem', { name: socketData.name })
      const rootEl = screen.getByTestId('file-tree-list-root')

      expect(newItem.parentNode).to.equal(rootEl)
    })
  })
})
