import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import CodeCheckSetting from '@/features/ide-redesign/components/settings/editor-settings/code-check-setting'

describe('<CodeCheckSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('can toggle', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <CodeCheckSetting />
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

    const toggle = screen.getByLabelText('Code check')
    const startingCheckedValue = (toggle as HTMLInputElement).checked

    // Toggle the checkbox
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(!startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { syntaxValidation: !startingCheckedValue },
      })
    ).to.be.true

    // Toggle back to original value
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { syntaxValidation: startingCheckedValue },
      })
    ).to.be.true
  })
})
