import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsOverallTheme from '../../../../../frontend/js/features/editor-left-menu/components/settings/settings-overall-theme'
import type { OverallThemeMeta } from '../../../../../types/project-settings'
import getMeta from '@/utils/meta'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import OverallThemeSetting from '@/features/ide-redesign/components/settings/appearance-settings/overall-theme-setting'
import userEvent from '@testing-library/user-event'

const IEEE_BRAND_ID = 1234
const OTHER_BRAND_ID = 2234

describe('<OverallThemeSetting />', function () {
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
    fetchMock.removeRoutes().clearHistory()
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <OverallThemeSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const saveSettingsMock = fetchMock.post(
      'express:/user/settings',
      {
        status: 200,
      },
      { delay: 0 }
    )

    const select = screen.getByLabelText('Overall theme')

    // Reverse order so we test changing to each option
    for (const theme of overallThemes.reverse()) {
      const option = within(select).getByText(theme.name)
      expect(option.getAttribute('value')).to.equal(theme.val)
      await userEvent.selectOptions(select, [option])
      expect(
        saveSettingsMock.callHistory.called('/user/settings', {
          body: { overallTheme: theme.val },
        })
      ).to.be.true
    }
  })
  describe('Branded Project', function () {
    it('should hide overall theme picker for IEEE branded projects', function () {
      window.metaAttributesCache.set('ol-brandVariation', {
        brand_id: IEEE_BRAND_ID,
      })
      render(
        <EditorProviders>
          <SettingsModalProvider>
            <SettingsOverallTheme />
          </SettingsModalProvider>
        </EditorProviders>
      )
      const select = screen.queryByText('Overall theme')
      expect(select).to.not.exist
    })

    it('should show overall theme picker for branded projects that are not IEEE', function () {
      window.metaAttributesCache.set('ol-brandVariation', {
        brand_id: OTHER_BRAND_ID,
      })
      render(
        <EditorProviders>
          <SettingsModalProvider>
            <SettingsOverallTheme />
          </SettingsModalProvider>
        </EditorProviders>
      )
      const select = screen.getByLabelText('Overall theme')
      expect(select).to.exist
    })

    it('should show overall theme picker for non branded projects', function () {
      window.metaAttributesCache.set('ol-brandVariation', undefined)
      render(
        <EditorProviders>
          <SettingsModalProvider>
            <SettingsOverallTheme />
          </SettingsModalProvider>
        </EditorProviders>
      )
      const select = screen.getByLabelText('Overall theme')
      expect(select).to.exist
    })
  })
})
