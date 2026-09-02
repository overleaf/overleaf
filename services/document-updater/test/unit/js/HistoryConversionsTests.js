const _ = require('lodash')
const { expect } = require('chai')
const HistoryConversions = require('../../../app/js/HistoryConversions')

describe('HistoryConversions', function () {
  describe('toHistoryRanges', function () {
    it('handles empty ranges', function () {
      expect(HistoryConversions.toHistoryRanges({})).to.deep.equal({})
    })

    it("doesn't modify comments when there are no tracked changes", function () {
      const ranges = {
        comments: [makeComment('comment1', 5, 12)],
      }
      const historyRanges = HistoryConversions.toHistoryRanges(ranges)
      expect(historyRanges).to.deep.equal(ranges)
    })

    it('adjusts comments and tracked changes to account for tracked deletes', function () {
      const comments = [
        makeComment('comment0', 0, 1),
        makeComment('comment1', 10, 12),
        makeComment('comment2', 20, 10),
        makeComment('comment3', 15, 3),
      ]
      const changes = [
        makeTrackedDelete('change0', 2, 5),
        makeTrackedInsert('change1', 4, 5),
        makeTrackedDelete('change2', 10, 10),
        makeTrackedDelete('change3', 21, 6),
        makeTrackedDelete('change4', 50, 7),
      ]
      const ranges = { comments, changes }

      const historyRanges = HistoryConversions.toHistoryRanges(ranges)
      expect(historyRanges.comments).to.have.deep.members([
        comments[0],
        // shifted by change0 and change2, extended by change3
        enrichOp(comments[1], {
          hpos: 25, // 10 + 5 + 10
          hlen: 18, // 12 + 6
        }),
        // shifted by change0 and change2, extended by change3
        enrichOp(comments[2], {
          hpos: 35, // 20 + 5 + 10
          hlen: 16, // 10 + 6
        }),
        // shifted by change0 and change2
        enrichOp(comments[3], {
          hpos: 30, // 15 + 5 + 10
        }),
      ])
      expect(historyRanges.changes).to.deep.equal([
        changes[0],
        enrichOp(changes[1], {
          hpos: 9, // 4 + 5
        }),
        enrichOp(changes[2], {
          hpos: 15, // 10 + 5
        }),
        enrichOp(changes[3], {
          hpos: 36, // 21 + 5 + 10
        }),
        enrichOp(changes[4], {
          hpos: 71, // 50 + 5 + 10 + 6
        }),
      ])
    })
  })

  describe('toHistoryOT', function () {
    it('handles empty ranges', function () {
      expect(HistoryConversions.toHistoryOT(['one two'], {}, [])).to.deep.equal(
        {
          content: 'one two',
        }
      )
    })

    it('converts tracked changes and comments', function () {
      const metadata = makeMetadata()
      const ranges = {
        changes: [
          { id: 'change0', op: { p: 4, d: 'two ' }, metadata },
          { id: 'change1', op: { p: 4, i: 'three' }, metadata },
        ],
        comments: [
          { id: 'comment0', op: { p: 4, c: 'three', t: 'comment0' } },
          { id: 'comment1', op: { p: 0, c: '', t: 'comment1' } },
        ],
      }
      const raw = HistoryConversions.toHistoryOT(['one three'], ranges, [
        'comment0',
      ])
      expect(raw).to.deep.equal({
        content: 'one two three',
        comments: [
          {
            id: 'comment1', // detached comment, sorted first by position
            ranges: [],
          },
          {
            id: 'comment0',
            ranges: [{ pos: 8, length: 5 }],
            resolved: true,
          },
        ],
        trackedChanges: [
          {
            range: { pos: 4, length: 4 },
            tracking: { type: 'delete', userId: 'user-id', ts: metadata.ts },
          },
          {
            range: { pos: 8, length: 5 },
            tracking: { type: 'insert', userId: 'user-id', ts: metadata.ts },
          },
        ],
      })
    })
  })

  describe('fromHistoryOT', function () {
    it('handles a doc without ranges', function () {
      expect(
        HistoryConversions.fromHistoryOT({ content: 'one two' })
      ).to.deep.equal({
        lines: ['one two'],
        ranges: {},
      })
    })

    it('converts tracked changes and comments', function () {
      const ts = new Date().toISOString()
      const raw = {
        content: 'one two three',
        trackedChanges: [
          {
            range: { pos: 4, length: 4 },
            tracking: { type: 'delete', userId: 'user-id', ts },
          },
          {
            range: { pos: 8, length: 5 },
            tracking: { type: 'insert', userId: 'user-id', ts },
          },
        ],
        comments: [
          { id: 'comment0', ranges: [{ pos: 8, length: 5 }], resolved: true },
          { id: 'comment1', ranges: [] },
        ],
      }
      const { lines, ranges } = HistoryConversions.fromHistoryOT(raw)
      expect(lines).to.deep.equal(['one three'])

      for (const change of ranges.changes) {
        expect(change.id).to.be.a('string').and.to.have.length.above(0)
      }
      expect(
        ranges.changes.map(({ op, metadata }) => ({ op, metadata }))
      ).to.deep.equal([
        { op: { p: 4, d: 'two ' }, metadata: { user_id: 'user-id', ts } },
        { op: { p: 4, i: 'three' }, metadata: { user_id: 'user-id', ts } },
      ])

      expect(ranges.comments).to.deep.equal([
        {
          id: 'comment0',
          op: { p: 4, c: 'three', t: 'comment0', resolved: true },
        },
        {
          id: 'comment1',
          op: { p: 0, c: '', t: 'comment1', resolved: false },
        },
      ])
    })
  })
})

function makeComment(id, pos, length) {
  return {
    id,
    op: {
      c: 'c'.repeat(length),
      p: pos,
      t: id,
    },
    metadata: makeMetadata(),
  }
}

function makeTrackedInsert(id, pos, length) {
  return {
    id,
    op: {
      i: 'i'.repeat(length),
      p: pos,
    },
    metadata: makeMetadata(),
  }
}

function makeTrackedDelete(id, pos, length) {
  return {
    id,
    op: {
      d: 'd'.repeat(length),
      p: pos,
    },
    metadata: makeMetadata(),
  }
}

function makeMetadata() {
  return {
    user_id: 'user-id',
    ts: new Date().toISOString(),
  }
}

function enrichOp(commentOrChange, extraFields) {
  const result = _.cloneDeep(commentOrChange)
  Object.assign(result.op, extraFields)
  return result
}
