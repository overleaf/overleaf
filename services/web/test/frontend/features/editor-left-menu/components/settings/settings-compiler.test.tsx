import { screen, within } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SettingsCompiler from '../../../../../../frontend/js/features/editor-left-menu/components/settings/settings-compiler'
import { renderWithEditorContext } from '../../../../helpers/render-with-context'

describe('<SettingsCompiler />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('shows correct menu', async function () {
    renderWithEditorContext(<SettingsCompiler />)

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
