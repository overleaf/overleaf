import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import KeybindingSetting from '@/features/ide-redesign/components/settings/editor-settings/keybinding-setting'

describe('<KeybindingSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <KeybindingSetting />
        </SettingsModalProvider>
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
