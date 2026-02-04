import FileTreeItemName from '../../../../../../frontend/js/features/file-tree/components/file-tree-item/file-tree-item-name'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { FileTreeProvider } from '../../helpers/file-tree-provider'

describe('<FileTreeItemName />', function () {
  it('renders name', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeItemName
            name="foo.tex"
            isSelected
            setIsDraggable={cy.stub()}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByText('foo.tex')
  })

  it('does not render name as a button', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeItemName
            name="foo.tex"
            isSelected
            setIsDraggable={cy.stub()}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('button').should('not.exist')
  })
})
