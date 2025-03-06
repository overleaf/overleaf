import FileTreeitemInner from '../../../../../../frontend/js/features/file-tree/components/file-tree-item/file-tree-item-inner'
import FileTreeContextMenu from '../../../../../../frontend/js/features/file-tree/components/file-tree-context-menu'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { FileTreeProvider } from '../../helpers/file-tree-provider'

describe('<FileTreeitemInner />', function () {
  describe('menu', function () {
    it('does not display if file is not selected', function () {
      cy.mount(
        <EditorProviders>
          <FileTreeProvider>
            <FileTreeitemInner
              id="123abc"
              name="bar.tex"
              isSelected={false}
              type="doc"
            />
            ,
          </FileTreeProvider>
        </EditorProviders>
      )

      cy.findByRole('menu', { hidden: true }).should('not.exist')
    })
  })

  describe('context menu', function () {
    it('does not display without write permissions', function () {
      cy.mount(
        <EditorProviders permissionsLevel="readOnly">
          <FileTreeProvider>
            <FileTreeitemInner
              id="123abc"
              name="bar.tex"
              isSelected
              type="doc"
            />
            <FileTreeContextMenu />
          </FileTreeProvider>
        </EditorProviders>
      )

      cy.get('div.entity').trigger('contextmenu')
      cy.findByRole('menu', { hidden: true }).should('not.exist')
    })

    it('open / close', function () {
      cy.mount(
        <EditorProviders>
          <FileTreeProvider>
            <FileTreeitemInner
              id="123abc"
              name="bar.tex"
              isSelected
              type="doc"
            />
            <FileTreeContextMenu />
          </FileTreeProvider>
        </EditorProviders>
      )

      cy.findByRole('menu', { hidden: true }).should('not.exist')

      // open the context menu
      cy.get('div.entity').trigger('contextmenu')
      cy.findByRole('menu')

      // close the context menu
      cy.get('div.entity').click()
      cy.findByRole('menu').should('not.exist')
    })
  })

  describe('name', function () {
    it('renders name', function () {
      cy.mount(
        <EditorProviders>
          <FileTreeProvider>
            <FileTreeitemInner
              id="123abc"
              name="bar.tex"
              isSelected
              type="doc"
            />
          </FileTreeProvider>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'bar.tex' })
      cy.findByRole('textbox').should('not.exist')
    })

    it('starts rename on menu item click', function () {
      const rootFolder = [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [{ _id: '123abc', name: 'bar.tex' }],
          folders: [],
          fileRefs: [],
        },
      ]

      cy.mount(
        <EditorProviders rootDocId="123abc" rootFolder={rootFolder as any}>
          <FileTreeProvider>
            <FileTreeitemInner
              id="123abc"
              name="bar.tex"
              isSelected
              type="doc"
            />
            <FileTreeContextMenu />
          </FileTreeProvider>
        </EditorProviders>
      )

      cy.findByRole('button', { name: 'Open bar.tex action menu' }).click()
      cy.findByRole('menuitem', { name: 'Rename' }).click()
      cy.findByRole('button', { name: 'bar.tex' }).should('not.exist')
      cy.findByRole('textbox')
    })
  })
})
