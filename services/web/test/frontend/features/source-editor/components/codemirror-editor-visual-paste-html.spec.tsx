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
    cy.get('@get-data').should('have.been.calledOnceWithExactly', 'text/html')
  })

  it('handles a pasted bullet list', function () {
    mountEditor()

    const data = '<ul><li>foo</li><li>bar</li></ul>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', ' foo bar')
    cy.get('.ol-cm-item').should('have.length', 2)
  })

  it('handles a pasted numbered list', function () {
    mountEditor()

    const data = '<ol><li>foo</li><li>bar</li></ol>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', ' foo bar')
    cy.get('.ol-cm-item').should('have.length', 2)
  })

  it('handles a pasted simple table', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{c c}foo & bar ↩\\end{tabular}'
    )
  })

  it('handles a pasted simple table with borders', function () {
    mountEditor()

    const data =
      '<table><tbody><tr><td style="border-left:1px solid black;border-right:1px solid black">foo</td><td style="border-left:1px solid black;border-right:1px solid black">bar</td></tr></tbody></table>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{| c | c |}foo & bar ↩\\end{tabular}'
    )
  })

  it('handles a pasted table with merged cells', function () {
    mountEditor()

    const data = [
      `<table><tbody>`,
      `<tr><td>test</td><td>test</td><td>test</td></tr>`,
      `<tr><td colspan="2">test</td><td>test</td></tr>`,
      `<tr><td>test</td><td colspan="2">test</td></tr>`,
      `</tbody></table>`,
    ].join('')

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should(
      'have.text',
      '\\begin{tabular}{c c c}test & test & test ↩\\multicolumn{2}{test} & test ↩test & \\multicolumn{2}{test}  ↩\\end{tabular}'
    )
  })

  it('handles a pasted link', function () {
    mountEditor()

    const data = '<a href="https://example.com/">foo</a>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', '{foo}')
    cy.get('.ol-cm-command-href').should('have.length', 1)
  })

  it('handles a pasted code block', function () {
    mountEditor()

    const data = '<pre><code>foo</a></pre>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo')
    cy.get('.ol-cm-environment-verbatim').should('have.length', 5)

    cy.get('.cm-line').eq(2).click()
    cy.get('@content').should(
      'have.text',
      '\\begin{verbatim}foo\\end{verbatim}'
    )
  })

  it('handles pasted inline code', function () {
    mountEditor()

    const data = '<code>foo</a>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', '\\verb|foo|')
    cy.get('.ol-cm-command-verb').should('have.length', 1)
  })

  it('handles pasted text with formatting', function () {
    mountEditor()

    const data = '<b>foo</b><sup>th</sup> <i>bar</i><sub>2</sub> baz'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'footh bar2 baz')
    cy.get('.ol-cm-command-textbf').should('have.length', 1)
    cy.get('.ol-cm-command-textit').should('have.length', 1)
    cy.get('.ol-cm-command-textsuperscript').should('have.length', 1)
    cy.get('.ol-cm-command-textsubscript').should('have.length', 1)
  })

  it('protects special characters', function () {
    mountEditor()

    const data = 'foo & bar~baz'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
    cy.get('@content').trigger('paste', { clipboardData })

    cy.get('@content').should('have.text', 'foo & bar~baz')
    cy.get('.ol-cm-character').should('have.length', 2)
  })

  it('does not protect special characters in code blocks', function () {
    mountEditor()

    const data = 'foo & bar~baz <code>\\textbf{foo}</code>'

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/html', data)
    cy.spy(clipboardData, 'getData').as('get-data')
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
