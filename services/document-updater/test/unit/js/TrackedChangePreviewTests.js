const { expect } = require('chai')
const {
  buildSparseChangePreviews,
} = require('../../../app/js/TrackedChangePreview')

describe('TrackedChangePreview', function () {
  describe('buildSparseChangePreviews', function () {
    it('returns no previews for empty inputs', function () {
      expect(
        buildSparseChangePreviews({ changes: [], lines: ['a'] })
      ).to.deep.equal([])
      expect(
        buildSparseChangePreviews({ changes: null, lines: ['a'] })
      ).to.deep.equal([])
      expect(
        buildSparseChangePreviews({
          changes: [{ op: { i: 'x', p: 0 } }],
          lines: null,
        })
      ).to.deep.equal([])
    })

    it('finds LaTeX section path from the enclosing header', function () {
      const lines = [
        '\\section{Intro}',
        'Some intro text.',
        '\\subsection{Details}',
        'target line here',
      ]
      const position = lines.slice(0, 3).join('\n').length + 5
      const [preview] = buildSparseChangePreviews({
        changes: [{ op: { i: 'x', p: position } }],
        lines,
      })
      expect(preview.sectionPath).to.deep.equal(['Intro', 'Details'])
    })

    it('returns empty sectionPath when no header precedes the change', function () {
      const lines = ['plain text', 'more text']
      const [preview] = buildSparseChangePreviews({
        changes: [{ op: { i: 'x', p: 5 } }],
        lines,
      })
      expect(preview.sectionPath).to.deep.equal([])
    })

    it('computes 1-based startLine for the first change', function () {
      const lines = ['first', 'second', 'third']
      const [preview] = buildSparseChangePreviews({
        changes: [{ op: { i: 'x', p: 'first\nsecond\n'.length + 1 } }],
        lines,
      })
      expect(preview.startLine).to.equal(3)
    })

    it('attributes a position on a line-terminating newline to that line', function () {
      const lines = ['ab', 'cd']
      const [preview] = buildSparseChangePreviews({
        changes: [{ op: { i: 'x', p: 2 } }],
        lines,
      })
      expect(preview.startLine).to.equal(1)
    })

    it('clamps a position past the end of the document to the last line', function () {
      const lines = ['ab', 'cd']
      const [preview] = buildSparseChangePreviews({
        changes: [{ op: { i: 'x', p: 500 } }],
        lines,
      })
      expect(preview.startLine).to.equal(2)
    })

    it('projects changes to bare ranges-op shape', function () {
      const [preview] = buildSparseChangePreviews({
        changes: [
          {
            id: 'c1',
            op: { i: 'hi', p: 0 },
            metadata: { user_id: 'u1' },
          },
          {
            id: 'c2',
            op: { d: 'x', p: 5 },
            metadata: { user_id: 'u2' },
          },
        ],
        lines: ['abcdefghij'],
      })
      expect(preview.changes).to.deep.equal([
        { i: 'hi', d: undefined, p: 0 },
        { i: undefined, d: 'x', p: 5 },
      ])
    })

    it('slices a bounded window of surrounding doc text', function () {
      const filler = 'x'.repeat(2000)
      const lines = [filler, filler, filler]
      const fullText = lines.join('\n')
      const changePos = filler.length + 1 + 5
      const [preview] = buildSparseChangePreviews({
        changes: [{ op: { i: 'y', p: changePos } }],
        lines,
      })
      // slice should be far shorter than the full doc
      expect(preview.slice.length).to.be.lessThan(fullText.length)
      expect(preview.sliceStart).to.be.lessThanOrEqual(changePos)
      const sliceEndPos = preview.sliceStart + preview.slice.length
      expect(sliceEndPos).to.be.greaterThanOrEqual(changePos)
    })

    it('treats a tracked delete as zero-width when sizing the window', function () {
      const lines = ['Overleaf is and features are listed below.']
      const deletePos = 'Overleaf is '.length
      const [preview] = buildSparseChangePreviews({
        changes: [{ op: { d: 'a great tool ', p: deletePos } }],
        lines,
      })
      // The deleted text is not in `lines`, so the window must not extend by
      // its length past the deletion point.
      expect(preview.slice).to.equal(lines[0])
      expect(preview.sliceStart).to.equal(0)
    })

    describe('clustering', function () {
      it('keeps nearby changes in one preview', function () {
        const lines = ['one two three four five six seven eight nine ten']
        const previews = buildSparseChangePreviews({
          changes: [
            { op: { i: 'a', p: 0 }, metadata: { user_id: 'u1' } },
            { op: { i: 'b', p: 20 }, metadata: { user_id: 'u2' } },
          ],
          lines,
        })
        expect(previews).to.have.length(1)
        expect(previews[0].changes).to.have.length(2)
        expect(previews[0].userIds).to.deep.equal(['u1', 'u2'])
      })

      it('splits distant changes into separate previews', function () {
        const filler = 'x'.repeat(5000)
        const lines = ['\\section{Top}', filler, '\\section{Bottom}', filler]
        const topPos = '\\section{Top}\n'.length + 3
        const bottomPos =
          `\\section{Top}\n${filler}\n\\section{Bottom}\n`.length + 3
        const previews = buildSparseChangePreviews({
          changes: [
            { op: { i: 'a', p: topPos }, metadata: { user_id: 'u1' } },
            { op: { i: 'b', p: bottomPos }, metadata: { user_id: 'u2' } },
          ],
          lines,
        })
        expect(previews).to.have.length(2)
        expect(previews[0].sectionPath).to.deep.equal(['Top'])
        expect(previews[0].startLine).to.equal(2)
        expect(previews[0].userIds).to.deep.equal(['u1'])
        expect(previews[1].sectionPath).to.deep.equal(['Bottom'])
        expect(previews[1].startLine).to.equal(4)
        expect(previews[1].userIds).to.deep.equal(['u2'])
      })

      it('starts the slice on a line boundary without losing the newline', function () {
        const lines = ['first line', 'second line', 'third line']
        const secondLineStart = 'first line\n'.length
        const [preview] = buildSparseChangePreviews({
          changes: [{ op: { i: 'x', p: secondLineStart } }],
          lines,
        })
        expect(preview.sliceStart).to.equal(0)
        expect(preview.slice).to.equal(lines.join('\n'))
      })

      it('bounds each preview slice instead of spanning the whole doc', function () {
        const filler = 'x'.repeat(5000)
        const lines = [filler, filler, filler]
        const lastLineStart = (filler.length + 1) * 2
        const previews = buildSparseChangePreviews({
          changes: [
            { op: { i: 'a', p: 0 } },
            { op: { i: 'b', p: lastLineStart + 10 } },
          ],
          lines,
        })
        expect(previews).to.have.length(2)
        for (const preview of previews) {
          expect(preview.slice.length).to.be.lessThan(1200)
        }
      })

      it('orders previews by position regardless of input order', function () {
        const lines = ['a'.repeat(100), 'b'.repeat(100), 'c'.repeat(100)]
        const previews = buildSparseChangePreviews({
          changes: [
            { op: { i: 'late', p: 250 } },
            { op: { i: 'early', p: 10 } },
          ],
          lines,
        })
        expect(previews.map(p => p.changes[0].i)).to.deep.equal([
          'early',
          'late',
        ])
      })
    })
  })
})
