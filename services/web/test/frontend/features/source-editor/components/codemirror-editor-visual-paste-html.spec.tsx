import {
  EditorProviders,
  makeEditorPropertiesProvider,
} from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'

const menuIconsText = 'content_copyexpand_more'

const mountEditor = (content = '') => {
  const scope = mockScope(content)

  cy.mount(
    <TestContainer>
      <EditorProviders
        scope={scope}
        providers={{
          EditorPropertiesProvider: makeEditorPropertiesProvider({
            showVisual: true,
            showSymbolPalette: false,
          }),
        }}
      >
        <CodemirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').as('content')
  cy.get('@content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> paste HTML in Visual mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
  })

  it('handles paste', function () {
    mountEditor()

    const data = 'foo'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })
    cy.get('@content').type('{esc}')

    cy.get('@content').should('have.text', 'foo' + menuIconsText)
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

    cy.get('@content').should('have.text', ' foo bar' + menuIconsText)
    cy.get('.ol-cm-item').should('have.length', 2)
  })

  it('handles a pasted numbered list', function () {
    mountEditor()

    const data = '<ol><li>foo</li><li>bar</li></ol>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', ' foo bar' + menuIconsText)
    cy.get('.ol-cm-item').should('have.length', 2)
  })

  it('handles a pasted nested bullet list', function () {
    mountEditor()

    const data =
      '<ul><li>foo</li><li><ul><li>bar</li><li>baz</li></ul></li></ul>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', ' foo  bar baz' + menuIconsText)
    cy.get('.ol-cm-item').should('have.length', 4)
    cy.get('.cm-line').should('have.length', 6)
  })

  it('handles a pasted nested numbered list', function () {
    mountEditor()

    const data =
      '<ol><li>foo</li><li><ol><li>bar</li><li>baz</li></ol></li></ol>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', ' foo  bar baz' + menuIconsText)
    cy.get('.ol-cm-item').should('have.length', 4)
    cy.get('.cm-line').should('have.length', 6)
  })

  it('removes a solitary item from a list', function () {
    mountEditor()

    const data = '<ul><li>foo</li></ul>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo' + menuIconsText)
    cy.get('.ol-cm-item').should('have.length', 0)
  })

  it('handles a pasted table', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foobar' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 2)
  })

  it('handles a pasted table with cell borders', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black;border-top:1px solid black;border-bottom:1px solid black">bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foobar' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 2)
    cy.get('.table-generator-cell-border-left').should('have.length', 1)
    cy.get('.table-generator-cell-border-right').should('have.length', 2)
    cy.get('.table-generator-row-border-top').should('have.length', 2)
    cy.get('.table-generator-row-border-bottom').should('have.length', 2)
  })

  it('handles a pasted table with row borders', function () {
    mountEditor()

    const data =
      '<table><tbody><tr style="border-top:1px solid black;border-bottom:1px solid black"><td>foo</td><td>bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foobar' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 2)
    cy.get('.table-generator-cell-border-left').should('have.length', 0)
    cy.get('.table-generator-cell-border-right').should('have.length', 0)
    cy.get('.table-generator-row-border-top').should('have.length', 2)
    cy.get('.table-generator-row-border-bottom').should('have.length', 2)
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

    cy.get('@content').should('have.text', 'foobarfoobarfoobar' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 6)
    cy.get('.table-generator-cell-border-left').should('have.length', 3)
    cy.get('.table-generator-cell-border-right').should('have.length', 6)
    cy.get('.table-generator-row-border-top').should('have.length', 6)
    cy.get('.table-generator-row-border-bottom').should('have.length', 2)
  })

  it('handles a pasted table with alignment', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td>foo</td><td style="text-align:left">foo</td><td style="text-align:center">foo</td><td style="text-align:right">foo</td><td style="text-align:justify">foo</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foofoofoofoofoo' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 5)
    cy.get('.table-generator-cell.alignment-left').should('have.length', 3)
    cy.get('.table-generator-cell.alignment-center').should('have.length', 1)
    cy.get('.table-generator-cell.alignment-right').should('have.length', 1)
  })

  it('handles a pasted table with merged columns', function () {
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
      'testtesttesttesttesttesttest' + menuIconsText
    )
    cy.get('.table-generator-cell').should('have.length', 7)
    cy.get('.table-generator-cell[colspan="2"]').should('have.length', 2)
  })

  it('handles a pasted 1-row table with merged columns', function () {
    mountEditor()

    const data = [
      `<table><tbody>`,
      `<tr><td>test</td><td colspan="2">test</td></tr>`,
      `</tbody></table>`,
    ].join('')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'testtest' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 2)
    cy.get('.table-generator-cell[colspan="2"]').should('have.length', 1)
  })

  it('handles a pasted table with a bordered merged column', function () {
    mountEditor()

    const data = [
      `<table><tbody>`,
      `<tr><td style="border-right:1px solid black;border-left:1px solid black;">test</td></tr>`,
      `</tbody></table>`,
    ].join('')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })
    cy.get('.table-generator-cell-border-right').should('have.length', 1)
    cy.get('.table-generator-cell-border-left').should('have.length', 1)
  })

  it('handles a pasted table with merged rows', function () {
    mountEditor()

    const data = [
      `<table><tbody>`,
      `<tr><td>test</td><td>test</td><td>test</td></tr>`,
      `<tr><td rowspan="2">test</td><td>test</td><td>test</td></tr>`,
      `<tr><td>test</td><td>test</td></tr>`,
      `</tbody></table>`,
    ].join('')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      'testtesttest\\multirow{2}{*}{test}testtesttesttest' + menuIconsText
    )
    cy.get('.table-generator-cell').should('have.length', 9)
  })

  it('handles a pasted table with merged rows and columns', function () {
    mountEditor()

    const data = [
      `<table><tbody>`,
      `<tr><td colspan="2" rowspan="2">test</td><td>test</td></tr>`,
      `<tr><td>test</td></tr>`,
      `<tr><td>test</td><td>test</td><td>test</td></tr>`,
      `</tbody></table>`,
    ].join('')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\multirow{2}{*}{test}testtesttesttesttest' + menuIconsText
    )
    cy.get('.table-generator-cell').should('have.length', 8)
    cy.get('.table-generator-cell[colspan="2"]').should('have.length', 1)
  })

  it('ignores rowspan="1" and colspan="1"', function () {
    mountEditor()

    const data = [
      `<table><tbody>`,
      `<tr><td colspan="1" rowspan="1">test</td><td>test</td><td>test</td></tr>`,
      `<tr><td>test</td><td>test</td><td>test</td></tr>`,
      `</tbody></table>`,
    ].join('')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      'testtesttesttesttesttest' + menuIconsText
    )
    cy.get('.table-generator-cell').should('have.length', 6)
    cy.get('.table-generator-cell[colspan]').should('have.length', 0)
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

    cy.get('@content').should('have.text', 'foofoobarfoobar' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 5)
    cy.get('.table-generator-cell[colspan="2"]').should('have.length', 1)
    cy.get('.table-generator-cell-border-left').should('have.length', 3)
    cy.get('.table-generator-cell-border-right').should('have.length', 5)
    cy.get('.table-generator-row-border-top').should('have.length', 5)
    cy.get('.table-generator-row-border-bottom').should('have.length', 2)
  })

  it('handles a pasted table with cell styles', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td style="font-weight:bold">foo</td><td style="font-style:italic">bar</td><td style="font-style:italic;font-weight:bold">baz</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foobarbaz' + menuIconsText)
    cy.findByText(/Sorry/).should('not.exist')
    cy.get('td b').should('have.length', 2)
    cy.get('td i').should('have.length', 2)
  })

  it('handles a pasted table with formatting markup', function () {
    mountEditor()

    const data =
      '<table><tbody><tr>' +
      '<td><b>foo</b></td>' +
      '<td><i>bar</i></td>' +
      '<td><b><i>baz</i></b></td>' +
      '<td><i><b>buzz</b></i></td>' +
      '<td><sup>up</sup></td>' +
      '<td><sub>down</sub></td>' +
      '</tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      'foobarbazbuzzupdown' + menuIconsText
    )
    cy.findByText(/Sorry/).should('not.exist')
    cy.get('td b').should('have.length', 3)
    cy.get('td i').should('have.length', 3)
    cy.get('td sup').should('have.length', 1)
    cy.get('td sub').should('have.length', 1)
  })

  it('handles a pasted table with a caption', function () {
    mountEditor()

    const data =
      '<table><caption>A table</caption><tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'A tablefoobar' + menuIconsText)
    cy.get('.table-generator-cell').should('have.length', 2)
    cy.get('.ol-cm-command-caption').should('have.length', 1)
  })

  it('handles a pasted link', function () {
    mountEditor()

    const data =
      '<a href="https://example.com/?q=$foo_~bar&x=\\bar#fragment{y}%2">foo</a>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', '{foo}' + menuIconsText)
    cy.get('.ol-cm-command-href').should('have.length', 1)

    cy.get('.cm-line').eq(0).type('{leftArrow}')
    cy.findByLabelText('URL').should(
      'have.value',
      'https://example.com/?q=$foo_~bar&x=\\\\bar\\#fragment%7By%7D\\%2'
    )
    // TODO: assert that the "Go to page" link has been unescaped
  })

  it('handles pasted code in pre blocks', function () {
    mountEditor()

    const data = `test <pre><code>\\textbf{foo}</code></pre> <pre style="font-family: 'Lucida Console', monospace">\\textbf{foo}</pre> test`

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      'test \\textbf{foo}\\textbf{foo}test' + menuIconsText
    )
    cy.get('.ol-cm-environment-verbatim').should('have.length', 10)
  })

  it('handles a pasted blockquote', function () {
    mountEditor()

    const data = 'test <blockquote>foo</blockquote> test'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'test footest' + menuIconsText)
    cy.get('.ol-cm-environment-quote').should('have.length', 5)

    cy.get('.cm-line').eq(2).click()
    cy.get('@content').should(
      'have.text',
      'test \\begin{quote}foo\\end{quote}test' + menuIconsText
    )
  })

  it('handles pasted paragraphs', function () {
    mountEditor()

    const data = [
      'test',
      '<p>foo</p>',
      '<p>bar</p>',
      '<p>baz</p>',
      'test',
    ].join('\n')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'test foobarbaztest' + menuIconsText)
    cy.get('.cm-line').should('have.length', 7)
  })

  it('handles pasted paragraphs in list items and table cells', function () {
    mountEditor()

    const data = [
      'test',
      '<p>foo</p><p>bar</p><p>baz</p>',
      '<ul><li><p>foo</p></li><li><p>foo</p></li></ul>',
      '<ol><li><p>foo</p></li><li><p>foo</p></li></ol>',
      '<table><tbody><tr><td><p>foo</p></td></tr></tbody></table>',
      'test',
    ].join('\n')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      'test foobarbaz foo foo foo foofootest' + menuIconsText
    )
    cy.get('.cm-line').should('have.length', 14)
  })

  it('handles pasted inline code', function () {
    mountEditor()

    const data = 'test <code>foo</code> test'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'test foo test' + menuIconsText)
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

  it('use text/plain for a pre element with monospace font', function () {
    mountEditor()

    const clipboardData = new DataTransfer()
    clipboardData.setData(
      'text/html',
      '<pre style="font-family:Courier,monospace">foo</pre>'
    )
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

    cy.get('@content').should(
      'have.text',
      'footh bar2 baz woo woo woo' + menuIconsText
    )
    cy.get('.ol-cm-command-textbf').should('have.length', 2)
    cy.get('.ol-cm-command-textit').should('have.length', 2)
    cy.get('.ol-cm-command-textsuperscript').should('have.length', 1)
    cy.get('.ol-cm-command-textsubscript').should('have.length', 1)
  })

  it('handles pasted text with bold CSS formatting', function () {
    mountEditor()

    const data =
      '<span style="font-weight:bold">foo</span> <span style="font-weight:800">foo</span> foo'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo foo foo' + menuIconsText)
    cy.get('.ol-cm-command-textbf').should('have.length', 2)
  })

  it('handles pasted text with italic CSS formatting', function () {
    mountEditor()

    const data = '<span style="font-style:italic">foo</span> foo'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo foo' + menuIconsText)
    cy.get('.ol-cm-command-textit').should('have.length', 1)
  })

  it('handles pasted text with non-bold CSS', function () {
    mountEditor()

    const data =
      '<strong style="font-weight:normal">foo</strong> <strong style="font-weight:200">foo</strong> foo'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo foo foo' + menuIconsText)
    cy.get('.ol-cm-command-textbf').should('have.length', 0)
  })

  it('handles pasted text with non-italic CSS', function () {
    mountEditor()

    const data =
      '<em style="font-style:normal">foo</em> <i style="font-style:normal">foo</i> foo'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo foo foo' + menuIconsText)
    cy.get('.ol-cm-command-textit').should('have.length', 0)
  })

  it('handles pasted elements with duplicate CSS formatting', function () {
    mountEditor()

    const data = [
      '<strong style="font-weight:bold">foo</strong>',
      '<b style="font-weight:bold">foo</b>',
      '<em style="font-style:italic">foo</em>',
      '<i style="font-style:italic">foo</i>',
      'foo',
    ].join(' ')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('.ol-cm-command-textbf').should('have.length', 2)
    cy.get('.ol-cm-command-textit').should('have.length', 2)
  })

  it('removes a non-breaking space when a text node contains no other content', function () {
    mountEditor()

    const data = 'foo<span>\xa0</span>bar'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo bar' + menuIconsText)
  })

  it('does not remove a non-breaking space when a text node contains other content', function () {
    mountEditor()

    const data = 'foo\xa0bar'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo bar' + menuIconsText)
  })

  it('removes all zero-width spaces', function () {
    mountEditor()

    const data = 'foo\u200bbar'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foobar' + menuIconsText)
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

    cy.get('@content').should('have.text', 'foo & bar~baz' + menuIconsText)
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
      'foo & bar~baz \\verb|\\textbf{foo}|' + menuIconsText
    )

    cy.get('.cm-line').eq(0).type('{Enter}')
    cy.get('@content').should('have.text', 'foo & bar~baz \\textbf{foo}')
    cy.get('.ol-cm-character').should('have.length', 2)
    cy.get('.ol-cm-command-verb').should('have.length', 1)
  })

  // FIXME: need to assert on source code
  // eslint-disable-next-line mocha/no-skipped-tests
  it.skip('tidies whitespace in pasted tables', function () {
    mountEditor()

    const data = `<table>
 <tr>
  <td>
  <p><b>test</b></p>
  </td>
</tr>
</table>`

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('.cm-line').should('have.length', 8)
  })

  it('tidies whitespace in pasted lists', function () {
    mountEditor()

    const data = `<ul>
<li>  foo  </li>
   <li>

  <p>

  <b>test</b></p>
<p>test test test
test test
test test test</p>
    </li>
</ul>`

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('.cm-line').should('have.length', 6)
    cy.get('@content').should(
      'have.text',
      ' foo  testtest test test test test test test test' + menuIconsText
    )
  })

  it('collapses whitespace in adjacent inline elements', function () {
    mountEditor()

    const data = `<p><b> foo </b><span> test </span><i> bar </i> baz</p>`

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo test bar baz' + menuIconsText)
  })

  it('treats a pasted image as a figure even if there is HTML', function () {
    mountEditor()

    cy.fixture<ArrayBuffer>('images/gradient.png').then(image => {
      const file = new File([image], 'gradient.png', { type: 'image/png' })
      const html = `<meta charset="utf-8"><img src="https://example.com/gradient.png" alt="gradient">`

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', html)
      clipboardData.items.add(file)
      cy.get('.cm-content').trigger('paste', { clipboardData })

      // figure modal paste handler should appear
      cy.findByText('Upload from computer').should('be.visible')
    })
  })

  it('does not treat a pasted image as a figure if there is Office HTML', function () {
    mountEditor()

    cy.fixture<ArrayBuffer>('images/gradient.png').then(image => {
      const file = new File([image], 'gradient.png', { type: 'image/png' })
      const html = `<meta charset="utf-8"><meta name="ProgId" content="MS.Word"><img src="https://example.com/gradient.png" alt="gradient">`

      const clipboardData = new DataTransfer()
      clipboardData.setData('text/html', html)
      clipboardData.items.add(file)
      cy.get('.cm-content').trigger('paste', { clipboardData })

      // paste options button should appear
      cy.findByLabelText('Paste options').should('be.visible')
    })
  })
})
