const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/js/RangesManager.js'

describe('RangesManager', function () {
  beforeEach(function () {
    this.RangesManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/metrics': (this.Metrics = { histogram: sinon.stub() }),
      },
    })

    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.user_id = 'user-id-123'
  })

  describe('applyUpdate', function () {
    beforeEach(function () {
      this.updates = [
        {
          meta: {
            user_id: this.user_id,
          },
          op: [
            {
              i: 'two ',
              p: 4,
            },
          ],
        },
      ]
      this.entries = {
        comments: [
          {
            op: {
              c: 'three ',
              p: 4,
            },
            metadata: {
              user_id: this.user_id,
            },
          },
        ],
        changes: [
          {
            op: {
              i: 'five',
              p: 15,
            },
            metadata: {
              user_id: this.user_id,
            },
          },
        ],
      }
      this.newDocLines = ['one two three four five']
    }) // old is "one three four five"

    describe('successfully', function () {
      beforeEach(function () {
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
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
    })

    describe('with empty comments', function () {
      beforeEach(function () {
        this.entries.comments = []
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines
        )
      })

      it('should return an object with no comments', function () {
        // Save space in redis and don't store just {}
        expect(this.result.newRanges.comments).to.be.undefined
      })
    })

    describe('with empty changes', function () {
      beforeEach(function () {
        this.entries.changes = []
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines
        )
      })

      it('should return an object with no changes', function () {
        // Save space in redis and don't store just {}
        expect(this.result.newRanges.changes).to.be.undefined
      })
    })

    describe('with too many comments', function () {
      beforeEach(function () {
        this.RangesManager.MAX_COMMENTS = 2
        this.updates = [
          {
            meta: {
              user_id: this.user_id,
            },
            op: [
              {
                c: 'one',
                p: 0,
                t: 'thread-id-1',
              },
            ],
          },
        ]
        this.entries = {
          comments: [
            {
              op: {
                c: 'three ',
                p: 4,
                t: 'thread-id-2',
              },
              metadata: {
                user_id: this.user_id,
              },
            },
            {
              op: {
                c: 'four ',
                p: 10,
                t: 'thread-id-3',
              },
              metadata: {
                user_id: this.user_id,
              },
            },
          ],
          changes: [],
        }
      })

      it('should throw an error', function () {
        expect(() => {
          this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.entries,
            this.updates,
            this.newDocLines
          )
        }).to.throw('too many comments or tracked changes')
      })
    })

    describe('with too many changes', function () {
      beforeEach(function () {
        this.RangesManager.MAX_CHANGES = 2
        this.updates = [
          {
            meta: {
              user_id: this.user_id,
              tc: 'track-changes-id-yes',
            },
            op: [
              {
                i: 'one ',
                p: 0,
              },
            ],
          },
        ]
        this.entries = {
          changes: [
            {
              op: {
                i: 'three',
                p: 4,
              },
              metadata: {
                user_id: this.user_id,
              },
            },
            {
              op: {
                i: 'four',
                p: 10,
              },
              metadata: {
                user_id: this.user_id,
              },
            },
          ],
          comments: [],
        }
        this.newDocLines = ['one two three four']
      })

      it('should throw an error', function () {
        expect(() => {
          this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.entries,
            this.updates,
            this.newDocLines
          )
        }).to.throw('too many comments or tracked changes')
      })
    })

    describe('inconsistent changes', function () {
      beforeEach(function () {
        this.updates = [
          {
            meta: {
              user_id: this.user_id,
            },
            op: [
              {
                c: "doesn't match",
                p: 0,
              },
            ],
          },
        ]
      })

      it('should throw an error', function () {
        expect(() => {
          this.RangesManager.applyUpdate(
            this.project_id,
            this.doc_id,
            this.entries,
            this.updates,
            this.newDocLines
          )
        }).to.throw(
          'Change ({"op":{"i":"five","p":15},"metadata":{"user_id":"user-id-123"}}) doesn\'t match text ("our ")'
        )
      })
    })

    describe('with an update that collapses a range', function () {
      beforeEach(function () {
        this.updates = [
          {
            meta: {
              user_id: this.user_id,
            },
            op: [
              {
                d: 'one',
                p: 0,
                t: 'thread-id-1',
              },
            ],
          },
        ]
        this.entries = {
          comments: [
            {
              op: {
                c: 'n',
                p: 1,
                t: 'thread-id-2',
              },
              metadata: {
                user_id: this.user_id,
              },
            },
          ],
          changes: [],
        }
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
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
        this.updates = [
          {
            meta: {
              user_id: this.user_id,
            },
            op: [
              {
                d: 'one two three four five',
                p: 0,
              },
            ],
          },
        ]
        this.entries = {
          comments: [
            {
              op: {
                c: 'n',
                p: 1,
                t: 'thread-id-2',
              },
              metadata: {
                user_id: this.user_id,
              },
            },
          ],
          changes: [
            {
              op: {
                i: 'hello',
                p: 1,
                t: 'thread-id-2',
              },
              metadata: {
                user_id: this.user_id,
              },
            },
          ],
        }
        this.result = this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
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
        changes: [
          {
            id: 'a1',
            op: {
              i: 'lorem',
              p: 0,
            },
          },
          {
            id: 'a2',
            op: {
              i: 'ipsum',
              p: 10,
            },
          },
          {
            id: 'a3',
            op: {
              i: 'dolor',
              p: 20,
            },
          },
          {
            id: 'a4',
            op: {
              i: 'sit',
              p: 30,
            },
          },
          {
            id: 'a5',
            op: {
              i: 'amet',
              p: 40,
            },
          },
        ],
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
