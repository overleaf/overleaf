import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { Folder } from '../../../../../types/folder'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import {
  EditorProviders,
  projectDefaults,
} from '../../../helpers/editor-providers'
import RootDocumentSetting from '@/features/ide-redesign/components/settings/compiler-settings/root-document-setting'
import userEvent from '@testing-library/user-event'

const OPTIONS = [
  {
    label: 'main.tex',
    value: '123abc',
  },
  {
    label: 'another.tex',
    value: '123abcd',
  },
]

describe('<RootDocumentSetting />', function () {
  const rootFolder: Folder = {
    _id: 'root-folder-id',
    name: 'rootFolder',
    docs: [
      {
        _id: '123abc',
        name: 'main.tex',
      },
      {
        _id: '123abcd',
        name: 'another.tex',
      },
    ],
    fileRefs: [],
    folders: [],
  }

  let originalSettings: typeof window.metaAttributesCache

  beforeEach(function () {
    originalSettings = window.metaAttributesCache.get('ol-ExposedSettings')
    window.metaAttributesCache.set('ol-ExposedSettings', {
      validRootDocExtensions: ['tex'],
    })
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
    window.metaAttributesCache.set('ol-ExposedSettings', originalSettings)
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders rootFolder={[rootFolder as any]}>
        <SettingsModalProvider>
          <RootDocumentSetting />
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

    const select = screen.getByLabelText('Main document')

    // Reverse order so we test changing to each option
    for (const option of OPTIONS.reverse()) {
      const optionElement = within(select).getByText(option.label)
      expect(optionElement.getAttribute('value')).to.equal(option.value)
      await userEvent.selectOptions(select, [optionElement])

      expect(
        saveSettingsMock.callHistory.called(
          `/project/${projectDefaults._id}/settings`,
          {
            body: { rootDocId: option.value },
          }
        )
      ).to.be.true
    }
  })
})
