import '../../../helpers/bootstrap-3'
import FileTreeDoc from '../../../../../frontend/js/features/file-tree/components/file-tree-doc'
import { EditorProviders } from '../../../helpers/editor-providers'
import { FileTreeProvider } from '../helpers/file-tree-provider'

describe('<FileTreeDoc/>', function () {
  it('renders unselected', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeDoc name="foo.tex" id="123abc" />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('treeitem', { selected: false })
    cy.get('i.linked-file-highlight').should('not.exist')
  })

  it('renders selected', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '123abc' }],
        fileRefs: [],
        folders: [],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <FileTreeDoc name="foo.tex" id="123abc" />,
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('treeitem', { selected: false }).click()
    cy.findByRole('treeitem', { selected: true })
  })

  it('renders as linked file', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeDoc name="foo.tex" id="123abc" isLinkedFile />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('treeitem')
    cy.get('i.linked-file-highlight')
  })

  it('multi-selects', function () {
    const rootFolder = [
      {
        _id: 'root-folder-id',
        name: 'rootFolder',
        docs: [{ _id: '123abc' }],
        fileRefs: [],
        folders: [],
      },
    ]

    cy.mount(
      <EditorProviders rootFolder={rootFolder as any}>
        <FileTreeProvider>
          <FileTreeDoc name="foo.tex" id="123abc" />,
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('treeitem').click({ ctrlKey: true, cmdKey: true })
    cy.findByRole('treeitem', { selected: true })
  })
})
