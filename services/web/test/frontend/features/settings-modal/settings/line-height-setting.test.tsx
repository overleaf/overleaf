import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { EditorProviders } from '../../../helpers/editor-providers'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import LineHeightSetting from '@/features/ide-redesign/components/settings/appearance-settings/line-height-setting'

describe('<LineHeightSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <LineHeightSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Editor line height')

    const optionCompact = within(select).getByText('Compact')
    expect(optionCompact.getAttribute('value')).to.equal('compact')

    const optionNormal = within(select).getByText('Normal')
    expect(optionNormal.getAttribute('value')).to.equal('normal')

    const optionWide = within(select).getByText('Wide')
    expect(optionWide.getAttribute('value')).to.equal('wide')
  })
})
