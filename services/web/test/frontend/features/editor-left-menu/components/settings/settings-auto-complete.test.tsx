import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsAutoComplete from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-auto-complete'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

describe('<SettingsAutoComplete />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsAutoComplete />)

    const select = screen.getByLabelText('Auto-complete')

    const optionOn = within(select).getByText('On')
    expect(optionOn.getAttribute('value')).to.equal('true')

    const optionOff = within(select).getByText('Off')
    expect(optionOff.getAttribute('value')).to.equal('false')
  })
})
