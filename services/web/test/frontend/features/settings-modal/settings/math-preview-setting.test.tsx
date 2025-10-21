import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import MathPreviewSetting from '@/features/ide-redesign/components/settings/editor-settings/math-preview-setting'

describe('<MathPreviewSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('can toggle', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <MathPreviewSetting />
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

    const toggle = screen.getByLabelText('Equation preview')
    const startingCheckedValue = (toggle as HTMLInputElement).checked

    // Toggle the checkbox
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(!startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { mathPreview: !startingCheckedValue },
      })
    ).to.be.true

    // Toggle back to original value
    toggle.click()
    expect((toggle as HTMLInputElement).checked).to.equal(startingCheckedValue)
    expect(
      saveSettingsMock.callHistory.called(`/user/settings`, {
        body: { mathPreview: startingCheckedValue },
      })
    ).to.be.true
  })
})
