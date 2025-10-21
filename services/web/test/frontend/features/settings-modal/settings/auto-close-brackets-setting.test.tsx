import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import AutoCloseBracketsSetting from '@/features/ide-redesign/components/settings/editor-settings/auto-close-brackets-setting'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'

describe('<AutoCloseBracketsSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('can toggle', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <AutoCloseBracketsSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const saveSettingsMock = fetchMock.post(
      `express:/user/settings`,
      {
        status: 200,
      },
      { delay: 0 }
    )

    const toggle = screen.getByLabelText('Auto-close brackets')
    const startingCheckedValue = (toggle as HTMLInputElement).checked

    // Toggle the checkbox
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(!startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { autoPairDelimiters: !startingCheckedValue },
      })
    ).to.be.true

    // Toggle back to original value
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { autoPairDelimiters: startingCheckedValue },
      })
    ).to.be.true
  })
})
