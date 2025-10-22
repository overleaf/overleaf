import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import KeybindingSetting from '@/features/ide-redesign/components/settings/editor-settings/keybinding-setting'
import userEvent from '@testing-library/user-event'

const OPTIONS = [
  {
    label: 'None',
    value: 'default',
  },
  {
    label: 'Vim',
    value: 'vim',
  },
  {
    label: 'Emacs',
    value: 'emacs',
  },
]

describe('<KeybindingSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <KeybindingSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const saveSettingsMock = fetchMock.post(
      'express:/user/settings',
      {
        status: 200,
      },
      { delay: 0 }
    )

    const select = screen.getByLabelText('Keybindings')

    // Reverse order so we test changing to each option
    for (const option of OPTIONS.reverse()) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(option.value)
      await userEvent.selectOptions(select, [optionElement])
      expect(
        saveSettingsMock.callHistory.called('/user/settings', {
          body: { mode: option.value },
        })
      ).to.be.true
    }
  })
})
