// Needed since eslint gets confused by mocha-each
/* eslint-disable mocha/prefer-arrow-callback */
import '../../../helpers/bootstrap-3'
import { FC } from 'react'
import { EditorProviders } from '../../../helpers/editor-providers'
import CodemirrorEditor from '../../../../../frontend/js/features/source-editor/components/codemirror-editor'
import { mockScope } from '../helpers/mock-scope'
import forEach from 'mocha-each'
import { FileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { TestContainer } from '../helpers/test-container'

describe('<CodeMirrorEditor/> in Visual mode', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
    cy.interceptEvents()
    cy.interceptMetadata()
    cy.interceptMathJax()

    // 3 blank lines
    const content = '\n'.repeat(3)

    const scope = mockScope(content)
    scope.editor.showVisual = true

    const FileTreePathProvider: FC = ({ children }) => (
      <FileTreePathContext.Provider
        value={{
          dirname: cy.stub(),
          findEntityByPath: cy.stub(),
          pathInFolder: cy.stub(),
          previewByPath: cy
            .stub()
            .as('previewByPath')
            .callsFake(path => ({ url: path, extension: 'png' })),
        }}
      >
        {children}
      </FileTreePathContext.Provider>
    )

    cy.mount(
      <TestContainer>
        <EditorProviders scope={scope} providers={{ FileTreePathProvider }}>
          <CodemirrorEditor />
        </EditorProviders>
      </TestContainer>
    )

    // wait for the content to be parsed and revealed
    cy.get('.cm-content').should('have.css', 'opacity', '1')

    cy.get('.cm-line').eq(0).as('first-line')
    cy.get('.cm-line').eq(1).as('second-line')
    cy.get('.cm-line').eq(2).as('third-line')
    cy.get('.cm-line').eq(3).as('fourth-line')
    cy.get('.ol-cm-toolbar [aria-label="Format Bold"]').as('toolbar-bold')

    cy.get('@first-line').click()
  })

  afterEach(function () {
    window.metaAttributesCache.clear()
  })

  forEach(['LaTeX', 'TeX']).it('renders the %s logo', function (logo) {
    cy.get('@first-line').type(`\\${logo}{{}}{Enter}`)
    cy.get('@first-line').should('have.text', logo)
  })

  it('renders \\dots', function () {
    cy.get('@first-line').type('\\dots{Esc}')
    cy.get('@first-line').should('have.text', '\\dots')
    cy.get('@first-line').type('{Enter}')
    cy.get('@first-line').should('have.text', '…')
  })

  it('creates a new list item on Enter', function () {
    cy.get('@first-line').type('\\begin{{}itemize')

    // select the first autocomplete item
    cy.findByRole('option').eq(0).click()

    cy.get('@first-line')
      .should('have.text', ' ')
      .find('.ol-cm-item')
      .should('have.length', 1)

    cy.get('@first-line').type('test{Enter}test')

    cy.get('@first-line')
      .should('have.text', ' test')
      .find('.ol-cm-item')
      .should('have.length', 1)
    cy.get('@second-line')
      .should('have.text', ' test')
      .find('.ol-cm-item')
      .should('have.length', 1)
  })

  it('finishes a list on Enter in the last item if empty', function () {
    cy.get('@first-line').type('\\begin{{}itemize')

    // select the first autocomplete item
    cy.findByRole('option').eq(0).click()

    cy.get('@first-line').type('test{Enter}{Enter}')

    cy.get('@first-line')
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
    cy.get('.cm-content').should('have.text', ' testtest')
  })

  forEach(['textbf', 'textit']).it('handles \\%s text', function (command) {
    cy.get('@first-line').type(`\\${command}{`)
    cy.get('@first-line').should('have.text', `{}`)
    cy.get('@first-line').type('{rightArrow} ')
    cy.get('@first-line').should('have.text', '{} ')
    cy.get('@first-line').type('{Backspace}{leftArrow}test text')
    cy.get('@first-line').should('have.text', '{test text}')
    cy.get('@first-line').type('{rightArrow} foo')
    cy.get('@first-line').should('have.text', 'test text foo') // no braces
    cy.get('@first-line').find(`.ol-cm-command-${command}`)
  })

  forEach([
    'part',
    'chapter',
    'section',
    'subsection',
    'subsubsection',
    'paragraph',
    'subparagraph',
  ]).it('handles \\%s sectioning command', function (command) {
    cy.get('@first-line').type(`\\${command}{`)
    cy.get('@first-line').should('have.text', `\\${command}{}`)
    cy.get('@first-line').type('{rightArrow} ')
    cy.get('@first-line').should('have.text', `\\${command}{} `)
    // Type a section heading
    cy.get('@first-line').type('{Backspace}{leftArrow}title')
    cy.get('@first-line').should('have.text', '{title}') // braces are visible as cursor is adjacent
    cy.get('@first-line').type('{leftArrow}')
    cy.get('@first-line').should('have.text', 'title') // braces are hidden as cursor is not adjacent
    cy.get('@first-line').type('{Enter}')
    cy.get('@first-line').should('have.text', 'title') // braces are hidden as cursor is on the next line
    cy.get('@first-line').find(`.ol-cm-heading.ol-cm-command-${command}`)
  })

  forEach([
    'textsc',
    'texttt',
    'textmd',
    'textsf',
    'textsubscript',
    'textsuperscript',
    'sout',
    'emph',
    'underline',
    'url',
    'caption',
  ]).it('handles \\%s text', function (command) {
    cy.get('@first-line').type(`\\${command}{`)
    cy.get('@first-line').should('have.text', `\\${command}{}`)
    cy.get('@first-line').type('{rightArrow} ')
    cy.get('@first-line').should('have.text', `\\${command}{} `)
    cy.get('@first-line').type('{Backspace}{leftArrow}test text{rightArrow} ')
    cy.get('@first-line').should('have.text', 'test text ')
    cy.get('@first-line').find(`.ol-cm-command-${command}`)
  })

  it('handles \\verb text', function () {
    cy.get('@first-line').type(`\\verb|`)
    cy.get('@first-line').should('have.text', `\\verb|`)
    cy.get('@first-line').type('| ')
    cy.get('@first-line').should('have.text', `\\verb|| `)
    cy.get('@first-line').type('{Backspace}{leftArrow}test text{rightArrow} ')
    cy.get('@first-line').should('have.text', 'test text ')
    cy.get('@first-line').find(`.ol-cm-command-verb`)
  })

  forEach([
    ['label', '🏷'],
    ['cite', '📚'],
    ['include', '🔗'],
  ]).it('handles \\%s commands', function (command, icon) {
    cy.get('@first-line').type(`\\${command}{} `)
    cy.get('@first-line').should('have.text', `\\${command}{} `)
    cy.get('@first-line').type('{Backspace}{leftArrow}key')
    cy.get('@first-line').should('have.text', `\\${command}{key}`)
    cy.get('@first-line').type('{rightArrow}')
    cy.get('@first-line').should('have.text', `\\${command}{key}`)
    cy.get('@first-line').type(' ')
    cy.get('@first-line').should('have.text', `${icon}key `)
  })

  forEach([['ref', '🏷']]).it(
    'handles \\%s commands',
    function (command, icon) {
      cy.get('@first-line').type(`\\${command}{} `)
      cy.get('@first-line').should('have.text', `${icon} `)
      cy.get('@first-line').type('{Backspace}{leftArrow}key')
      cy.get('@first-line').should('have.text', `${icon}{key}`)
      cy.get('@first-line').type('{rightArrow}')
      cy.get('@first-line').should('have.text', `${icon}{key}`)
      cy.get('@first-line').type(' ')
      cy.get('@first-line').should('have.text', `${icon}key `)
    }
  )

  it('handles \\href command', function () {
    cy.get('@first-line').type('\\href{{}https://overleaf.com} ')
    cy.get('@first-line').should('have.text', '\\href{https://overleaf.com} ')
    cy.get('@first-line').type('{Backspace}{{}{Del}Overleaf ')
    cy.get('@first-line').should(
      'have.text',
      '\\href{https://overleaf.com}{Overleaf '
    )
    cy.get('@first-line').type('{Backspace}} ')
    cy.get('@first-line').should('have.text', 'Overleaf ')
    cy.get('@first-line').find('.ol-cm-link-text')
  })

  it('displays unknown commands unchanged', function () {
    cy.get('@first-line').type('\\foo[bar]{{}baz} ')
    cy.get('@first-line').should('have.text', '\\foo[bar]{baz} ')
  })

  describe('Figure environments', function () {
    beforeEach(function () {
      cy.get('@first-line').type('\\begin{{}figure')
      cy.get('@first-line').type('{Enter}') // end with cursor in file path
    })

    it('loads figures', function () {
      cy.get('@third-line').type('path/to/image')

      cy.get('@third-line').should(
        'contain.text',
        '    \\includegraphics[width=0.5\\linewidth]{path/to/image}'
      )

      // move the cursor out of the figure
      cy.get('@third-line').type('{DownArrow}{DownArrow}{DownArrow}{DownArrow}')

      // Should be removed from dom when line is hidden
      cy.get('.cm-content').should(
        'not.contain.text',
        '\\includegraphics[width=0.5\\linewidth]{path/to/image}'
      )

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
      cy.get('@second-line').type('{Backspace}')
      cy.get('@second-line')
        .should('have.text', '    \\centerin')
        .should('not.have.class', 'ol-cm-environment-centered')
    })
  })

  describe('verbatim environments', function () {
    beforeEach(function () {
      cy.get('@first-line').type('\\begin{{}verbatim')
      cy.get('@first-line').type('{Enter}test') // end with cursor in content
    })

    it('marks lines as verbatim environments', function () {
      // inside the environment
      cy.get('@second-line').should('have.class', 'ol-cm-environment-verbatim')

      // outside the environment
      cy.get('.cm-line')
        .eq(4)
        .should('not.have.class', 'ol-cm-environment-verbatim')

      // move the cursor out of the environment
      cy.get('.cm-line').eq(4).click()

      cy.get('.cm-content').should('have.text', '    test')
    })
  })

  describe('lstlisting environments', function () {
    beforeEach(function () {
      cy.get('@first-line').type('\\begin{{}lstlisting')
      cy.get('@first-line').type('{Enter}test') // end with cursor in content
    })

    it('marks lines as lstlisting environments', function () {
      // inside the environment
      cy.get('@second-line').should(
        'have.class',
        'ol-cm-environment-lstlisting'
      )

      // outside the environment
      cy.get('.cm-line')
        .eq(4)
        .should('not.have.class', 'ol-cm-environment-lstlisting')

      // move the cursor out of the environment
      cy.get('.cm-line').eq(4).click()

      cy.get('.cm-content').should('have.text', '    test')
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
        cy.get('@first-line').type('\\textbf{{}test}')
        cy.get('@first-line').type('{LeftArrow}'.repeat(4))
        cy.get('@first-line').type('{Shift}{RightArrow}{RightArrow}')
        cy.get('@toolbar-bold').should('have.class', 'active')
      })

      it('handles range selections spanning bold', function () {
        cy.get('@first-line').type('\\textbf{{}test} outside')
        cy.get('@first-line').type('{LeftArrow}'.repeat(10))
        cy.get('@first-line').type('{Shift}' + '{RightArrow}'.repeat(5))
        cy.get('@toolbar-bold').should('not.have.class', 'active')
      })

      it('does not highlight bold when commands at selection ends are different', function () {
        cy.get('@first-line').type('\\textbf{{}first} \\textbf{{}second}')
        cy.get('@first-line').type('{LeftArrow}'.repeat(12))
        cy.get('@first-line').type('{Shift}' + '{RightArrow}'.repeat(7))
        cy.get('@toolbar-bold').should('not.have.class', 'active')
      })

      it('highlight when ends share common formatting ancestor', function () {
        cy.get('@first-line').type(
          '\\textbf{{}\\textit{{}first} \\textit{{}second}}'
        )
        cy.get('@first-line').type('{LeftArrow}'.repeat(13))
        cy.get('@first-line').type('{Shift}' + '{RightArrow}'.repeat(7))
        cy.get('@toolbar-bold').should('have.class', 'active')
      })
    })
  })

  describe('Beamer frames', function () {
    it('hides markup', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide\\\\title}{Enter}\\end{{}frame}{Enter}'
      )
      cy.get('.ol-cm-divider')
      cy.get('.ol-cm-frame-title')
    })
    it('typesets title', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide\\\\title}{Enter}\\end{{}frame}{Enter}'
      )
      cy.get('.ol-cm-frame-title').should('contain.html', 'Slide<br>title')
    })

    it('typesets math in title', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide $\\pi$}{Enter}\\end{{}frame}{Enter}'
      )
      cy.get('.MathJax').should('contain.text', '$\\pi$')
    })

    it('typesets subtitle', function () {
      cy.get('@first-line').type(
        '\\begin{{}frame}{{}Slide title}{{}Slide subtitle}{Enter}\\end{{}frame}{Enter}'
      )
      cy.get('.ol-cm-frame-subtitle').should('have.html', 'Slide subtitle')
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

    cy.get('.ol-cm-maketitle').should('have.class', 'MathJax')
    cy.get('.ol-cm-title').should('contain.html', 'Document title<br>with')
    cy.get('.ol-cm-author').should('have.text', 'Author')

    cy.get('.ol-cm-preamble-widget').click()
    const deleteLine =
      '{command}{leftArrow}{shift}{command}{rightArrow}{backspace}'

    // italic, bold and emph
    cy.get('@second-line').type(deleteLine)
    cy.get('@second-line').type(
      '\\title{{}formatted with \\textit{{}italic} \\textbf{{}bold} \\emph{{}emph}}'
    )
    cy.get('.ol-cm-title').should(
      'contain.html',
      'formatted with <i>italic</i> <b>bold</b> <em>emph</em>'
    )

    cy.get('@second-line').type(deleteLine)
    cy.get('@second-line').type(
      '\\title{{}title\\\\ \\textbf{{}\\textit{{}\\emph{{}formated}}} \\textit{{}only italic}}'
    )
    cy.get('.ol-cm-title').should(
      'contain.html',
      'title<br> <b><i><em>formated</em></i></b> <i>only italic</i>'
    )

    // texttt command
    cy.get('@second-line').type(deleteLine)
    cy.get('@second-line').type('\\title{{}title with \\texttt{{}command}}')
    cy.get('.ol-cm-title').should(
      'contain.html',
      'title with <span class="ol-cm-command-texttt">command</span>'
    )

    cy.get('@second-line').type(deleteLine)
    cy.get('@second-line').type(
      '\\title{{}title with \\texttt{{}\\textbf{{}command}}}'
    )
    cy.get('.ol-cm-title').should(
      'contain.html',
      'title with <span class="ol-cm-command-texttt"><b>command</b></span>'
    )

    cy.get('@second-line').type(deleteLine)
    cy.get('@second-line').type('\\title{{}Title with \\& ampersands}')
    cy.get('.ol-cm-title').should('contain.html', 'Title with &amp; ampersands')

    // unsupported command
    cy.get('@second-line').type(deleteLine)
    cy.get('@second-line').type('\\title{{}My \\LaTeX{{}} document}')
    cy.get('.ol-cm-title').should('contain.html', 'My \\LaTeX{} document')
  })

  it('decorates footnotes', function () {
    cy.get('@first-line').type('Foo \\footnote{{}Bar.} ')
    cy.get('@first-line').should('contain', 'Foo')
    cy.get('@first-line').should('not.contain', 'Bar')
    cy.get('@first-line').type('{leftArrow}')
    cy.get('@first-line').should('have.text', 'Foo \\footnote{Bar.} ')
  })

  it('should show document preamble', function () {
    cy.get('@first-line').type(
      [
        '\\author{{}Author}',
        '\\title{{}Document title}',
        '\\begin{{}document}',
        '\\maketitle',
        '\\end{{}document}',
        '',
      ].join('{Enter}')
    )
    cy.get('.ol-cm-preamble-widget').should('have.length', 1)
    cy.get('.ol-cm-preamble-widget').click()

    cy.get('.ol-cm-preamble-line').eq(0).should('contain', '\\author{Author}')
    cy.get('.ol-cm-preamble-line')
      .eq(1)
      .should('contain', '\\title{Document title}')
    cy.get('.ol-cm-preamble-line').eq(2).should('contain', '\\begin{document}')
    cy.get('.ol-cm-preamble-line').eq(3).should('not.exist')
  })

  it('should exclude maketitle from preamble extents if nested in another environment', function () {
    cy.get('@first-line').type(
      [
        '\\author{{}Author}',
        '\\title{{}Document title}',
        '\\begin{{}document}',
        '\\begin{{}frame}{{}Foo}',
        '\\maketitle',
        '\\end{{}frame}',
        '\\end{{}document}',
        '',
      ].join('{Enter}')
    )
    cy.get('.ol-cm-preamble-widget').should('have.length', 1)
    cy.get('.ol-cm-preamble-widget').click()

    cy.get('.ol-cm-preamble-line').should('have.length', 3)
  })

  it('should show multiple authors', function () {
    cy.get('@first-line').type(
      [
        '\\author{{}Author \\and Author2}',
        '\\author{{}Author3}',
        '\\title{{}Document title}',
        '\\begin{{}document}',
        '\\maketitle',
        '\\end{{}document}',
        '',
      ].join('{Enter}')
    )
    cy.get('.ol-cm-preamble-widget').should('have.length', 1)
    cy.get('.ol-cm-preamble-widget').click()

    cy.get('.ol-cm-authors').should('have.length', 1)
    cy.get('.ol-cm-authors .ol-cm-author').should('have.length', 3)
  })

  it('should update authors', function () {
    cy.get('@first-line').type(
      [
        '\\author{{}Author \\and Author2}',
        '\\author{{}Author3}',
        '\\title{{}Document title}',
        '\\begin{{}document}',
        '\\maketitle',
        '\\end{{}document}',
        '',
      ].join('{Enter}')
    )
    cy.get('.ol-cm-preamble-widget').should('have.length', 1)
    cy.get('.ol-cm-preamble-widget').click()

    cy.get('.ol-cm-authors').should('have.length', 1)
    cy.get('.ol-cm-author').eq(0).should('contain', 'Author')
    cy.get('.ol-cm-author').eq(1).should('contain', 'Author2')
    cy.get('.ol-cm-author').eq(2).should('contain', 'Author3')

    cy.get('.ol-cm-author').eq(0).click()
    cy.get('.ol-cm-preamble-line').eq(0).type('{leftarrow}{backspace}New')
    cy.get('.ol-cm-author').eq(1).should('contain', 'AuthorNew')

    // update author without changing node from/to coordinates
    cy.get('.ol-cm-author').eq(0).click()
    cy.get('.ol-cm-preamble-line').eq(0).type('{leftarrow}{shift}{leftarrow}X')
    cy.get('.ol-cm-author').eq(1).should('contain', 'AuthorNeX')
  })

  it('should ignore some commands in author', function () {
    cy.get('@first-line').type(
      [
        '\\author{{}Author with \\corref{{}cor1} and \\fnref{{}label2} in the name}',
        '\\title{{}Document title}',
        '\\begin{{}document}',
        '\\maketitle',
        '\\end{{}document}',
        '',
      ].join('{Enter}')
    )

    cy.get('.ol-cm-authors').should('have.length', 1)
    cy.get('.ol-cm-author').should(
      'contain.html',
      'Author with  and  in the name'
    )
  })

  describe('decorates color commands', function () {
    it('decorates textcolor', function () {
      cy.get('@first-line').type('\\textcolor{{}red}{{}foo}')
      cy.get('.ol-cm-textcolor')
        .should('have.length', 1)
        .should('have.text', 'foo')
        .should('have.attr', 'style', 'color: rgb(255,0,0)')
    })

    it('decorates colorbox', function () {
      cy.get('@first-line').type('\\colorbox{{}yellow}{{}foo}')
      cy.get('.ol-cm-colorbox')
        .should('have.length', 1)
        .should('have.text', 'foo')
        .should('have.attr', 'style', 'background-color: rgb(255,255,0)')
    })
  })

  describe('handling of special characters', function () {
    it('decorates a tilde with a non-breaking space', function () {
      cy.get('@first-line').type('Test~test')
      cy.get('@first-line').should('have.text', 'Test\xa0test')
    })

    it('decorates a backslash-prefixed tilde with a tilde', function () {
      cy.get('@first-line').type('Test\\~test')
      cy.get('@first-line').should('have.text', 'Test~test')
    })

    it('decorates a backslash-prefixed dollar sign with a dollar sign', function () {
      cy.get('@first-line').type('\\$5.00')
      cy.get('@first-line').should('have.text', '$5.00')
      cy.get('.ol-cm-character').should('have.length', 1)
    })

    it('decorates line breaks', function () {
      cy.get('@first-line').type('Test \\\\ test')
      cy.get('@second-line').click()
      cy.get('@first-line').should('have.text', 'Test ↩ test')
    })

    it('decorates spacing commands', function () {
      cy.get('@first-line').type('\\thinspace')
      cy.get('@second-line').click()
      cy.get('@first-line')
        .find('.ol-cm-space')
        .should('have.attr', 'style', 'width: calc(0.166667em);')
    })

    it('decorates spacing symbols', function () {
      cy.get('@first-line').type('\\,')
      cy.get('@second-line').click()
      cy.get('@first-line')
        .find('.ol-cm-space')
        .should('have.attr', 'style', 'width: calc(0.166667em);')
    })
  })

  describe('decorates theorems', function () {
    it('decorates a proof environment', function () {
      cy.get('@first-line').type(
        ['\\begin{{}proof}{Enter}', 'foo{Enter}', '\\end{{}proof}{Enter}'].join(
          ''
        )
      )
      cy.get('.cm-content').should('have.text', 'Prooffoo')
    })

    it('decorates a theorem environment', function () {
      cy.get('@first-line').type(
        [
          '\\begin{{}theorem}{Enter}',
          'foo{Enter}',
          '\\end{{}theorem}{Enter}',
        ].join('')
      )
      cy.get('.cm-content').should('have.text', 'Theoremfoo')
    })

    it('decorates a theorem environment with a label', function () {
      cy.get('@first-line').type(
        [
          '\\begin{{}theorem}[Bar]{Enter}',
          'foo{Enter}',
          '\\end{{}theorem}{Enter}',
        ].join('')
      )
      cy.get('.cm-content').should('have.text', 'Theorem (Bar)foo')
    })

    it('decorates a custom theorem environment with a label', function () {
      cy.get('@first-line').type(
        [
          '\\newtheorem{{}thm}{{}Foo}{Enter}',
          '\\begin{{}thm}[Bar]{Enter}',
          'foo{Enter}',
          '\\end{{}thm}{Enter}',
        ].join('')
      )
      cy.get('.cm-content').should(
        'have.text',
        ['\\newtheorem{thm}{Foo}', 'Foo (Bar)foo'].join('')
      )
    })
  })

  forEach(['quote', 'quotation', 'quoting', 'displayquote']).it(
    'renders a %s environment',
    function (environment) {
      cy.get('@first-line').type(`\\begin{{}${environment}`)
      cy.findAllByRole('listbox').should('have.length', 1)
      cy.findByRole('listbox').contains(`\\begin{${environment}}`).click()
      cy.get('@second-line').type('foo')
      cy.get('.cm-content').should(
        'have.text',
        [`\\begin{${environment}}`, '    foo', `\\end{${environment}}`].join('')
      )
      cy.get('.cm-line').eq(4).click()
      cy.get('.cm-content').should('have.text', '    foo')
    }
  )

  it('invokes MathJax when math is written', function () {
    cy.get('@first-line').type('foo $\\pi$ bar')
    cy.get('@second-line').type(
      'foo \n\\[\\epsilon{rightArrow}{rightArrow}\nbar'
    )
    cy.get('.MathJax').first().should('have.text', '\\pi')
    cy.get('.MathJax').eq(1).should('have.text', '\\epsilon')
  })

  // TODO: \input
  // TODO: Abstract
})
