import { expect } from 'chai'
import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import renderWithContext from '../helpers/render-with-context'

import FileTreeFolder from '../../../../../frontend/js/features/file-tree/components/file-tree-folder'

describe('<FileTreeFolder/>', function() {
  beforeEach(function() {
    global.localStorage.clear()
  })

  it('renders unselected', function() {
    renderWithContext(
      <FileTreeFolder
        name="foo"
        id="123abc"
        folders={[]}
        docs={[]}
        files={[]}
      />
    )

    screen.getByRole('treeitem', { selected: false })
    expect(screen.queryByRole('tree')).to.not.exist
  })

  it('renders selected', function() {
    renderWithContext(
      <FileTreeFolder
        name="foo"
        id="123abc"
        folders={[]}
        docs={[]}
        files={[]}
      />,
      {
        contextProps: {
          rootFolder: [
            {
              docs: [{ _id: '123abc' }],
              fileRefs: [],
              folders: []
            }
          ]
        }
      }
    )

    const treeitem = screen.getByRole('treeitem', { selected: false })
    fireEvent.click(treeitem)

    screen.getByRole('treeitem', { selected: true })
    screen.getByRole('menuitem', { name: 'Rename' })
    screen.getByRole('menuitem', { name: 'Delete' })
    screen.getByRole('menuitem', { name: 'New File' })
    screen.getByRole('menuitem', { name: 'New Folder' })
    screen.getByRole('menuitem', { name: 'Upload' })

    screen.getByRole('treeitem', { selected: true })
    expect(screen.queryByRole('tree')).to.not.exist
  })

  it('expands', function() {
    renderWithContext(
      <FileTreeFolder
        name="foo"
        id="123abc"
        folders={[]}
        docs={[]}
        files={[]}
      />,
      {
        contextProps: {
          rootFolder: [
            {
              docs: [{ _id: '123abc' }],
              fileRefs: [],
              folders: []
            }
          ]
        }
      }
    )

    screen.getByRole('treeitem')
    const expandButton = screen.getByRole('button', { name: 'Expand' })

    fireEvent.click(expandButton)
    screen.getByRole('tree')
  })

  it('saves the expanded state for the next render', function() {
    const { unmount } = renderWithContext(
      <FileTreeFolder
        name="foo"
        id="123abc"
        folders={[]}
        docs={[]}
        files={[]}
      />,
      {
        contextProps: {
          rootFolder: [
            {
              docs: [{ _id: '123abc' }],
              fileRefs: [],
              folders: []
            }
          ]
        }
      }
    )

    expect(screen.queryByRole('tree')).to.not.exist

    const expandButton = screen.getByRole('button', { name: 'Expand' })
    fireEvent.click(expandButton)
    screen.getByRole('tree')

    unmount()

    renderWithContext(
      <FileTreeFolder
        name="foo"
        id="123abc"
        folders={[]}
        docs={[]}
        files={[]}
      />
    )

    screen.getByRole('tree')
  })
})
