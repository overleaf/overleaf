import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import EditorThemeSetting from '@/features/ide-redesign/components/settings/appearance-settings/editor-theme-setting'
import userEvent from '@testing-library/user-event'

describe('<EditorThemeSetting />', function () {
  const editorThemes = ['editortheme-1', 'editortheme-2', 'editortheme-3']
  const legacyEditorThemes = ['legacytheme-1', 'legacytheme-2', 'legacytheme-3']

  beforeEach(function () {
    window.metaAttributesCache.set('ol-editorThemes', editorThemes)
    window.metaAttributesCache.set('ol-legacyEditorThemes', legacyEditorThemes)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <EditorThemeSetting />
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

    const select = screen.getByLabelText('Editor theme')

    for (const theme of editorThemes) {
      const option = within(select).getByText(theme.replace(/_/g, ' '))
      expect(option.getAttribute('value')).to.equal(theme)
      await userEvent.selectOptions(select, [option])
      expect(
        saveSettingsMock.callHistory.called(`/user/settings`, {
          body: { editorTheme: theme },
        })
      ).to.be.true
    }

    for (const theme of legacyEditorThemes) {
      const option = within(select).getByText(
        theme.replace(/_/g, ' ') + ' (Legacy)'
      )
      expect(option.getAttribute('value')).to.equal(theme)
      await userEvent.selectOptions(select, [option])
      expect(
        saveSettingsMock.callHistory.called(`/user/settings`, {
          body: { editorTheme: theme },
        })
      ).to.be.true
    }
  })
})
