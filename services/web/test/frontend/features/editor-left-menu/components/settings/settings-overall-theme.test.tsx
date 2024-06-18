import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsOverallTheme from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-overall-theme'
import type { OverallThemeMeta } from '../../../../../../types/project-settings'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'
import getMeta from '@/utils/meta'

const IEEE_BRAND_ID = 1234
const OTHER_BRAND_ID = 2234

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
    Object.assign(getMeta('ol-ExposedSettings'), {
      ieeeBrandId: IEEE_BRAND_ID,
    })
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsOverallTheme />)

    const select = screen.getByLabelText('Overall theme')

    for (const theme of overallThemes) {
      const option = within(select).getByText(theme.name)
      expect(option.getAttribute('value')).to.equal(theme.val)
    }
  })
  describe('Branded Project', function () {
    it('should hide overall theme picker for IEEE branded projects', function () {
      window.metaAttributesCache.set('ol-brandVariation', {
        brand_id: IEEE_BRAND_ID,
      })
      renderWithEditorContext(<SettingsOverallTheme />)
      const select = screen.queryByText('Overall theme')
      expect(select).to.not.exist
    })

    it('should show overall theme picker for branded projects that are not IEEE', function () {
      window.metaAttributesCache.set('ol-brandVariation', {
        brand_id: OTHER_BRAND_ID,
      })
      renderWithEditorContext(<SettingsOverallTheme />)
      const select = screen.getByLabelText('Overall theme')
      expect(select).to.exist
    })

    it('should show overall theme picker for non branded projects', function () {
      window.metaAttributesCache.set('ol-brandVariation', undefined)
      renderWithEditorContext(<SettingsOverallTheme />)
      const select = screen.getByLabelText('Overall theme')
      expect(select).to.exist
    })
  })
})
