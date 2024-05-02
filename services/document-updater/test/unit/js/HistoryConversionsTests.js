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
