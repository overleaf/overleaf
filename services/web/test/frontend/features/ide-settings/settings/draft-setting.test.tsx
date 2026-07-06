import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
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
    localStorage.clear()
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

  it('offers the optimize-images option behind the png2pdf split test', async function () {
    window.metaAttributesCache.set('ol-splitTestVariants', {
      png2pdf: 'enabled',
    })
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
    expect(!!localStorage.getItem(`png2pdf:${projectDefaults._id}`)).to.equal(
      true
    )
    expect(!!localStorage.getItem(`draft:${projectDefaults._id}`)).to.equal(
      false
    )
  })
})
