import { render, screen } from '@testing-library/react'
import LayoutDropdownButton from '../../../../../frontend/js/features/editor-navigation-toolbar/components/layout-dropdown-button'

describe('<LayoutDropdownButton />', function () {
  const defaultProps = {
    handleChangeLayout: () => {},
    pdfLayout: 'flat',
    view: 'editor',
  }

  it('should mark current layout option as selected (visually by checkmark, and aria-label for accessibility)', function () {
    render(<LayoutDropdownButton {...defaultProps} />)
    screen.getByRole('menuitem', {
      name: 'Editor & PDF',
    })
    screen.getByRole('menuitem', {
      name: 'PDF only (hide editor)',
    })
    screen.getByRole('menuitem', {
      name: 'Selected Editor only (hide PDF)',
    })
  })
})
