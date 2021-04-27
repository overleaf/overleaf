import { expect } from 'chai'
import React from 'react'
import { screen } from '@testing-library/react'
import renderWithContext from '../helpers/render-with-context'

import FileTreeToolbar from '../../../../../frontend/js/features/file-tree/components/file-tree-toolbar'

describe('<FileTreeToolbar/>', function () {
  beforeEach(function () {
    global.localStorage.clear()
  })

  it('without selected files', function () {
    renderWithContext(<FileTreeToolbar />)

    screen.getByRole('button', { name: 'New File' })
    screen.getByRole('button', { name: 'New Folder' })
    screen.getByRole('button', { name: 'Upload' })
    expect(screen.queryByRole('button', { name: 'Rename' })).to.not.exist
    expect(screen.queryByRole('button', { name: 'Delete' })).to.not.exist
  })

  it('read-only', function () {
    renderWithContext(<FileTreeToolbar />, {
      contextProps: { hasWritePermissions: false },
    })

    expect(screen.queryByRole('button')).to.not.exist
  })

  it('with one selected file', function () {
    renderWithContext(<FileTreeToolbar />, {
      contextProps: {
        rootDocId: '456def',
        rootFolder: [
          {
            _id: 'root-folder-id',
            docs: [{ _id: '456def', name: 'main.tex' }],
            folders: [],
            fileRefs: [],
          },
        ],
      },
    })

    screen.getByRole('button', { name: 'New File' })
    screen.getByRole('button', { name: 'New Folder' })
    screen.getByRole('button', { name: 'Upload' })
    screen.getByRole('button', { name: 'Rename' })
    screen.getByRole('button', { name: 'Delete' })
  })
})
