import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { FC } from 'react'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

describe('<CodeMirrorEditor/> tooltips in Visual mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptMathJax()
    cy.interceptEvents()
    cy.interceptSpelling()

    const scope = mockScope('\n\n\n')
    scope.editor.showVisual = true

    cy.mount(
      <Container>
        <EditorProviders scope={scope}>
          <CodemirrorEditor />
        </EditorProviders>
      </Container>
    )

    // wait for the content to be parsed and revealed
    cy.get('.cm-content').should('have.css', 'opacity', '1')

    cy.get('.cm-line').eq(0).as('first-line')
  })

  it('displays a tooltip for \\href commands', function () {
    cy.get('@first-line').type(
      '\\href{{}https://example.com}{{}foo}{leftArrow}'
    )
    cy.get('.cm-content').should('have.text', '{foo}')
    cy.get('.cm-tooltip').should('have.length', 1)
    cy.get('.cm-tooltip').within(() => {
      cy.findByLabelText('URL').should('have.value', 'https://example.com')
      cy.findByLabelText('URL').type('/foo')
      cy.findByLabelText('URL').should('have.value', 'https://example.com/foo')
      cy.window().then(win => {
        cy.stub(win, 'open').as('open-window')
      })
      cy.findByRole('button', { name: 'Go to page' }).click()
      cy.get('@open-window').should(
        'have.been.calledOnceWithExactly',
        'https://example.com/foo',
        '_blank'
      )
      cy.findByRole('button', { name: 'Remove link' }).click()
    })
    cy.get('.cm-content').should('have.text', 'foo')
    cy.get('.cm-tooltip').should('have.length', 0)
  })

  it('displays a tooltip for \\url commands', function () {
    cy.get('@first-line').type('\\url{{}https://example.com}{leftArrow}')
    cy.get('.cm-content').should('have.text', '{https://example.com}')
    cy.get('.cm-tooltip').should('have.length', 1)
    cy.get('.cm-tooltip').within(() => {
      cy.window().then(win => {
        cy.stub(win, 'open').as('open-window')
      })
      cy.findByRole('button', { name: 'Go to page' }).click()
      cy.get('@open-window').should(
        'have.been.calledOnceWithExactly',
        'https://example.com',
        '_blank'
      )
    })
    cy.get('@first-line').type('{rightArrow}{rightArrow}')
    cy.get('.cm-content').should('have.text', 'https://example.com')
    cy.get('.cm-tooltip').should('have.length', 0)
  })

  it('displays a tooltip for \\ref commands', function () {
    cy.get('@first-line').type(
      '\\label{{}fig:frog}{Enter}\\ref{{}fig:frog}{leftArrow}'
    )
    cy.get('.cm-content').should('have.text', '🏷fig:frog🏷{fig:frog}')
    cy.get('.cm-tooltip').should('have.length', 1)
    cy.get('.cm-tooltip').within(() => {
      cy.findByRole('button', { name: 'Go to target' }).click()
    })
    cy.window().then(win => {
      expect(win.getSelection()?.toString()).to.equal('fig:frog')
    })
  })

  it('displays a tooltip for \\include commands', function () {
    cy.get('@first-line').type('\\include{{}main}{leftArrow}')
    cy.get('.cm-content').should('have.text', '\\include{main}')
    cy.get('.cm-tooltip').should('have.length', 1)
    cy.get('.cm-tooltip').within(() => {
      cy.findByRole('button', { name: 'Edit file' }).click()
      // TODO: assert event fired with "main.tex" as the name?
    })
    cy.get('@first-line').type('{rightArrow}{rightArrow}')
    cy.get('.cm-content').should('have.text', '🔗main')
    cy.get('.cm-tooltip').should('have.length', 0)
  })

  it('displays a tooltip for \\input commands', function () {
    cy.get('@first-line').type('\\input{{}main}{leftArrow}')
    cy.get('.cm-content').should('have.text', '\\input{main}')
    cy.get('.cm-tooltip').should('have.length', 1)
    cy.get('.cm-tooltip').within(() => {
      cy.findByRole('button', { name: 'Edit file' }).click()
      // TODO: assert event fired with "main.tex" as the name?
    })
    cy.get('@first-line').type('{rightArrow}{rightArrow}')
    cy.get('.cm-content').should('have.text', '🔗main')
    cy.get('.cm-tooltip').should('have.length', 0)
  })
})
