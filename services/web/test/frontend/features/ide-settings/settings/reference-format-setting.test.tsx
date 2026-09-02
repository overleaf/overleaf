import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-settings/context/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import ReferenceFormatSetting from '@/features/ide-settings/components/reference-settings/reference-format-setting'
import userEvent from '@testing-library/user-event'

// bibtex is listed first as it differs from the component's default
// ('biblatex'), so selecting it is guaranteed to trigger a change.
const OPTIONS = [
  {
    label: 'BibTeX',
    value: 'bibtex',
  },
  {
    label: 'BibLaTeX',
    value: 'biblatex',
  },
]

describe('<ReferenceFormatSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('defaults to BibLaTeX', function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <ReferenceFormatSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText(
      'Reference format'
    ) as HTMLSelectElement
    expect(select.value).to.equal('biblatex')
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <ReferenceFormatSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const saveSettingsMock = fetchMock.post(
      `express:/project/:projectId/settings`,
      {
        status: 200,
      },
      { delay: 0 }
    )

    const select = screen.getByLabelText('Reference format')

    for (const option of OPTIONS) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(option.value)
      await userEvent.selectOptions(select, [optionElement])

      expect(
        saveSettingsMock.callHistory.called(
          `/project/${projectDefaults._id}/settings`,
          {
            body: { referenceFormat: option.value },
          }
        )
      ).to.be.true
    }
  })
})
