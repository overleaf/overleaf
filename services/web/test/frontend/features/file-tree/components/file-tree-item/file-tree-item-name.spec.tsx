import FileTreeItemName from '../../../../../../frontend/js/features/file-tree/components/file-tree-item/file-tree-item-name'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { FileTreeProvider } from '../../helpers/file-tree-provider'

describe('<FileTreeItemName />', function () {
  it('renders name as button', function () {
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

    cy.findByRole('button', { name: 'foo.tex' })
    cy.findByRole('textbox').should('not.exist')
  })

  it("doesn't start renaming on unselected component", function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeItemName
            name="foo.tex"
            isSelected={false}
            setIsDraggable={cy.stub()}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('button').click()
    cy.findByRole('button').click()
    cy.findByRole('button').dblclick()
    cy.findByRole('textbox').should('not.exist')
  })

  it('start renaming on double-click', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeItemName
            name="foo.tex"
            isSelected
            setIsDraggable={cy.stub().as('setIsDraggable')}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('button').click()
    cy.findByRole('button').click()
    cy.findByRole('button').dblclick()
    cy.findByRole('textbox')
    cy.findByRole('button').should('not.exist')
    cy.get('@setIsDraggable').should('have.been.calledWith', false)
  })

  it('cannot start renaming in read-only', function () {
    cy.mount(
      <EditorProviders permissionsLevel="readOnly">
        <FileTreeProvider>
          <FileTreeItemName
            name="foo.tex"
            isSelected
            setIsDraggable={cy.stub()}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('button').click()
    cy.findByRole('button').click()
    cy.findByRole('button').dblclick()

    cy.findByRole('textbox').should('not.exist')
  })

  describe('stop renaming', function () {
    it('on Escape', function () {
      cy.mount(
        <EditorProviders>
          <FileTreeProvider>
            <FileTreeItemName
              name="foo.tex"
              isSelected
              setIsDraggable={cy.stub().as('setIsDraggable')}
            />
          </FileTreeProvider>
        </EditorProviders>
      )

      cy.findByRole('button').click()
      cy.findByRole('button').click()
      cy.findByRole('button').dblclick()

      cy.findByRole('textbox').clear()
      cy.findByRole('textbox').type('bar.tex{esc}')

      cy.findByRole('button', { name: 'foo.tex' })
      cy.get('@setIsDraggable').should('have.been.calledWith', true)
    })
  })
})
