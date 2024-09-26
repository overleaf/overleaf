import { LanguageSupport } from '@codemirror/language'
import { EditorState, Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { expect } from 'chai'
import { documentOutline } from '../../../../../../frontend/js/features/source-editor/languages/latex/document-outline'
import {
  FlatOutline,
  getNestingLevel,
} from '../../../../../../frontend/js/features/source-editor/utils/tree-query'
import { LaTeXLanguage } from '../../../../../../frontend/js/features/source-editor/languages/latex/latex-language'
import {
  Book,
  Chapter,
  Paragraph,
  Part,
  Section,
  SubParagraph,
  SubSection,
  SubSubSection,
} from '../../../../../../frontend/js/features/source-editor/lezer-latex/latex.terms.mjs'

const latex = new LanguageSupport(LaTeXLanguage, documentOutline.extension)

const makeView = (lines: string[]): EditorView => {
  const text = Text.of(lines)
  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [latex],
    }),
  })
  return view
}

const BOOK_LEVEL = getNestingLevel(Book)
const PART_LEVEL = getNestingLevel(Part)
const CHAPTER_LEVEL = getNestingLevel(Chapter)
const SECTION_LEVEL = getNestingLevel(Section)
const SUB_SECTION_LEVEL = getNestingLevel(SubSection)
const SUB_SUB_SECTION_LEVEL = getNestingLevel(SubSubSection)
const PARAGRAPH_LEVEL = getNestingLevel(Paragraph)
const SUB_PARAGRAPH_LEVEL = getNestingLevel(SubParagraph)
const FRAME_LEVEL = getNestingLevel('frame')

const insertText = (view: EditorView, position: number, text: string) => {
  view.dispatch({
    changes: [{ from: position, insert: text }],
  })
}

const deleteText = (view: EditorView, position: number, length: number) => {
  view.dispatch({
    changes: [{ from: position - length, to: position }],
  })
}

const getOutline = (view: EditorView): FlatOutline | null => {
  return view.state.field(documentOutline)?.items || null
}

describe('CodeMirror LaTeX-FileOutline', function () {
  describe('with no update', function () {
    describe('an empty document', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['']
        view = makeView(content)
      })

      it('should have empty outline', function () {
        const outline = getOutline(view)
        expect(outline).to.be.empty
      })
    })

    describe('a document with nested sections', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = [
          'line 1',
          '\\section{sec title}',
          'content',
          '\\subsection{subsec title}',
        ]
        view = makeView(content)
      })

      it('should have outline with different levels', function () {
        const outline = getOutline(view)
        expect(outline).to.be.deep.equal([
          {
            from: 7,
            to: 26,
            level: SECTION_LEVEL,
            title: 'sec title',
            line: 2,
          },
          {
            from: 35,
            to: 60,
            level: SUB_SECTION_LEVEL,
            title: 'subsec title',
            line: 4,
          },
        ])
      })
    })

    describe('a document with sibling sections', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = [
          'line 1',
          '\\section{sec title 1}',
          'content',
          '\\section{sec title 2}',
        ]
        view = makeView(content)
      })

      it('should have outline with same levels for siblings', function () {
        const outline = getOutline(view)
        expect(outline).to.be.deep.equal([
          {
            from: 7,
            to: 28,
            level: SECTION_LEVEL,
            title: 'sec title 1',
            line: 2,
          },
          {
            from: 37,
            to: 58,
            level: SECTION_LEVEL,
            title: 'sec title 2',
            line: 4,
          },
        ])
      })
    })
  })

  describe('with change to title', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = ['\\section{title }']
      view = makeView(content)
      const initialOutline = getOutline(view)
      expect(initialOutline).to.deep.equal([
        {
          from: 0,
          to: 16,
          title: 'title ',
          line: 1,
          level: SECTION_LEVEL,
        },
      ])
    })

    describe('for appending to title', function () {
      beforeEach(function () {
        insertText(view, 15, '1')
      })

      it('should update title in outline', function () {
        const updatedOutline = getOutline(view)
        expect(updatedOutline).to.deep.equal([
          {
            from: 0,
            to: 17,
            title: 'title 1',
            line: 1,
            level: SECTION_LEVEL,
          },
        ])
      })
    })

    describe('for removing from title', function () {
      beforeEach(function () {
        deleteText(view, 15, 1)
      })

      it('should update title in outline', function () {
        const updatedOutline = getOutline(view)
        expect(updatedOutline).to.deep.equal([
          {
            from: 0,
            to: 15,
            title: 'title',
            line: 1,
            level: SECTION_LEVEL,
          },
        ])
      })
    })
  })

  describe('for moving section', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = ['\\section{title}', '\\subsection{subtitle}']
      view = makeView(content)
      const initialOutline = getOutline(view)
      expect(initialOutline).to.deep.equal([
        {
          from: 0,
          to: 15,
          title: 'title',
          line: 1,
          level: SECTION_LEVEL,
        },
        {
          from: 16,
          to: 37,
          title: 'subtitle',
          line: 2,
          level: SUB_SECTION_LEVEL,
        },
      ])
      insertText(view, 15, '\n')
    })

    it('should update position for moved section', function () {
      const updatedOutline = getOutline(view)
      expect(updatedOutline).to.deep.equal([
        {
          from: 0,
          to: 15,
          title: 'title',
          line: 1,
          level: SECTION_LEVEL,
        },
        {
          from: 17,
          to: 38,
          title: 'subtitle',
          line: 3,
          level: SUB_SECTION_LEVEL,
        },
      ])
    })
  })

  describe('for removing a section', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = ['\\section{title}']
      view = makeView(content)
      const initialOutline = getOutline(view)
      expect(initialOutline).to.deep.equal([
        {
          from: 0,
          to: 15,
          title: 'title',
          line: 1,
          level: SECTION_LEVEL,
        },
      ])
      deleteText(view, 4, 1)
    })

    it('should remove the section from the outline', function () {
      const updatedOutline = getOutline(view)
      expect(updatedOutline).to.be.empty
    })
  })

  describe('for changing parent section', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = [
        '\\section{section}',
        '%\\subsection{subsection}', // initially commented out
        '\\subsubsection{subsubsection}',
      ]
      view = makeView(content)
      const initialOutline = getOutline(view)
      expect(initialOutline).to.deep.equal([
        {
          from: 0,
          to: 17,
          title: 'section',
          line: 1,
          level: SECTION_LEVEL,
        },
        {
          from: 43,
          to: 72,
          title: 'subsubsection',
          line: 3,
          level: SUB_SUB_SECTION_LEVEL,
        },
      ])
      // Remove the %
      deleteText(view, 19, 1)
    })

    it('should be nested properly', function () {
      const updatedOutline = getOutline(view)
      expect(updatedOutline).to.deep.equal([
        {
          from: 0,
          to: 17,
          title: 'section',
          line: 1,
          level: SECTION_LEVEL,
        },
        {
          from: 18,
          to: 41,
          title: 'subsection',
          line: 2,
          level: SUB_SECTION_LEVEL,
        },
        {
          from: 42,
          to: 71,
          title: 'subsubsection',
          line: 3,
          level: SUB_SUB_SECTION_LEVEL,
        },
      ])
    })
  })

  describe('for a sectioning command inside a newcommand or renewcommand', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = [
        '\\section{section}',
        '\\newcommand{\\test}{\\section{should not display}}',
        '\\renewcommand{\\test}{\\section{should still not display}}',
      ]
      view = makeView(content)
    })
    it('should not include them in the outline', function () {
      const outline = getOutline(view)
      expect(outline?.length).to.equal(1)
      expect(outline).to.deep.equal([
        {
          from: 0,
          to: 17,
          title: 'section',
          line: 1,
          level: SECTION_LEVEL,
        },
      ])
    })
  })

  describe('for all section types', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = [
        '\\book{book}',
        '\\part{part}',
        '\\chapter{chapter}',
        '\\section{section}',
        '\\subsection{subsection}',
        '\\subsubsection{subsubsection}',
        '\\paragraph{paragraph}',
        '\\subparagraph{subparagraph}',
      ]
      view = makeView(content)
    })

    it('should include them in the file outline', function () {
      const outline = getOutline(view)
      expect(outline).to.deep.equal([
        {
          from: 0,
          to: 11,
          title: 'book',
          line: 1,
          level: BOOK_LEVEL,
        },
        {
          from: 12,
          to: 23,
          title: 'part',
          line: 2,
          level: PART_LEVEL,
        },
        {
          from: 24,
          to: 41,
          title: 'chapter',
          line: 3,
          level: CHAPTER_LEVEL,
        },
        {
          from: 42,
          to: 59,
          title: 'section',
          line: 4,
          level: SECTION_LEVEL,
        },
        {
          from: 60,
          to: 83,
          title: 'subsection',
          line: 5,
          level: SUB_SECTION_LEVEL,
        },
        {
          from: 84,
          to: 113,
          title: 'subsubsection',
          line: 6,
          level: SUB_SUB_SECTION_LEVEL,
        },
        {
          from: 114,
          to: 135,
          title: 'paragraph',
          line: 7,
          level: PARAGRAPH_LEVEL,
        },
        {
          from: 136,
          to: 163,
          title: 'subparagraph',
          line: 8,
          level: SUB_PARAGRAPH_LEVEL,
        },
      ])
    })
  })

  describe('sectioning commands with optional arguments', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = ['\\section[short title]{section}']
      view = makeView(content)
    })

    it('should use the long argument as title', function () {
      const outline = getOutline(view)
      expect(outline).to.deep.equal([
        {
          from: 0,
          to: 30,
          title: 'section',
          line: 1,
          level: SECTION_LEVEL,
        },
      ])
    })
  })

  describe('for labels using texorpdfstring', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = [
        '\\section{The \\texorpdfstring{function $f(x) = x^2$}{function f(x) = x^2}: Properties of \\texorpdfstring{$x$}{x}.}',
      ]
      view = makeView(content)
    })

    it('should use the text argument as title', function () {
      const outline = getOutline(view)
      expect(outline).to.deep.equal([
        {
          from: 0,
          to: 113,
          title: 'The function f(x) = x^2: Properties of x.',
          line: 1,
          level: SECTION_LEVEL,
        },
      ])
    })
  })

  describe('for ill-formed \\def command', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = ['\\def\\x{', '\\section{test}', '\\subsection{test2}']
      view = makeView(content)
    })

    it('still shows an outline', function () {
      const outline = getOutline(view)
      expect(outline).to.deep.equal([
        {
          from: 8,
          to: 22,
          title: 'test',
          line: 2,
          level: SECTION_LEVEL,
        },
        {
          from: 23,
          to: 41,
          title: 'test2',
          line: 3,
          level: SUB_SECTION_LEVEL,
        },
      ])
    })
  })

  describe('for beamer frames', function () {
    describe('with titles', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['\\begin{frame}{frame title}{}', '\\end{frame}']
        view = makeView(content)
      })

      it('should show up in the file outline', function () {
        const outline = getOutline(view)
        expect(outline).to.deep.equal([
          {
            from: 0,
            to: 28,
            title: 'frame title',
            line: 1,
            level: FRAME_LEVEL,
          },
        ])
      })
    })
    describe('without titles', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['\\begin{frame}', '\\end{frame}']
        view = makeView(content)
      })

      it('should not show up in the file outline', function () {
        const outline = getOutline(view)
        expect(outline).to.be.empty
      })
    })
  })
})
