import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import FontFamilySetting from '@/features/ide-redesign/components/settings/appearance-settings/font-family-setting'

describe('<FontFamilySetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <FontFamilySetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Editor font family')

    const optionMonaco = within(select).getByText('Monaco / Menlo / Consolas')
    expect(optionMonaco.getAttribute('value')).to.equal('monaco')

    const optionLucida = within(select).getByText('Lucida / Source Code Pro')
    expect(optionLucida.getAttribute('value')).to.equal('lucida')

    const optionOpenDyslexicMono = within(select).getByText('OpenDyslexic Mono')
    expect(optionOpenDyslexicMono.getAttribute('value')).to.equal(
      'opendyslexicmono'
    )
  })
})
