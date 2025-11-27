import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import EditorThemeSetting from '@/features/ide-redesign/components/settings/appearance-settings/editor-theme-setting'
import userEvent from '@testing-library/user-event'

describe('<EditorThemeSetting />', function () {
  const editorThemes = [
    { name: 'editortheme-1', dark: false },
    { name: 'editortheme-2', dark: false },
    { name: 'editortheme-3', dark: false },
  ]
  const legacyEditorThemes = [
    { name: 'legacytheme-1', dark: false },
    { name: 'legacytheme-2', dark: false },
    { name: 'legacytheme-3', dark: false },
  ]

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
      const option = within(select).getByText(theme.name.replace(/_/g, ' '))
      expect(option.getAttribute('value')).to.equal(theme.name)
      await userEvent.selectOptions(select, [option])
      expect(
        saveSettingsMock.callHistory.called(`/user/settings`, {
          body: { editorTheme: theme.name },
        })
      ).to.be.true
    }

    for (const theme of legacyEditorThemes) {
      const option = within(select).getByText(
        theme.name.replace(/_/g, ' ') + ' (Legacy)'
      )
      expect(option.getAttribute('value')).to.equal(theme.name)
      await userEvent.selectOptions(select, [option])
      expect(
        saveSettingsMock.callHistory.called(`/user/settings`, {
          body: { editorTheme: theme.name },
        })
      ).to.be.true
    }
  })
})
