import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-settings/context/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import userEvent from '@testing-library/user-event'
import DraftSetting from '@/features/ide-settings/components/compiler-settings/draft-setting'

describe('<DraftSetting />', function () {
  afterEach(function () {
    window.metaAttributesCache.delete('ol-splitTestVariants')
    window.metaAttributesCache.delete('ol-canUsePng2Pdf')
    localStorage.clear()
    fetchMock.removeRoutes().clearHistory()
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <DraftSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Compile mode')

    const options = [
      { label: 'Normal', value: 'normal', draft: false },
      { label: 'Fast [draft]', value: 'fast_draft', draft: true },
    ]
    for (const option of options) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(option.value)
      await userEvent.selectOptions(select, [optionElement])
      expect(!!localStorage.getItem(`draft:${projectDefaults._id}`)).to.equal(
        option.draft
      )
    }
  })

  it('does not persist a project setting when switching to draft mode', async function () {
    // Draft is a local-only setting; toggling it must not touch the shared
    // project-wide Optimise images (recommended) preference.
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <DraftSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const saveSettingsMock = fetchMock.post(
      `express:/project/:projectId/settings`,
      { status: 200 },
      { delay: 0 }
    )

    const select = screen.getByLabelText('Compile mode')
    await userEvent.selectOptions(select, [
      within(select).getByText('Fast [draft]'),
    ])

    expect((select as HTMLSelectElement).value).to.equal('fast_draft')
    expect(localStorage.getItem(`draft:${projectDefaults._id}`)).to.equal(
      'true'
    )
    expect(
      saveSettingsMock.callHistory.called(
        `/project/${projectDefaults._id}/settings`
      )
    ).to.be.false
  })
})
