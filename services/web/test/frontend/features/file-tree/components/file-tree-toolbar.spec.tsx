import '../../../helpers/bootstrap-3'
import FileTreeToolbar from '../../../../../frontend/js/features/file-tree/components/file-tree-toolbar'
import { EditorProviders } from '../../../helpers/editor-providers'
import { FileTreeProvider } from '../helpers/file-tree-provider'

describe('<FileTreeToolbar/>', function () {
  it('without selected files', function () {
    cy.mount(
      <EditorProviders>
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

    cy.findAllByRole('button').should('not.exist')
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
    cy.findAllByRole('button', { name: 'Rename' })
    cy.findAllByRole('button', { name: 'Delete' })
  })
})
