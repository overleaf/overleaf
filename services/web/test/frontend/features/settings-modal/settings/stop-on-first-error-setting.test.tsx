import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import localStorage from '@/infrastructure/local-storage'
import userEvent from '@testing-library/user-event'
import StopOnFirstErrorSetting from '@/features/ide-redesign/components/settings/compiler-settings/stop-on-first-error-setting'

describe('<StopOnFirstErrorSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('can toggle', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <StopOnFirstErrorSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const toggle = screen.getByLabelText('Stop on first error')
    const startingCheckedValue = (toggle as HTMLInputElement).checked

    // Toggle the checkbox
    await userEvent.click(toggle)
    expect((toggle as HTMLInputElement).checked).to.equal(!startingCheckedValue)
    expect(
      localStorage.getItem(`stop_on_first_error:${projectDefaults._id}`)
    ).to.equal(!startingCheckedValue)

    // Toggle back to original value
    await userEvent.click(toggle)
    expect((toggle as HTMLInputElement).checked).to.equal(startingCheckedValue)
    expect(
      !!localStorage.getItem(`stop_on_first_error:${projectDefaults._id}`)
    ).to.equal(startingCheckedValue)
  })
})
