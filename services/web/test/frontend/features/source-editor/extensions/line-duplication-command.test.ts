import { foldEffect, foldState } from '@codemirror/language'
import { EditorSelection, EditorState } from '@codemirror/state'
import { DecorationSet, EditorView } from '@codemirror/view'
import { expect } from 'chai'
import { duplicateSelection } from '../../../../../frontend/js/features/source-editor/commands/ranges'

type Position = {
  from: number
  to: number
}

function folds(foldRanges: DecorationSet) {
  const ranges: Position[] = []
  foldRanges.between(Number.MIN_VALUE, Number.MAX_VALUE, (from, to) => {
    ranges.push({ from, to })
  })
  return ranges
}

describe('Line duplication command', function () {
  describe('For single selections', function () {
    describe('For cursor selection', function () {
      it('Cursor selection duplicates line downwards', function () {
        const view = new EditorView({
          doc: 'line1\nline2',
          selection: EditorSelection.cursor(0),
        })

        duplicateSelection(view)

        expect(view.state.doc.toString()).to.equal('line1\nline1\nline2')

        expect(view.state.selection.ranges.length).to.equal(1)
        expect(view.state.selection.ranges[0].eq(EditorSelection.cursor(0))).to
          .be.true
      })

      it('Preserves folded ranges', function () {
        const view = new EditorView({
          doc: '\\begin{itemize}\n\t\\item test\n\\end{itemize}',
          extensions: foldState,
        })

        view.dispatch(
          view.state.update({
            selection: EditorSelection.cursor(0),
            // Fold to \begin{itemize}...\end{itemize}
            effects: [foldEffect.of({ from: 15, to: 28 })],
          })
        )

        duplicateSelection(view)

        expect(folds(view.state.field(foldState))).to.deep.equal([
          { from: 15, to: 28 },
          { from: 57, to: 70 },
        ])

        expect(view.state.selection.ranges.length).to.equal(1)
        expect(view.state.selection.ranges[0].eq(EditorSelection.cursor(0))).to
          .be.true
      })
    })
    describe('For range selections', function () {
      it('Duplicates line with a cursor downwards', function () {
        const view = new EditorView({
          doc: 'line1\nline2',
          selection: EditorSelection.cursor(0),
        })

        duplicateSelection(view)

        expect(view.state.doc.toString()).to.equal('line1\nline1\nline2')
      })

      it('Duplicates range forwards', function () {
        const view = new EditorView({
          doc: 'line1\nline2',
          selection: EditorSelection.range(0, 5),
        })

        duplicateSelection(view)

        expect(view.state.doc.toString()).to.equal('line1line1\nline2')
        expect(view.state.selection.ranges.length).to.equal(1)
        expect(view.state.selection.ranges[0].eq(EditorSelection.range(5, 10)))
          .to.be.true
      })

      it('Duplicates range backwards', function () {
        const view = new EditorView({
          doc: 'line1\nline2',
          selection: EditorSelection.range(5, 0),
        })

        duplicateSelection(view)

        expect(view.state.doc.toString()).to.equal('line1line1\nline2')
        expect(view.state.selection.ranges.length).to.equal(1)
        expect(view.state.selection.ranges[0].eq(EditorSelection.range(5, 0)))
          .to.be.true
      })
    })
  })

  describe('For multiple selections', function () {
    it('Preserves folded ranges', function () {
      const doc =
        '\\begin{itemize}\n\t\\item line1\n\\end{itemize}\n\\begin{itemize}\n\t\\item line2\n\\end{itemize}'
      const view = new EditorView({
        doc,
        extensions: [foldState, EditorState.allowMultipleSelections.of(true)],
      })

      view.dispatch(
        view.state.update({
          selection: EditorSelection.create([
            EditorSelection.cursor(0),
            EditorSelection.cursor(43),
          ]),
          effects: [
            foldEffect.of({ from: 15, to: 29 }),
            foldEffect.of({ from: 58, to: 72 }),
          ],
        })
      )

      duplicateSelection(view)

      expect(view.state.doc.toString()).to.equal(
        '\\begin{itemize}\n\t\\item line1\n\\end{itemize}\n\\begin{itemize}\n\t\\item line1\n\\end{itemize}\n\\begin{itemize}\n\t\\item line2\n\\end{itemize}\n\\begin{itemize}\n\t\\item line2\n\\end{itemize}'
      )

      expect(folds(view.state.field(foldState))).to.deep.equal([
        { from: 15, to: 29 },
        { from: 58, to: 72 },
        { from: 101, to: 115 },
        { from: 144, to: 158 },
      ])

      expect(view.state.selection.ranges.length).to.equal(2)
      expect(view.state.selection.ranges[0].eq(EditorSelection.cursor(0))).to.be
        .true
      expect(view.state.selection.ranges[1].eq(EditorSelection.cursor(86))).to
        .be.true
    })

    it('Duplicates all selections', function () {
      const view = new EditorView({
        doc: 'line1\nline2',
        extensions: [EditorState.allowMultipleSelections.of(true)],
        selection: EditorSelection.create([
          EditorSelection.cursor(1),
          EditorSelection.range(7, 9),
        ]),
      })

      duplicateSelection(view)

      expect(view.state.doc.toString()).to.equal('line1\nline1\nlinine2')

      expect(view.state.selection.ranges.length).to.equal(2)
      expect(view.state.selection.ranges[0].eq(EditorSelection.cursor(1))).to.be
        .true
      expect(view.state.selection.ranges[1].eq(EditorSelection.range(15, 17)))
        .to.be.true
    })
  })
})
