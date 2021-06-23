import { expect } from 'chai'
import { screen, fireEvent } from '@testing-library/react'
import renderWithContext from '../helpers/render-with-context'

import FileTreeDoc from '../../../../../frontend/js/features/file-tree/components/file-tree-doc'

describe('<FileTreeDoc/>', function () {
  it('renders unselected', function () {
    const { container } = renderWithContext(
      <FileTreeDoc name="foo.tex" id="123abc" isLinkedFile={false} />
    )

    screen.getByRole('treeitem', { selected: false })
    expect(container.querySelector('i.linked-file-highlight')).to.not.exist
  })

  it('renders selected', function () {
    renderWithContext(
      <FileTreeDoc name="foo.tex" id="123abc" isLinkedFile={false} />,
      {
        contextProps: {
          rootFolder: [
            {
              docs: [{ _id: '123abc' }],
              fileRefs: [],
              folders: [],
            },
          ],
        },
      }
    )

    const treeitem = screen.getByRole('treeitem', { selected: false })
    fireEvent.click(treeitem)

    screen.getByRole('treeitem', { selected: true })
  })

  it('renders as linked file', function () {
    const { container } = renderWithContext(
      <FileTreeDoc name="foo.tex" id="123abc" isLinkedFile />
    )

    screen.getByRole('treeitem')
    expect(container.querySelector('i.linked-file-highlight')).to.exist
  })

  it('selects', function () {
    renderWithContext(<FileTreeDoc name="foo.tex" id="123abc" expanded />, {
      contextProps: {
        rootFolder: [
          {
            docs: [{ _id: '123abc' }],
            fileRefs: [],
            folders: [],
          },
        ],
      },
    })

    const treeitem = screen.getByRole('treeitem', { selected: false })
    fireEvent.click(treeitem)

    screen.getByRole('treeitem', { selected: true })
  })

  it('multi-selects', function () {
    renderWithContext(<FileTreeDoc name="foo.tex" id="123abc" expanded />, {
      contextProps: {
        rootFolder: [
          {
            docs: [{ _id: '123abc' }],
            fileRefs: [],
            folders: [],
          },
        ],
      },
    })

    const treeitem = screen.getByRole('treeitem')

    fireEvent.click(treeitem, { ctrlKey: true })
    screen.getByRole('treeitem', { selected: true })
  })
})
