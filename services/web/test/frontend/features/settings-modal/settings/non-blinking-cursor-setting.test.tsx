import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/settings/context/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import NonBlinkingCursorSetting from '@/features/settings/components/editor-settings/non-blinking-cursor-setting'

describe('<NonBlinkingCursorSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('can toggle', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <NonBlinkingCursorSetting />
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

    const toggle = screen.getByLabelText('Non-blinking cursor')
    const startingCheckedValue = (toggle as HTMLInputElement).checked

    // Toggle the checkbox
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(!startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { nonBlinkingCursor: !startingCheckedValue },
      })
    ).to.be.true

    // Toggle back to original value
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { nonBlinkingCursor: startingCheckedValue },
      })
    ).to.be.true
  })
})
