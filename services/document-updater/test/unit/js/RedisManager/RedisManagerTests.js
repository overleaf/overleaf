/* eslint-disable
    camelcase,
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
const modulePath = '../../../../app/js/RedisManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors')
const crypto = require('crypto')
const tk = require('timekeeper')

describe('RedisManager', function () {
  beforeEach(function () {
    let Timer
    this.multi = { exec: sinon.stub() }
    this.rclient = { multi: () => this.multi }
    tk.freeze(new Date())
    this.RedisManager = SandboxedModule.require(modulePath, {
      requires: {
        './ProjectHistoryRedisManager': (this.ProjectHistoryRedisManager = {}),
        '@overleaf/settings': (this.settings = {
          documentupdater: { logHashErrors: { write: true, read: true } },
          apis: {
            project_history: { enabled: true },
          },
          redis: {
            documentupdater: {
              key_schema: {
                blockingKey({ doc_id }) {
                  return `Blocking:${doc_id}`
                },
                docLines({ doc_id }) {
                  return `doclines:${doc_id}`
                },
                docOps({ doc_id }) {
                  return `DocOps:${doc_id}`
                },
                docVersion({ doc_id }) {
                  return `DocVersion:${doc_id}`
                },
                docHash({ doc_id }) {
                  return `DocHash:${doc_id}`
                },
                projectKey({ doc_id }) {
                  return `ProjectId:${doc_id}`
                },
                pendingUpdates({ doc_id }) {
                  return `PendingUpdates:${doc_id}`
                },
                docsInProject({ project_id }) {
                  return `DocsIn:${project_id}`
                },
                ranges({ doc_id }) {
                  return `Ranges:${doc_id}`
                },
                pathname({ doc_id }) {
                  return `Pathname:${doc_id}`
                },
                projectHistoryId({ doc_id }) {
                  return `ProjectHistoryId:${doc_id}`
                },
                projectHistoryType({ doc_id }) {
                  return `ProjectHistoryType:${doc_id}`
                },
                projectState({ project_id }) {
                  return `ProjectState:${project_id}`
                },
                unflushedTime({ doc_id }) {
                  return `UnflushedTime:${doc_id}`
                },
                lastUpdatedBy({ doc_id }) {
                  return `lastUpdatedBy:${doc_id}`
                },
                lastUpdatedAt({ doc_id }) {
                  return `lastUpdatedAt:${doc_id}`
                },
              },
            },
            history: {
              key_schema: {
                uncompressedHistoryOps({ doc_id }) {
                  return `UncompressedHistoryOps:${doc_id}`
                },
                docsWithHistoryOps({ project_id }) {
                  return `DocsWithHistoryOps:${project_id}`
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
          Timer: (Timer = class Timer {
            constructor() {
              this.start = new Date()
            }

            done() {
              const timeSpan = new Date() - this.start
              return timeSpan
            }
          }),
        }),
        './Errors': Errors,
      },
    })

    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.projectHistoryId = 123
    return (this.callback = sinon.stub())
  })

  afterEach(function () {
    return tk.reset()
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
    })

    describe('successfully', function () {
      beforeEach(function () {
        return this.RedisManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should get all the details in one call to redis', function () {
        this.rclient.mget
          .calledWith(
            `doclines:${this.doc_id}`,
            `DocVersion:${this.doc_id}`,
            `DocHash:${this.doc_id}`,
            `ProjectId:${this.doc_id}`,
            `Ranges:${this.doc_id}`,
            `Pathname:${this.doc_id}`,
            `ProjectHistoryId:${this.doc_id}`,
            `UnflushedTime:${this.doc_id}`,
            `lastUpdatedAt:${this.doc_id}`,
            `lastUpdatedBy:${this.doc_id}`
          )
          .should.equal(true)
      })

      it('should return the document', function () {
        return this.callback
          .calledWithExactly(
            null,
            this.lines,
            this.version,
            this.ranges,
            this.pathname,
            this.projectHistoryId,
            this.unflushed_time,
            this.lastUpdatedAt,
            this.lastUpdatedBy
          )
          .should.equal(true)
      })

      return it('should not log any errors', function () {
        return this.logger.error.calledWith().should.equal(false)
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
        return this.RedisManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      it('should log a hash error', function () {
        return this.logger.error.calledWith().should.equal(true)
      })

      return it('should return the document', function () {
        return this.callback
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
          return cb(null, [
            this.jsonlines,
            this.version,
            this.another_project_id,
            this.json_ranges,
            this.pathname,
            this.unflushed_time,
          ])
        }

        return this.RedisManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      afterEach(function () {
        return this.clock.restore()
      })

      return it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    return describe('getDoc with an invalid project id', function () {
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
        return this.RedisManager.getDoc(
          this.project_id,
          this.doc_id,
          this.callback
        )
      })

      return it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.NotFoundError))
          .should.equal(true)
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
        return this.RedisManager.getPreviousDocOps(
          this.doc_id,
          this.start,
          this.end,
          this.callback
        )
      })

      it('should get the length of the existing doc ops', function () {
        return this.rclient.llen
          .calledWith(`DocOps:${this.doc_id}`)
          .should.equal(true)
      })

      it('should get the current version of the doc', function () {
        return this.rclient.get
          .calledWith(`DocVersion:${this.doc_id}`)
          .should.equal(true)
      })

      it('should get the appropriate docs ops', function () {
        return this.rclient.lrange
          .calledWith(
            `DocOps:${this.doc_id}`,
            this.start - this.first_version_in_redis,
            this.end - this.first_version_in_redis
          )
          .should.equal(true)
      })

      return it('should return the docs with the doc ops deserialized', function () {
        return this.callback.calledWith(null, this.ops).should.equal(true)
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
        return this.RedisManager.getPreviousDocOps(
          this.doc_id,
          this.start,
          this.end,
          this.callback
        )
      })

      it('should get the appropriate docs ops to the end of list', function () {
        return this.rclient.lrange
          .calledWith(
            `DocOps:${this.doc_id}`,
            this.start - this.first_version_in_redis,
            -1
          )
          .should.equal(true)
      })

      return it('should return the docs with the doc ops deserialized', function () {
        return this.callback.calledWith(null, this.ops).should.equal(true)
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
        return this.RedisManager.getPreviousDocOps(
          this.doc_id,
          this.start,
          this.end,
          this.callback
        )
      })

      it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Errors.OpRangeNotAvailableError))
          .should.equal(true)
      })

      return it('should log out the problem', function () {
        return this.logger.warn.called.should.equal(true)
      })
    })

    return describe('with a slow request to redis', function () {
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
          return cb(null, this.jsonOps)
        }
        return this.RedisManager.getPreviousDocOps(
          this.doc_id,
          this.start,
          this.end,
          this.callback
        )
      })

      afterEach(function () {
        return this.clock.restore()
      })

      return it('should return an error', function () {
        return this.callback
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
      return (this.ProjectHistoryRedisManager.queueOps = sinon
        .stub()
        .callsArgWith(
          this.ops.length + 1,
          null,
          this.project_update_list_length
        ))
    })

    describe('with a consistent version', function () {
      beforeEach(function () {})

      describe('with project history enabled', function () {
        beforeEach(function () {
          this.settings.apis.project_history.enabled = true
          this.RedisManager.getDocVersion
            .withArgs(this.doc_id)
            .yields(null, this.version - this.ops.length)
          return this.RedisManager.updateDocument(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ops,
            this.ranges,
            this.updateMeta,
            this.callback
          )
        })

        it('should get the current doc version to check for consistency', function () {
          return this.RedisManager.getDocVersion
            .calledWith(this.doc_id)
            .should.equal(true)
        })

        it('should set most details in a single MSET call', function () {
          this.multi.mset
            .calledWith({
              [`doclines:${this.doc_id}`]: JSON.stringify(this.lines),
              [`DocVersion:${this.doc_id}`]: this.version,
              [`DocHash:${this.doc_id}`]: this.hash,
              [`Ranges:${this.doc_id}`]: JSON.stringify(this.ranges),
              [`lastUpdatedAt:${this.doc_id}`]: Date.now(),
              [`lastUpdatedBy:${this.doc_id}`]: 'last-author-fake-id',
            })
            .should.equal(true)
        })

        it('should set the unflushed time', function () {
          return this.multi.set
            .calledWith(`UnflushedTime:${this.doc_id}`, Date.now(), 'NX')
            .should.equal(true)
        })

        it('should push the doc op into the doc ops list', function () {
          return this.multi.rpush
            .calledWith(
              `DocOps:${this.doc_id}`,
              JSON.stringify(this.ops[0]),
              JSON.stringify(this.ops[1])
            )
            .should.equal(true)
        })

        it('should renew the expiry ttl on the doc ops array', function () {
          return this.multi.expire
            .calledWith(`DocOps:${this.doc_id}`, this.RedisManager.DOC_OPS_TTL)
            .should.equal(true)
        })

        it('should truncate the list to 100 members', function () {
          return this.multi.ltrim
            .calledWith(
              `DocOps:${this.doc_id}`,
              -this.RedisManager.DOC_OPS_MAX_LENGTH,
              -1
            )
            .should.equal(true)
        })

        it('should push the updates into the history ops list', function () {
          return this.multi.rpush
            .calledWith(
              `UncompressedHistoryOps:${this.doc_id}`,
              JSON.stringify(this.ops[0]),
              JSON.stringify(this.ops[1])
            )
            .should.equal(true)
        })

        it('should push the updates into the project history ops list', function () {
          return this.ProjectHistoryRedisManager.queueOps
            .calledWith(this.project_id, JSON.stringify(this.ops[0]))
            .should.equal(true)
        })

        it('should call the callback', function () {
          return this.callback
            .calledWith(
              null,
              this.doc_update_list_length,
              this.project_update_list_length
            )
            .should.equal(true)
        })

        return it('should not log any errors', function () {
          return this.logger.error.calledWith().should.equal(false)
        })
      })

      describe('with project history disabled', function () {
        beforeEach(function () {
          this.settings.apis.project_history.enabled = false
          this.RedisManager.getDocVersion
            .withArgs(this.doc_id)
            .yields(null, this.version - this.ops.length)
          return this.RedisManager.updateDocument(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ops,
            this.ranges,
            this.updateMeta,
            this.callback
          )
        })

        it('should not push the updates into the project history ops list', function () {
          return this.ProjectHistoryRedisManager.queueOps.called.should.equal(
            false
          )
        })

        return it('should call the callback', function () {
          return this.callback
            .calledWith(null, this.doc_update_list_length)
            .should.equal(true)
        })
      })

      return describe('with a doc using project history only', function () {
        beforeEach(function () {
          this.RedisManager.getDocVersion
            .withArgs(this.doc_id)
            .yields(null, this.version - this.ops.length, 'project-history')
          return this.RedisManager.updateDocument(
            this.project_id,
            this.doc_id,
            this.lines,
            this.version,
            this.ops,
            this.ranges,
            this.updateMeta,
            this.callback
          )
        })

        it('should not push the updates to the track-changes ops list', function () {
          return this.multi.rpush
            .calledWith(`UncompressedHistoryOps:${this.doc_id}`)
            .should.equal(false)
        })

        it('should push the updates into the project history ops list', function () {
          return this.ProjectHistoryRedisManager.queueOps
            .calledWith(this.project_id, JSON.stringify(this.ops[0]))
            .should.equal(true)
        })

        return it('should call the callback with the project update count only', function () {
          return this.callback
            .calledWith(null, undefined, this.project_update_list_length)
            .should.equal(true)
        })
      })
    })

    describe('with an inconsistent version', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.doc_id)
          .yields(null, this.version - this.ops.length - 1)
        return this.RedisManager.updateDocument(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      it('should not call multi.exec', function () {
        return this.multi.exec.called.should.equal(false)
      })

      return it('should call the callback with an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('with no updates', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.doc_id)
          .yields(null, this.version)
        return this.RedisManager.updateDocument(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          [],
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      it('should not try to enqueue doc updates', function () {
        return this.multi.rpush.called.should.equal(false)
      })

      it('should not try to enqueue project updates', function () {
        return this.ProjectHistoryRedisManager.queueOps.called.should.equal(
          false
        )
      })

      return it('should still set the doclines', function () {
        this.multi.mset
          .calledWith({
            [`doclines:${this.doc_id}`]: JSON.stringify(this.lines),
            [`DocVersion:${this.doc_id}`]: this.version,
            [`DocHash:${this.doc_id}`]: this.hash,
            [`Ranges:${this.doc_id}`]: JSON.stringify(this.ranges),
            [`lastUpdatedAt:${this.doc_id}`]: Date.now(),
            [`lastUpdatedBy:${this.doc_id}`]: 'last-author-fake-id',
          })
          .should.equal(true)
      })
    })

    describe('with empty ranges', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.doc_id)
          .yields(null, this.version - this.ops.length)
        return this.RedisManager.updateDocument(
          this.project_id,
          this.doc_id,
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
            [`doclines:${this.doc_id}`]: JSON.stringify(this.lines),
            [`DocVersion:${this.doc_id}`]: this.version,
            [`DocHash:${this.doc_id}`]: this.hash,
            [`Ranges:${this.doc_id}`]: null,
            [`lastUpdatedAt:${this.doc_id}`]: Date.now(),
            [`lastUpdatedBy:${this.doc_id}`]: 'last-author-fake-id',
          })
          .should.equal(true)
      })
    })

    describe('with null bytes in the serialized doc lines', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.doc_id)
          .yields(null, this.version - this.ops.length)
        this.stringifyStub = sinon
          .stub(JSON, 'stringify')
          .callsFake(() => '["bad bytes! \u0000 <- here"]')
        return this.RedisManager.updateDocument(
          this.project_id,
          this.doc_id,
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
        return this.logger.error.called.should.equal(true)
      })

      return it('should call the callback with an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    describe('with ranges that are too big', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.doc_id)
          .yields(null, this.version - this.ops.length)
        this.RedisManager._serializeRanges = sinon
          .stub()
          .yields(new Error('ranges are too large'))
        return this.RedisManager.updateDocument(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ops,
          this.ranges,
          this.updateMeta,
          this.callback
        )
      })

      it('should log an error', function () {
        return this.logger.error.called.should.equal(true)
      })

      return it('should call the callback with the error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    return describe('without user id from meta', function () {
      beforeEach(function () {
        this.RedisManager.getDocVersion
          .withArgs(this.doc_id)
          .yields(null, this.version - this.ops.length)
        return this.RedisManager.updateDocument(
          this.project_id,
          this.doc_id,
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
            [`doclines:${this.doc_id}`]: JSON.stringify(this.lines),
            [`DocVersion:${this.doc_id}`]: this.version,
            [`DocHash:${this.doc_id}`]: this.hash,
            [`Ranges:${this.doc_id}`]: JSON.stringify(this.ranges),
            [`lastUpdatedAt:${this.doc_id}`]: Date.now(),
            [`lastUpdatedBy:${this.doc_id}`]: undefined,
          })
          .should.equal(true)
      })
    })
  })

  describe('putDocInMemory', function () {
    beforeEach(function () {
      this.rclient.mset = sinon.stub().yields(null)
      this.rclient.sadd = sinon.stub().yields()
      this.lines = ['one', 'two', 'three', 'これは']
      this.version = 42
      this.hash = crypto
        .createHash('sha1')
        .update(JSON.stringify(this.lines), 'utf8')
        .digest('hex')
      this.ranges = { comments: 'mock', entries: 'mock' }
      return (this.pathname = '/a/b/c.tex')
    })

    describe('with non-empty ranges', function () {
      beforeEach(function (done) {
        return this.RedisManager.putDocInMemory(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.pathname,
          this.projectHistoryId,
          done
        )
      })

      it('should set all the details in a single MSET call', function () {
        this.rclient.mset
          .calledWith({
            [`doclines:${this.doc_id}`]: JSON.stringify(this.lines),
            [`ProjectId:${this.doc_id}`]: this.project_id,
            [`DocVersion:${this.doc_id}`]: this.version,
            [`DocHash:${this.doc_id}`]: this.hash,
            [`Ranges:${this.doc_id}`]: JSON.stringify(this.ranges),
            [`Pathname:${this.doc_id}`]: this.pathname,
            [`ProjectHistoryId:${this.doc_id}`]: this.projectHistoryId,
          })
          .should.equal(true)
      })

      it('should add the doc_id to the project set', function () {
        return this.rclient.sadd
          .calledWith(`DocsIn:${this.project_id}`, this.doc_id)
          .should.equal(true)
      })

      return it('should not log any errors', function () {
        return this.logger.error.calledWith().should.equal(false)
      })
    })

    describe('with empty ranges', function () {
      beforeEach(function (done) {
        return this.RedisManager.putDocInMemory(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          {},
          this.pathname,
          this.projectHistoryId,
          done
        )
      })

      it('should unset ranges', function () {
        this.rclient.mset
          .calledWith({
            [`doclines:${this.doc_id}`]: JSON.stringify(this.lines),
            [`ProjectId:${this.doc_id}`]: this.project_id,
            [`DocVersion:${this.doc_id}`]: this.version,
            [`DocHash:${this.doc_id}`]: this.hash,
            [`Ranges:${this.doc_id}`]: null,
            [`Pathname:${this.doc_id}`]: this.pathname,
            [`ProjectHistoryId:${this.doc_id}`]: this.projectHistoryId,
          })
          .should.equal(true)
      })
    })

    describe('with null bytes in the serialized doc lines', function () {
      beforeEach(function () {
        this.stringifyStub = sinon
          .stub(JSON, 'stringify')
          .callsFake(() => '["bad bytes! \u0000 <- here"]')
        return this.RedisManager.putDocInMemory(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.pathname,
          this.projectHistoryId,
          this.callback
        )
      })

      afterEach(function () {
        this.stringifyStub.restore()
      })

      it('should log an error', function () {
        return this.logger.error.called.should.equal(true)
      })

      return it('should call the callback with an error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })

    return describe('with ranges that are too big', function () {
      beforeEach(function () {
        this.RedisManager._serializeRanges = sinon
          .stub()
          .yields(new Error('ranges are too large'))
        return this.RedisManager.putDocInMemory(
          this.project_id,
          this.doc_id,
          this.lines,
          this.version,
          this.ranges,
          this.pathname,
          this.projectHistoryId,
          this.callback
        )
      })

      it('should log an error', function () {
        return this.logger.error.called.should.equal(true)
      })

      return it('should call the callback with the error', function () {
        return this.callback
          .calledWith(sinon.match.instanceOf(Error))
          .should.equal(true)
      })
    })
  })

  describe('removeDocFromMemory', function () {
    beforeEach(function (done) {
      this.multi.strlen = sinon.stub()
      this.multi.del = sinon.stub()
      this.multi.srem = sinon.stub()
      this.multi.exec.yields()
      return this.RedisManager.removeDocFromMemory(
        this.project_id,
        this.doc_id,
        done
      )
    })

    it('should check the length of the current doclines', function () {
      return this.multi.strlen
        .calledWith(`doclines:${this.doc_id}`)
        .should.equal(true)
    })

    it('should delete the details in a singe call', function () {
      return this.multi.del
        .calledWith(
          `doclines:${this.doc_id}`,
          `ProjectId:${this.doc_id}`,
          `DocVersion:${this.doc_id}`,
          `DocHash:${this.doc_id}`,
          `Ranges:${this.doc_id}`,
          `Pathname:${this.doc_id}`,
          `ProjectHistoryId:${this.doc_id}`,
          `ProjectHistoryType:${this.doc_id}`,
          `UnflushedTime:${this.doc_id}`,
          `lastUpdatedAt:${this.doc_id}`,
          `lastUpdatedBy:${this.doc_id}`
        )
        .should.equal(true)
    })

    it('should remove the doc_id from the project set', function () {
      return this.multi.srem
        .calledWith(`DocsIn:${this.project_id}`, this.doc_id)
        .should.equal(true)
    })
  })

  describe('clearProjectState', function () {
    beforeEach(function (done) {
      this.rclient.del = sinon.stub().callsArg(1)
      return this.RedisManager.clearProjectState(this.project_id, done)
    })

    return it('should delete the project state', function () {
      return this.rclient.del
        .calledWith(`ProjectState:${this.project_id}`)
        .should.equal(true)
    })
  })

  return describe('renameDoc', function () {
    beforeEach(function () {
      this.rclient.rpush = sinon.stub().yields()
      this.rclient.set = sinon.stub().yields()
      return (this.update = {
        id: this.doc_id,
        pathname: (this.pathname = 'pathname'),
        newPathname: (this.newPathname = 'new-pathname'),
      })
    })

    describe('the document is cached in redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(2, null, 'lines', 'version')
        this.ProjectHistoryRedisManager.queueRenameEntity = sinon
          .stub()
          .yields()
        return this.RedisManager.renameDoc(
          this.project_id,
          this.doc_id,
          this.userId,
          this.update,
          this.projectHistoryId,
          this.callback
        )
      })

      it('update the cached pathname', function () {
        return this.rclient.set
          .calledWith(`Pathname:${this.doc_id}`, this.newPathname)
          .should.equal(true)
      })

      return it('should queue an update', function () {
        return this.ProjectHistoryRedisManager.queueRenameEntity
          .calledWithExactly(
            this.project_id,
            this.projectHistoryId,
            'doc',
            this.doc_id,
            this.userId,
            this.update,
            this.callback
          )
          .should.equal(true)
      })
    })

    describe('the document is not cached in redis', function () {
      beforeEach(function () {
        this.RedisManager.getDoc = sinon
          .stub()
          .callsArgWith(2, null, null, null)
        this.ProjectHistoryRedisManager.queueRenameEntity = sinon
          .stub()
          .yields()
        return this.RedisManager.renameDoc(
          this.project_id,
          this.doc_id,
          this.userId,
          this.update,
          this.projectHistoryId,
          this.callback
        )
      })

      it('does not update the cached pathname', function () {
        return this.rclient.set.called.should.equal(false)
      })

      return it('should queue an update', function () {
        return this.ProjectHistoryRedisManager.queueRenameEntity
          .calledWithExactly(
            this.project_id,
            this.projectHistoryId,
            'doc',
            this.doc_id,
            this.userId,
            this.update,
            this.callback
          )
          .should.equal(true)
      })
    })

    return describe('getDocVersion', function () {
      beforeEach(function () {
        return (this.version = 12345)
      })

      describe('when the document does not have a project history type set', function () {
        beforeEach(function () {
          this.rclient.mget = sinon
            .stub()
            .withArgs(
              `DocVersion:${this.doc_id}`,
              `ProjectHistoryType:${this.doc_id}`
            )
            .callsArgWith(2, null, [`${this.version}`])
          return this.RedisManager.getDocVersion(this.doc_id, this.callback)
        })

        return it('should return the document version and an undefined history type', function () {
          return this.callback
            .calledWithExactly(null, this.version, undefined)
            .should.equal(true)
        })
      })

      return describe('when the document has a project history type set', function () {
        beforeEach(function () {
          this.rclient.mget = sinon
            .stub()
            .withArgs(
              `DocVersion:${this.doc_id}`,
              `ProjectHistoryType:${this.doc_id}`
            )
            .callsArgWith(2, null, [`${this.version}`, 'project-history'])
          return this.RedisManager.getDocVersion(this.doc_id, this.callback)
        })

        return it('should return the document version and history type', function () {
          return this.callback
            .calledWithExactly(null, this.version, 'project-history')
            .should.equal(true)
        })
      })
    })
  })
})
