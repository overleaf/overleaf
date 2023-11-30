import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsOverallTheme from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-overall-theme'
import type { OverallThemeMeta } from '../../../../../../types/project-settings'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

describe('<SettingsOverallTheme />', function () {
  const overallThemes: OverallThemeMeta[] = [
    {
      name: 'Overall Theme 1',
      val: '',
      path: 'https://overleaf.com/overalltheme-1.css',
    },
    {
      name: 'Overall Theme 2',
      val: 'light-',
      path: 'https://overleaf.com/overalltheme-2.css',
    },
  ]

  beforeEach(function () {
    window.metaAttributesCache.set('ol-overallThemes', overallThemes)
  })

  afterEach(function () {
    fetchMock.reset()
    window.metaAttributesCache = new Map()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsOverallTheme />)

    const select = screen.getByLabelText('Overall theme')

    for (const theme of overallThemes) {
      const option = within(select).getByText(theme.name)
      expect(option.getAttribute('value')).to.equal(theme.val)
    }
  })
})
