import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsKeybindings from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-keybindings'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'

describe('<SettingsKeybindings />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsKeybindings />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Keybindings')

    const optionNone = within(select).getByText('None')
    expect(optionNone.getAttribute('value')).to.equal('default')

    const optionVim = within(select).getByText('Vim')
    expect(optionVim.getAttribute('value')).to.equal('vim')

    const optionEmacs = within(select).getByText('Emacs')
    expect(optionEmacs.getAttribute('value')).to.equal('emacs')
  })
})
