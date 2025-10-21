import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import FontSizeSetting from '@/features/ide-redesign/components/settings/appearance-settings/font-size-setting'

describe('<FontSizeSetting />', function () {
  const sizes = ['10', '11', '12', '13', '14', '16', '18', '20', '22', '24']

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <FontSizeSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Editor font size')

    for (const size of sizes) {
      const option = within(select).getByText(`${size}px`)
      expect(option.getAttribute('value')).to.equal(size)
    }
  })
})
