import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsEditorTheme from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-editor-theme'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

const MOCK_IEEE_BRAND_ID = 123

describe('<SettingsEditorTheme />', function () {
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

  function checkSelect(select: HTMLElement) {
    for (const theme of editorThemes) {
      const option = within(select).getByText(theme.name.replace(/_/g, ' '))
      expect(option.getAttribute('value')).to.equal(theme.name)
    }

    for (const theme of legacyEditorThemes) {
      const option = within(select).getByText(
        theme.name.replace(/_/g, ' ') + ' (Legacy)'
      )
      expect(option.getAttribute('value')).to.equal(theme.name)
    }
  }

  describe('with default theme', function () {
    beforeEach(function () {
      render(
        <EditorProviders userSettings={{ overallTheme: '' }}>
          <EditorLeftMenuProvider>
            <SettingsEditorTheme />
          </EditorLeftMenuProvider>
        </EditorProviders>
      )
    })

    it('shows correct menu', async function () {
      const select = screen.getByLabelText('Editor theme')
      expect(select).to.exist
      checkSelect(select)
    })
  })

  describe('with system theme', function () {
    beforeEach(function () {
      render(
        <EditorProviders userSettings={{ overallTheme: 'system' }}>
          <EditorLeftMenuProvider>
            <SettingsEditorTheme />
          </EditorLeftMenuProvider>
        </EditorProviders>
      )
    })

    it('shows correct menu', async function () {
      const select = screen.queryByLabelText('Editor theme')
      expect(select).to.not.exist
      const lightSelect = screen.getByLabelText('Light editor theme')
      expect(lightSelect).to.exist
      checkSelect(lightSelect)
      const darkSelect = screen.getByLabelText('Dark editor theme')
      expect(darkSelect).to.exist
      checkSelect(darkSelect)
    })
  })

  describe('with IEEE branding', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-brandVariation', {
        brand_id: MOCK_IEEE_BRAND_ID,
      })
      render(
        <EditorProviders userSettings={{ overallTheme: 'system' }}>
          <EditorLeftMenuProvider>
            <SettingsEditorTheme />
          </EditorLeftMenuProvider>
        </EditorProviders>
      )
    })

    it('ignores the system theme and shows single selection', async function () {
      const select = screen.getByLabelText('Editor theme')
      expect(select).to.exist
      checkSelect(select)
    })
  })
})
