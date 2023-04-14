// Needed since eslint gets confused by mocha-each
/* eslint-disable mocha/prefer-arrow-callback */
import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import forEach from 'mocha-each'

const Container: FC = ({ children }) => (
  <div style={{ width: 785, height: 785 }}>{children}</div>
)

describe('<CodeMirrorEditor/> in Rich Text mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    window.metaAttributesCache.set(
      'ol-mathJax3Path',
      'https://unpkg.com/mathjax@3.2.2/es5/tex-svg-full.js'
    )
    cy.interceptEvents()
    cy.interceptSpelling()

    // 3 blank lines
    const content = '\n'.repeat(3)

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
    cy.get('.cm-content').should('have.css', 'opacity', '1')

    cy.get('.cm-line').eq(0).click().as('first-line')
    cy.get('.cm-line').eq(1).as('second-line')
    cy.get('.cm-line').eq(2).as('third-line')
    cy.get('.cm-line').eq(3).as('fourth-line')
    cy.get('.ol-cm-toolbar [aria-label="Format Bold"]').as('toolbar-bold')
  })

  forEach(['LaTeX', 'TeX']).it('renders the %s logo', function (logo) {
    cy.get('@first-line').type(`\\${logo}{{}}{Enter}`).should('have.text', logo)
  })

  it('renders \\dots', function () {
    cy.get('@first-line')
      .type('\\dots{Esc}')
      .should('have.text', '\\dots')
      .type('{Enter}')
      .should('have.text', '…')
  })

  it('creates a new list item on Enter', function () {
    cy.get('@first-line').type('\\begin{{}itemize')

    // select the first autocomplete item
    cy.findByRole('option').eq(0).click()

    cy.get('@first-line').should('have.text', '\\begin{itemize}')
    cy.get('@second-line')
      .should('have.text', ' ')
      .find('.ol-cm-item')
      .should('have.length', 1)
    cy.get('@third-line').should('have.text', '\\end{itemize}')

    cy.get('@second-line').type('test{Enter}test')

    cy.get('@first-line').should('have.text', '\\begin{itemize}')
    cy.get('@second-line')
      .should('have.text', ' test')
      .find('.ol-cm-item')
      .should('have.length', 1)
    cy.get('@third-line')
      .should('have.text', ' test')
      .find('.ol-cm-item')
      .should('have.length', 1)
    cy.get('@fourth-line').should('have.text', '\\end{itemize}')
  })

  it('finishes a list on Enter in the last item if empty', function () {
    cy.get('@first-line').type('\\begin{{}itemize')

    // select the first autocomplete item
    cy.findByRole('option').eq(0).click()

    cy.get('@second-line').type('test{Enter}{Enter}')

    cy.get('.cm-line')
      .eq(0)
      .should('have.text', ' test')
      .find('.ol-cm-item')
      .should('have.length', 1)

    cy.get('.cm-line').eq(1).should('have.text', '')
  })

  it('does not finish a list on Enter in an earlier item if empty', function () {
    cy.get('@first-line').type('\\begin{{}itemize')

    // select the first autocomplete item
    cy.findByRole('option').eq(0).click()

    cy.get('@second-line').type('test{Enter}test{Enter}{upArrow}{Enter}{Enter}')

    const lines = [
      '\\begin{itemize}',
      ' test',
      ' ',
      ' ',
      ' test',
      ' ',
      '\\end{itemize}',
    ]

    cy.get('.cm-content').should('have.text', lines.join(''))
  })

  forEach(['textbf', 'textit', 'underline']).it(
    'handles \\%s text',
    function (command) {
      cy.get('@first-line')
        .type(`\\${command}{`)
        .should('have.text', `\\${command}{`)
        .type('} ') // Should still show braces for empty commands
        .should('have.text', '{} ')
        .type('{Backspace}{leftArrow}test text')
        .should('have.text', '{test text}')
        .type('{rightArrow} foo')
        .should('have.text', 'test text foo') // no braces
        .find(`.ol-cm-command-${command}`)
    }
  )

  forEach([
    'part',
    'chapter',
    'section',
    'subsection',
    'subsubsection',
    'paragraph',
    'subparagraph',
  ]).it('handles \\%s sectioning command', function (command) {
    cy.get('@first-line')
      .type(`\\${command}{`)
      .should('have.text', `\\${command}{`)
      .type(`}`)
      .should('have.text', `\\${command}{}`)
      .type(' ')
      .should('have.text', `\\${command}{} `)
      // Press enter before closing brace
      .type('{Backspace}{leftArrow}title{leftArrow}{Enter}')
      .should('have.text', 'title')
      .find(`.ol-cm-heading.ol-cm-command-${command}`)
      .should('exist')
  })

  forEach([
    'textsc',
    'texttt',
    'sout',
    'emph',
    ['verb', '|', '|'],
    'url',
    'caption',
  ]).it(
    'handles \\%s text',
    function (command, openingBrace = '{', closingBrace = '}') {
      cy.get('@first-line')
        .type(`\\${command}${openingBrace}`)
        .should('have.text', `\\${command}${openingBrace}`)
        .type(`${closingBrace}`)
        .should('have.text', `\\${command}${openingBrace}${closingBrace}`)
        .type(' ')
        .should('have.text', `\\${command}${openingBrace}${closingBrace} `)
        .type('{Backspace}{leftArrow}test text{rightArrow} ')
        .should('have.text', 'test text ')
        .find(`.ol-cm-command-${command}`)
        .should('exist')
    }
  )

  forEach([
    ['ref', '🏷'],
    ['label', '🏷'],
    ['cite', '📚'],
    ['include', '🔗'],
  ]).it('handles \\%s commands', function (command, icon) {
    cy.get('@first-line')
      .type(`\\${command}{} `)
      .should('have.text', `\\${command}{} `)
      .type('{Backspace}{leftArrow}key')
      .should('have.text', `\\${command}{key}`)
      .type('{rightArrow}')
      .should('have.text', `\\${command}{key}`)
      .type(' ')
      .should('have.text', `${icon}key `)
  })

  it('handles \\href command', function () {
    cy.get('@first-line')
      .type('\\href{{}https://overleaf.com} ')
      .should('have.text', '\\href{https://overleaf.com} ')
      .type('{Backspace}{{}{Del}Overleaf ')
      .should('have.text', '\\href{https://overleaf.com}{Overleaf ')
      .type('{Backspace}} ')
      .should('have.text', 'Overleaf ')
      .find('.ol-cm-link-text')
      .should('exist')
  })

  it('displays unknown commands unchanged', function () {
    cy.get('@first-line')
      .type('\\foo[bar]{{}baz} ')
      .should('have.text', '\\foo[bar]{baz} ')
  })

  describe('Figure environments', function () {
    beforeEach(function () {
      cy.get('@first-line').type('\\begin{{}figure').type('{Enter}') // end with cursor in file path
    })

    it('loads figures', function () {
      cy.get('@third-line').type('path/to/image')

      cy.get('@third-line')
        .should('have.text', '    \\includegraphics{path/to/image}')
        .type('{DownArrow}{DownArrow}{DownArrow}{DownArrow}')
        .should('not.exist') // Should be removed from dom when line is hidden

      cy.get('img.ol-cm-graphics').should('have.attr', 'src', 'path/to/image')
    })

    it('marks lines as figure environments', function () {
      // inside the figure
      cy.get('@second-line').should('have.class', 'ol-cm-environment-figure')
      // outside the figure
      cy.get('.cm-line')
        .eq(6)
        .should('not.have.class', 'ol-cm-environment-figure')
    })

    it('marks environment has centered when it has \\centering command', function () {
      // inside the figure
      cy.get('@third-line').should('have.class', 'ol-cm-environment-centered')
      // outside the figure
      cy.get('.cm-line')
        .eq(6)
        .should('not.have.class', 'ol-cm-environment-centered')
      // the line containing \centering
      cy.get('@second-line')
        .should('have.text', '    \\centering')
        .should('have.class', 'ol-cm-environment-centered')
        .type('{Backspace}')
        .should('have.text', '    \\centerin')
        .should('not.have.class', 'ol-cm-environment-centered')
    })
  })
  describe('Toolbar', function () {
    describe('Formatting buttons highlighting', function () {
      it('handles empty selections inside of bold', function () {
        cy.get('@first-line').type('\\textbf{{}test}{LeftArrow}') // \textbf{test|}
        cy.get('@toolbar-bold').should('have.class', 'active')
        cy.get('@first-line').type('{LeftArrow}') // \textbf{tes|t}
        cy.get('@toolbar-bold').should('have.class', 'active')
        cy.get('@first-line').type('{LeftArrow}'.repeat(3)) // \textbf{|test}
        cy.get('@toolbar-bold').should('have.class', 'active')
      })

      it('handles empty selections outside bold', function () {
        cy.get('@first-line').type('\\textbf{{}test}')
        cy.get('@toolbar-bold').should('not.have.class', 'active')
        cy.get('@first-line').type('{LeftArrow}'.repeat(6))
        cy.get('@toolbar-bold').should('not.have.class', 'active')
      })

      it('handles range selections inside bold', function () {
        cy.get('@first-line')
          .type('\\textbf{{}test}')
          .type('{LeftArrow}'.repeat(4))
          .type('{Shift}{RightArrow}{RightArrow}')
        cy.get('@toolbar-bold').should('have.class', 'active')
      })

      it('handles range selections spanning bold', function () {
        cy.get('@first-line')
          .type('\\textbf{{}test} outside')
          .type('{LeftArrow}'.repeat(10))
          .type('{Shift}' + '{RightArrow}'.repeat(5))
        cy.get('@toolbar-bold').should('not.have.class', 'active')
      })

      it('does not highlight bold when commands at selection ends are different', function () {
        cy.get('@first-line')
          .type('\\textbf{{}first} \\textbf{{}second}')
          .type('{LeftArrow}'.repeat(12))
          .type('{Shift}' + '{RightArrow}'.repeat(7))
        cy.get('@toolbar-bold').should('not.have.class', 'active')
      })

      it('highlight when ends share common formatting ancestor', function () {
        cy.get('@first-line')
          .type('\\textbf{{}\\textit{{}first} \\textit{{}second}}')
          .type('{LeftArrow}'.repeat(13))
          .type('{Shift}' + '{RightArrow}'.repeat(7))
        cy.get('@toolbar-bold').should('have.class', 'active')
      })
    })
  })

  describe('Beamer frames', function () {
    it('hides markup', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide\\\\title}{Enter}\\end{{}frame}{Enter}'
      )
      cy.get('.ol-cm-divider').should('exist')
      cy.get('.ol-cm-frame-title').should('exist')
    })
    it('typesets title', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide\\\\title}{Enter}\\end{{}frame}{Enter}'
      )
      cy.get('.ol-cm-frame-title')
        .should('exist')
        .should('have.html', 'Slide<br>title')
    })

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('typesets math in title', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide $\\pi$}{Enter}\\end{{}frame}{Enter}'
      )

      // allow plenty of time for MathJax to load
      cy.get('.MathJax', { timeout: 10000 }).should('exist')
    })

    it('typesets subtitle', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide title}{{}Slide subtitle}{Enter}\\end{{}frame}{Enter}'
      )
      cy.get('.ol-cm-frame-subtitle')
        .should('exist')
        .should('have.html', 'Slide subtitle')
    })
  })

  it('typesets \\maketitle', function () {
    cy.get('@first-line').type(
      [
        '\\author{{}Author}',
        '\\title{{}Document title\\\\with $\\pi$}',
        '\\begin{{}document}',
        '\\maketitle',
        '\\end{{}document}',
        '',
      ].join('{Enter}')
    )

    // allow plenty of time for MathJax to load
    // TODO: re-enable this assertion when stable
    // cy.get('.MathJax', { timeout: 10000 }).should('exist')

    cy.get('.ol-cm-maketitle').should('exist')
    cy.get('.ol-cm-title')
      .should('exist')
      .should('contain.html', 'Document title<br>with')
    cy.get('.ol-cm-author').should('have.text', 'Author')
  })

  // TODO: \input
  // TODO: Math
  // TODO: Abstract
  // TODO: Preamble
})
