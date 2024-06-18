import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsEditorTheme from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-editor-theme'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

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
    renderWithEditorContext(<SettingsEditorTheme />)

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
