import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import userEvent from '@testing-library/user-event'
import DraftSetting from '@/features/ide-redesign/components/settings/compiler-settings/draft-setting'

const OPTIONS = [
  {
    label: 'Normal',
    value: false,
  },
  {
    label: 'Fast [draft]',
    value: true,
  },
]

describe('<DraftSetting />', function () {
  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <DraftSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Compile mode')

    for (const option of OPTIONS) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(
        option.value.toString()
      )
      await userEvent.selectOptions(select, [optionElement])
      expect(!!localStorage.getItem(`draft:${projectDefaults._id}`)).to.equal(
        option.value
      )
    }
  })
})
