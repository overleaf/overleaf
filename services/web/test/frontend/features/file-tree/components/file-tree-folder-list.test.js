import { expect } from 'chai'
import { screen, fireEvent } from '@testing-library/react'
import renderWithContext from '../helpers/render-with-context'

import FileTreeFolderList from '../../../../../frontend/js/features/file-tree/components/file-tree-folder-list'

describe('<FileTreeFolderList/>', function () {
  it('renders empty', function () {
    renderWithContext(<FileTreeFolderList folders={[]} docs={[]} files={[]} />)

    screen.queryByRole('tree')
    expect(screen.queryByRole('treeitem')).to.not.exist
  })

  it('renders docs, files and folders', function () {
    const aFolder = {
      _id: '456def',
      name: 'A Folder',
      folders: [],
      docs: [],
      fileRefs: [],
    }
    const aDoc = { _id: '789ghi', name: 'doc.tex', linkedFileData: {} }
    const aFile = { _id: '987jkl', name: 'file.bib', linkedFileData: {} }
    renderWithContext(
      <FileTreeFolderList folders={[aFolder]} docs={[aDoc]} files={[aFile]} />
    )

    screen.queryByRole('tree')
    screen.queryByRole('treeitem', { name: 'A Folder' })
    screen.queryByRole('treeitem', { name: 'doc.tex' })
    screen.queryByRole('treeitem', { name: 'file.bib' })
  })

  describe('selection and multi-selection', function () {
    it('without write permissions', function () {
      const docs = [
        { _id: '1', name: '1.tex' },
        { _id: '2', name: '2.tex' },
      ]
      renderWithContext(
        <FileTreeFolderList folders={[]} docs={docs} files={[]} />,
        {
          contextProps: {
            permissionsLevel: 'readOnly',
            projectRootFolder: [
              {
                _id: 'root-folder-id',
                name: 'rootFolder',
                docs: [{ _id: '1' }, { _id: '2' }],
                fileRefs: [],
                folders: [],
              },
            ],
          },
        }
      )

      const treeitem1 = screen.getByRole('treeitem', { name: '1.tex' })
      const treeitem2 = screen.getByRole('treeitem', { name: '2.tex' })

      // click on item 1: it gets selected
      fireEvent.click(treeitem1)
      screen.getByRole('treeitem', { name: '1.tex', selected: true })
      screen.getByRole('treeitem', { name: '2.tex', selected: false })

      // meta-click on item 2: no changes
      fireEvent.click(treeitem2, { ctrlKey: true })
      screen.getByRole('treeitem', { name: '1.tex', selected: true })
      screen.getByRole('treeitem', { name: '2.tex', selected: false })
    })

    it('with write permissions', function () {
      const docs = [
        { _id: '1', name: '1.tex' },
        { _id: '2', name: '2.tex' },
        { _id: '3', name: '3.tex' },
      ]
      renderWithContext(
        <FileTreeFolderList folders={[]} docs={docs} files={[]} />,
        {
          contextProps: {
            projectRootFolder: [
              {
                _id: 'root-folder-id',
                name: 'rootFolder',
                docs: [{ _id: '1' }, { _id: '2' }, { _id: '3' }],
                fileRefs: [],
                folders: [],
              },
            ],
          },
        }
      )

      const treeitem1 = screen.getByRole('treeitem', { name: '1.tex' })
      const treeitem2 = screen.getByRole('treeitem', { name: '2.tex' })
      const treeitem3 = screen.getByRole('treeitem', { name: '3.tex' })

      // click item 1: it gets selected
      fireEvent.click(treeitem1)
      screen.getByRole('treeitem', { name: '1.tex', selected: true })
      screen.getByRole('treeitem', { name: '2.tex', selected: false })
      screen.getByRole('treeitem', { name: '3.tex', selected: false })

      // click on item 2: it gets selected and item 1 is not selected anymore
      fireEvent.click(treeitem2)
      screen.getByRole('treeitem', { name: '1.tex', selected: false })
      screen.getByRole('treeitem', { name: '2.tex', selected: true })
      screen.getByRole('treeitem', { name: '3.tex', selected: false })

      // meta-click on item 3: it gets selected and item 2 as well
      fireEvent.click(treeitem3, { ctrlKey: true })
      screen.getByRole('treeitem', { name: '1.tex', selected: false })
      screen.getByRole('treeitem', { name: '2.tex', selected: true })
      screen.getByRole('treeitem', { name: '3.tex', selected: true })

      // meta-click on item 1: add to selection
      fireEvent.click(treeitem1, { ctrlKey: true })
      screen.getByRole('treeitem', { name: '1.tex', selected: true })
      screen.getByRole('treeitem', { name: '2.tex', selected: true })
      screen.getByRole('treeitem', { name: '3.tex', selected: true })

      // meta-click on item 1: remove from selection
      fireEvent.click(treeitem1, { ctrlKey: true })
      screen.getByRole('treeitem', { name: '1.tex', selected: false })
      screen.getByRole('treeitem', { name: '2.tex', selected: true })
      screen.getByRole('treeitem', { name: '3.tex', selected: true })

      // meta-click on item 3: remove from selection
      fireEvent.click(treeitem3, { ctrlKey: true })
      screen.getByRole('treeitem', { name: '1.tex', selected: false })
      screen.getByRole('treeitem', { name: '2.tex', selected: true })
      screen.getByRole('treeitem', { name: '3.tex', selected: false })

      // meta-click on item 2: cannot unselect
      fireEvent.click(treeitem2, { ctrlKey: true })
      screen.getByRole('treeitem', { name: '1.tex', selected: false })
      screen.getByRole('treeitem', { name: '2.tex', selected: true })
      screen.getByRole('treeitem', { name: '3.tex', selected: false })

      // meta-click on item 3: add back to selection
      fireEvent.click(treeitem3, { ctrlKey: true })
      screen.getByRole('treeitem', { name: '1.tex', selected: false })
      screen.getByRole('treeitem', { name: '2.tex', selected: true })
      screen.getByRole('treeitem', { name: '3.tex', selected: true })

      // click on item 3: unselect other items
      fireEvent.click(treeitem3)
      screen.getByRole('treeitem', { name: '1.tex', selected: false })
      screen.getByRole('treeitem', { name: '2.tex', selected: false })
      screen.getByRole('treeitem', { name: '3.tex', selected: true })
    })
  })
})
