import { expect } from 'chai'
import sinon from 'sinon'
import { screen, fireEvent } from '@testing-library/react'
import renderWithContext from '../../helpers/render-with-context'

import FileTreeitemInner from '../../../../../../frontend/js/features/file-tree/components/file-tree-item/file-tree-item-inner'
import FileTreeContextMenu from '../../../../../../frontend/js/features/file-tree/components/file-tree-context-menu'

describe('<FileTreeitemInner />', function () {
  const setContextMenuCoords = sinon.stub()

  afterEach(function () {
    setContextMenuCoords.reset()
  })

  describe('menu', function () {
    it('does not display if file is not selected', function () {
      renderWithContext(
        <FileTreeitemInner id="123abc" name="bar.tex" isSelected={false} />,
        {}
      )

      expect(screen.queryByRole('menu', { visible: false })).to.not.exist
    })
  })

  describe('context menu', function () {
    it('does not display without write permissions', function () {
      const { container } = renderWithContext(
        <>
          <FileTreeitemInner id="123abc" name="bar.tex" isSelected />
          <FileTreeContextMenu />
        </>,
        {
          contextProps: { permissionsLevel: 'readOnly' },
        }
      )

      const entityElement = container.querySelector('div.entity')
      fireEvent.contextMenu(entityElement)
      expect(screen.queryByRole('menu')).to.not.exist
    })

    it('open / close', function () {
      const { container } = renderWithContext(
        <>
          <FileTreeitemInner id="123abc" name="bar.tex" isSelected />
          <FileTreeContextMenu />
        </>
      )

      expect(screen.queryByRole('menu')).to.be.null

      // open the context menu
      const entityElement = container.querySelector('div.entity')
      fireEvent.contextMenu(entityElement)
      screen.getByRole('menu', { visible: true })

      // close the context menu
      fireEvent.click(entityElement)
      expect(screen.queryByRole('menu')).to.be.null
    })
  })

  describe('name', function () {
    it('renders name', function () {
      renderWithContext(
        <FileTreeitemInner id="123abc" name="bar.tex" isSelected />
      )

      screen.getByRole('button', { name: 'bar.tex' })
      expect(screen.queryByRole('textbox')).to.not.exist
    })

    it('starts rename on menu item click', function () {
      renderWithContext(
        <>
          <FileTreeitemInner id="123abc" name="bar.tex" isSelected />
          <FileTreeContextMenu />
        </>,
        {
          contextProps: {
            rootDocId: '123abc',
            rootFolder: [
              {
                _id: 'root-folder-id',
                name: 'rootFolder',
                docs: [{ _id: '123abc', name: 'bar.tex' }],
                folders: [],
                fileRefs: [],
              },
            ],
          },
        }
      )
      const toggleButton = screen.getByRole('button', { name: 'Menu' })
      fireEvent.click(toggleButton)
      const renameButton = screen.getByRole('menuitem', { name: 'Rename' })
      fireEvent.click(renameButton)
      expect(screen.queryByRole('button', { name: 'bar.tex' })).to.not.exist
      screen.getByRole('textbox')
    })
  })
})
