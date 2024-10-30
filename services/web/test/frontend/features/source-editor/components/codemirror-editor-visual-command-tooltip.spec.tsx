import '../../../helpers/bootstrap-3'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import { TestContainer } from '../helpers/test-container'

const mountEditor = (content: string) => {
  const scope = mockScope(content)
  scope.editor.showVisual = true

  cy.mount(
    <TestContainer>
      <EditorProviders scope={scope}>
        <CodemirrorEditor />
      </EditorProviders>
    </TestContainer>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> command tooltip in Visual mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptMetadata()
  })

  it('shows a tooltip for \\href', function () {
    const content = [
      '\\documentclass{article}',
      '\\usepackage{hyperref}',
      '\\begin{document}',
      '',
      '\\end{document}',
    ].join('\n')
    mountEditor(content)

    cy.window().then(win => {
      cy.stub(win, 'open').as('window-open')
    })

    // wait for preamble to be escaped
    cy.get('.cm-line').eq(0).should('have.text', '')

    // enter the command
    cy.get('.cm-line').eq(0).as('content-line')
    cy.get('@content-line').type('\\href{{}}{{}foo')
    cy.get('@content-line').should('have.text', '{foo}')

    // enter the URL in the tooltip form
    cy.findByLabelText('URL').type('https://example.com')

    // open the link
    cy.findByRole('button', { name: 'Go to page' }).click()
    cy.get('@window-open').should(
      'have.been.calledWithMatch',
      Cypress.sinon.match.has('href', 'https://example.com/'),
      '_blank'
    )

    // remove the link
    cy.findByRole('menu').should('have.length', 1)
    cy.findByRole('button', { name: 'Remove link' }).click()
    cy.findByRole('menu').should('have.length', 0)
    cy.get('@content-line').should('have.text', 'foo')
  })

  it('can navigate the \\href tooltip using the keyboard', function () {
    const content = [
      '\\documentclass{article}',
      '\\usepackage{hyperref}',
      '\\begin{document}',
      '',
      '\\end{document}',
    ].join('\n')
    mountEditor(content)

    // wait for preamble to be escaped
    cy.get('.cm-line').eq(0).should('have.text', '')

    // enter the command
    cy.get('.cm-line').eq(0).as('content-line')
    cy.get('@content-line').type('\\href{{}}{{}foo')

    // into tooltip URL form input
    cy.tab()
    // down to first button
    cy.tab()
    // back into tooltip URL form input
    cy.tab({ shift: true })
    // back into document
    cy.tab({ shift: true })

    // close the tooltip
    cy.get('@content-line').trigger('keydown', { key: 'Escape' })
    cy.findByRole('menu').should('have.length', 0)
  })

  it('shows a tooltip for \\url', function () {
    mountEditor('')

    cy.window().then(win => {
      cy.stub(win, 'open').as('window-open')
    })

    // enter the command and URL
    cy.get('.cm-line').eq(0).as('content-line')
    cy.get('@content-line').type('\\url{{}https://example.com')
    cy.get('@content-line').should('have.text', '{https://example.com}')

    // open the link
    cy.findByRole('button', { name: 'Go to page' }).click()
    cy.get('@window-open').should(
      'have.been.calledWithMatch',
      Cypress.sinon.match.has('href', 'https://example.com/'),
      '_blank'
    )
  })

  it('shows a tooltip for \\include', function () {
    mountEditor('')

    // enter the command and file name
    cy.get('.cm-line').eq(0).as('content-line')
    cy.get('@content-line').type('\\include{{}foo')

    // assert the focused command is undecorated
    cy.get('@content-line').should('have.text', '\\include{foo}')

    cy.window().then(win => {
      cy.stub(win, 'dispatchEvent').as('dispatch-event')
    })

    // open the target
    cy.findByRole('menu').should('have.length', 1)
    cy.findByRole('button', { name: 'Edit file' }).click()
    cy.get('@dispatch-event').should('have.been.calledOnce')

    // assert the unfocused command is decorated
    cy.get('@content-line').type('{downArrow}')
    cy.findByRole('menu').should('have.length', 0)
    cy.get('@content-line').should('have.text', '\\include{foo}')
  })

  it('shows a tooltip for \\input', function () {
    mountEditor('')

    // enter the command and file name
    cy.get('.cm-line').eq(0).as('content-line')
    cy.get('@content-line').type('\\input{{}foo')

    // assert the focused command is undecorated
    cy.get('@content-line').should('have.text', '\\input{foo}')

    cy.window().then(win => {
      cy.stub(win, 'dispatchEvent').as('dispatch-event')
    })

    // open the target
    cy.findByRole('menu').should('have.length', 1)
    cy.findByRole('button', { name: 'Edit file' }).click()
    cy.get('@dispatch-event').should('have.been.calledOnce')

    // assert the unfocused command is decorated
    cy.get('@content-line').type('{downArrow}')
    cy.findByRole('menu').should('have.length', 0)
    cy.get('@content-line').should('have.text', '\\input{foo}')
  })

  it('shows a tooltip for \\ref', function () {
    const content = ['\\section{Foo} \\label{sec:foo}', ''].join('\n')

    mountEditor(content)

    // assert the unfocused label is decorated
    cy.get('.cm-line').eq(0).as('heading-line')
    cy.get('@heading-line').should('have.text', '{Foo} 🏷sec:foo')

    // enter the command and cross-reference label
    cy.get('.cm-line').eq(1).as('content-line')
    cy.get('@content-line').type('\\ref{{}sec:foo')
    cy.get('@content-line').should('have.text', '🏷{sec:foo}')

    // open the target
    cy.findByRole('menu').should('have.length', 1)
    cy.findByRole('button', { name: 'Go to target' }).click()
    cy.findByRole('menu').should('have.length', 0)

    // assert the focused label is undecorated
    cy.get('@heading-line').should('have.text', 'Foo \\label{sec:foo}')
  })
})
