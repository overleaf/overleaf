import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import LineHeightSetting from '@/features/ide-redesign/components/settings/appearance-settings/line-height-setting'
import userEvent from '@testing-library/user-event'

const OPTIONS = [
  {
    label: 'Compact',
    value: 'compact',
  },
  {
    label: 'Normal',
    value: 'normal',
  },
  {
    label: 'Wide',
    value: 'wide',
  },
]

describe('<LineHeightSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <LineHeightSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Editor line height')

    const saveSettingsMock = fetchMock.post(
      'express:/user/settings',
      {
        status: 200,
      },
      { delay: 0 }
    )

    for (const option of OPTIONS) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(option.value)
      await userEvent.selectOptions(select, [optionElement])
      expect(
        saveSettingsMock.callHistory.called('/user/settings', {
          body: { lineHeight: option.value },
        })
      ).to.be.true
    }
  })
})
