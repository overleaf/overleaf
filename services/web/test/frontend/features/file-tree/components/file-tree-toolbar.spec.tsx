import FileTreeToolbar from '../../../../../frontend/js/features/file-tree/components/file-tree-toolbar'
import { EditorProviders } from '../../../helpers/editor-providers'
import { makeEditorManagerProviderWithStaleDocs } from '../../ide-react/helpers/editor-manager-provider-with-stale-docs'
import { FileTreeProvider } from '../helpers/file-tree-provider'

describe('<FileTreeToolbar/>', function () {
  it('without selected files', function () {
    cy.mount(
      <EditorProviders rootDocId="">
        <FileTreeProvider>
          <FileTreeToolbar />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findAllByRole('button', { name: 'New file' })
    cy.findAllByRole('button', { name: 'New folder' })
    cy.findAllByRole('button', { name: 'Upload' })
    cy.findAllByRole('button', { name: 'Rename' }).should('not.exist')
    cy.findAllByRole('button', { name: 'Delete' }).should('not.exist')
  })

  it('read-only', function () {
    cy.mount(
      <EditorProviders permissionsLevel="readOnly">
        <FileTreeProvider>
          <FileTreeToolbar />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findAllByRole('button').should('have.length', 1)
  })

  it('with one selected file', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '456def', name: 'main.tex' }],
        folders: [],
        fileRefs: [],
      },
    ]

    cy.mount(
      <EditorProviders rootDocId="456def" rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <FileTreeToolbar />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findAllByRole('button', { name: 'New file' })
    cy.findAllByRole('button', { name: 'New folder' })
    cy.findAllByRole('button', { name: 'Upload' })
    cy.findAllByRole('button', { name: 'Close' })
  })

  describe('Network stall', function () {
    beforeEach(function () {
      cy.clock()
      cy.window().then(win => {
        win.metaAttributesCache.set('ol-splitTestVariants', {
          'intermittent-connection-improvements': 'enabled',
        })
      })
      cy.then(() => {
        const now = performance.now()
        cy.mount(
          <EditorProviders
            rootDocId=""
            providers={{
              EditorManagerProvider: makeEditorManagerProviderWithStaleDocs(
                now - 11_000
              ),
            }}
          >
            <FileTreeProvider>
              <FileTreeToolbar />
            </FileTreeProvider>
          </EditorProviders>
        )
      })
    })

    it('disables action buttons when saving is stalled', function () {
      cy.tick(1000)
      cy.findByRole('button', { name: 'New file' }).should('be.disabled')
      cy.findByRole('button', { name: 'New folder' }).should('be.disabled')
      cy.findByRole('button', { name: 'Upload' }).should('be.disabled')
    })
  })
})
