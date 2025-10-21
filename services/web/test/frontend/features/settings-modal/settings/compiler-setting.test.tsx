import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { SettingsModalProvider } from '@/features/ide-redesign/contexts/settings-modal-context'
import { EditorProviders } from '../../../helpers/editor-providers'
import CompilerSetting from '@/features/ide-redesign/components/settings/compiler-settings/compiler-setting'

describe('<CompilerSetting />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <SettingsModalProvider>
          <CompilerSetting />
        </SettingsModalProvider>
      </EditorProviders>
    )

    const select = screen.getByLabelText('Compiler')

    const optionPdfLaTeX = within(select).getByText('pdfLaTeX')
    expect(optionPdfLaTeX.getAttribute('value')).to.equal('pdflatex')

    const optionLaTeX = within(select).getByText('LaTeX')
    expect(optionLaTeX.getAttribute('value')).to.equal('latex')

    const optionXeLaTeX = within(select).getByText('XeLaTeX')
    expect(optionXeLaTeX.getAttribute('value')).to.equal('xelatex')

    const optionLuaLaTeX = within(select).getByText('LuaLaTeX')
    expect(optionLuaLaTeX.getAttribute('value')).to.equal('lualatex')
  })
})
