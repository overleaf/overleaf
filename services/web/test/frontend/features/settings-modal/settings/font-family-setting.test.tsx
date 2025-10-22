import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import FontFamilySetting from '@/features/ide-redesign/components/settings/appearance-settings/font-family-setting'
import userEvent from '@testing-library/user-event'

const options = [
  {
    label: 'Monaco / Menlo / Consolas',
    value: 'monaco',
  },
  {
    label: 'Lucida / Source Code Pro',
    value: 'lucida',
  },
  {
    label: 'OpenDyslexic Mono',
    value: 'opendyslexicmono',
  },
]

describe('<FontFamilySetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <FontFamilySetting />
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

    const select = screen.getByLabelText('Editor font family')

    // Reverse order so we test changing to each option
    for (const option of options.reverse()) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(option.value)
      await userEvent.selectOptions(select, [optionElement])

      expect(
        saveSettingsMock.callHistory.called('/user/settings', {
          body: { fontFamily: option.value },
        })
      ).to.be.true
    }
  })
})
