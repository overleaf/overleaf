/* eslint-disable
    camelcase,
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
const modulePath = '../../../../app/js/ProjectHistoryRedisManager.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')

describe('ProjectHistoryRedisManager', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'
    this.projectHistoryId = 'history-id-123'
    this.user_id = 'user-id-123'
    this.callback = sinon.stub()
    this.rclient = {}
    tk.freeze(new Date())
    return (this.ProjectHistoryRedisManager = SandboxedModule.require(
      modulePath,
      {
        requires: {
          '@overleaf/settings': (this.settings = {
            redis: {
              project_history: {
                key_schema: {
                  projectHistoryOps({ project_id }) {
                    return `ProjectHistory:Ops:${project_id}`
                  },
                  projectHistoryFirstOpTimestamp({ project_id }) {
                    return `ProjectHistory:FirstOpTimestamp:${project_id}`
                  },
                },
              },
            },
          }),
          '@overleaf/redis-wrapper': {
            createClient: () => this.rclient,
          },
          './Metrics': (this.metrics = { summary: sinon.stub() }),
        },
      }
    ))
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('queueOps', function () {
    beforeEach(function () {
      this.ops = ['mock-op-1', 'mock-op-2']
      this.multi = { exec: sinon.stub() }
      this.multi.rpush = sinon.stub()
      this.multi.setnx = sinon.stub()
      this.rclient.multi = () => this.multi
      // @rclient = multi: () => @multi
      return this.ProjectHistoryRedisManager.queueOps(
        this.project_id,
        ...Array.from(this.ops),
        this.callback
      )
    })

    it('should queue an update', function () {
      return this.multi.rpush
        .calledWithExactly(
          `ProjectHistory:Ops:${this.project_id}`,
          this.ops[0],
          this.ops[1]
        )
        .should.equal(true)
    })

    return it('should set the queue timestamp if not present', function () {
      return this.multi.setnx
        .calledWithExactly(
          `ProjectHistory:FirstOpTimestamp:${this.project_id}`,
          Date.now()
        )
        .should.equal(true)
    })
  })

  describe('queueRenameEntity', function () {
    beforeEach(function () {
      this.file_id = 1234

      this.rawUpdate = {
        pathname: (this.pathname = '/old'),
        newPathname: (this.newPathname = '/new'),
        version: (this.version = 2),
      }

      this.ProjectHistoryRedisManager.queueOps = sinon.stub()
      return this.ProjectHistoryRedisManager.queueRenameEntity(
        this.project_id,
        this.projectHistoryId,
        'file',
        this.file_id,
        this.user_id,
        this.rawUpdate,
        this.callback
      )
    })

    return it('should queue an update', function () {
      const update = {
        pathname: this.pathname,
        new_pathname: this.newPathname,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        file: this.file_id,
      }

      return this.ProjectHistoryRedisManager.queueOps
        .calledWithExactly(
          this.project_id,
          JSON.stringify(update),
          this.callback
        )
        .should.equal(true)
    })
  })

  return describe('queueAddEntity', function () {
    beforeEach(function () {
      this.rclient.rpush = sinon.stub().yields()
      this.doc_id = 1234

      this.rawUpdate = {
        pathname: (this.pathname = '/old'),
        docLines: (this.docLines = 'a\nb'),
        version: (this.version = 2),
        url: (this.url = 'filestore.example.com'),
      }

      this.ProjectHistoryRedisManager.queueOps = sinon.stub()
      return this.ProjectHistoryRedisManager.queueAddEntity(
        this.project_id,
        this.projectHistoryId,
        'doc',
        this.doc_id,
        this.user_id,
        this.rawUpdate,
        this.callback
      )
    })

    it('should queue an update', function () {
      const update = {
        pathname: this.pathname,
        docLines: this.docLines,
        url: this.url,
        meta: {
          user_id: this.user_id,
          ts: new Date(),
        },
        version: this.version,
        projectHistoryId: this.projectHistoryId,
        doc: this.doc_id,
      }

      return this.ProjectHistoryRedisManager.queueOps
        .calledWithExactly(
          this.project_id,
          JSON.stringify(update),
          this.callback
        )
        .should.equal(true)
    })

    describe('queueResyncProjectStructure', function () {
      return it('should queue an update', function () {})
    })

    return describe('queueResyncDocContent', function () {
      return it('should queue an update', function () {})
    })
  })
})
