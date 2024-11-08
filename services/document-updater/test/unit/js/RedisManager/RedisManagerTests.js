const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')
const crypto = require('node:crypto')
const tk = require('timekeeper')

const MODULE_PATH = '../../../../app/js/RedisManager.js'

describe('RedisManager', function () {
  beforeEach(function () {
    this.multi = { exec: sinon.stub().yields() }
    this.rclient = { multi: () => this.multi, srem: sinon.stub().yields() }
    tk.freeze(new Date())
    this.RedisManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': (this.settings = {
          documentupdater: { logHashErrors: { write: true, read: true } },
          redis: {
            documentupdater: {
              key_schema: {
                blockingKey({ doc_id: docId }) {
                  return `Blocking:${docId}`
                },
                docLines({ doc_id: docId }) {
                  return `doclines:${docId}`
                },
                docOps({ doc_id: docId }) {
                  return `DocOps:${docId}`
                },
                docVersion({ doc_id: docId }) {
                  return `DocVersion:${docId}`
                },
                docHash({ doc_id: docId }) {
                  return `DocHash:${docId}`
                },
                projectKey({ doc_id: docId }) {
                  return `ProjectId:${docId}`
                },
                pendingUpdates({ doc_id: docId }) {
                  return `PendingUpdates:${docId}`
                },
                docsInProject({ project_id: projectId }) {
                  return `DocsIn:${projectId}`
                },
                ranges({ doc_id: docId }) {
                  return `Ranges:${docId}`
                },
                pathname({ doc_id: docId }) {
                  return `Pathname:${docId}`
                },
                projectHistoryId({ doc_id: docId }) {
                  return `ProjectHistoryId:${docId}`
                },
                projectState({ project_id: projectId }) {
                  return `ProjectState:${projectId}`
                },
                projectBlock({ project_id: projectId }) {
                  return `ProjectBlock:${projectId}`
                },
                unflushedTime({ doc_id: docId }) {
                  return `UnflushedTime:${docId}`
                },
                lastUpdatedBy({ doc_id: docId }) {
                  return `lastUpdatedBy:${docId}`
                },
                lastUpdatedAt({ doc_id: docId }) {
                  return `lastUpdatedAt:${docId}`
                },
                historyRangesSupport() {
                  return 'HistoryRangesSupport'
                },
                resolvedCommentIds({ doc_id: docId }) {
                  return `ResolvedCommentIds:${docId}`
                },
              },
            },
          },
        }),
        '@overleaf/redis-wrapper': {
          createClient: () => this.rclient,
        },
        './Metrics': (this.metrics = {
          inc: sinon.stub(),
          summary: sinon.stub(),
          Timer: class Timer {
            constructor() {
              this.start = new Date()
            }

            done() {
              const timeSpan = new Date() - this.start
              return timeSpan
            }
          },
        }),
        './Errors': Errors,
      },
    })

    this.docId = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.projectHistoryId = '123'
    this.historyRangesSupport = false
    this.callback = sinon.stub()
  })

  afterEach(function () {
    tk.reset()
  })

  describe('getDoc', function () {
    beforeEach(function () {
      this.lines = ['one', 'two', 'three', 'これは'] // include some utf8
      this.jsonlines = JSON.stringify(this.lines)
      this.version = 42
      this.hash = crypto
        .createHash('sha1')
        .update(this.jsonlines, 'utf8')
        .digest('hex')
      this.ranges = { comments: 'mock', entries: 'mock' }
      this.resolvedCommentIds = ['comment-1']
      this.json_ranges = JSON.stringify(this.ranges)
      this.unflushed_time = 12345
      this.pathname = '/a/b/c.tex'
      this.rclient.mget = sinon
        .stub()
        .yields(null, [
          this.jsonlines,
          this.version,
          this.hash,
          this.project_id,
          this.json_ranges,
          this.pathname,
          this.projectHistoryId.toString(),
          this.unflushed_time,
        ])
      this.rclient.sismember = sinon.stub()
      this.rclient.sismember
        .withArgs('HistoryRangesSupport', this.docId)
        .yields(null, 0)
      this.rclient.smembers = sinon.stub()
      this.rclient.smembers
        .withArgs(`ResolvedCommentIds:${this.docId}`)
        .yields(null, this.resolvedCommentIds)
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.RedisManager.getDoc(this.project_id, this.docId, this.callback)
      })

      it('should get all the details in one call to redis', function () {
        this.rclient.mget
          .calledWith(
            `doclines:${this.docId}`,
            `DocVersion:${this.docId}`,
            `DocHash:${this.docId}`,
            `ProjectId:${this.docId}`,
            `Ranges:${this.docId}`,
            `Pathname:${this.docId}`,
            `ProjectHistoryId:${this.docId}`,
            `UnflushedTime:${this.docId}`,
            `lastUpdatedAt:${this.docId}`,
            `lastUpdatedBy:${this.docId}`
          )
          .should.equal(true)
      })

      it('should return the document', function () {
        this.callback.should.have.been.calledWithExactly(
          null,
          this.lines,
          this.version,
          this.ranges,
          this.pathname,
          this.projectHistoryId,
          this.unflushed_time,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          this.historyRangesSupport,
          this.resolvedCommentIds
        )
      })

      it('should not log any errors', function () {
        this.logger.error.calledWith().should.equal(false)
      })
    })

    describe('with a corrupted document', function () {
      beforeEach(function () {
        this.badHash = 'INVALID-HASH-VALUE'
        this.rclient.mget = sinon
          .stub()
          .yields(null, [
            this.jsonlines,
            this.version,
            this.badHash,
            this.project_id,
            this.json_ranges,
          ])
        this.RedisManager.getDoc(this.project_id, this.docId, this.callback)
      })

      it('should log a hash error', function () {
        this.logger.error.calledWith().should.equal(true)
      })

      it('should return the document', function () {
        this.callback
          .calledWith(null, this.lines, this.version, this.ranges)
          .should.equal(true)
      })
    })

    describe('with a slow request to redis', function () {
      beforeEach(function () {
        this.clock = sinon.useFakeTimers()
        this.rclient.mget = (...args) => {
          const cb = args.pop()
          this.clock.tick(6000)
          cb(null, [
            this.jsonlines,
            this.version,
            this.another_project_id,
            this.json_ranges,
            this.pathname,
            this.unflushed_time,
          ])
        }

        this.RedisManager.getDoc(this.project_id, this.docId, this.callback)
      })

      afterEach(function () {
        this.clock.restore()
      })

      it('should return an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('getDoc with an invalid project id', function () {
      beforeEach(function () {
        this.another_project_id = 'project-id-456'
        this.rclient.mget = sinon
          .stub()
          .yields(null, [
            this.jsonlines,
            this.version,
            this.hash,
            this.another_project_id,
            this.json_ranges,
            this.pathname,
            this.unflushed_time,
          ])
        this.RedisManager.getDoc(this.project_id, this.docId, this.callback)
      })

      it('should return an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
      })
    })

    describe('with history ranges support', function () {
      beforeEach(function () {
        this.rclient.sismember
          .withArgs('HistoryRangesSupport', this.docId)
          .yields(null, 1)
        this.RedisManager.getDoc(this.project_id, this.docId, this.callback)
      })

      it('should return the document with the history ranges flag set', function () {
        this.callback.should.have.been.calledWithExactly(
          null,
          this.lines,
          this.version,
          this.ranges,
          this.pathname,
          this.projectHistoryId,
          this.unflushed_time,
          this.lastUpdatedAt,
          this.lastUpdatedBy,
          true,
          this.resolvedCommentIds
        )
      })
    })
  })

  describe('getPreviousDocOpsTests', function () {
    describe('with a start and an end value', function () {
      beforeEach(function () {
        this.first_version_in_redis = 30
        this.version = 70
        this.length = this.version - this.first_version_in_redis
        this.start = 50
        this.end = 60
        this.ops = [{ mock: 'op-1' }, { mock: 'op-2' }]
        this.jsonOps = this.ops.map(op => JSON.stringify(op))
        this.rclient.llen = sinon.stub().callsArgWith(1, null, this.length)
        this.rclient.get = sinon
          .stub()
          .callsArgWith(1, null, this.version.toString())
        this.rclient.lrange = sinon.stub().callsArgWith(3, null, this.jsonOps)
        this.RedisManager.getPreviousDocOps(
          this.docId,
          this.start,
          this.end,
          this.callback
        )
      })

      it('should get the length of the existing doc ops', function () {
        this.rclient.llen.calledWith(`DocOps:${this.docId}`).should.equal(true)
      })

      it('should get the current version of the doc', function () {
        this.rclient.get
          .calledWith(`DocVersion:${this.docId}`)
          .should.equal(true)
      })

      it('should get the appropriate docs ops', function () {
        this.rclient.lrange
          .calledWith(
            `DocOps:${this.docId}`,
            this.start - this.first_version_in_redis,
            this.end - this.first_version_in_redis
          )
          .should.equal(true)
      })

      it('should return the docs with the doc ops deserialized', function () {
        this.callback.calledWith(null, this.ops).should.equal(true)
      })
    })

    describe('with an end value of -1', function () {
      beforeEach(function () {
        this.first_version_in_redis = 30
        this.version = 70
        this.length = this.version - this.first_version_in_redis
        this.start = 50
        this.end = -1
        this.ops = [{ mock: 'op-1' }, { mock: 'op-2' }]
        this.jsonOps = this.ops.map(op => JSON.stringify(op))
        this.rclient.llen = sinon.stub().callsArgWith(1, null, this.length)
        this.rclient.get = sinon
          .stub()
          .callsArgWith(1, null, this.version.toString())
        this.rclient.lrange = sinon.stub().callsArgWith(3, null, this.jsonOps)
        this.RedisManager.getPreviousDocOps(
          this.docId,
          this.start,
          this.end,
          this.callback
        )
      })

      it('should get the appropriate docs ops to the end of list', function () {
        this.rclient.lrange
          .calledWith(
            `DocOps:${this.docId}`,
            this.start - this.first_version_in_redis,
            -1
          )
          .should.equal(true)
      })

      it('should return the docs with the doc ops deserialized', function () {
        this.callback.calledWith(null, this.ops).should.equal(true)
      })
    })

    describe('when the requested range is not in Redis', function () {
      beforeEach(function () {
        this.first_version_in_redis = 30
        this.version = 70
        this.length = this.version - this.first_version_in_redis
        this.start = 20
        this.end = -1
        this.ops = [{ mock: 'op-1' }, { mock: 'op-2' }]
        this.jsonOps = this.ops.map(op => JSON.stringify(op))
        this.rclient.llen = sinon.stub().callsArgWith(1, null, this.length)
        this.rclient.get = sinon
          .stub()
          .callsArgWith(1, null, this.version.toString())
        this.rclient.lrange = sinon.stub().callsArgWith(3, null, this.jsonOps)
        this.RedisManager.getPreviousDocOps(
          this.docId,
          this.start,
          this.end,
          this.callback
        )
      })

      it('should return an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Errors.OpRangeNotAvailableError))
          .should.equal(true)
      })

      it('should send details for metrics', function () {
        this.callback.should.have.been.calledWith(
          sinon.match({
            info: {
              firstVersionInRedis: this.first_version_in_redis,
              version: this.version,
              ttlInS: this.RedisManager.DOC_OPS_TTL,
            },
          })
        )
      })

      it('should log out the problem as a debug message', function () {
        this.logger.debug.called.should.equal(true)
      })
    })

    describe('with a slow request to redis', function () {
      beforeEach(function () {
        this.first_version_in_redis = 30
        this.version = 70
        this.length = this.version - this.first_version_in_redis
        this.start = 50
        this.end = 60
        this.ops = [{ mock: 'op-1' }, { mock: 'op-2' }]
        this.jsonOps = this.ops.map(op => JSON.stringify(op))
        this.rclient.llen = sinon.stub().callsArgWith(1, null, this.length)
        this.rclient.get = sinon
          .stub()
          .callsArgWith(1, null, this.version.toString())
        this.clock = sinon.useFakeTimers()
        this.rclient.lrange = (key, start, end, cb) => {
          this.clock.tick(6000)
          cb(null, this.jsonOps)
        }
        this.RedisManager.getPreviousDocOps(
          this.docId,
          this.start,
          this.end,
          this.callback
        )
      })

      afterEach(function () {
        this.clock.restore()
      })

      it('should return an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('updateDocument', function () {
    beforeEach(function () {
      this.lines = ['one', 'two', 'three', 'これは']
      this.ops = [{ op: [{ i: 'foo', p: 4 }] }, { op: [{ i: 'bar', p: 8 }] }]
      this.version = 42
      this.hash = crypto
        .createHash('sha1')
        .update(JSON.stringify(this.lines), 'utf8')
        .digest('hex')
      this.ranges = { comments: 'mock', entries: 'mock' }
      this.updateMeta = { user_id: 'last-author-fake-id' }
      this.doc_update_list_length = sinon.stub()
      this.project_update_list_length = sinon.stub()

      this.RedisManager.getDocVersion = sinon.stub()
      this.multi.mset = sinon.stub()
      this.multi.set = sinon.stub()
      this.multi.rpush = sinon.stub()
      this.multi.expire = sinon.stub()
      this.multi.ltrim = sinon.stub()
      this.multi.del = sinon.stub()
      this.multi.exec = sinon
        .stub()
        .callsArgWith(0, null, [
          null,
          null,
          null,
          null,
          this.doc_update_list_length,
          null,
          null,
        ])
    })

    describe('with a consistent version', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.docId)
          .yields(null, this.version - this.ops.length)
        this.RedisManager.updateDocument(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      it('should get the current doc version to check for consistency', function () {
        this.RedisManager.getDocVersion
          .calledWith(this.docId)
          .should.equal(true)
      })

      it('should set most details in a single MSET call', function () {
        this.multi.mset
          .calledWith({
            [`doclines:${this.docId}`]: JSON.stringify(this.lines),
            [`DocVersion:${this.docId}`]: this.version,
            [`DocHash:${this.docId}`]: this.hash,
            [`Ranges:${this.docId}`]: JSON.stringify(this.ranges),
            [`lastUpdatedAt:${this.docId}`]: Date.now(),
            [`lastUpdatedBy:${this.docId}`]: 'last-author-fake-id',
          })
          .should.equal(true)
      })

      it('should set the unflushed time', function () {
        this.multi.set
          .calledWith(`UnflushedTime:${this.docId}`, Date.now(), 'NX')
          .should.equal(true)
      })

      it('should push the doc op into the doc ops list', function () {
        this.multi.rpush
          .calledWith(
            `DocOps:${this.docId}`,
            JSON.stringify(this.ops[0]),
            JSON.stringify(this.ops[1])
          )
          .should.equal(true)
      })

      it('should renew the expiry ttl on the doc ops array', function () {
        this.multi.expire
          .calledWith(`DocOps:${this.docId}`, this.RedisManager.DOC_OPS_TTL)
          .should.equal(true)
      })

      it('should truncate the list to 100 members', function () {
        this.multi.ltrim
          .calledWith(
            `DocOps:${this.docId}`,
            -this.RedisManager.DOC_OPS_MAX_LENGTH,
            -1
          )
          .should.equal(true)
      })

      it('should call the callback', function () {
        this.callback.should.have.been.called
      })

      it('should not log any errors', function () {
        this.logger.error.calledWith().should.equal(false)
      })

      describe('with a doc using project history only', function () {
        beforeEach(function () {
          this.RedisManager.getDocVersion
            .withArgs(this.docId)
            .yields(null, this.version - this.ops.length)
          this.RedisManager.updateDocument(
            this.project_id,
            this.docId,
            this.lines,
            this.version,
            this.ops,
            this.ranges,
            this.updateMeta,
            this.callback
          )
        })

        it('should call the callback', function () {
          this.callback.should.have.been.called
        })
      })
    })

    describe('with an inconsistent version', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.docId)
          .yields(null, this.version - this.ops.length - 1)
        this.RedisManager.updateDocument(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      it('should not call multi.exec', function () {
        this.multi.exec.called.should.equal(false)
      })

      it('should call the callback with an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('with no updates', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.docId)
          .yields(null, this.version)
        this.RedisManager.updateDocument(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          [],
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      it('should set the unflushed time (potential ranges changes)', function () {
        this.multi.set
          .calledWith(`UnflushedTime:${this.docId}`, Date.now(), 'NX')
          .should.equal(true)
      })

      it('should not try to enqueue doc updates', function () {
        this.multi.rpush.called.should.equal(false)
      })

      it('should still set the doclines', function () {
        this.multi.mset
          .calledWith({
            [`doclines:${this.docId}`]: JSON.stringify(this.lines),
            [`DocVersion:${this.docId}`]: this.version,
            [`DocHash:${this.docId}`]: this.hash,
            [`Ranges:${this.docId}`]: JSON.stringify(this.ranges),
            [`lastUpdatedAt:${this.docId}`]: Date.now(),
            [`lastUpdatedBy:${this.docId}`]: 'last-author-fake-id',
          })
          .should.equal(true)
      })
    })

    describe('with empty ranges', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.docId)
          .yields(null, this.version - this.ops.length)
        this.RedisManager.updateDocument(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ops,
          {},
          this.updateMeta,
          this.callback
        )
      })

      it('should set empty ranges', function () {
        this.multi.mset
          .calledWith({
            [`doclines:${this.docId}`]: JSON.stringify(this.lines),
            [`DocVersion:${this.docId}`]: this.version,
            [`DocHash:${this.docId}`]: this.hash,
            [`Ranges:${this.docId}`]: null,
            [`lastUpdatedAt:${this.docId}`]: Date.now(),
            [`lastUpdatedBy:${this.docId}`]: 'last-author-fake-id',
          })
          .should.equal(true)
      })
    })

    describe('with null bytes in the serialized doc lines', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.docId)
          .yields(null, this.version - this.ops.length)
        this.stringifyStub = sinon
          .stub(JSON, 'stringify')
          .callsFake(() => '["bad bytes! \u0000 <- here"]')
        this.RedisManager.updateDocument(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      afterEach(function () {
        this.stringifyStub.restore()
      })

      it('should log an error', function () {
        this.logger.error.called.should.equal(true)
      })

      it('should call the callback with an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('with ranges that are too big', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.docId)
          .yields(null, this.version - this.ops.length)
        this.RedisManager._serializeRanges = sinon
          .stub()
          .yields(new Error('ranges are too large'))
        this.RedisManager.updateDocument(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      it('should log an error', function () {
        this.logger.error.called.should.equal(true)
      })

      it('should call the callback with the error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('without user id from meta', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.docId)
          .yields(null, this.version - this.ops.length)
        this.RedisManager.updateDocument(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          {},
          this.callback
        )
      })

      it('should unset last updater', function () {
        this.multi.mset
          .calledWith({
            [`doclines:${this.docId}`]: JSON.stringify(this.lines),
            [`DocVersion:${this.docId}`]: this.version,
            [`DocHash:${this.docId}`]: this.hash,
            [`Ranges:${this.docId}`]: JSON.stringify(this.ranges),
            [`lastUpdatedAt:${this.docId}`]: Date.now(),
            [`lastUpdatedBy:${this.docId}`]: undefined,
          })
          .should.equal(true)
      })
    })
  })

  describe('putDocInMemory', function () {
    beforeEach(function () {
      this.multi.mset = sinon.stub()
      this.multi.sadd = sinon.stub()
      this.multi.del = sinon.stub()
      this.multi.exists = sinon.stub()
      this.multi.exec.onCall(0).yields(null, [0])
      this.rclient.sadd = sinon.stub().yields()
      this.lines = ['one', 'two', 'three', 'これは']
      this.version = 42
      this.hash = crypto
        .createHash('sha1')
        .update(JSON.stringify(this.lines), 'utf8')
        .digest('hex')
      this.ranges = { comments: 'mock', entries: 'mock' }
      this.resolvedCommentIds = ['comment-1']
      this.pathname = '/a/b/c.tex'
    })

    describe('with non-empty ranges', function () {
      beforeEach(function (done) {
        this.RedisManager.putDocInMemory(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ranges,
          this.resolvedCommentIds,
          this.pathname,
          this.projectHistoryId,
          this.historyRangesSupport,
          done
        )
      })

      it('should set all the details in a single MSET call', function () {
        this.multi.mset
          .calledWith({
            [`doclines:${this.docId}`]: JSON.stringify(this.lines),
            [`ProjectId:${this.docId}`]: this.project_id,
            [`DocVersion:${this.docId}`]: this.version,
            [`DocHash:${this.docId}`]: this.hash,
            [`Ranges:${this.docId}`]: JSON.stringify(this.ranges),
            [`Pathname:${this.docId}`]: this.pathname,
            [`ProjectHistoryId:${this.docId}`]: this.projectHistoryId,
          })
          .should.equal(true)
      })

      it('should add the docId to the project set', function () {
        this.multi.sadd
          .calledWith(`DocsIn:${this.project_id}`, this.docId)
          .should.equal(true)
      })

      it('should not log any errors', function () {
        this.logger.error.calledWith().should.equal(false)
      })

      it('should remove the document from the HistoryRangesSupport set in Redis', function () {
        this.rclient.srem.should.have.been.calledWith(
          'HistoryRangesSupport',
          this.docId
        )
      })

      it('should not store the resolved comments in Redis', function () {
        this.multi.sadd.should.not.have.been.calledWith(
          `ResolvedCommentIds:${this.docId}`
        )
      })
    })

    describe('with empty ranges', function () {
      beforeEach(function (done) {
        this.RedisManager.putDocInMemory(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          {},
          [],
          this.pathname,
          this.projectHistoryId,
          this.historyRangesSupport,
          done
        )
      })

      it('should unset ranges', function () {
        this.multi.mset.should.have.been.calledWith({
          [`doclines:${this.docId}`]: JSON.stringify(this.lines),
          [`ProjectId:${this.docId}`]: this.project_id,
          [`DocVersion:${this.docId}`]: this.version,
          [`DocHash:${this.docId}`]: this.hash,
          [`Ranges:${this.docId}`]: null,
          [`Pathname:${this.docId}`]: this.pathname,
          [`ProjectHistoryId:${this.docId}`]: this.projectHistoryId,
        })
      })
    })

    describe('with null bytes in the serialized doc lines', function () {
      beforeEach(function () {
        this.stringifyStub = sinon
          .stub(JSON, 'stringify')
          .callsFake(() => '["bad bytes! \u0000 <- here"]')
        this.RedisManager.putDocInMemory(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ranges,
          this.resolvedCommentIds,
          this.pathname,
          this.projectHistoryId,
          this.historyRangesSupport,
          this.callback
        )
      })

      afterEach(function () {
        this.stringifyStub.restore()
      })

      it('should log an error', function () {
        this.logger.error.called.should.equal(true)
      })

      it('should call the callback with an error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('with ranges that are too big', function () {
      beforeEach(function () {
        this.RedisManager._serializeRanges = sinon
          .stub()
          .yields(new Error('ranges are too large'))
        this.RedisManager.putDocInMemory(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ranges,
          this.resolvedCommentIds,
          this.pathname,
          this.projectHistoryId,
          this.historyRangesSupport,
          this.callback
        )
      })

      it('should log an error', function () {
        this.logger.error.called.should.equal(true)
      })

      it('should call the callback with the error', function () {
        this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('with history ranges support', function () {
      beforeEach(function (done) {
        this.historyRangesSupport = true
        this.RedisManager.putDocInMemory(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ranges,
          this.resolvedCommentIds,
          this.pathname,
          this.projectHistoryId,
          this.historyRangesSupport,
          done
        )
      })

      it('should add the document to the HistoryRangesSupport set in Redis', function () {
        this.rclient.sadd.should.have.been.calledWith(
          'HistoryRangesSupport',
          this.docId
        )
      })

      it('should store the resolved comments in Redis', function () {
        this.multi.del.should.have.been.calledWith(
          `ResolvedCommentIds:${this.docId}`
        )
        this.multi.sadd.should.have.been.calledWith(
          `ResolvedCommentIds:${this.docId}`,
          ...this.resolvedCommentIds
        )
      })
    })

    describe('when the project is blocked', function () {
      beforeEach(function (done) {
        this.multi.exec.onCall(0).yields(null, [1])
        this.RedisManager.putDocInMemory(
          this.project_id,
          this.docId,
          this.lines,
          this.version,
          this.ranges,
          this.resolvedCommentIds,
          this.pathname,
          this.projectHistoryId,
          this.historyRangesSupport,
          err => {
            this.error = err
            done()
          }
        )
      })

      it('should throw an error', function () {
        expect(this.error.message).to.equal('Project blocked from loading docs')
      })

      it('should not store the doc', function () {
        expect(this.multi.mset).to.not.have.been.called
      })
    })
  })

  describe('removeDocFromMemory', function () {
    beforeEach(function (done) {
      this.multi.strlen = sinon.stub()
      this.multi.del = sinon.stub()
      this.multi.srem = sinon.stub()
      this.multi.exec.yields()
      this.RedisManager.removeDocFromMemory(this.project_id, this.docId, done)
    })

    it('should check the length of the current doclines', function () {
      this.multi.strlen.calledWith(`doclines:${this.docId}`).should.equal(true)
    })

    it('should delete the details in a singe call', function () {
      this.multi.del
        .calledWith(
          `doclines:${this.docId}`,
          `ProjectId:${this.docId}`,
          `DocVersion:${this.docId}`,
          `DocHash:${this.docId}`,
          `Ranges:${this.docId}`,
          `Pathname:${this.docId}`,
          `ProjectHistoryId:${this.docId}`,
          `UnflushedTime:${this.docId}`,
          `lastUpdatedAt:${this.docId}`,
          `lastUpdatedBy:${this.docId}`,
          `ResolvedCommentIds:${this.docId}`
        )
        .should.equal(true)
    })

    it('should remove the docId from the project set', function () {
      this.multi.srem
        .calledWith(`DocsIn:${this.project_id}`, this.docId)
        .should.equal(true)
    })

    it('should remove the docId from the HistoryRangesSupport set', function () {
      this.rclient.srem.should.have.been.calledWith(
        'HistoryRangesSupport',
        this.docId
      )
    })
  })

  describe('clearProjectState', function () {
    beforeEach(function (done) {
      this.rclient.del = sinon.stub().callsArg(1)
      this.RedisManager.clearProjectState(this.project_id, done)
    })

    it('should delete the project state', function () {
      this.rclient.del
        .calledWith(`ProjectState:${this.project_id}`)
        .should.equal(true)
    })
  })

  describe('renameDoc', function () {
    beforeEach(function () {
      this.rclient.rpush = sinon.stub().yields()
      this.rclient.set = sinon.stub().yields()
      this.update = {
        id: this.docId,
        pathname: (this.pathname = 'pathname'),
        newPathname: (this.newPathname = 'new-pathname'),
      }
    })

    describe('the document is cached in redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(2, null, 'lines', 'version')
        this.RedisManager.renameDoc(
          this.project_id,
          this.docId,
          this.userId,
          this.update,
          this.projectHistoryId,
          this.callback
        )
      })

      it('update the cached pathname', function () {
        this.rclient.set
          .calledWith(`Pathname:${this.docId}`, this.newPathname)
          .should.equal(true)
      })
    })

    describe('the document is not cached in redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(2, null, null, null)
        this.RedisManager.renameDoc(
          this.project_id,
          this.docId,
          this.userId,
          this.update,
          this.projectHistoryId,
          this.callback
        )
      })

      it('does not update the cached pathname', function () {
        this.rclient.set.called.should.equal(false)
      })
    })

    describe('getDocVersion', function () {
      beforeEach(function () {
        this.version = 12345
        this.rclient.mget = sinon
          .stub()
          .withArgs(`DocVersion:${this.docId}`)
          .callsArgWith(1, null, [`${this.version}`])
        this.RedisManager.getDocVersion(this.docId, this.callback)
      })

      it('should return the document version', function () {
        this.callback.calledWithExactly(null, this.version).should.equal(true)
      })
    })
  })
})
