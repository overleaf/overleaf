import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsMathPreview from '@/features/editor-left-menu/components/settings/settings-math-preview'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

describe('<SettingsMathPreview />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsMathPreview />)

    const select = screen.getByLabelText('Equation preview')

    const optionOn = within(select).getByText('On')
    expect(optionOn.getAttribute('value')).to.equal('true')

    const optionOff = within(select).getByText('Off')
    expect(optionOff.getAttribute('value')).to.equal('false')
  })
})
