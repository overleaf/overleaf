import FileTreeFolderList from '../../../../../frontend/js/features/file-tree/components/file-tree-folder-list'
import { EditorProviders } from '../../../helpers/editor-providers'
import { FileTreeProvider } from '../helpers/file-tree-provider'

describe('<FileTreeFolderList/>', function () {
  it('renders empty', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeFolderList folders={[]} docs={[]} files={[]} />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('tree')
    cy.findByRole('treeitem').should('not.exist')
  })

  it('renders docs, files and folders', function () {
    cy.mount(
      <EditorProviders>
        <FileTreeProvider>
          <FileTreeFolderList
            folders={[
              {
                _id: '456def',
                name: 'A Folder',
                folders: [],
                docs: [],
                fileRefs: [],
              },
            ]}
            docs={[{ _id: '789ghi', name: 'doc.tex' }]}
            files={[
              {
                _id: '987jkl',
                name: 'file.bib',
                hash: 'some hash',
                linkedFileData: {},
              },
            ]}
          />
        </FileTreeProvider>
      </EditorProviders>
    )

    cy.findByRole('tree')
    cy.findByRole('treeitem', { name: 'A Folder' })
    cy.findByRole('treeitem', { name: 'doc.tex' })
    cy.findByRole('treeitem', { name: 'file.bib' })
  })

  describe('selection and multi-selection', function () {
    it('without write permissions', function () {
      const rootFolder = [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [{ _id: '1' }, { _id: '2' }],
          fileRefs: [],
          folders: [],
        },
      ]

      cy.mount(
        <EditorProviders
          rootFolder={rootFolder as any}
          permissionsLevel="readOnly"
        >
          <FileTreeProvider>
            <FileTreeFolderList
              folders={[]}
              docs={[
                { _id: '1', name: '1.tex' },
                { _id: '2', name: '2.tex' },
              ]}
              files={[]}
            />
          </FileTreeProvider>
        </EditorProviders>
      )

      // click on item 1: it gets selected
      cy.findByRole('treeitem', { name: '1.tex' }).click()
      cy.findByRole('treeitem', { name: '1.tex', selected: true })
      cy.findByRole('treeitem', { name: '2.tex', selected: false })

      // meta-click on item 2: no changes
      cy.findByRole('treeitem', { name: '2.tex' }).click({
        ctrlKey: true,
        cmdKey: true,
      })
      cy.findByRole('treeitem', { name: '1.tex', selected: true })
      cy.findByRole('treeitem', { name: '2.tex', selected: false })
    })

    it('with write permissions', function () {
      const rootFolder = [
        {
          _id: 'root-folder-id',
          name: 'rootFolder',
          docs: [{ _id: '1' }, { _id: '2' }, { _id: '3' }],
          fileRefs: [],
          folders: [],
        },
      ]

      cy.mount(
        <EditorProviders rootFolder={rootFolder as any}>
          <FileTreeProvider>
            <FileTreeFolderList
              folders={[]}
              docs={[
                { _id: '1', name: '1.tex' },
                { _id: '2', name: '2.tex' },
                { _id: '3', name: '3.tex' },
              ]}
              files={[]}
            />
          </FileTreeProvider>
        </EditorProviders>
      )

      // click item 1: it gets selected
      cy.findByRole('treeitem', { name: '1.tex' }).click()
      cy.findByRole('treeitem', { name: '1.tex', selected: true })
      cy.findByRole('treeitem', { name: '2.tex', selected: false })
      cy.findByRole('treeitem', { name: '3.tex', selected: false })

      // click on item 2: it gets selected and item 1 is not selected anymore
      cy.findByRole('treeitem', { name: '2.tex' }).click()
      cy.findByRole('treeitem', { name: '1.tex', selected: false })
      cy.findByRole('treeitem', { name: '2.tex', selected: true })
      cy.findByRole('treeitem', { name: '3.tex', selected: false })

      // meta-click on item 3: it gets selected and item 2 as well
      cy.findByRole('treeitem', { name: '3.tex' }).click({
        ctrlKey: true,
        cmdKey: true,
      })
      cy.findByRole('treeitem', { name: '1.tex', selected: false })
      cy.findByRole('treeitem', { name: '2.tex', selected: true })
      cy.findByRole('treeitem', { name: '3.tex', selected: true })

      // meta-click on item 1: add to selection
      cy.findByRole('treeitem', { name: '1.tex' }).click({
        ctrlKey: true,
        cmdKey: true,
      })
      cy.findByRole('treeitem', { name: '1.tex', selected: true })
      cy.findByRole('treeitem', { name: '2.tex', selected: true })
      cy.findByRole('treeitem', { name: '3.tex', selected: true })

      // meta-click on item 1: remove from selection
      cy.findByRole('treeitem', { name: '1.tex' }).click({
        ctrlKey: true,
        cmdKey: true,
      })
      cy.findByRole('treeitem', { name: '1.tex', selected: false })
      cy.findByRole('treeitem', { name: '2.tex', selected: true })
      cy.findByRole('treeitem', { name: '3.tex', selected: true })

      // meta-click on item 3: remove from selection
      cy.findByRole('treeitem', { name: '3.tex' }).click({
        ctrlKey: true,
        cmdKey: true,
      })
      cy.findByRole('treeitem', { name: '1.tex', selected: false })
      cy.findByRole('treeitem', { name: '2.tex', selected: true })
      cy.findByRole('treeitem', { name: '3.tex', selected: false })

      // meta-click on item 2: cannot unselect
      cy.findByRole('treeitem', { name: '2.tex' }).click({
        ctrlKey: true,
        cmdKey: true,
      })
      cy.findByRole('treeitem', { name: '1.tex', selected: false })
      cy.findByRole('treeitem', { name: '2.tex', selected: true })
      cy.findByRole('treeitem', { name: '3.tex', selected: false })

      // meta-click on item 3: add back to selection
      cy.findByRole('treeitem', { name: '3.tex' }).click({
        ctrlKey: true,
        cmdKey: true,
      })
      cy.findByRole('treeitem', { name: '1.tex', selected: false })
      cy.findByRole('treeitem', { name: '2.tex', selected: true })
      cy.findByRole('treeitem', { name: '3.tex', selected: true })

      // click on item 3: unselect other items
      cy.findByRole('treeitem', { name: '3.tex' }).click()
      cy.findByRole('treeitem', { name: '1.tex', selected: false })
      cy.findByRole('treeitem', { name: '2.tex', selected: false })
      cy.findByRole('treeitem', { name: '3.tex', selected: true })
    })
  })
})
