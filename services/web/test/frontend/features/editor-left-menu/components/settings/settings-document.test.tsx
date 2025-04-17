import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsDocument from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-document'
import { Folder } from '../../../../../../types/folder'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

describe('<SettingsDocument />', function () {
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
        <EditorLeftMenuProvider>
          <SettingsDocument />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Main document')

    const optionOn = within(select).getByText('main.tex')
    expect(optionOn.getAttribute('value')).to.equal('123abc')
  })
})
