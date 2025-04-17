import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsMathPreview from '@/features/editor-left-menu/components/settings/settings-math-preview'
import { EditorProviders } from '../../../../helpers/editor-providers'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'

describe('<SettingsMathPreview />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsMathPreview />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Equation preview')

    const optionOn = within(select).getByText('On')
    expect(optionOn.getAttribute('value')).to.equal('true')

    const optionOff = within(select).getByText('Off')
    expect(optionOff.getAttribute('value')).to.equal('false')
  })
})
