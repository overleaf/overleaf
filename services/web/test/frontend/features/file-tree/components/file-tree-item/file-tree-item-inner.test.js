import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, fireEvent } from '@testing-library/react'
import renderWithContext from '../../helpers/render-with-context'

import FileTreeitemInner from '../../../../../../frontend/js/features/file-tree/components/file-tree-item/file-tree-item-inner'

describe('<FileTreeitemInner />', function() {
  const setContextMenuCoords = sinon.stub()

  beforeEach(function() {
    global.requestAnimationFrame = sinon.stub()
  })

  afterEach(function() {
    setContextMenuCoords.reset()
    delete global.requestAnimationFrame
  })

  describe('menu', function() {
    it('does not display if file is not selected', function() {
      renderWithContext(
        <FileTreeitemInner id="123abc" name="bar.tex" isSelected={false} />,
        {}
      )

      expect(screen.queryByRole('menu', { visible: false })).to.not.exist
    })
  })

  describe('context menu', function() {
    it('does not display without write permissions', function() {
      renderWithContext(
        <FileTreeitemInner id="123abc" name="bar.tex" isSelected />,
        { contextProps: { hasWritePermissions: false } }
      )

      expect(screen.queryByRole('menu', { visible: false })).to.not.exist
    })

    it('open / close', function() {
      const { container } = renderWithContext(
        <FileTreeitemInner id="123abc" name="bar.tex" isSelected />
      )

      const entityElement = container.querySelector('div.entity')

      screen.getByRole('menu', { visible: false })

      fireEvent.contextMenu(entityElement)
      screen.getByRole('menu', { visible: true })

      fireEvent.contextMenu(entityElement)
      screen.getByRole('menu', { visible: false })
    })
  })

  describe('name', function() {
    it('renders name', function() {
      renderWithContext(
        <FileTreeitemInner id="123abc" name="bar.tex" isSelected />
      )

      screen.getByRole('button', { name: 'bar.tex' })
      expect(screen.queryByRole('textbox')).to.not.exist
    })

    it('starts rename on menu item click', function() {
      renderWithContext(
        <FileTreeitemInner id="123abc" name="bar.tex" isSelected />,
        {
          contextProps: {
            rootDocId: '123abc',
            rootFolder: [
              {
                _id: 'root-folder-id',
                docs: [{ _id: '123abc', name: 'bar.tex' }],
                folders: [],
                fileRefs: []
              }
            ]
          }
        }
      )

      const renameButton = screen.getByRole('menuitem', { name: 'Rename' })
      fireEvent.click(renameButton)
      expect(screen.queryByRole('button', { name: 'bar.tex' })).to.not.exist
      screen.getByRole('textbox')
    })
  })
})
