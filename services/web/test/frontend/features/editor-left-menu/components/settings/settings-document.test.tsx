import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import SettingsDocument from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-document'
import * as isValidTeXFileModule from '../../../../../../frontend/js/main/is-valid-tex-file'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'
import { Folder } from '../../../../../../types/folder'

describe('<SettingsDocument />', function () {
  let isValidTeXFileStub: sinon.SinonStub

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

  beforeEach(function () {
    isValidTeXFileStub = sinon
      .stub(isValidTeXFileModule, 'default')
      .returns(true)
  })

  afterEach(function () {
    fetchMock.reset()
    isValidTeXFileStub.restore()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsDocument />, {
      rootFolder: [rootFolder],
    })

    const select = screen.getByLabelText('Main document')

    const optionOn = within(select).getByText('main.tex')
    expect(optionOn.getAttribute('value')).to.equal('123abc')
  })
})
