import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsSyntaxValidation from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-syntax-validation'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

describe('<SettingsSyntaxValidation />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsSyntaxValidation />)

    const select = screen.getByLabelText('Code check')

    const optionOn = within(select).getByText('On')
    expect(optionOn.getAttribute('value')).to.equal('true')

    const optionOff = within(select).getByText('Off')
    expect(optionOff.getAttribute('value')).to.equal('false')
  })
})
