/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/RangesManager.js'
const SandboxedModule = require('sandboxed-module')

describe('RangesManager', function () {
  beforeEach(function () {
    this.RangesManager = SandboxedModule.require(modulePath)

    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.user_id = 'user-id-123'
    return (this.callback = sinon.stub())
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
      return (this.newDocLines = ['one two three four five'])
    }) // old is "one three four five"

    describe('successfully', function () {
      beforeEach(function () {
        return this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines,
          this.callback
        )
      })

      return it('should return the modified the comments and changes', function () {
        this.callback.called.should.equal(true)
        const [error, entries, ranges_were_collapsed] = Array.from(
          this.callback.args[0]
        )
        expect(error).to.be.null
        expect(ranges_were_collapsed).to.equal(false)
        entries.comments[0].op.should.deep.equal({
          c: 'three ',
          p: 8,
        })
        return entries.changes[0].op.should.deep.equal({
          i: 'five',
          p: 19,
        })
      })
    })

    describe('with empty comments', function () {
      beforeEach(function () {
        this.entries.comments = []
        return this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines,
          this.callback
        )
      })

      return it('should return an object with no comments', function () {
        // Save space in redis and don't store just {}
        this.callback.called.should.equal(true)
        const [error, entries] = Array.from(this.callback.args[0])
        expect(error).to.be.null
        return expect(entries.comments).to.be.undefined
      })
    })

    describe('with empty changes', function () {
      beforeEach(function () {
        this.entries.changes = []
        return this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines,
          this.callback
        )
      })

      return it('should return an object with no changes', function () {
        // Save space in redis and don't store just {}
        this.callback.called.should.equal(true)
        const [error, entries] = Array.from(this.callback.args[0])
        expect(error).to.be.null
        return expect(entries.changes).to.be.undefined
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
        return this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines,
          this.callback
        )
      })

      return it('should return an error', function () {
        this.callback.called.should.equal(true)
        const [error, entries] = Array.from(this.callback.args[0])
        expect(error).to.not.be.null
        return expect(error.message).to.equal(
          'too many comments or tracked changes'
        )
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
        return this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines,
          this.callback
        )
      })

      return it('should return an error', function () {
        // Save space in redis and don't store just {}
        this.callback.called.should.equal(true)
        const [error, entries] = Array.from(this.callback.args[0])
        expect(error).to.not.be.null
        return expect(error.message).to.equal(
          'too many comments or tracked changes'
        )
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
        return this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines,
          this.callback
        )
      })

      return it('should return an error', function () {
        // Save space in redis and don't store just {}
        this.callback.called.should.equal(true)
        const [error, entries] = Array.from(this.callback.args[0])
        expect(error).to.not.be.null
        return expect(error.message).to.equal(
          'Change ({"op":{"i":"five","p":15},"metadata":{"user_id":"user-id-123"}}) doesn\'t match text ("our ")'
        )
      })
    })

    return describe('with an update that collapses a range', function () {
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
        return this.RangesManager.applyUpdate(
          this.project_id,
          this.doc_id,
          this.entries,
          this.updates,
          this.newDocLines,
          this.callback
        )
      })

      return it('should return ranges_were_collapsed == true', function () {
        this.callback.called.should.equal(true)
        const [error, entries, ranges_were_collapsed] = Array.from(
          this.callback.args[0]
        )
        return expect(ranges_were_collapsed).to.equal(true)
      })
    })
  })

  return describe('acceptChanges', function () {
    beforeEach(function () {
      this.RangesManager = SandboxedModule.require(modulePath, {
        requires: {
          './RangesTracker': (this.RangesTracker = SandboxedModule.require(
            '../../../../app/js/RangesTracker.js'
          )),
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
      return (this.removeChangeIdsSpy = sinon.spy(
        this.RangesTracker.prototype,
        'removeChangeIds'
      ))
    })

    describe('successfully with a single change', function () {
      beforeEach(function (done) {
        this.change_ids = [this.ranges.changes[1].id]
        return this.RangesManager.acceptChanges(
          this.change_ids,
          this.ranges,
          (err, ranges) => {
            this.rangesResponse = ranges
            return done()
          }
        )
      })

      it('should log the call with the correct number of changes', function () {
        return this.logger.log
          .calledWith('accepting 1 changes in ranges')
          .should.equal(true)
      })

      it('should delegate the change removal to the ranges tracker', function () {
        return this.removeChangeIdsSpy
          .calledWith(this.change_ids)
          .should.equal(true)
      })

      it('should remove the change', function () {
        return expect(
          this.rangesResponse.changes.find(
            change => change.id === this.ranges.changes[1].id
          )
        ).to.be.undefined
      })

      it('should return the original number of changes minus 1', function () {
        return this.rangesResponse.changes.length.should.equal(
          this.ranges.changes.length - 1
        )
      })

      return it('should not touch other changes', function () {
        return [0, 2, 3, 4].map(i =>
          expect(
            this.rangesResponse.changes.find(
              change => change.id === this.ranges.changes[i].id
            )
          ).to.deep.equal(this.ranges.changes[i])
        )
      })
    })

    return describe('successfully with multiple changes', function () {
      beforeEach(function (done) {
        this.change_ids = [
          this.ranges.changes[1].id,
          this.ranges.changes[3].id,
          this.ranges.changes[4].id,
        ]
        return this.RangesManager.acceptChanges(
          this.change_ids,
          this.ranges,
          (err, ranges) => {
            this.rangesResponse = ranges
            return done()
          }
        )
      })

      it('should log the call with the correct number of changes', function () {
        return this.logger.log
          .calledWith(`accepting ${this.change_ids.length} changes in ranges`)
          .should.equal(true)
      })

      it('should delegate the change removal to the ranges tracker', function () {
        return this.removeChangeIdsSpy
          .calledWith(this.change_ids)
          .should.equal(true)
      })

      it('should remove the changes', function () {
        return [1, 3, 4].map(
          i =>
            expect(
              this.rangesResponse.changes.find(
                change => change.id === this.ranges.changes[1].id
              )
            ).to.be.undefined
        )
      })

      it('should return the original number of changes minus the number of accepted changes', function () {
        return this.rangesResponse.changes.length.should.equal(
          this.ranges.changes.length - 3
        )
      })

      return it('should not touch other changes', function () {
        return [0, 2].map(i =>
          expect(
            this.rangesResponse.changes.find(
              change => change.id === this.ranges.changes[i].id
            )
          ).to.deep.equal(this.ranges.changes[i])
        )
      })
    })
  })
})
