import { screen, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-settings/context/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import userEvent from '@testing-library/user-event'
import OptimizeCompilesSetting from '@/features/ide-settings/components/compiler-settings/optimize-compile-setting'
import type { PermissionsLevel } from '@/features/ide-react/types/permissions'

describe('<OptimizeCompilesSetting />', function () {
  afterEach(function () {
    window.metaAttributesCache.delete('ol-canUsePng2Pdf')
    localStorage.clear()
    fetchMock.removeRoutes().clearHistory()
  })

  function renderSetting(
    png2pdf?: boolean,
    permissionsLevel: PermissionsLevel = 'owner'
  ) {
    render(
      <EditorProviders png2pdf={png2pdf} permissionsLevel={permissionsLevel}>
        <SettingsModalProvider>
          <OptimizeCompilesSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )
  }

  it('is not rendered when png2pdf is unavailable', function () {
    renderSetting()

    expect(screen.queryByLabelText('Optimise images (recommended)')).to.be.null
  })

  it('is on by default when the project has no stored preference', function () {
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)
    renderSetting()

    const toggle = screen.getByLabelText('Optimise images (recommended)')
    expect((toggle as HTMLInputElement).checked).to.be.true
  })

  it('is disabled for a collaborator without write access', function () {
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)
    renderSetting(undefined, 'readOnly')

    const toggle = screen.getByLabelText('Optimise images (recommended)')
    expect((toggle as HTMLInputElement).disabled).to.be.true
  })

  it('reflects the stored project preference when it is off', function () {
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)
    renderSetting(false)

    const toggle = screen.getByLabelText('Optimise images (recommended)')
    expect((toggle as HTMLInputElement).checked).to.be.false
  })

  it('persists the setting to the project when toggled', async function () {
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)
    renderSetting()

    const saveSettingsMock = fetchMock.post(
      `express:/project/:projectId/settings`,
      { status: 200 },
      { delay: 0 }
    )

    const toggle = screen.getByLabelText('Optimise images (recommended)')
    await userEvent.click(toggle)

    expect(
      saveSettingsMock.callHistory.called(
        `/project/${projectDefaults._id}/settings`,
        { body: { png2pdf: false } }
      )
    ).to.be.true
  })
})
