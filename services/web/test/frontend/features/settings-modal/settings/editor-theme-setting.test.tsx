import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import EditorThemeSetting from '@/features/ide-redesign/components/settings/appearance-settings/editor-theme-setting'
import userEvent from '@testing-library/user-event'

const MOCK_IEEE_BRAND_ID = 123

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
    window.metaAttributesCache.set('ol-brandVariation', {
      brand_id: undefined,
    })
    window.metaAttributesCache.get('ol-ExposedSettings').ieeeBrandId =
      MOCK_IEEE_BRAND_ID
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  async function checkSelect(select: HTMLElement, settingName: string) {
    const saveSettingsMock = fetchMock.post(
      `express:/user/settings`,
      {
        status: 200,
      },
      { delay: 0 }
    )
    for (const theme of editorThemes) {
      const option = within(select).getByText(theme.name.replace(/_/g, ' '))
      expect(option.getAttribute('value')).to.equal(theme.name)
      await userEvent.selectOptions(select, [option])
      expect(
        saveSettingsMock.callHistory.called(`/user/settings`, {
          body: { [settingName]: theme.name },
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
          body: { [settingName]: theme.name },
        })
      ).to.be.true
    }
  }

  describe('with default theme', function () {
    beforeEach(function () {
      render(
        <EditorProviders userSettings={{ overallTheme: '' }}>
          <SettingsModalProvider>
            <EditorThemeSetting />
          </SettingsModalProvider>
        </EditorProviders>
      )
    })

    it('each option is shown and can be selected', async function () {
      const select = screen.getByLabelText('Editor theme')
      expect(select).to.exist
      await checkSelect(select, 'editorTheme')
    })
  })

  describe('with system theme', function () {
    beforeEach(function () {
      render(
        <EditorProviders userSettings={{ overallTheme: 'system' }}>
          <SettingsModalProvider>
            <EditorThemeSetting />
          </SettingsModalProvider>
        </EditorProviders>
      )
    })

    it('splits the setting into two', async function () {
      const select = screen.queryByLabelText('Editor theme')
      expect(select).to.not.exist
      const lightModeSelect = screen.getByLabelText('Light editor theme')
      expect(lightModeSelect).to.exist
      await checkSelect(lightModeSelect, 'editorLightTheme')
      const darkModeSelect = screen.getByLabelText('Dark editor theme')
      expect(darkModeSelect).to.exist
      await checkSelect(darkModeSelect, 'editorDarkTheme')
    })
  })

  describe('with IEEE branding', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-brandVariation', {
        brand_id: MOCK_IEEE_BRAND_ID,
      })
      render(
        <EditorProviders userSettings={{ overallTheme: 'system' }}>
          <SettingsModalProvider>
            <EditorThemeSetting />
          </SettingsModalProvider>
        </EditorProviders>
      )
    })

    it('ignores the system theme and shows single selection', async function () {
      const select = screen.getByLabelText('Editor theme')
      expect(select).to.exist
      await checkSelect(select, 'editorTheme')
    })
  })
})
