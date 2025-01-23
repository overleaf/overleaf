import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsEditorTheme from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-editor-theme'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

describe('<SettingsEditorTheme />', function () {
  const editorThemes = ['editortheme-1', 'editortheme-2', 'editortheme-3']

  const legacyEditorThemes = ['legacytheme-1', 'legacytheme-2', 'legacytheme-3']

  beforeEach(function () {
    window.metaAttributesCache.set('ol-editorThemes', editorThemes)
    window.metaAttributesCache.set('ol-legacyEditorThemes', legacyEditorThemes)
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsEditorTheme />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Editor theme')

    for (const theme of editorThemes) {
      const option = within(select).getByText(theme.replace(/_/g, ' '))
      expect(option.getAttribute('value')).to.equal(theme)
    }

    for (const theme of legacyEditorThemes) {
      const option = within(select).getByText(
        theme.replace(/_/g, ' ') + ' (Legacy)'
      )
      expect(option.getAttribute('value')).to.equal(theme)
    }
  })
})
