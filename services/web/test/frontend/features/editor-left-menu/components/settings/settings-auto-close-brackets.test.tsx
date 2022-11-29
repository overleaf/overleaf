import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsAutoCloseBrackets from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-auto-close-brackets'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

describe('<SettingsAutoCloseBrackets />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsAutoCloseBrackets />)

    const select = screen.getByLabelText('Auto-close Brackets')

    const optionOn = within(select).getByText('On')
    expect(optionOn.getAttribute('value')).to.equal('true')

    const optionOff = within(select).getByText('Off')
    expect(optionOff.getAttribute('value')).to.equal('false')
  })
})
