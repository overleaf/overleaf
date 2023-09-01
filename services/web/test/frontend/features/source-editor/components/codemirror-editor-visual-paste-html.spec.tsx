import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

const mountEditor = (content = '') => {
  const scope = mockScope(content)
  scope.editor.showVisual = true

  cy.mount(
    <Container>
      <EditorProviders scope={scope}>
        <CodemirrorEditor />
      </EditorProviders>
    </Container>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').as('content')
  cy.get('@content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> paste HTML in Visual mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'paste-html': 'enabled',
    })
    cy.interceptEvents()
    cy.interceptSpelling()
  })

  it('handles paste', function () {
    mountEditor()

    const data = 'foo'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo')
    cy.get('@get-data').should('have.been.calledTwice')
    cy.get('@get-data').should('have.been.calledWithExactly', 'text/html')
    cy.get('@get-data').should('have.been.calledWithExactly', 'text/plain')
  })

  it('handles a pasted bullet list', function () {
    mountEditor()

    const data = '<ul><li>foo</li><li>bar</li></ul>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', ' foo bar')
    cy.get('.ol-cm-item').should('have.length', 2)
  })

  it('handles a pasted numbered list', function () {
    mountEditor()

    const data = '<ol><li>foo</li><li>bar</li></ol>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', ' foo bar')
    cy.get('.ol-cm-item').should('have.length', 2)
  })

  it('handles a pasted table', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{l l}foo & bar ↩\\end{tabular}'
    )
  })

  it('handles a pasted table with cell borders', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{| l | l |}\\hlinefoo & bar ↩\\hline\\end{tabular}'
    )
  })

  it('handles a pasted table with row borders', function () {
    mountEditor()

    const data =
      '<table><tbody><tr style="border-top:1px solid black;border-bottom:1px solid black"><td>foo</td><td>bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{l l}\\hlinefoo & bar ↩\\hline\\end{tabular}'
    )
  })

  it('handles a pasted table with adjacent borders', function () {
    mountEditor()

    const data = [
      '<table><tbody>',
      '<tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">bar</td></tr>',
      '<tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">bar</td></tr>',
      '<tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">bar</td></tr>',
      '</tbody></table>',
    ].join('\n')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{| l | l |}\\hlinefoo & bar ↩\\hlinefoo & bar ↩\\hlinefoo & bar ↩\\hline\\end{tabular}'
    )
  })

  it('handles a pasted table with alignment', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td>foo</td><td style="text-align:left">foo</td><td style="text-align:center">foo</td><td style="text-align:right">foo</td><td style="text-align:justify">foo</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{l l c r l}foo & foo & foo & foo & foo ↩\\end{tabular}'
    )
  })

  it('handles a pasted table with merged cells', function () {
    mountEditor()

    const data = [
      `<table><tbody>`,
      `<tr><td>test</td><td>test</td><td>test</td></tr>`,
      `<tr><td colspan="2">test</td><td>test</td></tr>`,
      `<tr><td>test</td><td colspan="2" style="text-align:right">test</td></tr>`,
      `</tbody></table>`,
    ].join('')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{l l l}test & test & test ↩\\multicolumn{2}{l}{test} & test ↩test & \\multicolumn{2}{r}{test} ↩\\end{tabular}'
    )
  })

  it('handles a pasted table with adjacent borders and merged cells', function () {
    mountEditor()

    const data = [
      '<table><tbody>',
      '<tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black" colspan="2">foo</td></tr>',
      '<tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">bar</td></tr>',
      '<tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">bar</td></tr>',
      '</tbody></table>',
    ].join('\n')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{| l | l |}\\hline\\multicolumn{2}{l}{foo} ↩\\hlinefoo & bar ↩\\hlinefoo & bar ↩\\hline\\end{tabular}'
    )
  })

  it('handles a pasted table with a caption', function () {
    mountEditor()

    const data =
      '<table><caption>A table</caption><tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      'A table\\begin{tabular}{l l}foo & bar ↩\\end{tabular}'
    )
  })

  it('handles a pasted link', function () {
    mountEditor()

    const data = '<a href="https://example.com/">foo</a>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', '{foo}')
    cy.get('.ol-cm-command-href').should('have.length', 1)
  })

  it('handles a pasted code block', function () {
    mountEditor()

    const data = 'test <pre><code>foo</code></pre> test'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'test foo test')
    cy.get('.ol-cm-environment-verbatim').should('have.length', 5)

    cy.get('.cm-line').eq(2).click()
    cy.get('@content').should(
      'have.text',
      'test \\begin{verbatim}foo\\end{verbatim} test'
    )
  })

  it('handles a pasted blockquote', function () {
    mountEditor()

    const data = 'test <blockquote>foo</blockquote> test'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'test foo test')
    cy.get('.ol-cm-environment-quote').should('have.length', 5)

    cy.get('.cm-line').eq(2).click()
    cy.get('@content').should(
      'have.text',
      'test \\begin{quote}foo\\end{quote} test'
    )
  })

  it('handles pasted inline code', function () {
    mountEditor()

    const data = 'test <code>foo</code> test'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'test foo test')
    cy.get('.ol-cm-command-verb')
      .should('have.length', 1)
      .should('have.text', 'foo')
  })

  it('use text/plain for a wrapper code element', function () {
    mountEditor()

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', '<code>foo</code>')
    clipboardData.setData('text/plain', 'foo')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo')
    cy.get('.ol-cm-command-verb').should('have.length', 0)
  })

  it('use text/plain for a code element in a pre element', function () {
    mountEditor()

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', '<pre><code>foo</code></pre>')
    clipboardData.setData('text/plain', 'foo')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo')
    cy.get('.ol-cm-command-verb').should('have.length', 0)
    cy.get('.ol-cm-environment-verbatim').should('have.length', 0)
  })

  it('handles pasted text with formatting', function () {
    mountEditor()

    const data =
      '<b>foo</b><sup>th</sup> <i>bar</i><sub>2</sub> baz <em>woo</em> <strong>woo</strong> woo'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'footh bar2 baz woo woo woo')
    cy.get('.ol-cm-command-textbf').should('have.length', 2)
    cy.get('.ol-cm-command-textit').should('have.length', 2)
    cy.get('.ol-cm-command-textsuperscript').should('have.length', 1)
    cy.get('.ol-cm-command-textsubscript').should('have.length', 1)
  })

  it('removes a non-breaking space when a text node contains no other content', function () {
    mountEditor()

    const data = 'foo<span>\xa0</span>bar'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo bar')
  })

  it('does not remove a non-breaking space when a text node contains other content', function () {
    mountEditor()

    const data = 'foo\xa0bar'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo bar')
  })

  it('ignores HTML pasted from VS Code', function () {
    mountEditor()

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', '<b>foo</b>')
    clipboardData.setData('text/plain', 'foo')
    clipboardData.setData('application/vnd.code.copymetadata', 'test')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo')
    cy.get('.ol-cm-command-textbf').should('have.length', 0)
  })

  it('protects special characters', function () {
    mountEditor()

    const data = 'foo & bar~baz'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo & bar~baz')
    cy.get('.ol-cm-character').should('have.length', 2)
  })

  it('does not protect special characters in code blocks', function () {
    mountEditor()

    const data = 'foo & bar~baz <code>\\textbf{foo}</code>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      'foo & bar~baz \\verb|\\textbf{foo}|'
    )

    cy.get('.cm-line').eq(0).type('{Enter}')
    cy.get('@content').should('have.text', 'foo & bar~baz \\textbf{foo}')
    cy.get('.ol-cm-character').should('have.length', 2)
    cy.get('.ol-cm-command-verb').should('have.length', 1)
  })
})
