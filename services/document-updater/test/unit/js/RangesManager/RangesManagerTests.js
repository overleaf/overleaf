const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/js/RangesManager.js'
const TEST_USER_ID = 'user-id-123'

describe('RangesManager', function () {
  beforeEach(function () {
    this.RangesManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/metrics': (this.Metrics = { histogram: sinon.stub() }),
      },
    })

    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.user_id = TEST_USER_ID
  })

  describe('applyUpdate', function () {
    beforeEach(function () {
      this.ops = [{ i: 'two ', p: 4 }]
      this.historyOps = [{ i: 'two ', p: 4, hpos: 4 }]
      this.meta = { user_id: this.user_id }
      this.updates = [{ meta: this.meta, op: this.ops }]
      this.ranges = {
        comments: makeRanges([{ c: 'three ', p: 4 }]),
        changes: makeRanges([{ i: 'five', p: 15 }]),
      }
      this.newDocLines = ['one two three four five']
      // old is "one three four five"
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.ranges,
          this.updates,
          this.newDocLines
        )
      })

      it('should return the modified the comments and changes', function () {
        expect(this.result.rangesWereCollapsed).to.equal(false)
        this.result.newRanges.comments[0].op.should.deep.equal({
          c: 'three ',
          p: 8,
        })
        this.result.newRanges.changes[0].op.should.deep.equal({
          i: 'five',
          p: 19,
        })
      })

      it('should return unmodified updates for the history', function () {
        expect(this.result.historyUpdates).to.deep.equal(this.updates)
      })
    })

    describe('with empty comments', function () {
      beforeEach(function () {
        this.ranges.comments = []
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.ranges,
          this.updates,
          this.newDocLines
        )
      })

      it('should return an object with no comments', function () {
        // Save space in redis and don't store just {}
        expect(this.result.newRanges.comments).to.be.undefined
      })

      it('should return unmodified updates for the history', function () {
        expect(this.result.historyUpdates).to.deep.equal(this.updates)
      })
    })

    describe('with empty changes', function () {
      beforeEach(function () {
        this.ranges.changes = []
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.ranges,
          this.updates,
          this.newDocLines
        )
      })

      it('should return an object with no changes', function () {
        // Save space in redis and don't store just {}
        expect(this.result.newRanges.changes).to.be.undefined
      })

      it('should return unmodified updates for the history', function () {
        expect(this.result.historyUpdates).to.deep.equal(this.updates)
      })
    })

    describe('with too many comments', function () {
      beforeEach(function () {
        this.RangesManager.MAX_COMMENTS = 2
        this.updates = makeUpdates([{ c: 'one', p: 0, t: 'thread-id-1' }])
        this.ranges = {
          comments: makeRanges([
            { c: 'three ', p: 4, t: 'thread-id-2' },
            { c: 'four ', p: 10, t: 'thread-id-3' },
          ]),
          changes: [],
        }
      })

      it('should throw an error', function () {
        expect(() => {
          this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines
          )
        }).to.throw('too many comments or tracked changes')
      })
    })

    describe('with too many changes', function () {
      beforeEach(function () {
        this.RangesManager.MAX_CHANGES = 2
        this.updates = makeUpdates([{ i: 'one ', p: 0 }], {
          tc: 'track-changes-id-yes',
        })
        this.ranges = {
          changes: makeRanges([
            {
              i: 'three',
              p: 4,
            },
            {
              i: 'four',
              p: 10,
            },
          ]),
          comments: [],
        }
        this.newDocLines = ['one two three four']
      })

      it('should throw an error', function () {
        expect(() => {
          this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines
          )
        }).to.throw('too many comments or tracked changes')
      })
    })

    describe('inconsistent changes', function () {
      beforeEach(function () {
        this.updates = makeUpdates([{ c: "doesn't match", p: 0 }])
      })

      it('should throw an error', function () {
        expect(() => {
          this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines
          )
        }).to.throw(
          'Change ({"id":"1","op":{"i":"five","p":15},"metadata":{"user_id":"user-id-123"}}) doesn\'t match text ("our ")'
        )
      })
    })

    describe('with an update that collapses a range', function () {
      beforeEach(function () {
        this.updates = makeUpdates([{ d: 'one', p: 0, t: 'thread-id-1' }])
        this.ranges = {
          comments: makeRanges([
            {
              c: 'n',
              p: 1,
              t: 'thread-id-2',
            },
          ]),
          changes: [],
        }
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.ranges,
          this.updates,
          this.newDocLines
        )
      })

      it('should return ranges_were_collapsed == true', function () {
        expect(this.result.rangesWereCollapsed).to.equal(true)
      })
    })

    describe('with an update that deletes ranges', function () {
      beforeEach(function () {
        this.updates = makeUpdates([{ d: 'one two three four five', p: 0 }])
        this.ranges = {
          comments: makeRanges([{ c: 'n', p: 1, t: 'thread-id-2' }]),
          changes: makeRanges([{ i: 'hello', p: 1, t: 'thread-id-2' }]),
        }
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.ranges,
          this.updates,
          this.newDocLines
        )
      })

      it('should increment the range-delta histogram', function () {
        this.Metrics.histogram.called.should.equal(true)
      })

      it('should return ranges_were_collapsed == true', function () {
        expect(this.result.rangesWereCollapsed).to.equal(true)
      })
    })

    describe('with comment updates', function () {
      beforeEach(function () {
        this.updates = makeUpdates([
          { i: 'two ', p: 4 },
          { c: 'one', p: 0 },
        ])
        this.ranges = {}
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.ranges,
          this.updates,
          this.newDocLines
        )
      })

      it('should not send comments to the history', function () {
        expect(this.result.historyUpdates[0].op).to.deep.equal([
          { i: 'two ', p: 4 },
        ])
      })
    })

    describe('with history ranges support', function () {
      describe('inserts among tracked deletes', function () {
        beforeEach(function () {
          // original text is "on[1]e[22] [333](three) fo[4444]ur five"
          // [] denotes tracked deletes
          // () denotes tracked inserts
          this.ranges = {
            changes: makeRanges([
              { d: '1', p: 2 },
              { d: '22', p: 3 },
              { d: '333', p: 4 },
              { i: 'three', p: 4 },
              { d: '4444', p: 12 },
            ]),
          }
          this.updates = makeUpdates([
            { i: 'zero ', p: 0 },
            { i: 'two ', p: 9, u: true },
          ])
          this.newDocLines = ['zero one two three four five']
          this.result = this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines,
            { historyRangesSupport: true }
          )
        })

        it('should offset the hpos by the length of tracked deletes before the insert', function () {
          expect(this.result.historyUpdates.map(x => x.op)).to.deep.equal([
            [{ i: 'zero ', p: 0 }],
            // 'two' is added just before the "333" tracked delete
            [{ i: 'two ', p: 9, u: true, hpos: 12 }],
          ])
        })
      })

      describe('tracked delete rejections', function () {
        beforeEach(function () {
          // original text is "one [two ]three four five"
          // [] denotes tracked deletes
          this.ranges = {
            changes: makeRanges([{ d: 'two ', p: 4 }]),
          }
          this.updates = makeUpdates([{ i: 'tw', p: 4, u: true }])
          this.newDocLines = ['one twthree four five']
          this.result = this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines,
            { historyRangesSupport: true }
          )
        })

        it('should mark the insert as a tracked delete rejection where appropriate', function () {
          expect(this.result.historyUpdates.map(x => x.op)).to.deep.equal([
            [{ i: 'tw', p: 4, u: true, trackedDeleteRejection: true }],
          ])
        })
      })

      describe('deletes among tracked deletes', function () {
        beforeEach(function () {
          // original text is "on[1]e [22](three) f[333]ou[4444]r [55555]five"
          // [] denotes tracked deletes
          // () denotes tracked inserts
          this.ranges = {
            comments: [],
            changes: makeRanges([
              { d: '1', p: 2 },
              { d: '22', p: 4 },
              { i: 'three', p: 4 },
              { d: '333', p: 11 },
              { d: '4444', p: 13 },
              { d: '55555', p: 15 },
            ]),
          }
          this.updates = makeUpdates([
            { d: 'four ', p: 10 },
            { d: 'three ', p: 4 },
          ])
          this.newDocLines = ['one five']
          this.result = this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines,
            { historyRangesSupport: true }
          )
        })

        it('should split and offset deletes appropriately', function () {
          expect(this.result.historyUpdates.map(x => x.op)).to.deep.equal([
            [
              // the "four" delete has tracked deletes inside it, add splits
              {
                d: 'four ',
                p: 10,
                hpos: 13,
                hsplits: [
                  { offset: 1, length: 3 },
                  { offset: 3, length: 4 },
                ],
              },
            ],

            // the "three" delete is offset to the right by the two first tracked
            // deletes
            [{ d: 'three ', p: 4, hpos: 7 }],
          ])
        })
      })

      describe('comments among tracked deletes', function () {
        beforeEach(function () {
          // original text is "on[1]e[22] [333](three) fo[4444]ur five"
          // [] denotes tracked deletes
          // () denotes tracked inserts
          this.ranges = {
            changes: makeRanges([
              { d: '1', p: 2 },
              { d: '22', p: 3 },
              { d: '333', p: 4 },
              { i: 'three', p: 4 },
              { d: '4444', p: 12 },
            ]),
          }
          this.updates = makeUpdates([
            { c: 'three ', p: 4 },
            { c: 'four ', p: 10 },
          ])
          this.newDocLines = ['one three four five']
          this.result = this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines,
            { historyRangesSupport: true }
          )
        })

        it('should offset the hpos by the length of tracked deletes before the insert', function () {
          expect(this.result.historyUpdates.map(x => x.op)).to.deep.equal([
            [{ c: 'three ', p: 4, hpos: 10 }],
            [{ c: 'four ', p: 10, hpos: 16, hlen: 9 }],
          ])
        })
      })

      describe('inserts inside comments', function () {
        beforeEach(function () {
          // original text is "one three four five"
          this.ranges = {
            comments: makeRanges([
              { c: 'three', p: 4, t: 'comment-id-1' },
              { c: 'ree four', p: 6, t: 'comment-id-2' },
            ]),
          }
          this.updates = makeUpdates([
            { i: '[before]', p: 4 },
            { i: '[inside]', p: 13 }, // 4 + 8 + 1
            { i: '[overlap]', p: 23 }, // 13 + 8 + 2
            { i: '[after]', p: 39 }, // 23 + 9 + 7
          ])
          this.newDocLines = [
            'one [before]t[inside]hr[overlap]ee four[after] five',
          ]
          this.result = this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.ranges,
            this.updates,
            this.newDocLines,
            { historyRangesSupport: true }
          )
        })

        it('should add the proper commentIds properties to ops', function () {
          expect(this.result.historyUpdates.map(x => x.op)).to.deep.equal([
            [{ i: '[before]', p: 4 }],
            [{ i: '[inside]', p: 13, commentIds: ['comment-id-1'] }],
            [
              {
                i: '[overlap]',
                p: 23,
                commentIds: ['comment-id-1', 'comment-id-2'],
              },
            ],
            [{ i: '[after]', p: 39 }],
          ])
        })
      })
    })
  })

  describe('acceptChanges', function () {
    beforeEach(function () {
      this.RangesManager = SandboxedModule.require(MODULE_PATH, {
        requires: {
          '@overleaf/ranges-tracker': (this.RangesTracker =
            SandboxedModule.require('@overleaf/ranges-tracker')),
          '@overleaf/metrics': {},
        },
      })

      this.ranges = {
        comments: [],
        changes: makeRanges([
          { i: 'lorem', p: 0 },
          { i: 'ipsum', p: 10 },
          { i: 'dolor', p: 20 },
          { i: 'sit', p: 30 },
          { i: 'amet', p: 40 },
        ]),
      }
      this.removeChangeIdsSpy = sinon.spy(
        this.RangesTracker.prototype,
        'removeChangeIds'
      )
    })

    describe('successfully with a single change', function () {
      beforeEach(function () {
        this.change_ids = [this.ranges.changes[1].id]
        this.result = this.RangesManager.acceptChanges(
          this.change_ids,
          this.ranges
        )
      })

      it('should log the call with the correct number of changes', function () {
        this.logger.debug
          .calledWith('accepting 1 changes in ranges')
          .should.equal(true)
      })

      it('should delegate the change removal to the ranges tracker', function () {
        this.removeChangeIdsSpy.calledWith(this.change_ids).should.equal(true)
      })

      it('should remove the change', function () {
        expect(
          this.result.changes.find(
            change => change.id === this.ranges.changes[1].id
          )
        ).to.be.undefined
      })

      it('should return the original number of changes minus 1', function () {
        this.result.changes.length.should.equal(this.ranges.changes.length - 1)
      })

      it('should not touch other changes', function () {
        for (const i of [0, 2, 3, 4]) {
          expect(
            this.result.changes.find(
              change => change.id === this.ranges.changes[i].id
            )
          ).to.deep.equal(this.ranges.changes[i])
        }
      })
    })

    describe('successfully with multiple changes', function () {
      beforeEach(function () {
        this.change_ids = [
          this.ranges.changes[1].id,
          this.ranges.changes[3].id,
          this.ranges.changes[4].id,
        ]
        this.result = this.RangesManager.acceptChanges(
          this.change_ids,
          this.ranges
        )
      })

      it('should log the call with the correct number of changes', function () {
        this.logger.debug
          .calledWith(`accepting ${this.change_ids.length} changes in ranges`)
          .should.equal(true)
      })

      it('should delegate the change removal to the ranges tracker', function () {
        this.removeChangeIdsSpy.calledWith(this.change_ids).should.equal(true)
      })

      it('should remove the changes', function () {
        for (const i of [1, 3, 4]) {
          expect(
            this.result.changes.find(
              change => change.id === this.ranges.changes[i].id
            )
          ).to.be.undefined
        }
      })

      it('should return the original number of changes minus the number of accepted changes', function () {
        this.result.changes.length.should.equal(this.ranges.changes.length - 3)
      })

      it('should not touch other changes', function () {
        for (const i of [0, 2]) {
          expect(
            this.result.changes.find(
              change => change.id === this.ranges.changes[i].id
            )
          ).to.deep.equal(this.ranges.changes[i])
        }
      })
    })
  })
})

function makeRanges(ops) {
  let id = 1
  const changes = []
  for (const op of ops) {
    changes.push({
      id: id.toString(),
      op,
      metadata: { user_id: TEST_USER_ID },
    })
    id += 1
  }
  return changes
}

function makeUpdates(ops, meta = {}) {
  const updates = []
  for (const op of ops) {
    updates.push({
      meta: { user_id: TEST_USER_ID, ...meta },
      op: [op],
    })
  }
  return updates
}
