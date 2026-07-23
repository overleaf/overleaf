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
      expect(!!localStorage.getItem(`png2pdf:${projectDefaults._id}`)).to.equal(
        false
      )
    }
  })

  it('offers the optimize-images option when png2pdf is available', async function () {
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <DraftSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Compile mode')
    const optionElement = within(select).getByText('Fast [optimize images]')
    expect(optionElement.getAttribute('value')).to.equal('png2pdf')

    await userEvent.selectOptions(select, [optionElement])
    expect((select as HTMLSelectElement).value).to.equal('png2pdf')
    expect(localStorage.getItem(`png2pdf:${projectDefaults._id}`)).to.equal(
      null
    )
    expect(!!localStorage.getItem(`draft:${projectDefaults._id}`)).to.equal(
      false
    )
  })

  it('defaults to optimize-images mode when png2pdf is available', function () {
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)

    render(
      <EditorProviders>
        <SettingsModalProvider>
          <DraftSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Compile mode') as HTMLSelectElement
    expect(select.value).to.equal('png2pdf')
    expect(localStorage.getItem(`png2pdf:${projectDefaults._id}`)).to.equal(
      null
    )
    expect(localStorage.getItem(`draft:${projectDefaults._id}`)).to.equal(null)
  })

  it('respects a previous draft setting over the png2pdf default', function () {
    window.metaAttributesCache.set('ol-canUsePng2Pdf', true)
    localStorage.setItem(`draft:${projectDefaults._id}`, 'true')

    render(
      <EditorProviders>
        <SettingsModalProvider>
          <DraftSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Compile mode') as HTMLSelectElement
    expect(select.value).to.equal('fast_draft')
  })

  it('persists the png2pdf setting to the server when changed', async function () {
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
      within(select).getByText('Fast [optimize images]'),
    ])
    expect(
      saveSettingsMock.callHistory.called(
        `/project/${projectDefaults._id}/settings`,
        { body: { png2pdf: true } }
      )
    ).to.be.true

    await userEvent.selectOptions(select, [within(select).getByText('Normal')])
    expect(
      saveSettingsMock.callHistory.called(
        `/project/${projectDefaults._id}/settings`,
        { body: { png2pdf: false } }
      )
    ).to.be.true
  })

  it('does not persist png2pdf when switching to draft mode', async function () {
    // Draft is a local-only setting; toggling it must not overwrite the shared
    // project-wide png2pdf preference.
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
