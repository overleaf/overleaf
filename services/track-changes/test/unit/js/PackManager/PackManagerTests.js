/* eslint-disable
    mocha/no-identical-title,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const { assert } = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/js/PackManager.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongojs')
const _ = require('underscore')

const tk = require('timekeeper')

describe('PackManager', function () {
  beforeEach(function () {
    tk.freeze(new Date())
    this.PackManager = SandboxedModule.require(modulePath, {
      requires: {
        bson: require('bson'),
        './mongojs': { db: (this.db = {}), ObjectId },
        './LockManager': {},
        './MongoAWS': {},
        'logger-sharelatex': { log: sinon.stub(), error: sinon.stub() },
        'metrics-sharelatex': { inc() {} },
        './ProjectIterator': require('../../../../app/js/ProjectIterator.js'), // Cache for speed
        'settings-sharelatex': {
          redis: { lock: { key_schema: {} } }
        }
      }
    })
    this.callback = sinon.stub()
    this.doc_id = ObjectId().toString()
    this.project_id = ObjectId().toString()
    return (this.PackManager.MAX_COUNT = 512)
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('insertCompressedUpdates', function () {
    beforeEach(function () {
      this.lastUpdate = {
        _id: '12345',
        pack: [
          { op: 'op-1', meta: 'meta-1', v: 1 },
          { op: 'op-2', meta: 'meta-2', v: 2 }
        ],
        n: 2,
        sz: 100
      }
      this.newUpdates = [
        { op: 'op-3', meta: 'meta-3', v: 3 },
        { op: 'op-4', meta: 'meta-4', v: 4 }
      ]
      return (this.db.docHistory = {
        save: sinon.stub().callsArg(1),
        insert: sinon.stub().callsArg(1),
        updateOne: sinon.stub().yields(),
        findAndModify: sinon.stub().callsArg(1)
      })
    })

    describe('with no last update', function () {
      beforeEach(function () {
        this.PackManager.insertUpdatesIntoNewPack = sinon.stub().callsArg(4)
        return this.PackManager.insertCompressedUpdates(
          this.project_id,
          this.doc_id,
          null,
          this.newUpdates,
          true,
          this.callback
        )
      })

      describe('for a small update', function () {
        it('should insert the update into a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(this.project_id, this.doc_id, this.newUpdates, true)
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      return describe('for many small updates', function () {
        beforeEach(function () {
          this.newUpdates = __range__(0, 2048, true).map((i) => ({
            op: `op-${i}`,
            meta: `meta-${i}`,
            v: i
          }))
          return this.PackManager.insertCompressedUpdates(
            this.project_id,
            this.doc_id,
            null,
            this.newUpdates,
            false,
            this.callback
          )
        })

        it('should append the initial updates to the existing pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(0, 512),
              false
            )
            .should.equal(true)
        })

        it('should insert the first set remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(512, 1024),
              false
            )
            .should.equal(true)
        })

        it('should insert the second set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(1024, 1536),
              false
            )
            .should.equal(true)
        })

        it('should insert the third set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(1536, 2048),
              false
            )
            .should.equal(true)
        })

        it('should insert the final set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(2048, 2049),
              false
            )
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })
    })

    describe('with an existing pack as the last update', function () {
      beforeEach(function () {
        this.PackManager.appendUpdatesToExistingPack = sinon.stub().callsArg(5)
        this.PackManager.insertUpdatesIntoNewPack = sinon.stub().callsArg(4)
        return this.PackManager.insertCompressedUpdates(
          this.project_id,
          this.doc_id,
          this.lastUpdate,
          this.newUpdates,
          false,
          this.callback
        )
      })

      describe('for a small update', function () {
        it('should append the update to the existing pack', function () {
          return this.PackManager.appendUpdatesToExistingPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.lastUpdate,
              this.newUpdates,
              false
            )
            .should.equal(true)
        })
        it('should not insert any new packs', function () {
          return this.PackManager.insertUpdatesIntoNewPack.called.should.equal(
            false
          )
        })
        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      describe('for many small updates', function () {
        beforeEach(function () {
          this.newUpdates = __range__(0, 2048, true).map((i) => ({
            op: `op-${i}`,
            meta: `meta-${i}`,
            v: i
          }))
          return this.PackManager.insertCompressedUpdates(
            this.project_id,
            this.doc_id,
            this.lastUpdate,
            this.newUpdates,
            false,
            this.callback
          )
        })

        it('should append the initial updates to the existing pack', function () {
          return this.PackManager.appendUpdatesToExistingPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.lastUpdate,
              this.newUpdates.slice(0, 510),
              false
            )
            .should.equal(true)
        })

        it('should insert the first set remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(510, 1022),
              false
            )
            .should.equal(true)
        })

        it('should insert the second set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(1022, 1534),
              false
            )
            .should.equal(true)
        })

        it('should insert the third set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(1534, 2046),
              false
            )
            .should.equal(true)
        })

        it('should insert the final set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(2046, 2049),
              false
            )
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      return describe('for many big updates', function () {
        beforeEach(function () {
          const longString = __range__(
            0,
            0.75 * this.PackManager.MAX_SIZE,
            true
          )
            .map((j) => 'a')
            .join('')
          this.newUpdates = [0, 1, 2, 3, 4].map((i) => ({
            op: `op-${i}-${longString}`,
            meta: `meta-${i}`,
            v: i
          }))
          return this.PackManager.insertCompressedUpdates(
            this.project_id,
            this.doc_id,
            this.lastUpdate,
            this.newUpdates,
            false,
            this.callback
          )
        })

        it('should append the initial updates to the existing pack', function () {
          return this.PackManager.appendUpdatesToExistingPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.lastUpdate,
              this.newUpdates.slice(0, 1),
              false
            )
            .should.equal(true)
        })

        it('should insert the first set remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(1, 2),
              false
            )
            .should.equal(true)
        })

        it('should insert the second set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(2, 3),
              false
            )
            .should.equal(true)
        })

        it('should insert the third set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(3, 4),
              false
            )
            .should.equal(true)
        })

        it('should insert the final set of remaining updates as a new pack', function () {
          return this.PackManager.insertUpdatesIntoNewPack
            .calledWith(
              this.project_id,
              this.doc_id,
              this.newUpdates.slice(4, 5),
              false
            )
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })
    })

    describe('flushCompressedUpdates', function () {
      return describe('when there is no previous update', function () {
        beforeEach(function () {
          return this.PackManager.flushCompressedUpdates(
            this.project_id,
            this.doc_id,
            null,
            this.newUpdates,
            true,
            this.callback
          )
        })

        return describe('for a small update  that will expire', function () {
          it('should insert the update into mongo', function () {
            return this.db.docHistory.save
              .calledWithMatch({
                pack: this.newUpdates,
                project_id: ObjectId(this.project_id),
                doc_id: ObjectId(this.doc_id),
                n: this.newUpdates.length,
                v: this.newUpdates[0].v,
                v_end: this.newUpdates[this.newUpdates.length - 1].v
              })
              .should.equal(true)
          })

          it('should set an expiry time in the future', function () {
            return this.db.docHistory.save
              .calledWithMatch({
                expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
              })
              .should.equal(true)
          })

          return it('should call the callback', function () {
            return this.callback.called.should.equal(true)
          })
        })
      })
    })

    describe('when there is a recent previous update in mongo that expires', function () {
      beforeEach(function () {
        this.lastUpdate = {
          _id: '12345',
          pack: [
            { op: 'op-1', meta: 'meta-1', v: 1 },
            { op: 'op-2', meta: 'meta-2', v: 2 }
          ],
          n: 2,
          sz: 100,
          meta: { start_ts: Date.now() - 6 * 3600 * 1000 },
          expiresAt: new Date(Date.now())
        }

        return this.PackManager.flushCompressedUpdates(
          this.project_id,
          this.doc_id,
          this.lastUpdate,
          this.newUpdates,
          true,
          this.callback
        )
      })

      return describe('for a small update that will expire', function () {
        it('should append the update in mongo', function () {
          return this.db.docHistory.updateOne
            .calledWithMatch(
              { _id: this.lastUpdate._id },
              {
                $push: { pack: { $each: this.newUpdates } },
                $set: { v_end: this.newUpdates[this.newUpdates.length - 1].v }
              }
            )
            .should.equal(true)
        })

        it('should set an expiry time in the future', function () {
          return this.db.docHistory.updateOne
            .calledWithMatch(sinon.match.any, {
              $set: { expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) }
            })
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })
    })

    describe('when there is a recent previous update in mongo that expires', function () {
      beforeEach(function () {
        this.PackManager.updateIndex = sinon.stub().callsArg(2)

        this.lastUpdate = {
          _id: '12345',
          pack: [
            { op: 'op-1', meta: 'meta-1', v: 1 },
            { op: 'op-2', meta: 'meta-2', v: 2 }
          ],
          n: 2,
          sz: 100,
          meta: { start_ts: Date.now() - 6 * 3600 * 1000 },
          expiresAt: new Date(Date.now())
        }

        return this.PackManager.flushCompressedUpdates(
          this.project_id,
          this.doc_id,
          this.lastUpdate,
          this.newUpdates,
          false,
          this.callback
        )
      })

      return describe('for a small update that will not expire', function () {
        it('should insert the update into mongo', function () {
          return this.db.docHistory.save
            .calledWithMatch({
              pack: this.newUpdates,
              project_id: ObjectId(this.project_id),
              doc_id: ObjectId(this.doc_id),
              n: this.newUpdates.length,
              v: this.newUpdates[0].v,
              v_end: this.newUpdates[this.newUpdates.length - 1].v
            })
            .should.equal(true)
        })

        it('should not set any expiry time', function () {
          return this.db.docHistory.save
            .neverCalledWithMatch(sinon.match.has('expiresAt'))
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })
    })

    return describe('when there is an old previous update in mongo', function () {
      beforeEach(function () {
        this.lastUpdate = {
          _id: '12345',
          pack: [
            { op: 'op-1', meta: 'meta-1', v: 1 },
            { op: 'op-2', meta: 'meta-2', v: 2 }
          ],
          n: 2,
          sz: 100,
          meta: { start_ts: Date.now() - 30 * 24 * 3600 * 1000 },
          expiresAt: new Date(Date.now() - 30 * 24 * 3600 * 1000)
        }

        return this.PackManager.flushCompressedUpdates(
          this.project_id,
          this.doc_id,
          this.lastUpdate,
          this.newUpdates,
          true,
          this.callback
        )
      })

      return describe('for a small update that will expire', function () {
        it('should insert the update into mongo', function () {
          return this.db.docHistory.save
            .calledWithMatch({
              pack: this.newUpdates,
              project_id: ObjectId(this.project_id),
              doc_id: ObjectId(this.doc_id),
              n: this.newUpdates.length,
              v: this.newUpdates[0].v,
              v_end: this.newUpdates[this.newUpdates.length - 1].v
            })
            .should.equal(true)
        })

        it('should set an expiry time in the future', function () {
          return this.db.docHistory.save
            .calledWithMatch({
              expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
            })
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })
    })
  })

  describe('getOpsByVersionRange', function () {})

  describe('loadPacksByVersionRange', function () {})

  describe('fetchPacksIfNeeded', function () {})

  describe('makeProjectIterator', function () {})

  describe('getPackById', function () {})

  describe('increaseTTL', function () {})

  describe('getIndex', function () {})

  describe('getPackFromIndex', function () {})
  // getLastPackFromIndex:
  // getIndexWithKeys
  // initialiseIndex
  // updateIndex
  // findCompletedPacks
  // findUnindexedPacks
  // insertPacksIntoIndexWithLock
  // _insertPacksIntoIndex
  // archivePack
  // checkArchivedPack
  // processOldPack
  // 	updateIndexIfNeeded
  // 	findUnarchivedPacks

  return describe('checkArchiveNotInProgress', function () {
    describe('when an archive is in progress', function () {
      beforeEach(function () {
        this.db.docHistoryIndex = {
          findOne: sinon.stub().callsArgWith(2, null, { inS3: false })
        }
        return this.PackManager.checkArchiveNotInProgress(
          this.project_id,
          this.doc_id,
          this.pack_id,
          this.callback
        )
      })
      it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
      return it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match.has('message'))
          .should.equal(true)
      })
    })

    describe('when an archive is completed', function () {
      beforeEach(function () {
        this.db.docHistoryIndex = {
          findOne: sinon.stub().callsArgWith(2, null, { inS3: true })
        }
        return this.PackManager.checkArchiveNotInProgress(
          this.project_id,
          this.doc_id,
          this.pack_id,
          this.callback
        )
      })
      it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
      return it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match.has('message'))
          .should.equal(true)
      })
    })

    return describe('when the archive has not started or completed', function () {
      beforeEach(function () {
        this.db.docHistoryIndex = {
          findOne: sinon.stub().callsArgWith(2, null, {})
        }
        return this.PackManager.checkArchiveNotInProgress(
          this.project_id,
          this.doc_id,
          this.pack_id,
          this.callback
        )
      })
      it('should call the callback with no error', function () {
        return this.callback.called.should.equal(true)
      })
      return it('should return with no error', function () {
        return (typeof this.callback.lastCall.args[0]).should.equal('undefined')
      })
    })
  })
})

// describe "setTTLOnArchivedPack", ->
// 	beforeEach ->
// 		@pack_id = "somepackid"
// 		@onedayinms = 86400000
// 		@db.docHistory =
// 			findAndModify : sinon.stub().callsArgWith(1)

// 	it "should set expires to 1 day", (done)->
// 		#@PackManager._getOneDayInFutureWithRandomDelay = sinon.stub().returns(@onedayinms)
// 		@PackManager.setTTLOnArchivedPack @project_id, @doc_id, @pack_id, =>
// 			args = @db.docHistory.findAndModify.args[0][0]
// 			args.query._id.should.equal @pack_id
// 			args.update['$set'].expiresAt.should.equal @onedayinms
// 			done()

// describe "_getOneDayInFutureWithRandomDelay", ->
// 	beforeEach ->
// 		@onedayinms = 86400000
// 		@thirtyMins = 1000 * 60 * 30

// 	it "should give 1 day + 30 mins random time", (done)->
// 		loops = 10000
// 		while --loops > 0
// 			randomDelay = @PackManager._getOneDayInFutureWithRandomDelay() - new Date(Date.now() + @onedayinms)
// 			randomDelay.should.be.above(0)
// 			randomDelay.should.be.below(@thirtyMins + 1)
// 		done()

function __range__(left, right, inclusive) {
  const range = []
  const ascending = left < right
  const end = !inclusive ? right : ascending ? right + 1 : right - 1
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i)
  }
  return range
}
