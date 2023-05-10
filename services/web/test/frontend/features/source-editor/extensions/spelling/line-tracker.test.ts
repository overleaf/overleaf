import { LineTracker } from '../../../../../../frontend/js/features/source-editor/extensions/spelling/line-tracker'
// import sinon from 'sinon'
import { expect } from 'chai'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { Word } from '../../../../../../frontend/js/features/source-editor/extensions/spelling/spellchecker'

const doc = [
  'Hello test one two',
  'three four five six',
  'seven eight nine.',
].join('\n')

describe('LineTracker', function () {
  describe('basic operations', function () {
    let state: EditorState,
      view: EditorView,
      lineTracker: LineTracker,
      check: (spec: [number, any][]) => void
    beforeEach(function () {
      state = EditorState.create({
        doc,
        extensions: [
          EditorView.updateListener.of(update => {
            lineTracker.applyUpdate(update)
          }),
        ],
      })
      view = new EditorView({ state })
      lineTracker = new LineTracker(view.state.doc)
      check = spec => {
        spec.forEach(([n, expectedValue]) => {
          expect(lineTracker.lineHasChanged(n)).to.equal(expectedValue)
        })
      }
    })

    it('start with the correct number of lines', function () {
      expect(state.doc.lines).to.equal(3)
      expect(lineTracker.count()).to.equal(state.doc.lines)
    })

    it('starts with all lines marked as changed', function () {
      expect(state.doc.lines).to.equal(3)
      check([
        [1, true],
        [2, true],
        [3, true],
      ])
    })

    it('clears a line', function () {
      check([[1, true]])
      lineTracker.clearLine(1)
      check([[1, false]])
    })

    it('clears lines based on a list of words', function () {
      lineTracker.clearChangedLinesForWords([
        { lineNumber: 1 },
        { lineNumber: 3 },
      ] as Word[])
      check([
        [1, false],
        [2, true],
        [3, false],
      ])
    })

    it('should update lines in response to text insertion', function () {
      lineTracker.clearChangedLinesForWords([
        { lineNumber: 1 },
        { lineNumber: 2 },
        { lineNumber: 3 },
      ] as Word[])
      check([
        [1, false],
        [2, false],
        [3, false],
      ])

      let transaction = view.state.update({
        changes: [{ from: 0, insert: 'x' }],
      })
      view.dispatch(transaction)
      check([
        [1, true],
        [2, false],
        [3, false],
      ])

      transaction = view.state.update({
        changes: [{ from: view.state.doc.length - 2, insert: 'x' }],
      })
      view.dispatch(transaction)
      check([
        [1, true],
        [2, false],
        [3, true],
      ])
    })

    it('should update lines in response to large text insertion', function () {
      lineTracker.clearChangedLinesForWords([
        { lineNumber: 1 },
        { lineNumber: 2 },
        { lineNumber: 3 },
      ] as Word[])
      check([
        [1, false],
        [2, false],
        [3, false],
      ])

      const text = new Array(1000).fill('x').join('\n')

      const transaction = view.state.update({
        changes: [{ from: 0, insert: text }],
      })
      view.dispatch(transaction)
      expect(lineTracker.count()).to.equal(1002)
      const expectations: [number, boolean][] = []
      for (let i = 1; i <= 1000; i++) {
        expectations.push([i, true])
      }
      expectations.push([1001, false])
      expectations.push([1002, false])
      check(expectations)
    })

    it('should update lines in response to removal of a line', function () {
      lineTracker.clearChangedLinesForWords([
        { lineNumber: 1 },
        { lineNumber: 2 },
        { lineNumber: 3 },
      ] as Word[])
      check([
        [1, false],
        [2, false],
        [3, false],
      ])

      // Overwrite the line plus some part of the second line
      const transaction = view.state.update({
        changes: [{ from: 0, to: doc[0].length + 3, insert: 'x' }],
      })
      view.dispatch(transaction)
      check([
        [1, true],
        [2, false],
      ])
    })

    it('should handle multiple changes', function () {
      lineTracker.clearChangedLinesForWords([
        { lineNumber: 1 },
        { lineNumber: 2 },
        { lineNumber: 3 },
      ] as Word[])
      check([
        [1, false],
        [2, false],
        [3, false],
      ])

      const transaction = view.state.update({
        changes: [
          { from: 0, insert: 'x' },
          { from: doc[0].length + 2, insert: 'xxxxx\nxxxxx\nxxxx' },
        ],
      })
      view.dispatch(transaction)
      check([
        [1, true],
        [2, true],
        [3, true],
        [4, false],
        [5, false],
      ])
    })

    it('should handle multiple deletions', function () {
      const transaction = view.state.update({
        changes: [
          { from: 0, to: 24, insert: '' },
          { from: 39, to: 44, insert: '' },
        ],
      })
      view.dispatch(transaction)
      check([
        [1, true],
        [2, true],
      ])
    })

    it('should handle multiple insertions', function () {
      const transactionUndo = view.state.update({
        changes: [
          { from: 0, to: 0, insert: 'big change\n'.repeat(20) },
          { from: 50, to: 50, insert: 'xxxx' },
        ],
      })
      view.dispatch(transactionUndo)
    })
  })
})
