import { mockScope } from '../helpers/mock-scope'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { FC } from 'react'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

const mountEditor = (content: string, ...args: any[]) => {
  const scope = mockScope(content)
  scope.permissionsLevel = 'readOnly'
  scope.editor.showVisual = true

  cy.mount(
    <Container>
      <EditorProviders scope={scope} {...args}>
        <CodemirrorEditor />
      </EditorProviders>
    </Container>
  )

  // wait for the content to be parsed and revealed
  cy.get('.cm-content').should('have.css', 'opacity', '1')
}

describe('<CodeMirrorEditor/> in Visual mode with read-only permission', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set(
      'ol-mathJax3Path',
      'https://unpkg.com/mathjax@3.2.2/es5/tex-svg-full.js'
    )
    cy.interceptEvents()
    cy.interceptSpelling()
  })

  it('decorates footnote content', function () {
    mountEditor('Foo \\footnote{Bar.} ')

    // select the footnote, so it expands
    cy.get('.ol-cm-footnote').click()

    cy.get('.cm-line').eq(0).as('first-line')
    cy.get('@first-line').should('contain', 'Foo')
    cy.get('@first-line').should('contain', 'Bar')
  })

  it('does not display the table toolbar', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}')

    cy.get('.table-generator-floating-toolbar').should('not.exist')
    cy.get('.table-generator-cell').click()
    cy.get('.table-generator-floating-toolbar').should('not.exist')
  })

  it('does not enter a table cell on double-click', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}')

    cy.get('.table-generator-cell').dblclick()
    cy.get('.table-generator-cell').get('textarea').should('not.exist')
  })

  it('does not enter a table cell on Enter', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}')

    cy.get('.table-generator-cell').trigger('keydown', { key: 'Enter' })
    cy.get('.table-generator-cell').get('textarea').should('not.exist')
  })

  it('does not paste into a table cell', function () {
    mountEditor('\\begin{tabular}{c}\n    cell\n\\end{tabular}\n\n')

    cy.get('.cm-line').last().click()
    cy.get('.table-generator-cell-render').eq(0).click()

    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', 'bar')
    cy.get('.table-generator-cell-render')
      .eq(0)
      .trigger('paste', { clipboardData })

    cy.get('.cm-content').should('have.text', 'cell')
  })

  it('does not display the figure edit button', function () {
    const fileTreeManager = {
      findEntityById: cy.stub(),
      findEntityByPath: cy.stub(),
      getEntityPath: cy.stub(),
      getRootDocDirname: cy.stub(),
      getPreviewByPath: cy
        .stub()
        .returns({ url: '/images/frog.jpg', extension: 'jpg' }),
    }

    cy.intercept('/images/frog.jpg', { fixture: 'images/gradient.png' })

    mountEditor(
      `\\begin{figure}
\\centering
\\includegraphics[width=0.5\\linewidth]{frog.jpg}
\\caption{My caption}
\\label{fig:my-label}
\\end{figure}`,
      { fileTreeManager }
    )

    cy.get('img.ol-cm-graphics').should('have.length', 1)
    cy.findByRole('button', { name: 'Edit figure' }).should('not.exist')
  })
})
