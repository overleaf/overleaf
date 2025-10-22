import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import FontSizeSetting from '@/features/ide-redesign/components/settings/appearance-settings/font-size-setting'
import userEvent from '@testing-library/user-event'

describe('<FontSizeSetting />', function () {
  const sizes = ['10', '11', '12', '13', '14', '16', '18', '20', '22', '24']

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('each option is shown and can be selected', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <FontSizeSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const saveSettingsMock = fetchMock.post(
      'express:/user/settings',
      {
        status: 200,
      },
      { delay: 0 }
    )

    const select = screen.getByLabelText('Editor font size')

    for (const size of sizes) {
      const option = within(select).getByText(`${size}px`)
      expect(option.getAttribute('value')).to.equal(size)
      await userEvent.selectOptions(select, [option])
      expect(
        saveSettingsMock.callHistory.called('/user/settings', {
          body: { fontSize: Number(size) },
        })
      ).to.be.true
    }
  })
})
