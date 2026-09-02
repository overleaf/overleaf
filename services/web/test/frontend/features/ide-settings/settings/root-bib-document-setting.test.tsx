import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { Folder } from '../../../../../types/folder'
import { SettingsModalProvider } from '@/features/ide-settings/context/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import RootBibDocumentSetting from '@/features/ide-settings/components/reference-settings/root-bib-document-setting'
import userEvent from '@testing-library/user-event'

const OPTIONS = [
  {
    label: 'main.bib',
    value: '123abc',
  },
  {
    label: 'another.bib',
    value: '123abcd',
  },
]

describe('<RootBibDocumentSetting />', function () {
  const rootFolder: Folder = {
    _id: 'root-folder-id',
    name: 'rootFolder',
    docs: [
      {
        _id: '123abc',
        name: 'main.bib',
      },
      {
        _id: '123abcd',
        name: 'another.bib',
      },
      {
        _id: '123abce',
        name: 'main.tex',
      },
    ],
    fileRefs: [],
    folders: [],
  }

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('only lists .bib files as options', function () {
    render(
      <EditorProviders rootFolder={[rootFolder as any]}>
        <SettingsModalProvider>
          <RootBibDocumentSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText(
      'Main bibliography file for this project'
    )

    expect(within(select).getByText('main.bib')).to.exist
    expect(within(select).getByText('another.bib')).to.exist
    expect(within(select).queryByText('main.tex')).to.be.null
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders rootFolder={[rootFolder as any]}>
        <SettingsModalProvider>
          <RootBibDocumentSetting />
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

    const select = screen.getByLabelText(
      'Main bibliography file for this project'
    )

    // Reverse order so we test changing to each option
    for (const option of [...OPTIONS].reverse()) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(option.value)
      await userEvent.selectOptions(select, [optionElement])

      expect(
        saveSettingsMock.callHistory.called(
          `/project/${projectDefaults._id}/settings`,
          {
            body: { mainBibliographyDocId: option.value },
          }
        )
      ).to.be.true
    }
  })
})
