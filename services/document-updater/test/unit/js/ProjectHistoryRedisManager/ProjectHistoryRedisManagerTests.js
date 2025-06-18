const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/ProjectHistoryRedisManager.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')

describe('ProjectHistoryRedisManager', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.user_id = 'user-id-123'
    this.rclient = {}
    this.source = 'editor'
    tk.freeze(new Date())

    this.Limits = {
      docIsTooLarge: sinon.stub().returns(false),
      stringFileDataContentIsTooLarge: sinon.stub().returns(false),
    }

    this.ProjectHistoryRedisManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          max_doc_length: 123,
          redis: {
            project_history: {
              key_schema: {
                projectHistoryOps({ project_id: projectId }) {
                  return `ProjectHistory:Ops:${projectId}`
                },
                projectHistoryFirstOpTimestamp({ project_id: projectId }) {
                  return `ProjectHistory:FirstOpTimestamp:${projectId}`
                },
              },
            },
          },
        }),
        '@overleaf/redis-wrapper': {
          createClient: () => this.rclient,
        },
        './Metrics': (this.metrics = { summary: sinon.stub() }),
        './Limits': this.Limits,
      },
    })
  })

  afterEach(function () {
    tk.reset()
  })

  describe('queueOps', function () {
    beforeEach(async function () {
      this.ops = ['mock-op-1', 'mock-op-2']
      this.multi = { exec: sinon.stub().resolves([1]) }
      this.multi.rpush = sinon.stub()
      this.multi.setnx = sinon.stub()
      this.rclient.multi = () => this.multi
      await this.ProjectHistoryRedisManager.promises.queueOps(
        this.project_id,
        ...this.ops
      )
    })

    it('should queue an update', function () {
      this.multi.rpush.should.have.been.calledWithExactly(
        `ProjectHistory:Ops:${this.project_id}`,
        this.ops[0],
        this.ops[1]
      )
    })

    it('should set the queue timestamp if not present', function () {
      this.multi.setnx.should.have.been.calledWithExactly(
        `ProjectHistory:FirstOpTimestamp:${this.project_id}`,
        Date.now()
      )
    })
  })

  describe('queueRenameEntity', function () {
    beforeEach(async function () {
      this.file_id = 1234

      this.rawUpdate = {
        pathname: (this.pathname = '/old'),
        newPathname: (this.newPathname = '/new'),
        version: (this.version = 2),
      }

      this.ProjectHistoryRedisManager.promises.queueOps = sinon
        .stub()
        .resolves()
      await this.ProjectHistoryRedisManager.promises.queueRenameEntity(
        this.project_id,
        this.projectHistoryId,
        'file',
        this.file_id,
        this.user_id,
        this.rawUpdate,
        this.source
      )
    })

    it('should queue an update', function () {
      const update = {
        pathname: this.pathname,
        new_pathname: this.newPathname,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        file: this.file_id,
      }

      this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
        this.project_id,
        JSON.stringify(update)
      )
    })
  })

  describe('queueAddEntity', function () {
    beforeEach(function () {
      this.doc_id = 1234

      this.rawUpdate = {
        pathname: (this.pathname = '/old'),
        docLines: (this.docLines = 'a\nb'),
        version: (this.version = 2),
      }

      this.ProjectHistoryRedisManager.promises.queueOps = sinon
        .stub()
        .resolves()
    })

    it('should queue an update', async function () {
      this.rawUpdate.url = this.url = 'filestore.example.com'
      await this.ProjectHistoryRedisManager.promises.queueAddEntity(
        this.project_id,
        this.projectHistoryId,
        'doc',
        this.doc_id,
        this.user_id,
        this.rawUpdate,
        this.source
      )

      const update = {
        pathname: this.pathname,
        docLines: this.docLines,
        url: this.url,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        createdBlob: false,
        doc: this.doc_id,
      }

      this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
        this.project_id,
        JSON.stringify(update)
      )
    })

    it('should queue an update with file metadata', async function () {
      const metadata = {
        importedAt: '2024-07-30T09:14:45.928Z',
        provider: 'references-provider',
      }
      const projectId = 'project-id'
      const fileId = 'file-id'
      const url = `http://filestore/project/${projectId}/file/${fileId}`
      await this.ProjectHistoryRedisManager.promises.queueAddEntity(
        projectId,
        this.projectHistoryId,
        'file',
        fileId,
        this.user_id,
        {
          pathname: 'foo.png',
          url,
          version: 42,
          hash: '1337',
          metadata,
        },
        this.source
      )

      const update = {
        pathname: 'foo.png',
        docLines: undefined,
        url,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: 42,
        hash: '1337',
        metadata,
        projectHistoryId: this.projectHistoryId,
        createdBlob: false,
        file: fileId,
      }

      expect(
        this.ProjectHistoryRedisManager.promises.queueOps.args[0][1]
      ).to.equal(JSON.stringify(update))
      this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
        projectId,
        JSON.stringify(update)
      )
    })

    it('should forward history compatible ranges if history ranges support is enabled', async function () {
      this.rawUpdate.historyRangesSupport = true
      this.docLines = 'the quick fox jumps over the lazy dog'

      const ranges = {
        changes: [
          {
            op: { p: 4, i: 'quick' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { p: 9, d: ' brown' },
            metadata: { ts: '2024-02-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { p: 14, i: 'jumps' },
            metadata: { ts: '2024-02-01T00:00:00.000Z', user_id: 'user-1' },
          },
        ],
        comments: [
          {
            op: { p: 29, c: 'lazy', t: 'comment-1' },
            metadata: { resolved: false },
          },
        ],
      }
      this.rawUpdate.ranges = ranges
      this.rawUpdate.docLines = this.docLines

      await this.ProjectHistoryRedisManager.promises.queueAddEntity(
        this.project_id,
        this.projectHistoryId,
        'doc',
        this.doc_id,
        this.user_id,
        this.rawUpdate,
        this.source
      )

      const historyCompatibleRanges = {
        comments: [
          {
            op: { p: 29, c: 'lazy', t: 'comment-1', hpos: 35 },
            metadata: { resolved: false },
          },
        ],
        changes: [
          {
            op: { p: 4, i: 'quick' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { p: 9, d: ' brown' },
            metadata: { ts: '2024-02-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { p: 14, i: 'jumps', hpos: 20 },
            metadata: { ts: '2024-02-01T00:00:00.000Z', user_id: 'user-1' },
          },
        ],
      }

      const update = {
        pathname: this.pathname,
        docLines: 'the quick brown fox jumps over the lazy dog',
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        createdBlob: false,
        ranges: historyCompatibleRanges,
        doc: this.doc_id,
      }

      expect(
        this.ProjectHistoryRedisManager.promises.queueOps
      ).to.have.been.calledWithExactly(this.project_id, JSON.stringify(update))
    })

    it('should not forward ranges if history ranges support is disabled', async function () {
      this.rawUpdate.historyRangesSupport = false

      const ranges = {
        changes: [
          {
            op: { p: 0, i: 'foo' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { p: 7, d: ' baz' },
            metadata: { ts: '2024-02-01T00:00:00.000Z', user_id: 'user-1' },
          },
        ],
        comments: [
          {
            op: { p: 4, c: 'bar', t: 'comment-1' },
            metadata: { resolved: false },
          },
        ],
      }
      this.rawUpdate.ranges = ranges

      await this.ProjectHistoryRedisManager.promises.queueAddEntity(
        this.project_id,
        this.projectHistoryId,
        'doc',
        this.doc_id,
        this.user_id,
        this.rawUpdate,
        this.source
      )

      const update = {
        pathname: this.pathname,
        docLines: this.docLines,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        createdBlob: false,
        doc: this.doc_id,
      }

      this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
        this.project_id,
        JSON.stringify(update)
      )
    })

    it('should not forward ranges if history ranges support is undefined', async function () {
      this.rawUpdate.historyRangesSupport = false

      const ranges = {
        changes: [
          {
            op: { p: 0, i: 'foo' },
            metadata: { ts: '2024-01-01T00:00:00.000Z', user_id: 'user-1' },
          },
          {
            op: { p: 7, d: ' baz' },
            metadata: { ts: '2024-02-01T00:00:00.000Z', user_id: 'user-1' },
          },
        ],
        comments: [
          {
            op: { p: 4, c: 'bar', t: 'comment-1' },
            metadata: { resolved: false },
          },
        ],
      }
      this.rawUpdate.ranges = ranges

      await this.ProjectHistoryRedisManager.promises.queueAddEntity(
        this.project_id,
        this.projectHistoryId,
        'doc',
        this.doc_id,
        this.user_id,
        this.rawUpdate,
        this.source
      )

      const update = {
        pathname: this.pathname,
        docLines: this.docLines,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        createdBlob: false,
        doc: this.doc_id,
      }

      this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
        this.project_id,
        JSON.stringify(update)
      )
    })

    it('should pass "false" as the createdBlob field if not provided', async function () {
      await this.ProjectHistoryRedisManager.promises.queueAddEntity(
        this.project_id,
        this.projectHistoryId,
        'doc',
        this.doc_id,
        this.user_id,
        this.rawUpdate,
        this.source
      )

      const update = {
        pathname: this.pathname,
        docLines: this.docLines,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        createdBlob: false,
        doc: this.doc_id,
      }

      this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
        this.project_id,
        JSON.stringify(update)
      )
    })

    it('should pass through the value of the createdBlob field', async function () {
      this.rawUpdate.createdBlob = true
      await this.ProjectHistoryRedisManager.promises.queueAddEntity(
        this.project_id,
        this.projectHistoryId,
        'doc',
        this.doc_id,
        this.user_id,
        this.rawUpdate,
        this.source
      )

      const update = {
        pathname: this.pathname,
        docLines: this.docLines,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
          source: this.source,
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        createdBlob: true,
        doc: this.doc_id,
      }

      this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
        this.project_id,
        JSON.stringify(update)
      )
    })
  })

  describe('queueResyncProjectStructure', function () {
    it('should queue an update', function () {})
  })

  describe('queueResyncDocContent', function () {
    beforeEach(function () {
      this.doc_id = 1234
      this.lines = ['one', 'two']
      this.ranges = {
        changes: [{ op: { i: 'ne', p: 1 } }, { op: { d: 'deleted', p: 3 } }],
      }
      this.resolvedCommentIds = ['comment-1']
      this.version = 2
      this.pathname = '/path'

      this.ProjectHistoryRedisManager.promises.queueOps = sinon
        .stub()
        .resolves()
    })

    describe('with a good doc', function () {
      beforeEach(async function () {
        this.update = {
          resyncDocContent: {
            version: this.version,
            content: 'one\ntwo',
          },
          projectHistoryId: this.projectHistoryId,
          path: this.pathname,
          doc: this.doc_id,
          meta: { ts: new Date() },
        }

        await this.ProjectHistoryRedisManager.promises.queueResyncDocContent(
          this.project_id,
          this.projectHistoryId,
          this.doc_id,
          this.lines,
          this.ranges,
          this.resolvedCommentIds,
          this.version,
          this.pathname,
          false
        )
      })

      it('should check if the doc is too large', function () {
        this.Limits.docIsTooLarge.should.have.been.calledWith(
          JSON.stringify(this.update).length,
          this.lines,
          this.settings.max_doc_length
        )
      })

      it('should queue an update', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
          this.project_id,
          JSON.stringify(this.update)
        )
      })
    })

    describe('with a doc that is too large', function () {
      beforeEach(async function () {
        this.Limits.docIsTooLarge.returns(true)
        await expect(
          this.ProjectHistoryRedisManager.promises.queueResyncDocContent(
            this.project_id,
            this.projectHistoryId,
            this.doc_id,
            this.lines,
            this.ranges,
            this.resolvedCommentIds,
            this.version,
            this.pathname,
            false
          )
        ).to.be.rejected
      })

      it('should not queue an update if the doc is too large', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.not.have.been
          .called
      })
    })

    describe('when history ranges support is enabled', function () {
      beforeEach(async function () {
        this.update = {
          resyncDocContent: {
            version: this.version,
            ranges: this.ranges,
            resolvedCommentIds: this.resolvedCommentIds,
            content: 'onedeleted\ntwo',
          },
          projectHistoryId: this.projectHistoryId,
          path: this.pathname,
          doc: this.doc_id,
          meta: { ts: new Date() },
        }

        await this.ProjectHistoryRedisManager.promises.queueResyncDocContent(
          this.project_id,
          this.projectHistoryId,
          this.doc_id,
          this.lines,
          this.ranges,
          this.resolvedCommentIds,
          this.version,
          this.pathname,
          true
        )
      })

      it('should include tracked deletes in the update', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
          this.project_id,
          JSON.stringify(this.update)
        )
      })

      it('should check the doc length without tracked deletes', function () {
        this.Limits.docIsTooLarge.should.have.been.calledWith(
          JSON.stringify(this.update).length,
          this.lines,
          this.settings.max_doc_length
        )
      })

      it('should queue an update', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
          this.project_id,
          JSON.stringify(this.update)
        )
      })
    })

    describe('history-ot', function () {
      beforeEach(async function () {
        this.lines = {
          content: 'onedeleted\ntwo',
          comments: [{ id: 'id1', ranges: [{ pos: 0, length: 3 }] }],
          trackedChanges: [
            {
              range: { pos: 3, length: 7 },
              tracking: {
                type: 'delete',
                userId: 'user-id',
                ts: '2025-06-16T14:31:44.910Z',
              },
            },
          ],
        }
        this.update = {
          resyncDocContent: {
            version: this.version,
            historyOTRanges: {
              comments: this.lines.comments,
              trackedChanges: this.lines.trackedChanges,
            },
            content: this.lines.content,
          },
          projectHistoryId: this.projectHistoryId,
          path: this.pathname,
          doc: this.doc_id,
          meta: { ts: new Date() },
        }

        await this.ProjectHistoryRedisManager.promises.queueResyncDocContent(
          this.project_id,
          this.projectHistoryId,
          this.doc_id,
          this.lines,
          this.ranges,
          this.resolvedCommentIds,
          this.version,
          this.pathname,
          true
        )
      })

      it('should include tracked deletes in the update', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
          this.project_id,
          JSON.stringify(this.update)
        )
      })

      it('should check the doc length without tracked deletes', function () {
        this.Limits.stringFileDataContentIsTooLarge.should.have.been.calledWith(
          this.lines,
          this.settings.max_doc_length
        )
      })

      it('should queue an update', function () {
        this.ProjectHistoryRedisManager.promises.queueOps.should.have.been.calledWithExactly(
          this.project_id,
          JSON.stringify(this.update)
        )
      })
    })
  })
})
