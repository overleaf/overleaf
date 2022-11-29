import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsKeybindings from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-keybindings'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

describe('<SettingsKeybindings />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsKeybindings />)

    const select = screen.getByLabelText('Keybindings')

    const optionNone = within(select).getByText('None')
    expect(optionNone.getAttribute('value')).to.equal('default')

    const optionVim = within(select).getByText('Vim')
    expect(optionVim.getAttribute('value')).to.equal('vim')

    const optionEmacs = within(select).getByText('Emacs')
    expect(optionEmacs.getAttribute('value')).to.equal('emacs')
  })
})
