import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsFontFamily from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-font-family'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

describe('<SettingsFontFamily />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsFontFamily />
        </EditorLeftMenuProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Font Family')

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
