import { expect } from 'chai'
import { EditorState, Text } from '@codemirror/state'
import { LaTeXLanguage } from '../../../../../../frontend/js/features/source-editor/languages/latex/latex-language'
import {
  ensureSyntaxTree,
  foldNodeProp,
  LanguageSupport,
} from '@codemirror/language'
import { EditorView } from '@codemirror/view'
const latex = new LanguageSupport(LaTeXLanguage)

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

type Fold = { from: number; to: number }

const _getFolds = (view: EditorView) => {
  const ranges: Fold[] = []
  const tree = ensureSyntaxTree(view.state, view.state.doc.length)
  if (!tree) {
    throw new Error("Couldn't get Syntax Tree")
  }
  tree.iterate({
    enter: nodeRef => {
      const prop = nodeRef.type.prop(foldNodeProp)
      if (prop) {
        const hasFold = prop(nodeRef.node, view.state)
        if (hasFold) {
          ranges.push({ from: hasFold.from, to: hasFold.to })
        }
      }
    },
  })
  return ranges
}

describe('CodeMirror LaTeX-folding', function () {
  describe('With empty document', function () {
    let view: EditorView, content: string[]
    beforeEach(function () {
      content = ['']
      view = makeView(content)
    })

    it('should not produce any folds', function () {
      const folds = _getFolds(view)
      expect(folds).to.be.empty
    })
  })

  describe('Sectioning command folding', function () {
    describe('with no foldable sections', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['hello', 'test']
        view = makeView(content)
      })

      it('should not produce any folds', function () {
        const folds = _getFolds(view)
        expect(folds).to.be.empty
      })
    })

    describe('with one foldable section', function () {
      let view: EditorView, content: string[]

      beforeEach(function () {
        content = ['hello', '\\section{one}', 'a', 'b', 'c']
        view = makeView(content)
      })

      it('should produce one fold', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(1)
      })

      it('should fold from the section line to last line', function () {
        const folds = _getFolds(view)
        const fold = folds[0]
        expect(view.state.doc.lineAt(fold.from).number).to.equal(2)
        expect(view.state.doc.lineAt(fold.to).number).to.equal(
          view.state.doc.lines
        )
      })
    })

    describe('with two foldable sections', function () {
      let view: EditorView, content: string[]

      beforeEach(function () {
        content = [
          'hello',
          '\\section{one}',
          'a',
          'b',
          '\\section{two}',
          'c',
          'd',
        ]
        view = makeView(content)
      })

      it('should produce two folds', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(2)
        expect(view.state.doc.lineAt(folds[0].from).number).to.equal(2)
        expect(view.state.doc.lineAt(folds[0].to).number).to.equal(4)
        expect(view.state.doc.lineAt(folds[1].from).number).to.equal(5)
        expect(view.state.doc.lineAt(folds[1].to).number).to.equal(
          view.state.doc.lines
        )
      })
    })

    describe('with realistic nesting', function () {
      let view: EditorView, content: string[]

      beforeEach(function () {
        content = [
          'hello',
          '\\chapter{1}',
          '  a',
          '  \\section{1.1}',
          '    a',
          '    \\subsection{1.1.1}',
          '      a',
          '   \\section{1.2}',
          '     a',
          '     \\subsection{1.2.1}',
          '       a',
          '\\chapter{2}',
          '  a',
          '  \\section{2.1}',
          '    a',
          '  \\section{2.2}',
          '    a',
        ]
        view = makeView(content)
      })

      it('should produce many folds', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(8)

        const foldDescriptions = folds.map(fold => {
          const fromLine = view.state.doc.lineAt(fold.from).number
          const toLine = view.state.doc.lineAt(fold.to).number
          return { fromLine, toLine }
        })

        expect(foldDescriptions).to.deep.equal([
          { fromLine: 2, toLine: 11 },
          { fromLine: 4, toLine: 7 },
          { fromLine: 6, toLine: 7 },
          { fromLine: 8, toLine: 11 },
          { fromLine: 10, toLine: 11 },
          { fromLine: 12, toLine: 17 },
          { fromLine: 14, toLine: 15 },
          { fromLine: 16, toLine: 17 },
        ])
      })
    })
  })

  describe('Environment folding', function () {
    describe('with single environment', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['\\begin{foo}', 'content', '\\end{foo}']
        view = makeView(content)
      })

      it('should fold the environment', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(1)
        expect(folds).to.deep.equal([{ from: 11, to: 20 }])
      })
    })

    describe('with nested environment', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = [
          '\\begin{foo}',
          '\\begin{bar}',
          'content',
          '\\end{bar}',
          '\\end{foo}',
        ]
        view = makeView(content)
      })

      it('should fold the environment', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(2)
        expect(folds).to.deep.equal([
          { from: 11, to: 42 },
          { from: 23, to: 32 },
        ])
      })
    })
  })

  describe('Comment folding', function () {
    describe('with a single set of comments', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['Hello', '% {', 'this is folded', '% }', 'End']
        view = makeView(content)
      })

      it('should fold the region marked by comments', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(1)
        expect(folds).to.deep.equal([{ from: 9, to: 27 }])
      })
    })

    describe('with several sets of comments', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = [
          'Hello',
          '% {',
          'this is folded',
          '% }',
          '',
          '% {',
          'and this also',
          '% }',
          'End',
        ]
        view = makeView(content)
      })

      it('should fold both regions marked by comments', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(2)
        expect(folds).to.deep.equal([
          { from: 9, to: 27 },
          { from: 33, to: 50 },
        ])
      })
    })

    describe('with nested sets of comments', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = [
          'Hello',
          '% {',
          'one',
          '% {',
          'two',
          '% {',
          'three',
          '% }',
          'two',
          '% }',
          'one',
          '% }',
          'End',
        ]
        view = makeView(content)
      })

      it('should fold all the regions marked by comments, with nesting', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(3)
        expect(folds).to.deep.equal([
          { from: 9, to: 50 },
          { from: 17, to: 42 },
          { from: 25, to: 34 },
        ])
      })
    })

    describe('with fold comment spanning entire document', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['% {', 'Hello', '% }']
        view = makeView(content)
      })

      it('should fold', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(1)
        expect(folds).to.deep.equal([{ from: 3, to: 12 }])
      })
    })

    describe('with fold comment at start of document', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['% {', 'Hello', '% }', 'Test']
        view = makeView(content)
      })

      it('should fold', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(1)
        expect(folds).to.deep.equal([{ from: 3, to: 12 }])
      })
    })

    describe('with fold comment at end of document', function () {
      let view: EditorView, content: string[]
      beforeEach(function () {
        content = ['Test', '% {', 'Hello', '% }']
        view = makeView(content)
      })

      it('should fold', function () {
        const folds = _getFolds(view)
        expect(folds.length).to.equal(1)
        expect(folds).to.deep.equal([{ from: 8, to: 17 }])
      })
    })
  })
})
