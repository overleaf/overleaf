import sinon from 'sinon'
import { fireEvent, screen } from '@testing-library/react'
import LayoutDropdownButton from '../../../../../frontend/js/features/editor-navigation-toolbar/components/layout-dropdown-button'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<LayoutDropdownButton />', function () {
  let openStub
  const defaultUi = {
    pdfLayout: 'flat',
    view: 'pdf',
  }

  beforeEach(function () {
    openStub = sinon.stub(window, 'open')
  })

  afterEach(function () {
    openStub.restore()
  })

  it('should mark current layout option as selected', function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, { ui: defaultUi })
    screen.getByRole('menuitem', {
      name: 'Editor & PDF',
    })
    screen.getByRole('menuitem', {
      name: 'Selected PDF only (hide editor)',
    })
    screen.getByRole('menuitem', {
      name: 'Editor only (hide PDF)',
    })
    screen.getByRole('menuitem', {
      name: 'PDF in separate tab',
    })
  })

  it('should show processing when detaching', function () {
    renderWithEditorContext(<LayoutDropdownButton />, {
      ui: { ...defaultUi, view: 'editor' },
    })

    const menuItem = screen.getByRole('menuitem', {
      name: 'PDF in separate tab',
    })
    fireEvent.click(menuItem)

    screen.getByText('Layout processing')
  })
})
