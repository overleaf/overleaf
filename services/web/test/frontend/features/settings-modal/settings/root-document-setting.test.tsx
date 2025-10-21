import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { Folder } from '../../../../../types/folder'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import RootDocumentSetting from '@/features/ide-redesign/components/settings/compiler-settings/root-document-setting'

describe('<RootDocumentSetting />', function () {
  const rootFolder: Folder = {
    _id: 'root-folder-id',
    name: 'rootFolder',
    docs: [
      {
        _id: '123abc',
        name: 'main.tex',
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

  it('shows correct menu', async function () {
    render(
      <EditorProviders rootFolder={[rootFolder as any]}>
        <SettingsModalProvider>
          <RootDocumentSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Main document')

    const optionOn = within(select).getByText('main.tex')
    expect(optionOn.getAttribute('value')).to.equal('123abc')
  })
})
