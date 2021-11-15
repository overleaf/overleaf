import { render, screen } from '@testing-library/react'
import LayoutDropdownButton from '../../../../../frontend/js/features/editor-navigation-toolbar/components/layout-dropdown-button'

describe('<LayoutDropdownButton />', function () {
  const defaultProps = {
    reattach: () => {},
    detach: () => {},
    handleChangeLayout: () => {},
    detachMode: undefined,
    detachRole: undefined,
    pdfLayout: 'flat',
    view: 'pdf',
  }

  it('should mark current layout option as selected', function () {
    // Selected is aria-label, visually we show a checkmark
    render(<LayoutDropdownButton {...defaultProps} />)
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
      name: 'Open PDF in new tab',
    })
  })

  it('should select Editor Only when detached and show option to reattach', function () {
    const detachedProps = Object.assign({}, defaultProps, {
      detachMode: 'detacher',
      detachRole: 'detacher',
      view: 'editor',
    })

    render(<LayoutDropdownButton {...detachedProps} />)

    screen.getByRole('menuitem', {
      name: 'Selected Editor only (hide PDF)',
    })
    screen.getByRole('menuitem', {
      name: 'Bring PDF back to this tab',
    })
  })

  it('should show processing when detaching', function () {
    const detachedProps = Object.assign({}, defaultProps, {
      detachMode: 'detaching',
      detachRole: 'detacher',
      view: 'editor',
    })

    render(<LayoutDropdownButton {...detachedProps} />)

    screen.getByText('Layout processing')
  })
})
