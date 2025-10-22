import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import AutoCompileSetting from '@/features/ide-redesign/components/settings/compiler-settings/auto-compile-setting'
import localStorage from '@/infrastructure/local-storage'
import userEvent from '@testing-library/user-event'

describe('<AutoCompileSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('can toggle', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <AutoCompileSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const toggle = screen.getByLabelText('Autocompile')
    const startingCheckedValue = (toggle as HTMLInputElement).checked

    // Toggle the checkbox
    await userEvent.click(toggle)
    expect((toggle as HTMLInputElement).checked).to.equal(!startingCheckedValue)
    expect(
      localStorage.getItem(`autocompile_enabled:${projectDefaults._id}`)
    ).to.equal(!startingCheckedValue)

    // Toggle back to original value
    await userEvent.click(toggle)
    expect((toggle as HTMLInputElement).checked).to.equal(startingCheckedValue)
    expect(
      !!localStorage.getItem(`autocompile_enabled:${projectDefaults._id}`)
    ).to.equal(startingCheckedValue)
  })
})
