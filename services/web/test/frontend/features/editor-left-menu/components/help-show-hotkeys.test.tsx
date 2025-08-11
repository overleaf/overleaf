import { expect } from 'chai'
import { screen, fireEvent, within } from '@testing-library/react'
import HelpShowHotkeys from '../../../../../frontend/js/features/editor-left-menu/components/help-show-hotkeys'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import fetchMock from 'fetch-mock'

describe('<HelpShowHotkeys />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('open hotkeys modal when clicked', function () {
    renderWithEditorContext(<HelpShowHotkeys />)

    expect(screen.queryByRole('dialog')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'Show Hotkeys' }))
    const modal = screen.getAllByRole('dialog')[0]
    within(modal).getByText('Common')
  })
})
