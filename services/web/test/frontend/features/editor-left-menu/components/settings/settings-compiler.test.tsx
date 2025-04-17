import { screen, within, render } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsCompiler from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-compiler'
import { EditorLeftMenuProvider } from '@/features/editor-left-menu/components/editor-left-menu-context'
import { EditorProviders } from '../../../../helpers/editor-providers'

describe('<SettingsCompiler />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  it('shows correct menu', async function () {
    render(
      <EditorProviders>
        <EditorLeftMenuProvider>
          <SettingsCompiler />
        </EditorLeftMenuProvider>
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
