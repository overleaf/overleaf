import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, render, screen } from '@testing-library/react'

import ProjectNameEditableLabel from '../../../../../frontend/js/features/editor-navigation-toolbar/components/project-name-editable-label'

describe('<ProjectNameEditableLabel />', function () {
  const defaultProps = { projectName: 'test-project', onChange: () => {} }

  it('displays the project name', function () {
    render(<ProjectNameEditableLabel {...defaultProps} />)
    screen.getByText('test-project')
  })

  describe('when the name is editable', function () {
    const editableProps = { ...defaultProps, hasRenamePermissions: true }

    it('displays an editable input when the edit button is clicked', function () {
      render(<ProjectNameEditableLabel {...editableProps} />)
      fireEvent.click(screen.getByRole('button'))
      screen.getByRole('textbox')
    })

    it('displays an editable input when the project name is double clicked', function () {
      render(<ProjectNameEditableLabel {...editableProps} />)
      fireEvent.doubleClick(screen.getByText('test-project'))
      screen.getByRole('textbox')
    })

    it('calls "onChange" when the project name is updated', function () {
      const props = {
        ...editableProps,
        onChange: sinon.stub(),
      }
      render(<ProjectNameEditableLabel {...props} />)

      fireEvent.doubleClick(screen.getByText('test-project'))
      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'new project name' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(props.onChange).to.be.calledWith('new project name')
    })

    it('calls "onChange" when the input loses focus', function () {
      const props = {
        ...editableProps,
        onChange: sinon.stub(),
      }
      render(<ProjectNameEditableLabel {...props} />)

      fireEvent.doubleClick(screen.getByText('test-project'))
      const input = screen.getByRole('textbox')

      fireEvent.change(input, { target: { value: 'new project name' } })

      fireEvent.blur(screen.getByRole('textbox'))

      expect(props.onChange).to.be.calledWith('new project name')
    })
  })

  describe('when the name is not editable', function () {
    const nonEditableProps = { hasRenamePermissions: false, ...defaultProps }

    it('the edit button is not displayed', function () {
      render(<ProjectNameEditableLabel {...nonEditableProps} />)
      expect(screen.queryByRole('button')).to.not.exist
    })

    it('does not display an editable input when the project name is double clicked', function () {
      render(<ProjectNameEditableLabel {...nonEditableProps} />)
      fireEvent.doubleClick(screen.getByText('test-project'))
      expect(screen.queryByRole('textbox')).to.not.exist
    })
  })
})
